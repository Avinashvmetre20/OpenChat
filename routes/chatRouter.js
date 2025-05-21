const express = require("express");
const {protect} = require("../middleware/authMiddleware");
const { getUserChats } = require("../controllers/chatController");

const router = express.Router();
router.get("/my", protect, getUserChats);
// router.get("/chat", auth, socketHandler);


module.exports = router;
