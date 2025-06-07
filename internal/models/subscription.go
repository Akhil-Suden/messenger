package models

import "gorm.io/gorm"

type PushSubscription struct {
	gorm.Model
	UserID         string `gorm:"uniqueIndex"`
	Endpoint       string `gorm:"uniqueIndex"`
	P256dh         string
	Auth           string
	ExpirationTime *int
}
