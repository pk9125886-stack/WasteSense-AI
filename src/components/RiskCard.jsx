import { getRiskLevel } from '../services/riskEngine';
import { calculateSLAStatus, SLA_STATUS } from '../services/slaService';

export default function RiskCard({ bin, riskScore, prediction, slaStatus, onExplainClick }) {
  const riskLevel = getRiskLevel(riskScore);
  const riskColors = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#dc2626'
  };

  const slaStatusColors = {
    [SLA_STATUS.ON_TIME]: '#10b981',
    [SLA_STATUS.AT_RISK]: '#f59e0b',
    [SLA_STATUS.BREACHED]: '#dc2626'
  };

  const displaySlaStatus = slaStatus || calculateSLAStatus(bin);

  return (
    <div className="risk-card">
      <div className="risk-card-header">
        <h3>{bin.locationName}</h3>
        <div className="risk-badges">
          <span 
            className="risk-badge" 
            style={{ backgroundColor: riskColors[riskLevel] }}
          >
            {riskLevel.toUpperCase()}
          </span>
          <span 
            className="sla-badge-small" 
            style={{ backgroundColor: slaStatusColors[displaySlaStatus.status] }}
            title={`SLA: ${displaySlaStatus.status} (${Math.round(displaySlaStatus.progressPercent)}%)`}
          >
            SLA
          </span>
        </div>
      </div>
      <div className="risk-card-body">
        <div className="risk-score">
          <span className="score-label">Risk Score</span>
          <span className="score-value">{riskScore}/100</span>
        </div>
        {displaySlaStatus.status !== SLA_STATUS.ON_TIME && (
          <div className={`sla-alert ${displaySlaStatus.status === SLA_STATUS.BREACHED ? 'breached' : 'at-risk'}`}>
            <strong>SLA {displaySlaStatus.status === SLA_STATUS.BREACHED ? 'BREACHED' : 'AT RISK'}</strong>
            <span>{Math.round(displaySlaStatus.progressPercent)}% elapsed ({Math.round(displaySlaStatus.remainingHours)}h remaining)</span>
          </div>
        )}
        {prediction && prediction.willOverflow && (
          <div className="prediction-alert">
            <strong>Overflow Predicted</strong>
            <span>Within {prediction.hoursUntilOverflow}h ({(prediction.confidence * 100).toFixed(0)}% confidence)</span>
          </div>
        )}
        <div className="risk-details">
          <div>Last Collected: {bin.lastCollectedAt ? new Date(bin.lastCollectedAt.toMillis()).toLocaleDateString() : 'Never'}</div>
          <div>Overflow Count: {bin.overflowCount || 0}</div>
        </div>
        {onExplainClick && (
          <button className="explain-button" onClick={() => onExplainClick(bin)}>
            Explain Risk Score
          </button>
        )}
      </div>
    </div>
  );
}

