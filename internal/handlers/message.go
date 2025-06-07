package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"messenger/internal/db"
	"messenger/internal/models"
	"messenger/internal/notifications"
	"messenger/internal/repository"
	"messenger/internal/ws"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

var vapidPrivate, vapidPublic string

func init() {
	vapidPrivate = os.Getenv("VAPID_PRIVATE_KEY")
	vapidPublic = os.Getenv("VAPID_PUBLIC_KEY")
}

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

	pageStr := c.Query("page")
	limitStr := c.Query("limit")

	page, _ := strconv.Atoi(pageStr)
	limit, _ := strconv.Atoi(limitStr)
	if page < 1 {
		page = 1
	}
	if limit == 0 {
		limit = 1000 // default
	}
	offset := (page - 1) * limit

	query := db.DB.Order("created_at desc")

	if err := query.Preload("Sender").
		Where("((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)) AND NOT (? = ANY(deleted_for_self_by))", receiverID, senderID, senderID, receiverID, receiverID).Offset(offset).
		Limit(limit).
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
	receiverConn, ok1 := ws.Clients[req.ReceiverID]
	ws.ClientsMu.RUnlock()

	ws.ClientsMu.RLock()
	senderConn, ok2 := ws.Clients[senderId]
	ws.ClientsMu.RUnlock()

	senderName, err := repository.GetUsernameFromDB(senderId)
	if err != nil {
		log.Printf("Error fetching sender username: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch sender username"})
		return
	}
	message.Sender = models.User{Username: senderName}
	msgMar, _ := json.Marshal(message) // Ensure message is marshaled for logging
	payload := map[string]string{
		"type":    "message",
		"payload": string(msgMar),
	}
	if ok1 {
		receiverConn.WriteJSON(payload)
	}
	if ok2 && !(senderId == req.ReceiverID) {
		senderConn.WriteJSON(payload)
	}
	userSubscription, err := repository.GetSubscribeData(req.ReceiverID)
	if userSubscription != nil && err == nil {
		notifications.SendNotification(userSubscription, string(msgMar), vapidPrivate, vapidPublic)
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

func DeleteMessageForSelf(c *gin.Context) {
	var req struct {
		MessageID uuid.UUID `json:"message_id"`
		UserID    string    `json:"user_id"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	var msg models.Message
	if err := db.DB.Preload("Sender").Preload("Receiver").First(&msg, "id = ?", req.MessageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	// Append user ID to DeletedForSelfBy
	msg.DeletedForSelfBy = append(msg.DeletedForSelfBy, req.UserID)
	if err := db.DB.Save(&msg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update message"})
		return
	}

	ws.ClientsMu.RLock()
	userConn, ok := ws.Clients[req.UserID]
	ws.ClientsMu.RUnlock()

	msgMar, _ := json.Marshal(msg) // Ensure message is marshaled for logging
	payload := map[string]string{
		"type":    "message_deleted",
		"payload": string(msgMar),
	}
	if ok {
		userConn.WriteJSON(payload)
	}

	c.JSON(http.StatusOK, gin.H{"status": "message hidden for user"})
}

func DeleteMessageForEveryone(c *gin.Context) {
	var req struct {
		MessageID uuid.UUID `json:"message_id"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	var message models.Message
	if err := db.DB.Preload("Sender").Preload("Receiver").First(&message, "id = ?", req.MessageID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	// Update the message as deleted
	if err := db.DB.Model(&message).Update("is_deleted", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
		return
	}

	ws.ClientsMu.RLock()
	recieverConn, ok1 := ws.Clients[string(message.ReceiverID.String())]
	ws.ClientsMu.RUnlock()

	ws.ClientsMu.RLock()
	senderConn, ok2 := ws.Clients[string(message.SenderID.String())]
	ws.ClientsMu.RUnlock()

	msgMar, _ := json.Marshal(message) // Ensure message is marshaled for logging
	payload := map[string]string{
		"type":    "message_deleted",
		"payload": string(msgMar),
	}
	if ok1 {
		recieverConn.WriteJSON(payload)
	}

	if ok2 {
		senderConn.WriteJSON(payload)
	}

	c.JSON(http.StatusOK, gin.H{"status": "message deleted for all"})
}
