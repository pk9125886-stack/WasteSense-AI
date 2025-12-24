const { getBin, getBinReports, updateBin, getLatestReportForBin } = require('../services/firestore');
const { calculateSLAStatus } = require('./slaEngine');

const getLocationWeight = (locationName) => {
  const name = (locationName || '').toLowerCase();
  if (name.includes('park') || name.includes('beach') || name.includes('tourist')) {
    return 1.2;
  }
  if (name.includes('residential') || name.includes('apartment')) {
    return 1.1;
  }
  if (name.includes('office') || name.includes('commercial')) {
    return 0.9;
  }
  return 1.0;
};

const getCrowdRiskBoost = (locationName) => {
  const name = (locationName || '').toLowerCase();
  const hour = new Date().getHours();
  
  let baseMultiplier = 1.0;
  
  if (hour >= 6 && hour < 12) {
    baseMultiplier = 0.7;
  } else if (hour >= 12 && hour < 18) {
    baseMultiplier = 0.9;
  } else if (hour >= 18 && hour < 22) {
    baseMultiplier = 1.0;
  } else {
    baseMultiplier = 0.3;
  }
  
  if (name.includes('park') || name.includes('beach') || name.includes('tourist')) {
    baseMultiplier *= 1.3;
  } else if (name.includes('shopping') || name.includes('mall') || name.includes('market')) {
    baseMultiplier *= 1.4;
  } else if (name.includes('restaurant') || name.includes('cafe') || name.includes('food')) {
    if (hour >= 12 && hour < 22) {
      baseMultiplier *= 1.5;
    } else {
      baseMultiplier *= 0.8;
    }
  } else if (name.includes('office') || name.includes('commercial')) {
    if (hour >= 6 && hour < 18) {
      baseMultiplier *= 1.2;
    } else {
      baseMultiplier *= 0.6;
    }
  } else if (name.includes('residential') || name.includes('apartment')) {
    baseMultiplier *= 0.9;
  }
  
  const multiplier = Math.max(0.3, Math.min(1.5, baseMultiplier));
  
  if (multiplier > 1.2) return 12;
  if (multiplier > 1.0) return 6;
  if (multiplier < 0.7) return -5;
  return 0;
};

const getWeatherRiskBoost = (weather) => {
  if (!weather) return 0;
  
  let boost = 0;
  if (weather.isRaining) {
    boost += 15;
  }
  if (weather.humidity > 75) {
    boost += 8;
  } else if (weather.humidity > 60) {
    boost += 4;
  }
  return boost;
};

const calculateRiskScore = async (bin, reports = [], slaStatus = null, weather = null) => {
  let score = 0;
  
  const now = Date.now();
  const lastCollectedAt = bin.lastCollectedAt 
    ? bin.lastCollectedAt.toMillis()
    : now - (72 * 60 * 60 * 1000);
  
  const hoursSinceCollection = (now - lastCollectedAt) / (1000 * 60 * 60);
  
  let collectionScore = 0;
  if (hoursSinceCollection < 12) {
    collectionScore = 10;
  } else if (hoursSinceCollection < 24) {
    collectionScore = 30;
  } else if (hoursSinceCollection < 48) {
    collectionScore = 50;
  } else {
    collectionScore = 70;
  }
  score += collectionScore;
  
  let overflowScore = 0;
  if (bin.overflowCount > 0) {
    overflowScore = Math.min(bin.overflowCount * 10, 30);
    score += overflowScore;
  }
  
  const recentReports = reports.filter(r => {
    if (!r.createdAt || !r.createdAt.toMillis) return false;
    const reportAge = (now - r.createdAt.toMillis()) / (1000 * 60 * 60);
    return reportAge < 24;
  });
  
  let reportScore = 0;
  if (recentReports.length > 0) {
    const avgCredibility = recentReports.reduce((sum, r) => sum + (r.credibilityScore || 0.5), 0) / recentReports.length;
    const fullReports = recentReports.filter(r => r.status === 'full').length;
    reportScore = (fullReports / recentReports.length) * 20 * avgCredibility;
    score += reportScore;
  }
  
  const locationWeight = getLocationWeight(bin.locationName);
  score *= locationWeight;
  
  if (slaStatus) {
    const slaBoost = slaStatus.status === 'BREACHED' ? 25 : slaStatus.status === 'AT_RISK' ? 10 : 0;
    score += slaBoost;
  }
  
  const weatherBoost = getWeatherRiskBoost(weather);
  score += weatherBoost;
  
  const crowdBoost = getCrowdRiskBoost(bin.locationName);
  score += crowdBoost;
  
  return Math.min(Math.round(score), 100);
};

const recalculateBinRisk = async (binId, weather = null) => {
  const bin = await getBin(binId);
  if (!bin) {
    return;
  }
  
  const reports = await getBinReports(binId, 48);
  const latestReport = await getLatestReportForBin(binId);
  
  const slaStatus = calculateSLAStatus(bin, latestReport);
  
  const riskScore = await calculateRiskScore(bin, reports, slaStatus, weather);
  
  await updateBin(binId, { riskScore });
  
  return riskScore;
};

module.exports = {
  calculateRiskScore,
  recalculateBinRisk
};

