// certificateGenerator.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import crypto from 'crypto';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createPDF = async (donorData) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { name, age, bloodType, donationCount, email } = donorData;
            
            // Create a PDF document
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50,
                layout: 'landscape'
            });
            
            // Create a buffer to store the PDF
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            // Create certificate ID
            const certificateID = generateCertificateID();
            
            // Generate QR code with certificate verification info
            const qrCodeDataURL = await generateQRCode(`${certificateID}|${email}|${name}`);
            
            // Add background pattern
            createCertificateBackground(doc);
            
            // Add logo (assuming you have a logo.png in your public directory)
            try {
                const logoPath = path.join(__dirname, 'public', 'images/logo.png');
                if (fs.existsSync(logoPath)) {
                    doc.image(logoPath, 347, 42, { width: 100 });
                } else {
                    // Create a text logo if image doesn't exist
                    doc.fontSize(30)
                       .fillColor('#8B0000')
                       .font('Helvetica-Bold')
                       .text('LifebloX', 50, 45);
                }
            } catch (err) {
                // Fallback to text logo
                doc.fontSize(30)
                   .fillColor('#8B0000')
                   .font('Helvetica-Bold')
                   .text('LifebloX', 50, 45);
            }
            
            // Add certificate title with decorative underline
            doc.fontSize(32)
               .fillColor('#000080')
               .font('Helvetica-Bold')
               .text('CERTIFICATE OF BLOOD DONATION', 0, 80, { align: 'center' });
               
            // Add decorative line under title
            doc.strokeColor('#8B0000')
               .lineWidth(2)
               .moveTo(150, 120)
               .lineTo(doc.page.width - 150, 120)
               .stroke();
            
            // Add decorative border
            doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
               .lineWidth(3)
               .strokeColor('#8B0000')
               .stroke();
               
            // Add inner border with different color
            doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
               .lineWidth(1)
               .strokeColor('#000080')
               .dash(5, { space: 10 })
               .stroke();
            
            // Add certificate content
            doc.fontSize(16)
               .fillColor('#000')
               .font('Times-Roman')
               .moveDown(3)
               .text(`This is to certify that`, { align: 'center' })
               .moveDown(0.5);
               
            doc.fontSize(28)
               .font('Times-Bold')
               .text(`${name}`, { align: 'center' })
               .moveDown(0.5);
               
            doc.fontSize(16)
               .font('Times-Roman')
               .text(`Age: ${age} years | Blood Type: ${bloodType}`, { align: 'center' })
               .moveDown(1)
               .text(`has generously donated blood ${donationCount} time(s)`, { align: 'center' })
               .moveDown(0.5)
               .text(`and has contributed to saving lives through their selfless act of donation.`, { align: 'center' })
               .moveDown(0.5)
               .text(`This noble gesture can help save up to 3 lives with each donation.`, { align: 'center' })
               .moveDown(2);
            
            // Add date
            const currentDate = new Date();
            const formattedDate = currentDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            doc.text(`Date of Issuance: ${formattedDate}`, { align: 'center' })
               .moveDown(2);
            
            
            
            // Add QR code image
            if (qrCodeDataURL) {
                doc.image(qrCodeDataURL, 50, doc.page.height - 130, { width: 80 });
            }
            
            // Add certificate ID and verification info
            doc.fontSize(10)
               .text(`Scan QR code to verify authenticity`, 140, doc.page.height - 80);
            
            // Add footer
            doc.fontSize(8)
               .fillColor('#666')
               .text('© LifebloX Blood Donation Center ' + new Date().getFullYear(), -380, doc.page.height-70, { align: 'center' });
                           // Function to draw a circular stamp
        

            const stampImgPath = path.join(__dirname, 'public', 'images/stampImage.png');
            doc.image(stampImgPath, 650, doc.page.height - 180, { width: 120 });

            
            // Finalize the PDF
            doc.end();
            
        } catch (error) {
            console.error("Error creating PDF:", error);
            reject(error);
        }
    });
};

// Helper function to generate a unique certificate ID
function generateCertificateID() {
    const timestamp = Date.now().toString();
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const hash = crypto.createHash('md5').update(`${timestamp}-${randomPart}`).digest('hex').substring(0, 6).toUpperCase();
    return `LBX-${timestamp.slice(-6)}-${randomPart}-${hash}`;
}


// Helper function to generate QR code
async function generateQRCode(text) {
    try {
        return await QRCode.toDataURL(text, {
            errorCorrectionLevel: 'H',
            margin: 1,
            width: 150
        });
    } catch (err) {
        console.error("QR Code generation error:", err);
        return null;
    }
}

// Function to create background pattern
function createCertificateBackground(doc) {
    // Add light background color
    doc.rect(0, 0, doc.page.width, doc.page.height)
       .fillColor('#f9f9f9')
       .fill();
       
    // Add subtle pattern
    const patternSpacing = 40;
    doc.fillColor('#f0f0f0');
    
    for (let x = 0; x < doc.page.width; x += patternSpacing) {
        for (let y = 0; y < doc.page.height; y += patternSpacing) {
            doc.circle(x, y, 1).fill();
        }
    }
    
    // Add watermark
    doc.save()
       .rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] })
       .fontSize(60)
       .fillColor('rgba(200, 0, 0, 0.1)')
       .text('LIFEBLOX', doc.page.width / 2 - 150, doc.page.height / 2 - 30)
       .restore();
}

// Function to draw a signature
function drawSignature(doc, x, y) {
    doc.save();
    
    // Create a signature-like drawing above the line
    const startX = x - 40;
    const startY = y;
    
    doc.moveTo(startX, startY)
       .bezierCurveTo(
            startX + 20, startY - 10,
            startX + 40, startY + 10,
            startX + 60, startY - 5
       )
       .bezierCurveTo(
            startX + 70, startY - 10,
            startX + 80, startY + 5,
            startX + 90, startY - 2
       )
       .strokeColor('#000')
       .lineWidth(1)
       .stroke();
       
    doc.restore();
}