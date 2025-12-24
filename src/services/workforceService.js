import { calculateRiskScore } from './riskEngine';

export const calculateWorkload = (bins, reports) => {
  const binsWithWorkload = bins.map(bin => {
    const binReports = reports.filter(r => r.binId === bin.id);
    const riskScore = calculateRiskScore(bin, binReports);
    
    let workload = 1;
    if (riskScore >= 70) {
      workload = 2;
    } else if (riskScore >= 40) {
      workload = 1.5;
    }
    
    return {
      binId: bin.id,
      locationName: bin.locationName,
      riskScore,
      workload,
      zone: bin.zone || 'default'
    };
  });
  
  return binsWithWorkload;
};

export const assignWorkersToZones = (bins, reports, availableWorkers) => {
  const workloadData = calculateWorkload(bins, reports);
  
  const zones = {};
  workloadData.forEach(item => {
    const zone = item.zone;
    if (!zones[zone]) {
      zones[zone] = {
        zone,
        bins: [],
        totalWorkload: 0,
        highRiskCount: 0
      };
    }
    zones[zone].bins.push(item);
    zones[zone].totalWorkload += item.workload;
    if (item.riskScore >= 70) {
      zones[zone].highRiskCount++;
    }
  });
  
  const zoneList = Object.values(zones).sort((a, b) => {
    if (a.highRiskCount !== b.highRiskCount) {
      return b.highRiskCount - a.highRiskCount;
    }
    return b.totalWorkload - a.totalWorkload;
  });
  
  const assignments = {};
  let remainingWorkers = availableWorkers;
  
  zoneList.forEach(zone => {
    const requiredWorkers = Math.ceil(zone.totalWorkload);
    const assigned = Math.min(requiredWorkers, remainingWorkers);
    assignments[zone.zone] = {
      assigned,
      required: requiredWorkers,
      workload: zone.totalWorkload,
      bins: zone.bins.length,
      highRisk: zone.highRiskCount,
      utilization: assigned > 0 ? (zone.totalWorkload / assigned) * 100 : 0
    };
    remainingWorkers -= assigned;
  });
  
  const totalRequired = zoneList.reduce((sum, z) => sum + Math.ceil(z.totalWorkload), 0);
  const totalAssigned = availableWorkers - remainingWorkers;
  
  return {
    assignments,
    summary: {
      available: availableWorkers,
      required: totalRequired,
      assigned: totalAssigned,
      remaining: remainingWorkers,
      coverage: totalRequired > 0 ? (totalAssigned / totalRequired) * 100 : 100,
      overload: totalRequired > availableWorkers,
      underutilization: remainingWorkers > 0 && totalAssigned < totalRequired
    }
  };
};

export const getOptimalWorkerCount = (bins, reports) => {
  const workloadData = calculateWorkload(bins, reports);
  const totalWorkload = workloadData.reduce((sum, item) => sum + item.workload, 0);
  return Math.ceil(totalWorkload);
};

