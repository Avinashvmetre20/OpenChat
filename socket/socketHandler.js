const connectedUsers = new Map();
const onlineUsers = new Set();

module.exports = (io) => {
  io.on("connection", (socket) => {
    // Register user
    socket.on("set username", (username) => {
      connectedUsers.set(username, socket.id);
      socket.username = username;
      onlineUsers.add(username);

      io.emit("online users", Array.from(onlineUsers));
      io.emit("user list", [...connectedUsers.keys()]);
    });

    // Chat message handler
socket.on("chat message", ({ to, text }) => {
  const from = socket.username;
  if (!from) {
    console.warn("Message ignored: username not set.");
    return;
  }

  console.log(`Message from ${from} to ${to}: ${text}`);

  if (to === "public") {
    io.emit("chat message", {
      from,
      to: "public",
      text,
    });
  } else {
    const targetSocketId = connectedUsers.get(to);

    if (targetSocketId) {
      io.to(targetSocketId).emit("private message", {
        from,
        to,
        text,
      });

      socket.emit("private message sent", {
        from,
        to,
        text,
      });
    } else {
      socket.emit("chat error", { message: `User ${to} not found.` });
    }
  }
});

    // Typing indicators
    socket.on("typing", ({ to }) => {
      const from = socket.username;
      if (!from) return;

      if (to === "public") {
        socket.broadcast.emit("typing", { from, to: "public" });
      } else {
        const targetSocketId = connectedUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit("typing", { from, to });
        }
      }
    });

    socket.on("stop typing", ({ to }) => {
      const from = socket.username;
      if (!from) return;

      if (to === "public") {
        socket.broadcast.emit("stop typing", { from, to: "public" });
      } else {
        const targetSocketId = connectedUsers.get(to);
        if (targetSocketId) {
          io.to(targetSocketId).emit("stop typing", { from, to });
        }
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const username = socket.username;
      if (username) {
        connectedUsers.delete(username);
        onlineUsers.delete(username);
        io.emit("online users", Array.from(onlineUsers));
        io.emit("user disconnected", username);
      }
    });
  });
};
