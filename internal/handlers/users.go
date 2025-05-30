package handlers

import (
	"messenger/internal/db"
	"messenger/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
)

func GetUsers(c *gin.Context) {
	currentUserID := c.GetString("user_id")

	var users []models.User
	if err := db.DB.Where("id != ?", currentUserID).Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not fetch users"})
		return
	}

	c.JSON(http.StatusOK, users)
}
