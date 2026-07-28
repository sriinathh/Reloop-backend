const fs = require('fs');
let code = fs.readFileSync('src/routes/APIRoutes.ts', 'utf8');

const regex = /\/\/ ─── 18\. RECYCLING CENTERS \& PAYOUTS \(NEW\) ──────────────────────────────────────[\s\S]+?res\.status\(500\)\.json\(\{ success: false, message: error\.message \}\);\n  \}\n\}\);/g;

const replacement = `// ─── 18. RECYCLING CENTERS & PAYOUTS (NEW) ──────────────────────────────────────

router.get('/recycling-centers', async (req, res) => {
  try {
    const mockCenters = [
      { id: '1', name: 'Jubilee Hills Smart Bin', location: { latitude: 17.4326, longitude: 78.4071 }, address: 'Jubilee Hills, Road No 36', capacity: 80, isFull: false, supportedTypes: ['Plastic', 'Paper', 'Glass'], distanceKm: 1.2, isActive: true },
      { id: '2', name: 'Banjara Hills E-Waste Center', location: { latitude: 17.4156, longitude: 78.4347 }, address: 'Banjara Hills, Road No 12', capacity: 45, isFull: false, supportedTypes: ['E-Waste', 'Metal'], distanceKm: 2.5, isActive: true },
      { id: '3', name: 'Madhapur Mega Hub', location: { latitude: 17.4483, longitude: 78.3915 }, address: 'Inorbit Mall Road, Madhapur', capacity: 95, isFull: true, supportedTypes: ['All'], distanceKm: 3.8, isActive: false }
    ];
    res.json(mockCenters);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payouts/request', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { amount, method } = req.body;
    const userId = req.userId;
    
    if (!useSqlite()) {
      const wallet = await Wallet.findOne({ user: userId });
      if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });
      
      if (wallet.balance < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
      }
      
      // Deduct balance
      wallet.balance -= amount;
      await wallet.save();
      
      // Create transaction
      const tx = await WalletTransaction.create({
        user: userId,
        type: 'withdrawal',
        amount,
        status: 'pending',
        description: \`Withdrawal request via \${method || 'Bank Transfer'}\`
      });
      
      return res.status(201).json({ success: true, transaction: tx, newBalance: wallet.balance });
    }
    
    res.status(201).json({ success: true, message: 'Withdrawal requested (mock)', newBalance: 1200 - amount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── 14. PAYMENT & SUBSCRIPTION ROUTER (/api/payment) ──────────────────────

router.get('/payment/plans', async (req, res) => {
  try {
    const plans = [
      { id: 'free', name: 'Free', price: 0, duration: 'Forever', features: ['Basic recycling pickups', 'Standard AI detection', 'Standard rewards (1x)'] },
      { id: 'basic_49', name: 'Premium', price: 49, duration: '3 Months', features: ['Priority pickups (within 48h)', '1.5x Eco Rewards multiplier', 'Advanced AI scanning'] },
      { id: 'premium_99', name: 'Pro', price: 99, duration: '6 Months', features: ['Premium pickups (within 24h)', '2x Eco Rewards multiplier', 'Premium support & Zero fees', 'Unlimited AI Scans'] },
    ];
    res.status(200).json({ success: true, plans });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payment/apply-coupon', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { code, amount } = req.body;
    if (useSqlite()) {
      return res.status(200).json({ success: true, discountAmount: amount * 0.1, finalAmount: amount * 0.9, message: '10% discount applied (Mock SQLite)' });
    }
    const coupon = await SubscriptionCoupon.findOne({ code: code.toUpperCase(), isActive: true });
    if (!coupon) return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
    if (coupon.validUntil < new Date()) return res.status(400).json({ success: false, message: 'Coupon expired' });
    if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    if (coupon.minOrderValue && amount < coupon.minOrderValue) return res.status(400).json({ success: false, message: \`Minimum order value of ₹\${coupon.minOrderValue} required\` });

    let discountAmount = 0;
    if (coupon.discountType === 'flat') {
      discountAmount = coupon.discountValue;
    } else {
      discountAmount = amount * (coupon.discountValue / 100);
      if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) discountAmount = coupon.maxDiscount;
    }

    res.status(200).json({ success: true, discountAmount, finalAmount: amount - discountAmount, message: 'Coupon applied successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/payment/create-order', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { amount, planId, couponCode } = req.body;
    if (amount === undefined || !planId) return res.status(400).json({ success: false, message: 'Amount and Plan ID required' });

    // Validate Coupon if applied
    let finalAmount = amount;
    let discountAmount = 0;
    if (!useSqlite() && couponCode) {
      const coupon = await SubscriptionCoupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
      if (coupon && coupon.validUntil > new Date()) {
        if (coupon.discountType === 'flat') {
          discountAmount = coupon.discountValue;
        } else {
          discountAmount = amount * (coupon.discountValue / 100);
          if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) discountAmount = coupon.maxDiscount;
        }
        finalAmount = amount - discountAmount;
      }
    }

    let razorpayOrderId = 'order_mock_' + Math.random().toString(36).substring(7);
    if (!useSqlite()) {
      try {
        const options = { amount: Math.round(finalAmount * 100), currency: 'INR', receipt: 'rcpt_' + Date.now() };
        const order = await razorpayInstance.orders.create(options);
        razorpayOrderId = order.id;
      } catch(err) { console.error('RPay Error', err); }

      await SubscriptionTransaction.create({
        user: req.userId!,
        planId,
        amount: finalAmount,
        razorpayOrderId,
        status: 'pending',
        couponCode,
        discountAmount
      });
    }

    res.status(200).json({
      success: true,
      orderId: razorpayOrderId,
      amount: finalAmount,
      planId
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});`;

const newCode = code.replace(regex, replacement);
fs.writeFileSync('src/routes/APIRoutes.ts', newCode);
console.log('Fixed APIRoutes.ts');
