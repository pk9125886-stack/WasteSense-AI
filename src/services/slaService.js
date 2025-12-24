export const SLA_STATUS = {
  ON_TIME: 'ON_TIME',
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED'
};

export const getDefaultSLADuration = (bin) => {
  const locationName = (bin.locationName || '').toLowerCase();
  
  if (locationName.includes('park') || locationName.includes('beach') || locationName.includes('tourist')) {
    return 12;
  }
  if (locationName.includes('residential') || locationName.includes('apartment')) {
    return 24;
  }
  if (locationName.includes('office') || locationName.includes('commercial')) {
    return 36;
  }
  return 24;
};

export const calculateSLAStatus = (bin, report = null) => {
  const slaDuration = bin.slaDuration || getDefaultSLADuration(bin);
  const startTime = report?.createdAt?.toMillis() || bin.lastCollectedAt?.toMillis() || Date.now();
  const elapsedHours = (Date.now() - startTime) / (1000 * 60 * 60);
  
  const remainingHours = slaDuration - elapsedHours;
  const progressPercent = (elapsedHours / slaDuration) * 100;
  
  let status = SLA_STATUS.ON_TIME;
  if (progressPercent >= 100) {
    status = SLA_STATUS.BREACHED;
  } else if (progressPercent >= 80) {
    status = SLA_STATUS.AT_RISK;
  }
  
  return {
    status,
    elapsedHours: Math.max(0, elapsedHours),
    remainingHours: Math.max(0, remainingHours),
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    slaDuration
  };
};

export const getSLABreachCount = (bins, reports) => {
  const zoneBreaches = {};
  
  bins.forEach(bin => {
    const zone = bin.zone || 'default';
    if (!zoneBreaches[zone]) {
      zoneBreaches[zone] = 0;
    }
    
    const binReports = reports.filter(r => r.binId === bin.id);
    const latestReport = binReports.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    })[0];
    
    const slaStatus = calculateSLAStatus(bin, latestReport);
    if (slaStatus.status === SLA_STATUS.BREACHED) {
      zoneBreaches[zone]++;
    }
  });
  
  return zoneBreaches;
};

export const getSLARiskBoost = (slaStatus) => {
  if (slaStatus.status === SLA_STATUS.BREACHED) {
    return 25;
  }
  if (slaStatus.status === SLA_STATUS.AT_RISK) {
    return 10;
  }
  return 0;
};

