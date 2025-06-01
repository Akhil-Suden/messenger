package repository

import (
	"messenger/internal/db"
	"messenger/internal/models"
)

func GetUsernameFromDB(userID string) (string, error) {
	var username string
	err := db.DB.Model(&models.User{}).
		Where("id = ?", userID).
		Pluck("username", &username).Error

	if err != nil {
		return "", err
	}
	return username, nil
}
