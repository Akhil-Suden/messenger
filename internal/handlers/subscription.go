package handlers

import (
	"fmt"
	"messenger/internal/db"
	"messenger/internal/models"
	"messenger/internal/notifications"
	"net/http"

	"github.com/gin-gonic/gin"
)

func HandleSubscribe(c *gin.Context) {
	userId := c.GetString("user_id")
	var sub notifications.Subscription
	if err := c.BindJSON(&sub); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription"})
		return
	}

	// For now, just print or log the subscription
	fmt.Printf("Received subscription: %+v\n", sub)

	tx := db.DB.Create(&models.PushSubscription{
		UserID:         userId, // If you have user sessions
		Endpoint:       sub.Endpoint,
		P256dh:         sub.Keys.P256dh,
		Auth:           sub.Keys.Auth,
		ExpirationTime: sub.ExpirationTime,
	})
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription received"})
}
