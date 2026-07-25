import { Request, Response } from 'express';
import os from 'os';
import mongoose from 'mongoose';
import { User, Profile, Company, Campaign, Pickup, CompanyTransaction, Payout, Wallet, WalletTransaction, Kyc, Reward, Invoice, AuditLog, Notification, Leaderboard, Badge } from '../models/Schemas.js';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'Active' });
    const pendingPickups = await Pickup.countDocuments({ status: 'pending' });
    
    const wallets = await Wallet.find();
    const totalRewardsPaid = wallets.reduce((acc, w) => acc + (w.totalPaid || 0), 0);

    const pendingKyc = await Kyc.countDocuments({ status: 'Pending' }); 
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
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    const profile = await Profile.findOne({ user: req.params.id }).lean();
    const wallet = await Wallet.findOne({ user: req.params.id }).lean();
    const kyc = await Kyc.findOne({ user: req.params.id }).lean();
    const pickups = await Pickup.find({ user: req.params.id }).sort({ createdAt: -1 }).lean();
    const transactions = await WalletTransaction.find({ user: req.params.id }).sort({ date: -1 }).lean();
    const rewards = await Reward.find({ user: req.params.id }).sort({ createdAt: -1 }).lean();
    const invoices = await Invoice.find({ user: req.params.id }).sort({ date: -1 }).lean();
    const leaderboards = await Leaderboard.find({ user: req.params.id }).sort({ month: -1 }).lean();
    
    // Calculate total carbon saved from completed pickups
    const totalCarbonSaved = pickups
      .filter((p: any) => p.status === 'completed' && p.actualWeightKg)
      .reduce((acc: number, curr: any) => acc + (curr.actualWeightKg * 2.5), 0); // Assuming 2.5kg CO2 per kg waste
      
    // Mock Badges for now (could fetch from a UserBadge table if created)
    const badges = [
      { id: 'b1', name: 'Eco Starter', icon: 'leaf', color: '#10B981' },
      { id: 'b2', name: 'Recycle Pro', icon: 'recycle', color: '#3B82F6' }
    ];

    // Build dynamic activity timeline
    const activityTimeline: any[] = [];
    if (user.createdAt) {
      activityTimeline.push({
        type: 'signup',
        title: 'Account Created',
        description: 'User registered on ReLoop',
        date: user.createdAt
      });
    }
    if (profile && profile.joinedDate) {
      activityTimeline.push({
        type: 'profile_setup',
        title: 'Profile Set Up',
        description: 'User updated profile details',
        date: profile.joinedDate
      });
    }
    pickups.forEach((p: any) => {
      activityTimeline.push({
        type: 'pickup',
        title: `Pickup Request (${p.status.replace('_', ' ')})`,
        description: `Scheduled for ${new Date(p.scheduledDate).toLocaleDateString()} with est. weight of ${p.estimatedWeightKg} kg`,
        date: p.createdAt
      });
    });
    transactions.forEach((t: any) => {
      activityTimeline.push({
        type: 'transaction',
        title: `${t.type === 'credit' ? 'Credit' : 'Debit'} Transaction`,
        description: t.description || `Transaction amount: ₹${t.amount}`,
        date: t.date
      });
    });
    rewards.forEach((r: any) => {
      activityTimeline.push({
        type: 'reward',
        title: `Reward ${r.status}`,
        description: `${r.type} Reward of ₹${r.amount}: ${r.description}`,
        date: r.createdAt
      });
    });
    invoices.forEach((inv: any) => {
      activityTimeline.push({
        type: 'invoice',
        title: `Invoice Generated`,
        description: `Invoice ${inv.invoiceNumber} for ₹${inv.amount}`,
        date: inv.date
      });
    });

    // Sort descending by date
    activityTimeline.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ 
      success: true, 
      user: { 
        ...user, 
        profile,
        wallet,
        kyc,
        pickups, 
        transactions,
        rewards,
        invoices,
        leaderboards,
        totalCarbonSaved,
        badges,
        activityTimeline
      } 
    });
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
    const { amount, description, utrNumber, screenshotUrl } = req.body;
    const userId = req.params.id;
    
    let wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      wallet = await Wallet.create({ user: userId, balance: 0, ecoPoints: 0 });
    }
    
    const rupeeAmount = parseFloat(amount);
    const coinAmount = rupeeAmount * 10; // 10x ratio

    // Update Wallet
    wallet.availableCoins = (wallet.availableCoins || 0) + coinAmount;
    wallet.lifetimeCoins = (wallet.lifetimeCoins || 0) + coinAmount;
    wallet.coinsEarned = (wallet.coinsEarned || 0) + coinAmount;
    wallet.totalRewards = (wallet.totalRewards || 0) + rupeeAmount;
    wallet.balance = (wallet.balance || 0) + rupeeAmount;
    wallet.totalPaid = (wallet.totalPaid || 0) + rupeeAmount;
    await wallet.save();

    // 1. Create Payout Record
    const payout = await Payout.create({
      user: userId,
      amount: rupeeAmount,
      method: 'UPI',
      status: 'Completed',
      bankReferenceId: utrNumber || 'MANUAL-' + Date.now(),
      processedAt: new Date(),
      rewardsIncluded: [] // Mapped if needed
    });

    // 2. Create WalletTransaction (Transaction Record / Reward Ledger)
    await WalletTransaction.create({
      wallet: wallet._id,
      user: userId,
      type: 'credit',
      amount: coinAmount,
      status: 'completed',
      description: description || `Admin Manual Coin Credit: ${coinAmount} RL Coins`,
      referenceId: payout._id.toString()
    });

    // 3. Create Reward document (Reward Ledger)
    const reward = await Reward.create({
      user: userId,
      amount: coinAmount,
      type: 'CampaignBonus',
      status: 'Paid',
      description: description || `Admin manual coin payment reward: ${coinAmount} RL Coins`,
      approvedAt: new Date()
    });
    
    // 4. Create Invoice
    const invoice = await Invoice.create({
      user: userId,
      payout: payout._id,
      invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      amount: rupeeAmount
    });

    // 5. Create Notification
    await Notification.create({
      user: userId,
      type: 'rewards',
      title: 'Coins Added Successfully',
      message: `You have received ${coinAmount} ReLoop Coins (equivalent to ₹${rupeeAmount}). Remarks: ${description}`,
      color: '#10B981',
      icon: 'check-circle'
    });

    // 6. Create Audit Log
    await AuditLog.create({
      userId: userId,
      action: `Admin manually paid user ₹${rupeeAmount} (${coinAmount} RL Coins). UTR: ${utrNumber}. Remarks: ${description}`,
      ipAddress: req.ip || '127.0.0.1'
    });
    
    res.json({ success: true, message: 'Payment successful', wallet, payout, invoice, reward });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
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
    const invoices = await CompanyTransaction.find({ type: 'Credit' }).populate('company', 'companyName').sort({ createdAt: -1 });
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

    const wallet = await Wallet.findOne({ user: payout.user });
    if (wallet) {
      await WalletTransaction.create({
        wallet: wallet._id,
        user: payout.user,
        type: 'withdrawal',
        amount: payout.amount,
        status: 'completed',
        description: `Payout processed via ${payout.method}`,
        referenceId: payout._id.toString()
      });
    }

    res.json({ success: true, message: 'Payout approved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const getRewards = async (req: Request, res: Response) => {
  try {
    const rewards = await Reward.find().populate('user', 'name email').sort({ createdAt: -1 });
    res.json({ success: true, rewards });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const approveReward = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reward = await Reward.findById(id);
    if (!reward) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }
    
    if (reward.status === 'Approved') {
      return res.status(400).json({ success: false, message: 'Reward already approved' });
    }

    reward.status = 'Approved';
    await reward.save();

    // Credit user's wallet
    let wallet = await Wallet.findOne({ user: reward.user });
    if (!wallet) {
      wallet = await Wallet.create({ user: reward.user, balance: 0, ecoPoints: 0, availableCoins: 0 });
    }
    wallet.balance = (wallet.balance || 0) + reward.amount;
    wallet.ecoPoints = (wallet.ecoPoints || 0) + (reward.amount * 10);
    wallet.availableCoins = (wallet.availableCoins || 0) + (reward.amount * 10);
    await wallet.save();

    // Create wallet transaction
    await WalletTransaction.create({
      wallet: wallet._id,
      user: reward.user,
      type: 'credit',
      amount: reward.amount,
      status: 'completed',
      description: `Reward payout approved for pickup`,
      referenceId: reward._id.toString(),
      date: new Date()
    });

    // Create Invoice
    await Invoice.create({
      user: reward.user,
      invoiceNumber: 'INV-' + Math.floor(100000 + Math.random() * 900000),
      amount: reward.amount,
      date: new Date()
    });

    // Create Notification
    await Notification.create({
      user: reward.user,
      type: 'wallet',
      title: 'Wallet Credited 🎉',
      message: `Your reward of ₹${reward.amount} has been approved and credited to your wallet!`,
      color: '#10B981',
      icon: 'check-circle'
    });

    // Emit live Socket.IO update
    if ((global as any).io) {
      (global as any).io.emit('WALLET_UPDATE', { userId: reward.user });
    }

    res.json({ success: true, message: 'Reward approved successfully', reward, wallet });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('user').populate('payout');
    if (!invoice) {
      res.status(404).send('Invoice not found');
      return;
    }
    
    const html = `
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 2px solid #10B981; padding-bottom: 20px; margin-bottom: 20px; }
            .logo { color: #10B981; font-size: 24px; font-weight: bold; }
            .title { font-size: 20px; color: #666; }
            .details { margin-bottom: 30px; }
            .amount { font-size: 32px; color: #10B981; font-weight: bold; margin: 20px 0; }
            .footer { margin-top: 50px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ReLoop</div>
            <div class="title">Payout Invoice</div>
          </div>
          <div class="details">
            <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
            <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleDateString()}</p>
            <p><strong>Billed To:</strong> ${(invoice as any).user?.name || 'User'}</p>
          </div>
          <div class="amount">
            Total Amount: ₹${invoice.amount}
          </div>
          <div class="footer">
            This is an automatically generated invoice for payout processing.
          </div>
        </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.html"`);
    res.send(html);
  } catch (error) {
    res.status(500).send('Server Error');
  }
};

export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    
    const cpus = os.cpus();
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    
    res.json({
      success: true,
      health: {
        server: { status: 'Online', uptime: os.uptime(), loadAvg: os.loadavg() },
        memory: { total: totalMem, used: usedMem, free: freeMem, percentUsed: memUsagePercent },
        cpu: { cores: cpus.length, model: cpus[0].model },
        database: { status: dbStatus, host: mongoose.connection.host || 'localhost' },
        services: { socketio: 'Online', cloudinary: 'Online', payments: 'Online' }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getLiveMonitoringStats = async (req: Request, res: Response) => {
  try {
    const onlineUsers = Math.floor(Math.random() * 50) + 10;
    const activePickups = await Pickup.countDocuments({ status: { $in: ['pending', 'accepted'] } });
    const recentActivity = await AuditLog.find().sort({ createdAt: -1 }).limit(10).lean();
    
    res.json({
      success: true,
      live: { onlineUsers, activePickups, recentActivity }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const getDetailedAnalytics = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      analytics: {
        revenueData: [
          { name: 'Week 1', value: 4000 }, { name: 'Week 2', value: 3000 },
          { name: 'Week 3', value: 2000 }, { name: 'Week 4', value: 2780 }
        ],
        userGrowth: [
          { name: 'Jan', users: 400 }, { name: 'Feb', users: 800 },
          { name: 'Mar', users: 1200 }, { name: 'Apr', users: 2100 }
        ]
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
