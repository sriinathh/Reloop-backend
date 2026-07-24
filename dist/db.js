import sqlite3 from 'sqlite3';
import { MongoClient } from 'mongodb';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();
const DB_TYPE = process.env.DATABASE_TYPE || 'sqlite';
const SQLITE_FILE = process.env.SQLITE_FILE || 'reloop.db';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/reloop';
// ─── Initial Seed Data Definitions ───────────────────────────────────────────
const DEFAULT_WASTE_TYPES = [
    { id: 'wt1', name: 'Plastic Bottles', category: 'plastic', icon: 'recycle', price_per_kg: 12, co2_saved_per_kg: 1.5, color: '#10B981', is_recyclable: true, description: 'PET, HDPE plastic bottles and containers', trend: 'up', trend_percent: 8 },
    { id: 'wt2', name: 'E-Waste (Phones/Laptops)', category: 'e-waste', icon: 'cpu', price_per_kg: 45, co2_saved_per_kg: 3.2, color: '#3B82F6', is_recyclable: true, description: 'Old smartphones, tablets, chargers, and laptops', trend: 'up', trend_percent: 15 },
    { id: 'wt3', name: 'Copper Wires / Scrap Metal', category: 'metal', icon: 'shield', price_per_kg: 75, co2_saved_per_kg: 2.8, color: '#F59E0B', is_recyclable: true, description: 'Copper cables, aluminum cans, and iron scrap', trend: 'stable', trend_percent: 2 },
    { id: 'wt4', name: 'Newspapers & Cardboard', category: 'paper', icon: 'file-text', price_per_kg: 8, co2_saved_per_kg: 0.9, color: '#6B7280', is_recyclable: true, description: 'Old newspapers, books, and delivery cardboard boxes', trend: 'down', trend_percent: -4 },
];
const DEFAULT_RECYCLING_CENTERS = [
    { id: 'rc1', name: 'Green Earth Recyclers', address: 'Metro Junction, Mumbai', latitude: 19.076, longitude: 72.8777, accepted_types: ['plastic', 'paper'], rating: 4.8, phone: '+91 98765 43210', is_certified: true },
    { id: 'rc2', name: 'E-Waste Solutions Ltd', address: 'Industrial Area, Pune', latitude: 18.5204, longitude: 73.8567, accepted_types: ['e-waste'], rating: 4.6, phone: '+91 98765 43211', is_certified: true },
    { id: 'rc3', name: 'Metal Recovery Corp', address: 'Port Road, Chennai', latitude: 13.0827, longitude: 80.2707, accepted_types: ['metal'], rating: 4.7, phone: '+91 98765 43212', is_certified: false },
];
const DEFAULT_BADGES = [
    { id: 'b1', name: 'Eco Warrior', description: 'Complete 5 recycling pickups', icon: 'leaf', color: '#10B981', threshold: 5 },
    { id: 'b2', name: 'E-Waste Hero', description: 'Recycle 3 electronic items', icon: 'cpu', color: '#3B82F6', threshold: 3 },
    { id: 'b3', name: 'Planet Saver', description: 'Save 50kg of CO2 emissions', icon: 'globe', color: '#10B981', threshold: 50 },
    { id: 'b4', name: 'Community Leader', description: 'Complete 10 pickups', icon: 'award', color: '#F59E0B', threshold: 10 },
];
const DEFAULT_CHALLENGES = [
    { id: 'ch1', title: 'Monsoon Cleanup Drive', description: 'Recycle 50kg of waste this month to earn bonus points.', target_kg: 50, current_kg: 18.5, reward_points: 200, icon: 'cloud-rain', color: '#3B82F6', ends_at: new Date(Date.now() + 7 * 86400000).toISOString(), is_active: true },
    { id: 'ch2', title: 'Zero Plastic Challenge', description: 'Recycle 20kg of PET plastic bottles.', target_kg: 20, current_kg: 8.2, reward_points: 150, icon: 'trash-2', color: '#10B981', ends_at: new Date(Date.now() + 14 * 86400000).toISOString(), is_active: true },
];
const DEFAULT_PRICING_PLANS = [
    { id: 'plan-free', name: 'Free', price: 0, period: 'month', tagline: 'For household recycling', features: ['Free pickup scheduling', 'Basic reward points', 'Standard support'], is_popular: false, cta: 'Current Plan' },
    { id: 'plan-plus', name: 'Plus', price: 199, period: 'month', tagline: 'For active recyclers', features: ['Priority pickup under 2 hours', '1.5x reward points', 'Express support', 'Access to premium badges'], is_popular: true, cta: 'Upgrade Now' },
    { id: 'plan-pro', name: 'Pro', price: 499, period: 'month', tagline: 'For commercial needs', features: ['Unlimited priority pickups', '2x reward points', '24/7 dedicated manager', 'Custom carbon impact reports', 'Special marketplace listings'], is_popular: false, cta: 'Upgrade Now' },
];
const DEFAULT_TESTIMONIALS = [
    { id: 't1', name: 'Aman Verma', role: 'Homeowner', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', rating: 5, text: 'ReLoop has made recycling extremely convenient. The pickup partners are always on time and polite!', company: 'Individual' },
    { id: 't2', name: 'Sneha Rao', role: 'Office Manager', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', rating: 5, text: 'We manage our corporate e-waste and paper waste solely through ReLoop. The carbon certificates are amazing!', company: 'EcoSoft Tech' },
];
const DEFAULT_LEADERBOARD = [
    { id: 'l1', user_name: 'Aarav Sharma', total_points: 1250, pickups_count: 12, co2_saved_kg: 35.5, rank: 1, month: 'July 2026', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
    { id: 'l2', user_name: 'Priya Patel', total_points: 980, pickups_count: 9, co2_saved_kg: 26.2, rank: 2, month: 'July 2026', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100' },
    { id: 'l3', user_name: 'Kabir Malhotra', total_points: 850, pickups_count: 8, co2_saved_kg: 22.4, rank: 3, month: 'July 2026', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100' },
];
const DEFAULT_NEARBY_DRIVERS = [
    { id: 'd1', name: 'Ramesh Kumar', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', rating: 4.8, distance_km: 1.2, eta_minutes: 5, is_online: true, total_pickups: 142 },
    { id: 'd2', name: 'Amit Singh', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', rating: 4.7, distance_km: 2.5, eta_minutes: 10, is_online: true, total_pickups: 98 },
];
const DEFAULT_PARTNER_JOBS = [
    { id: 'j1', customer_name: 'Aarav Sharma', customer_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', customer_phone: '+91 99999 88888', waste_type_name: 'Plastic Bottles', waste_type_color: '#10B981', estimated_weight_kg: 15, estimated_price: 180, address: 'Fl 402, Block A, Green Heights, Andheri, Mumbai', latitude: 19.1136, longitude: 72.8697, distance_km: 1.2, eta_minutes: 6, status: 'available', otp: '4321' },
];
const DEFAULT_MARKETPLACE_LISTINGS = [
    { id: 'm1', waste_type: 'PET Flakes', category: 'plastic', available_kg: 1200, price_per_kg: 42, seller_name: 'RecycleIndia Pvt Ltd', seller_city: 'Mumbai', quality_grade: 'A', posted_date: new Date().toISOString() },
    { id: 'm2', waste_type: 'Assorted Cardboard Bundles', category: 'paper', available_kg: 5000, price_per_kg: 7.5, seller_name: 'EcoPack Solutions', seller_city: 'Pune', quality_grade: 'B', posted_date: new Date().toISOString() },
];
// Default profile for fallback/seeding
const getInitialProfile = (userId, email, name = 'Aarav Sharma', phone = '') => ({
    id: userId,
    name: name,
    email: email,
    phone: phone,
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    address: '',
    pincode: '',
    upi_id: '',
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    is_verified: true,
    aadhaar_verified: false,
    referral_code: 'LOOP' + Math.floor(1000 + Math.random() * 9000),
    eco_points: 120,
    level: 2,
    rating: 4.9,
    total_pickups: 4,
    wallet_balance: 350.00,
    todays_earnings: 0.00,
    co2_saved_kg: 18.5,
    trees_saved: 1,
    joined_date: new Date().toISOString(),
});
// ─── Database Drivers Implementation ──────────────────────────────────────────
class SQLiteAdapter {
    db;
    constructor() {
        this.db = new sqlite3.Database(SQLITE_FILE, (err) => {
            if (err) {
                console.error('SQLite connection error:', err);
            }
            else {
                console.log(`SQLite connected: ${SQLITE_FILE}`);
                this.initializeSchema();
            }
        });
    }
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    async initializeSchema() {
        // Users table for authenticating users
        await this.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      google_id TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
        // Profiles table (user info, balances, stats)
        await this.run(`CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      address TEXT,
      pincode TEXT,
      upi_id TEXT,
      bank_name TEXT,
      account_holder_name TEXT,
      account_number TEXT,
      ifsc_code TEXT,
      bank_details_saved_at TEXT,
      is_verified INTEGER DEFAULT 1,
      aadhaar_verified INTEGER DEFAULT 0,
      referral_code TEXT,
      eco_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      rating REAL DEFAULT 0,
      total_pickups INTEGER DEFAULT 0,
      wallet_balance REAL DEFAULT 0,
      todays_earnings REAL DEFAULT 0,
      co2_saved_kg REAL DEFAULT 0,
      trees_saved INTEGER DEFAULT 0,
      joined_date TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
        // Pickups table
        await this.run(`CREATE TABLE IF NOT EXISTS pickups (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      waste_type_id TEXT,
      waste_type_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      estimated_weight_kg REAL DEFAULT 0,
      estimated_price REAL DEFAULT 0,
      actual_weight_kg REAL,
      actual_price REAL,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      scheduled_date TEXT,
      partner_name TEXT,
      partner_phone TEXT,
      photo_url TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`);
        // Transactions table
        await this.run(`CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      amount REAL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      description TEXT NOT NULL,
      date TEXT DEFAULT CURRENT_TIMESTAMP,
      invoice_number TEXT
    )`);
        // Notifications table
        await this.run(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      read INTEGER DEFAULT 0,
      icon TEXT DEFAULT 'bell',
      color TEXT DEFAULT '#10B981'
    )`);
        // Chat messages
        await this.run(`CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      type TEXT DEFAULT 'text'
    )`);
        // Testimonials
        await this.run(`CREATE TABLE IF NOT EXISTS testimonials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT,
      avatar TEXT,
      rating INTEGER DEFAULT 5,
      text TEXT NOT NULL,
      company TEXT
    )`);
        // Recycling Centers
        await this.run(`CREATE TABLE IF NOT EXISTS recycling_centers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      accepted_types TEXT NOT NULL, -- comma-separated
      rating REAL DEFAULT 0,
      phone TEXT,
      is_certified INTEGER DEFAULT 0
    )`);
        // Waste Types
        await this.run(`CREATE TABLE IF NOT EXISTS waste_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      icon TEXT DEFAULT 'recycle',
      price_per_kg REAL DEFAULT 0,
      co2_saved_per_kg REAL DEFAULT 0,
      color TEXT DEFAULT '#10B981',
      is_recyclable INTEGER DEFAULT 1,
      description TEXT,
      trend TEXT DEFAULT 'stable',
      trend_percent REAL DEFAULT 0
    )`);
        // Leaderboard
        await this.run(`CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      total_points INTEGER DEFAULT 0,
      pickups_count INTEGER DEFAULT 0,
      co2_saved_kg REAL DEFAULT 0,
      rank INTEGER,
      month TEXT NOT NULL,
      avatar TEXT
    )`);
        // Challenges
        await this.run(`CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target_kg REAL DEFAULT 0,
      current_kg REAL DEFAULT 0,
      reward_points INTEGER DEFAULT 0,
      icon TEXT DEFAULT 'trophy',
      color TEXT DEFAULT '#10B981',
      ends_at TEXT,
      is_active INTEGER DEFAULT 1
    )`);
        // Badges table
        await this.run(`CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT DEFAULT 'award',
      color TEXT DEFAULT '#10B981',
      threshold INTEGER DEFAULT 0
    )`);
        // User badges table
        await this.run(`CREATE TABLE IF NOT EXISTS user_badges (
      id TEXT PRIMARY KEY,
      badge_id TEXT REFERENCES badges(id) ON DELETE CASCADE,
      earned_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
        // Pricing plans
        await this.run(`CREATE TABLE IF NOT EXISTS pricing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      period TEXT,
      tagline TEXT,
      features TEXT, -- JSON string array
      is_popular INTEGER DEFAULT 0,
      cta TEXT
    )`);
        // Nearby drivers
        await this.run(`CREATE TABLE IF NOT EXISTS nearby_drivers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      rating REAL DEFAULT 0,
      distance_km REAL DEFAULT 0,
      eta_minutes INTEGER DEFAULT 0,
      is_online INTEGER DEFAULT 1,
      total_pickups INTEGER DEFAULT 0
    )`);
        // Partner jobs
        await this.run(`CREATE TABLE IF NOT EXISTS partner_jobs (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_avatar TEXT,
      customer_phone TEXT,
      waste_type_name TEXT NOT NULL,
      waste_type_color TEXT DEFAULT '#10B981',
      estimated_weight_kg REAL DEFAULT 0,
      estimated_price REAL DEFAULT 0,
      address TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      distance_km REAL,
      eta_minutes INTEGER,
      status TEXT DEFAULT 'available',
      otp TEXT
    )`);
        // User ratings
        await this.run(`CREATE TABLE IF NOT EXISTS user_ratings (
      id TEXT PRIMARY KEY,
      pickup_id TEXT,
      partner_name TEXT,
      rating INTEGER NOT NULL,
      category_ratings TEXT, -- JSON
      tags TEXT, -- JSON
      review TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
        // Seeding static data
        await this.seedInitialData();
    }
    async seedInitialData() {
        // Waste types
        const wtCount = await this.get('SELECT COUNT(*) as count FROM waste_types');
        if (wtCount.count === 0) {
            for (const item of DEFAULT_WASTE_TYPES) {
                await this.run(`INSERT INTO waste_types (id, name, category, icon, price_per_kg, co2_saved_per_kg, color, is_recyclable, description, trend, trend_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.category, item.icon, item.price_per_kg, item.co2_saved_per_kg, item.color, item.is_recyclable ? 1 : 0, item.description, item.trend, item.trend_percent]);
            }
        }
        // Recycling centers
        const rcCount = await this.get('SELECT COUNT(*) as count FROM recycling_centers');
        if (rcCount.count === 0) {
            for (const item of DEFAULT_RECYCLING_CENTERS) {
                await this.run(`INSERT INTO recycling_centers (id, name, address, latitude, longitude, accepted_types, rating, phone, is_certified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.address, item.latitude, item.longitude, item.accepted_types.join(','), item.rating, item.phone, item.is_certified ? 1 : 0]);
            }
        }
        // Badges
        const bCount = await this.get('SELECT COUNT(*) as count FROM badges');
        if (bCount.count === 0) {
            for (const item of DEFAULT_BADGES) {
                await this.run(`INSERT INTO badges (id, name, description, icon, color, threshold) VALUES (?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.description, item.icon, item.color, item.threshold]);
            }
        }
        // Challenges
        const chCount = await this.get('SELECT COUNT(*) as count FROM challenges');
        if (chCount.count === 0) {
            for (const item of DEFAULT_CHALLENGES) {
                await this.run(`INSERT INTO challenges (id, title, description, target_kg, current_kg, reward_points, icon, color, ends_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.title, item.description, item.target_kg, item.current_kg, item.reward_points, item.icon, item.color, item.ends_at, item.is_active ? 1 : 0]);
            }
        }
        // Pricing plans
        const pCount = await this.get('SELECT COUNT(*) as count FROM pricing_plans');
        if (pCount.count === 0) {
            for (const item of DEFAULT_PRICING_PLANS) {
                await this.run(`INSERT INTO pricing_plans (id, name, price, period, tagline, features, is_popular, cta) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.price, item.period, item.tagline, JSON.stringify(item.features), item.is_popular ? 1 : 0, item.cta]);
            }
        }
        // Testimonials
        const tCount = await this.get('SELECT COUNT(*) as count FROM testimonials');
        if (tCount.count === 0) {
            for (const item of DEFAULT_TESTIMONIALS) {
                await this.run(`INSERT INTO testimonials (id, name, role, avatar, rating, text, company) VALUES (?, ?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.role, item.avatar, item.rating, item.text, item.company]);
            }
        }
        // Leaderboard
        const lCount = await this.get('SELECT COUNT(*) as count FROM leaderboard');
        if (lCount.count === 0) {
            for (const item of DEFAULT_LEADERBOARD) {
                await this.run(`INSERT INTO leaderboard (id, user_name, total_points, pickups_count, co2_saved_kg, rank, month, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.user_name, item.total_points, item.pickups_count, item.co2_saved_kg, item.rank, item.month, item.avatar]);
            }
        }
        // Nearby drivers
        const ndCount = await this.get('SELECT COUNT(*) as count FROM nearby_drivers');
        if (ndCount.count === 0) {
            for (const item of DEFAULT_NEARBY_DRIVERS) {
                await this.run(`INSERT INTO nearby_drivers (id, name, avatar, rating, distance_km, eta_minutes, is_online, total_pickups) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.name, item.avatar, item.rating, item.distance_km, item.eta_minutes, item.is_online ? 1 : 0, item.total_pickups]);
            }
        }
        // Partner jobs
        const pjCount = await this.get('SELECT COUNT(*) as count FROM partner_jobs');
        if (pjCount.count === 0) {
            for (const item of DEFAULT_PARTNER_JOBS) {
                await this.run(`INSERT INTO partner_jobs (id, customer_name, customer_avatar, customer_phone, waste_type_name, waste_type_color, estimated_weight_kg, estimated_price, address, latitude, longitude, distance_km, eta_minutes, status, otp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [item.id, item.customer_name, item.customer_avatar, item.customer_phone, item.waste_type_name, item.waste_type_color, item.estimated_weight_kg, item.estimated_price, item.address, item.latitude, item.longitude, item.distance_km, item.eta_minutes, item.status, item.otp]);
            }
        }
        // Seed a default demo profile 'u1' (compatible with any request)
        const demoProfile = await this.get('SELECT COUNT(*) as count FROM user_profiles WHERE id = "u1"');
        if (demoProfile.count === 0) {
            const p = getInitialProfile('u1', 'aarav@reloop.com', 'Aarav Sharma', '+91 98765 43210');
            await this.run(`INSERT INTO user_profiles (id, name, email, phone, avatar_url, referral_code, eco_points, level, rating, total_pickups, wallet_balance, todays_earnings, co2_saved_kg, trees_saved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [p.id, p.name, p.email, p.phone, p.avatar_url, p.referral_code, p.eco_points, p.level, p.rating, p.total_pickups, p.wallet_balance, p.todays_earnings, p.co2_saved_kg, p.trees_saved]);
        }
    }
    // API implementations for SQLite
    async findUserByEmail(email) {
        const row = await this.get('SELECT * FROM users WHERE email = ?', [email]);
        return row || null;
    }
    async findUserByPhone(phone) {
        const row = await this.get('SELECT * FROM users WHERE phone = ?', [phone]);
        return row || null;
    }
    async createUser(userId, email, name, phone, passwordHash, googleId) {
        const user = {
            id: userId,
            email,
            phone,
            password: passwordHash,
            name,
            google_id: googleId,
            created_at: new Date().toISOString()
        };
        await this.run(`INSERT INTO users (id, email, phone, password, name, google_id) VALUES (?, ?, ?, ?, ?, ?)`, [user.id, user.email, user.phone, user.password, user.name, user.google_id]);
        // Automatically create their user profile too!
        const p = getInitialProfile(userId, email, name, phone);
        await this.run(`INSERT INTO user_profiles (id, name, email, phone, avatar_url, referral_code, eco_points, level, rating, total_pickups, wallet_balance, todays_earnings, co2_saved_kg, trees_saved) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [p.id, p.name, p.email, p.phone, p.avatar_url, p.referral_code, p.eco_points, p.level, p.rating, p.total_pickups, p.wallet_balance, p.todays_earnings, p.co2_saved_kg, p.trees_saved]);
        return user;
    }
    async getWasteTypes() {
        const rows = await this.all('SELECT * FROM waste_types ORDER BY name');
        return rows.map(r => ({ ...r, is_recyclable: !!r.is_recyclable }));
    }
    async getWasteTypeById(id) {
        const r = await this.get('SELECT * FROM waste_types WHERE id = ?', [id]);
        return r ? { ...r, is_recyclable: !!r.is_recyclable } : null;
    }
    async getUserProfile(id) {
        const r = await this.get('SELECT * FROM user_profiles WHERE id = ?', [id]);
        if (!r)
            return null;
        return {
            ...r,
            is_verified: !!r.is_verified,
            aadhaar_verified: !!r.aadhaar_verified,
        };
    }
    async updateUserProfile(id, updates) {
        const keys = Object.keys(updates);
        if (keys.length === 0)
            return this.getUserProfile(id);
        const setClauses = keys.map(k => `${k} = ?`).join(', ');
        const params = keys.map(k => {
            const val = updates[k];
            if (typeof val === 'boolean')
                return val ? 1 : 0;
            return val;
        });
        params.push(id);
        await this.run(`UPDATE user_profiles SET ${setClauses} WHERE id = ?`, params);
        return this.getUserProfile(id);
    }
    async getPickups(userId, status) {
        let sql = 'SELECT * FROM pickups';
        const params = [];
        const conditions = [];
        if (userId) {
            conditions.push('user_id = ?');
            params.push(userId);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY created_at DESC';
        return this.all(sql, params);
    }
    async getPickupById(id) {
        return this.get('SELECT * FROM pickups WHERE id = ?', [id]);
    }
    async createPickup(userId, pickup) {
        const id = crypto.randomUUID();
        await this.run(`INSERT INTO pickups (id, user_id, waste_type_id, waste_type_name, status, estimated_weight_kg, estimated_price, address, latitude, longitude, scheduled_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, pickup.waste_type_id, pickup.waste_type_name, 'pending', pickup.estimated_weight_kg, pickup.estimated_price, pickup.address, pickup.latitude, pickup.longitude, pickup.scheduled_date, pickup.notes]);
        return this.getPickupById(id);
    }
    async updatePickupStatus(id, updates) {
        const keys = Object.keys(updates);
        if (keys.length === 0)
            return this.getPickupById(id);
        const setClauses = keys.map(k => `${k} = ?`).join(', ');
        const params = keys.map(k => updates[k]);
        params.push(id);
        await this.run(`UPDATE pickups SET ${setClauses} WHERE id = ?`, params);
        return this.getPickupById(id);
    }
    async cancelPickup(id) {
        await this.run(`UPDATE pickups SET status = 'cancelled' WHERE id = ?`, [id]);
    }
    async getTransactions(userId) {
        return this.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId]);
    }
    async createTransaction(userId, tx) {
        const id = crypto.randomUUID();
        await this.run(`INSERT INTO transactions (id, user_id, type, amount, status, description, date, invoice_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, tx.type, tx.amount, tx.status || 'completed', tx.description, tx.date || new Date().toISOString(), tx.invoice_number]);
        return this.get(`SELECT * FROM transactions WHERE id = ?`, [id]);
    }
    async getBadges() {
        return this.all('SELECT * FROM badges ORDER BY threshold');
    }
    async getUserBadges(userId) {
        const profile = await this.getUserProfile(userId);
        const totalPickups = profile?.total_pickups || 0;
        const co2Saved = profile?.co2_saved_kg || 0;
        const badges = await this.getBadges();
        const userBadges = [];
        for (const badge of badges) {
            let earned = false;
            if (badge.name === 'Planet Saver' && co2Saved >= badge.threshold)
                earned = true;
            else if (badge.name !== 'Planet Saver' && totalPickups >= badge.threshold)
                earned = true;
            if (earned) {
                userBadges.push({ badge_id: badge.id, earned_at: profile?.joined_date || new Date().toISOString() });
            }
        }
        return userBadges;
    }
    async getLeaderboard() {
        return this.all('SELECT * FROM leaderboard ORDER BY rank');
    }
    async getChallenges() {
        const rows = await this.all('SELECT * FROM challenges ORDER BY ends_at');
        return rows.map(r => ({ ...r, is_active: !!r.is_active }));
    }
    async getRecyclingCenters() {
        const rows = await this.all('SELECT * FROM recycling_centers ORDER BY rating DESC');
        return rows.map(r => ({ ...r, accepted_types: r.accepted_types ? r.accepted_types.split(',') : [], is_certified: !!r.is_certified }));
    }
    async getNotifications(userId) {
        const rows = await this.all('SELECT * FROM notifications WHERE user_id = ? ORDER BY timestamp DESC', [userId]);
        return rows.map(r => ({ ...r, read: !!r.read }));
    }
    async markNotificationRead(id) {
        await this.run('UPDATE notifications SET read = 1 WHERE id = ?', [id]);
    }
    async markAllNotificationsRead(userId) {
        await this.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [userId]);
    }
    async getChatMessages(userId) {
        return this.all('SELECT * FROM chat_messages WHERE user_id = ? ORDER BY timestamp ASC', [userId]);
    }
    async createChatMessage(userId, msg) {
        const id = crypto.randomUUID();
        await this.run('INSERT INTO chat_messages (id, user_id, sender, text, type) VALUES (?, ?, ?, ?, ?)', [id, userId, msg.sender, msg.text, msg.type || 'text']);
        return this.get('SELECT * FROM chat_messages WHERE id = ?', [id]);
    }
    async getNearbyDrivers() {
        const rows = await this.all('SELECT * FROM nearby_drivers ORDER BY distance_km');
        return rows.map(r => ({ ...r, is_online: !!r.is_online }));
    }
    async getPartnerJobs() {
        return this.all('SELECT * FROM partner_jobs ORDER BY distance_km');
    }
    async updatePartnerJobStatus(id, status) {
        await this.run('UPDATE partner_jobs SET status = ? WHERE id = ?', [status, id]);
    }
    async getTestimonials() {
        return this.all('SELECT * FROM testimonials ORDER BY rating DESC');
    }
    async getPricingPlans() {
        const rows = await this.all('SELECT * FROM pricing_plans ORDER BY price');
        return rows.map(r => ({ ...r, features: JSON.parse(r.features || '[]'), is_popular: !!r.is_popular }));
    }
    async submitRating(rating) {
        const id = crypto.randomUUID();
        await this.run('INSERT INTO user_ratings (id, pickup_id, partner_name, rating, category_ratings, tags, review) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, rating.pickupId, rating.partnerName, rating.rating, JSON.stringify(rating.categoryRatings), JSON.stringify(rating.tags), rating.review]);
    }
    async getMarketplaceListings() {
        return this.all('SELECT * FROM marketplace_listings ORDER BY posted_date DESC');
    }
}
class MongoDBAdapter {
    client;
    db;
    connected = false;
    constructor() {
        this.client = new MongoClient(MONGODB_URI);
        this.connect();
    }
    async connect() {
        try {
            await this.client.connect();
            this.db = this.client.db();
            this.connected = true;
            console.log(`MongoDB connected: ${MONGODB_URI}`);
            await this.seedInitialData();
        }
        catch (err) {
            console.error('MongoDB connection error:', err);
        }
    }
    async seedInitialData() {
        if (!this.connected)
            return;
        // Seeding waste types
        const wtCol = this.db.collection('waste_types');
        if ((await wtCol.countDocuments()) === 0) {
            await wtCol.insertMany(DEFAULT_WASTE_TYPES);
        }
        // Recycling centers
        const rcCol = this.db.collection('recycling_centers');
        if ((await rcCol.countDocuments()) === 0) {
            await rcCol.insertMany(DEFAULT_RECYCLING_CENTERS);
        }
        // Badges
        const bCol = this.db.collection('badges');
        if ((await bCol.countDocuments()) === 0) {
            await bCol.insertMany(DEFAULT_BADGES);
        }
        // Challenges
        const chCol = this.db.collection('challenges');
        if ((await chCol.countDocuments()) === 0) {
            await chCol.insertMany(DEFAULT_CHALLENGES);
        }
        // Pricing plans
        const pCol = this.db.collection('pricing_plans');
        if ((await pCol.countDocuments()) === 0) {
            await pCol.insertMany(DEFAULT_PRICING_PLANS);
        }
        // Testimonials
        const tCol = this.db.collection('testimonials');
        if ((await tCol.countDocuments()) === 0) {
            await tCol.insertMany(DEFAULT_TESTIMONIALS);
        }
        // Leaderboard
        const lCol = this.db.collection('leaderboard');
        if ((await lCol.countDocuments()) === 0) {
            await lCol.insertMany(DEFAULT_LEADERBOARD);
        }
        // Nearby drivers
        const ndCol = this.db.collection('nearby_drivers');
        if ((await ndCol.countDocuments()) === 0) {
            await ndCol.insertMany(DEFAULT_NEARBY_DRIVERS);
        }
        // Partner jobs
        const pjCol = this.db.collection('partner_jobs');
        if ((await pjCol.countDocuments()) === 0) {
            await pjCol.insertMany(DEFAULT_PARTNER_JOBS);
        }
        // Marketplace
        const mpCol = this.db.collection('marketplace_listings');
        if ((await mpCol.countDocuments()) === 0) {
            await mpCol.insertMany(DEFAULT_MARKETPLACE_LISTINGS);
        }
        // Default profile 'u1'
        const profCol = this.db.collection('user_profiles');
        if ((await profCol.countDocuments({ id: 'u1' })) === 0) {
            await profCol.insertOne(getInitialProfile('u1', 'aarav@reloop.com', 'Aarav Sharma', '+91 98765 43210'));
        }
    }
    // API implementations for MongoDB
    async findUserByEmail(email) {
        const doc = await this.db.collection('users').findOne({ email });
        return doc ? doc : null;
    }
    async findUserByPhone(phone) {
        const doc = await this.db.collection('users').findOne({ phone });
        return doc ? doc : null;
    }
    async createUser(userId, email, name, phone, passwordHash, googleId) {
        const user = {
            id: userId,
            email,
            phone,
            password: passwordHash,
            name,
            google_id: googleId,
            created_at: new Date().toISOString()
        };
        await this.db.collection('users').insertOne(user);
        // Profile creation
        const p = getInitialProfile(userId, email, name, phone);
        await this.db.collection('user_profiles').insertOne(p);
        return user;
    }
    async getWasteTypes() {
        return this.db.collection('waste_types').find().sort({ name: 1 }).toArray();
    }
    async getWasteTypeById(id) {
        return this.db.collection('waste_types').findOne({ id });
    }
    async getUserProfile(id) {
        return this.db.collection('user_profiles').findOne({ id });
    }
    async updateUserProfile(id, updates) {
        await this.db.collection('user_profiles').updateOne({ id }, { $set: updates });
        return this.getUserProfile(id);
    }
    async getPickups(userId, status) {
        const filter = {};
        if (userId)
            filter.user_id = userId;
        if (status)
            filter.status = status;
        return this.db.collection('pickups').find(filter).sort({ created_at: -1 }).toArray();
    }
    async getPickupById(id) {
        return this.db.collection('pickups').findOne({ id });
    }
    async createPickup(userId, pickup) {
        const id = crypto.randomUUID();
        const doc = {
            id,
            user_id: userId,
            waste_type_id: pickup.waste_type_id,
            waste_type_name: pickup.waste_type_name,
            status: 'pending',
            estimated_weight_kg: pickup.estimated_weight_kg,
            estimated_price: pickup.estimated_price,
            address: pickup.address,
            latitude: pickup.latitude,
            longitude: pickup.longitude,
            scheduled_date: pickup.scheduled_date,
            notes: pickup.notes,
            created_at: new Date().toISOString()
        };
        await this.db.collection('pickups').insertOne(doc);
        return doc;
    }
    async updatePickupStatus(id, updates) {
        await this.db.collection('pickups').updateOne({ id }, { $set: updates });
        return this.getPickupById(id);
    }
    async cancelPickup(id) {
        await this.db.collection('pickups').updateOne({ id }, { $set: { status: 'cancelled' } });
    }
    async getTransactions(userId) {
        return this.db.collection('transactions').find({ user_id: userId }).sort({ date: -1 }).toArray();
    }
    async createTransaction(userId, tx) {
        const id = crypto.randomUUID();
        const doc = {
            id,
            user_id: userId,
            type: tx.type,
            amount: tx.amount,
            status: tx.status || 'completed',
            description: tx.description,
            date: tx.date || new Date().toISOString(),
            invoice_number: tx.invoice_number
        };
        await this.db.collection('transactions').insertOne(doc);
        return doc;
    }
    async getBadges() {
        return this.db.collection('badges').find().sort({ threshold: 1 }).toArray();
    }
    async getUserBadges(userId) {
        const profile = await this.getUserProfile(userId);
        const totalPickups = profile?.total_pickups || 0;
        const co2Saved = profile?.co2_saved_kg || 0;
        const badges = await this.getBadges();
        const userBadges = [];
        for (const badge of badges) {
            let earned = false;
            if (badge.name === 'Planet Saver' && co2Saved >= badge.threshold)
                earned = true;
            else if (badge.name !== 'Planet Saver' && totalPickups >= badge.threshold)
                earned = true;
            if (earned) {
                userBadges.push({ badge_id: badge.id, earned_at: profile?.joined_date || new Date().toISOString() });
            }
        }
        return userBadges;
    }
    async getLeaderboard() {
        return this.db.collection('leaderboard').find().sort({ rank: 1 }).toArray();
    }
    async getChallenges() {
        return this.db.collection('challenges').find().sort({ ends_at: 1 }).toArray();
    }
    async getRecyclingCenters() {
        return this.db.collection('recycling_centers').find().sort({ rating: -1 }).toArray();
    }
    async getNotifications(userId) {
        return this.db.collection('notifications').find({ user_id: userId }).sort({ timestamp: -1 }).toArray();
    }
    async markNotificationRead(id) {
        await this.db.collection('notifications').updateOne({ id }, { $set: { read: true } });
    }
    async markAllNotificationsRead(userId) {
        await this.db.collection('notifications').updateMany({ user_id: userId }, { $set: { read: true } });
    }
    async getChatMessages(userId) {
        return this.db.collection('chat_messages').find({ user_id: userId }).sort({ timestamp: 1 }).toArray();
    }
    async createChatMessage(userId, msg) {
        const id = crypto.randomUUID();
        const doc = {
            id,
            user_id: userId,
            sender: msg.sender,
            text: msg.text,
            timestamp: new Date().toISOString(),
            type: msg.type || 'text'
        };
        await this.db.collection('chat_messages').insertOne(doc);
        return doc;
    }
    async getNearbyDrivers() {
        return this.db.collection('nearby_drivers').find().sort({ distance_km: 1 }).toArray();
    }
    async getPartnerJobs() {
        return this.db.collection('partner_jobs').find().sort({ distance_km: 1 }).toArray();
    }
    async updatePartnerJobStatus(id, status) {
        await this.db.collection('partner_jobs').updateOne({ id }, { $set: { status } });
    }
    async getTestimonials() {
        return this.db.collection('testimonials').find().sort({ rating: -1 }).toArray();
    }
    async getPricingPlans() {
        return this.db.collection('pricing_plans').find().sort({ price: 1 }).toArray();
    }
    async submitRating(rating) {
        const id = crypto.randomUUID();
        await this.db.collection('user_ratings').insertOne({
            id,
            pickup_id: rating.pickupId,
            partner_name: rating.partnerName,
            rating: rating.rating,
            category_ratings: rating.categoryRatings,
            tags: rating.tags,
            review: rating.review,
            created_at: new Date().toISOString()
        });
    }
    async getMarketplaceListings() {
        return this.db.collection('marketplace_listings').find().sort({ posted_date: -1 }).toArray();
    }
}
export const db = DB_TYPE === 'mongodb' ? new MongoDBAdapter() : new SQLiteAdapter();
