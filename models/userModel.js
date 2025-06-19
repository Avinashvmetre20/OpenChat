const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
    },
    realPassword: {
        type: String,
        required: true
    },
    mobile: {
        type: Number,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^[6-9]\d{9}$/.test(v.toString());
            },
            message: props => `${props.value} is not a valid 10-digit mobile number!`
        }
    },

    socketId: {
        type: String,
        default: null
    }

});

module.exports = mongoose.model("User", userSchema);