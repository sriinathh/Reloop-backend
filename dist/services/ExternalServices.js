import { v2 as cloudinary } from 'cloudinary';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';
import { Readable } from 'stream';
dotenv.config();
import Razorpay from 'razorpay';
// ─── CLOUDINARY CONFIGURATION ────────────────────────────────────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'reloop-cloud',
    api_key: process.env.CLOUDINARY_API_KEY || '1234567890',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'secret'
});
// ─── RAZORPAY CONFIGURATION ──────────────────────────────────────────────────
export const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_123456789',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'secret123456789'
});
export const uploadToCloudinary = async (base64Data, folder) => {
    try {
        const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        return new Promise((resolve) => {
            const uploadStream = cloudinary.uploader.upload_stream({ folder: `reloop/${folder}` }, (error, result) => {
                if (error) {
                    console.error('[Cloudinary Upload Stream Error]:', error);
                    resolve('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
                }
                else {
                    resolve(result?.secure_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
                }
            });
            const stream = new Readable();
            stream.push(buffer);
            stream.push(null);
            stream.pipe(uploadStream);
        });
    }
    catch (error) {
        console.error('[Cloudinary Upload Error]:', error);
        return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'; // fallback
    }
};
// ─── RESEND EMAIL CONFIGURATION ──────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');
export const sendEmail = async (to, subject, htmlContent) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        if (apiKey && apiKey !== 're_123456789') {
            await resend.emails.send({
                from: 'ReLoop Recycling <onboarding@resend.dev>',
                to,
                subject,
                html: htmlContent
            });
            console.log(`[Resend Email Service] Delivered: "${subject}" to ${to}`);
        }
        else {
            console.log(`[Resend Email Service (Dev)] To: ${to} | Subject: "${subject}" | Content sent.`);
        }
    }
    catch (error) {
        console.error('[Email Send Error]:', error);
    }
};
// Reusable transactional email templates
export const emailTemplates = {
    welcome: (name) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #10B981;">Welcome to ReLoop, ${name}!</h2>
      <p>Thank you for joining our mission to turn waste into wealth. Log in to your mobile app to schedule your first smart pickup and start earning rewards!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #999;">ReLoop AI Team</small>
    </div>
  `,
    otp: (otp) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #10B981;">Your ReLoop Verification Code</h2>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #333;">${otp}</p>
      <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #999;">ReLoop AI Team</small>
    </div>
  `,
    pickupConfirmation: (id, date) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #10B981;">Pickup Scheduled Successfully</h2>
      <p>Your pickup request <b>#${id.slice(-6)}</b> has been confirmed for <b>${date}</b>.</p>
      <p>A pickup driver will contact you shortly. Keep your app open to track the live location.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #999;">ReLoop AI Team</small>
    </div>
  `
};
// ─── MISTRAL AI API SERVICE ──────────────────────────────────────────────────
// Custom prompt enforces chatbot remains as "ReLoop AI" and never mentions Mistral.
import { MaterialPrice } from '../models/Schemas.js';
export const analyzeWasteImage = async (imageBase64) => {
    try {
        const mistralApiKey = process.env.MISTRAL_API_KEY || '';
        let parsedResult = {
            object: 'Plastic Bottle',
            category: 'Plastic',
            material: 'PET',
            confidence: 0.98,
            estimatedWeight: 1.2,
            tips: ['Sort plastic separately', 'Clean and dry before scanning', 'Schedule a smart pickup now']
        };
        if (mistralApiKey) {
            // Call Mistral API for vision-based classification
            const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${mistralApiKey}`
                },
                body: JSON.stringify({
                    model: 'pixtral-12b-2409',
                    messages: [
                        {
                            role: 'user',
                            content: [
                                { type: 'text', text: 'Identify this object. Determine if it is recyclable scrap material. Analyze it hierarchically: 1. Main Category (e.g. Plastic, Paper, Glass, Metal, E-Waste, Non-Recyclable). 2. Specific Object name. 3. Material type (e.g. PET, HDPE, Cardboard, Copper, Aluminum, Glass, E-Waste). 4. Estimate weight in kg. Return strictly JSON matching: {"object": "Plastic Bottle", "category": "Plastic", "material": "PET", "confidence": 0.98, "estimatedWeight": 1.2, "tips": ["Clean it", "Sort separately", "Schedule pickup"]}' },
                                { type: 'image_url', image_url: { url: imageBase64 } }
                            ]
                        }
                    ],
                    response_format: { type: 'json_object' }
                })
            });
            const data = await response.json();
            parsedResult = JSON.parse(data.choices[0].message.content);
        }
        else {
            // Development mock fallback with random selections
            const mocks = [
                { object: 'Plastic Bottle', category: 'Plastic', material: 'PET', confidence: 0.98, estimatedWeight: 0.45 },
                { object: 'Copper Wire Bundle', category: 'Metal', material: 'Copper', confidence: 0.95, estimatedWeight: 1.5 },
                { object: 'Iron Rod Scrap', category: 'Metal', material: 'Iron', confidence: 0.92, estimatedWeight: 5.0 },
                { object: 'Glass Beer Bottle', category: 'Glass', material: 'Glass', confidence: 0.97, estimatedWeight: 0.6 },
                { object: 'Cardboard Box', category: 'Paper', material: 'Cardboard', confidence: 0.99, estimatedWeight: 2.2 },
                { object: 'Dead Keyboard', category: 'Electronics', material: 'E-Waste', confidence: 0.91, estimatedWeight: 0.8 }
            ];
            const selected = mocks[Math.floor(Math.random() * mocks.length)];
            parsedResult = {
                ...selected,
                tips: [`Sort this ${selected.category} item separately`, 'Ensure it is dry', 'Book a pickup to earn ReLoop coins']
            };
        }
        // Dynamic Price Engine Look-up from MaterialPrice collection
        let pricePerKg = 20; // default fallback (Plastic/PET rate)
        try {
            const match = await MaterialPrice.findOne({
                material: { $regex: new RegExp('^' + parsedResult.material + '$', 'i') }
            });
            if (match) {
                pricePerKg = match.pricePerKg;
            }
            else {
                // Default local pricing map fallback
                const rateMap = {
                    pet: 20, hdpe: 22, copper: 780, iron: 35, aluminum: 90, glass: 4, cardboard: 12, 'e-waste': 50
                };
                const key = (parsedResult.material || '').toLowerCase();
                if (rateMap[key] !== undefined)
                    pricePerKg = rateMap[key];
            }
        }
        catch (e) {
            console.error('Error looking up MaterialPrice from MongoDB, using fallback:', e);
        }
        const weightNum = Number(parsedResult.estimatedWeight) || 0.5;
        const estimatedReward = Math.round(weightNum * pricePerKg);
        const rlCoins = estimatedReward * 5;
        const recyclable = parsedResult.category.toLowerCase() !== 'non-recyclable';
        return {
            object: parsedResult.object,
            category: parsedResult.category,
            material: parsedResult.material,
            confidence: Math.round((parsedResult.confidence || 0.9) * 100),
            estimatedWeight: `${weightNum.toFixed(1)}kg`,
            pricePerKg,
            estimatedReward,
            rlCoins,
            recyclable,
            pickupAvailable: recyclable,
            suggestions: parsedResult.tips,
            // Backward compatibility fields
            detectedClass: parsedResult.category,
            detectedName: parsedResult.object,
            estimatedWeightKg: weightNum,
            estimatedPrice: estimatedReward,
            confidenceScore: parsedResult.confidence || 0.9
        };
    }
    catch (error) {
        console.error('[AI Vision Error]:', error);
        return {
            object: 'Plastic Bottle',
            category: 'Plastic',
            material: 'PET',
            confidence: 98,
            estimatedWeight: '1.2kg',
            pricePerKg: 20,
            estimatedReward: 24,
            rlCoins: 120,
            recyclable: true,
            pickupAvailable: true,
            suggestions: ['Wash and dry before disposal', 'Book a bulk pickup for more points'],
            detectedClass: 'Plastic',
            detectedName: 'Unknown Plastic Item',
            estimatedWeightKg: 1.2,
            estimatedPrice: 24,
            confidenceScore: 0.98
        };
    }
};
export const chatWithReLoopAi = async (userMessage, history, userContext) => {
    try {
        const formattedHistory = history.map(h => ({
            role: h.sender === 'user' ? 'user' : 'assistant',
            content: h.text
        }));
        let systemPrompt = `You are "ReLoop AI", a friendly, expert environmental recycling chatbot. You work for ReLoop.
Never mention Mistral, nor that you are an AI model developed by Mistral.
Always stay in character as ReLoop AI. Your mission is to provide helpful waste guidance, eco-friendly lifestyle tips, carbon stats tracking, and pickup customer support.`;
        if (userContext) {
            systemPrompt += `\n\nHere is the current user's profile and data context:\n${JSON.stringify(userContext, null, 2)}`;
        }
        const mistralApiKey = process.env.MISTRAL_API_KEY || '';
        if (!mistralApiKey) {
            return `Hello! I am ReLoop AI, your smart recycling companion. Your message was: "${userMessage}". Currently my Mistral API keys are in development configuration. Let me know how I can help you book a pickup or track your eco points!`;
        }
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mistralApiKey}`
            },
            body: JSON.stringify({
                model: 'mistral-large-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...formattedHistory,
                    { role: 'user', content: userMessage }
                ]
            })
        });
        const data = await response.json();
        return data.choices[0].message.content;
    }
    catch (error) {
        console.error('[Mistral AI Chat Error]:', error);
        return 'Hi there, I am ReLoop AI. I encountered a minor connection issue, but please let me know what waste item you would like to recycle today!';
    }
};
// ─── PDFKIT DOCUMENT GENERATION ──────────────────────────────────────────────
export const generatePdfDoc = (title, details) => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        // Header
        doc.fillColor('#10B981').fontSize(26).text('RELOOP RECYCLING', { align: 'center' });
        doc.moveDown(0.5);
        doc.fillColor('#333333').fontSize(18).text(title, { align: 'center' });
        doc.moveDown(1.5);
        // Body Details
        doc.fillColor('#4B5563').fontSize(12);
        details.forEach(line => {
            doc.text(line);
            doc.moveDown(0.8);
        });
        // Footer
        doc.moveDown(2);
        doc.strokeColor('#10B981').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);
        doc.fillColor('#9CA3AF').fontSize(10).text('Generated dynamically by ReLoop AI. Go Green!', { align: 'center' });
        doc.end();
    });
};
// ─── EXPO PUSH NOTIFICATIONS SERVICE ─────────────────────────────────────────
export const sendPushNotification = async (expoPushToken, title, body) => {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
        console.log(`[Push Notification] Invalid token: ${expoPushToken}`);
        return;
    }
    try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                to: expoPushToken,
                sound: 'default',
                title,
                body,
                data: { screen: 'notifications' }
            })
        });
        console.log(`[Push Notification] Expo API response status: ${res.status}`);
    }
    catch (error) {
        console.error('[Expo Push Send Error]:', error);
    }
};
// ─── SOCKET.IO REALTIME DRIVER TRACKING MANAGER ──────────────────────────────
export const initializeSocketTracking = (io) => {
    // Store driver coordinates in memory
    const driverLocations = new Map();
    io.on('connection', (socket) => {
        console.log(`[Socket.IO] New connection: ${socket.id}`);
        // Driver registers their socket and shares coordinates live
        socket.on('register_driver', (data) => {
            socket.join(`driver_${data.driverId}`);
            console.log(`[Socket.IO] Driver registered: ${data.driverId}`);
        });
        socket.on('update_location', (data) => {
            driverLocations.set(data.driverId, { lat: data.lat, lng: data.lng });
            // Broadcast location to the customer room watching this pickup
            io.to(`pickup_${data.pickupId}`).emit('location_changed', {
                driverId: data.driverId,
                latitude: data.lat,
                longitude: data.lng
            });
        });
        // Customer joins a room to track their specific pickup order
        socket.on('track_pickup', (data) => {
            socket.join(`pickup_${data.pickupId}`);
            console.log(`[Socket.IO] Client tracking pickup: ${data.pickupId}`);
        });
        socket.on('disconnect', () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
        });
    });
};
