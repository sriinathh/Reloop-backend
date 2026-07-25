import { Payout, Wallet, WalletTransaction } from '../models/Schemas.js';
import mongoose from 'mongoose';
import { sendPushNotification, sendEmail } from './ExternalServices.js';
// ─── RAZORPAY ADAPTER ──────────────────────────────────────────────────────────
export class RazorpayProvider {
    async processPayout(request) {
        console.log(`[Razorpay] Processing payout ${request.payoutId} for ₹${request.amount}`);
        // Sandbox / Mock implementation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    gatewayReferenceId: `rzp_payout_${Math.random().toString(36).substr(2, 9)}`
                });
            }, 1000);
        });
    }
    async checkStatus(gatewayReferenceId) {
        return { status: 'processed' };
    }
}
// ─── CASHFREE ADAPTER ─────────────────────────────────────────────────────────
export class CashfreeProvider {
    async processPayout(request) {
        console.log(`[Cashfree] Processing payout ${request.payoutId} for ₹${request.amount}`);
        // Sandbox / Mock implementation
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    success: true,
                    gatewayReferenceId: `cf_payout_${Math.random().toString(36).substr(2, 9)}`
                });
            }, 1000);
        });
    }
    async checkStatus(gatewayReferenceId) {
        return { status: 'SUCCESS' };
    }
}
// ─── PAYMENT SERVICE ──────────────────────────────────────────────────────────
export class PaymentService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async executePayout(payoutId) {
        const payout = await Payout.findById(payoutId).populate('user');
        if (!payout)
            throw new Error('Payout not found');
        if (payout.status !== 'Pending') {
            throw new Error(`Cannot process payout in ${payout.status} state`);
        }
        payout.status = 'Processing';
        await payout.save();
        const request = {
            payoutId: payout._id.toString(),
            amount: payout.amount,
            method: payout.method,
            destinationDetails: payout.destinationDetails
        };
        try {
            const response = await this.provider.processPayout(request);
            if (response.success && response.gatewayReferenceId) {
                payout.status = 'Completed';
                payout.gatewayReferenceId = response.gatewayReferenceId;
                payout.processedAt = new Date();
                await payout.save();
                // Update Wallet Ledger
                const wallet = await Wallet.findOne({ user: payout.user._id });
                if (wallet) {
                    // Update Wallet Ledger (balance was already deducted on request)
                    if (wallet.pendingRewards >= payout.amount)
                        wallet.pendingRewards -= payout.amount;
                    wallet.totalPaid = (wallet.totalPaid || 0) + payout.amount;
                    await wallet.save();
                    // Update Transaction History
                    await WalletTransaction.findOneAndUpdate({ referenceId: payout._id.toString() }, {
                        status: 'completed',
                        description: `Reward Payout via ${payout.method}`,
                    });
                    // Create Invoice
                    await mongoose.model('Invoice').create({
                        user: payout.user._id,
                        payout: payout._id,
                        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        amount: payout.amount,
                        date: new Date()
                    });
                    // Create Notification
                    await mongoose.model('Notification').create({
                        user: payout.user._id,
                        title: 'Payout Approved! 💸',
                        message: `Your withdrawal of \u20B9${payout.amount} has been approved and processed.`,
                        type: 'wallet',
                        read: false,
                        timestamp: new Date()
                    });
                    // Send push notification
                    try {
                        const profile = await mongoose.model('Profile').findOne({ user: payout.user._id });
                        const token = profile?.expoPushToken || profile?.pushToken || 'ExponentPushToken[mock]';
                        await sendPushNotification(token, 'Payout Approved! 💸', `Your withdrawal of \u20B9${payout.amount} has been approved.`);
                    }
                    catch (e) {
                        console.error('Failed to send payout push notification:', e);
                    }
                    // Send email
                    try {
                        const userEmail = payout.user.email;
                        if (userEmail) {
                            await sendEmail(userEmail, 'Payout Processed - ReLoop', `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #10B981;">Withdrawal Request Approved</h2>
                  <p>Hi ${payout.user.name || 'User'},</p>
                  <p>Your withdrawal request of <b>\u20B9${payout.amount}</b> has been successfully approved and transferred.</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <small style="color: #999;">ReLoop AI System</small>
                </div>`);
                        }
                    }
                    catch (e) {
                        console.error('Failed to send payout email:', e);
                    }
                    // Emit live Socket.IO update
                    if (global.io) {
                        global.io.emit('WALLET_UPDATE', { userId: payout.user._id });
                        global.io.emit('NEW_NOTIFICATION', { userId: payout.user._id });
                    }
                }
            }
            else {
                payout.status = 'Failed';
                payout.failureReason = response.error || 'Gateway rejected the payout';
                await payout.save();
            }
            return payout;
        }
        catch (error) {
            payout.status = 'Failed';
            payout.failureReason = error.message;
            await payout.save();
            throw error;
        }
    }
}
// Default export uses Razorpay as active provider
export const paymentService = new PaymentService(new RazorpayProvider());
