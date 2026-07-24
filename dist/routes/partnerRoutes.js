import express from 'express';
import { getDashboardStats, getPickups, acceptPickup, assignDriver, getDrivers, createDriver, getCollectionInventory, getEarnings, getSettings, updateSettings } from '../controllers/partnerController.js';
import { authenticateToken } from '../middleware/SecurityAuth.js';
const router = express.Router();
const requirePartner = (req, res, next) => {
    if (req.userRole !== 'partner' && req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Requires Partner role' });
    }
    next();
};
router.use(authenticateToken);
router.use(requirePartner);
router.get('/dashboard', getDashboardStats);
router.get('/pickups', getPickups);
router.patch('/pickups/:id/accept', acceptPickup);
router.patch('/pickups/:id/assign-driver', assignDriver);
router.route('/drivers')
    .get(getDrivers)
    .post(createDriver);
router.get('/collection-inventory', getCollectionInventory);
router.get('/earnings', getEarnings);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
export default router;
