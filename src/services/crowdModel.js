export const CROWD_PROFILES = {
  MORNING: { start: 6, end: 12, intensity: 0.7 },
  AFTERNOON: { start: 12, end: 18, intensity: 0.9 },
  EVENING: { start: 18, end: 22, intensity: 1.0 },
  NIGHT: { start: 22, end: 6, intensity: 0.3 }
};

export const getCurrentCrowdProfile = () => {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) return CROWD_PROFILES.MORNING;
  if (hour >= 12 && hour < 18) return CROWD_PROFILES.AFTERNOON;
  if (hour >= 18 && hour < 22) return CROWD_PROFILES.EVENING;
  return CROWD_PROFILES.NIGHT;
};

export const getLocationCrowdMultiplier = (locationName) => {
  const name = (locationName || '').toLowerCase();
  const profile = getCurrentCrowdProfile();
  
  let baseMultiplier = 1.0;
  
  if (name.includes('park') || name.includes('beach') || name.includes('tourist')) {
    baseMultiplier = profile.intensity * 1.3;
  } else if (name.includes('shopping') || name.includes('mall') || name.includes('market')) {
    baseMultiplier = profile.intensity * 1.4;
  } else if (name.includes('restaurant') || name.includes('cafe') || name.includes('food')) {
    if (profile === CROWD_PROFILES.AFTERNOON || profile === CROWD_PROFILES.EVENING) {
      baseMultiplier = profile.intensity * 1.5;
    } else {
      baseMultiplier = profile.intensity * 0.8;
    }
  } else if (name.includes('office') || name.includes('commercial')) {
    if (profile === CROWD_PROFILES.MORNING || profile === CROWD_PROFILES.AFTERNOON) {
      baseMultiplier = profile.intensity * 1.2;
    } else {
      baseMultiplier = profile.intensity * 0.6;
    }
  } else if (name.includes('residential') || name.includes('apartment')) {
    baseMultiplier = profile.intensity * 0.9;
  } else {
    baseMultiplier = profile.intensity;
  }
  
  return Math.max(0.3, Math.min(1.5, baseMultiplier));
};

export const getCrowdRiskBoost = (locationName) => {
  const multiplier = getLocationCrowdMultiplier(locationName);
  const profile = getCurrentCrowdProfile();
  
  if (multiplier > 1.2) {
    return 12;
  } else if (multiplier > 1.0) {
    return 6;
  } else if (multiplier < 0.7) {
    return -5;
  }
  
  return 0;
};

export const getCrowdIntensityLabel = (locationName) => {
  const multiplier = getLocationCrowdMultiplier(locationName);
  const profile = getCurrentCrowdProfile();
  
  if (multiplier > 1.2) return 'High';
  if (multiplier > 1.0) return 'Medium';
  if (multiplier > 0.7) return 'Low';
  return 'Very Low';
};

