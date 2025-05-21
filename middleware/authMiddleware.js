const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

 let decoded;
const protect = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ msg: "No token, access denied" });

  try {
     decoded = jwt.verify(token, process.env.JWT_SECRET);
    //  console.log(decoded)
    // console.log("decoded",decoded)
    req.user = await User.findById(decoded.userId).select("-password");
    next();
  } catch (err) {
    res.status(401).json({ msg: "Invalid token" });
  }
};

module.exports = {protect};
