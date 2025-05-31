package ws

import (
	"encoding/json"
	"log"
	"messenger/internal/db"
	"messenger/internal/middleware"
	"messenger/internal/models"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type BaseMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"` // keep raw JSON for later
}

// Map to keep track of clients
var Clients = make(map[string]*websocket.Conn) // userID -> websocket connection
var ClientsMu sync.RWMutex

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Adjust for production, allow origins you trust
	},
}

func WsHandler(c *gin.Context) {
	tokenStr := c.Query("token")
	if tokenStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	// Parse the token
	claims := &middleware.TokenClaims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte("your-secret-key"), nil // Use your real secret key
	})
	if err != nil || !token.Valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	userID := claims.UserID
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user ID in token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	// Store connection
	ClientsMu.Lock()
	Clients[userID] = conn
	ClientsMu.Unlock()

	defer func() {
		// Cleanup
		ClientsMu.Lock()
		delete(Clients, userID)
		ClientsMu.Unlock()
	}()

	for {
		_, rawData, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket read error:", err)
			break
		}

		log.Println("Raw JSON:", string(rawData)) // for debugging

		var baseMsg BaseMessage
		if err := json.Unmarshal(rawData, &baseMsg); err != nil {
			log.Println("Failed to parse base message:", err)
			continue
		}

		switch baseMsg.Type {
		case "message":
			handleChatMesseges(userID, baseMsg.Payload)
		}
	}
}

func handleChatMesseges(userID string, raw json.RawMessage) {
	var chatMsg models.Message
	if err := json.Unmarshal(raw, &chatMsg); err != nil {
		log.Println("Invalid message payload:", err)
		return
	}
	// Process chatMsg
	chatMsg.ID = uuid.New()
	chatMsg.SenderID, _ = uuid.Parse(userID)
	chatMsg.CreatedAt = time.Now()

	if err := db.DB.Create(&chatMsg).Error; err != nil {
		log.Println("DB save error:", err)
		return
	}

	// Send to receiver if online
	receiverID := chatMsg.ReceiverID.String()

	ClientsMu.RLock()
	receiverConn, ok := Clients[receiverID]
	ClientsMu.RUnlock()

	if ok {
		receiverConn.WriteJSON(map[string]interface{}{
			"from":    userID,
			"content": chatMsg.Content,
			"status":  "delivered",
		})
	}
}
