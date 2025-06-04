let token = "";
let userId = "";
const dividerInsertedMap = {};
let currentPage = 1;
const limit = 1000;
let isLoading = false;

async function register() {
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: document.getElementById("reg-username").value,
      email: document.getElementById("reg-email").value,
      password: document.getElementById("reg-password").value,
    }),
  });
  alert("Registered");
}

async function login() {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.getElementById("login-username").value,
      password: document.getElementById("login-password").value,
    }),
  });
  const data = await res.json();
  token = data.token;
  localStorage.setItem("token", token);
  localStorage.setItem("username", data.username);
  localStorage.setItem("userid", data.userid);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.add("hidden");
  document.getElementById("main").classList.remove("hidden");
  document.getElementById("current-user").classList.remove("hidden");
  document.getElementById("username-display").textContent = `${data.username}`;
  document.getElementById("logout-btn").addEventListener("click", logout);
  connectWebSocket();
  await loadUsers();
}

async function loadUsers() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/users", {
    headers: { Authorization: "Bearer " + token },
  });
  const users = await res.json();

  //Logged in user ID
  let userID = localStorage.getItem("userid");
  if (!userID) {
    console.error("Receiver ID not found in localStorage");
    return;
  }

  // Populate list for viewing messages
  const list = document.getElementById("chat-list");
  list.innerHTML = "";
  users.forEach((sender) => {
    const li = document.createElement("li");
    li.id = `user-${sender.ID}`;
    li.innerHTML = `
    <span class="username">${sender.Username}</span> 
    <span class="unread-count"></span>
    <div class="message-preview" id="preview-${sender.ID}"></div>
    <button onclick="viewConversationWith('${sender.ID}', '${userID}', '${sender.Username}', null,true);">View Messages</button>
  `;
    list.appendChild(li);
    loadConversationWith(sender.ID, userID, sender.Username);
  });
}

window.onload = () => {
  const token = localStorage.getItem("token");

  if (!token) {
    // If token is missing, stay on login page
    return;
  }

  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.add("hidden");
  document.getElementById("main").classList.remove("hidden");
  document.getElementById("current-user").classList.remove("hidden");

  loadUsers();
  connectWebSocket();
  document.getElementById(
    "username-display"
  ).textContent = `${localStorage.getItem("username")}`;
  document.getElementById("logout-btn").addEventListener("click", logout);
};

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  document.getElementById("main").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("register").classList.remove("hidden");
}

let socket;

function connectWebSocket() {
  const token = localStorage.getItem("token");
  if (!token) return;

  // Replace with your WebSocket endpoint (adjust port/path as needed)
  const socket = new WebSocket(
    `wss://${window.location.host}/ws?token=${token}`
  );

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
      msg = JSON.parse(data.payload);
      const senderId = msg.SenderID;
      const recieverID = msg.ReceiverID;
      const userId = localStorage.getItem("userid");

      showMessagePreviews(senderId, recieverID, msg.Content);
      if (userId !== senderId) {
        showCount(senderId);
      }

      const scrollable = document.getElementById(
        getScrollableId(senderId, recieverID)
      );
      if (!scrollable) return;

      addSingleMessageAppend(msg, senderId, recieverID, scrollable);
    } else if (data.type === "message_deleted") {
      const msg = JSON.parse(data.payload);
      let senderId = msg.SenderID;
      let recieverID = msg.ReceiverID;
      let senderName = msg.Sender.Username;

      await loadConversationWith(senderId, recieverID, msg.SenderUsername);

      const scrollable = document.getElementById(
        getScrollableId(senderId, recieverID)
      );
      if (!scrollable) return;

      userId = localStorage.getItem("userid");
      if (userId === senderId) {
        //If message is deleted by current user, view conversation with receiver
        senderId = recieverID;
        recieverID = userId;
        senderName = msg.Receiver.Username;
      }
      viewConversationWith(
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

async function loadConversationWith(senderId, recieverID, senderName) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages?sender_id=" + senderId, {
    headers: { Authorization: "Bearer " + token },
  });
  const messages = await res.json();
  if (!messages || messages.length === 0) return;

  let userId = localStorage.getItem("userid");

  // Show toast previews for unread messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.Read && !(userId === senderId) && !(m.ReceiverID === senderId)) {
      // If the message is unread and not sent by the current user
      if (!m.Delivered) {
        if (!m.IsDeleted) {
          showMessagePreviews(senderId, m.ReceiverID, m.Content);
          showCount(senderId);
          // Wait for 500 milliseconds (half a second)
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } else {
        showCount(senderId);
      }
    }
  }
  if (!messages[0].IsDeleted) {
    showMessagePreviews(senderId, messages[0].ReceiverID, messages[0].Content);
  } else {
    showMessagePreviews(
      senderId,
      messages[0].ReceiverID,
      "This message was Deleted"
    );
  }

  if (!(senderId === userId)) {
    await fetch("/api/messages/delivered", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        sender_id: senderId,
        receiver_id: recieverID, // Assuming recieverId is the current user's I
      }),
    });
  }
}

function showCount(senderId) {
  const li = document.getElementById(`user-${senderId}`);
  if (!li) return;

  const unreadSpan = li.querySelector(".unread-count");
  const match = unreadSpan.textContent.match(/\d+/);
  const count = match ? parseInt(match[0], 10) : 0;

  const newCount = count + 1;

  unreadSpan.textContent = newCount > 0 ? ` (${newCount} new)` : "";
}

async function viewConversationWith(
  senderId,
  recieverId,
  senderName,
  scrollTopBefore,
  isFromViewButton = false
) {
  const token = localStorage.getItem("token");

  isLoading = true;
  let msgLimit = currentPage * limit;
  if (isFromViewButton) {
    currentPage = 1; // Reset to first page when viewing from button
    msgLimit = limit; // Reset limit to 20 for the first view
  }
  const res = await fetch(
    `/api/messages?sender_id=${senderId}&page=1&limit=${msgLimit}`,
    {
      headers: { Authorization: "Bearer " + token },
    }
  );
  const messages = await res.json();
  if (!messages || messages.length === 0) return;

  const box = document.getElementById("message-area");
  box.innerHTML = "";

  const header = document.createElement("div");
  header.className = "message-header";
  header.id = "message-header";
  header.textContent = `Conversation with ${senderName}`;
  box.appendChild(header);

  const scrollable = document.createElement("div");
  scrollable.className = "message-list";
  scrollable.id = getScrollableId(senderId, recieverId);
  scrollable.dataset.allRead = "true";

  box.appendChild(scrollable);

  const inputContainer = document.createElement("div");
  inputContainer.className = "whatsapp-message-input-container";

  inputContainer.innerHTML = `
  <input
    type="text"
    id="input-${senderId}-${recieverId}"
    placeholder="Type a message"
    class="whatsapp-message-input"
  />
  <button class="whatsapp-send-button" onclick="sendMessage('${senderId}', '${recieverId}')">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
    </svg>
  </button>
`;

  box.appendChild(inputContainer);

  addMessagesInScrollable(
    scrollable,
    messages,
    senderId,
    recieverId,
    senderName,
    scrollTopBefore
  );
  isLoading = false;

  await markAsRead(senderId, recieverId);

  if (scrollable.dataset.allRead === "true") {
    dividerInsertedMap[getScrollableId(senderId, recieverId)] = false;
  }

  const li = document.getElementById(`user-${senderId}`);
  if (!li) return;

  const unreadSpan = li.querySelector(".unread-count");
  unreadSpan.textContent = ""; // Clear unread count
}

const showMessagePreviews = (senderId, recieverID, message) => {
  let previewEl;
  if (recieverID === localStorage.getItem("userid")) {
    previewEl = document.getElementById(`preview-${senderId}`);
  } else {
    previewEl = document.getElementById(`preview-${recieverID}`);
  }
  if (!previewEl) return;

  previewEl.textContent = message;
  previewEl.style.opacity = 1;
};

async function markAsRead(senderId, recieverId) {
  const token = localStorage.getItem("token");
  await fetch("/api/messages/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      sender_id: senderId,
      receiver_id: recieverId, // Assuming recieverId is the current user's I
    }),
  });
}

async function showDeleteOptionsForSelf(
  msgId,
  senderId,
  senderName,
  scrollable
) {
  token = localStorage.getItem("token");
  if (!token) {
    console.error("Token not found in localStorage");
    return;
  }

  const scrollTopBefore = scrollable.scrollTop;

  recieverId = localStorage.getItem("userid");
  if (!recieverId) {
    console.error("Receiver ID not found in localStorage");
    return;
  }
  const choice = confirm("Delete for self?");
  if (choice) {
    await fetch(`/api/messages/delete/self`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({
        message_id: msgId,
        user_id: recieverId, // Assuming recieverId is the current user's I
      }),
    });
  }
}

async function showDeleteOptionsForEveryone(
  msgId,
  senderId,
  senderName,
  scrollable
) {
  token = localStorage.getItem("token");
  if (!token) {
    console.error("Token not found in localStorage");
    return;
  }

  const scrollTopBefore = scrollable.scrollTop;

  recieverId = localStorage.getItem("userid");
  if (!recieverId) {
    console.error("Receiver ID not found in localStorage");
    return;
  }
  const choice = confirm(
    "Delete for everyone?\nPress Cancel to delete for self only."
  );
  if (choice) {
    await fetch(`/api/messages/delete/everyone`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({
        message_id: msgId,
      }),
    });
  } else {
    await fetch(`/api/messages/delete/self`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({
        message_id: msgId,
        user_id: recieverId,
      }),
    });
  }
}

async function loadMoreMessages(senderId, recieverId) {
  if (isLoading) return;
  isLoading = true;
  currentPage++;

  const token = localStorage.getItem("token");
  const res = await fetch(
    `/api/messages?sender_id=${senderId}&page=${currentPage}&limit=${limit}`,
    {
      headers: { Authorization: "Bearer " + token },
    }
  );
  const newMessages = await res.json();
  if (newMessages.length === 0) {
    currentPage--;
    isLoading = false;
    return; // No more messages
  }

  const scrollable = document.getElementById(
    getScrollableId(senderId, recieverId)
  );

  const prevScrollHeight = scrollable.scrollHeight;

  newMessages.forEach((m) => {
    const div = document.createElement("div");
    addSingleMessagePrepend(m, senderId, recieverId, scrollable);
    scrollable.prepend(div); // Add at top
  });

  // Maintain scroll position
  scrollable.scrollTop = scrollable.scrollHeight - prevScrollHeight;

  isLoading = false;
}

function addMessagesInScrollable(
  scrollable,
  messages,
  senderId,
  recieverId,
  senderName,
  scrollTopBefore
) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    addSingleMessageAppend(m, senderId, recieverId, scrollable);
  }

  if (scrollTopBefore === null) {
    scrollTopBefore = scrollable.scrollHeight; // Default to bottom if not provided
  }

  scrollable.scrollTop = scrollTopBefore;
  scrollable.addEventListener("scroll", () => {
    if (scrollable.scrollTop === 0) {
      loadMoreMessages(senderId, recieverId);
    }
  });
}

function addSingleMessageAppend(m, senderId, recieverId, scrollable) {
  userId = localStorage.getItem("userid");
  if (!userId) return;

  if (
    !dividerInsertedMap[getScrollableId(senderId, recieverId)] &&
    !m.Read &&
    !(userId === senderId)
  ) {
    const divider = document.createElement("div");
    divider.id = `divider-${getScrollableId(senderId, recieverId)}`;
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[getScrollableId(senderId, recieverId)] = true;
    scrollable.dataset.allRead = "false";
  }

  if (userId === senderId) {
    const divider = document.getElementById(
      `divider-${getScrollableId(senderId, recieverId)}`
    );
    if (divider) {
      divider.remove(); // Remove divider if sender is the current user
      dividerInsertedMap[getScrollableId(senderId, recieverId)] = false;
    }
  }

  const div = document.createElement("div");
  div.className = m.SenderID === userId ? "message-right" : "message-left";

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(userId)) {
    console.log("Message deleted for self by receiver");
    return;
  }

  timestamp = new Date(m.CreatedAt).toLocaleString();

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️";
  if (m.IsDeleted) {
    div.textContent = `[${timestamp}] ${m.Sender.Username}: "This message was deleted."`;
    div.style.color = "red";
    deleteBtn.onclick = () =>
      showDeleteOptionsForSelf(
        m.ID,
        m.Sender.ID,
        m.Sender.Username,
        scrollable
      );
  } else {
    div.textContent = `[${timestamp}] ${m.Sender.Username}: ${m.Content}`;
    deleteBtn.onclick = () =>
      showDeleteOptionsForEveryone(
        m.ID,
        senderId,
        m.Sender.Username,
        scrollable
      );
  }

  div.appendChild(deleteBtn);
  scrollable.appendChild(div);
}

function addSingleMessagePrepend(m, senderId, recieverId, scrollable) {
  userId = localStorage.getItem("userid");
  if (!userId) return;

  if (
    !dividerInsertedMap[getScrollableId(senderId, recieverId)] &&
    !m.Read &&
    !(userId === senderId)
  ) {
    const divider = document.createElement("div");
    divider.id = `divider-${getScrollableId(senderId, recieverId)}`;
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[getScrollableId(senderId, recieverId)] = true;
  }

  if (userId === senderId) {
    const divider = document.getElementById(
      `divider-${getScrollableId(senderId, recieverId)}`
    );
    if (divider) {
      divider.remove(); // Remove divider if sender is the current user
      dividerInsertedMap[getScrollableId(senderId, recieverId)] = false;
    }
  }

  const div = document.createElement("div");
  div.className = m.SenderID === userId ? "message-right" : "message-left";

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(userId)) {
    console.log("Message deleted for self by receiver");
    return;
  }

  timestamp = new Date(m.CreatedAt).toLocaleString();

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "🗑️";
  if (m.IsDeleted) {
    div.textContent = `[${timestamp}] ${m.Sender.Username}: "This message was deleted."`;
    div.style.color = "red";
    deleteBtn.onclick = () =>
      showDeleteOptionsForSelf(
        m.ID,
        m.Sender.ID,
        m.Sender.Username,
        scrollable
      );
  } else {
    div.textContent = `[${timestamp}] ${m.Sender.Username}: ${m.Content}`;
    deleteBtn.onclick = () =>
      showDeleteOptionsForEveryone(
        m.ID,
        senderId,
        m.Sender.Username,
        scrollable
      );
  }

  div.appendChild(deleteBtn);
  scrollable.prepend(div); // Add at top
}

function getScrollableId(userId1, userId2) {
  const [id1, id2] = [userId1, userId2].sort(); // Sort alphabetically
  return `message-scrollable-${id1}-${id2}`;
}

async function sendMessage(senderId, recieverId) {
  const input = document.getElementById(`input-${senderId}-${recieverId}`);
  const content = input.value.trim();
  if (!content) return;

  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      receiver_id: senderId,
      content: content,
    }),
  });

  if (res.ok) {
    input.value = "";
    // Optionally refresh or append the new message to the scrollable div
  } else {
    alert("Failed to send message.");
  }
}

// async function sendMessage() {
//   const token = localStorage.getItem("token");
//   const res = await fetch("/api/messages", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: "Bearer " + token,
//     },
//     body: JSON.stringify({
//       receiver_id: document.getElementById("users").value,
//       content: document.getElementById("message").value,
//     }),
//   });
//   document.getElementById("message").value = "";
// }
