require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const socketHandler = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
socketHandler(io);

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// Static frontend (adjust path if needed)
app.use(express.static(path.join(__dirname, "frontend")));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/message", require("./routes/chatRouter"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "Frontend", "index.html"));
});


const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
