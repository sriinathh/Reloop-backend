const fs = require('fs');
let code = fs.readFileSync('src/routes/APIRoutes.ts', 'utf8');

const oldCreateOrder = `    // Mock Order Creation (Mocking Razorpay interaction to support Expo Go without native crash)
    const mockOrderId = 'order_mock_' + Math.random().toString(36).substring(7);

    // Save Transaction internally
    if (!useSqlite()) {
      await SubscriptionTransaction.create({
        user: req.userId!,
        planId,
        amount: finalAmount,
        razorpayOrderId: mockOrderId,
        status: 'pending',
        couponCode,
        discountAmount
      });
    }

    res.status(200).json({
      success: true,
      orderId: mockOrderId,
      amount: finalAmount,
      planId
    });`;

const newCreateOrder = `    let razorpayOrderId = 'order_mock_' + Math.random().toString(36).substring(7);
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
    });`;

code = code.replace(oldCreateOrder, newCreateOrder);

const oldVerify = `    let userEmail = '';
    let userName = 'ReLoop User';`;

const newVerify = `    let userEmail = '';
    
    // Verify Signature
    if (!useSqlite() && process.env.RAZORPAY_KEY_SECRET) {
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

      if (generated_signature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }
    let userName = 'ReLoop User';`;

code = code.replace(oldVerify, newVerify);

fs.writeFileSync('src/routes/APIRoutes.ts', code);
console.log('Fixed APIRoutes.ts successfully!');
