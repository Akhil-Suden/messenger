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
  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.add("hidden");
  document.getElementById("main").classList.remove("hidden");
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
  loadMessages();
}

async function loadMessages() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages", {
    headers: { Authorization: "Bearer " + token },
  });
  const msgs = await res.json();
  const box = document.getElementById("messages");
  box.innerHTML = "";
  msgs.forEach((m) => {
    const div = document.createElement("div");
    div.textContent = `[${m.CreatedAt}] ${m.Sender.Username}: ${m.Content}`;
    box.appendChild(div);
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
  loadMessages();
};

function logout() {
  localStorage.removeItem("token");
  document.getElementById("main").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("register").classList.remove("hidden");
}
