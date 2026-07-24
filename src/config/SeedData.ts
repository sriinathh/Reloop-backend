export const DEFAULT_WASTE_CATEGORIES = [
  { id: '1', name: 'PET Bottles', category: 'Plastic', pricePerKg: 12, co2SavedPerKg: 1.5, color: '#10B981', trend: 'up', trendPercent: 4.5 },
  { id: '2', name: 'Cardboard Box', category: 'Paper', pricePerKg: 8, co2SavedPerKg: 0.9, color: '#F59E0B', trend: 'stable', trendPercent: 0 },
  { id: '3', name: 'Copper Wires', category: 'Metal', pricePerKg: 350, co2SavedPerKg: 4.2, color: '#3B82F6', trend: 'up', trendPercent: 8.2 },
  { id: '4', name: 'Aluminium Cans', category: 'Metal', pricePerKg: 95, co2SavedPerKg: 9.0, color: '#6366F1', trend: 'down', trendPercent: 2.1 },
  { id: '5', name: 'Smartphone', category: 'E-Waste', pricePerKg: 120, co2SavedPerKg: 14.5, color: '#8B5CF6', trend: 'up', trendPercent: 12.0 }
];

export const DEFAULT_BADGES = [
  { id: 'b1', name: 'Eco Starter', description: 'Complete your first recycling pickup request', icon: 'leaf', color: '#10B981', threshold: 1 },
  { id: 'b2', name: 'Planet Saver', description: 'Save more than 50 kg of carbon emissions', icon: 'earth', color: '#3B82F6', threshold: 50 },
  { id: 'b3', name: 'E-Waste Hero', description: 'Recycle 5 electronic waste items', icon: 'cellphone', color: '#8B5CF6', threshold: 5 }
];

export const DEFAULT_CHALLENGES = [
  { id: 'c1', title: 'Summer Cleanup', description: 'Recycle 20 kg of paper waste this summer', targetKg: 20, currentKg: 0, rewardPoints: 200, icon: 'newspaper', color: '#F59E0B', endsAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), isActive: true },
  { id: 'c2', title: 'Metal Collector', description: 'Recycle 5 kg of copper or aluminium wires/cans', targetKg: 5, currentKg: 0, rewardPoints: 500, icon: 'wrench', color: '#10B981', endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), isActive: true }
];

export const DEFAULT_LANGUAGES = [
  {
    languageCode: 'en',
    translations: {
      welcome: 'Welcome to ReLoop',
      pickup: 'Pickups',
      wallet: 'Wallet Balance',
      kyc: 'Aadhaar Verification',
      rewards: 'Achievements',
      community: 'Community Forum',
      chatbot: 'ReLoop AI Assistant'
    }
  },
  {
    languageCode: 'hi',
    translations: {
      welcome: 'रीलूप में आपका स्वागत है',
      pickup: 'पिकअप अनुरोध',
      wallet: 'वॉलेट बैलेंस',
      kyc: 'आधार सत्यापन',
      rewards: 'उपलब्धियां',
      community: 'सामुदायिक मंच',
      chatbot: 'रीलूप एआई सहायक'
    }
  }
];
