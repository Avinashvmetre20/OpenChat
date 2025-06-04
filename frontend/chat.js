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
        window.location.href = "/index.html";
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
        window.location.href = "/index.html";
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

            // Emit message read to sender
            const lastMessages = chatHistory[user] || [];
            const last = lastMessages.length > 0 ? lastMessages[lastMessages.length - 1] : null;
            if (last && last.timestamp) {
                socket.emit("message read", {
                    from: user, // sender of the messages
                    timestamp: last.timestamp
                });
            }
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
    (chatHistory[user] || []).forEach(({ text, type, from, timestamp }) => {
        addMessage(text, type, from, timestamp);
    });
}

// Add message to UI
function addMessage(text, type, from, timestamp, status = "sent") {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${type}`;

    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Status: sent / delivered / read
    let tickText = "✓";
    let tickColor = "gray";

    if (status === "delivered") tickText = "✓✓";
    else if (status === "read") {
        tickText = "✓✓";
        tickColor = "#4fc3f7"; // WhatsApp blue
    }

    msgDiv.innerHTML = `
        <p>${text}</p>
        <div class="meta">
            <span class="timestamp">${time}</span>
            ${type === "sent" ? `<span class="ticks" data-ts="${timestamp}" style="color:${tickColor}">${tickText}</span>` : ""}
        </div>
    `;

    messages.appendChild(msgDiv);
    messages.scrollTop = messages.scrollHeight;
}


function sendMessage() {
    const text = messageInput.value.trim();
    if (text === "") return;

    const timestamp = Date.now();

    socket.emit("private message", {
        from: currentUser,
        to: selectedUser,
        text,
        timestamp,
    });

    // Add with single tick by default
    addMessage(text, "sent", currentUser, timestamp, "sent");

    // Ask if recipient is online
    socket.emit("check online", { user: selectedUser, timestamp });
    
    messageInput.value = "";
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
        // const payload = { to: selectedUser, text: msg };
        const timestamp = new Date().toISOString(); // ISO format timestamp
        const payload = { to: selectedUser, text: msg, timestamp };
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
socket.on("chat message", ({ from, to, text, timestamp }) => {
    const isFromMe = from === currentUser;
    const chatKey = "public";

    chatHistory[chatKey] = chatHistory[chatKey] || [];
    chatHistory[chatKey].push({ text, from, to, timestamp, type: isFromMe ? "sent" : "received" });

    const isCurrentChat = selectedUser === "public";
    if (isCurrentChat) {
        addMessage(text, isFromMe ? "sent" : "received", from, timestamp);
    } else {
        showBadge(chatKey);
    }
});

// Handle receiving private message
socket.on("private message", ({ from, to, text, timestamp }) => {
    const type = from === currentUser ? "sent" : "received";

    if (!chatHistory[from]) chatHistory[from] = [];
    chatHistory[from].push({ text, type, from, timestamp });

    // Display message
    if (selectedUser === from || selectedUser === to) {
        addMessage(text, type, from, timestamp);
    }
    else{
        showBadge(from);
        // Optional: show browser notification
        if (Notification.permission === "granted") {
            new Notification(`New message from ${from}`, { body: text });
        }
    }

    // If user is active in this chat, send read receipt
    if (type === "received" && selectedUser === from) {
        socket.emit("message read", { from, timestamp });
    }
});

// Confirmation message back to sender after sending private message
socket.on("private message sent", ({ from, to, text, timestamp }) => {
    const chatKey = to;
    const isCurrentChat = selectedUser === to;

    chatHistory[chatKey] = chatHistory[chatKey] || [];
    chatHistory[chatKey].push({ text, from, to, timestamp, type: "sent" });

    if (isCurrentChat) {
        addMessage(text, "sent", from,timestamp);
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

socket.on("user online tick", ({ to, timestamp }) => {
    const ticks = document.querySelectorAll(".message.sent .ticks");

    ticks.forEach(tick => {
        const ts = tick.getAttribute("data-ts");
        if (ts == timestamp) {
            tick.textContent = "✓✓";
            tick.style.color = "gray"; // still not read
        }
    });
});

//message read indicator
socket.on("message read", ({ from, to, timestamp }) => {
    const ticks = document.querySelectorAll(".message.sent .ticks");

    ticks.forEach(tick => {
        const ts = tick.getAttribute("data-ts");
        if (ts <= timestamp) {
            tick.textContent = "✓✓";
            tick.style.color = "#4fc3f7"; // blue
        }
    });
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
    window.location.href = "/index.html";
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