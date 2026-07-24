import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import {
  User, Profile, Kyc, Wallet, WalletTransaction,
  Pickup, WasteCategory, Badge, Challenge,
  Notification, AiScan, AiChat, LanguageTranslation,
  CommunityPost, Address, Withdrawal, Leaderboard, Payout,
  Certificate, EcoItem, EcoOrder, SupportTicket, Referral, AuditLog
} from '../models/Schemas.js';
import {
  authenticateToken, AuthRequest, generateAccessToken,
  generateRefreshToken, verifyRefreshToken, requireAdmin
} from '../middleware/SecurityAuth.js';
import {
  uploadToCloudinary, sendEmail, emailTemplates,
  analyzeWasteImage, chatWithReLoopAi, generatePdfDoc,
  sendPushNotification, razorpayInstance
} from '../services/ExternalServices.js';
import {
  sqliteFindUserByEmail, sqliteFindUserByPhone,
  sqliteCreateUser, sqliteGetUserProfile
} from '../services/SqliteDb.js';

const router = express.Router();
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'secret123456789';

const useSqlite = () => process.env.DATABASE_TYPE === 'sqlite' || mongoose.connection.readyState !== 1;

// ─── ZOD SCHEMA VALIDATIONS ──────────────────────────────────────────────────
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// ─── 1. AUTHENTICATION ROUTER (/api/auth) ──────────────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name, phone } = RegisterSchema.parse(req.body);
    let userId: string;
    let profileName = name;

    if (useSqlite()) {
      const existing = await sqliteFindUserByEmail(email);
      if (existing) return res.status(400).json({ success: false, message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      userId = 'u_' + Math.floor(100000 + Math.random() * 900000);
      await sqliteCreateUser({ id: userId, email, name, password: hashedPassword, phone });
    } else {
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ success: false, message: 'User already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({ email, phone, password: hashedPassword, role: 'customer' });
      const profile = await Profile.create({ user: user._id, name, languages: ['English'] });
      await Wallet.create({
        user: user._id,
        balance: 0,
        ecoPoints: 0,
        level: 1,
        availableCoins: 0,
        lifetimeCoins: 0,
        coinsEarned: 0,
        coinsRedeemed: 0,
        totalRewards: 0
      });
      await Kyc.create({ user: user._id, status: 'Pending' });

      userId = user._id.toString();
      profileName = profile.name;
      user.refreshToken = generateRefreshToken(userId);
      await user.save();
    }

    sendEmail(email, 'Welcome to ReLoop!', emailTemplates.welcome(name)).catch(console.error);

    const accessToken = generateAccessToken(userId, 'customer');
    const refreshToken = generateRefreshToken(userId);

    res.status(201).json({
      success: true,
      token: accessToken,
      refreshToken,
      user: { id: userId, email, phone, name: profileName }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    let user: any;
    if (useSqlite()) {
      user = await sqliteFindUserByEmail(email);
    } else {
      user = await User.findOne({ email });
    }

    if (!user || !user.password) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ success: false, message: 'Invalid email or password' });
    }

    const userIdStr = user._id ? user._id.toString() : user.id;
    let profile: any;

    if (useSqlite()) {
      profile = await sqliteGetUserProfile(userIdStr);
    } else {
      profile = await Profile.findOne({ user: user._id });
    }

    const accessToken = generateAccessToken(userIdStr, user.role || 'customer');
    const refreshToken = generateRefreshToken(userIdStr);

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: userIdStr,
        email: user.email,
        phone: user.phone || profile?.phone,
        name: profile?.name || user.name || 'User',
        avatarUrl: profile?.avatarUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const resetOtpStore = new Map<string, { otp: string; expiresAt: number }>();

// FORGOT PASSWORD ENDPOINT (STRICT EMAIL OTP DISPATCH)
router.post('/auth/forgot-password', async (req, res) => {
  const { email, phone } = req.body;
  const target = (email || phone || '').toLowerCase().trim();
  if (!target) return res.status(400).json({ success: false, message: 'Email or phone is required' });

  try {
    // Generate dynamic 4-digit OTP
    const dynamicOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    resetOtpStore.set(target, { otp: dynamicOtp, expiresAt });

    if (email) {
      await sendEmail(email, 'ReLoop Password Reset OTP', emailTemplates.otp(dynamicOtp));
    }

    console.log(`\n======================================================`);
    console.log(`[STRICT DYNAMIC OTP SENT VIA EMAIL]: Code "${dynamicOtp}" sent to: ${target}`);
    console.log(`======================================================\n`);

    res.json({
      success: true,
      message: `Verification OTP code sent to ${target}. Please check your email inbox.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// RESET PASSWORD ENDPOINT (STRICT EMAIL OTP VALIDATION)
router.post('/auth/reset-password', async (req, res) => {
  const { email, phone, otp, newPassword } = req.body;
  const target = (email || phone || '').toLowerCase().trim();

  if (!target) {
    return res.status(400).json({ success: false, message: 'Email or phone is required' });
  }

  const storedData = resetOtpStore.get(target);
  const isValidOtp = storedData && storedData.otp === String(otp).trim() && Date.now() <= storedData.expiresAt;

  if (!otp || !isValidOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP code. Please check your email and enter the correct code.'
    });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    if (!useSqlite() && email) {
      await User.findOneAndUpdate({ email: target }, { password: hashedPassword });
    }
    resetOtpStore.delete(target);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// REGISTRATION OTP SEND
router.post('/auth/otp/send', async (req, res) => {
  const { phone, email } = req.body;
  const target = (email || phone || '').toLowerCase().trim();
  if (!target) return res.status(400).json({ success: false, message: 'Email or phone is required' });

  try {
    const dynamicOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    resetOtpStore.set(target, { otp: dynamicOtp, expiresAt });

    if (email) {
      await sendEmail(email, 'ReLoop Registration OTP', emailTemplates.otp(dynamicOtp));
    }

    console.log(`\n======================================================`);
    console.log(`[REGISTRATION OTP SENT]: Code "${dynamicOtp}" sent to: ${target}`);
    console.log(`======================================================\n`);

    res.json({
      success: true,
      message: `Verification OTP code sent to ${target}.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// REGISTRATION OTP VERIFY
router.post('/auth/otp/verify', async (req, res) => {
  const { phone, email, otp } = req.body;
  const target = (email || phone || '').toLowerCase().trim();

  if (!target || !otp) {
    return res.status(400).json({ success: false, message: 'Email/phone and OTP are required' });
  }

  const storedData = resetOtpStore.get(target);
  const isValidOtp = storedData && storedData.otp === String(otp).trim() && Date.now() <= storedData.expiresAt;

  if (!isValidOtp) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP code.'
    });
  }

  resetOtpStore.delete(target);
  res.json({ success: true, message: 'OTP verified successfully' });
});

router.post('/auth/google', async (req, res) => {
  try {
    const { idToken, email: clientEmail, name: clientName, photoUrl: clientPhoto } = req.body;
    let email = clientEmail || 'google.user@example.com';
    let name = clientName || 'Google User';
    let photoUrl = clientPhoto || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';

    if (idToken && GOOGLE_CLIENT_ID) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          email = payload.email || email;
          name = payload.name || name;
          photoUrl = payload.picture || photoUrl;
        }
      } catch (err: any) {
        console.warn('[Google OAuth Verification]: Fallback to client data:', err.message);
      }
    }

    let userIdStr: string;
    let user: any = null;

    if (useSqlite()) {
      user = await sqliteFindUserByEmail(email);
      if (!user) {
        userIdStr = 'u_' + Math.floor(100000 + Math.random() * 900000);
        const googleId = idToken ? idToken.slice(-30) : 'g_' + Math.floor(100000 + Math.random() * 900000);
        user = await sqliteCreateUser({ id: userIdStr, email, name, googleId });
      }
      userIdStr = user.id;
    } else {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          email,
          googleId: idToken ? idToken.slice(-30) : 'g_' + Math.floor(100000 + Math.random() * 900000),
          role: 'customer'
        });
        await Profile.create({ user: user._id, name, avatarUrl: photoUrl });
        await Wallet.create({ user: user._id });
        await Kyc.create({ user: user._id });
      }
      userIdStr = user._id.toString();
    }

    const accessToken = generateAccessToken(userIdStr, 'customer');
    const refreshToken = generateRefreshToken(userIdStr);

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: userIdStr,
        email,
        phone: user?.phone,
        name,
        avatarUrl: photoUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token is required' });

  try {
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });

    const accessToken = generateAccessToken(decoded.userId, 'customer');
    res.json({ success: true, token: accessToken });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/auth/logout', authenticateToken, async (req: AuthRequest, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// In-memory store for phone OTPs (same pattern as resetOtpStore)
const phoneOtpStore = new Map<string, { otp: string; expiresAt: number }>();

router.post('/auth/otp/send', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });

  // Generate dynamic 4-digit OTP
  const dynamicOtp = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 min expiry
  const normalizedPhone = phone.replace(/\s+/g, '').trim();
  phoneOtpStore.set(normalizedPhone, { otp: dynamicOtp, expiresAt });

  console.log(`\n======================================================`);
  console.log(`[DYNAMIC PHONE OTP]: Code "${dynamicOtp}" generated for: ${normalizedPhone}`);
  console.log(`======================================================\n`);

  // Attempt to send via email if we have an associated email
  // (Phone OTP is displayed in console for dev; integrate SMS provider here)
  res.json({
    success: true,
    message: `Verification code sent to ${normalizedPhone}. Please enter the 4-digit code.`,
  });
});

router.post('/auth/otp/verify', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ success: false, message: 'Phone and OTP are required' });

  const normalizedPhone = phone.replace(/\s+/g, '').trim();
  const stored = phoneOtpStore.get(normalizedPhone);
  const isValid = stored && stored.otp === String(otp).trim() && Date.now() <= stored.expiresAt;

  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP. Please request a new code.',
    });
  }

  // Clear used OTP
  phoneOtpStore.delete(normalizedPhone);

  try {
    const email = `phone_${phone.replace(/\s+/g, '')}@reloop.com`;
    let userIdStr: string;
    let userName = `User ${phone.slice(-4)}`;

    if (useSqlite()) {
      let user = await sqliteFindUserByPhone(phone);
      if (!user) {
        userIdStr = 'u_' + Math.floor(100000 + Math.random() * 900000);
        user = await sqliteCreateUser({ id: userIdStr, email, name: userName, phone });
      }
      userIdStr = user.id;
    } else {
      let user = await User.findOne({ phone });
      if (!user) {
        user = await User.create({ email, phone, role: 'customer' });
        await Profile.create({ user: user._id, name: userName });
        await Wallet.create({ user: user._id });
        await Kyc.create({ user: user._id });
      }
      userIdStr = user._id.toString();
    }

    const accessToken = generateAccessToken(userIdStr, 'customer');
    const refreshToken = generateRefreshToken(userIdStr);

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: userIdStr,
        email,
        name: userName,
        phone
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 2. NEARBY DRIVERS API (/api/nearby-drivers, /api/drivers/nearby) ────────
const handleGetNearbyDrivers = async (req: express.Request, res: express.Response) => {
  try {
    const drivers = [
      {
        id: 'drv_101',
        driverName: 'Rajesh Kumar',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
        vehicle: 'Electric Cargo Auto (KA-01-EQ-4821)',
        vehicleType: 'EV Auto',
        latitude: 12.9716,
        longitude: 77.5946,
        etaMinutes: 8,
        distanceKm: 1.2,
        rating: 4.9,
        phone: '+91 98765 11223',
        status: 'available',
        isOnline: true
      },
      {
        id: 'drv_102',
        driverName: 'Suresh Patel',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
        vehicle: 'Tata Ace EV (KA-05-EV-9920)',
        vehicleType: 'EV Truck',
        latitude: 12.9785,
        longitude: 77.6012,
        etaMinutes: 14,
        distanceKm: 2.4,
        rating: 4.8,
        phone: '+91 98765 44332',
        status: 'available',
        isOnline: true
      },
      {
        id: 'drv_103',
        driverName: 'Vikram Singh',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
        vehicle: 'Mahindra Zor Grand (KA-03-EZ-1102)',
        vehicleType: 'EV Cargo',
        latitude: 12.9650,
        longitude: 77.5890,
        etaMinutes: 19,
        distanceKm: 3.1,
        rating: 4.95,
        phone: '+91 98765 99887',
        status: 'available',
        isOnline: true
      }
    ];

    res.json(drivers);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/nearby-drivers', handleGetNearbyDrivers);
router.get('/drivers/nearby', handleGetNearbyDrivers);

// ─── 3. CLOUDINARY UPLOAD API (/api/upload) ──────────────────────────────────
router.post('/upload', authenticateToken, async (req: AuthRequest, res) => {
  const { base64Data, folder } = req.body;
  if (!base64Data) return res.status(400).json({ success: false, message: 'Base64 data is required' });

  try {
    const url = await uploadToCloudinary(base64Data, folder || 'general');
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 4. USERS MANAGEMENT ROUTER (/api/users) ────────────────────────────────
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (!useSqlite()) {
      const users = await User.find().select('-password -refreshToken');
      return res.json(users);
    }
    res.json([]);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 5. PROFILE ROUTER (/api/profile) ──────────────────────
const handleGetProfile = async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    let profile: any;

    if (useSqlite()) {
      profile = await sqliteGetUserProfile(userId);
    } else {
      let p = await Profile.findOne({ user: userId });
      let w = await Wallet.findOne({ user: userId });
      const u = await User.findById(userId);

      if (!p && u) {
        p = await Profile.create({
          user: userId,
          name: 'New User',
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
          languages: ['English'],
          address: '',
          dob: '',
          gender: 'Other',
          aadhaarNumber: '',
          panNumber: ''
        });
      }

      if (!w && u) {
        w = await Wallet.create({
          user: userId,
          balance: 0,
          ecoPoints: 0,
          level: 1,
          availableCoins: 0,
          lifetimeCoins: 0,
          coinsEarned: 0,
          coinsRedeemed: 0,
          totalRewards: 0
        });
      }

      if (p) {
        profile = {
          ...p.toObject(),
          email: u?.email || '',
          phone: u?.phone || '',
          ecoPoints: w?.ecoPoints || 0,
          balance: w?.balance || 0,
          level: w?.level || 1,
          availableCoins: w?.availableCoins || 0,
          lifetimeCoins: w?.lifetimeCoins || 0,
          coinsEarned: w?.coinsEarned || 0,
          coinsRedeemed: w?.coinsRedeemed || 0,
          totalRewards: w?.totalRewards || 0,
          aadhaarVerified: true,
          accountNumber: w?.accountNumber || '',
          ifscCode: w?.ifscCode || '',
          bankName: w?.bankName || '',
          accountHolderName: w?.accountHolderName || '',
          branch: w?.branch || '',
          upiId: w?.upiId || '',
          upiQrUrl: w?.upiQrUrl || ''
        };
      }
    }

    if (!profile) {
      profile = {
        name: 'Srinath',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
        languages: ['English'],
        ecoPoints: 450,
        balance: 1500,
        level: 1,
        aadhaarVerified: true
      };
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleUpdateProfile = async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    const { name, email, phone, aadhaar_number, pan_number, profile_image, account_number, ifsc_code, bank_name, upi_id, upi_qr_url, address, dob, gender, account_holder_name, branch } = req.body;

    let updateData: any = {};
    if (name) updateData.name = name;
    if (aadhaar_number) updateData.aadhaarNumber = aadhaar_number;
    if (pan_number) updateData.panNumber = pan_number;
    if (address) updateData.address = address;
    if (dob) updateData.dob = dob;
    if (gender) updateData.gender = gender;
    
    let avatarUrl = undefined;
    if (profile_image) {
      avatarUrl = await uploadToCloudinary(profile_image, 'profiles');
      updateData.avatarUrl = avatarUrl;
    }

    if (!useSqlite()) {
      let userUpdate: any = {};
      if (email) userUpdate.email = email;
      if (phone) userUpdate.phone = phone;
      if (Object.keys(userUpdate).length > 0) {
        await User.findOneAndUpdate({ _id: userId }, userUpdate);
      }

      if (Object.keys(updateData).length > 0) {
        await Profile.findOneAndUpdate(
          { user: userId },
          updateData,
          { new: true, upsert: true }
        );
      }
      
      let walletUpdate: any = {};
      let walletUnset: any = {};
      if (account_number) walletUpdate.accountNumber = account_number;
      if (ifsc_code) walletUpdate.ifscCode = ifsc_code;
      if (bank_name) walletUpdate.bankName = bank_name;
      if (upi_id) walletUpdate.upiId = upi_id;
      if (account_holder_name) walletUpdate.accountHolderName = account_holder_name;
      if (branch) walletUpdate.branch = branch;
      
      if (upi_qr_url) {
        if (upi_qr_url === 'DELETE') {
          walletUnset.upiQrUrl = 1;
        } else if (upi_qr_url.startsWith('data:image')) {
          walletUpdate.upiQrUrl = await uploadToCloudinary(upi_qr_url, 'qrcodes');
        } else {
          walletUpdate.upiQrUrl = upi_qr_url;
        }
      }
      
      if (Object.keys(walletUpdate).length > 0 || Object.keys(walletUnset).length > 0) {
        const updateObj: any = {};
        if (Object.keys(walletUpdate).length > 0) updateObj.$set = walletUpdate;
        if (Object.keys(walletUnset).length > 0) updateObj.$unset = walletUnset;
        
        await Wallet.findOneAndUpdate(
          { user: userId },
          updateObj,
          { new: true, upsert: true }
        );
      }
    }

    let profileResponse: any = {};
    if (useSqlite()) {
      profileResponse = await sqliteGetUserProfile(userId);
    } else {
      const p = await Profile.findOne({ user: userId }).lean();
      const w = await Wallet.findOne({ user: userId }).lean();
      const u = await User.findById(userId).lean();
      if (p) {
        profileResponse = {
          ...p,
          email: u?.email || '',
          phone: u?.phone || '',
          ecoPoints: w?.ecoPoints || 0,
          balance: w?.balance || 0,
          level: w?.level || 1,
          availableCoins: w?.availableCoins || 0,
          lifetimeCoins: w?.lifetimeCoins || 0,
          coinsEarned: w?.coinsEarned || 0,
          coinsRedeemed: w?.coinsRedeemed || 0,
          totalRewards: w?.totalRewards || 0,
          accountNumber: w?.accountNumber || '',
          ifscCode: w?.ifscCode || '',
          bankName: w?.bankName || '',
          accountHolderName: w?.accountHolderName || '',
          branch: w?.branch || '',
          upiId: w?.upiId || '',
          upiQrUrl: w?.upiQrUrl || ''
        };
      }
    }

    res.json(profileResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/profile', authenticateToken, handleGetProfile);
router.put('/profile', authenticateToken, handleUpdateProfile);
router.put('/profile/payment', authenticateToken, handleUpdateProfile);
router.post('/profile/upload-qr', authenticateToken, handleUpdateProfile);
router.delete('/profile/qr', authenticateToken, async (req: AuthRequest, res: express.Response) => {
  req.body.upi_qr_url = 'DELETE';
  await handleUpdateProfile(req, res);
});

// ─── BANK DETAILS ROUTER (/api/bank-details, /api/bank) ──────────────────────
const handleGetBankDetails = async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    let bankData = {
      success: true,
      bankName: 'State Bank of India',
      accountNumber: '987654321012',
      ifscCode: 'SBIN0001234',
      upiId: 'srinath@upi',
      accountHolderName: 'Srinath',
      aadhaarVerified: true
    };

    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId }).lean();
      const profile = await Profile.findOne({ user: userId }).lean();
      if (wallet || profile) {
        bankData = {
          success: true,
          bankName: wallet?.bankName || 'State Bank of India',
          accountNumber: wallet?.accountNumber || '987654321012',
          ifscCode: wallet?.ifscCode || 'SBIN0001234',
          upiId: wallet?.upiId || 'srinath@upi',
          accountHolderName: profile?.name || 'Srinath',
          aadhaarVerified: true
        };
      }
    }

    res.json(bankData);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleUpdateBankDetails = async (req: AuthRequest, res: express.Response) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    const { bankName, accountNumber, ifscCode, upiId, accountHolderName } = req.body;

    if (!useSqlite()) {
      await Wallet.findOneAndUpdate(
        { user: userId },
        { bankName, accountNumber, ifscCode, upiId },
        { new: true, upsert: true }
      );
      if (accountHolderName) {
        await Profile.findOneAndUpdate({ user: userId }, { name: accountHolderName });
      }
    }

    res.json({
      success: true,
      message: 'Bank and UPI details updated successfully',
      bankDetails: {
        bankName: bankName || 'State Bank of India',
        accountNumber: accountNumber || '987654321012',
        ifscCode: ifscCode || 'SBIN0001234',
        upiId: upiId || 'srinath@upi',
        accountHolderName: accountHolderName || 'Srinath'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/bank-details', authenticateToken, handleGetBankDetails);
router.get('/bank', authenticateToken, handleGetBankDetails);
router.post('/bank-details', authenticateToken, handleUpdateBankDetails);
router.put('/bank-details', authenticateToken, handleUpdateBankDetails);
router.post('/bank', authenticateToken, handleUpdateBankDetails);
router.put('/bank', authenticateToken, handleUpdateBankDetails);

// ─── PAYOUT ROUTER (/api/payouts) ────────────────────────────────────────────────
router.post('/payouts/request', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    const { amount, method } = req.body;
    
    if (!amount || amount < 100) {
      return res.status(400).json({ success: false, message: 'Minimum payout is INR 100' });
    }

    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
      }

      // Deduct from active balance
      wallet.balance -= amount;
      await wallet.save();

      // Create a pending Payout record
      const payout = await Payout.create({
        user: userId,
        amount,
        method: method || 'UPI',
        status: 'Pending',
        destinationDetails: {
          accountNumber: wallet.accountNumber,
          ifscCode: wallet.ifscCode,
          upiId: wallet.upiId
        }
      });

      return res.json({ success: true, payout });
    }

    res.json({ success: true, payout: { amount, status: 'Pending' } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 6. KYC ROUTER (/api/kyc) ────────────────────────────────────────────────
router.post('/kyc/verify', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.userId || '605c72d6248c89423c7b2a75';
  const { FrontBase64, BackBase64 } = req.body;
  try {
    let frontUrl = '';
    let backUrl = '';
    if (FrontBase64) frontUrl = await uploadToCloudinary(FrontBase64, 'kyc');
    if (BackBase64) backUrl = await uploadToCloudinary(BackBase64, 'kyc');

    const parsedKyc = {
      name: 'Srinath',
      dob: '15/08/1995',
      gender: 'Male',
      maskedAadhaar: 'XXXX XXXX 1274',
      address: 'Flat 402, Green Glen Layout, Bengaluru, Karnataka - 560103'
    };

    if (!useSqlite()) {
      await Kyc.findOneAndUpdate(
        { user: userId },
        {
          status: 'Verified',
          aadhaarFrontUrl: frontUrl,
          aadhaarBackUrl: backUrl,
          ocrExtractedData: parsedKyc,
          verifiedAt: new Date(),
          verificationMethod: 'AADHAAR'
        },
        { new: true, upsert: true }
      );
      await Profile.findOneAndUpdate({ user: userId }, { name: parsedKyc.name });
    }

    res.json(parsedKyc);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 7. WALLET & RAZORPAY PAYMENT API (/api/wallet) ──────────────────────────
router.get('/wallet', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId });
      return res.json(wallet);
    }
    res.json({ balance: 1500, ecoPoints: 450, level: 1 });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/wallet/razorpay/create-order', authenticateToken, async (req: AuthRequest, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

  try {
    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `rcpt_${Math.floor(100000 + Math.random() * 900000)}`
    };
    const order = await razorpayInstance.orders.create(options);
    res.json(order);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/wallet/razorpay/verify', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.userId || '605c72d6248c89423c7b2a75';
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

  try {
    const generated_signature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId });
      if (wallet) {
        wallet.balance += amount;
        await wallet.save();
        await WalletTransaction.create({
          wallet: wallet._id,
          user: userId,
          type: 'credit',
          amount,
          status: 'completed',
          description: 'Wallet top-up via Razorpay',
          referenceId: razorpay_payment_id
        });
      }
    }

    res.json({ success: true, message: 'Payment verified and wallet credited' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    if (!useSqlite()) {
      const txs = await WalletTransaction.find({ user: userId }).sort({ date: -1 });
      return res.json(txs);
    }
    res.json([
      { id: 't1', type: 'credit', amount: 240, status: 'completed', description: 'Recycling earnings PET Bottles', date: new Date() },
      { id: 't2', type: 'credit', amount: 500, status: 'completed', description: 'Referral reward bonus', date: new Date(Date.now() - 86400000) }
    ]);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/withdraw', authenticateToken, async (req: AuthRequest, res) => {
  const userId = req.userId || '605c72d6248c89423c7b2a75';
  const { amount, method } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

  try {
    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet || wallet.balance < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
      }
      wallet.balance -= amount;
      await wallet.save();
    }

    const ref = 'WDR_' + Math.floor(100000 + Math.random() * 900000);
    res.json({ success: true, reference: ref, message: `Withdrawn INR ${amount} via ${method}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 8. NOTIFICATIONS (/api/notifications) ──────────────────────────────────
router.get('/notifications', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    if (!useSqlite()) {
      const notes = await Notification.find({ user: userId }).sort({ timestamp: -1 });
      return res.json(notes);
    }
    res.json([
      { id: 'n1', type: 'wallet', title: 'Wallet Credited', message: 'Received ₹240 for pickup request', read: false, timestamp: new Date() },
      { id: 'n2', type: 'pickup', title: 'Pickup Assigned', message: 'Driver Rajesh is en route', read: true, timestamp: new Date(Date.now() - 3600000) }
    ]);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/notifications/:id/read', authenticateToken, async (req: AuthRequest, res) => {
  res.json({ success: true });
});

// ─── 8.5 BADGES ─────────────────────────────────────────────────────────────
router.get('/badges', authenticateToken, (req: AuthRequest, res: express.Response) => {
  res.json([
    { id: 'b1', name: 'First Pickup', description: 'Complete your first pickup', icon: 'star', color: '#16A34A', threshold: 1 },
    { id: 'b2', name: 'Planet Saver', description: 'Save 50kg of CO2', icon: 'leaf', color: '#0284C7', threshold: 50 },
    { id: 'b3', name: 'E-Waste Hero', description: 'Recycle 5 electronic items', icon: 'laptop', color: '#7C3AED', threshold: 5 },
    { id: 'b4', name: 'Community Leader', description: 'Refer 3 friends', icon: 'account-group', color: '#EA580C', threshold: 3 }
  ]);
});

router.get('/user-badges', authenticateToken, (req: AuthRequest, res: express.Response) => {
  res.json([
    { badge_id: 'b1', earned_at: new Date().toISOString() }
  ]);
});

router.get('/leaderboard', authenticateToken, (req: AuthRequest, res: express.Response) => {
  res.json([
    { id: '1', user_name: 'Aarav Sharma', avatar: 'https://i.pravatar.cc/150?u=1', total_points: 2450, pickups_count: 12, co2_saved_kg: 85, rank: 1 },
    { id: '2', user_name: 'Priya Patel', avatar: 'https://i.pravatar.cc/150?u=2', total_points: 2100, pickups_count: 10, co2_saved_kg: 70, rank: 2 },
    { id: '3', user_name: 'Rahul Kumar', avatar: 'https://i.pravatar.cc/150?u=3', total_points: 1850, pickups_count: 8, co2_saved_kg: 60, rank: 3 }
  ]);
});

router.get('/challenges', authenticateToken, (req: AuthRequest, res: express.Response) => {
  res.json([
    { id: 'c1', title: 'Recycle 5 Plastics', description: 'Earn 500 bonus points', type: 'collection', target_amount: 5, current_amount: 2, unit: 'items', reward_points: 500, expires_at: new Date(Date.now() + 86400000 * 7).toISOString(), is_active: true }
  ]);
});

// ─── 9. AI SCANNER & CHATBOT (/api/ai, /api/scanner, /api/chat) ──────────────
const handleAiScan = async (req: AuthRequest, res: express.Response) => {
  const userId = req.userId || '605c72d6248c89423c7b2a75';
  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ success: false, message: 'Image base64 content is required' });

  try {
    const imageUrl = await uploadToCloudinary(imageBase64, 'scanner');
    const detection = await analyzeWasteImage(imageBase64);

    res.json({
      success: true,
      imageUrl,
      detectedClass: detection.detectedClass,
      detectedName: detection.detectedName,
      estimatedWeightKg: detection.estimatedWeightKg,
      estimatedPrice: detection.estimatedPrice,
      confidenceScore: detection.confidenceScore,
      suggestions: detection.suggestions
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const handleAiChat = async (req: AuthRequest, res: express.Response) => {
  const userId = req.userId || '605c72d6248c89423c7b2a75';
  const { message } = req.body;
  if (!message) return res.status(400).json({ success: false, message: 'Message text is required' });

  try {
    let profileContext = null;
    let recentPickups: any[] = [];
    let recentTransactions: any[] = [];

    try {
      if (process.env.USE_SQLITE === 'true') {
        profileContext = await sqliteGetUserProfile(userId);
      } else {
        profileContext = await Profile.findOne({ user: userId }).lean();
        recentPickups = await Pickup.find({ user: userId }).sort({ createdAt: -1 }).limit(5).lean();
        recentTransactions = await WalletTransaction.find({ user: userId }).sort({ date: -1 }).limit(5).lean();
      }
    } catch (e) {
      console.error('Error fetching user context for AI chat', e);
    }

    const userContext = {
      profile: profileContext,
      recentPickups,
      recentTransactions,
    };

    const botResponse = await chatWithReLoopAi(message, [], userContext);
    const suggestedPrompts = [
      'How do I schedule a pickup?',
      'What is the price of copper today?',
      'How do I earn eco points?'
    ];

    res.json({
      success: true,
      text: botResponse,
      suggestedPrompts
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.post('/scanner/detect', authenticateToken, handleAiScan);
router.post('/ai/scan', authenticateToken, handleAiScan);

router.post('/chat/message', authenticateToken, handleAiChat);
router.post('/ai/chat', authenticateToken, handleAiChat);

router.get('/chat/history', authenticateToken, async (req: AuthRequest, res) => {
  res.json([
    { sender: 'bot', text: 'Hello! I am ReLoop AI, your smart eco recycling assistant. How can I help you today?' }
  ]);
});

// ─── 10. PICKUPS SYSTEM (/api/pickups) ────────────────────────────────────────
router.get('/pickups', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    if (!useSqlite()) {
      const pickups = await Pickup.find({ user: userId }).sort({ createdAt: -1 });
      return res.json(pickups);
    }
    res.json([
      { id: 'p1', wasteCategoryName: 'PET Plastic Bottles', estimatedWeightKg: 4.5, estimatedPrice: 54, status: 'completed', address: 'Flat 402, Green Glen Layout', scheduledDate: new Date() }
    ]);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/pickups', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId || '605c72d6248c89423c7b2a75';
    const { waste_type_id, waste_type_name, estimated_weight_kg, estimated_price, address, latitude, longitude, scheduled_date, notes } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const qrCode = 'QR_' + Math.floor(100000 + Math.random() * 900000);

    const pickupObj = {
      user: userId,
      wasteCategoryId: waste_type_id || '1',
      wasteCategoryName: waste_type_name || 'PET Bottles',
      estimatedWeightKg: estimated_weight_kg || 2,
      estimatedPrice: estimated_price || 24,
      address: address || 'Default Address',
      latitude,
      longitude,
      scheduledDate: new Date(scheduled_date || Date.now()),
      status: 'pending' as const,
      otp,
      qrCode,
      notes
    };

    if (!useSqlite()) {
      const pickup = await Pickup.create(pickupObj);
      
      // Import io dynamically or at top. Actually I can just import it at top.
      // Wait, APIRoutes is imported IN server.ts, which exports io. 
      // This is a circular dependency if I import { io } from '../server.js'. 
      // Instead, we can use a global or pass it, but the easiest way is to use a global object or `req.app.get('io')` if we attach it.
      // We didn't attach it. Let's just create an event emitter or use `global.io = io` in server.ts.
      // Wait, let's just use `global.io.emit` and set it in server.ts.
      if ((global as any).io) {
        (global as any).io.emit('NEW_PICKUP', pickup);
      }
      
      return res.status(201).json(pickup);
    }

    const mockPickup = { id: 'p_' + Math.floor(100000 + Math.random() * 900000), ...pickupObj };
    if ((global as any).io) {
      (global as any).io.emit('NEW_PICKUP', mockPickup);
    }
    res.status(201).json(mockPickup);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 11. COMPLETE SCRAP MARKET MODULE (/api/market, /api/waste-types) ────────
const handleGetWasteTypes = async (req: express.Request, res: express.Response) => {
  try {
    if (!useSqlite()) {
      const list = await WasteCategory.find().sort({ name: 1 });
      if (list.length > 0) return res.json(list);
    }

    const scrapMarket = [
      { id: '1', name: 'PET Plastic Bottles', category: 'Plastic', pricePerKg: 14, yesterdayPrice: 13.5, trend: 'up', trendPercent: 3.7, weeklyTrend: [12, 12.5, 13, 13.5, 14], monthlyTrend: [11, 12, 13, 14], pricePrediction: 15.2, co2SavedPerKg: 1.5, color: '#10B981', isRecyclable: true },
      { id: '2', name: 'Iron Scrap / Rods', category: 'Iron', pricePerKg: 32, yesterdayPrice: 33, trend: 'down', trendPercent: -3.0, weeklyTrend: [35, 34, 33.5, 33, 32], monthlyTrend: [38, 36, 34, 32], pricePrediction: 31.5, co2SavedPerKg: 2.1, color: '#64748B', isRecyclable: true },
      { id: '3', name: 'Copper Wires & Tubes', category: 'Copper', pricePerKg: 460, yesterdayPrice: 445, trend: 'up', trendPercent: 3.3, weeklyTrend: [430, 440, 445, 450, 460], monthlyTrend: [410, 430, 445, 460], pricePrediction: 480.0, co2SavedPerKg: 4.8, color: '#F59E0B', isRecyclable: true },
      { id: '4', name: 'Steel Utensils & Sheets', category: 'Steel', pricePerKg: 42, yesterdayPrice: 42, trend: 'stable', trendPercent: 0.0, weeklyTrend: [42, 42, 42, 42, 42], monthlyTrend: [40, 41, 42, 42], pricePrediction: 43.0, co2SavedPerKg: 1.8, color: '#94A3B8', isRecyclable: true },
      { id: '5', name: 'Glass Bottles & Jars', category: 'Glass', pricePerKg: 4, yesterdayPrice: 3.8, trend: 'up', trendPercent: 5.2, weeklyTrend: [3.5, 3.6, 3.8, 3.9, 4], monthlyTrend: [3.2, 3.5, 3.8, 4], pricePrediction: 4.3, co2SavedPerKg: 0.6, color: '#06B6D4', isRecyclable: true },
      { id: '6', name: 'Lead Acid Batteries', category: 'Battery', pricePerKg: 95, yesterdayPrice: 90, trend: 'up', trendPercent: 5.5, weeklyTrend: [85, 88, 90, 92, 95], monthlyTrend: [80, 85, 90, 95], pricePrediction: 102.0, co2SavedPerKg: 6.5, color: '#EF4444', isRecyclable: true },
      { id: '7', name: 'Newspaper & Magazines', category: 'Paper', pricePerKg: 16, yesterdayPrice: 15.5, trend: 'up', trendPercent: 3.2, weeklyTrend: [14, 14.5, 15, 15.5, 16], monthlyTrend: [13, 14, 15, 16], pricePrediction: 17.0, co2SavedPerKg: 1.2, color: '#3B82F6', isRecyclable: true },
      { id: '8', name: 'Cardboard Boxes', category: 'Cardboard', pricePerKg: 9.5, yesterdayPrice: 9.5, trend: 'stable', trendPercent: 0.0, weeklyTrend: [9, 9.2, 9.5, 9.5, 9.5], monthlyTrend: [8.5, 9, 9.5, 9.5], pricePrediction: 10.0, co2SavedPerKg: 0.9, color: '#D97706', isRecyclable: true },
      { id: '9', name: 'Old Laptops & Motherboards', category: 'Laptop', pricePerKg: 320, yesterdayPrice: 310, trend: 'up', trendPercent: 3.2, weeklyTrend: [290, 300, 310, 315, 320], monthlyTrend: [280, 300, 310, 320], pricePrediction: 340.0, co2SavedPerKg: 8.5, color: '#8B5CF6', isRecyclable: true },
      { id: '10', name: 'Old Smartphones & Tablets', category: 'Mobile', pricePerKg: 450, yesterdayPrice: 430, trend: 'up', trendPercent: 4.6, weeklyTrend: [400, 420, 430, 440, 450], monthlyTrend: [380, 410, 430, 450], pricePrediction: 475.0, co2SavedPerKg: 9.2, color: '#EC4899', isRecyclable: true },
      { id: '11', name: 'Mixed E-Waste', category: 'E-Waste', pricePerKg: 110, yesterdayPrice: 105, trend: 'up', trendPercent: 4.7, weeklyTrend: [95, 100, 105, 108, 110], monthlyTrend: [90, 100, 105, 110], pricePrediction: 118.0, co2SavedPerKg: 7.4, color: '#6366F1', isRecyclable: true }
    ];

    res.json(scrapMarket);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

router.get('/market', handleGetWasteTypes);
router.get('/waste-types', handleGetWasteTypes);
router.get('/market/categories', handleGetWasteTypes);

// ADMIN SCRAP MARKET UPDATE
router.post('/market/update', authenticateToken, requireAdmin, async (req, res) => {
  const { id, pricePerKg, trend } = req.body;
  try {
    if (!useSqlite()) {
      await WasteCategory.findByIdAndUpdate(id, { pricePerKg, trend });
    }
    res.json({ success: true, message: 'Scrap market price updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 12. COMMUNITY SOCIALS (/api/community) ──────────────────────────────────
router.get('/community/posts', async (req, res) => {
  try {
    if (!useSqlite()) {
      const posts = await CommunityPost.find().sort({ createdAt: -1 });
      if (posts.length > 0) return res.json(posts);
    }
    res.json([
      { id: 'post1', userName: 'Srinath', avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', content: 'Just completed my 10th pickup request! 45 kg plastic saved from oceans.', likes: [], comments: [], createdAt: new Date() }
    ]);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 13. REWARDS & CHALLENGES (/api/rewards, /api/challenges, /api/badges) ────
router.get('/badges', async (req, res) => {
  res.json([
    { id: 'b1', name: 'Eco Starter', description: 'Complete your first recycling pickup request', icon: 'leaf', color: '#10B981', threshold: 1 },
    { id: 'b2', name: 'Planet Saver', description: 'Save more than 50 kg of carbon emissions', icon: 'earth', color: '#3B82F6', threshold: 50 }
  ]);
});

router.get('/rewards/badges', async (req, res) => {
  res.json([
    { id: 'b1', name: 'Eco Starter', description: 'Complete your first recycling pickup request', icon: 'leaf', color: '#10B981', threshold: 1 }
  ]);
});

router.get('/challenges', async (req, res) => {
  res.json([
    { id: 'c1', title: 'Summer Cleanup', description: 'Recycle 20 kg of paper waste this summer', targetKg: 20, currentKg: 5, rewardPoints: 200, icon: 'newspaper', color: '#F59E0B', endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), isActive: true }
  ]);
});

// ─── 14. LANGUAGES (/api/languages) ──────────────────────────────────────────
router.get('/languages/:code', async (req, res) => {
  res.json({
    welcome: 'Welcome to ReLoop',
    pickup: 'Pickups',
    wallet: 'Wallet Balance',
    kyc: 'Aadhaar Verification',
    rewards: 'Achievements'
  });
});

// ─── 15. HELP & SUPPORT (/api/help, /api/support) ────────────────────────────
router.get('/help', async (req, res) => {
  res.json([
    { question: 'How do I earn eco points?', answer: 'You earn points for every kg of waste successfully recycled through pickups.' },
    { question: 'What is the minimum withdrawal?', answer: 'The minimum payout threshold is INR 100.' }
  ]);
});

router.post('/support/ticket', authenticateToken, async (req: AuthRequest, res) => {
  res.status(201).json({ success: true, message: 'Support ticket submitted successfully' });
});

export default router;
