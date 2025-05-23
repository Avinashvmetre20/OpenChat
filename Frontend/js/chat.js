const socket = io(); 
// Initialize Socket.IO client to connect with the server

// DOM elements
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

// App state
let currentUser = ""; // Logged-in user's name
let selectedUser = "public"; // Currently selected chat target
const chatHistory = {}; // Stores chat history per user
const unreadMessages = {}; // Stores count of unread messages
let typingTimeout; // Timeout to clear typing indicator

// Enable or disable the input form
function setChatEnabled(enabled) {
    input.disabled = !enabled;
    form.querySelector("button").disabled = !enabled;
}
setChatEnabled(false);

// Run on page load
window.addEventListener("DOMContentLoaded", async () => {
    // Ask for notification permission
    if (Notification.permission !== "granted") {
        await Notification.requestPermission();
    }

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please login first.");
        window.location.href = "/auth.html";
        return;
    }

    // Fetch current user info using token
    try {
        const res = await fetch("/api/message/my", {
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
            socket.emit("set username", currentUser); // Inform server about the user
            document.getElementById("currentUser").textContent = `${currentUser}`;
            fetchAllUsers(token); // Load other users
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

// Fetch all users for the user list sidebar
async function fetchAllUsers(token) {
    try {
        const res = await fetch("/api/auth/users", {
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

// Render all users in the sidebar
function renderUserList(users) {
    userList.innerHTML = "";

    users.filter(u => u !== currentUser).forEach(user => {
        const userDiv = document.createElement("div");
        userDiv.className = "user";
        userDiv.setAttribute("data-user", user);
        userDiv.innerHTML = `
            <span class="status-dot" style="width:8px;height:8px;border-radius:50%;margin-right:5px;background-color:red;display:inline-block;"></span>
            ${user}
            <span class="typing-status" style="font-size: 0.8em; color: green; margin-left: 5px;"></span>
            <span class="badge" style="display:none;"></span>
        `;

        // On user click, switch chat
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

// Update online/offline dot status for each user
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

// Switch to public chat
publicTab.addEventListener("click", () => {
    selectedUser = "public";
    chatWith.textContent = "Public Chat";
    loadMessages("public");
    setActiveUser("public");
    hideBadge("public");
    typingIndicator.textContent = "";
});

// Highlight selected chat user
function setActiveUser(user) {
    document.querySelectorAll(".user").forEach(el => el.classList.remove("active"));
    if (user === "public") {
        publicTab.classList.add("active");
    } else {
        const userEl = document.querySelector(`[data-user="${user}"]`);
        if (userEl) userEl.classList.add("active");
    }
}

// Load chat history into the message area
function loadMessages(user) {
    messages.innerHTML = "";
    (chatHistory[user] || []).forEach(({ text, type, from }) => {
        addMessage(text, type, from);
    });
}

// Add message to UI
function addMessage(text, type, from) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${type}`;
    messageElement.innerHTML = from === currentUser ? text : `<strong>${from}:</strong> ${text}`;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

// Show unread badge count for user
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

// Hide unread badge count
function hideBadge(user) {
    unreadMessages[user] = 0;
    const el = document.querySelector(`[data-user="${user}"]`);
    if (el) {
        const badge = el.querySelector(".badge");
        if (badge) badge.style.display = "none";
    }
}

// Handle sending message
form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser || !selectedUser) return;

    const msg = input.value.trim();
    if (msg) {
        const payload = { to: selectedUser, text: msg };
        socket.emit("chat message", payload);
        input.value = "";
        typingIndicator.textContent = "";
    }
});

// Emit typing event when user types
input.addEventListener("input", () => {
    if (!currentUser) return;
    socket.emit("typing", { to: selectedUser });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("stop typing", { to: selectedUser });
    }, 1000);
});

// Handle receiving public message
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

// Handle receiving private message
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

// Confirmation message back to sender after sending private message
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

// Show "typing..." indicator
socket.on("typing", ({ from, to }) => {
    if (from !== currentUser) {
        const userEl = document.querySelector(`[data-user="${from}"]`);
        if (userEl) {
            const typingEl = userEl.querySelector(".typing-status");
            if (typingEl) {
                typingEl.textContent = "typing...";
                clearTimeout(typingEl._typingTimeout);
                typingEl._typingTimeout = setTimeout(() => {
                    typingEl.textContent = "";
                }, 2000);
            }
        }
    }
});

// Clear "typing..." indicator
socket.on("stop typing", ({ from, to }) => {
    if (from !== currentUser) {
        const userEl = document.querySelector(`[data-user="${from}"]`);
        if (userEl) {
            const typingEl = userEl.querySelector(".typing-status");
            if (typingEl) {
                clearTimeout(typingEl._typingTimeout);
                typingEl.textContent = "";
            }
        }
    }
});

// When client reconnects to server
socket.on("connect", () => {
    if (currentUser) socket.emit("set username", currentUser);
});

// Sidebar toggle functionality
toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

// Sidebar toggle (alternate method)
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}

// Logout handler
function logout() {
    localStorage.removeItem("token");
    window.location.href = "/auth.html";
}

// User dropdown toggle
function toggleDropdown() {
    const dropdown = document.getElementById("dropdownMenu");
    dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

// Close dropdown if click is outside
window.addEventListener('click', function (e) {
    const dropdown = document.getElementById("dropdownMenu");
    const userDropdown = document.querySelector(".user-dropdown");
    if (!userDropdown.contains(e.target)) {
        dropdown.style.display = "none";
    }
});
