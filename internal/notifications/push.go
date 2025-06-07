package notifications

import (
	"errors"
	"log"

	"github.com/SherClockHolmes/webpush-go"
)

type Subscription struct {
	Endpoint       string `json:"endpoint"`
	ExpirationTime *int   `json:"expirationTime"`
	Keys           struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func SendNotification(subscription *[]Subscription, message string, vapidPrivateKey string, vapidPublicKey string) error {
	if subscription == nil {
		log.Println("No subscription provided, skipping notification")
		return errors.New("no subscription provided")
	}
	for i := range *subscription {
		sub := webpush.Subscription{
			Endpoint: (*subscription)[i].Endpoint,
			Keys: webpush.Keys{
				P256dh: (*subscription)[i].Keys.P256dh,
				Auth:   (*subscription)[i].Keys.Auth,
			},
		}

		resp, err := webpush.SendNotification([]byte(message), &sub, &webpush.Options{
			Subscriber:      "akhil@example.com",
			VAPIDPublicKey:  vapidPublicKey,
			VAPIDPrivateKey: vapidPrivateKey,
			TTL:             30,
		})
		if err != nil {
			log.Printf("Failed to send notification: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != 201 {
			log.Printf("Failed to send notification, status code: %d", resp.StatusCode)
		}

		log.Println("Notification sent successfully")
	}
	return nil
}
