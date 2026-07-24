import { Company, Campaign, CampaignBudget, CompanyTransaction } from '../models/Schemas.js';
export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
        const profile = await Company.findOne({ user: userId });
        // In real app, calculate from actual campaigns
        const stats = {
            verificationStatus: profile?.status || 'Pending',
            totalCampaigns: await Campaign.countDocuments({ company: profile?._id }),
            activeCampaigns: await Campaign.countDocuments({ company: profile?._id, status: 'Active' }),
            totalBudget: profile?.csrBudget || 0,
            budgetUsed: profile?.totalSpent || 0,
            totalWasteCollected: 15420, // Mocked aggregation for overview
            co2Saved: 4200,
            treesSaved: 125,
            usersParticipated: 450,
            partnersWorking: 12
        };
        res.json({ success: true, data: stats });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const getProfile = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
        const profile = await Company.findOneAndUpdate({ user: userId }, req.body, { new: true, upsert: true });
        res.json({ success: true, data: profile });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const getCampaigns = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
        const profile = await Company.findOne({ user: userId });
        if (!profile)
            return res.json({ success: true, data: [] });
        const campaigns = await Campaign.find({ company: profile._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: campaigns });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const createCampaign = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
        const profile = await Company.findOne({ user: userId });
        if (!profile)
            return res.status(404).json({ success: false, message: 'Company profile not found' });
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const getTransactions = async (req, res) => {
    try {
        const userId = req.user?.id || 'dummy';
        const profile = await Company.findOne({ user: userId });
        if (!profile)
            return res.json({ success: true, data: [] });
        const transactions = await CompanyTransaction.find({ company: profile._id }).sort({ createdAt: -1 });
        res.json({ success: true, data: transactions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const getAnalytics = async (req, res) => {
    try {
        // Return structured mock data for charts since aggregations require seeded data
        const analytics = {
            monthlyTrends: [
                { month: 'Jan', plastic: 400, metal: 240, paper: 2400 },
                { month: 'Feb', plastic: 300, metal: 139, paper: 2210 },
                { month: 'Mar', plastic: 200, metal: 980, paper: 2290 },
                { month: 'Apr', plastic: 278, metal: 390, paper: 2000 },
                { month: 'May', plastic: 189, metal: 480, paper: 2181 },
                { month: 'Jun', plastic: 239, metal: 380, paper: 2500 }
            ],
            topCities: [
                { name: 'Bangalore', value: 4000 },
                { name: 'Mumbai', value: 3000 },
                { name: 'Delhi', value: 2000 },
                { name: 'Hyderabad', value: 1500 }
            ]
        };
        res.json({ success: true, data: analytics });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
