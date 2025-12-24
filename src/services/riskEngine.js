export const calculateRiskScore = (bin, reports = [], options = {}) => {
  const { weather, slaStatus, includeExplanations } = options;
  let score = 0;
  const explanations = [];

  const hoursSinceCollection = bin.lastCollectedAt 
    ? (Date.now() - bin.lastCollectedAt.toMillis()) / (1000 * 60 * 60)
    : 72;

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
  if (includeExplanations) {
    explanations.push({
      factor: 'Time Since Collection',
      contribution: collectionScore,
      details: `${Math.round(hoursSinceCollection)} hours since last collection`
    });
  }

  let overflowScore = 0;
  if (bin.overflowCount > 0) {
    overflowScore = Math.min(bin.overflowCount * 10, 30);
    score += overflowScore;
    if (includeExplanations) {
      explanations.push({
        factor: 'Overflow History',
        contribution: overflowScore,
        details: `${bin.overflowCount} previous overflow(s)`
      });
    }
  }

  const recentReports = reports.filter(r => {
    if (!r.createdAt || !r.createdAt.toMillis) return false;
    const reportAge = (Date.now() - r.createdAt.toMillis()) / (1000 * 60 * 60);
    return reportAge < 24;
  });

  let reportScore = 0;
  if (recentReports.length > 0) {
    const avgCredibility = recentReports.reduce((sum, r) => sum + (r.credibilityScore || 0.5), 0) / recentReports.length;
    const fullReports = recentReports.filter(r => r.status === 'full').length;
    reportScore = (fullReports / recentReports.length) * 20 * avgCredibility;
    score += reportScore;
    if (includeExplanations) {
      explanations.push({
        factor: 'Recent Reports',
        contribution: Math.round(reportScore),
        details: `${fullReports}/${recentReports.length} full reports in last 24h`
      });
    }
  }

  const locationWeight = getLocationWeight(bin.locationName);
  const baseScore = score;
  score *= locationWeight;

  if (slaStatus) {
    const slaBoost = slaStatus.status === 'BREACHED' ? 25 : slaStatus.status === 'AT_RISK' ? 10 : 0;
    score += slaBoost;
    if (includeExplanations && slaBoost > 0) {
      explanations.push({
        factor: 'SLA Status',
        contribution: slaBoost,
        details: `SLA ${slaStatus.status} (${Math.round(slaStatus.progressPercent)}% elapsed)`
      });
    }
  }

  if (weather) {
    let weatherBoost = 0;
    if (weather.isRaining) {
      weatherBoost += 15;
    }
    if (weather.humidity > 75) {
      weatherBoost += 8;
    } else if (weather.humidity > 60) {
      weatherBoost += 4;
    }
    score += weatherBoost;
    if (includeExplanations && weatherBoost > 0) {
      explanations.push({
        factor: 'Weather Conditions',
        contribution: weatherBoost,
        details: weather.isRaining ? `Raining (${Math.round(weather.humidity)}% humidity)` : `High humidity (${Math.round(weather.humidity)}%)`
      });
    }
  }

  const crowdBoost = getCrowdRiskBoost(bin.locationName);
  score += crowdBoost;
  if (includeExplanations && crowdBoost !== 0) {
    if (crowdBoost > 0) {
      explanations.push({
        factor: 'Crowd Density',
        contribution: crowdBoost,
        details: `High traffic expected for this location/time`
      });
    } else {
      explanations.push({
        factor: 'Crowd Density',
        contribution: crowdBoost,
        details: `Low traffic expected for this location/time`
      });
    }
  }

  const finalScore = Math.min(Math.round(score), 100);

  if (includeExplanations) {
    return {
      score: finalScore,
      explanations,
      breakdown: {
        baseScore: Math.round(baseScore * locationWeight),
        slaBoost: slaStatus ? (slaStatus.status === 'BREACHED' ? 25 : slaStatus.status === 'AT_RISK' ? 10 : 0) : 0,
        weatherBoost: weather ? (weather.isRaining ? 15 : 0) + (weather.humidity > 75 ? 8 : weather.humidity > 60 ? 4 : 0) : 0,
        crowdBoost
      }
    };
  }

  return finalScore;
};

import { getLocationCrowdMultiplier } from './crowdModel';

const getCrowdRiskBoost = (locationName) => {
  const multiplier = getLocationCrowdMultiplier(locationName);
  
  if (multiplier > 1.2) return 12;
  if (multiplier > 1.0) return 6;
  if (multiplier < 0.7) return -5;
  return 0;
};

const getLocationWeight = (locationName) => {
  const name = locationName.toLowerCase();
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

export const getRiskLevel = (score) => {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
};

export const explainRiskScore = (bin, reports = [], weather = null, slaStatus = null) => {
  return calculateRiskScore(bin, reports, { weather, slaStatus, includeExplanations: true });
};

