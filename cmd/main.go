package main

import (
	"log"
	"messenger/internal/db"     // Optional, for DB connection
	"messenger/internal/routes" // Your router setup
	"messenger/internal/ws"

	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize DB
	if err := db.Connect(); err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}

	// Set up router
	r := routes.SetupRouter()

	r.Static("/static", "../web")        // Serve CSS/JS files from web folder
	r.LoadHTMLFiles("../web/index.html") // If rendering HTML from server

	r.GET("/", func(c *gin.Context) {
		c.File("../web/index.html")
	})

	r.GET("/ws", ws.WsHandler)

	// Start server
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
