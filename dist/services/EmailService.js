import { Resend } from 'resend';
// Provide a mock/default key if not in env to prevent crashing during development
const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
export class EmailService {
    async sendRewardCreditedEmail(email, name, amount, invoiceUrl) {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[Email Mock] Sending Reward Credited Email to ${email} for ₹${amount}`);
            return;
        }
        try {
            await resend.emails.send({
                from: 'ReLoop Rewards <rewards@reloop.com>',
                to: email,
                subject: `₹${amount} Reward Credited to Your Account!`,
                html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #10B981;">Congratulations ${name}!</h2>
            <p>Your recycling efforts have paid off. We have successfully credited <strong>₹${amount}</strong> to your account.</p>
            ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="color: #10B981;">Download your Invoice</a></p>` : ''}
            <p>Keep recycling and saving the planet!</p>
            <p>Best,<br/>ReLoop Team</p>
          </div>
        `
            });
        }
        catch (error) {
            console.error('Failed to send reward email:', error);
        }
    }
    async sendPaymentFailedEmail(email, name, amount, reason) {
        if (!process.env.RESEND_API_KEY) {
            console.log(`[Email Mock] Sending Payment Failed Email to ${email} for ₹${amount}`);
            return;
        }
        try {
            await resend.emails.send({
                from: 'ReLoop Support <support@reloop.com>',
                to: email,
                subject: `Update on your ₹${amount} Reward Payout`,
                html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #EF4444;">Hello ${name},</h2>
            <p>We attempted to process your reward payout of <strong>₹${amount}</strong>, but it failed due to the following reason:</p>
            <blockquote style="border-left: 4px solid #EF4444; padding-left: 10px; color: #666;">${reason}</blockquote>
            <p>Please update your bank/UPI details in the app and we will retry the payment automatically.</p>
            <p>Best,<br/>ReLoop Team</p>
          </div>
        `
            });
        }
        catch (error) {
            console.error('Failed to send payment failed email:', error);
        }
    }
}
export const emailService = new EmailService();
