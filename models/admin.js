import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { OTP } from "./otp.js";
import { transporter } from "./mailer.js";

// Admin Schema & Model
const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" },
    lastLogin: { type: Date }
});

export const Admin = mongoose.model("Admin", adminSchema);

// Function to register an admin (for initial setup)
export const registerAdmin = async (adminData) => {
    const { username, email, password } = adminData;

    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return { success: false, message: "Email is already registered" };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new admin
        const newAdmin = new Admin({
            username,
            email,
            password: hashedPassword,
            lastLogin: new Date()
        });

        // Save to database
        await newAdmin.save();
        return { success: true, message: "Admin registration successful" };
        
    } catch (error) {
        console.error("Error registering admin:", error);
        return { success: false, message: "Registration failed" };
    }
};

// Function to login admin
export const loginAdmin = async ({ email, password }) => {
    try {
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return { success: false, message: "Admin not found" };
        }
        
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return { success: false, message: "Invalid password" };
        }
        
        // Update last login time
        admin.lastLogin = new Date();
        await admin.save();
        
        return { success: true, message: "Login successful" };

    } catch (error) {
        console.error("Admin login error:", error);
        return { success: false, message: "Error during login" };
    }
};

// Function to get admin by email
export const getAdminByEmail = async (email) => {
    try {
        // Find admin but exclude password
        const admin = await Admin.findOne({ email }).select('-password');
        
        if (!admin) {
            return null;
        }
        
        return admin;
    } catch (error) {
        console.error("Error fetching admin:", error);
        return null;
    }
};

// Add password reset functions similar to donor
export const sendAdminOTP = async (email) => {
    try {
        // Check if admin exists
        const admin = await Admin.findOne({ email });
        if (!admin) {
            return { success: false, message: "Email not registered" };
        }

        // Generate 5-digit OTP
        const otp = Math.floor(10000 + Math.random() * 90000).toString();
        
        // Hash OTP before saving
        const hashedOTP = await bcrypt.hash(otp, 10);
        
        // Save OTP to database (remove any existing OTPs for this email first)
        await OTP.deleteMany({ emailId: email });
        await new OTP({ emailId: email, otp: hashedOTP }).save();
        
        // Send email with OTP
        const mailOptions = {
            from: "lifeblox.healthcare@gmail.com",
            to: email,
            subject: "LifebloX Admin - Password Reset OTP",
            html: `
                <h1>Admin Password Reset</h1>
                <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true, message: "OTP sent to your email" };
        
    } catch (error) {
        console.error("Error sending admin OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
};


export const getAdminStats = async () => {
    try {
        // Import models
        const Donor = mongoose.model("Donor");
        const BloodBank = mongoose.model("BloodBank");
        const BloodCamp = mongoose.model("BloodCamp");
        
        // Get counts
        const totalDonors = await Donor.countDocuments();
        const totalBloodBanks = await BloodBank.countDocuments();
        const totalCamps = await BloodCamp.countDocuments();
        
        // Get cities with camps
        const cities = await BloodCamp.distinct('city');
        
        // Get new donors this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const newDonorsThisMonth = await Donor.countDocuments({ 
            createdAt: { $gte: startOfMonth } 
        });
        
        // Calculate total blood units available
        const bloodBanks = await BloodBank.find();
        let totalBloodUnits = 0;
        let bloodTypeData = {
            'A+': 0, 'A-': 0, 'B+': 0, 'B-': 0, 
            'AB+': 0, 'AB-': 0, 'O+': 0, 'O-': 0
        };
        
        // Aggregate blood units from all blood banks
        bloodBanks.forEach(bank => {
            // Check if detailedBloodStock exists and is an array
            if (bank.detailedBloodStock && Array.isArray(bank.detailedBloodStock)) {
                bank.detailedBloodStock.forEach(stock => {
                    // Only count non-expired blood
                    if (stock.expiryDate > new Date()) {
                        totalBloodUnits += stock.units;
                        
                        // Track by blood type
                        if (bloodTypeData.hasOwnProperty(stock.bloodType)) {
                            bloodTypeData[stock.bloodType] += stock.units;
                        }
                    }
                });
            }
        });
        
        // Find the blood type with lowest count
        const mostNeededType = Object.entries(bloodTypeData)
            .filter(([_, count]) => count > 0) // Only consider types with some availability
            .sort(([_, countA], [__, countB]) => countA - countB)[0]?.[0] || 'Unknown';
        console.log(totalBloodUnits)
        return {
            registeredDonors: totalDonors,
            bloodBanks: totalBloodBanks,
            totalCamps: totalCamps,
            citiesWithCamps: cities.length,
            newDonorsThisMonth: newDonorsThisMonth,
            totalBloodUnits: totalBloodUnits,
            bloodTypeData: bloodTypeData,
            mostNeededType: mostNeededType
        };
        
    } catch (error) {
        console.error("Error getting admin stats:", error);
        return null;
    }
};

