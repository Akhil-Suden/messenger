package routes

import (
	"messenger/internal/handlers"
	"messenger/internal/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	router := gin.Default()

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE"},
		AllowCredentials: true,
		AllowHeaders:     []string{"Origin", "Content-Type"},
	}))

	// Public routes
	router.POST("/api/register", handlers.Register)
	router.POST("/api/login", handlers.Login)

	// Protected routes
	auth := router.Group("/api")
	auth.Use(middleware.JWTMiddleware())

	auth.GET("/users", handlers.GetUsers)
	auth.POST("/messages", handlers.SendMessage)
	auth.GET("/messages", handlers.GetMessages)
	auth.POST("/messages/read", handlers.UpdateReadStatus)
	auth.POST("/messages/delivered", handlers.UpdateDeliverStatus)
	auth.DELETE("/messages/delete/self", handlers.DeleteMessageForSelf)
	auth.DELETE("/messages/delete/everyone", handlers.DeleteMessageForEveryone)

	// Real-time WebSocket route
	auth.GET("/ws", handlers.ChatWebSocket)

	return router
}
