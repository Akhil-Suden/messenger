package db

import (
	"messenger/internal/models"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Connect() error {
	dsn := os.Getenv("DATABASE_URL") // Set this in environment
	DB, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return err
	}

	// Auto migrate models
	return DB.AutoMigrate(&models.User{}, &models.Message{}, &models.Chat{})
}
