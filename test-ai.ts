import dotenv from 'dotenv';
dotenv.config();

import { analyzeWasteImage } from './src/services/ExternalServices.js';

async function test() {
  console.log('Fetching sample image of a cardboard box...');
  // Cardboard box image
  const response = await fetch('https://images.unsplash.com/photo-1589330694653-efa652fe2123?q=80&w=600&auto=format&fit=crop');
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const dataUri = `data:image/jpeg;base64,${base64}`;

  console.log('Running analyzeWasteImage()...');
  console.log('Mistral API Key:', process.env.MISTRAL_API_KEY?.substring(0, 5) + '...');
  
  try {
    const result = await analyzeWasteImage(dataUri);
    console.log('\n✅ AI SCANNER RESULT (Strict JSON):');
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

test();
