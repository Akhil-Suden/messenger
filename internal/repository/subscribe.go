package repository

import (
	"log"
	"messenger/internal/db"
	"messenger/internal/models"
	"messenger/internal/notifications"
)

func GetSubscribeData(receiverID string) (*[]notifications.Subscription, error) {
	var sub []models.PushSubscription
	err := db.DB.Where("user_id = ?", receiverID).Find(&sub).Error
	if err != nil {
		log.Printf("No subscription found for user %s", receiverID)
		// Proceed without push
		return nil, err
	}
	var subscription []notifications.Subscription
	for i := range sub {
		subscription = append(subscription, notifications.Subscription{
			Endpoint: sub[i].Endpoint,
			Keys: struct {
				P256dh string `json:"p256dh"`
				Auth   string `json:"auth"`
			}{
				P256dh: sub[i].P256dh,
				Auth:   sub[i].Auth,
			},
		})
	}
	return &subscription, nil
}
