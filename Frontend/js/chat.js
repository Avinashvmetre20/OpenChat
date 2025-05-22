const socket = io();

const userList = document.getElementById("userList");
const messages = document.getElementById("messages");
const form = document.getElementById("form");
const input = document.getElementById("input");
const chatWith = document.getElementById("chatWith");
const currentUserDisplay = document.getElementById("currentUser");
const publicTab = document.getElementById("publicChat");
const typingIndicator = document.getElementById("typingIndicator");
const toggleBtn = document.querySelector(".toggle-sidebar-btn");
const sidebar = document.querySelector(".sidebar");

let currentUser = "";
let selectedUser = "public";
const chatHistory = {};
const unreadMessages = {};
let typingTimeout;

function setChatEnabled(enabled) {
    input.disabled = !enabled;
    form.querySelector("button").disabled = !enabled;
}
setChatEnabled(false);

window.addEventListener("DOMContentLoaded", async () => {
    if (Notification.permission !== "granted") {
        await Notification.requestPermission();
    }

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first.");
        window.location.href = "/auth.html";
        return;
    }

    try {
        const res = await fetch("https://openchat-zvc4.onrender.com/api/message/my", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (data?.user?.name) {
            currentUser = data.user.name;
            currentUserDisplay.innerHTML = `<strong>You:</strong> ${currentUser}`;
            setChatEnabled(true);
            input.focus();
            if (currentUser) {
                socket.emit("set username", currentUser);
                document.getElementById("currentUser").textContent = `${currentUser}`;
            }
            fetchAllUsers(token);
        } else {
            throw new Error("Invalid user data");
        }
    } catch (err) {
        console.error("Auth error:", err);
        alert("Session expired. Please login again.");
        localStorage.removeItem("token");
        window.location.href = "/auth.html";
    }
});

async function fetchAllUsers(token) {
    try {
        const res = await fetch("https://openchat-zvc4.onrender.com/api/auth/users", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        const users = await res.json();
        if (Array.isArray(users)) renderUserList(users);
        else console.error("Unexpected response:", users);
    } catch (err) {
        console.error("Failed to fetch users:", err);
    }
}

function renderUserList(users) {
    userList.innerHTML = "";

    users.filter(u => u !== currentUser).forEach(user => {
        const userDiv = document.createElement("div");
        userDiv.className = "user";
        userDiv.setAttribute("data-user", user);
        userDiv.innerHTML = `
            <span class="status-dot" style="width:8px;height:8px;border-radius:50%;margin-right:5px;background-color:red;display:inline-block;"></span>
            ${user}
            <span class="badge" style="display:none;"></span>
        `;

        userDiv.addEventListener("click", () => {
            selectedUser = user;
            chatWith.textContent = user;
            loadMessages(user);
            setActiveUser(user);
            hideBadge(user);
            typingIndicator.textContent = "";
            input.focus();
        });

        userList.appendChild(userDiv);
    });
}

function updateOnlineStatus(onlineUsers) {
    document.querySelectorAll(".user").forEach(el => {
        const user = el.getAttribute("data-user");
        const dot = el.querySelector(".status-dot");
        if (dot) {
            dot.style.backgroundColor = onlineUsers.includes(user) ? "green" : "red";
        }
    });
}

socket.on("online users", updateOnlineStatus);

publicTab.addEventListener("click", () => {
    selectedUser = "public";
    chatWith.textContent = "Public Chat";
    loadMessages("public");
    setActiveUser("public");
    hideBadge("public");
    typingIndicator.textContent = "";
});

function setActiveUser(user) {
    document.querySelectorAll(".user").forEach(el => el.classList.remove("active"));
    if (user === "public") {
        publicTab.classList.add("active");
    } else {
        const userEl = document.querySelector(`[data-user="${user}"]`);
        if (userEl) userEl.classList.add("active");
    }
}

function loadMessages(user) {
    messages.innerHTML = "";
    (chatHistory[user] || []).forEach(({ text, type, from }) => {
        addMessage(text, type, from);
    });
}

function addMessage(text, type, from) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;

    if (from === currentUser) {
        // If message is from yourself, show only the text
        messageElement.textContent = text;
    } else {
        // If message is from others, show username and text
        messageElement.innerHTML = `<strong>${from}:</strong> ${text}`;
    }

    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}


function showBadge(user) {
    const el = document.querySelector(`[data-user="${user}"]`);
    if (el) {
        const badge = el.querySelector(".badge");
        unreadMessages[user] = (unreadMessages[user] || 0) + 1;
        if (badge) {
            badge.textContent = unreadMessages[user];
            badge.style.display = "flex";
        }
    }
}

function hideBadge(user) {
    unreadMessages[user] = 0;
    const el = document.querySelector(`[data-user="${user}"]`);
    if (el) {
        const badge = el.querySelector(".badge");
        if (badge) badge.style.display = "none";
    }
}

form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser || !selectedUser) return;

    const msg = input.value.trim();
    if (msg) {
        const payload = { to: selectedUser, text: msg };
        socket.emit("chat message", payload);
        // chatHistory[selectedUser] = chatHistory[selectedUser] || [];
        // chatHistory[selectedUser].push({ text: msg, type: "sent" });
        input.value = "";
        typingIndicator.textContent = "";
    }
});

input.addEventListener("input", () => {
    if (!currentUser) return;
    socket.emit("typing", { to: selectedUser });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stop typing", { to: selectedUser });
    }, 1000);
});

// Receive incoming chat message (public or private)
socket.on("chat message", ({ from, to, text }) => {
  const isFromMe = from === currentUser;
  const chatKey = "public";

  chatHistory[chatKey] = chatHistory[chatKey] || [];
  chatHistory[chatKey].push({ text, from, to, type: isFromMe ? "sent" : "received" });

  const isCurrentChat = selectedUser === "public";
  if (isCurrentChat) {
    addMessage(text, isFromMe ? "sent" : "received", from);
  } else {
    showBadge(chatKey);
  }
});

// Confirmation message back to sender (private)
socket.on("private message", ({ from, to, text }) => {
  const chatKey = from;
  const isCurrentChat = selectedUser === from;

  chatHistory[chatKey] = chatHistory[chatKey] || [];
  chatHistory[chatKey].push({ text, from, to, type: "received" });

  if (isCurrentChat) {
    addMessage(text, "received", from);
  } else {
    showBadge(chatKey);
  }
});

socket.on("private message sent", ({ from, to, text }) => {
  const chatKey = to;
  const isCurrentChat = selectedUser === to;

  chatHistory[chatKey] = chatHistory[chatKey] || [];
  chatHistory[chatKey].push({ text, from, to, type: "sent" });

  if (isCurrentChat) {
    addMessage(text, "sent", from);
  } else {
    showBadge(chatKey);
  }
});

// Show typing indicator
socket.on("typing", ({ from, to }) => {
    if (selectedUser === from || (to === "public" && selectedUser === "public")) {
        typingIndicator.textContent = `${from} is typing...`;
    }
});

// Hide typing indicator
socket.on("stop typing", ({ from, to }) => {
    if (selectedUser === from || (to === "public" && selectedUser === "public")) {
        typingIndicator.textContent = "";
    }
});

socket.on("connect", () => {
    if (currentUser) socket.emit("set username", currentUser);
});

// // Sidebar toggle
// toggleBtn.addEventListener("click", () => {
//     sidebar.classList.toggle("active");
// });

function toggleSidebar() {
      const sidebar = document.getElementById("sidebar");
      sidebar.classList.toggle("active"); // use 'active' for consistency
    }

// Sidebar toggle
sidebar.addEventListener("click", () => {
    selectedUser = user;
    chatWith.textContent = user;
    loadMessages(user);
    setActiveUser(user);
    hideBadge(user);
    typingIndicator.textContent = "";
    input.focus();

    // 👇 Hide the sidebar after selecting a user
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.remove("active");

    // 👇 Optionally change the toggle button icon state
    toggleBtn.classList.remove("open");
});



// Logout
function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
}

function toggleDropdown() {
    const dropdown = document.getElementById("dropdownMenu");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
  }

  // Optional: Hide dropdown if clicked outside
  window.addEventListener('click', function (e) {
    const dropdown = document.getElementById("dropdownMenu");
    const userDropdown = document.querySelector(".user-dropdown");
    if (!userDropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });