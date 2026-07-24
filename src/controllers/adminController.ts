import { Request, Response } from 'express';
import { User, Company, Campaign, Pickup, CompanyTransaction, Payout, Wallet, WalletTransaction } from '../models/Schemas.js';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'Active' });
    const pendingPickups = await Pickup.countDocuments({ status: 'Scheduled' });
    
    const usersWithRewards = await User.find({ walletBalance: { $gt: 0 } });
    const totalRewardsPaid = usersWithRewards.reduce((acc, user) => acc + (user.walletBalance || 0), 0);

    const pendingKyc = await User.countDocuments({ status: 'Pending' }); 
    const pendingPayouts = 12; // Mocked
    const fraudAlerts = 3; // Mocked

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeCampaigns,
        pendingPickups,
        totalRewardsPaid,
        pendingKyc,
        pendingPayouts,
        fraudAlerts
      }
    });
  } catch (error) {
    console.error('Admin getDashboardStats Error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getPlatformGrowth = async (req: Request, res: Response) => {
  try {
    const data = [
      { name: 'Jan', Pickups: 4000, Rewards: 2400 },
      { name: 'Feb', Pickups: 3000, Rewards: 1398 },
      { name: 'Mar', Pickups: 2000, Rewards: 9800 },
      { name: 'Apr', Pickups: 2780, Rewards: 3908 },
      { name: 'May', Pickups: 1890, Rewards: 4800 },
      { name: 'Jun', Pickups: 2390, Rewards: 3800 },
      { name: 'Jul', Pickups: 3490, Rewards: 4300 },
    ];
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({ success: true, users, total });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    // In a real app, you would populate pickups and transactions.
    // For now we return the user.
    res.json({ success: true, user: { ...user.toObject(), pickups: [], transactions: [] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const updateUserKyc = async (req: Request, res: Response) => {
  try {
    const kyc = await Kyc.findOneAndUpdate(
      { user: req.params.id },
      { status: req.body.status },
      { new: true, upsert: true }
    );
    res.json({ success: true, kyc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const payUser = async (req: Request, res: Response) => {
  try {
    const { amount, description } = req.body;
    
    let wallet = await Wallet.findOne({ user: req.params.id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.params.id, balance: 0, ecoPoints: 0 });
    }
    
    // In real app, call payment gateway here
    wallet.balance = (wallet.balance || 0) + parseFloat(amount);
    await wallet.save();

    await WalletTransaction.create({
      wallet: wallet._id,
      type: 'REWARD',
      amount: parseFloat(amount),
      status: 'COMPLETED',
      description: description || 'Admin manual payment'
    });
    
    res.json({ success: true, message: 'Payment successful', wallet });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const getCompanies = async (req: Request, res: Response) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json({ success: true, companies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const createCompany = async (req: Request, res: Response) => {
  try {
    // In a real scenario you would parse formData and create User auth as well
    const company = await Company.create(req.body);
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const campaigns = await Campaign.find().populate('company', 'companyName').sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getPickups = async (req: Request, res: Response) => {
  try {
    const pickups = await Pickup.find().populate('user', 'name').populate('partner', 'name').sort({ scheduledDate: -1 });
    res.json({ success: true, pickups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getInvoices = async (req: Request, res: Response) => {
  try {
    // Treat company deposits as invoices
    const invoices = await CompanyTransaction.find({ type: 'deposit' }).populate('company', 'companyName').sort({ createdAt: -1 });
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getPayouts = async (req: Request, res: Response) => {
  try {
    const rawPayouts = await Payout.find().populate('user', 'name email').sort({ createdAt: -1 }).lean();
    
    // Fetch associated wallets to inject QR codes
    const payouts = await Promise.all(rawPayouts.map(async (p: any) => {
      const wallet = await Wallet.findOne({ user: p.user._id }).lean();
      return {
        ...p,
        upiQrUrl: wallet?.upiQrUrl || null
      };
    }));

    res.json({ success: true, payouts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const approvePayout = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const payout = await Payout.findById(id);
    
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout not found' });
    }
    
    if (payout.status === 'Completed') {
      return res.status(400).json({ success: false, message: 'Payout already completed' });
    }

    payout.status = 'Completed';
    payout.processedAt = new Date();
    await payout.save();

    await WalletTransaction.create({
      wallet: await Wallet.findOne({ user: payout.user }).select('_id'),
      type: 'PAYOUT',
      amount: payout.amount,
      status: 'COMPLETED',
      description: `Payout processed via ${payout.method}`,
      referenceId: payout._id.toString()
    });

    res.json({ success: true, message: 'Payout approved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const getRewards = async (req: Request, res: Response) => {
  try {
    const rewards: any[] = []; // Mocked for now
    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const approveReward = async (req: Request, res: Response) => {
  try {
    res.json({ success: true, message: 'Reward approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
