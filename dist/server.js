import 'dotenv/config';
import dns from 'dns';
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}
catch (e) {
    // Ignore if DNS modification is restricted by system
}
import express from 'express';
import bcrypt from 'bcryptjs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import morgan from 'morgan';
import apiRouter from './routes/APIRoutes.js';
import { configureSecurityHeaders, configureCors, configureCompression, configureMongoSanitize, configureRateLimiter } from './middleware/SecurityAuth.js';
import { initializeSocketTracking } from './services/ExternalServices.js';
import { WasteCategory, Badge, Challenge, LanguageTranslation, User, Profile, Kyc, Wallet, GiftCard, Coupon } from './models/Schemas.js';
import { DEFAULT_WASTE_CATEGORIES, DEFAULT_BADGES, DEFAULT_CHALLENGES, DEFAULT_LANGUAGES } from './config/SeedData.js';
const app = express();
const server = http.createServer(app);
export const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
global.io = io;
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reloop';
// ─── MIDDLEWARES ─────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
// Security & Optimization Stack
app.use(configureSecurityHeaders);
app.use(configureCors);
app.use(configureCompression);
app.use(configureMongoSanitize);
app.use(configureRateLimiter);
// ─── API ROUTER MAPPING ──────────────────────────────────────────────────────
import fintechRouter from './routes/FintechRoutes.js';
import partnerRouter from './routes/partnerRoutes.js';
import companyRouter from './routes/companyRoutes.js';
import adminRouter from './routes/adminRoutes.js';
app.use('/api', apiRouter);
app.use('/api', fintechRouter);
app.use('/api/partner', partnerRouter);
app.use('/api/company', companyRouter);
app.use('/api/admin', adminRouter);
// Base Status Route
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});
// ─── GLOBAL JSON ERROR & 404 HANDLERS (No HTML Errors) ───────────────────────
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Cannot GET ${req.originalUrl}`
    });
});
app.use((err, req, res, next) => {
    console.error('[Unhandled Server Error]:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});
// ─── SOCKET.IO REALTIME SERVICE ──────────────────────────────────────────────
initializeSocketTracking(io);
// ─── DATABASE CONNECTION & SEEDING ───────────────────────────────────────────
const seedDatabase = async () => {
    try {
        // 1. Seed Waste Categories
        await WasteCategory.deleteMany({});
        const wtCount = await WasteCategory.countDocuments();
        if (wtCount === 0) {
            await WasteCategory.insertMany(DEFAULT_WASTE_CATEGORIES);
            console.log('[Seeding] Waste Categories seeded successfully');
        }
        // 2. Seed Badges
        const badgeCount = await Badge.countDocuments();
        if (badgeCount === 0) {
            await Badge.insertMany(DEFAULT_BADGES);
            console.log('[Seeding] Badges seeded successfully');
        }
        // 3. Seed Challenges
        const challengeCount = await Challenge.countDocuments();
        if (challengeCount === 0) {
            await Challenge.insertMany(DEFAULT_CHALLENGES);
            console.log('[Seeding] Challenges seeded successfully');
        }
        // 4. Seed Language translations
        const langCount = await LanguageTranslation.countDocuments();
        if (langCount === 0) {
            await LanguageTranslation.insertMany(DEFAULT_LANGUAGES);
            console.log('[Seeding] Language Translations seeded successfully');
        }
        // 4a. Seed Gift Cards
        const gcCount = await GiftCard.countDocuments();
        if (gcCount === 0) {
            await GiftCard.insertMany([
                { brandName: 'Amazon Pay', voucherCode: 'AMZ-COIN-WALLET-98231', pin: '9841', coinCost: 500, status: 'Available' },
                { brandName: 'Amazon Pay', voucherCode: 'AMZ-COIN-WALLET-54812', pin: '1432', coinCost: 1000, status: 'Available' },
                { brandName: 'Starbucks', voucherCode: 'SBUX-COIN-WALLET-12492', pin: '8872', coinCost: 300, status: 'Available' },
                { brandName: 'Myntra Shopping', voucherCode: 'MYN-COIN-WALLET-48201', pin: '5401', coinCost: 750, status: 'Available' }
            ]);
            console.log('[Seeding] Gift Cards seeded successfully');
        }
        // 4b. Seed Coupons
        const couponCount = await Coupon.countDocuments();
        if (couponCount === 0) {
            await Coupon.insertMany([
                { brandName: 'Swiggy Food', discountCode: 'SWIGGY150', coinCost: 150, expiryDate: new Date(Date.now() + 30 * 86400000), status: 'Available' },
                { brandName: 'Zomato Pro', discountCode: 'ZOMATO200', coinCost: 200, expiryDate: new Date(Date.now() + 60 * 86400000), status: 'Available' },
                { brandName: 'Uber Rides', discountCode: 'UBERFREE50', coinCost: 100, expiryDate: new Date(Date.now() + 15 * 86400000), status: 'Available' }
            ]);
            console.log('[Seeding] Coupons seeded successfully');
        }
        // 5. Seed default test customer if empty
        // 5. Seed default test customer with valid bcrypt password
        const testPasswordHash = await bcrypt.hash('password', 10);
        let testUser = await User.findOne({ email: 'aarav@reloop.com' });
        if (!testUser) {
            testUser = await User.create({
                email: 'aarav@reloop.com',
                phone: '+91 98765 43210',
                password: testPasswordHash,
                role: 'customer'
            });
            await Profile.create({
                user: testUser._id,
                name: 'Aarav Sharma',
                avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
            });
            await Wallet.create({
                user: testUser._id,
                balance: 1500,
                ecoPoints: 450,
                level: 1,
                availableCoins: 15000,
                lifetimeCoins: 15000,
                coinsEarned: 15000,
                coinsRedeemed: 0,
                totalRewards: 1500
            });
            await Kyc.create({
                user: testUser._id,
                status: 'Verified',
                verificationMethod: 'AADHAAR'
            });
            console.log('[Seeding] Default Test Customer (aarav@reloop.com / password) seeded successfully');
        }
        else {
            // Update password hash to ensure login works
            testUser.password = testPasswordHash;
            await testUser.save();
            console.log('[Seeding] Updated aarav@reloop.com password to valid bcrypt hash');
        }
    }
    catch (error) {
        console.error('[Seeding Error]:', error);
    }
};
const startServer = async () => {
    // 1. Listen immediately on port 5000 so network requests never fail/timeout
    server.listen(PORT, () => {
        console.log(`[ReLoop Server] Running on http://localhost:${PORT}`);
    });
    // 2. Connect to Database asynchronously in background
    const FALLBACK_URI = 'mongodb://127.0.0.1:27017/reloop';
    let connected = false;
    try {
        console.log(`[Database] Connecting to MongoDB...`);
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
        console.log(`[Database] MongoDB Connected: ${MONGODB_URI}`);
        connected = true;
    }
    catch (err) {
        console.warn(`[Database Warning] MONGODB_URI connection failed (${err.message}). Trying local fallback...`);
        try {
            await mongoose.connect(FALLBACK_URI, { serverSelectionTimeoutMS: 3000 });
            console.log(`[Database] Connected to local fallback: ${FALLBACK_URI}`);
            connected = true;
        }
        catch (fallbackErr) {
            console.warn(`[Database Mode] MongoDB connection unavailable. Server active in mock/offline mode.`);
        }
    }
    if (connected) {
        await seedDatabase();
    }
};
startServer();
