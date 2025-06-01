package handlers

import (
	"log"
	"net/http"
	"time"

	"messenger/internal/db"
	"messenger/internal/models"
	"messenger/internal/repository"
	"messenger/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SendMessageRequest struct {
	ReceiverID string `json:"receiver_id" binding:"required,uuid"`
	Content    string `json:"content" binding:"required"`
}

func GetMessages(c *gin.Context) {
	var messages []models.Message

	receiverIDstr := c.GetString("user_id")
	if receiverIDstr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User ID not found in token"})
		return
	}

	receiverID, err := uuid.Parse(receiverIDstr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	senderID := c.Query("sender_id")
	if senderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Sender ID not found in query"})
		return
	}

	query := db.DB.Order("created_at desc")

	if err := query.Preload("Sender").
		Where("receiver_id = ? AND sender_id = ?", receiverID, senderID).
		Find(&messages).Error; err != nil {
		log.Printf("Error fetching messages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
		return
	}
	c.JSON(http.StatusOK, messages)
}

func SendMessage(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senderId := c.GetString("user_id")

	senderUUID, err := uuid.Parse(senderId)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sender_id"})
		return
	}

	receiverUUID, err := uuid.Parse(req.ReceiverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receiver_id"})
		return
	}

	message := models.Message{
		ID:         uuid.New(),
		SenderID:   senderUUID,
		ReceiverID: receiverUUID,
		Content:    req.Content,
		CreatedAt:  time.Now(),
	}

	if err := db.DB.Create(&message).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message"})
		return
	}

	ws.ClientsMu.RLock()
	receiverConn, ok := ws.Clients[req.ReceiverID]
	ws.ClientsMu.RUnlock()

	senderName, err := repository.GetUsernameFromDB(senderId)
	if err != nil {
		log.Printf("Error fetching sender username: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sender username"})
		return
	}

	if ok {
		payload := map[string]string{
			"type":        "message",
			"from":        senderId,
			"sender_name": senderName,
			"content":     req.Content,
			"timestamp":   message.CreatedAt.Format(time.RFC3339),
		}
		receiverConn.WriteJSON(payload)

		unreadCount := repository.GetUnreadCountFromDB(senderId, req.ReceiverID)
		receiverConn.WriteJSON(map[string]interface{}{
			"type":  "unread_update",
			"from":  senderId,
			"count": unreadCount,
		})
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Message sent successfully", "id": message.ID})
}

func UpdateReadStatus(c *gin.Context) {
	var req struct {
		SenderID   string `json:"sender_id" binding:"required,uuid"`
		ReceiverID string `json:"receiver_id" binding:"required,uuid"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senderUUID, err := uuid.Parse(req.SenderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sender_id"})
		return
	}

	receiverUUID, err := uuid.Parse(req.ReceiverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receiver_id"})
		return
	}

	if err := db.DB.Model(&models.Message{}).
		Where("sender_id = ? AND receiver_id = ? AND read = ?", senderUUID, receiverUUID, false).
		Update("read", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update read status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Read status updated successfully"})
}

func UpdateDeliverStatus(c *gin.Context) {
	var req struct {
		SenderID   string `json:"sender_id" binding:"required,uuid"`
		ReceiverID string `json:"receiver_id" binding:"required,uuid"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	senderUUID, err := uuid.Parse(req.SenderID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sender_id"})
		return
	}

	receiverUUID, err := uuid.Parse(req.ReceiverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receiver_id"})
		return
	}

	if err := db.DB.Model(&models.Message{}).
		Where("sender_id = ? AND receiver_id = ? AND delivered = ?", senderUUID, receiverUUID, false).
		Update("delivered", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update delivered status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "delivered status updated successfully"})
}
