import mongoose from "mongoose";
import dotenv from 'dotenv';
dotenv.config();
const uri = process.env.MONGO_URI;

// Create and export the connection
const connectDB = async () => {
    try {
        await mongoose.connect(uri);
        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};

export default connectDB;