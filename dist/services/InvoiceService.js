import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
export class InvoiceService {
    /**
     * Generates a PDF invoice and saves it to a local temporary path or uploads to Cloudinary.
     * Returns the URL or local path.
     */
    async generateInvoicePDF(invoice, user, payout) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const fileName = `invoice_${invoice.invoiceNumber}.pdf`;
                const tempPath = path.join(process.cwd(), 'temp', fileName);
                // Ensure temp directory exists
                if (!fs.existsSync(path.join(process.cwd(), 'temp'))) {
                    fs.mkdirSync(path.join(process.cwd(), 'temp'));
                }
                const writeStream = fs.createWriteStream(tempPath);
                doc.pipe(writeStream);
                // Header
                doc.fontSize(20).text('ReLoop', { align: 'right' });
                doc.fontSize(10).text('Waste to Wealth', { align: 'right' });
                doc.moveDown();
                doc.fontSize(20).text('Reward Invoice', { align: 'left' });
                doc.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`);
                doc.text(`Date: ${invoice.date.toDateString()}`);
                doc.moveDown();
                // User Details
                doc.fontSize(12).text('Billed To:');
                doc.fontSize(10).text(`Name: ${user.name || user.email}`);
                doc.text(`Email: ${user.email}`);
                if (payout.method === 'UPI') {
                    doc.text(`UPI ID: ${payout.destinationDetails?.upiId}`);
                }
                else {
                    doc.text(`Account No: ${payout.destinationDetails?.accountNumber}`);
                }
                doc.moveDown();
                // Transaction Details
                doc.fontSize(12).text('Transaction Details:');
                doc.fontSize(10).text(`Payout Reference: ${payout.gatewayReferenceId || 'N/A'}`);
                doc.text(`Method: ${payout.method}`);
                doc.text(`Status: ${payout.status}`);
                doc.moveDown();
                // Amount Box
                doc.rect(50, doc.y, 500, 30).fillAndStroke('#f3f4f6', '#d1d5db');
                doc.fillColor('#000').text('Total Reward Paid', 60, doc.y - 20);
                doc.text(`INR ${invoice.amount.toFixed(2)}`, 450, doc.y - 20);
                doc.moveDown(2);
                // Footer
                doc.fontSize(10).fillColor('#6b7280').text('Thank you for recycling with ReLoop!', { align: 'center' });
                doc.text('This is a computer-generated invoice and does not require a physical signature.', { align: 'center' });
                doc.end();
                writeStream.on('finish', () => {
                    // In production, upload this PDF to Cloudinary/S3 and return the URL
                    // For now, return the mock URL format
                    resolve(`https://api.reloop.com/invoices/${fileName}`);
                });
                writeStream.on('error', (err) => {
                    reject(err);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
export const invoiceService = new InvoiceService();
