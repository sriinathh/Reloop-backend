import { Payout, Wallet, WalletTransaction } from '../models/Schemas.js';
import mongoose from 'mongoose';

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
        const wallet = await Wallet.findOne({ user: payout.user._id });
        if (wallet) {
          wallet.balance -= payout.amount;
          wallet.pendingRewards -= payout.amount;
          wallet.totalPaid += payout.amount;
          await wallet.save();

          // Create Transaction History
          await WalletTransaction.create({
            wallet: wallet._id,
            user: payout.user._id,
            type: 'withdrawal',
            amount: payout.amount,
            status: 'completed',
            description: `Reward Payout via ${payout.method}`,
            referenceId: response.gatewayReferenceId,
            date: new Date()
          });

          // Create Invoice
          await mongoose.model('Invoice').create({
            user: payout.user._id,
            payout: payout._id,
            invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            amount: payout.amount,
            date: new Date()
          });
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
