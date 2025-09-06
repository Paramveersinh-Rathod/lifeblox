import connectDB from "./models/connection.js";
import { registerAdmin } from "./models/admin.js";

// Connect to database
connectDB();

// Admin details
const adminDetails = {
    username: "yatharth",
    email: "yatharth@lifeblox.com",
    password: "yatharth123"  // Change this to a secure password
};

// Register admin
async function initAdmin() {
    try {
        const result = await registerAdmin(adminDetails);
        console.log("Admin initialization result:", result);
    } catch (error) {
        console.error("Error initializing admin:", error);
    } finally {
        process.exit();
    }
}

// Run the initialization
initAdmin();