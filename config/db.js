const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log(`mongoo db connected`);
    }
    catch (err) {
        console.log(err.message);
    }
}

module.exports = connectDB;