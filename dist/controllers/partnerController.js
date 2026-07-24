import { Pickup, PartnerProfile, Driver, CollectionCenter, PartnerTransaction } from '../models/Schemas.js';
export const getDashboardStats = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const pickups = await Pickup.find({ 'partner': partnerId });
        const todayPickups = pickups.filter((p) => new Date(p.createdAt) >= todayStart).length;
        const pendingPickups = pickups.filter((p) => p.status === 'Pending').length;
        const completedPickups = pickups.filter((p) => p.status === 'Completed').length;
        const acceptedPickups = pickups.filter((p) => p.status === 'Accepted').length;
        const drivers = await Driver.countDocuments({ partner: partnerId });
        const collectionCenters = await CollectionCenter.countDocuments({ partner: partnerId });
        const transactions = await PartnerTransaction.find({ partner: partnerId, type: 'Credit' });
        const totalEarnings = transactions.reduce((acc, curr) => acc + curr.amount, 0);
        res.json({
            success: true,
            data: {
                todayPickups,
                pendingPickups,
                completedPickups,
                acceptedPickups,
                drivers,
                collectionCenters,
                totalEarnings
            }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
};
export const getPickups = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const pickups = await Pickup.find({ partner: partnerId }).populate('user', 'email name phone');
        res.json({ success: true, data: pickups });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const acceptPickup = async (req, res) => {
    try {
        const { id } = req.params;
        const pickup = await Pickup.findById(id);
        if (!pickup)
            return res.status(404).json({ success: false, message: 'Pickup not found' });
        pickup.status = 'accepted';
        pickup.partnerName = req.user?.name || 'Partner';
        await pickup.save();
        res.json({ success: true, message: 'Pickup accepted successfully', data: pickup });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const assignDriver = async (req, res) => {
    try {
        const { id } = req.params;
        const { driverId } = req.body;
        const pickup = await Pickup.findById(id);
        if (!pickup)
            return res.status(404).json({ success: false, message: 'Pickup not found' });
        pickup.driver = driverId;
        await pickup.save();
        res.json({ success: true, message: 'Driver assigned successfully', data: pickup });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getDrivers = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const drivers = await Driver.find({ partner: partnerId });
        res.json({ success: true, data: drivers });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const createDriver = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const { name, phone, vehicleDetails } = req.body;
        const newDriver = new Driver({
            partner: partnerId,
            name,
            phone,
            vehicleDetails
        });
        await newDriver.save();
        res.status(201).json({ success: true, message: 'Driver created', data: newDriver });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getCollectionInventory = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const inventory = await CollectionCenter.find({ partner: partnerId });
        if (inventory.length === 0) {
            return res.json({
                success: true,
                data: [
                    { type: 'Plastic', amount: Math.floor(Math.random() * 500), capacity: 1000, color: '#00E676' },
                    { type: 'Paper', amount: Math.floor(Math.random() * 800), capacity: 1000, color: '#29B6F6' },
                    { type: 'Glass', amount: Math.floor(Math.random() * 300), capacity: 500, color: '#FFA000' },
                    { type: 'Metal', amount: Math.floor(Math.random() * 200), capacity: 500, color: '#9C27B0' },
                    { type: 'E-Waste', amount: Math.floor(Math.random() * 100), capacity: 200, color: '#EF5350' },
                    { type: 'Organic', amount: Math.floor(Math.random() * 400), capacity: 500, color: '#8D6E63' }
                ]
            });
        }
        res.json({ success: true, data: inventory });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getEarnings = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const transactions = await PartnerTransaction.find({ partner: partnerId }).sort({ createdAt: -1 });
        if (transactions.length === 0) {
            const sampleTransactions = [
                { id: `TXN-${Math.floor(Math.random() * 10000)}`, date: new Date().toISOString().split('T')[0], type: 'Credit', amount: 1500, description: 'Pickup Completed', status: 'Completed' },
                { id: `TXN-${Math.floor(Math.random() * 10000)}`, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], type: 'Debit', amount: 500, description: 'Platform Fee', status: 'Completed' },
            ];
            return res.json({ success: true, data: sampleTransactions });
        }
        res.json({ success: true, data: transactions });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const getSettings = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const profile = await PartnerProfile.findOne({ user: partnerId });
        if (!profile) {
            return res.json({
                success: true,
                data: {
                    companyName: 'ReLoop Partner Demo',
                    gstNumber: '29ABCDE1234F1Z5',
                    address: '123 Eco Park, Electronic City, Bangalore',
                    contactEmail: 'contact@demo.in',
                    phone: '+91 9876543210',
                    bankAccountName: 'ReLoop Partner Demo',
                    bankAccountNumber: '**** **** 4567',
                    ifscCode: 'HDFC0001234'
                }
            });
        }
        res.json({ success: true, data: profile });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
export const updateSettings = async (req, res) => {
    try {
        const partnerId = req.user?.id;
        const updateData = req.body;
        let profile = await PartnerProfile.findOne({ user: partnerId });
        if (!profile) {
            profile = new PartnerProfile({ user: partnerId, ...updateData });
        }
        else {
            Object.assign(profile, updateData);
        }
        await profile.save();
        res.json({ success: true, message: 'Settings updated successfully', data: profile });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
