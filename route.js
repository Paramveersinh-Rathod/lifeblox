import express from "express";
import bodyParser from "body-parser";
import session from "express-session"; 
import MongoStore from 'connect-mongo'; 
import ExcelJS from 'exceljs';
import { 
    Donor,
    BloodBank,
    BloodCamp,
    // Donor functions
    registerDonor, 
    loginDonor, 
    sendDonorOTP, 
    verifyDonorOTP, 
    resetDonorPassword,
    getDonorByEmail,
    // Blood Bank functions
    registerBloodBank, 
    loginBloodBank, 
    sendBloodBankOTP, 
    verifyBloodBankOTP, 
    resetBloodBankPassword,
    getBloodBankByEmail, 
    getAllBloodBanks, 
    markDonorDonated,
    addBloodStock, 
    updateBloodStock, 
    deleteBloodStock,
    getBloodAvailability,
    // Blood Camp functions
    registerBloodCamp,
    getActiveBloodCamps,
    getPendingBloodCamps,
    approveBloodCamp,
    rejectBloodCamp,
    cleanupExpiredCamps,
    sendCampApprovalEmail,
    getApprovedBloodCamps,
    // Admin functions
    registerAdmin, 
    loginAdmin, 
    getAdminByEmail, 
    getAdminStats,
    sendAdminOTP
} from "./database.js";
import { createPDF } from './certificateGenerator.js'; 

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURATION =====
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({         // <-- Add this 'store' option
        mongoUrl: process.env.MONGO_URI
    }),
    cookie: { 
        secure: false, // Set to true if you are using HTTPS
        maxAge: 3600000 // 1 hour session
    } 
}));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ===== GENERAL ROUTES =====
app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/registerBloodCamp", async (req, res) => {
    const bloodbanks = await getAllBloodBanks();
    res.render("bloodCampRegistration.ejs", {bloodbanks});
});

app.post("/registerBloodCamp", async (req, res) => {
    try {
        const { 
            campName, 
            location, 
            city, 
            date, 
            startTime, 
            endTime, 
            bloodbank, 
            contact, 
            email 
        } = req.body;

        const result = await registerBloodCamp({ 
            campName, 
            location, 
            city, 
            date, 
            startTime, 
            endTime, 
            bloodBank: bloodbank, 
            contact, 
            email 
        });

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error("Blood Camp registration error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.get("/learnAboutDontion", async (req, res) => {            
    try {
        
        
        res.render("learnAboutBD.ejs");
    } catch (error) {
        console.error("Error rendering active blood camps:", error);
        res.status(500).send("Server error occurred");
    }
});
app.get("/activeBloodCamp", async (req, res) => {            
    try {
        // First clean up expired camps
        await cleanupExpiredCamps();
        // Fetch active blood camps
        const activeCamps = await getActiveBloodCamps();
        
        // Get donor data if logged in
        let donorData = null;
        if (req.session.userEmail) {
            donorData = await getDonorByEmail(req.session.userEmail);
        }
        
        res.render("activeBloodCamp.ejs", { activeCamps, donorData });
    } catch (error) {
        console.error("Error rendering active blood camps:", error);
        res.status(500).send("Server error occurred");
    }
});

// Donor register into Blood camp
app.post("/activeBloodCamp", async (req, res) => {            
    try {
        // Check if user is logged in
        if (!req.session.userEmail) {
            return res.status(401).json({ success: false, message: "Please login to register for blood camp" });
        }
        
        const { campId } = req.body;
        
        // Get donor data
        const donor = await getDonorByEmail(req.session.userEmail);
        if (!donor) {
            return res.status(404).json({ success: false, message: "Donor not found" });
        }
        
        // Find the camp
        const camp = await BloodCamp.findById(campId);
        if (!camp) {
            return res.status(404).json({ success: false, message: "Blood camp not found" });
        }
        
        // Check if donor is already registered for this camp
        if (camp.donors.includes(donor.emailId)) {
            return res.status(400).json({ success: false, message: "You are already registered for this camp" });
        }
        
        // Add donor to camp's donors list
        camp.donors.push({
            donorName: donor.name,
            donorBloodType: donor.bloodType,
            donorMobileNumber: donor.mobileNumber,
            donorEmail: donor.emailId,
            hasDonated: false
        });
        await camp.save();
        
        return res.status(200).json({ success: true, message: "Successfully registered for blood camp" });
    } catch (error) {
        console.error("Error registering for blood camp:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// ===== DONOR ROUTES =====
// Registration
app.get("/donorRegister", (req, res) => {
    res.render("Donor/register.ejs");
});

app.post("/donorRegister", async (req, res) => {
    const { name, emailId, mobileNumber, countryCode, dob, bloodType, password, gender } = req.body;

    const result = await registerDonor({ 
        name, 
        emailId, 
        mobileNumber, 
        countryCode, 
        dob, 
        bloodType, 
        password,
        gender 
    });

    if (result.success) {
        res.render("Donor/login.ejs", { message: result.message });
    } else {
        res.render("Donor/register.ejs", { error: result.message });
    }
});

// Login
app.get("/donorLogin", (req, res) => {
    if (req.session.userEmail) {
        return res.redirect("/dashboard");
    }
    res.render("Donor/login.ejs", { error: "" });
});

app.post("/donorLogin", async (req, res) => {
    try {
        const { emailId, password } = req.body;
        console.log("Login attempt with:", { emailId });
        
        const loginResult = await loginDonor({ emailId, password });
        console.log("Login result:", loginResult);
        
        if (loginResult.success) {
            req.session.userEmail = emailId;
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: loginResult.message || "Invalid credentials" });
        }
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Logout
app.get("/donorLogout", (req, res) => {
    req.session.destroy();
    res.redirect("/donorLogin");
});

// Password Reset
app.get("/donorForget", (req, res) => {
    res.render("Donor/forget.ejs");
});

app.post("/donorForget/sendDonorOTP", async (req, res) => {
    try {
        const { emailId } = req.body;
        const result = await sendDonorOTP(emailId);

        return res.json(result);
    } catch (error) {
        console.error("Send OTP error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/donorForget/verifyDonorOTP", async (req, res) => {
    try {
        const { emailId, otp } = req.body;
        const result = await verifyDonorOTP(emailId, otp);
        
        return res.json(result);
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/donorForget/resetDonorPassword", async (req, res) => {
    try {
        const { emailId, newPassword } = req.body;
        const result = await resetDonorPassword(emailId, newPassword);
        
        return res.json(result);
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Dashboard
app.get("/dashboard", async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.userEmail) {
            return res.redirect("/donorLogin");
        }
        
        // Get donor data from database
        const donor = await getDonorByEmail(req.session.userEmail);
        
        if (!donor) {
            return res.redirect("/donorLogin");
        }
        
        // Calculate next eligible donation date (3 months from last donation)
        let nextEligibleDate = "Eligible Now";
        let isEligibleToday = true;
        
        if (donor.lastDonationDate) {
            const lastDonation = new Date(donor.lastDonationDate);
            const eligibleDate = new Date(lastDonation);
            eligibleDate.setMonth(eligibleDate.getMonth() + 3);
            
            // Check if current date is after or equal to eligible date
            const today = new Date();
            isEligibleToday = today >= eligibleDate;
            
            // Format date as Month Day, Year
            nextEligibleDate = eligibleDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        }
        
        // Render dashboard with donor data
        res.render("Donor/dashboard.ejs", { 
            donor: donor,
            nextEligibleDate: nextEligibleDate,
            isEligibleToday: isEligibleToday
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        res.status(500).send("Server error occurred");
    }
});
// Certificate Generation
app.get("/generateCertificate", async (req, res) => {
    try {
        // Check if user is logged in
        if (!req.session.userEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        // Get donor data
        const donor = await getDonorByEmail(req.session.userEmail);
        
        if (!donor) {
            return res.status(404).json({ success: false, message: "Donor not found" });
        }
        
        // Calculate age from date of birth
        let age = "";
        if (donor.dob) {
            const dobDate = new Date(donor.dob);
            const ageDiff = Date.now() - dobDate.getTime();
            const ageDate = new Date(ageDiff);
            age = Math.abs(ageDate.getUTCFullYear() - 1970);
        }
        
        // Generate certificate as PDF
        const pdfBuffer = await createPDF({
            name: donor.name,
            age: age,
            bloodType: donor.bloodType,
            donationCount: donor.totalDonations || 0,
            email: donor.emailId
        });
        
        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=donation-certificate-${donor.name}.pdf`);
        
        // Send the PDF
        return res.send(pdfBuffer);
        
    } catch (error) {
        console.error("Certificate generation error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// ===== BLOOD BANK ROUTES =====
// Registration
app.get("/bloodbankRegister", (req, res) => {
    res.render("BloodBank/register.ejs");
});

app.post("/bloodbankRegister", async (req, res) => {
    const { 
        city, bloodBankName, hospitalName, category, 
        contactPerson, email, contactNo, licenseNo, 
        address, pincode, password 
    } = req.body;

    try {
        const result = await registerBloodBank({ 
            city, bloodBankName, hospitalName, category, 
            contactPerson, email, contactNo, licenseNo, 
            address, pincode, password 
        });

        if (result.success) {
            return res.status(200).json({ success: true, message: result.message });
        } else {
            return res.status(400).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error("Blood Bank registration error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Login
app.get("/bloodbankLogin", (req, res) => {
    res.render("BloodBank/login.ejs");
});

app.post("/bloodbankLogin", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const loginResult = await loginBloodBank({ email, password });
        
        if (loginResult.success) {
            req.session.bloodBankEmail = email;
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: loginResult.message || "Invalid credentials" });
        }
    } catch (error) {
        console.error("Blood Bank login error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Logout
app.get("/bloodbankLogout", (req, res) => {
    req.session.destroy();
    res.redirect("/bloodbankLogin");
});

// Password Reset
app.get("/bloodbankForget", (req, res) => {
    res.render("BloodBank/forget.ejs");
});

app.post("/bloodbankForget/sendBloodBankOTP", async (req, res) => {
    try {
        const { emailId } = req.body;
        console.log(emailId);
        const result = await sendBloodBankOTP(emailId);
        
        return res.json(result);
    } catch (error) {
        console.error("Blood Bank Send OTP error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/bloodbankForget/verifyBloodBankOTP", async (req, res) => {
    try {
        const { emailId, otp } = req.body;
        const result = await verifyBloodBankOTP(emailId, otp);
        
        return res.json(result);
    } catch (error) {
        console.error("Blood Bank Verify OTP error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/bloodbankForget/resetBloodBankPassword", async (req, res) => {
    try {
        const { emailId, newPassword } = req.body;
        const result = await resetBloodBankPassword(emailId, newPassword);
        
        return res.json(result);
    } catch (error) {
        console.error("Blood Bank Reset password error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Dashboard and Camp Management
app.get("/bloodbankDashboard", async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.redirect("/bloodbankLogin");
        }
        
        // Get blood bank data from database
        const bloodBank = await getBloodBankByEmail(req.session.bloodBankEmail);
        
        if (!bloodBank) {
            return res.redirect("/bloodbankLogin");
        }
        
        // Get pending blood camp requests for this blood bank
        const bloodCamps = await getPendingBloodCamps(bloodBank.bloodBankName);
        
        // Get approved blood camps for this blood bank
        const approvedCamps = await getApprovedBloodCamps(bloodBank.bloodBankName);
        // Render dashboard with blood bank data, pending camp requests, and approved camps
        res.render("BloodBank/dashboard.ejs", { 
            bloodBank: bloodBank,
            bloodCamps: bloodCamps,
            approvedCamps: approvedCamps
        });
    } catch (error) {
        console.error("Blood Bank dashboard error:", error);
        res.status(500).send("Server error occurred");
    }
});

// New route to mark a donor as having donated
app.post("/markDonated", async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { donorEmail, campId } = req.body;

        // Call the database function to mark the donor as having donated
        const result = await markDonorDonated(donorEmail, campId);
        
        return res.json(result);
    } catch (error) {
        console.error("Mark donated error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/approveCamp", async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { campId } = req.body;
        
        // Call the database function to approve the camp
        const result = await approveBloodCamp(campId);
        
        return res.json(result);
    } catch (error) {
        console.error("Camp approval error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/rejectCamp", async (req, res) => {
    try {
        // Check if blood bank is logged in
        if (!req.session.bloodBankEmail) {
            return res.status(401).json({ success: false, message: "Not logged in" });
        }
        
        const { campId } = req.body;
        
        // Call the database function to reject the camp
        const result = await rejectBloodCamp(campId);
        
        return res.json(result);
    } catch (error) {
        console.error("Camp rejection error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// ===== ADMIN ROUTES =====
// Login
app.get("/admin/login", (req, res) => {
    // If already logged in, redirect to dashboard
    if (req.session.adminEmail) {
        return res.redirect("/admin/dashboard");
    }
    res.render("Admin/login.ejs", { error: "" });
});

app.post("/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const loginResult = await loginAdmin({ email, password });
        
        if (loginResult.success) {
            // Store admin email in session
            req.session.adminEmail = email;
            req.session.isAdmin = true;
            return res.json({ success: true });
        } else {
            return res.json({ success: false, message: loginResult.message || "Invalid credentials" });
        }
    } catch (error) {
        console.error("Admin login error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

// Logout
app.get("/admin/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/admin/login");
});

// Dashboard
app.get("/admin/dashboard", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        // Get admin data from database
        const admin = await getAdminByEmail(req.session.adminEmail);
        
        if (!admin) {
            req.session.destroy();
            return res.redirect("/admin/login");
        }
        
        // Get stats for dashboard
        const stats = await getAdminStats();
        
        // Get paginated donors
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 10;
        
        const donors = await Donor.find()
            .sort({ name: 1 })
            .skip((page - 1) * itemsPerPage)
            .limit(itemsPerPage);
            
        const totalDonors = await Donor.countDocuments();
        
        // Get paginated blood camps
        const campPage = parseInt(req.query.campPage) || 1;
        
        const bloodCamps = await BloodCamp.find({ approved: true })
            .sort({ date: -1 })
            .skip((campPage - 1) * itemsPerPage)
            .limit(itemsPerPage);
            
        const totalCamps = await BloodCamp.countDocuments({ approved: true });
        
        // Get paginated blood banks
        const bankPage = parseInt(req.query.bankPage) || 1;
        
        const bloodBanks = await BloodBank.find()
            .sort({ bloodBankName: 1 })
            .skip((bankPage - 1) * itemsPerPage)
            .limit(itemsPerPage);
            
        const totalBanks = await BloodBank.countDocuments();
        
        // Get list of cities for filtering
        const cities = await BloodBank.distinct('city');
        
        // Format donors for display
        const formattedDonors = donors.map(donor => ({
            _id: donor._id,
            name: donor.name,
            contact: donor.mobileNumber,
            bloodType: donor.bloodType,
            lastDonationDate: donor.lastDonationDate,
            totalDonations: donor.totalDonations || 0
        }));
        
        // Render admin dashboard
        res.render("Admin/dashboard.ejs", {
            admin,
            stats,
            users: formattedDonors,
            camps: bloodCamps,
            banks: bloodBanks,
            cities,
            currentPage: {
                users: page,
                camps: campPage,
                banks: bankPage
            },
            nextPage: {
                users: page + 1,
                camps: campPage + 1,
                banks: bankPage + 1
            },
            totalItems: {
                users: totalDonors,
                camps: totalCamps,
                banks: totalBanks
            },
            hasMore: {
                users: (page * itemsPerPage) < totalDonors,
                camps: (campPage * itemsPerPage) < totalCamps,
                banks: (bankPage * itemsPerPage) < totalBanks
            },
            itemsPerPage,
            // Helper functions for the template
            formatDate: (date) => {
                return new Date(date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            },
            getBloodTypeColor: (bloodType) => {
                const colors = {
                    'A+': '#e74c3c',
                    'A-': '#c0392b',
                    'B+': '#3498db',
                    'B-': '#2980b9',
                    'AB+': '#9b59b6',
                    'AB-': '#8e44ad',
                    'O+': '#2ecc71',
                    'O-': '#27ae60'
                };
                return colors[bloodType] || '#95a5a6';
            },
            isCampUpcoming: (date) => {
                return new Date(date) > new Date();
            },
            isCampOngoing: (date, startTime, endTime) => {
                const today = new Date();
                const campDate = new Date(date);
                
                if (today.toDateString() !== campDate.toDateString()) return false;
                
                const now = today.getHours() * 60 + today.getMinutes();
                const [startHour, startMinute] = startTime.split(':').map(Number);
                const [endHour, endMinute] = endTime.split(':').map(Number);
                
                const start = startHour * 60 + startMinute;
                const end = endHour * 60 + endMinute;
                
                return now >= start && now <= end;
            }
        });
        
    } catch (error) {
        console.error("Admin dashboard error:", error);
        res.status(500).send("Server error occurred");
    }
});

// Admin Data Management
app.get("/admin/user/delete/:id", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        const userId = req.params.id;
        
        await Donor.findByIdAndDelete(userId);
        
        // Redirect back to dashboard
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).send("Server error occurred");
    }
});

app.get("/admin/camp/delete/:id", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        const campId = req.params.id;
        
        await BloodCamp.findByIdAndDelete(campId);
        
        // Redirect back to dashboard
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Delete camp error:", error);
        res.status(500).send("Server error occurred");
    }
});

app.get("/admin/bank/delete/:id", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        const bankId = req.params.id;
        
        await BloodBank.findByIdAndDelete(bankId);
        
        // Redirect back to dashboard
        res.redirect("/admin/dashboard");
    } catch (error) {
        console.error("Delete blood bank error:", error);
        res.status(500).send("Server error occurred");
    }
});

// Export Users Excel
app.get("/admin/users/export", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        // Get all donors
        const donors = await Donor.find().sort({ name: 1 });
        
        // Create a new Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Registered Users');
        
        // Add headers
        worksheet.columns = [
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Contact', key: 'contact', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Blood Type', key: 'bloodType', width: 12 },
            { header: 'Last Donation Date', key: 'lastDonationDate', width: 20 },
            { header: 'Total Donations', key: 'totalDonations', width: 15 },
            { header: 'Registration Date', key: 'registrationDate', width: 20 }
        ];
        
        // Format header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Add data rows
        donors.forEach(donor => {
            worksheet.addRow({
                name: donor.name,
                contact: donor.mobileNumber,
                email: donor.emailId,
                bloodType: donor.bloodType,
                lastDonationDate: donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : 'Never',
                totalDonations: donor.totalDonations || 0,
                registrationDate: new Date(donor.createdAt).toLocaleDateString()
            });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=LifebloX_Users_' + new Date().toISOString().split('T')[0] + '.xlsx');
        
        // Stream the workbook to the response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Excel export error:", error);
        res.status(500).send("Server error occurred");
    }
});

// Export Blood Camps Excel
app.get("/admin/camps/export", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        // Get all approved blood camps
        const bloodCamps = await BloodCamp.find({ approved: true }).sort({ date: -1 });
        
        // Create a new Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Blood Camps');
        
        // Add headers
        worksheet.columns = [
            { header: 'Camp Name', key: 'campName', width: 30 },
            { header: 'Location', key: 'location', width: 30 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Blood Bank', key: 'bloodBank', width: 25 },
            { header: 'Contact', key: 'contact', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'Status', key: 'status', width: 12 }
        ];
        
        // Format header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Helper function to determine camp status
        const getCampStatus = (date, startTime, endTime) => {
            const today = new Date();
            const campDate = new Date(date);
            
            if (campDate > today) return 'Upcoming';
            
            if (today.toDateString() === campDate.toDateString()) {
                const now = today.getHours() * 60 + today.getMinutes();
                const [startHour, startMinute] = startTime.split(':').map(Number);
                const [endHour, endMinute] = endTime.split(':').map(Number);
                
                const start = startHour * 60 + startMinute;
                const end = endHour * 60 + endMinute;
                
                if (now >= start && now <= end) return 'Ongoing';
            }
            
            return 'Completed';
        };
        
        // Add data rows
        bloodCamps.forEach(camp => {
            worksheet.addRow({
                campName: camp.campName,
                location: camp.location,
                city: camp.city,
                date: new Date(camp.date).toLocaleDateString(),
                time: `${camp.startTime} - ${camp.endTime}`,
                bloodBank: camp.bloodBank,
                contact: camp.contactNumber,
                email: camp.email,
                status: getCampStatus(camp.date, camp.startTime, camp.endTime)
            });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=LifebloX_BloodCamps_' + new Date().toISOString().split('T')[0] + '.xlsx');
        
        // Stream the workbook to the response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Excel export error:", error);
        res.status(500).send("Server error occurred");
    }
});

// Export Blood Banks Excel
app.get("/admin/banks/export", async (req, res) => {
    try {
        // Check if admin is logged in
        if (!req.session.adminEmail || !req.session.isAdmin) {
            return res.redirect("/admin/login");
        }
        
        // Get all blood banks
        const bloodBanks = await BloodBank.find().sort({ bloodBankName: 1 });
        
        // Create a new Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Blood Banks');
        
        // Add headers
        worksheet.columns = [
            { header: 'Blood Bank Name', key: 'bloodBankName', width: 30 },
            { header: 'Address', key: 'address', width: 35 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Category', key: 'category', width: 12 },
            { header: 'Contact Person', key: 'contactPerson', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Available Units', key: 'availableUnits', width: 15 },
            { header: 'Registration Date', key: 'registrationDate', width: 20 }
        ];
        
        // Format header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Add data rows
        bloodBanks.forEach(bank => {
            worksheet.addRow({
                bloodBankName: bank.bloodBankName,
                address: bank.address,
                city: bank.city,
                category: bank.category || 'Not specified',
                contactPerson: bank.contactPerson,
                phone: bank.contactNo,
                email: bank.email,
                availableUnits: bank.availableUnits || 'Not reported',
                registrationDate: bank.createdAt ? new Date(bank.createdAt).toLocaleDateString() : 'Unknown'
            });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=LifebloX_BloodBanks_' + new Date().toISOString().split('T')[0] + '.xlsx');
        
        // Stream the workbook to the response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Excel export error:", error);
        res.status(500).send("Server error occurred");
    }
});

// ===== BLOOD STOCK MANAGEMENT ROUTES =====

// Add new blood stock
app.post("/addBloodStock", async (req, res) => {
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
});

// Update blood stock
app.post("/updateBloodStock", async (req, res) => {
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
});

// Delete blood stock
app.post("/deleteBloodStock", async (req, res) => {
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
});
app.get('/bloodAvailability', (req, res) => {
    res.render("./BloodBank/bloodAvailability.ejs");
});

// Get blood availability
app.get("/api/bloodAvailability", async (req, res) => {
    try {
        const { bloodComponent, bloodType, city } = req.query;
        
        // Build the filter query based on provided parameters
        const filterQuery = {};
        
        // Add blood component filter if provided
        if (bloodComponent) {
            filterQuery["detailedBloodStock.bloodComponent"] = bloodComponent;
        }
        
        // Add blood type filter if provided
        if (bloodType) {
            filterQuery["detailedBloodStock.bloodType"] = bloodType;
        }
        
        // Add city filter if provided
        if (city) {
            filterQuery.city = city;
        }
        
        // Get all blood banks that match the criteria
        const bloodBanks = await BloodBank.find(filterQuery).select('-password');
        
        // Process the results to match the expected format
        const results = bloodBanks.map(bloodBank => {
            // Filter the detailedBloodStock array based on the search criteria
            const matchingStock = bloodBank.detailedBloodStock.filter(stock => {
                const componentMatch = !bloodComponent || stock.bloodComponent === bloodComponent;
                const bloodTypeMatch = !bloodType || stock.bloodType === bloodType;
                const cityMatch = !city || bloodBank.city === city;
                
                // Only include stocks with units > 0 and not expired
                return componentMatch && bloodTypeMatch && cityMatch && stock.units > 0 && new Date(stock.expiryDate) > new Date();
            });
            
            // Only include blood banks that have matching stock
            if (matchingStock.length > 0) {
                return {
                    bloodBank: {
                        bloodBankName: bloodBank.bloodBankName,
                        hospitalName: bloodBank.hospitalName,
                        city: bloodBank.city,
                        contactNo: bloodBank.contactNo,
                        email: bloodBank.email,
                        address: bloodBank.address
                    },
                    matchingStock: matchingStock
                };
            }
            return null;
        }).filter(result => result !== null);
        
        return res.json({ success: true, results });
    } catch (error) {
        console.error("Blood availability search error:", error);
        return res.status(500).json({ success: false, message: "Server error occurred" });
    }
});

app.post("/addBloodStock", addBloodStock);
app.post("/updateBloodStock", updateBloodStock);
app.post("/deleteBloodStock", deleteBloodStock);
app.get("/api/bloodAvailability", getBloodAvailability);
// Start the server
app.listen(port, () => {
    console.log('Server running on port ' + port);
});