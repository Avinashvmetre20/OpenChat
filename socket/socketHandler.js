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
      const timestamp = new Date().toISOString();
      // console.log(`Message from ${from} to ${to}: ${text}`);

      if (to === "public") {
        io.emit("chat message", {
          from,
          to: "public",
          text,
          timestamp,
          read: false,
        });
      } else {
        const targetSocketId = connectedUsers.get(to);

        if (targetSocketId) {
          io.to(targetSocketId).emit("private message", {
            from,
            to,
            text,
            timestamp,
            read: false,
          });

          socket.emit("private message sent", {
            from,
            to,
            text,
            timestamp,
            read: false,
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

    // ✅ Read Receipt Handler
      socket.on("message read", ({ from, timestamp }) => {
      const to = socket.username;
      const senderSocketId = connectedUsers.get(from);

      if (senderSocketId) {
        io.to(senderSocketId).emit("message read", {
          from: to, // who read it
          to: from, // original sender
          timestamp,
        });
      }
    });

    socket.on("check online", ({ user, timestamp }) => {
      const to = socket.username; // sender

      const isOnline = connectedUsers.has(user);
      if (isOnline) {
        const senderSocketId = connectedUsers.get(to);
        io.to(senderSocketId).emit("user online tick", { to: user, timestamp });
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
