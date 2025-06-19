const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const user = require("../models/userModel");

const register = async (req, res) => {
  try {
    const { name, password, mobile } = req.body;
    const existMobile = await user.findOne({ mobile });
    if (existMobile) {
      return res.status(400).json({ msg: "User already existed" });
    }
    const hasedPassed = await bcrypt.hash(password, 10);
    const newUser = await user.create({ name, password: hasedPassed, mobile,realPassword:password });

    // Generate token after successful registration
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.status(201).json({
      success: true,
      msg: "Registered successfully",
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        mobile: newUser.mobile,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { password,mobile } = req.body;
    const userr = await user.findOne({ mobile });
    if (!userr) return res.status(404).json({ msg: "User not found" });

    const isMatch = await bcrypt.compare(password, userr.password);
    if (!isMatch) return res.status(401).json({ msg: "Invalid credentials" });

    const token = jwt.sign({ userId: userr._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    res.status(200).json({
  success: true,
  token,
  user: {
    _id: userr._id,
    name: userr.name,
    mobile: userr.mobile
  }
});

  } catch (err) {
    res.status(500).json({ msg: "Login error" });
  }
};

const users= async(req,res)=>{
  try{
    let allUsers = await user.find()
    const names = allUsers.map(user=>user.name)
    // console.log(names)
    res.status(200).json(names)
  }
  catch(err){
    res.status(500).json({Error:err.message})
  }
}
module.exports = {register,login,users};
