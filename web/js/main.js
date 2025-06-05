export let token = "";

import * as messages from "./messages.js";
import * as socket from "./socket.js";
import * as auth from "./auth.js";

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

  messages.loadUsers();
  socket.connectWebSocket();
  document.getElementById(
    "username-display"
  ).textContent = `${localStorage.getItem("username")}`;
  document.getElementById("logout-btn").addEventListener("click", auth.logout);
};
