import type { Database } from 'sqlite';
import path from 'path';

let dbInstance: Database | null = null;

export const getSqliteDb = async (): Promise<Database> => {
  if (dbInstance) return dbInstance;

  const sqlite3 = await import('sqlite3').then((m: any) => m.default || m);
  const { open } = await import('sqlite');

  const dbPath = path.resolve(process.cwd(), 'reloop.db');
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log(`[SQLite Database] Connected to local file database: ${dbPath}`);

  // Create tables if they do not exist
  await dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      password TEXT,
      name TEXT NOT NULL,
      google_id TEXT UNIQUE,
      role TEXT DEFAULT 'customer',
      refresh_token TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      eco_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      balance REAL DEFAULT 0,
      aadhaar_verified INTEGER DEFAULT 0,
      account_number TEXT,
      joined_date TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_wallets (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      balance REAL DEFAULT 0,
      eco_points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      upi_id TEXT,
      bank_name TEXT,
      account_number TEXT,
      ifsc_code TEXT
    );
  `);

  return dbInstance;
};

// ─── SQLITE HELPER METHODS FOR AUTH & USER PROFILES ─────────────────────────
export const sqliteFindUserByEmail = async (email: string) => {
  const db = await getSqliteDb();
  return db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
};

export const sqliteFindUserByPhone = async (phone: string) => {
  const db = await getSqliteDb();
  return db.get('SELECT * FROM users WHERE phone = ?', [phone]);
};

export const sqliteCreateUser = async (data: {
  id: string;
  email: string;
  name: string;
  password?: string;
  phone?: string;
  googleId?: string;
}) => {
  const db = await getSqliteDb();
  await db.run(
    `INSERT INTO users (id, email, name, password, phone, google_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [data.id, data.email.toLowerCase(), data.name, data.password || null, data.phone || null, data.googleId || null]
  );

  await db.run(
    `INSERT INTO user_profiles (id, name, email, phone) VALUES (?, ?, ?, ?)`,
    [data.id, data.name, data.email, data.phone || null]
  );

  await db.run(
    `INSERT INTO user_wallets (id, user_id, balance, eco_points, level) VALUES (?, ?, ?, ?, ?)`,
    [data.id, data.id, 0, 0, 1]
  );

  return sqliteFindUserByEmail(data.email);
};

export const sqliteGetUserProfile = async (userId: string) => {
  const db = await getSqliteDb();
  const profile = await db.get('SELECT * FROM user_profiles WHERE id = ?', [userId]);
  const wallet = await db.get('SELECT * FROM user_wallets WHERE user_id = ?', [userId]);
  
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    avatarUrl: profile.avatar_url,
    ecoPoints: wallet?.eco_points || 0,
    balance: wallet?.balance || 0,
    level: wallet?.level || 1,
    aadhaarVerified: !!profile.aadhaar_verified,
    accountNumber: wallet?.account_number || ''
  };
};
