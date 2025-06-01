package repository

import (
	"log"
	"messenger/internal/db"
	"messenger/internal/models"
)

func GetUnreadCountFromDB(senderID, receiverID string) int64 {
	var count int64
	err := db.DB.Model(&models.Message{}).
		Where("sender_id = ? AND receiver_id = ? AND read = ?", senderID, receiverID, false).
		Count(&count).Error

	if err != nil {
		log.Println("Failed to count unread messages:", err)
		return 0
	}
	return count
}
