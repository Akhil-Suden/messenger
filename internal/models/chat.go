package models

import (
	"time"

	"github.com/google/uuid"
)

type Chat struct {
	ID        uuid.UUID `gorm:"type:uuid;default:uuid_generate_v4();primaryKey"`
	Name      string
	IsGroup   bool
	CreatedAt time.Time `gorm:"autoCreateTime"`

	Members []User `gorm:"many2many:chat_members"`
}
