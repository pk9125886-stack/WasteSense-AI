import { calculateSLAStatus, getSLABreachCount, SLA_STATUS } from '../services/slaService';
import { calculateRiskScore } from '../services/riskEngine';

export default function CleanlinessReportCard({ bins, reports }) {
  const calculateAreaStats = () => {
    const zones = {};
    
    bins.forEach(bin => {
      const zone = bin.zone || 'default';
      if (!zones[zone]) {
        zones[zone] = {
          name: zone,
          bins: [],
          totalRisk: 0,
          slaBreaches: 0,
          totalBins: 0
        };
      }
      zones[zone].bins.push(bin);
      zones[zone].totalBins++;
    });
    
    const zoneBreaches = getSLABreachCount(bins, reports);
    
    return Object.values(zones).map(zone => {
      const binReports = reports.filter(r => 
        zone.bins.some(b => b.id === r.binId)
      );
      
      let totalRisk = 0;
      let slaBreaches = 0;
      
      zone.bins.forEach(bin => {
        const binReportsForBin = binReports.filter(r => r.binId === bin.id);
        const riskScore = calculateRiskScore(bin, binReportsForBin);
        totalRisk += riskScore;
        
        const latestReport = binReportsForBin.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        })[0];
        
        const slaStatus = calculateSLAStatus(bin, latestReport);
        if (slaStatus.status === SLA_STATUS.BREACHED) {
          slaBreaches++;
        }
      });
      
      const avgRisk = zone.bins.length > 0 ? totalRisk / zone.bins.length : 0;
      const slaCompliance = zone.bins.length > 0 
        ? ((zone.bins.length - slaBreaches) / zone.bins.length) * 100 
        : 100;
      
      const previousWeekRisk = avgRisk * 0.95;
      const trend = avgRisk < previousWeekRisk ? 'improving' : avgRisk > previousWeekRisk ? 'degrading' : 'stable';
      
      return {
        ...zone,
        avgRisk: Math.round(avgRisk),
        slaCompliance: Math.round(slaCompliance),
        slaBreaches,
        trend,
        cleanlinessScore: Math.max(0, 100 - avgRisk)
      };
    });
  };
  
  const areaStats = calculateAreaStats();
  const overallStats = {
    avgCleanliness: areaStats.length > 0
      ? Math.round(areaStats.reduce((sum, a) => sum + a.cleanlinessScore, 0) / areaStats.length)
      : 0,
    avgSLACompliance: areaStats.length > 0
      ? Math.round(areaStats.reduce((sum, a) => sum + a.slaCompliance, 0) / areaStats.length)
      : 100,
    totalBins: bins.length,
    totalAreas: areaStats.length
  };
  
  return (
    <div className="report-card">
      <div className="report-card-header">
        <h2>Cleanliness Report Card</h2>
        <div className="report-card-date">
          {new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>
      
      <div className="report-card-summary">
        <div className="summary-item">
          <div className="summary-label">Overall Cleanliness</div>
          <div className="summary-value-large">{overallStats.avgCleanliness}/100</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">SLA Compliance</div>
          <div className="summary-value-large">{overallStats.avgSLACompliance}%</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Total Bins</div>
          <div className="summary-value">{overallStats.totalBins}</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Areas Monitored</div>
          <div className="summary-value">{overallStats.totalAreas}</div>
        </div>
      </div>
      
      <div className="report-card-areas">
        <h3>Area Performance</h3>
        <div className="areas-table">
          <div className="areas-header">
            <div>Area</div>
            <div>Cleanliness</div>
            <div>SLA Compliance</div>
            <div>Trend</div>
          </div>
          {areaStats.map((area, idx) => (
            <div key={idx} className="areas-row">
              <div className="area-name">{area.name}</div>
              <div className="area-score">
                <span className={`score-badge ${area.cleanlinessScore >= 70 ? 'good' : area.cleanlinessScore >= 50 ? 'medium' : 'poor'}`}>
                  {area.cleanlinessScore}/100
                </span>
              </div>
              <div className="area-sla">
                <span className={`sla-badge ${area.slaCompliance >= 90 ? 'good' : area.slaCompliance >= 70 ? 'medium' : 'poor'}`}>
                  {area.slaCompliance}%
                </span>
              </div>
              <div className="area-trend">
                <span className={`trend-icon ${area.trend}`}>
                  {area.trend === 'improving' ? '↑' : area.trend === 'degrading' ? '↓' : '→'}
                </span>
                <span className="trend-text">{area.trend}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

