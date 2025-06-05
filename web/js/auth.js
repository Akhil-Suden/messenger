import * as socket from "./socket.js";
import * as messages from "./messages.js";

export async function register() {
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

export async function login() {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: document.getElementById("login-username").value,
      password: document.getElementById("login-password").value,
    }),
  });
  const data = await res.json();
  let token = data.token;
  localStorage.setItem("token", token);
  localStorage.setItem("username", data.username);
  localStorage.setItem("userid", data.userid);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.add("hidden");
  document.getElementById("main").classList.remove("hidden");
  document.getElementById("current-user").classList.remove("hidden");
  document.getElementById("username-display").textContent = `${data.username}`;
  document.getElementById("logout-btn").addEventListener("click", logout);
  socket.connectWebSocket();
  await messages.loadUsers();
}
window.login = login;

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  document.getElementById("main").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
  document.getElementById("register").classList.remove("hidden");
}
