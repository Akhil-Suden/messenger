package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type Message struct {
	ID               uuid.UUID      `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`
	SenderID         uuid.UUID      `gorm:"type:uuid;not null"`
	ReceiverID       uuid.UUID      `gorm:"type:uuid;not null"`
	Content          string         `gorm:"type:text;not null"`
	CreatedAt        time.Time      `gorm:"autoCreateTime"`
	Read             bool           `gorm:"default:false"`
	Delivered        bool           `gorm:"default:false"`
	DeletedForSelfBy pq.StringArray `gorm:"type:text[];default:'{}'"` // Stores IDs of users who have deleted the message for themselves
	IsDeleted        bool           `gorm:"default:false"`            // Indicates if the message is deleted for both sender and receiver

	Sender   User `gorm:"foreignKey:SenderID"`
	Receiver User `gorm:"foreignKey:ReceiverID"`
}

func (Message) TableName() string {
	return "chat_app.messages"
}
