const { getAllBins, getAllReports, updateBin, getLatestReportForBin } = require('../services/firestore');

const SLA_STATUS = {
  ON_TIME: 'ON_TIME',
  AT_RISK: 'AT_RISK',
  BREACHED: 'BREACHED'
};

const getDefaultSLADuration = (bin) => {
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

const calculateSLAStatus = (bin, report = null) => {
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

const monitorSLAForAllBins = async () => {
  const bins = await getAllBins();
  const reports = await getAllReports(72);
  
  const binReportsMap = {};
  reports.forEach(report => {
    if (!binReportsMap[report.binId]) {
      binReportsMap[report.binId] = [];
    }
    binReportsMap[report.binId].push(report);
  });
  
  const updates = [];
  let breachCount = 0;
  
  for (const bin of bins) {
    const binReports = binReportsMap[bin.id] || [];
    const latestReport = binReports.length > 0
      ? binReports.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        })[0]
      : null;
    
    const slaStatus = calculateSLAStatus(bin, latestReport);
    
    const previousStatus = bin.slaStatus?.status || SLA_STATUS.ON_TIME;
    const isNewBreach = slaStatus.status === SLA_STATUS.BREACHED && previousStatus !== SLA_STATUS.BREACHED;
    
    if (isNewBreach) {
      breachCount++;
    }
    
    const updateData = {
      slaStatus: {
        status: slaStatus.status,
        elapsedHours: slaStatus.elapsedHours,
        remainingHours: slaStatus.remainingHours,
        progressPercent: slaStatus.progressPercent,
        slaDuration: slaStatus.slaDuration,
        lastUpdated: require('firebase-admin').firestore.FieldValue.serverTimestamp()
      }
    };
    
    if (isNewBreach) {
      updateData.overflowCount = (bin.overflowCount || 0) + 1;
      updateData.lastBreachAt = require('firebase-admin').firestore.FieldValue.serverTimestamp();
    }
    
    updates.push({
      binId: bin.id,
      updateData
    });
  }
  
  for (const update of updates) {
    await updateBin(update.binId, update.updateData);
  }
  
  return {
    binsChecked: bins.length,
    breachesDetected: breachCount,
    timestamp: Date.now()
  };
};

module.exports = {
  SLA_STATUS,
  calculateSLAStatus,
  monitorSLAForAllBins,
  getDefaultSLADuration
};




