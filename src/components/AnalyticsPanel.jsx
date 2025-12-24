import { getSLABreachCount } from '../services/slaService';

export default function AnalyticsPanel({ bins, reports }) {
  const calculateStats = () => {
    if (bins.length === 0) {
      return {
        highRiskZones: 0,
        avgResolutionTime: 0,
        improvementTrend: 0,
        totalBins: 0,
        avgRiskScore: 0,
        slaBreaches: 0
      };
    }

    const highRiskBins = bins.filter(b => (b.riskScore || 0) >= 70).length;
    const zoneBreaches = getSLABreachCount(bins, reports);
    const totalSlaBreaches = Object.values(zoneBreaches).reduce((sum, count) => sum + count, 0);
    
    const resolvedReports = reports.filter(r => {
      const reportTime = r.createdAt.toMillis();
      const bin = bins.find(b => b.id === r.binId);
      if (!bin || !bin.lastCollectedAt) return false;
      const collectionTime = bin.lastCollectedAt.toMillis();
      return collectionTime > reportTime;
    });

    let avgResolutionTime = 0;
    if (resolvedReports.length > 0) {
      const times = resolvedReports.map(r => {
        const bin = bins.find(b => b.id === r.binId);
        return (bin.lastCollectedAt.toMillis() - r.createdAt.toMillis()) / (1000 * 60 * 60);
      });
      avgResolutionTime = times.reduce((sum, t) => sum + t, 0) / times.length;
    }

    const recentBins = bins.filter(b => b.lastCollectedAt && 
      (Date.now() - b.lastCollectedAt.toMillis()) < 7 * 24 * 60 * 60 * 1000
    );
    const improvementTrend = recentBins.length / bins.length;

    const avgRiskScore = bins.reduce((sum, b) => sum + (b.riskScore || 0), 0) / bins.length;

    return {
      highRiskZones: highRiskBins,
      avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
      improvementTrend: Math.round(improvementTrend * 100),
      totalBins: bins.length,
      avgRiskScore: Math.round(avgRiskScore),
      slaBreaches: totalSlaBreaches
    };
  };

  const stats = calculateStats();

  return (
    <div className="analytics-panel">
      <h2>Analytics</h2>
      <div className="analytics-grid">
        <div className="analytics-card">
          <div className="analytics-label">High-Risk Zones</div>
          <div className="analytics-value">{stats.highRiskZones}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-label">Avg Resolution Time</div>
          <div className="analytics-value">{stats.avgResolutionTime}h</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-label">Cleanliness Trend</div>
          <div className="analytics-value">{stats.improvementTrend}%</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-label">Total Bins</div>
          <div className="analytics-value">{stats.totalBins}</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-label">Avg Risk Score</div>
          <div className="analytics-value">{stats.avgRiskScore}/100</div>
        </div>
        <div className="analytics-card">
          <div className="analytics-label">SLA Breaches</div>
          <div className="analytics-value">{stats.slaBreaches}</div>
        </div>
      </div>
    </div>
  );
}

