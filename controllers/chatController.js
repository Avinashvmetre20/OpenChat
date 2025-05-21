const Message = require("../models/messageModel");

exports.getUserChats = async (req, res) => {
  const userId = req.user._id;

  const messages = await Message.find({
    $or: [
      { sender: userId },
      { receiver: userId },
      { receiver: null } // public messages
    ]
  }).populate("sender", "name").populate("receiver", "name");

  res.json({msg:messages,user:req.user});
};


