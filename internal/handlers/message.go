package handlers

import (
	"net/http"
	"time"

	"messenger/internal/db"
	"messenger/internal/models"

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

	query := db.DB.Order("created_at desc")

	if err := query.Preload("Sender").Where("receiver_id = ?", receiverID).Find(&messages).Error; err != nil {
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

	c.JSON(http.StatusCreated, gin.H{"message": "Message sent successfully", "id": message.ID})
}
