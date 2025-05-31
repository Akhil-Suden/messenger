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

  // Populate list for viewing messages
  const list = document.getElementById("user-list");
  list.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${user.Username} 
      <button onclick="loadConversationWith('${user.ID}', '${user.Username}')">View Messages</button>
    `;
    list.appendChild(li);
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
    const msg = JSON.parse(event.data);
    displayIncomingMessage(msg);
  };

  socket.onclose = () => {
    console.log("WebSocket closed. Reconnecting...");
    setTimeout(connectWebSocket, 3000); // retry after 3s
  };

  socket.onerror = (err) => {
    console.error("WebSocket error", err);
  };
}

function displayIncomingMessage(msg) {
  const box = document.getElementById("messages");
  const div = document.createElement("div");
  div.textContent = `[New] ${msg.from}: ${msg.content}`;
  box.appendChild(div);
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

async function loadConversationWith(senderId, senderName) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages?sender_id=" + senderId, {
    headers: { Authorization: "Bearer " + token },
  });
  const msgs = await res.json();
  const box = document.getElementById("messages");
  box.innerHTML = `<h3>Messages from ${senderName}</h3>`;
  msgs.forEach((m) => {
    const div = document.createElement("div");
    div.textContent = `[${m.CreatedAt}] ${m.Sender.Username}: ${m.Content}`;
    box.appendChild(div);
  });
}
