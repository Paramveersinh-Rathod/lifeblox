import nodemailer from "nodemailer";

// Configure nodemailer
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "lifeblox.healthcare@gmail.com", // Replace with your Gmail
        pass: "exaljwydmyfakikg" // Use app password for Gmail
    }
});