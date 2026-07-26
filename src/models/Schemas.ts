import mongoose, { Schema, Document } from 'mongoose';

// ─── 1. USER SCHEMA ──────────────────────────────────────────────────────────
export interface IUser extends Document {
  email: string;
  phone?: string;
  password?: string;
  name?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  aadhaarVerified?: boolean;
  aadhaarData?: any;
  subscriptionPlan?: 'free' | 'premium';
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'expired';
  subscriptionStartDate?: Date;
  subscriptionExpiryDate?: Date;
  paymentHistory?: any[];
  invoiceHistory?: any[];
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  upiId?: string;
  qrImage?: string;
  wallet?: number;
  rewardBalance?: number;
  profileCompleted?: boolean;
  role: 'customer' | 'partner' | 'admin' | 'company';
  googleId?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt?: Date;
}


const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String },
  name: { type: String },
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  aadhaarVerified: { type: Boolean, default: false },
  aadhaarData: { type: Schema.Types.Mixed },
  subscriptionPlan: { type: String, enum: ['free', 'premium'], default: 'free' },
  subscriptionStatus: { type: String, enum: ['active', 'inactive', 'cancelled', 'expired'], default: 'inactive' },
  subscriptionStartDate: { type: Date },
  subscriptionExpiryDate: { type: Date },
  paymentHistory: { type: [Schema.Types.Mixed], default: [] },
  invoiceHistory: { type: [Schema.Types.Mixed], default: [] },
  bankDetails: {
    accountHolderName: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
  },
  upiId: { type: String },
  qrImage: { type: String },
  wallet: { type: Number, default: 0 },
  rewardBalance: { type: Number, default: 0 },
  profileCompleted: { type: Boolean, default: false },
  role: { type: String, enum: ['customer', 'partner', 'admin', 'company'], default: 'customer' },
  googleId: { type: String, unique: true, sparse: true },
  refreshToken: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);

// ─── 2. PROFILE SCHEMA ────────────────────────────────────────────────────────
export interface IProfile extends Document {
  user: mongoose.Types.ObjectId;
  name: string;
  avatarUrl?: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  address?: string;
  languages: string[];
  aadhaarNumber?: string;
  panNumber?: string;
  kycStatus: 'Pending' | 'Verified' | 'Rejected';
  notificationPreferences: {
    wallet: boolean;
    pickup: boolean;
    rewards: boolean;
    community: boolean;
    ai: boolean;
    system: boolean;
  };
  joinedDate: Date;
}

const ProfileSchema = new Schema<IProfile>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true },
  avatarUrl: { type: String, default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' },
  dob: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  address: { type: String },
  languages: { type: [String], default: ['English'] },
  aadhaarNumber: { type: String },
  panNumber: { type: String },
  kycStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  notificationPreferences: {
    wallet: { type: Boolean, default: true },
    pickup: { type: Boolean, default: true },
    rewards: { type: Boolean, default: true },
    community: { type: Boolean, default: true },
    ai: { type: Boolean, default: true },
    system: { type: Boolean, default: true }
  },
  joinedDate: { type: Date, default: Date.now }
});

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);

// ─── 3. ADDRESS SCHEMA ───────────────────────────────────────────────────────
export interface IAddress extends Document {
  user: mongoose.Types.ObjectId;
  label: string; // e.g. Home, Work, Office
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

const AddressSchema = new Schema<IAddress>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  label: { type: String, required: true, default: 'Home' },
  addressLine1: { type: String, required: true },
  addressLine2: { type: String },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  isDefault: { type: Boolean, default: false }
});

export const Address = mongoose.model<IAddress>('Address', AddressSchema);

// ─── 4. KYC SCHEMA ───────────────────────────────────────────────────────────
export interface IKyc extends Document {
  user: mongoose.Types.ObjectId;
  aadhaarNumber?: string;
  aadhaarFrontUrl?: string;
  aadhaarBackUrl?: string;
  ocrExtractedData?: any;
  status: 'Pending' | 'Verified' | 'Rejected';
  rejectionReason?: string;
  verifiedAt?: Date;
  verificationMethod: 'AADHAAR' | 'MANUAL';
}

const KycSchema = new Schema<IKyc>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  aadhaarNumber: { type: String },
  aadhaarFrontUrl: { type: String },
  aadhaarBackUrl: { type: String },
  ocrExtractedData: { type: Schema.Types.Mixed },
  status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  rejectionReason: { type: String },
  verifiedAt: { type: Date },
  verificationMethod: { type: String, enum: ['AADHAAR', 'MANUAL'], default: 'AADHAAR' }
});

export const Kyc = mongoose.model<IKyc>('Kyc', KycSchema);

// ─── 5. WALLET SCHEMA ────────────────────────────────────────────────────────
export interface IWallet extends Document {
  user: mongoose.Types.ObjectId;
  balance: number;
  ecoPoints: number;
  level: number;
  totalRewardsEarned: number;
  pendingRewards: number;
  totalPaid: number;
  availableCoins?: number;
  lifetimeCoins?: number;
  coinsEarned?: number;
  coinsRedeemed?: number;
  totalRewards?: number;
  upiId?: string;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  preferredPayoutMethod?: 'BANK' | 'UPI';
  upiQrUrl?: string;
  bankDetailsSavedAt?: Date;
}

const WalletSchema = new Schema<IWallet>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0 },
  ecoPoints: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  totalRewardsEarned: { type: Number, default: 0 },
  pendingRewards: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  availableCoins: { type: Number, default: 0 },
  lifetimeCoins: { type: Number, default: 0 },
  coinsEarned: { type: Number, default: 0 },
  coinsRedeemed: { type: Number, default: 0 },
  totalRewards: { type: Number, default: 0 },
  upiId: { type: String },
  bankName: { type: String },
  accountHolderName: { type: String },
  accountNumber: { type: String },
  ifscCode: { type: String },
  branch: { type: String },
  preferredPayoutMethod: { type: String, enum: ['BANK', 'UPI'] },
  upiQrUrl: { type: String },
  bankDetailsSavedAt: { type: Date }
});

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);

// ─── 6. WALLET TRANSACTION SCHEMA ────────────────────────────────────────────
export interface IWalletTransaction extends Document {
  wallet: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  type: 'credit' | 'debit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description: string;
  date: Date;
  referenceId: string;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>({
  wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['credit', 'debit', 'withdrawal'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  referenceId: { type: String, required: true, unique: true }
});

export const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

// ─── 7. WITHDRAWAL SCHEMA ────────────────────────────────────────────────────
export interface IWithdrawal extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  method: 'UPI' | 'BANK';
  status: 'Pending' | 'Approved' | 'Rejected';
  details: {
    upiId?: string;
    bankName?: string;
    accountNumber?: string;
    ifscCode?: string;
  };
  createdAt: Date;
  processedAt?: Date;
}

const WithdrawalSchema = new Schema<IWithdrawal>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['UPI', 'BANK'], required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  details: {
    upiId: { type: String },
    bankName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

export const Withdrawal = mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);

// ─── 8. PICKUP SCHEMA ────────────────────────────────────────────────────────
export interface IPickup extends Document {
  user: mongoose.Types.ObjectId;
  wasteCategoryId: string;
  wasteCategoryName: string;
  status: 'pending' | 'accepted' | 'en_route' | 'collected' | 'delivered' | 'completed' | 'cancelled';
  estimatedWeightKg: number;
  estimatedPrice: number;
  actualWeightKg?: number;
  actualPrice?: number;
  address: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: Date;
  partnerName?: string;
  partnerPhone?: string;
  driver?: mongoose.Types.ObjectId;
  otp?: string;
  qrCode?: string;
  photoUrl?: string;
  notes?: string;
  createdAt: Date;
  completedAt?: Date;
}

const PickupSchema = new Schema<IPickup>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  wasteCategoryId: { type: String, required: true },
  wasteCategoryName: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'en_route', 'collected', 'delivered', 'completed', 'cancelled'], default: 'pending' },
  estimatedWeightKg: { type: Number, required: true },
  estimatedPrice: { type: Number, required: true },
  actualWeightKg: { type: Number },
  actualPrice: { type: Number },
  address: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  scheduledDate: { type: Date, required: true },
  partnerName: { type: String },
  partnerPhone: { type: String },
  driver: { type: Schema.Types.ObjectId, ref: 'User' },
  otp: { type: String },
  qrCode: { type: String },
  photoUrl: { type: String },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

export const Pickup = mongoose.model<IPickup>('Pickup', PickupSchema);

// ─── 9. WASTE CATEGORY SCHEMA ────────────────────────────────────────────────
export interface IWasteCategory extends Document {
  id: string;
  name: string;
  category: string;
  icon: string;
  pricePerKg: number;
  co2SavedPerKg: number;
  color: string;
  isRecyclable: boolean;
  description?: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

const WasteCategorySchema = new Schema<IWasteCategory>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  icon: { type: String, default: 'recycle' },
  pricePerKg: { type: Number, default: 0 },
  co2SavedPerKg: { type: Number, default: 0 },
  color: { type: String, default: '#10B981' },
  isRecyclable: { type: Boolean, default: true },
  description: { type: String },
  trend: { type: String, enum: ['up', 'down', 'stable'], default: 'stable' },
  trendPercent: { type: Number, default: 0 }
});

export const WasteCategory = mongoose.model<IWasteCategory>('WasteCategory', WasteCategorySchema);

// ─── 10. REWARD & CHALLENGE SCHEMA ───────────────────────────────────────────
export interface IBadge extends Document {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  threshold: number;
}

const BadgeSchema = new Schema<IBadge>({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  icon: { type: String, default: 'award' },
  color: { type: String, default: '#10B981' },
  threshold: { type: Number, default: 0 }
});

export const Badge = mongoose.model<IBadge>('Badge', BadgeSchema);

export interface IChallenge extends Document {
  id: string;
  title: string;
  description: string;
  targetKg: number;
  currentKg: number;
  rewardPoints: number;
  icon: string;
  color: string;
  endsAt: Date;
  isActive: boolean;
}

const ChallengeSchema = new Schema<IChallenge>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  targetKg: { type: Number, default: 0 },
  currentKg: { type: Number, default: 0 },
  rewardPoints: { type: Number, default: 0 },
  icon: { type: String, default: 'trophy' },
  color: { type: String, default: '#10B981' },
  endsAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true }
});

export const Challenge = mongoose.model<IChallenge>('Challenge', ChallengeSchema);

// ─── 11. LEADERBOARD SCHEMA ──────────────────────────────────────────────────
export interface ILeaderboard extends Document {
  user: mongoose.Types.ObjectId;
  userName: string;
  avatarUrl?: string;
  points: number;
  rank: number;
  month: string; // e.g. "2026-07"
}

const LeaderboardSchema = new Schema<ILeaderboard>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  avatarUrl: { type: String },
  points: { type: Number, default: 0 },
  rank: { type: Number },
  month: { type: String, required: true }
});

export const Leaderboard = mongoose.model<ILeaderboard>('Leaderboard', LeaderboardSchema);

// ─── 12. CERTIFICATE SCHEMA ──────────────────────────────────────────────────
export interface ICertificate extends Document {
  user: mongoose.Types.ObjectId;
  certificateNumber: string;
  type: 'CO2_SAVER' | 'RECYCLER_PRO' | 'GREEN_CHAMPION';
  issuedAt: Date;
  pdfUrl?: string;
}

const CertificateSchema = new Schema<ICertificate>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  certificateNumber: { type: String, required: true, unique: true },
  type: { type: String, enum: ['CO2_SAVER', 'RECYCLER_PRO', 'GREEN_CHAMPION'], required: true },
  issuedAt: { type: Date, default: Date.now },
  pdfUrl: { type: String }
});

export const Certificate = mongoose.model<ICertificate>('Certificate', CertificateSchema);

// ─── 13. ECO STORE & ORDERS SCHEMA ───────────────────────────────────────────
export interface IEcoItem extends Document {
  name: string;
  description: string;
  pointsCost: number;
  imageUrl: string;
  stock: number;
}

const EcoItemSchema = new Schema<IEcoItem>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  pointsCost: { type: Number, required: true },
  imageUrl: { type: String, required: true },
  stock: { type: Number, default: 10 }
});

export const EcoItem = mongoose.model<IEcoItem>('EcoItem', EcoItemSchema);

export interface IEcoOrder extends Document {
  user: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;
  status: 'ordered' | 'shipped' | 'delivered';
  pointsSpent: number;
  orderedAt: Date;
}

const EcoOrderSchema = new Schema<IEcoOrder>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  item: { type: Schema.Types.ObjectId, ref: 'EcoItem', required: true },
  status: { type: String, enum: ['ordered', 'shipped', 'delivered'], default: 'ordered' },
  pointsSpent: { type: Number, required: true },
  orderedAt: { type: Date, default: Date.now }
});

export const EcoOrder = mongoose.model<IEcoOrder>('EcoOrder', EcoOrderSchema);

// ─── 14. SUPPORT TICKET SCHEMA ───────────────────────────────────────────────
export interface ISupportTicket extends Document {
  user: mongoose.Types.ObjectId;
  subject: string;
  message: string;
  status: 'Open' | 'Resolved' | 'Closed';
  createdAt: Date;
}

const SupportTicketSchema = new Schema<ISupportTicket>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['Open', 'Resolved', 'Closed'], default: 'Open' },
  createdAt: { type: Date, default: Date.now }
});

export const SupportTicket = mongoose.model<ISupportTicket>('SupportTicket', SupportTicketSchema);

// ─── 15. REFERRAL & PROMO CODES SCHEMA ───────────────────────────────────────
export interface IReferral extends Document {
  referrer: mongoose.Types.ObjectId;
  referredEmail: string;
  status: 'invited' | 'registered' | 'rewarded';
  createdAt: Date;
}

const ReferralSchema = new Schema<IReferral>({
  referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  referredEmail: { type: String, required: true },
  status: { type: String, enum: ['invited', 'registered', 'rewarded'], default: 'invited' },
  createdAt: { type: Date, default: Date.now }
});

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);

// ─── 16. NOTIFICATION SCHEMA ──────────────────────────────────────────────────
export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  type: 'wallet' | 'pickup' | 'rewards' | 'community' | 'ai' | 'system';
  title: string;
  message: string;
  read: boolean;
  icon: string;
  color: string;
  timestamp: Date;
}

const NotificationSchema = new Schema<INotification>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['wallet', 'pickup', 'rewards', 'community', 'ai', 'system'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  icon: { type: String, default: 'bell' },
  color: { type: String, default: '#10B981' },
  timestamp: { type: Date, default: Date.now }
});

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// ─── 17. AI SCAN HISTORY SCHEMA ──────────────────────────────────────────────
export interface IAiScan extends Document {
  user: mongoose.Types.ObjectId;
  imageUrl: string;
  detectedClass: string;
  estimatedWeightKg: number;
  estimatedPrice: number;
  confidenceScore: number;
  suggestions: string[];
  object?: string;
  category?: string;
  material?: string;
  pricePerKg?: number;
  rlCoins?: number;
  recyclable?: boolean;
  pickupAvailable?: boolean;
  scannedAt: Date;
}

const AiScanSchema = new Schema<IAiScan>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  imageUrl: { type: String, required: true },
  detectedClass: { type: String, required: true },
  estimatedWeightKg: { type: Number, required: true },
  estimatedPrice: { type: Number, required: true },
  confidenceScore: { type: Number, required: true },
  suggestions: { type: [String], default: [] },
  object: { type: String },
  category: { type: String },
  material: { type: String },
  pricePerKg: { type: Number },
  rlCoins: { type: Number },
  recyclable: { type: Boolean, default: true },
  pickupAvailable: { type: Boolean, default: true },
  scannedAt: { type: Date, default: Date.now }
});

export const AiScan = mongoose.model<IAiScan>('AiScan', AiScanSchema);

// ─── 18. AI CHAT SCHEMA ──────────────────────────────────────────────────────
export interface IAiChat extends Document {
  user: mongoose.Types.ObjectId;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
}

const AiChatSchema = new Schema<IAiChat>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: String, enum: ['user', 'bot'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

export const AiChat = mongoose.model<IAiChat>('AiChat', AiChatSchema);

// ─── 19. LANGUAGE SCHEMA ─────────────────────────────────────────────────────
export interface ILanguageTranslation extends Document {
  languageCode: string; // e.g. en, hi, te
  translations: Record<string, string>; // key-value pairs
}

const LanguageTranslationSchema = new Schema<ILanguageTranslation>({
  languageCode: { type: String, required: true, unique: true },
  translations: { type: Map, of: String, required: true }
});

export const LanguageTranslation = mongoose.model<ILanguageTranslation>('LanguageTranslation', LanguageTranslationSchema);

// ─── 20. COMMUNITY POST SCHEMA ───────────────────────────────────────────────
export interface ICommunityPost extends Document {
  user: mongoose.Types.ObjectId;
  userName: string;
  avatarUrl?: string;
  content: string;
  imageUrl?: string;
  likes: mongoose.Types.ObjectId[]; // list of user ids
  comments: Array<{
    user: mongoose.Types.ObjectId;
    userName: string;
    avatarUrl?: string;
    text: string;
    createdAt: Date;
  }>;
  createdAt: Date;
}

const CommunityPostSchema = new Schema<ICommunityPost>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  avatarUrl: { type: String },
  content: { type: String, required: true },
  imageUrl: { type: String },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    avatarUrl: { type: String },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const CommunityPost = mongoose.model<ICommunityPost>('CommunityPost', CommunityPostSchema);

// ─── 21. AUDIT LOGS SCHEMA ───────────────────────────────────────────────────
export interface IAuditLog extends Document {
  userId?: string;
  action: string;
  ipAddress?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: String },
  action: { type: String, required: true },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// ─── 22. COMPANY SCHEMA ───────────────────────────────────────────────────────
export interface ICompany extends Document {
  user: mongoose.Types.ObjectId;
  companyName: string;
  registrationNumber: string;
  industry: string;
  contactEmail: string;
  contactPhone: string;
  website?: string;
  csrBudget: number;
  walletBalance: number;
  totalSpent: number;
  status: 'Pending' | 'Active' | 'Suspended';
  createdAt: Date;
}

const CompanySchema = new Schema<ICompany>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  industry: { type: String, required: true },
  contactEmail: { type: String, required: true },
  contactPhone: { type: String, required: true },
  website: { type: String },
  csrBudget: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending', 'Active', 'Suspended'], default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

export const Company = mongoose.model<ICompany>('Company', CompanySchema);

// ─── 23. CAMPAIGN SCHEMA ──────────────────────────────────────────────────────
export interface ICampaign extends Document {
  company: mongoose.Types.ObjectId;
  title: string;
  description: string;
  totalBudget: number;
  remainingBudget: number;
  rewardPerKg: number;
  targetWasteCategories: mongoose.Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  status: 'Draft' | 'Active' | 'Completed' | 'Cancelled';
  createdAt: Date;
}

const CampaignSchema = new Schema<ICampaign>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  totalBudget: { type: Number, required: true },
  remainingBudget: { type: Number, required: true },
  rewardPerKg: { type: Number, required: true },
  targetWasteCategories: [{ type: Schema.Types.ObjectId, ref: 'WasteCategory' }],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['Draft', 'Active', 'Completed', 'Cancelled'], default: 'Draft' },
  createdAt: { type: Date, default: Date.now }
});

export const Campaign = mongoose.model<ICampaign>('Campaign', CampaignSchema);

// ─── 24. REWARD SCHEMA (LEDGER) ────────────────────────────────────────────────
export interface IReward extends Document {
  user: mongoose.Types.ObjectId;
  pickup?: mongoose.Types.ObjectId;
  campaign?: mongoose.Types.ObjectId;
  amount: number;
  type: 'Pickup' | 'Referral' | 'CampaignBonus' | 'WeeklyBonus';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Paid';
  description: string;
  createdAt: Date;
  approvedAt?: Date;
}

const RewardSchema = new Schema<IReward>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  pickup: { type: Schema.Types.ObjectId, ref: 'PickupRequest' },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['Pickup', 'Referral', 'CampaignBonus', 'WeeklyBonus'], required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Paid'], default: 'Pending' },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date }
});

export const Reward = mongoose.model<IReward>('Reward', RewardSchema);

// ─── 25. PAYOUT SCHEMA ────────────────────────────────────────────────────────
export interface IPayout extends Document {
  user: mongoose.Types.ObjectId;
  amount: number;
  rewardsIncluded: mongoose.Types.ObjectId[];
  method: 'BANK' | 'UPI';
  destinationDetails: {
    accountNumber?: string;
    ifscCode?: string;
    upiId?: string;
  };
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled';
  gatewayReferenceId?: string;
  bankReferenceId?: string;
  failureReason?: string;
  createdAt: Date;
  processedAt?: Date;
}

const PayoutSchema = new Schema<IPayout>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  rewardsIncluded: [{ type: Schema.Types.ObjectId, ref: 'Reward' }],
  method: { type: String, enum: ['BANK', 'UPI'], required: true },
  destinationDetails: {
    accountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String }
  },
  status: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed', 'Cancelled'], default: 'Pending' },
  gatewayReferenceId: { type: String },
  bankReferenceId: { type: String },
  failureReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

export const Payout = mongoose.model<IPayout>('Payout', PayoutSchema);

// ─── 26. INVOICE SCHEMA ────────────────────────────────────────────────────────
export interface IInvoice extends Document {
  user: mongoose.Types.ObjectId;
  payout: mongoose.Types.ObjectId;
  invoiceNumber: string;
  pdfUrl?: string;
  amount: number;
  date: Date;
}

const InvoiceSchema = new Schema<IInvoice>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  payout: { type: Schema.Types.ObjectId, ref: 'Payout', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  pdfUrl: { type: String },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

export const Invoice = mongoose.model<IInvoice>('Invoice', InvoiceSchema);



// --- PARTNER SCHEMA -----------------------------------------------------------
export interface IPartnerProfile extends Document {
  user: mongoose.Types.ObjectId;
  companyName: string;
  gstNumber?: string;
  verificationStatus: 'Pending' | 'Verified' | 'Rejected';
  licenseUrl?: string;
  collectionCenter?: mongoose.Types.ObjectId;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    upiId?: string;
  };
}

const PartnerProfileSchema = new Schema<IPartnerProfile>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  companyName: { type: String, required: true },
  gstNumber: { type: String },
  verificationStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  licenseUrl: { type: String },
  collectionCenter: { type: Schema.Types.ObjectId, ref: 'CollectionCenter' },
  bankDetails: {
    accountName: { type: String },
    accountNumber: { type: String },
    ifscCode: { type: String },
    upiId: { type: String }
  }
});

export const PartnerProfile = mongoose.model<IPartnerProfile>('PartnerProfile', PartnerProfileSchema);

// --- DRIVER SCHEMA ------------------------------------------------------------
export interface IDriver extends Document {
  partner: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId; // Driver login user ref
  name: string;
  phone: string;
  vehicleDetails: {
    make: string;
    model: string;
    registrationNumber: string;
  };
  status: 'Available' | 'Busy' | 'Offline';
  rating: number;
}

const DriverSchema = new Schema<IDriver>({
  partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User' },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleDetails: {
    make: { type: String },
    model: { type: String },
    registrationNumber: { type: String }
  },
  status: { type: String, enum: ['Available', 'Busy', 'Offline'], default: 'Offline' },
  rating: { type: Number, default: 0 }
});

export const Driver = mongoose.model<IDriver>('Driver', DriverSchema);

// --- COLLECTION CENTER SCHEMA ----------------------------------------------
export interface ICollectionCenter extends Document {
  partner: mongoose.Types.ObjectId;
  name: string;
  address: string;
  capacity: number;
  inventory: {
    plastic: number;
    paper: number;
    glass: number;
    metal: number;
    eWaste: number;
    organic: number;
  };
}

const CollectionCenterSchema = new Schema<ICollectionCenter>({
  partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  address: { type: String },
  capacity: { type: Number, default: 0 },
  inventory: {
    plastic: { type: Number, default: 0 },
    paper: { type: Number, default: 0 },
    glass: { type: Number, default: 0 },
    metal: { type: Number, default: 0 },
    eWaste: { type: Number, default: 0 },
    organic: { type: Number, default: 0 }
  }
});

export const CollectionCenter = mongoose.model<ICollectionCenter>('CollectionCenter', CollectionCenterSchema);

// --- PARTNER TRANSACTIONS SCHEMA ------------------------------------------
export interface IPartnerTransaction extends Document {
  partner: mongoose.Types.ObjectId;
  pickupId?: mongoose.Types.ObjectId;
  amount: number;
  type: 'Credit' | 'Debit';
  description: string;
  date: Date;
  status: 'Pending' | 'Completed' | 'Failed';
  referenceNumber?: string;
}

const PartnerTransactionSchema = new Schema<IPartnerTransaction>({
  partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  pickupId: { type: Schema.Types.ObjectId, ref: 'Pickup' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['Credit', 'Debit'], required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
  referenceNumber: { type: String }
});

export const PartnerTransaction = mongoose.model<IPartnerTransaction>('PartnerTransaction', PartnerTransactionSchema);

// ─── ENTERPRISE COMPANY DASHBOARD SCHEMAS ──────────────────────────────────

export interface ICampaignBudget extends Document {
  campaign: mongoose.Types.ObjectId;
  allocatedBudget: number;
  spentBudget: number;
  pendingRewards: number;
  remainingBudget: number;
}

const CampaignBudgetSchema = new Schema<ICampaignBudget>({
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, unique: true },
  allocatedBudget: { type: Number, required: true },
  spentBudget: { type: Number, default: 0 },
  pendingRewards: { type: Number, default: 0 },
  remainingBudget: { type: Number, required: true }
}, { timestamps: true });

export const CampaignBudget = mongoose.model<ICampaignBudget>('CampaignBudget', CampaignBudgetSchema);

export interface ICompanyTransaction extends Document {
  company: mongoose.Types.ObjectId;
  campaign?: mongoose.Types.ObjectId;
  pickupId?: mongoose.Types.ObjectId;
  amount: number;
  type: 'Credit' | 'Debit';
  description: string;
  status: 'Pending' | 'Completed' | 'Failed';
  referenceNumber?: string;
  paymentGateway?: string;
}

const CompanyTransactionSchema = new Schema<ICompanyTransaction>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign' },
  pickupId: { type: Schema.Types.ObjectId, ref: 'Pickup' },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['Credit', 'Debit'], required: true },
  description: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
  referenceNumber: { type: String },
  paymentGateway: { type: String }
}, { timestamps: true });

export const CompanyTransaction = mongoose.model<ICompanyTransaction>('CompanyTransaction', CompanyTransactionSchema);

export interface ICampaignReport extends Document {
  company: mongoose.Types.ObjectId;
  campaign: mongoose.Types.ObjectId;
  month: number;
  year: number;
  totalPickups: number;
  totalWeightCollected: number;
  co2SavedKg: number;
  treesSaved: number;
  budgetSpent: number;
}

const CampaignReportSchema = new Schema<ICampaignReport>({
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  totalPickups: { type: Number, default: 0 },
  totalWeightCollected: { type: Number, default: 0 },
  co2SavedKg: { type: Number, default: 0 },
  treesSaved: { type: Number, default: 0 },
  budgetSpent: { type: Number, default: 0 }
}, { timestamps: true });

export const CampaignReport = mongoose.model<ICampaignReport>('CampaignReport', CampaignReportSchema);

// ─── 27. REDEMPTION SCHEMA ─────────────────────────────────────────────────────
export interface IRedemption extends Document {
  user: mongoose.Types.ObjectId;
  category: 'Gift Card' | 'Coupon' | 'Mobile Recharge' | 'Shopping Voucher' | 'Tree Plantation' | 'Charity Donation' | 'Premium Membership' | 'Merchandise';
  itemDetails: {
    name: string;
    code?: string;
    pin?: string;
    phone?: string;
    provider?: string;
  };
  coinCost: number;
  status: 'Pending' | 'Completed' | 'Failed';
  createdAt: Date;
}

const RedemptionSchema = new Schema<IRedemption>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ['Gift Card', 'Coupon', 'Mobile Recharge', 'Shopping Voucher', 'Tree Plantation', 'Charity Donation', 'Premium Membership', 'Merchandise'], required: true },
  itemDetails: {
    name: { type: String, required: true },
    code: { type: String },
    pin: { type: String },
    phone: { type: String },
    provider: { type: String }
  },
  coinCost: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' },
  createdAt: { type: Date, default: Date.now }
});

export const Redemption = mongoose.model<IRedemption>('Redemption', RedemptionSchema);

// ─── 28. GIFT CARD SCHEMA ──────────────────────────────────────────────────────
export interface IGiftCard extends Document {
  brandName: string;
  voucherCode: string;
  pin: string;
  coinCost: number;
  status: 'Available' | 'Redeemed';
}

const GiftCardSchema = new Schema<IGiftCard>({
  brandName: { type: String, required: true },
  voucherCode: { type: String, required: true, unique: true },
  pin: { type: String, required: true },
  coinCost: { type: Number, required: true },
  status: { type: String, enum: ['Available', 'Redeemed'], default: 'Available' }
});

export const GiftCard = mongoose.model<IGiftCard>('GiftCard', GiftCardSchema);

// ─── 29. COUPON SCHEMA ─────────────────────────────────────────────────────────
export interface ICoupon extends Document {
  brandName: string;
  discountCode: string;
  coinCost: number;
  expiryDate: Date;
  status: 'Available' | 'Redeemed';
}

const CouponSchema = new Schema<ICoupon>({
  brandName: { type: String, required: true },
  discountCode: { type: String, required: true, unique: true },
  coinCost: { type: Number, required: true },
  expiryDate: { type: Date, required: true },
  status: { type: String, enum: ['Available', 'Redeemed'], default: 'Available' }
});

export const Coupon = mongoose.model<ICoupon>('Coupon', CouponSchema);

// ─── 30. MARKETPLACE SCRAP LISTING SCHEMA ──────────────────────────────────────
export interface IScrapListing extends Document {
  title: string;
  category: string;
  weightKg: number;
  pricePerKg: number;
  location: string;
  sellerName: string;
  phone: string;
  isVerified: boolean;
  status: 'Active' | 'Sold' | 'Archived';
  createdAt: Date;
  updatedAt: Date;
}

const ScrapListingSchema = new Schema<IScrapListing>({
  title: { type: String, required: true },
  category: { type: String, required: true },
  weightKg: { type: Number, required: true },
  pricePerKg: { type: Number, required: true },
  location: { type: String, required: true },
  sellerName: { type: String, required: true },
  phone: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Sold', 'Archived'], default: 'Active' },
}, { timestamps: true });

export const ScrapListing = mongoose.model<IScrapListing>('ScrapListing', ScrapListingSchema);

// ─── 31. MATERIAL PRICE SCHEMA ───────────────────────────────────────────────
export interface IMaterialPrice extends Document {
  category: string;
  material: string;
  pricePerKg: number;
  updatedAt: Date;
}

const MaterialPriceSchema = new Schema<IMaterialPrice>({
  category: { type: String, required: true },
  material: { type: String, required: true, unique: true },
  pricePerKg: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now }
});

export const MaterialPrice = mongoose.model<IMaterialPrice>('MaterialPrice', MaterialPriceSchema);
