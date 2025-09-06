import mongoose from "mongoose";
import { transporter } from "./mailer.js";
import { Donor } from "./donor.js";

const bloodCampSchema = new mongoose.Schema({
    campName: { type: String, required: true, minlength: 3, maxlength: 100 },
    location: { type: String, required: true },
    city: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    bloodBank: { type: String, required: true },
    contactNumber: { 
        type: String, 
        required: true, 
        validate: {
            validator: function(v) {
                return /^[6-9][0-9]{9}$/.test(v);
            },
            message: props => `${props.value} is not a valid phone number!`
        }
    },
    email: { 
        type: String, 
        required: true, 
        validate: {
            validator: function(v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email!`
        }
    },
    approved: { type: Boolean, default: false },
    donors: [
        {
            donorName: {type: String,},
            donorBloodType: {type: String,},
            donorMobileNumber: {type: String,},
            donorEmail: {type: String,},
            hasDonated: {
                type: Boolean,
                default: false
            }
        }
    ],
    createdAt: { type: Date, default: Date.now }
});

export const BloodCamp = mongoose.model("BloodCamp", bloodCampSchema);

// Function to register a new blood camp
export const registerBloodCamp = async (bloodCampData) => {
    const { 
        campName, 
        location, 
        city, 
        date, 
        startTime, 
        endTime, 
        bloodBank, 
        contact, 
        email 
    } = bloodCampData;

    try {
        // Create new blood camp
        const newBloodCamp = new BloodCamp({
            campName,
            location,
            city,
            date: new Date(date),
            startTime,
            endTime,
            bloodBank,
            contactNumber: contact,
            email,
            donors: []
        });

        // Save to database
        await newBloodCamp.save();
        return { success: true, message: "Blood Camp Registration successful" };
        
    } catch (error) {
        console.error("Error registering blood camp:", error);
        
        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return { 
                success: false, 
                message: errorMessages.join(', ') 
            };
        }
        
        return { success: false, message: "Registration failed" };
    }
};

export const getActiveBloodCamps = async () => {
    try {
        // Get current date
        const currentDate = new Date();

        // Find blood camps with future dates and approved status
        const activeCamps = await BloodCamp.find({ 
            date: { $gte: currentDate },
            approved: true
        }).sort({ date: 1 }); // Sort by date in ascending order

        return activeCamps;
    } catch (error) {
        console.error("Error fetching active blood camps:", error);
        return [];
    }
};

/**
 * Function to get approved blood camps for a specific blood bank
 * with populated donor information
 */
export const getApprovedBloodCamps = async (bloodBankName) => {
    try {
        // Get approved camps for the specified blood bank
        const approvedCamps = await BloodCamp.find({
            bloodBank: bloodBankName,
            approved: true
        })
        .sort({ date: 1 }); // Sort by date in ascending order

        return approvedCamps;
    } catch (error) {
        console.error("Error fetching approved blood camps:", error);
        return [];
    }
};

export const cleanupExpiredCamps = async () => {
    try {
        // Get current date
        const currentDate = new Date();

        // Delete camps with past dates
        const result = await BloodCamp.deleteMany({
            date: { $lt: currentDate }
        });
        
        console.log(`Deleted ${result.deletedCount} expired blood camps`);
        return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
        console.error("Error cleaning up expired camps:", error);
        return { success: false, message: "Failed to clean up expired camps" };
    }
};

export const sendCampApprovalEmail = async (campId) => {
    try {
        // Find the camp
        const camp = await BloodCamp.findById(campId);
        
        if (!camp) {
            return { success: false, message: "Camp not found" };
        }
        
        // Send email notification
        const mailOptions = {
            from: "lifeblox.healthcare@gmail.com",
            to: camp.email,
            subject: "LifebloX - Blood Camp Approved",
            html: `
                <h1>Blood Camp Approval Notification</h1>
                <p>Your blood camp "${camp.campName}" has been approved by ${camp.bloodBank}.</p>
                <h2>Camp Details:</h2>
                <ul>
                    <li><strong>Camp Name:</strong> ${camp.campName}</li>
                    <li><strong>Location:</strong> ${camp.location}, ${camp.city}</li>
                    <li><strong>Date:</strong> ${new Date(camp.date).toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${camp.startTime} - ${camp.endTime}</li>
                </ul>
                <p>Thank you for organizing this blood donation camp!</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true, message: "Approval notification sent" };
        
    } catch (error) {
        console.error("Error sending camp approval email:", error);
        return { success: false, message: "Failed to send approval notification" };
    }
};

export const sendCampRejectionEmail = async (campId) => {
    try {
        // Find the camp
        const camp = await BloodCamp.findById(campId);
        
        if (!camp) {
            return { success: false, message: "Camp not found" };
        }
        
        // Send email notification
        const mailOptions = {
            from: "lifeblox.healthcare@gmail.com",
            to: camp.email,
            subject: "LifebloX - Blood Camp Rejected",
            html: `
                <h1>Blood Camp Rejection Notification</h1>
                <p>Your blood camp "${camp.campName}" has been rejected by ${camp.bloodBank}.</p>
                <h2>Camp Details:</h2>
                <ul>
                    <li><strong>Camp Name:</strong> ${camp.campName}</li>
                    <li><strong>Location:</strong> ${camp.location}, ${camp.city}</li>
                    <li><strong>Date:</strong> ${new Date(camp.date).toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${camp.startTime} - ${camp.endTime}</li>
                </ul>
                <p>We are sorry for the inconvenience !</p>
            `
        };
        
        await transporter.sendMail(mailOptions);
        return { success: true, message: "Rejection notification sent" };
        
    } catch (error) {
        console.error("Error sending camp rejection email:", error);
        return { success: false, message: "Failed to send rejection notification" };
    }
};

/**
 * Function to get pending blood camp requests for a specific blood bank
 */
export const getPendingBloodCamps = async (bloodBankName) => {
    try {
        const pendingCamps = await BloodCamp.find({ 
            bloodBank: bloodBankName,
            approved: false
        });
        
        return pendingCamps;
    } catch (error) {
        console.error("Error fetching pending blood camps:", error);
        return [];
    }
};

// Function to approve a blood camp request
export const approveBloodCamp = async (campId) => {
    try {
        const result = await BloodCamp.updateOne(
            { _id: campId },
            { $set: { approved: true } }
        );
        
        if (result.modifiedCount > 0) {
            // Send approval notification email
            await sendCampApprovalEmail(campId);
            
            return { success: true, message: "Camp approved successfully" };
        } else {
            return { success: false, message: "Failed to approve camp" };
        }
    } catch (error) {
        console.error("Camp approval error:", error);
        return { success: false, message: "Error during camp approval" };
    }
};


export const markDonorDonated = async (donorEmail, campId) => {
    try {
        // Find the camp details
        const camp = await BloodCamp.findById(campId);
        if (!camp) {
            return { success: false, message: "Camp not found" };
        }
        
        // Find the donor
        const donor = await Donor.findOne({ emailId: donorEmail });
        if (!donor) {
            return { success: false, message: "Donor not found" };
        }
        
        // Update donor's donation history
        donor.donationHistory.push({
            date: camp.date,
            location: `${camp.campName}, ${camp.city}`
        });
        
        // Update last donation date
        donor.lastDonationDate = camp.date;
        
        // Increment total donations count
        donor.totalDonations += 1;
        
        // Save donor changes
        await donor.save();
        
        // Update the donor's status in the camp to hasDonated=true
        await BloodCamp.updateOne(
            { 
              _id: campId,
              "donors.donorEmail": donorEmail  // Find the correct donor entry by email
            },
            { 
              $set: { "donors.$.hasDonated": true } 
            }
          );
        
        return { success: true, message: "Donor marked as donated successfully" };
    } catch (error) {
        console.error("Error marking donor as donated:", error);
        return { success: false, message: "Failed to mark donation" };
    }
};
/**
 * Function to reject a blood camp request
 */
export const rejectBloodCamp = async (campId) => {
    try {
        // First, find the camp to get its details
        const camp = await BloodCamp.findById(campId);
        
        if (!camp) {
            return { success: false, message: "Camp not found" };
        }
        
        // Send rejection notification email
        await sendCampRejectionEmail(campId);
        
        // Then delete the camp
        const result = await BloodCamp.deleteOne({ _id: campId });
        
        if (result.deletedCount > 0) {
            return { success: true, message: "Camp rejected successfully" };
        } else {
            return { success: false, message: "Failed to reject camp" };
        }
    } catch (error) {
        console.error("Camp rejection error:", error);
        return { success: false, message: "Error during camp rejection" };
    }
};