import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { 
  User, Pickup, Reward, Payout, Campaign, Wallet, Profile
} from '../models/Schemas.js';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      totalPickups,
      pendingPickups,
      totalRewardsPaid,
      activeCampaigns,
      pendingKyc,
      pendingPayouts,
      fraudAlerts
    ] = await Promise.all([
      User.countDocuments(),
      Pickup.countDocuments(),
      Pickup.countDocuments({ status: 'pending' }),
      Payout.aggregate([
        { $match: { status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Campaign.countDocuments({ status: 'Active' }),
      Profile.countDocuments({ kycStatus: 'Pending' }),
      Payout.countDocuments({ status: 'Pending' }),
      Pickup.countDocuments({ fraudFlag: true }) // Assuming fraudFlag is used
    ]);

    const rewardsPaid = totalRewardsPaid.length > 0 ? totalRewardsPaid[0].total : 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalPickups,
        pendingPickups,
        totalRewardsPaid: rewardsPaid,
        activeCampaigns,
        pendingKyc,
        pendingPayouts,
        fraudAlerts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getGrowthData = async (req: Request, res: Response) => {
  try {
    const last6Months = new Date();
    last6Months.setMonth(last6Months.getMonth() - 5);
    last6Months.setDate(1);

    const pickupsAgg = await Pickup.aggregate([
      { $match: { createdAt: { $gte: last6Months } } },
      { $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          count: { $sum: 1 }
      }}
    ]);

    const rewardsAgg = await Reward.aggregate([
      { $match: { createdAt: { $gte: last6Months } } },
      { $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          total: { $sum: '$amount' }
      }}
    ]);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Create an array for the last 6 months
    const data = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const m = d.getMonth() + 1; // 1-12
      const y = d.getFullYear();
      
      const pData = pickupsAgg.find(p => p._id.month === m && p._id.year === y);
      const rData = rewardsAgg.find(r => r._id.month === m && r._id.year === y);
      
      data.push({
        name: monthNames[m - 1],
        Pickups: pData ? pData.count : 0,
        Rewards: rData ? rData.total : 0
      });
    }

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
