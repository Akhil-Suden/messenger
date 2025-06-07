export let dividerInsertedMap = {};
export let currentScrollableId = "";
export let currentPage = 1;
export const limit = 1000;
export let isLoading = false;
export let userId = "";
export let latestMessageMap = new Map();
export let users = [];

export async function loadUsers() {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/users", {
    headers: { Authorization: "Bearer " + token },
  });
  users = await res.json();

  //Logged in user ID
  let userID = localStorage.getItem("userid");
  if (!userID) {
    console.error("Receiver ID not found in localStorage");
    return;
  }

  users.sort((a, b) => {
    const dateA = latestMessageMap.get(a.ID) || new Date(0);
    const dateB = latestMessageMap.get(b.ID) || new Date(0);
    return dateB - dateA;
  });
  renderChatList();
  const userCopy = JSON.parse(JSON.stringify(users)); // Create a copy of the users array
  userCopy.forEach((chatUser) => {
    loadConversationWith(chatUser.ID, userID, chatUser.Username);
  });
}

export async function loadConversationWith(
  chatUser,
  loggedInUserId,
  chatUserName
) {
  const token = localStorage.getItem("token");
  const res = await fetch("/api/messages?sender_id=" + chatUser, {
    headers: { Authorization: "Bearer " + token },
  });
  const messages = await res.json();
  if (!messages || messages.length === 0) return;

  const latestMessage = messages[0];
  latestMessageMap.set(chatUser, new Date(latestMessage.CreatedAt));

  let userId = localStorage.getItem("userid");

  let lastRenderTime = 0;

  // Show toast previews for unread messages
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.Read && !(userId === chatUser) && !(m.ReceiverID === chatUser)) {
      // If the message is unread and not sent by the current user
      if (!m.Delivered) {
        if (!m.IsDeleted) {
          const now = Date.now();
          if (now - lastRenderTime > 2000) {
            // render every 2 seconds
            users.sort((a, b) => {
              const dateA = latestMessageMap.get(a.ID) || new Date(0);
              const dateB = latestMessageMap.get(b.ID) || new Date(0);
              return dateB - dateA;
            });
            renderChatList();
            lastRenderTime = now;
          }

          showMessagePreviews(chatUser, m.ReceiverID, m.Content);
          showCount(chatUser);

          // Wait for 200 milliseconds
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } else {
        showCount(chatUser);
      }
    }
  }

  users.sort((a, b) => {
    const dateA = latestMessageMap.get(a.ID) || new Date(0);
    const dateB = latestMessageMap.get(b.ID) || new Date(0);
    return dateB - dateA;
  });
  renderChatList();

  if (!messages[0].IsDeleted) {
    showMessagePreviews(chatUser, messages[0].ReceiverID, messages[0].Content);
  } else {
    showMessagePreviews(
      chatUser,
      messages[0].ReceiverID,
      "This message was Deleted"
    );
  }

  if (!(chatUser === userId)) {
    await fetch("/api/messages/delivered", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({
        sender_id: chatUser,
        receiver_id: loggedInUserId, // Assuming recieverId is the current user's I
      }),
    });
  }
}

export function showCount(senderId) {
  const li = document.getElementById(`user-${senderId}`);
  if (!li) return;

  // Corrected selector for unread count div
  const unreadSpan = li.querySelector(".chat-unread-count");
  if (!unreadSpan) return;

  const match = unreadSpan.textContent.match(/\d+/);
  const count = match ? parseInt(match[0], 10) : 0;

  const newCount = count + 1;
  unreadSpan.textContent = newCount > 0 ? `${newCount}` : "";
  if (newCount > 0) {
    unreadSpan.style.display = ""; // Show the count
  }
}

export async function viewConversationWith(
  chatUserId,
  loggedInUserId,
  senderName,
  scrollTopBefore,
  isFromViewButton = false
) {
  currentScrollableId = getScrollableId(chatUserId, loggedInUserId);
  const token = localStorage.getItem("token");

  isLoading = true;
  let msgLimit = currentPage * limit;
  if (isFromViewButton) {
    currentPage = 1; // Reset to first page when viewing from button
    msgLimit = limit; // Reset limit to 20 for the first view
  }
  const res = await fetch(
    `/api/messages?sender_id=${chatUserId}&page=1&limit=${msgLimit}`,
    {
      headers: { Authorization: "Bearer " + token },
    }
  );
  const messages = await res.json();

  const box = document.getElementById("message-area");
  box.innerHTML = "";

  const header = document.createElement("div");
  header.className = "message-header";
  header.id = "message-header";
  header.textContent = `Conversation with ${senderName}`;
  box.appendChild(header);

  const scrollable = document.createElement("div");
  scrollable.className = "message-list";
  scrollable.id = getScrollableId(chatUserId, loggedInUserId);
  scrollable.dataset.allRead = "true";

  box.appendChild(scrollable);

  const inputContainer = document.createElement("div");
  inputContainer.className = "whatsapp-message-input-container";

  inputContainer.innerHTML = `
  <input
    type="text"
    id="input-${chatUserId}-${loggedInUserId}"
    placeholder="Type a message"
    class="whatsapp-message-input"
  />
  <button class="whatsapp-send-button" onclick="sendMessage('${chatUserId}', '${loggedInUserId}')">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M2 21l21-9L2 3v7l15 2-15 2z"/>
    </svg>
  </button>
`;

  box.appendChild(inputContainer);

  addMessagesInScrollable(
    scrollable,
    messages,
    chatUserId,
    loggedInUserId,
    senderName,
    scrollTopBefore
  );
  isLoading = false;
}

window.viewConversationWith = viewConversationWith;

export const showMessagePreviews = (chatUserId, recieverID, message) => {
  let previewEl;
  if (recieverID === localStorage.getItem("userid")) {
    previewEl = document.getElementById(`preview-${chatUserId}`);
  } else {
    previewEl = document.getElementById(`preview-${recieverID}`);
  }
  if (!previewEl) return;

  previewEl.textContent = message;
  previewEl.style.opacity = 1;
};

export function renderChatList() {
  userId = localStorage.getItem("userid");
  const list = document.getElementById("chat-list");
  users.forEach((chatUser) => {
    let previewValue = "";
    let unreadValue = "";
    if (!document.getElementById(`preview-${chatUser.ID}`)) {
      previewValue = "";
    } else {
      previewValue = document.getElementById(
        `preview-${chatUser.ID}`
      ).textContent;
    }
    if (!document.getElementById(`unread-${chatUser.ID}`)) {
      unreadValue = "";
    } else {
      unreadValue = document.getElementById(
        `unread-${chatUser.ID}`
      ).textContent;
    }
    if (document.getElementById(`user-${chatUser.ID}`)) {
      document.getElementById(`user-${chatUser.ID}`).remove(); // Remove existing element if it exists
    }
    const shouldHide = unreadValue === "" ? 'style="display: none;"' : "";
    const li = document.createElement("li");
    li.id = `user-${chatUser.ID}`;
    li.classList.add("chat-item");
    li.innerHTML = `
      <div class="chat-info">
        <div class="chat-username">${chatUser.Username}</div>
        <div class="message-preview" id="preview-${chatUser.ID}">${previewValue}</div>
      </div>
      <div class="chat-unread-count" id="unread-${chatUser.ID}" ${shouldHide}>${unreadValue}</div>
    `;
    li.addEventListener("click", () => {
      viewConversationWith(chatUser.ID, userId, chatUser.Username, null, true);
    });
    list.appendChild(li);
  });
}

export async function markAsRead(senderId, recieverId) {
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

export async function showDeleteOptionsForSelf(
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

export async function showDeleteOptionsForEveryone(
  msgId,
  senderId,
  senderName,
  scrollable
) {
  let token = localStorage.getItem("token");
  if (!token) {
    console.error("Token not found in localStorage");
    return;
  }

  const scrollTopBefore = scrollable.scrollTop;

  let recieverId = localStorage.getItem("userid");
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

export async function loadMoreMessages(chatUserId, loggedInUserId) {
  if (isLoading) return;
  isLoading = true;
  currentPage++;

  const token = localStorage.getItem("token");
  const res = await fetch(
    `/api/messages?sender_id=${chatUserId}&page=${currentPage}&limit=${limit}`,
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
    getScrollableId(chatUserId, loggedInUserId)
  );

  const prevScrollHeight = scrollable.scrollHeight;

  newMessages.forEach((m) => {
    const div = document.createElement("div");
    addSingleMessagePrepend(m, chatUserId, loggedInUserId, scrollable);
    scrollable.prepend(div); // Add at top
  });

  // Maintain scroll position
  scrollable.scrollTop = scrollable.scrollHeight - prevScrollHeight;

  isLoading = false;
}

export async function addMessagesInScrollable(
  scrollable,
  messages,
  chatUserId,
  loggedInUserId,
  senderName,
  scrollTopBefore
) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    addSingleMessageAppend(m, chatUserId, loggedInUserId, scrollable);
  }

  await markAsRead(chatUserId, loggedInUserId);

  if (scrollTopBefore === null) {
    scrollTopBefore = scrollable.scrollHeight; // Default to bottom if not provided
  }

  scrollable.scrollTop = scrollTopBefore;
  scrollable.addEventListener("scroll", () => {
    if (scrollable.scrollTop === 0) {
      loadMoreMessages(chatUserId, loggedInUserId);
    }
  });
}

export async function addSingleMessageAppend(
  m,
  chatUserId,
  loggedInUserId,
  scrollable
) {
  userId = localStorage.getItem("userid");
  if (!userId) return;

  if (
    !dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] &&
    !m.Read &&
    !(userId === m.Sender.ID)
  ) {
    const divider = document.createElement("div");
    divider.id = `divider-${getScrollableId(chatUserId, loggedInUserId)}`;
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] = true;
    scrollable.dataset.allRead = "false";
  }

  const div = document.createElement("div");
  div.className = m.SenderID === userId ? "message-right" : "message-left";

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(userId)) {
    console.log("Message deleted for self by receiver");
    return;
  }

  let timestamp = new Date(m.CreatedAt).toLocaleString();

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
        chatUserId,
        m.Sender.Username,
        scrollable
      );
  }

  div.appendChild(deleteBtn);
  scrollable.appendChild(div);

  if (scrollable.dataset.allRead === "true") {
    //if there is no divider inserted
    dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] = false;
  }

  const li = document.getElementById(`user-${chatUserId}`);
  if (!li) return;

  const unreadSpan = li.querySelector(".chat-unread-count");
  if (!unreadSpan) return;
  unreadSpan.remove(); // Remove the element from the DOM
}

export function addSingleMessagePrepend(
  m,
  chatUserId,
  loggedInUserId,
  scrollable
) {
  userId = localStorage.getItem("userid");
  if (!userId) return;

  if (
    !dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] &&
    !m.Read &&
    !(userId === chatUserId)
  ) {
    const divider = document.createElement("div");
    divider.id = `divider-${getScrollableId(chatUserId, loggedInUserId)}`;
    divider.style.borderTop = "1px solid #888";
    divider.style.margin = "10px 0";
    divider.style.paddingTop = "5px";
    divider.textContent = "--- Unread Messages ---";
    scrollable.appendChild(divider);
    dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] = true;
  }

  if (userId === chatUserId) {
    const divider = document.getElementById(
      `divider-${getScrollableId(chatUserId, loggedInUserId)}`
    );
    if (divider) {
      divider.remove(); // Remove divider if sender is the current user
      dividerInsertedMap[getScrollableId(chatUserId, loggedInUserId)] = false;
    }
  }

  const div = document.createElement("div");
  div.className = m.SenderID === userId ? "message-right" : "message-left";

  if (m.DeletedForSelfBy && m.DeletedForSelfBy.includes(userId)) {
    console.log("Message deleted for self by receiver");
    return;
  }

  let timestamp = new Date(m.CreatedAt).toLocaleString();

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
        chatUserId,
        m.Sender.Username,
        scrollable
      );
  }

  div.appendChild(deleteBtn);
  scrollable.prepend(div); // Add at top
}

export function getScrollableId(userId1, userId2) {
  const [id1, id2] = [userId1, userId2].sort(); // Sort alphabetically
  return `message-scrollable-${id1}-${id2}`;
}

export async function sendMessage(senderId, recieverId) {
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

window.sendMessage = sendMessage;

export function resetDividerInsertedMap() {
  dividerInsertedMap = {};
}

export function resetCurrentScrollableId() {
  currentScrollableId = "";
}
