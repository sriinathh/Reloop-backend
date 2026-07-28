import { v2 as cloudinary } from 'cloudinary';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import { Server as SocketIOServer } from 'socket.io';
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

// ─── MSG91 CONFIGURATION ─────────────────────────────────────────────────────
export const sendMSG91 = async (phone: string, otp: string): Promise<boolean> => {
  try {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;
    
    if (!authKey) {
      console.log(`[Mock MSG91]: OTP ${otp} would be sent to ${phone} (Set MSG91_AUTH_KEY to enable)`);
      return true; // Fallback to mock behavior if no key
    }

    const response = await fetch('https://control.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: phone,
        otp: otp
      })
    });
    
    const data = await response.json() as any;
    if (data.type === 'success') {
      return true;
    } else {
      console.error('[MSG91 Error]:', data.message);
      return false;
    }
  } catch (error) {
    console.error('[MSG91 Exception]:', error);
    return false;
  }
};

export const uploadToCloudinary = async (base64Data: string, folder: string): Promise<string> => {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    return new Promise((resolve) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `reloop/${folder}` },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Upload Stream Error]:', error);
            resolve('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
          } else {
            resolve(result?.secure_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100');
          }
        }
      );
      
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);
      stream.pipe(uploadStream);
    });
  } catch (error) {
    console.error('[Cloudinary Upload Error]:', error);
    return 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'; // fallback
  }
};

// ─── RESEND EMAIL CONFIGURATION ──────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY || 're_123456789');

export const sendEmail = async (to: string, subject: string, htmlContent: string, attachments?: { filename: string, content: Buffer }[]) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    throw new Error('Invalid recipient email address.');
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;

  if (!apiKey || apiKey === 're_123456789' || !fromEmail) {
    console.error('[Email Send Error]: Missing RESEND_API_KEY or EMAIL_FROM in environment variables.');
    throw new Error('Email service is not configured correctly in environment variables.');
  }

  try {
    console.log(`[Resend] Sending email "${subject}" to ${to} from ${fromEmail}...`);
    
    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html: htmlContent,
      attachments
    });

    if (response.error) {
      console.error('[Resend API Error]:', response.error);
      throw new Error(response.error.message);
    }
    console.log(`[Resend] Delivered: "${subject}" to ${to}`);
  } catch (error: any) {
    console.error('[Resend Exception]:', error);
    // Throw the EXACT error message from Resend API
    throw new Error(error.message || 'Unknown Resend Error');
  }
};

// Reusable transactional email templates
export const emailTemplates = {
  welcome: (name: string) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #10B981;">Welcome to ReLoop, ${name}!</h2>
      <p>Thank you for joining our mission to turn waste into wealth. Log in to your mobile app to schedule your first smart pickup and start earning rewards!</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #999;">ReLoop AI Team</small>
    </div>
  `,
  otp: (otp: string) => `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #10B981;">Your ReLoop Verification Code</h2>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #333;">${otp}</p>
      <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <small style="color: #999;">ReLoop AI Team</small>
    </div>
  `,
  pickupConfirmation: (id: string, date: string) => `
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

export interface IAiScanResult {
  objectName: string;
  category: string;
  subcategory: string;
  confidence: number;
  material: string;
  recyclable: boolean;
  estimatedWeight: number;
  estimatedValue: number;
  ecoPoints: number;
  co2Saved: number;
  description: string;
  recyclingTip: string;
  marketDemand: string;
}

export const analyzeWasteImage = async (imageBase64: string): Promise<IAiScanResult> => {
  const mistralApiKey = process.env.MISTRAL_API_KEY || '';
  
  if (!mistralApiKey) {
    throw new Error('MISTRAL_API_KEY is not configured in the environment variables.');
  }

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
            { type: 'text', text: 'Analyze this object and determine if it is recyclable scrap. 1. Identify the actual object (NEVER assume it is a Plastic Bottle unless it really is). 2. Return strictly JSON matching exactly this format: {"objectName": "Name", "category": "Category", "subcategory": "Subcategory", "confidence": 95.5, "material": "Material Type", "description": "Short description.", "recyclingTip": "Tip", "marketDemand": "High/Medium/Low", "estimatedWeight": 0.5}. Do not include markdown.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as any;
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Unexpected response format from Mistral API.');
  }

  let parsedResult;
  try {
    parsedResult = JSON.parse(data.choices[0].message.content);
  } catch (e) {
    throw new Error('Failed to parse Mistral AI JSON response.');
  }

  const confidence = parsedResult.confidence || 0;
  if (confidence < 70) {
    return {
      objectName: 'Unknown Object',
      category: 'Non-Recyclable',
      subcategory: 'Unknown',
      confidence: confidence,
      material: 'Unknown',
      recyclable: false,
      estimatedWeight: 0,
      estimatedValue: 0,
      ecoPoints: 0,
      co2Saved: 0,
      description: 'The AI could not identify this object with sufficient confidence.',
      recyclingTip: 'Please try taking a clearer photo.',
      marketDemand: 'Low'
    };
  }
  
  let materialStr = 'Unknown';
  if (typeof parsedResult.material === 'string') {
    materialStr = parsedResult.material;
  } else if (parsedResult.material && typeof parsedResult.material === 'object') {
    materialStr = String(parsedResult.material.primary || parsedResult.material.name || 'Unknown');
  }

  // Dynamic Price Engine Look-up from MaterialPrice collection
  let pricePerKg = 40; // Increased base fallback
  try {
    const match = await MaterialPrice.findOne({ 
      material: { $regex: new RegExp('^' + materialStr + '$', 'i') } 
    });
    if (match) {
      pricePerKg = match.pricePerKg;
    } else {
      const rateMap: Record<string, number> = {
        pet: 25, hdpe: 30, copper: 850, iron: 45, aluminum: 120, glass: 10, cardboard: 15, 'e-waste': 100
      };
      const key = materialStr.toLowerCase();
      if (rateMap[key] !== undefined) pricePerKg = rateMap[key];
    }
  } catch (e) {
    console.error('Error looking up MaterialPrice from MongoDB, using fallback:', e);
  }

  // Ensure minimum realistic weight and minimum value
  const weightNum = Math.max(0.2, Number(parsedResult.estimatedWeight) || 0.5);
  const estimatedValue = Math.max(5, Math.round(weightNum * pricePerKg));
  const ecoPoints = estimatedValue * 5;
  const co2Saved = Number((weightNum * 0.6).toFixed(2)); // Arbitrary formula for CO2 saved

  return {
    objectName: String(parsedResult.objectName || 'Unknown'),
    category: String(parsedResult.category || 'Unknown'),
    subcategory: String(parsedResult.subcategory || 'Unknown'),
    confidence: confidence,
    material: materialStr,
    recyclable: String(parsedResult.category || '').toLowerCase() !== 'non-recyclable',
    estimatedWeight: weightNum,
    estimatedValue: estimatedValue,
    ecoPoints: ecoPoints,
    co2Saved: co2Saved,
    description: String(parsedResult.description || ''),
    recyclingTip: String(parsedResult.recyclingTip || ''),
    marketDemand: String(parsedResult.marketDemand || 'Medium')
  };
};

export const chatWithReLoopAi = async (userMessage: string, history: Array<{ sender: 'user' | 'bot'; text: string }>, userContext?: any): Promise<string> => {
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

    const data = await response.json() as any;
    return data.choices[0].message.content;
  } catch (error) {
    console.error('[Mistral AI Chat Error]:', error);
    return 'Hi there, I am ReLoop AI. I encountered a minor connection issue, but please let me know what waste item you would like to recycle today!';
  }
};

// ─── PDFKIT DOCUMENT GENERATION ──────────────────────────────────────────────
export const generatePdfDoc = (title: string, details: string[]): Promise<Buffer> => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    
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
export const sendPushNotification = async (expoPushToken: string, title: string, body: string) => {
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
  } catch (error) {
    console.error('[Expo Push Send Error]:', error);
  }
};

// ─── SOCKET.IO REALTIME DRIVER TRACKING MANAGER ──────────────────────────────
export const initializeSocketTracking = (io: SocketIOServer) => {
  // Store driver coordinates in memory
  const driverLocations = new Map<string, { lat: number; lng: number }>();

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] New connection: ${socket.id}`);

    // Driver registers their socket and shares coordinates live
    socket.on('register_driver', (data: { driverId: string }) => {
      socket.join(`driver_${data.driverId}`);
      console.log(`[Socket.IO] Driver registered: ${data.driverId}`);
    });

    socket.on('update_location', (data: { driverId: string; lat: number; lng: number; pickupId: string }) => {
      driverLocations.set(data.driverId, { lat: data.lat, lng: data.lng });
      // Broadcast location to the customer room watching this pickup
      io.to(`pickup_${data.pickupId}`).emit('location_changed', {
        driverId: data.driverId,
        latitude: data.lat,
        longitude: data.lng
      });
    });

    // Customer joins a room to track their specific pickup order
    socket.on('track_pickup', (data: { pickupId: string }) => {
      socket.join(`pickup_${data.pickupId}`);
      console.log(`[Socket.IO] Client tracking pickup: ${data.pickupId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
};
