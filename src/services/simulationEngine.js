import { calculateRiskScore } from './riskEngine';
import { calculateSLAStatus, getSLARiskBoost } from './slaService';
import { getWeatherRiskBoost } from './weatherService';
import { getCrowdRiskBoost } from './crowdModel';

export const simulateCollectionSkip = (bins, reports, skippedBinIds, weather, hoursForward = 24) => {
  const simulationResults = bins.map(bin => {
    const binReports = reports.filter(r => r.binId === bin.id);
    const latestReport = binReports.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    })[0];
    const currentSlaStatus = calculateSLAStatus(bin, latestReport);
    const currentRisk = calculateRiskScore(bin, binReports, { weather, slaStatus: currentSlaStatus });
    
    if (!skippedBinIds.includes(bin.id)) {
      return {
        binId: bin.id,
        locationName: bin.locationName,
        currentRisk,
        projectedRisk: currentRisk,
        riskChange: 0
      };
    }
    
    const simulatedBin = {
      ...bin,
      lastCollectedAt: bin.lastCollectedAt ? {
        toMillis: () => bin.lastCollectedAt.toMillis() - (hoursForward * 60 * 60 * 1000)
      } : null
    };
    
    const projectedSlaStatus = calculateSLAStatus(simulatedBin, latestReport);
    const projectedRisk = calculateRiskScore(simulatedBin, binReports, { weather, slaStatus: projectedSlaStatus });
    
    return {
      binId: bin.id,
      locationName: bin.locationName,
      currentRisk,
      projectedRisk,
      riskChange: projectedRisk - currentRisk,
      slaStatus: projectedSlaStatus.status
    };
  });
  
  const totalRiskIncrease = simulationResults.reduce((sum, r) => sum + Math.max(0, r.riskChange), 0);
  const binsAtRisk = simulationResults.filter(r => r.projectedRisk >= 70).length;
  const binsBreached = simulationResults.filter(r => r.slaStatus === 'BREACHED').length;
  
  return {
    results: simulationResults,
    summary: {
      totalRiskIncrease: Math.round(totalRiskIncrease),
      binsAtRisk,
      binsBreached,
      avgRiskChange: Math.round(totalRiskIncrease / bins.length)
    }
  };
};

export const simulateWorkforceReduction = (bins, reports, availableWorkers, weather) => {
  const binsWithRisk = bins.map(bin => {
    const binReports = reports.filter(r => r.binId === bin.id);
    const latestReport = binReports.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    })[0];
    const slaStatus = calculateSLAStatus(bin, latestReport);
    const riskScore = calculateRiskScore(bin, binReports, { weather, slaStatus });
    return { ...bin, riskScore, binReports };
  });
  
  binsWithRisk.sort((a, b) => b.riskScore - a.riskScore);
  
  const prioritizedBins = binsWithRisk.slice(0, availableWorkers);
  const skippedBins = binsWithRisk.slice(availableWorkers);
  
  const skippedIds = skippedBins.map(b => b.id);
  const simulation = simulateCollectionSkip(bins, reports, skippedIds, weather, 24);
  
  return {
    ...simulation,
    workforce: {
      available: availableWorkers,
      required: binsWithRisk.filter(b => b.riskScore >= 70).length,
      utilization: Math.min(100, (prioritizedBins.length / bins.length) * 100)
    }
  };
};

