import { explainRiskScore } from '../services/riskEngine';

export default function ExplainableAIPanel({ bin, reports, weather, slaStatus, onClose }) {
  if (!bin) return null;
  
  const explanation = explainRiskScore(bin, reports, weather, slaStatus);
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Risk Score Explanation</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="explanation-content">
          <div className="explanation-summary">
            <div className="explanation-score">
              <span className="score-label">Total Risk Score</span>
              <span className="score-value-large">{explanation.score}/100</span>
            </div>
            <div className="risk-level-badge">
              {explanation.score >= 70 ? 'HIGH' : explanation.score >= 40 ? 'MEDIUM' : 'LOW'}
            </div>
          </div>
          
          <div className="explanation-breakdown">
            <h3>Score Breakdown</h3>
            <div className="breakdown-grid">
              <div className="breakdown-item">
                <span className="breakdown-label">Base Score</span>
                <span className="breakdown-value">{explanation.breakdown.baseScore}</span>
              </div>
              {explanation.breakdown.slaBoost > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">SLA Boost</span>
                  <span className="breakdown-value positive">+{explanation.breakdown.slaBoost}</span>
                </div>
              )}
              {explanation.breakdown.weatherBoost > 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">Weather Boost</span>
                  <span className="breakdown-value positive">+{explanation.breakdown.weatherBoost}</span>
                </div>
              )}
              {explanation.breakdown.crowdBoost !== 0 && (
                <div className="breakdown-item">
                  <span className="breakdown-label">Crowd Boost</span>
                  <span className={`breakdown-value ${explanation.breakdown.crowdBoost > 0 ? 'positive' : 'negative'}`}>
                    {explanation.breakdown.crowdBoost > 0 ? '+' : ''}{explanation.breakdown.crowdBoost}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="explanation-factors">
            <h3>Contributing Factors</h3>
            <div className="factors-list">
              {explanation.explanations.map((factor, idx) => (
                <div key={idx} className="factor-item">
                  <div className="factor-header">
                    <span className="factor-name">{factor.factor}</span>
                    <span className="factor-contribution">+{factor.contribution}</span>
                  </div>
                  <div className="factor-details">{factor.details}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

