import { Payout, Wallet, WalletTransaction } from '../models/Schemas.js';
import mongoose from 'mongoose';
import { sendPushNotification, sendEmail } from './ExternalServices.js';

export interface PayoutRequest {
  payoutId: string;
  amount: number;
  method: 'BANK' | 'UPI';
  destinationDetails: {
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
}

export interface PayoutResponse {
  success: boolean;
  gatewayReferenceId?: string;
  error?: string;
}

export interface PaymentProvider {
  processPayout(request: PayoutRequest): Promise<PayoutResponse>;
  checkStatus(gatewayReferenceId: string): Promise<any>;
}

// ─── RAZORPAY ADAPTER ──────────────────────────────────────────────────────────
export class RazorpayProvider implements PaymentProvider {
  async processPayout(request: PayoutRequest): Promise<PayoutResponse> {
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

  async checkStatus(gatewayReferenceId: string): Promise<any> {
    return { status: 'processed' };
  }
}

// ─── CASHFREE ADAPTER ─────────────────────────────────────────────────────────
export class CashfreeProvider implements PaymentProvider {
  async processPayout(request: PayoutRequest): Promise<PayoutResponse> {
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

  async checkStatus(gatewayReferenceId: string): Promise<any> {
    return { status: 'SUCCESS' };
  }
}

// ─── PAYMENT SERVICE ──────────────────────────────────────────────────────────
export class PaymentService {
  private provider: PaymentProvider;

  constructor(provider: PaymentProvider) {
    this.provider = provider;
  }

  public async executePayout(payoutId: string) {
    const payout = await Payout.findById(payoutId).populate('user');
    if (!payout) throw new Error('Payout not found');

    if (payout.status !== 'Pending') {
      throw new Error(`Cannot process payout in ${payout.status} state`);
    }

    payout.status = 'Processing';
    await payout.save();

    const request: PayoutRequest = {
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
        const wallet = await Wallet.findOne({ user: (payout.user as any)._id });
        if (wallet) {
          // Update Wallet Ledger (balance was already deducted on request)
          if (wallet.pendingRewards >= payout.amount) wallet.pendingRewards -= payout.amount;
          wallet.totalPaid = (wallet.totalPaid || 0) + payout.amount;
          await wallet.save();

          // Update Transaction History
          await WalletTransaction.findOneAndUpdate(
            { referenceId: payout._id.toString() },
            { 
              status: 'completed',
              description: `Reward Payout via ${payout.method}`,
            }
          );

          // Create Invoice
          await mongoose.model('Invoice').create({
            user: (payout.user as any)._id,
            payout: payout._id,
            invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: payout.amount,
            date: new Date()
          });

          // Create Notification
          await mongoose.model('Notification').create({
            user: (payout.user as any)._id,
            title: 'Payout Approved! 💸',
            message: `Your withdrawal of \u20B9${payout.amount} has been approved and processed.`,
            type: 'wallet',
            read: false,
            timestamp: new Date()
          });

          // Send push notification
          try {
            const profile = await mongoose.model('Profile').findOne({ user: (payout.user as any)._id });
            const token = (profile as any)?.expoPushToken || (profile as any)?.pushToken || 'ExponentPushToken[mock]';
            await sendPushNotification(token, 'Payout Approved! 💸', `Your withdrawal of \u20B9${payout.amount} has been approved.`);
          } catch (e) {
            console.error('Failed to send payout push notification:', e);
          }

          // Send email
          try {
            const userEmail = (payout.user as any).email;
            if (userEmail) {
              await sendEmail(
                userEmail,
                'Payout Processed - ReLoop',
                `<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #10B981;">Withdrawal Request Approved</h2>
                  <p>Hi ${(payout.user as any).name || 'User'},</p>
                  <p>Your withdrawal request of <b>\u20B9${payout.amount}</b> has been successfully approved and transferred.</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <small style="color: #999;">ReLoop AI System</small>
                </div>`
              );
            }
          } catch (e) {
            console.error('Failed to send payout email:', e);
          }

          // Emit live Socket.IO update
          if ((global as any).io) {
            (global as any).io.emit('WALLET_UPDATE', { userId: (payout.user as any)._id });
            (global as any).io.emit('NEW_NOTIFICATION', { userId: (payout.user as any)._id });
          }
        }
      } else {
        payout.status = 'Failed';
        payout.failureReason = response.error || 'Gateway rejected the payout';
        await payout.save();
      }
      return payout;
    } catch (error: any) {
      payout.status = 'Failed';
      payout.failureReason = error.message;
      await payout.save();
      throw error;
    }
  }
}

// Default export uses Razorpay as active provider
export const paymentService = new PaymentService(new RazorpayProvider());
