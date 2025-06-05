let socket;

import * as messages from "./messages.js";

export function connectWebSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;

  // Replace with your WebSocket endpoint (adjust port/path as needed)
  if (window.location.protocol === "http:") {
    // For local development, use the local server
    socket = new WebSocket("ws://localhost:8080/ws?token=" + token);
  } else {
    // For production, use the secure WebSocket connection
    socket = new WebSocket(`wss://${window.location.host}/ws?token=${token}`);
  }

  socket.onopen = () => {
    socket.send(
      JSON.stringify({
        token: localStorage.getItem("token"),
      })
    );
    console.log("WebSocket connected");
  };

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "message") {
      let msg = JSON.parse(data.payload);
      const senderId = msg.SenderID;
      const recieverID = msg.ReceiverID;
      const userId = localStorage.getItem("userid");

      messages.showMessagePreviews(senderId, recieverID, msg.Content);
      if (userId !== senderId) {
        messages.showCount(senderId);
      }

      const scrollable = document.getElementById(
        messages.getScrollableId(senderId, recieverID)
      );
      if (!scrollable) return;

      messages.addSingleMessageAppend(msg, senderId, recieverID, scrollable);
    } else if (data.type === "message_deleted") {
      const msg = JSON.parse(data.payload);
      let senderId = msg.SenderID;
      let recieverID = msg.ReceiverID;
      let senderName = msg.Sender.Username;

      await messages.loadConversationWith(
        senderId,
        recieverID,
        msg.SenderUsername
      );

      const scrollable = document.getElementById(
        messages.getScrollableId(senderId, recieverID)
      );
      if (!scrollable) return;

      let userId = localStorage.getItem("userid");
      if (userId === senderId) {
        //If message is deleted by current user, view conversation with receiver
        senderId = recieverID;
        recieverID = userId;
        senderName = msg.Receiver.Username;
      }
      messages.viewConversationWith(
        senderId,
        recieverID,
        senderName,
        scrollable.scrollTop,
        false
      );
    }

    socket.onclose = () => {
      console.log("WebSocket closed. Reconnecting...");
      setTimeout(connectWebSocket, 3000); // retry after 3s
    };

    socket.onerror = (err) => {
      console.error("WebSocket error", err);
    };
  };
}
