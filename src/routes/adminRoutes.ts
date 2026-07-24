import express from 'express';
import {
  getDashboardStats,
  getPlatformGrowth,
  getUsers,
  getUserDetails,
  updateUserKyc,
  payUser,
  getCompanies,
  createCompany,
  getCampaigns,
  getPickups,
  getInvoices,
  getPayouts,
  approvePayout,
  getRewards,
  approveReward
} from '../controllers/adminController.js';

const router = express.Router();

// Mock authentication for easy local previewing, matching Partner/Company flows
// In production, requireAdmin middleware would be used here.

router.get('/stats', getDashboardStats);
router.get('/growth', getPlatformGrowth);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.post('/users/:id/kyc', updateUserKyc);
router.post('/users/:id/pay', payUser);
router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.get('/campaigns', getCampaigns);
router.get('/pickups', getPickups);
router.get('/invoices', getInvoices);
router.get('/payouts', getPayouts);
router.post('/payouts/:id/approve', approvePayout);
router.get('/rewards', getRewards);
router.post('/rewards/:id/approve', approveReward);

export default router;
