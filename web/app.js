let token = "";
let userId = "";
const dividerInsertedMap = {};
let currentPage = 1;
const limit = 7;
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

  document.getElementById(
    "current-user"
  ).textContent = `Logged in as: ${data.username}`;

  await loadUsers();
}

async function loadUsers() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/users", {
    headers: { Authorization: "Bearer " + token },
  });
  const users = await res.json();
  const select = document.getElementById("users");
  select.innerHTML = "";
  users.forEach((user) => {
    let opt = document.createElement("option");
    opt.value = user.ID;
    opt.textContent = user.Username;
    select.appendChild(opt);
  });

  recieverID = localStorage.getItem("userid");
  if (!recieverID) {
    console.error("Receiver ID not found in localStorage");
    return;
  }

  // Populate list for viewing messages
  const list = document.getElementById("user-list");
  list.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.id = `user-${user.ID}`;
    li.innerHTML = `
    <span class="username">${user.Username}</span> 
    <span class="unread-count"></span>
    <div class="message-preview" id="preview-${user.ID}"></div>
    <button onclick="viewConversationWith('${user.ID}', '${recieverID}', '${user.Username}', null,true);">View Messages</button>
  `;
    list.appendChild(li);
    loadConversationWith(user.ID, recieverID, user.Username);
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

  loadUsers();
  connectWebSocket();
  document.getElementById(
    "current-user"
  ).textContent = `Logged in as: ${localStorage.getItem("username")}`;
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
  const socket = new WebSocket(`ws://localhost:8080/ws?token=${token}`);

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
    recieverID = localStorage.getItem("userid");

    if (data.type === "unread_update") {
      const senderId = data.from;
      const count = data.count;

      const li = document.getElementById(`user-${senderId}`);
      if (!li) return;

      const unreadSpan = li.querySelector(".unread-count");
      unreadSpan.textContent = count > 0 ? ` (${count} new)` : "";
    } else if (data.type === "message") {
      msg = JSON.parse(data.payload);
      const senderId = msg.SenderID;

      showMessagePreviews(senderId, msg.Content);

      const scrollable = document.getElementById(
        `message-scrollable-${senderId}-${recieverID}`
      );
      if (!scrollable) return;

      addSingleMessageAppend(msg, senderId, recieverID, scrollable);
    }
  };

  socket.onclose = () => {
    console.log("WebSocket closed. Reconnecting...");
    setTimeout(connectWebSocket, 3000); // retry after 3s
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
  };
}

async function sendMessage() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify({
      receiver_id: document.getElementById("users").value,
      content: document.getElementById("message").value,
    }),
  });
  document.getElementById("message").value = "";
}

async function loadConversationWith(senderId, recieverID, senderName) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages?sender_id=" + senderId, {
    headers: { Authorization: "Bearer " + token },
  });
  let unreadCount = 0;
  const messages = await res.json();

  const li = document.getElementById(`user-${senderId}`);
  if (!li) return;
  const unreadSpan = li.querySelector(".unread-count");

  // Show toast previews for unread messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.Read) {
      unreadCount++;
      if (!m.Delivered) {
        showMessagePreviews(senderId, m.Content);
        unreadSpan.textContent = unreadCount > 0 ? ` (${unreadCount} new)` : "";
        // Wait for 500 milliseconds (half a second)
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  showMessagePreviews(senderId, messages[0].Content);
  unreadSpan.textContent = unreadCount > 0 ? ` (${unreadCount} new)` : "";

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

  const box = document.getElementById("messages");
  box.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = `Messages from ${senderName}`;
  box.appendChild(heading);

  const scrollable = document.createElement("div");
  scrollable.className = "message-list";
  scrollable.id = `message-scrollable-${senderId}-${recieverId}`;
  scrollable.dataset.allRead = "true";

  box.appendChild(scrollable);

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

  if (scrollable.dataset.allRead == "true") {
    dividerInsertedMap[senderId][recieverId] = false;
  }

  const li = document.getElementById(`user-${senderId}`);
  if (!li) return;

  const unreadSpan = li.querySelector(".unread-count");
  unreadSpan.textContent = ""; // Clear unread count
}

const showMessagePreviews = (senderId, message) => {
  const previewEl = document.getElementById(`preview-${senderId}`);
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
    viewConversationWith(
      senderId,
      recieverId,
      senderName,
      scrollTopBefore,
      false
    );
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
    viewConversationWith(
      senderId,
      recieverId,
      senderName,
      scrollTopBefore,
      false
    );
  } else {
    await fetch(`/api/messages/delete/self`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify({
        message_id: msgId,
        user_id: recieverId, // Assuming recieverId is the current user's I
      }),
    });
    viewConversationWith(
      senderId,
      recieverId,
      senderName,
      scrollTopBefore,
      false
    );
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
    return; // No more messages
  }

  const scrollable = document.getElementById(
    `message-scrollable-${senderId}-${recieverId}`
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
    if (!m.Read) {
      scrollable.dataset.allRead = "false";
    }
  }

  if (scrollTopBefore == null) {
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
  if (!dividerInsertedMap[senderId]) {
    dividerInsertedMap[senderId] = {};
  }

  if (!dividerInsertedMap[senderId][recieverId] && !m.Read) {
    const divider = document.createElement("div");
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[senderId][recieverId] = true;
  }

  const div = document.createElement("div");

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(recieverId)) {
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
  if (!dividerInsertedMap[senderId]) {
    dividerInsertedMap[senderId] = {};
  }

  if (!dividerInsertedMap[senderId][recieverId] && !m.Read) {
    const divider = document.createElement("div");
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[senderId][recieverId] = true;
  }

  const div = document.createElement("div");

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(recieverId)) {
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
