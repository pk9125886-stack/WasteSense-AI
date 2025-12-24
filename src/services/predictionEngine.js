export const predictOverflow = (bin, reports = []) => {
  const hoursSinceCollection = bin.lastCollectedAt 
    ? (Date.now() - bin.lastCollectedAt.toMillis()) / (1000 * 60 * 60)
    : 72;

  const recentReports = reports
    .filter(r => {
      if (!r.createdAt || !r.createdAt.toMillis) return false;
      const reportAge = (Date.now() - r.createdAt.toMillis()) / (1000 * 60 * 60);
      return reportAge < 48;
    })
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });

  if (recentReports.length === 0) {
    return {
      willOverflow: hoursSinceCollection > 48,
      confidence: 0.3,
      hoursUntilOverflow: hoursSinceCollection > 48 ? 0 : 24 - hoursSinceCollection
    };
  }

  const trend = analyzeTrend(recentReports);
  const currentStatus = recentReports[0].status;
  const avgFillRate = calculateFillRate(recentReports);

  let willOverflow = false;
  let confidence = 0.5;
  let hoursUntilOverflow = 12;

  if (currentStatus === 'full') {
    willOverflow = true;
    confidence = 0.9;
    hoursUntilOverflow = 0;
  } else if (currentStatus === 'half' && trend === 'increasing') {
    willOverflow = avgFillRate > 0.6;
    confidence = avgFillRate;
    hoursUntilOverflow = (1 - avgFillRate) * 12;
  } else if (trend === 'increasing' && hoursSinceCollection > 24) {
    willOverflow = true;
    confidence = 0.7;
    hoursUntilOverflow = 6;
  } else if (hoursSinceCollection > 36) {
    willOverflow = true;
    confidence = 0.6;
    hoursUntilOverflow = 12 - (hoursSinceCollection - 36);
  }

  return {
    willOverflow,
    confidence: Math.min(confidence, 0.95),
    hoursUntilOverflow: Math.max(0, Math.round(hoursUntilOverflow))
  };
};

const analyzeTrend = (reports) => {
  if (reports.length < 2) return 'stable';

  const statusValues = { empty: 0, half: 1, full: 2 };
  const values = reports.map(r => statusValues[r.status] || 0);
  
  let increasing = 0;
  let decreasing = 0;

  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[i - 1]) increasing++;
    if (values[i] < values[i - 1]) decreasing++;
  }

  if (increasing > decreasing) return 'increasing';
  if (decreasing > increasing) return 'decreasing';
  return 'stable';
};

const calculateFillRate = (reports) => {
  const statusValues = { empty: 0, half: 0.5, full: 1.0 };
  const rates = reports.map(r => statusValues[r.status] || 0);
  return rates.reduce((sum, r) => sum + r, 0) / rates.length;
};

