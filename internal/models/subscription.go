package models

import "gorm.io/gorm"

type PushSubscription struct {
	gorm.Model
	UserID         string // optional, if you want to link it to users
	Endpoint       string `gorm:"uniqueIndex"`
	P256dh         string
	Auth           string
	ExpirationTime *int
}
