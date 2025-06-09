# Messenger Web App

A real-time messaging web application with support for message delivery, read receipts, push notifications, and PWA (Progressive Web App) features.

## 🚀 Features

- 📩 Real-time messaging
- ✅ Read receipts (single, double, blue ticks like WhatsApp)
- 📦 Push notifications using Service Workers
- 📱 PWA support (installable on Android)
- 🔐 JWT authentication
- 🧩 User-friendly UI with chat previews and unread message indicators

## 🛠 Tech Stack

- *Frontend*: HTML, CSS, JavaScript
- *Backend*: Go (Golang), Gin Framework
- *Database*: PostgreSQL
- *Push Notifications*: Web Push API (VAPID)
- *Service Worker*: For offline support and notifications

## 📦 Setup Instructions

1. *Clone the repository*
   ```bash
   git clone https://github.com/Akhil-Suden/messenger.git
   cd messenger

2. Configure Environment

Set up your env variables with DB connection, VAPID keys, etc.

- DATABASE_URL
- VAPID_PRIVATE_KEY
- VAPID_PUBLIC_KEY

3. Run the Go server

go run main.go


4. Open your browser

http://localhost:8080



📱 PWA Installation

On Android, open the app in Chrome and tap "Add to Home screen".

🔔 Push Notifications

Make sure your backend has proper VAPID key setup. Subscriptions are stored in the database and used to send messages through Web Push.

👥 Contributors

Akhil Suden
