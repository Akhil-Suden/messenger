let token = "";
let userId = "";

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
    <button onclick="viewConversationWith('${user.ID}', '${recieverID}', '${user.Username}')">View Messages</button>
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

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "unread_update") {
      const userId = data.from;
      const count = data.count;

      const li = document.getElementById(`user-${userId}`);
      if (!li) return;

      const unreadSpan = li.querySelector(".unread-count");
      unreadSpan.textContent = count > 0 ? ` (${count} new)` : "";
    } else if (data.type === "message") {
      showMessagePreviews(data.from, data.content);
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

async function viewConversationWith(senderId, recieverId, senderName) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages?sender_id=" + senderId, {
    headers: { Authorization: "Bearer " + token },
  });
  const messages = await res.json();
  if (!messages || messages.length === 0) return;

  const box = document.getElementById("messages");
  box.innerHTML = "";

  const heading = document.createElement("h3");
  heading.textContent = `Messages from ${senderName}`;
  box.appendChild(heading);

  const scrollable = document.createElement("div");
  scrollable.className = "message-list";
  box.appendChild(scrollable);

  let dividerInserted = false;

  messages.reverse().forEach((m) => {
    if (!dividerInserted && !m.Read) {
      const divider = document.createElement("div");
      divider.style.borderTop = "1px solid #888";
      divider.style.margin = "10px 0";
      divider.style.paddingTop = "5px";
      divider.textContent = "--- Unread Messages ---";
      scrollable.appendChild(divider);
      dividerInserted = true;
    }

    const div = document.createElement("div");
    div.textContent = `[${m.CreatedAt}] ${m.Sender.Username}: ${m.Content}`;
    scrollable.appendChild(div);
  });

  scrollable.scrollTop = scrollable.scrollHeight;

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
