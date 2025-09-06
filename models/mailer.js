import nodemailer from "nodemailer";
import dotenv from 'dotenv';
dotenv.config();

// Configure nodemailer
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});