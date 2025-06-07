package handlers

import (
	"errors"
	"messenger/internal/db"
	"messenger/internal/models"
	"messenger/internal/notifications"
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func HandleSubscribe(c *gin.Context) {
	userId := c.GetString("user_id")
	var sub notifications.Subscription
	if err := c.BindJSON(&sub); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription"})
		return
	}

	var existing models.PushSubscription
	result := db.DB.Where("user_id = ?", userId).First(&existing)

	if result.Error != nil && !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}

	// If subscription exists, update it
	if result.RowsAffected > 0 {
		existing.Endpoint = sub.Endpoint
		existing.P256dh = sub.Keys.P256dh
		existing.Auth = sub.Keys.Auth
		existing.ExpirationTime = sub.ExpirationTime

		if err := db.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription"})
			return
		}
	} else {
		// No existing subscription — create new one
		newSub := models.PushSubscription{
			UserID:         userId,
			Endpoint:       sub.Endpoint,
			P256dh:         sub.Keys.P256dh,
			Auth:           sub.Keys.Auth,
			ExpirationTime: sub.ExpirationTime,
		}
		if err := db.DB.Create(&newSub).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Subscription stored successfully"})
}
