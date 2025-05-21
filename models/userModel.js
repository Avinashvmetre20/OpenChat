const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true,
    },
    mobile:{
        type:Number,
        required:true,
        unique:true
    },
    socketId: {
        type: String,
        default: null
    }
    
});

module.exports = mongoose.model("User",userSchema);