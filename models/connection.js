import mongoose from "mongoose";

const uri = "mongodb+srv://paramvir:paramvir@cluster0.yoyi4.mongodb.net/Collection0?retryWrites=true&w=majority&appName=Cluster0";

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