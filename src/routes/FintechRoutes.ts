import express from 'express';
import { authenticateToken, requireFinanceOrSuperAdmin } from '../middleware/SecurityAuth.js';
import { 
  getWalletHistory, 
  saveBankDetails,
  requestPayout, 
  handleWebhook,
  getTransactions,
  getInvoices,
  adminApproveReward,
  adminApprovePayout,
  adminGetPayouts,
  adminGetRewards,
  adminGetUsers,
  adminGetCompanies,
  adminGetInvoices,
  companyCreateCampaign,
  companyGetCampaigns,
  adminUpdateKyc,
  adminGetUserById,
  adminSendMoney,
  adminGetPickups,
  adminUpdatePickupStatus,
  adminCreateCompany,
  adminDownloadInvoice
} from '../controllers/FintechController.js';
import { getDashboardStats, getGrowthData } from '../controllers/AdminAnalyticsController.js';

const router = express.Router();

// ─── USER ROUTES ─────────────────────────────────────────────────────────────
router.get('/wallet', authenticateToken, getWalletHistory);
router.get('/transactions', authenticateToken, getTransactions);
router.get('/invoices', authenticateToken, getInvoices);
router.post('/payouts/request', authenticateToken, requestPayout);
router.put('/bank-details', authenticateToken, saveBankDetails);

// ─── COMPANY ROUTES ──────────────────────────────────────────────────────────
router.post('/company/campaign', authenticateToken, companyCreateCampaign);
router.get('/company/campaign', authenticateToken, companyGetCampaigns);

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────
router.get('/admin/stats', getDashboardStats);
router.get('/admin/growth', getGrowthData);
router.get('/admin/companies', adminGetCompanies);
router.post('/admin/companies', adminCreateCompany);
router.post('/admin/campaigns', companyCreateCampaign);
router.post('/admin/rewards/:rewardId/approve', adminApproveReward);
router.post('/admin/payouts/:payoutId/approve', requireFinanceOrSuperAdmin, adminApprovePayout);
router.get('/admin/payouts', adminGetPayouts);
router.get('/admin/rewards', adminGetRewards);
router.get('/admin/users', adminGetUsers);
router.get('/admin/users/:id', adminGetUserById);
router.post('/admin/users/:id/kyc', requireFinanceOrSuperAdmin, adminUpdateKyc);
router.post('/admin/users/:id/pay', requireFinanceOrSuperAdmin, adminSendMoney);
router.get('/admin/pickups', adminGetPickups);
router.put('/admin/pickups/:id/status', adminUpdatePickupStatus);
router.get('/admin/invoices', adminGetInvoices);
router.get('/admin/campaigns', companyGetCampaigns);

// ─── WEBHOOKS ────────────────────────────────────────────────────────────────
// Webhooks don't use standard auth token, they use signature validation
router.post('/webhooks/payment', handleWebhook);

export default router;
