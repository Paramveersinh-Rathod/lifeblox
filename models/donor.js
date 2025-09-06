import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { OTP } from "./otp.js";
import { transporter } from "./mailer.js";

// Donor Schema & Model
const donorSchema = new mongoose.Schema({
    name: { type: String, required: true },
    emailId: { type: String, unique: true, required: true },
    mobileNumber: { type: String, required: true },
    dob: { type: String, required: true },
    bloodType: { type: String, required: true },
    password: { type: String, required: true },
    gender: { type: String, default: "Not specified" },
    donationHistory: [{
        date: Date,
        location: String
    }],
    lastDonationDate: { type: Date, default: null },
    totalDonations: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

export const Donor = mongoose.model("Donor", donorSchema);

/*
 * Function to register a new donor
 */
export const registerDonor = async (donorData) => {
    const { name, emailId, mobileNumber, countryCode, dob, bloodType, password, gender } = donorData;

    try {
        // Check if donor already exists
        const existingDonor = await Donor.findOne({ emailId });
        if (existingDonor) {
            return { success: false, message: "Email is already registered" };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new donor
        const newDonor = new Donor({
            name,
            emailId,
            mobileNumber: `${countryCode} ${mobileNumber}`,
            dob,
            bloodType,
            password: hashedPassword,
            gender
        });

        // Save to database
        await newDonor.save();
        return { success: true, message: "Registration successful" };
        
    } catch (error) {
        console.error("Error registering donor:", error);
        return { success: false, message: "Registration failed" };
    }
};

export const loginDonor = async ({ emailId, password }) => {
    try {
        const donor = await Donor.findOne({ emailId });
        if (!donor) {
            return { success: false, message: "User not found" };
        }
        const isPasswordValid = await bcrypt.compare(password, donor.password);
        if (!isPasswordValid) {
            return { success: false, message: "Invalid password" };
        }
        return { success: true, message: "Login successful" };

    } catch (error) {
        console.error("Login error:", error);
        return { success: false, message: "Error during login" };
    }
};

/**
 * Function to get donor data by email
 */
export const getDonorByEmail = async (emailId) => {
    try {
        // Find donor but exclude password
        const donor = await Donor.findOne({ emailId }).select('-password');
        
        if (!donor) {
            return null;
        }
        
        return donor;
    } catch (error) {
        console.error("Error fetching donor:", error);
        return null;
    }
};

// Add functions for password reset
export const sendDonorOTP = async (emailId) => {
    try {
        // Check if user exists
        const donor = await Donor.findOne({ emailId });
        if (!donor) {
            return { success: false, message: "Email not registered" };
        }

        // Generate 5-digit OTP
        const otp = Math.floor(10000 + Math.random() * 90000).toString();
        
        // Hash OTP before saving
        const hashedOTP = await bcrypt.hash(otp, 10);
        
        // Save OTP to database (remove any existing OTPs for this email first)
        await OTP.deleteMany({ emailId });
        await new OTP({ emailId, otp: hashedOTP }).save();
        
        // Send email with OTP
        const mailOptions = {
            from: "lifeblox.healthcare@gmail.com",
            to: emailId,
            subject: "LifebloX - Password Reset OTP",
            html: `
                <h1>Password Reset</h1>
                <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true, message: "OTP sent to your email" };
        
    } catch (error) {
        console.error("Error sending OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
};

export const verifyDonorOTP = async (emailId, otp) => {
    try {
        // Find the stored OTP document
        const otpDoc = await OTP.findOne({ emailId });
        if (!otpDoc) {
            return { success: false, message: "OTP expired or not found" };
        }
        
        // Verify OTP
        const isValidOTP = await bcrypt.compare(otp, otpDoc.otp);
        
        if (!isValidOTP) {
            return { success: false, message: "Invalid OTP" };
        }
        
        return { success: true, message: "OTP verified successfully" };
        
    } catch (error) {
        console.error("Error verifying OTP:", error);
        return { success: false, message: "OTP verification failed" };
    }
};

export const resetDonorPassword = async (emailId, newPassword) => {
    try {
        // Find the donor
        const donor = await Donor.findOne({ emailId });
        if (!donor) {
            return { success: false, message: "User not found" };
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        // Update password
        donor.password = hashedPassword;
        await donor.save();
        // Delete any OTPs for this email
        await OTP.deleteMany({ emailId });
        
        return { success: true, message: "Password reset successful" };
        
    } catch (error) {
        console.error("Error resetting password:", error);
        return { success: false, message: "Password reset failed" };
    }
};