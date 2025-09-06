// Import connection
import connectDB from "./models/connection.js";

// Import all models and functions from separate files
import { 
    Donor, 
    registerDonor, 
    loginDonor, 
    getDonorByEmail,
    sendDonorOTP,
    verifyDonorOTP,
    resetDonorPassword
} from "./models/donor.js";

import { 
    BloodBank, 
    registerBloodBank, 
    loginBloodBank, 
    getBloodBankByEmail,
    getAllBloodBanks,
    sendBloodBankOTP,
    verifyBloodBankOTP,
    resetBloodBankPassword,
    addBloodStock, 
    updateBloodStock, 
    deleteBloodStock,
    getBloodAvailability
} from "./models/bloodBank.js";

import { 
    BloodCamp,
    registerBloodCamp,
    getActiveBloodCamps,
    cleanupExpiredCamps,
    getPendingBloodCamps,
    approveBloodCamp,
    rejectBloodCamp,
    sendCampApprovalEmail,
    sendCampRejectionEmail,
    getApprovedBloodCamps,
    markDonorDonated
} from "./models/bloodCamp.js";

import { 
    Admin, 
    registerAdmin, 
    loginAdmin, 
    getAdminByEmail,
    getAdminStats,
    sendAdminOTP,
} from "./models/admin.js";

// Connect to database
connectDB();

// Re-export everything so existing code continues to work
export {
    // Donor functions
    Donor,
    registerDonor,
    loginDonor,
    getDonorByEmail,
    sendDonorOTP,
    verifyDonorOTP,
    resetDonorPassword,
    
    // Blood Bank functions
    BloodBank,
    registerBloodBank,
    loginBloodBank,
    getBloodBankByEmail,
    getAllBloodBanks,
    sendBloodBankOTP,
    verifyBloodBankOTP,
    resetBloodBankPassword,
    
    // Blood Camp functions
    BloodCamp,
    registerBloodCamp,
    getActiveBloodCamps,
    cleanupExpiredCamps,
    getPendingBloodCamps,
    approveBloodCamp,
    rejectBloodCamp,
    sendCampApprovalEmail,
    sendCampRejectionEmail,
    getApprovedBloodCamps,
    markDonorDonated,
    addBloodStock, 
    updateBloodStock, 
    deleteBloodStock,
    getBloodAvailability,

    // Admin functions
    Admin,
    registerAdmin,
    loginAdmin,
    getAdminByEmail,
    getAdminStats,
    sendAdminOTP,
};