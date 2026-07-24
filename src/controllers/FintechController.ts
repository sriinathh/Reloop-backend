import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { 
  Wallet, WalletTransaction, Payout, Reward, Campaign, Invoice, User
} from '../models/Schemas.js';
import { paymentService } from '../services/PaymentService.js';
import { invoiceService } from '../services/InvoiceService.js';
import { emailService } from '../services/EmailService.js';

interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// ─── USER WALLET & TRANSACTIONS ──────────────────────────────────────────────

export const getWalletHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = await Wallet.create({ user: userId });
    }

    res.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        totalRewardsEarned: wallet.totalRewardsEarned,
        pendingRewards: wallet.pendingRewards,
        totalPaid: wallet.totalPaid,
        ecoPoints: wallet.ecoPoints,
        preferredPayoutMethod: wallet.preferredPayoutMethod
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const saveBankDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { upi_id, bank_name, account_holder_name, account_number, ifsc_code } = req.body;
    
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId });
    }

    if (upi_id) wallet.upiId = upi_id;
    if (bank_name) wallet.bankName = bank_name;
    if (account_holder_name) wallet.accountHolderName = account_holder_name;
    if (account_number) wallet.accountNumber = account_number;
    if (ifsc_code) wallet.ifscCode = ifsc_code;

    // Auto-set preferred method if adding one exclusively
    if (upi_id && !account_number) wallet.preferredPayoutMethod = 'UPI';
    if (account_number && !upi_id) wallet.preferredPayoutMethod = 'BANK';

    await wallet.save();
    res.json({ success: true, message: 'Bank details saved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const transactions = await WalletTransaction.find({ user: userId }).sort({ date: -1 });
    res.json({ success: true, transactions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getInvoices = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const invoices = await Invoice.find({ user: userId }).sort({ date: -1 });
    res.json({ success: true, invoices });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const requestPayout = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { amount, method } = req.body;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    if (!wallet.accountNumber && !wallet.upiId) {
      return res.status(400).json({ success: false, message: 'No bank or UPI details found. Please update your profile.' });
    }

    const payout = await Payout.create({
      user: userId,
      amount,
      method: method || wallet.preferredPayoutMethod || 'BANK',
      destinationDetails: {
        accountNumber: wallet.accountNumber,
        ifscCode: wallet.ifscCode,
        upiId: wallet.upiId
      }
    });

    res.json({ success: true, message: 'Payout requested successfully', payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── COMPANY CAMPAIGNS ────────────────────────────────────────────────────────

export const companyCreateCampaign = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, totalBudget, rewardPerKg, startDate, endDate, companyId } = req.body;
    
    const campaign = await Campaign.create({
      company: companyId || new mongoose.Types.ObjectId(), 
      title,
      description,
      totalBudget,
      remainingBudget: totalBudget,
      rewardPerKg,
      startDate,
      endDate,
      status: 'Active'
    });

    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const companyGetCampaigns = async (req: AuthRequest, res: Response) => {
  try {
    const campaigns = await Campaign.find().populate('company').lean();
    
    // Join with Profiles to get Company Name
    const companyIds = campaigns.map((c: any) => c.company?._id).filter(Boolean);
    const profiles = await mongoose.model('Profile').find({ user: { $in: companyIds } }).lean();
    
    const populated = campaigns.map((c: any) => {
      const profile = profiles.find((p: any) => p.user.toString() === c.company?._id?.toString());
      return {
        ...c,
        company: {
          ...(c as any).company,
          name: profile ? (profile as any).name : 'Unknown Company'
        }
      };
    });
    
    res.json({ success: true, campaigns: populated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN ACTIONS ────────────────────────────────────────────────────────────

export const adminApproveReward = async (req: AuthRequest, res: Response) => {
  try {
    const { rewardId } = req.params;
    const reward = await Reward.findById(rewardId);
    if (!reward) return res.status(404).json({ success: false, message: 'Reward not found' });

    reward.status = 'Approved';
    reward.approvedAt = new Date();
    await reward.save();

    // Update Wallet
    const wallet = await Wallet.findOne({ user: reward.user });
    if (wallet) {
      wallet.balance += reward.amount;
      wallet.totalRewardsEarned += reward.amount;
      await wallet.save();

      await WalletTransaction.create({
        wallet: wallet._id,
        user: reward.user,
        type: 'credit',
        amount: reward.amount,
        status: 'completed',
        description: reward.description,
        referenceId: `REW_${Math.random().toString(36).substr(2, 9)}`,
        date: new Date()
      });
    }

    res.json({ success: true, reward });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminApprovePayout = async (req: AuthRequest, res: Response) => {
  try {
    const { payoutId } = req.params;
    const payout = await paymentService.executePayout(payoutId);
    res.json({ success: true, payout });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetPayouts = async (req: Request, res: Response) => {
  try {
    const payouts = await mongoose.model('Payout').find().populate('user').sort({ createdAt: -1 }).lean();
    
    // Fetch profiles for names
    const userIds = payouts.map((p: any) => p.user?._id);
    const profiles = await mongoose.model('Profile').find({ user: { $in: userIds } }).lean();
    
    const populatedPayouts = payouts.map((p: any) => {
      const profile = profiles.find((prof: any) => prof.user.toString() === p.user?._id?.toString());
      return {
        ...p,
        user: {
          ...(p as any).user,
          name: profile ? (profile as any).name : 'Unknown User'
        }
      };
    });

    res.json({ success: true, payouts: populatedPayouts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetRewards = async (req: Request, res: Response) => {
  try {
    const rewards = await mongoose.model('Reward').find().populate('user').populate('pickup').sort({ createdAt: -1 }).lean();
    const userIds = rewards.map((r: any) => r.user?._id);
    const profiles = await mongoose.model('Profile').find({ user: { $in: userIds } }).lean();
    
    const populatedRewards = rewards.map((r: any) => {
      const profile = profiles.find((prof: any) => prof.user.toString() === r.user?._id?.toString());
      return {
        ...r,
        user: { ...(r as any).user, name: profile ? (profile as any).name : 'Unknown User' }
      };
    });
    res.json({ success: true, rewards: populatedRewards });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetPickups = async (req: Request, res: Response) => {
  try {
    const pickups = await mongoose.model('Pickup').find().populate('user').sort({ createdAt: -1 }).lean();
    const userIds = pickups.map((p: any) => p.user?._id);
    const profiles = await mongoose.model('Profile').find({ user: { $in: userIds } }).lean();
    
    const populatedPickups = pickups.map((p: any) => {
      const profile = profiles.find((prof: any) => prof.user.toString() === p.user?._id?.toString());
      return {
        ...p,
        user: { ...(p as any).user, name: profile ? (profile as any).name : 'Unknown User' }
      };
    });
    res.json({ success: true, pickups: populatedPickups });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdatePickupStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, partnerId } = req.body;
    const pickup = await mongoose.model('Pickup').findById(id);
    if (!pickup) return res.status(404).json({ success: false, message: 'Pickup not found' });
    
    if (status) pickup.status = status;
    if (partnerId) pickup.assignedPartner = partnerId;
    
    await pickup.save();
    res.json({ success: true, pickup });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetUsers = async (req: Request, res: Response) => {
  try {
    const { search = '', page = 1, limit = 10, role, kycStatus } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // We will use aggregation to join User with Profile and Wallet
    const matchStage: any = {};
    if (role) {
      matchStage.role = role;
    }

    const pipeline: any[] = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'profiles',
          localField: '_id',
          foreignField: 'user',
          as: 'profile'
        }
      },
      {
        $lookup: {
          from: 'wallets',
          localField: '_id',
          foreignField: 'user',
          as: 'wallet'
        }
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } }
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'profile.name': { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    if (kycStatus) {
      pipeline.push({
        $match: { 'profile.kycStatus': kycStatus }
      });
    }

    // Facet for pagination
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }, { $addFields: { page: pageNum, limit: limitNum } }],
        data: [{ $skip: skip }, { $limit: limitNum }]
      }
    });

    const result = await mongoose.model('User').aggregate(pipeline);
    const users = result[0].data.map((u: any) => ({
      _id: u._id,
      email: u.email,
      phone: u.phone,
      role: u.role,
      name: u.profile?.name,
      kycDetails: {
        aadhaarNumber: u.profile?.aadhaarNumber,
        kycStatus: u.profile?.kycStatus
      },
      paymentDetails: {
        upiId: u.wallet?.upiId,
        bankName: u.wallet?.bankName,
        accountNumber: u.wallet?.accountNumber
      },
      walletBalance: u.wallet?.balance
    }));
    
    const total = result[0].metadata[0]?.total || 0;

    res.json({ success: true, users, total, page: pageNum, limit: limitNum });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await mongoose.model('User').findById(id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const profile = await mongoose.model('Profile').findOne({ user: id });
    const wallet = await mongoose.model('Wallet').findOne({ user: id });
    const pickups = await mongoose.model('Pickup').find({ user: id }).sort({ createdAt: -1 });
    const transactions = await mongoose.model('WalletTransaction').find({ user: id }).sort({ date: -1 });
    const payouts = await mongoose.model('Payout').find({ user: id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      user: {
        _id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile,
        wallet,
        pickups,
        transactions,
        payouts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await mongoose.model('User').find({ role: 'company' }).select('-password').lean();
    
    // We should also get their wallets and campaigns
    const enrichedCompanies = await Promise.all(companies.map(async (c: any) => {
      const wallet = await mongoose.model('Wallet').findOne({ user: c._id });
      const activeCampaigns = await mongoose.model('Campaign').countDocuments({ company: c._id, status: 'Active' });
      return { ...c, wallet, activeCampaigns };
    }));

    res.json({ success: true, companies: enrichedCompanies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminCreateCompany = async (req: Request, res: Response) => {
  try {
    const { name, email, phone } = req.body;
    
    // Check if email exists
    let user = await mongoose.model('User').findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    user = await mongoose.model('User').create({
      email,
      phone,
      password: 'temp_password_123', // In a real system, send email to set password
      role: 'company',
      name
    });

    await mongoose.model('Wallet').create({ user: user._id, balance: 0 });
    await mongoose.model('Profile').create({ user: user._id, name });

    res.json({ success: true, company: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminGetInvoices = async (req: Request, res: Response) => {
  try {
    const invoices = await Invoice.find().populate('user').sort({ date: -1 });
    res.json({ success: true, invoices });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── WEBHOOKS ─────────────────────────────────────────────────────────────────

export const handleWebhook = async (req: Request, res: Response) => {
  try {
    // In a real scenario, we verify signature here (e.g. Razorpay signature)
    const { event, payload } = req.body;
    
    // Mock handling of a payment success webhook
    if (event === 'payment.payout.processed') {
      const { referenceId, amount } = payload;
      
      const payout = await Payout.findOne({ gatewayReferenceId: referenceId }).populate('user');
      if (payout && payout.status !== 'Completed') {
        payout.status = 'Completed';
        await payout.save();

        const user = payout.user as any;

        // Generate Invoice
        const invoice = await Invoice.create({
          user: user._id,
          payout: payout._id,
          invoiceNumber: `INV-${Date.now()}`,
          amount: payout.amount
        });

        const invoiceUrl = await invoiceService.generateInvoicePDF(invoice, user, payout);
        invoice.pdfUrl = invoiceUrl;
        await invoice.save();

        // Send Email
        await emailService.sendRewardCreditedEmail(user.email, user.name || 'User', payout.amount, invoiceUrl);
      }
    } else if (event === 'payment.payout.failed') {
      const { referenceId, amount, reason } = payload;
      const payout = await Payout.findOne({ gatewayReferenceId: referenceId }).populate('user');
      if (payout) {
        payout.status = 'Failed';
        payout.failureReason = reason;
        await payout.save();
        const user = payout.user as any;
        await emailService.sendPaymentFailedEmail(user.email, user.name || 'User', payout.amount, reason);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminUpdateKyc = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'Verified' or 'Rejected'

    if (!['Verified', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const profile = await mongoose.model('Profile').findOne({ user: id });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'User profile not found' });
    }

    profile.kycStatus = status;
    await profile.save();

    res.json({ success: true, message: `KYC ${status} successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminSendMoney = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    const wallet = await mongoose.model('Wallet').findOne({ user: id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    if (!wallet.accountNumber && !wallet.upiId) {
      return res.status(400).json({ success: false, message: 'User has no bank or UPI details saved.' });
    }

    const payoutAmount = parseFloat(amount);
    
    // Credit wallet BEFORE payout deducts it back down
    wallet.balance += payoutAmount;
    wallet.totalEarned += payoutAmount;
    await wallet.save();
    
    // Create manual credit transaction history
    await mongoose.model('WalletTransaction').create({
      wallet: wallet._id,
      user: id,
      type: 'credit',
      amount: payoutAmount,
      status: 'completed',
      description: description || 'Admin Manual Bank Transfer',
      date: new Date()
    });

    // Create an immediate payout record
    const payout = await mongoose.model('Payout').create({
      user: id,
      amount: payoutAmount,
      method: wallet.upiId ? 'UPI' : 'BANK',
      destinationDetails: {
        accountNumber: wallet.accountNumber,
        ifscCode: wallet.ifscCode,
        upiId: wallet.upiId
      },
      status: 'Pending'
    });

    // Use the payment service to execute it directly to mock real transfer
    const { paymentService } = await import('../services/PaymentService.js');
    await paymentService.executePayout(payout._id.toString());

    res.json({ success: true, message: 'Funds dispatched successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const adminDownloadInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const invoice = await Invoice.findById(id).populate('user').populate('payout');
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });
    
    // In local development, the invoice URL points to /invoices/filename
    // which might not exist if it was generated before. We will regenerate it if missing.
    // The invoiceService.generateInvoicePDF returns a mock URL.
    // To download directly, we stream the PDF directly in response.
    const { invoiceService } = await import('../services/InvoiceService.js');
    
    // Let's modify logic to pipe directly to response
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoiceNumber}.pdf`);
    
    doc.pipe(res);
    
    const user: any = invoice.user;
    const payout: any = invoice.payout;

    doc.fontSize(20).text('ReLoop', { align: 'right' });
    doc.fontSize(10).text('Waste to Wealth', { align: 'right' });
    doc.moveDown();

    doc.fontSize(20).text('Reward Invoice', { align: 'left' });
    doc.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Date: ${invoice.date.toDateString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Billed To:');
    doc.fontSize(10).text(`Name: ${user.name || user.email}`);
    doc.text(`Email: ${user.email}`);
    if (payout?.method === 'UPI') {
      doc.text(`UPI ID: ${payout.destinationDetails?.upiId}`);
    } else {
      doc.text(`Account No: ${payout?.destinationDetails?.accountNumber || 'N/A'}`);
    }
    doc.moveDown();

    doc.fontSize(12).text('Transaction Details:');
    doc.fontSize(10).text(`Payout Reference: ${payout?.gatewayReferenceId || 'N/A'}`);
    doc.text(`Method: ${payout?.method || 'N/A'}`);
    doc.text(`Status: ${payout?.status || 'N/A'}`);
    doc.moveDown();

    doc.rect(50, doc.y, 500, 30).fillAndStroke('#f3f4f6', '#d1d5db');
    doc.fillColor('#000').text('Total Reward Paid', 60, doc.y - 20);
    doc.text(`INR ${invoice.amount.toFixed(2)}`, 450, doc.y - 20);
    doc.moveDown(2);

    doc.fontSize(10).fillColor('#6b7280').text('Thank you for recycling with ReLoop!', { align: 'center' });
    doc.text('This is a computer-generated invoice and does not require a physical signature.', { align: 'center' });
    doc.end();

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
