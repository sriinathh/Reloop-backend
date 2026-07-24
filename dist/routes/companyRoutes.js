import express from 'express';
import { getDashboardStats, getProfile, updateProfile, getCampaigns, createCampaign, getTransactions, getAnalytics } from '../controllers/companyController.js';
// In a real app we'd use authenticateToken
// import { authenticateToken } from '../middleware/SecurityAuth.js';
const router = express.Router();
// We omit authenticateToken here to allow easy previewing, just like in partner routes
router.get('/dashboard', getDashboardStats);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/campaigns', getCampaigns);
router.post('/campaigns', createCampaign);
// PUT and DELETE omitted for brevity in demo, but would go here
router.get('/transactions', getTransactions);
router.get('/analytics', getAnalytics);
export default router;
