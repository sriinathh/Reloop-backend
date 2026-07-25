import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, sparse: true, trim: true },
    password: { type: String },
    role: { type: String, enum: ['customer', 'partner', 'admin', 'company'], default: 'customer' },
    googleId: { type: String, unique: true, sparse: true },
    refreshToken: { type: String },
    createdAt: { type: Date, default: Date.now }
});
export const User = mongoose.model('User', UserSchema);
const ProfileSchema = new Schema({
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
export const Profile = mongoose.model('Profile', ProfileSchema);
const AddressSchema = new Schema({
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
export const Address = mongoose.model('Address', AddressSchema);
const KycSchema = new Schema({
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
export const Kyc = mongoose.model('Kyc', KycSchema);
const WalletSchema = new Schema({
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
export const Wallet = mongoose.model('Wallet', WalletSchema);
const WalletTransactionSchema = new Schema({
    wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit', 'withdrawal'], required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    description: { type: String, required: true },
    date: { type: Date, default: Date.now },
    referenceId: { type: String, required: true, unique: true }
});
export const WalletTransaction = mongoose.model('WalletTransaction', WalletTransactionSchema);
const WithdrawalSchema = new Schema({
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
export const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);
const PickupSchema = new Schema({
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
export const Pickup = mongoose.model('Pickup', PickupSchema);
const WasteCategorySchema = new Schema({
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
export const WasteCategory = mongoose.model('WasteCategory', WasteCategorySchema);
const BadgeSchema = new Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: 'award' },
    color: { type: String, default: '#10B981' },
    threshold: { type: Number, default: 0 }
});
export const Badge = mongoose.model('Badge', BadgeSchema);
const ChallengeSchema = new Schema({
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
export const Challenge = mongoose.model('Challenge', ChallengeSchema);
const LeaderboardSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    avatarUrl: { type: String },
    points: { type: Number, default: 0 },
    rank: { type: Number },
    month: { type: String, required: true }
});
export const Leaderboard = mongoose.model('Leaderboard', LeaderboardSchema);
const CertificateSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    certificateNumber: { type: String, required: true, unique: true },
    type: { type: String, enum: ['CO2_SAVER', 'RECYCLER_PRO', 'GREEN_CHAMPION'], required: true },
    issuedAt: { type: Date, default: Date.now },
    pdfUrl: { type: String }
});
export const Certificate = mongoose.model('Certificate', CertificateSchema);
const EcoItemSchema = new Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    pointsCost: { type: Number, required: true },
    imageUrl: { type: String, required: true },
    stock: { type: Number, default: 10 }
});
export const EcoItem = mongoose.model('EcoItem', EcoItemSchema);
const EcoOrderSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    item: { type: Schema.Types.ObjectId, ref: 'EcoItem', required: true },
    status: { type: String, enum: ['ordered', 'shipped', 'delivered'], default: 'ordered' },
    pointsSpent: { type: Number, required: true },
    orderedAt: { type: Date, default: Date.now }
});
export const EcoOrder = mongoose.model('EcoOrder', EcoOrderSchema);
const SupportTicketSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ['Open', 'Resolved', 'Closed'], default: 'Open' },
    createdAt: { type: Date, default: Date.now }
});
export const SupportTicket = mongoose.model('SupportTicket', SupportTicketSchema);
const ReferralSchema = new Schema({
    referrer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredEmail: { type: String, required: true },
    status: { type: String, enum: ['invited', 'registered', 'rewarded'], default: 'invited' },
    createdAt: { type: Date, default: Date.now }
});
export const Referral = mongoose.model('Referral', ReferralSchema);
const NotificationSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['wallet', 'pickup', 'rewards', 'community', 'ai', 'system'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    icon: { type: String, default: 'bell' },
    color: { type: String, default: '#10B981' },
    timestamp: { type: Date, default: Date.now }
});
export const Notification = mongoose.model('Notification', NotificationSchema);
const AiScanSchema = new Schema({
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
export const AiScan = mongoose.model('AiScan', AiScanSchema);
const AiChatSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: String, enum: ['user', 'bot'], required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});
export const AiChat = mongoose.model('AiChat', AiChatSchema);
const LanguageTranslationSchema = new Schema({
    languageCode: { type: String, required: true, unique: true },
    translations: { type: Map, of: String, required: true }
});
export const LanguageTranslation = mongoose.model('LanguageTranslation', LanguageTranslationSchema);
const CommunityPostSchema = new Schema({
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
export const CommunityPost = mongoose.model('CommunityPost', CommunityPostSchema);
const AuditLogSchema = new Schema({
    userId: { type: String },
    action: { type: String, required: true },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now }
});
export const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
const CompanySchema = new Schema({
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
export const Company = mongoose.model('Company', CompanySchema);
const CampaignSchema = new Schema({
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
export const Campaign = mongoose.model('Campaign', CampaignSchema);
const RewardSchema = new Schema({
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
export const Reward = mongoose.model('Reward', RewardSchema);
const PayoutSchema = new Schema({
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
export const Payout = mongoose.model('Payout', PayoutSchema);
const InvoiceSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payout: { type: Schema.Types.ObjectId, ref: 'Payout', required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    pdfUrl: { type: String },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});
export const Invoice = mongoose.model('Invoice', InvoiceSchema);
const PartnerProfileSchema = new Schema({
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
export const PartnerProfile = mongoose.model('PartnerProfile', PartnerProfileSchema);
const DriverSchema = new Schema({
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
export const Driver = mongoose.model('Driver', DriverSchema);
const CollectionCenterSchema = new Schema({
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
export const CollectionCenter = mongoose.model('CollectionCenter', CollectionCenterSchema);
const PartnerTransactionSchema = new Schema({
    partner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pickupId: { type: Schema.Types.ObjectId, ref: 'Pickup' },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['Credit', 'Debit'], required: true },
    description: { type: String },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Pending' },
    referenceNumber: { type: String }
});
export const PartnerTransaction = mongoose.model('PartnerTransaction', PartnerTransactionSchema);
const CampaignBudgetSchema = new Schema({
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, unique: true },
    allocatedBudget: { type: Number, required: true },
    spentBudget: { type: Number, default: 0 },
    pendingRewards: { type: Number, default: 0 },
    remainingBudget: { type: Number, required: true }
}, { timestamps: true });
export const CampaignBudget = mongoose.model('CampaignBudget', CampaignBudgetSchema);
const CompanyTransactionSchema = new Schema({
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
export const CompanyTransaction = mongoose.model('CompanyTransaction', CompanyTransactionSchema);
const CampaignReportSchema = new Schema({
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
export const CampaignReport = mongoose.model('CampaignReport', CampaignReportSchema);
const RedemptionSchema = new Schema({
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
export const Redemption = mongoose.model('Redemption', RedemptionSchema);
const GiftCardSchema = new Schema({
    brandName: { type: String, required: true },
    voucherCode: { type: String, required: true, unique: true },
    pin: { type: String, required: true },
    coinCost: { type: Number, required: true },
    status: { type: String, enum: ['Available', 'Redeemed'], default: 'Available' }
});
export const GiftCard = mongoose.model('GiftCard', GiftCardSchema);
const CouponSchema = new Schema({
    brandName: { type: String, required: true },
    discountCode: { type: String, required: true, unique: true },
    coinCost: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    status: { type: String, enum: ['Available', 'Redeemed'], default: 'Available' }
});
export const Coupon = mongoose.model('Coupon', CouponSchema);
const ScrapListingSchema = new Schema({
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
export const ScrapListing = mongoose.model('ScrapListing', ScrapListingSchema);
const MaterialPriceSchema = new Schema({
    category: { type: String, required: true },
    material: { type: String, required: true, unique: true },
    pricePerKg: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now }
});
export const MaterialPrice = mongoose.model('MaterialPrice', MaterialPriceSchema);
