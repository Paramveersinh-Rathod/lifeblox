import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { OTP } from "./otp.js";
import { transporter } from "./mailer.js";


// Schema for detailed blood stock
const DetailedBloodStockSchema = new mongoose.Schema({
    bloodComponent: {
        type: String,
        enum: ['Whole Blood', 'Single Plasma', 'Single Platelet'],
        required: true
    },
    bloodType: {
        type: String,
        enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
        required: true
    },
    city: {
        type: String,
        enum: ['Ahmedabad', 'Delhi', 'Mumbai', 'Lucknow', 'Bangalore'],
        required: true
    },
    units: {
        type: Number,
        required: true,
        min: 0
    },
    expiryDate: {
        type: Date,
        required: true
    },
    addedDate: {
        type: Date,
        default: Date.now
    }
});

// Blood Bank Schema & Model
const bloodBankSchema = new mongoose.Schema({
    city: { type: String, required: true },
    bloodBankName: { type: String, required: true },
    hospitalName: { type: String, required: true },
    category: { type: String, required: true },
    contactPerson: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    contactNo: { type: String, required: true },
    licenseNo: { type: String, unique: true, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    password: { type: String, required: true }, // Add password for login
    bloodStock: {
        type: Map,
        of: Number,
        default: {}
    },
    
    // New field for detailed blood stock
    detailedBloodStock: [DetailedBloodStockSchema],
    createdAt: { type: Date, default: Date.now }
});

export const BloodBank = mongoose.model("BloodBank", bloodBankSchema);

// Function to register a new blood bank
export const registerBloodBank = async (bloodBankData) => {
    const { 
        city, bloodBankName, hospitalName, category, 
        contactPerson, email, contactNo, licenseNo, 
        address, pincode, password 
    } = bloodBankData;

    try {
        // Check if blood bank with this email or license already exists
        const existingBloodBank = await BloodBank.findOne({
            $or: [
                { email },
                { licenseNo }
            ]
        });

        if (existingBloodBank) {
            return { 
                success: false, 
                message: "Blood Bank with this email or license number already exists" 
            };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new blood bank
        const newBloodBank = new BloodBank({
            city,
            bloodBankName,
            hospitalName,
            category,
            contactPerson,
            email,
            contactNo,
            licenseNo,
            address,
            pincode,
            password: hashedPassword
        });

        // Save to database
        await newBloodBank.save();
        return { success: true, message: "Blood Bank Registration successful" };
        
    } catch (error) {
        console.error("Error registering blood bank:", error);
        return { success: false, message: "Registration failed" };
    }
};

// Function to login blood bank
export const loginBloodBank = async ({ email, password }) => {
    try {
        const bloodBank = await BloodBank.findOne({ email });
        if (!bloodBank) {
            return { success: false, message: "Blood Bank not found" };
        }
        
        const isPasswordValid = await bcrypt.compare(password, bloodBank.password);
        if (!isPasswordValid) {
            return { success: false, message: "Invalid password" };
        }
        
        return { success: true, message: "Login successful" };
    } catch (error) {
        console.error("Blood Bank login error:", error);
        return { success: false, message: "Error during login" };
    }
};

export const getBloodBankByEmail = async (email) => {
    try {
        // Find blood bank but exclude password
        const bloodBank = await BloodBank.findOne({ email }).select('-password');
        
        if (!bloodBank) {
            return null;
        }
        
        return bloodBank;
    } catch (error) {
        console.error("Error fetching blood bank:", error);
        return null;
    }
};

export const getAllBloodBanks = async () => {
    try {
        // Find all blood banks but exclude passwords
        const bloodbanks = await BloodBank.find().select('-password');
        
        if (!bloodbanks) {
            return null;
        }
        
        return bloodbanks;
    } catch (error) {
        console.error("Error fetching blood banks:", error);
        return null;
    }
};

export const sendBloodBankOTP = async (email) => {
    try {
        // Check if blood bank exists
        const bloodBank = await BloodBank.findOne({ email });
        if (!bloodBank) {
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
            subject: "LifebloX - Blood Bank Password Reset OTP",
            html: `
                <h1>Password Reset</h1>
                <p>Your OTP for password reset is: <strong>${otp}</strong></p>
                <p>This OTP will expire in 5 minutes.</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true, message: "OTP sent to your email" };
        
    } catch (error) {
        console.error("Error sending Blood Bank OTP:", error);
        return { success: false, message: "Failed to send OTP" };
    }
};

// Function to verify OTP for blood bank
export const verifyBloodBankOTP = async (email, otp) => {
    try {
        // Find the stored OTP document
        const otpDoc = await OTP.findOne({ emailId: email });
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
        console.error("Error verifying Blood Bank OTP:", error);
        return { success: false, message: "OTP verification failed" };
    }
};

// Function to reset blood bank password
export const resetBloodBankPassword = async (email, newPassword) => {
    try {
        // Find the blood bank
        const bloodBank = await BloodBank.findOne({ email });
        if (!bloodBank) {
            return { success: false, message: "Blood Bank not found" };
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        bloodBank.password = hashedPassword;
        await bloodBank.save();
        
        // Delete any OTPs for this email
        await OTP.deleteMany({ emailId: email });
        
        return { success: true, message: "Password reset successful" };
        
    } catch (error) {
        console.error("Error resetting Blood Bank password:", error);
        return { success: false, message: "Password reset failed" };
    }
};
export const addBloodStock = async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { bloodComponent, bloodType, city, units, expiryDate } = req.body;
        
        // Validate inputs
        if (!bloodComponent || !bloodType || !city || !units || !expiryDate) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        
        // Convert units to number
        const unitsNum = parseInt(units);
        if (isNaN(unitsNum) || unitsNum <= 0) {
            return res.status(400).json({ success: false, message: "Units must be a positive number" });
        }
        
        // Get blood bank data
        const bloodBank = await BloodBank.findOne({ email: req.session.bloodBankEmail });
        
        if (!bloodBank) {
            return res.status(404).json({ success: false, message: "Blood bank not found" });
        }
        
        // Create new blood stock entry
        const newStock = {
            bloodComponent,
            bloodType,
            city,
            units: unitsNum,
            expiryDate: new Date(expiryDate)
        };
        
        // Initialize detailedBloodStock array if it doesn't exist
        if (!bloodBank.detailedBloodStock) {
            bloodBank.detailedBloodStock = [];
        }
        
        // Add new stock to the array
        bloodBank.detailedBloodStock.push(newStock);
        
        // Update the summary bloodStock object for quick reference
        if (!bloodBank.bloodStock) {
            bloodBank.bloodStock = {};
        }
        
        // Update or create the entry in the bloodStock summary
        if (bloodBank.bloodStock[bloodType]) {
            bloodBank.bloodStock[bloodType] += unitsNum;
        } else {
            bloodBank.bloodStock[bloodType] = unitsNum;
        }
        
        // Save the updated blood bank document
        await bloodBank.save();
        
        return res.json({ success: true, message: "Blood stock added successfully" });
    } catch (error) {
        console.error("Add blood stock error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
};

export const updateBloodStock = async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { stockId, units, expiryDate } = req.body;
        
        // Validate inputs
        if (!stockId || !units || !expiryDate) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }
        
        // Convert units to number
        const unitsNum = parseInt(units);
        if (isNaN(unitsNum) || unitsNum <= 0) {
            return res.status(400).json({ success: false, message: "Units must be a positive number" });
        }
        
        // Get blood bank data
        const bloodBank = await BloodBank.findOne({ 
            email: req.session.bloodBankEmail,
            "detailedBloodStock._id": stockId 
        });
        
        if (!bloodBank) {
            return res.status(404).json({ success: false, message: "Blood stock not found" });
        }
        
        // Find the stock entry
        const stockEntry = bloodBank.detailedBloodStock.id(stockId);
        if (!stockEntry) {
            return res.status(404).json({ success: false, message: "Blood stock entry not found" });
        }
        
        // Calculate the units difference for updating the summary
        const unitsDiff = unitsNum - stockEntry.units;
        
        // Update the stock entry
        stockEntry.units = unitsNum;
        stockEntry.expiryDate = new Date(expiryDate);
        
        // Update the summary bloodStock object
        if (bloodBank.bloodStock[stockEntry.bloodType]) {
            bloodBank.bloodStock[stockEntry.bloodType] += unitsDiff;
            
            // Ensure stock doesn't go below 0
            if (bloodBank.bloodStock[stockEntry.bloodType] < 0) {
                bloodBank.bloodStock[stockEntry.bloodType] = 0;
            }
        }
        
        // Save the updated blood bank document
        await bloodBank.save();
        
        return res.json({ success: true, message: "Blood stock updated successfully" });
    } catch (error) {
        console.error("Update blood stock error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
};

export const deleteBloodStock = async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { stockId } = req.body;
        
        // Validate input
        if (!stockId) {
            return res.status(400).json({ success: false, message: "Stock ID is required" });
        }
        
        // Get blood bank data
        const bloodBank = await BloodBank.findOne({ 
            email: req.session.bloodBankEmail,
            "detailedBloodStock._id": stockId 
        });
        
        if (!bloodBank) {
            return res.status(404).json({ success: false, message: "Blood stock not found" });
        }
        
        // Find the stock entry to get its details before removal
        const stockEntry = bloodBank.detailedBloodStock.id(stockId);
        if (!stockEntry) {
            return res.status(404).json({ success: false, message: "Blood stock entry not found" });
        }
        
        // Save the bloodType and units for updating the summary
        const { bloodType, units } = stockEntry;
        
        // Remove the stock entry from the array
        bloodBank.detailedBloodStock.pull(stockId);
        
        // Update the summary bloodStock object
        if (bloodBank.bloodStock[bloodType]) {
            bloodBank.bloodStock[bloodType] -= units;
            
            // Ensure stock doesn't go below 0
            if (bloodBank.bloodStock[bloodType] < 0) {
                bloodBank.bloodStock[bloodType] = 0;
            }
            
            // Remove the blood type entry if units is 0
            if (bloodBank.bloodStock[bloodType] === 0) {
                delete bloodBank.bloodStock[bloodType];
            }
        }
        
        // Save the updated blood bank document
        await bloodBank.save();
        
        return res.json({ success: true, message: "Blood stock deleted successfully" });
    } catch (error) {
        console.error("Delete blood stock error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
};

export const getBloodAvailability = async (req, res) => {
    try {
        const { bloodComponent, bloodType, city } = req.query;
        
        // Build the filter object based on the provided parameters
        let filter = {};
        
        // We need to query for blood banks that have blood stock matching our criteria
        const aggregationPipeline = [];
        
        // Match city if provided
        if (city) {
            filter.city = city;
        }
        
        // Add the initial match stage
        aggregationPipeline.push({ $match: filter });
        
        // Filter detailedBloodStock array
        const stockFilter = {};
        if (bloodComponent) {
            stockFilter["detailedBloodStock.bloodComponent"] = bloodComponent;
        }
        if (bloodType) {
            stockFilter["detailedBloodStock.bloodType"] = bloodType;
        }
        
        // Add a match stage for stock criteria if needed
        if (Object.keys(stockFilter).length > 0) {
            aggregationPipeline.push({ $match: stockFilter });
        }
        
        // Add a projection to only include necessary fields
        aggregationPipeline.push({
            $project: {
                bloodBankName: 1,
                hospitalName: 1,
                city: 1,
                contactNo: 1,
                email: 1,
                address: 1,
                detailedBloodStock: {
                    $filter: {
                        input: "$detailedBloodStock",
                        as: "stock",
                        cond: {
                            $and: [
                                { $gt: ["$$stock.units", 0] },
                                { $gt: ["$$stock.expiryDate", new Date()] },
                                bloodComponent ? { $eq: ["$$stock.bloodComponent", bloodComponent] } : true,
                                bloodType ? { $eq: ["$$stock.bloodType", bloodType] } : true
                            ]
                        }
                    }
                }
            }
        });
        
        // Only return blood banks that have matching stock
        aggregationPipeline.push({
            $match: {
                "detailedBloodStock.0": { $exists: true }
            }
        });
        
        // Execute the aggregation
        const bloodBanks = await BloodBank.aggregate(aggregationPipeline);
        
        // Format the results to match the expected frontend structure
        const results = bloodBanks.map(bloodBank => {
            return {
                bloodBank: {
                    bloodBankName: bloodBank.bloodBankName,
                    hospitalName: bloodBank.hospitalName,
                    city: bloodBank.city,
                    contactNo: bloodBank.contactNo,
                    email: bloodBank.email,
                    address: bloodBank.address
                },
                matchingStock: bloodBank.detailedBloodStock
            };
        });
        
        return res.json({ success: true, results });
    } catch (error) {
        console.error("Blood availability search error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
};