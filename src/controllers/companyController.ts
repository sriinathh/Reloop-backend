import { Request, Response } from 'express';
import { Company, Campaign, CampaignBudget, CompanyTransaction, Pickup, User, CampaignReport } from '../models/Schemas.js';
import mongoose from 'mongoose';

const MOCK_USER_ID = '64b1f9c8f93e9a001c8ebbbb';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOne({ user: userId });
    
    let totalWasteCollected = 0;
    let co2Saved = 0;
    let treesSaved = 0;
    let usersParticipated = 0;
    let partnersWorking = 0;
    
    if (profile) {
      const reports = await CampaignReport.find({ company: profile._id });
      totalWasteCollected = reports.reduce((acc, r) => acc + (r.totalWeightCollected || 0), 0);
      co2Saved = reports.reduce((acc, r) => acc + (r.co2SavedKg || 0), 0);
      treesSaved = reports.reduce((acc, r) => acc + (r.treesSaved || 0), 0);
      
      const campaigns = await Campaign.find({ company: profile._id });
      const campaignIds = campaigns.map(c => c._id);
      
      // Count unique users and partners from Pickups related to these campaigns
      const pickups = await Pickup.find({ campaign: { $in: campaignIds } });
      const uniqueUsers = new Set(pickups.map(p => p.user?.toString()));
      const uniquePartners = new Set(pickups.map(p => (p as any).partner?.toString()));
      
      usersParticipated = uniqueUsers.size;
      partnersWorking = uniquePartners.size;
    }
    
    const stats = {
      verificationStatus: profile?.status || 'Pending',
      totalCampaigns: await Campaign.countDocuments({ company: profile?._id }),
      activeCampaigns: await Campaign.countDocuments({ company: profile?._id, status: 'Active' }),
      totalBudget: profile?.csrBudget || 0,
      budgetUsed: profile?.totalSpent || 0,
      totalWasteCollected,
      co2Saved,
      treesSaved,
      usersParticipated,
      partnersWorking
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('getDashboardStats Error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    let profile = await Company.findOne({ user: userId });
    
    // Auto-create dummy profile for testing if it doesn't exist
    if (!profile && process.env.NODE_ENV !== 'production') {
       profile = await Company.create({
         user: userId,
         companyName: 'Acme Corp Eco',
         contactEmail: 'eco@acme.com',
         contactPhone: '9876543210',
         industry: 'Technology',
         registrationNumber: 'REG-12345',
         csrBudget: 50000,
         status: 'Active'
       });
    }
    
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOneAndUpdate({ user: userId }, req.body, { new: true, upsert: true });
    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOne({ user: userId });
    if (!profile) return res.json({ success: true, data: [] });

    const campaigns = await Campaign.find({ company: profile._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const createCampaign = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOne({ user: userId });
    if (!profile) return res.status(404).json({ success: false, message: 'Company profile not found' });

    const campaign = new Campaign({
      ...req.body,
      company: profile._id
    });
    
    await campaign.save();

    // Create associated budget
    await CampaignBudget.create({
      campaign: campaign._id,
      allocatedBudget: campaign.totalBudget,
      remainingBudget: campaign.remainingBudget
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOne({ user: userId });
    if (!profile) return res.json({ success: true, data: [] });

    const transactions = await CompanyTransaction.find({ company: profile._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || MOCK_USER_ID;
    const profile = await Company.findOne({ user: userId });
    
    if (!profile) {
      return res.json({ success: true, data: { monthlyTrends: [], topCities: [] } });
    }

    // Aggregate monthly trends from CampaignReports
    const reports = await CampaignReport.find({ company: profile._id }).sort({ year: 1, month: 1 });
    
    const monthlyTrends = reports.map(r => ({
      month: `${r.month}/${r.year}`,
      plastic: r.totalWeightCollected * 0.5, // Dummy split based on actual weight for now
      metal: r.totalWeightCollected * 0.3,
      paper: r.totalWeightCollected * 0.2
    }));

    // In a real production system, topCities would be aggregated from Pickups location data.
    // For now we return empty or dynamic based on active campaigns.
    const campaigns = await Campaign.find({ company: profile._id });
    const topCities = campaigns.map(c => ({
      name: c.title,
      value: c.totalBudget
    })).slice(0, 4);

    res.json({ 
      success: true, 
      data: { 
        monthlyTrends: monthlyTrends.length ? monthlyTrends : [], 
        topCities: topCities.length ? topCities : [] 
      } 
    });
  } catch (error) {
    console.error('getAnalytics Error:', error);
    res.status(500).json({ success: false, message: 'Server Error', error });
  }
};
