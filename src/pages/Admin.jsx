import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateRiskScore } from '../services/riskEngine';
import { predictOverflow } from '../services/predictionEngine';
import { calculateSLAStatus, getSLABreachCount, SLA_STATUS } from '../services/slaService';
import { getWeatherData, isWeatherCritical } from '../services/weatherService';
import { simulateCollectionSkip, simulateWorkforceReduction } from '../services/simulationEngine';
import { assignWorkersToZones, getOptimalWorkerCount } from '../services/workforceService';
import RiskCard from '../components/RiskCard';
import AnalyticsPanel from '../components/AnalyticsPanel';
import CleanlinessReportCard from '../components/CleanlinessReportCard';
import ExplainableAIPanel from '../components/ExplainableAIPanel';

export default function Admin() {
  const [bins, setBins] = useState([]);
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState('all');
  const [weather, setWeather] = useState(null);
  const [selectedBinForExplanation, setSelectedBinForExplanation] = useState(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [selectedZonesForSimulation, setSelectedZonesForSimulation] = useState([]);
  const [availableWorkers, setAvailableWorkers] = useState(10);
  const [workforceAssignment, setWorkforceAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const binsQuery = query(collection(db, 'bins'));
    const unsubscribeBins = onSnapshot(binsQuery, (snapshot) => {
      const binsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBins(binsData);
    });

    const reportsQuery = query(collection(db, 'reports'));
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(reportsData);
    });

    const loadWeather = async () => {
      const weatherData = await getWeatherData();
      setWeather(weatherData);
    };
    loadWeather();
    const weatherInterval = setInterval(loadWeather, 30 * 60 * 1000);

    return () => {
      unsubscribeBins();
      unsubscribeReports();
      clearInterval(weatherInterval);
    };
  }, []);

  useEffect(() => {
    if (bins.length > 0 && reports.length >= 0) {
      const assignment = assignWorkersToZones(bins, reports, availableWorkers);
      setWorkforceAssignment(assignment);
    }
  }, [bins, reports, availableWorkers]);

  useEffect(() => {
    const updateRiskScores = async () => {
      for (const bin of bins) {
        const binReports = reports.filter(r => r.binId === bin.id);
        const latestReport = binReports.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        })[0];
        const slaStatus = calculateSLAStatus(bin, latestReport);
        const riskScore = calculateRiskScore(bin, binReports, { weather, slaStatus });
        
        if (bin.riskScore !== riskScore) {
          await updateDoc(doc(db, 'bins', bin.id), {
            riskScore
          });
        }
      }
    };

    if (bins.length > 0 && reports.length >= 0 && weather) {
      updateRiskScores();
    }
  }, [bins, reports, weather]);

  const getPrioritizedBins = () => {
    const binsWithRisk = bins.map(bin => {
      const binReports = reports.filter(r => r.binId === bin.id);
      const latestReport = binReports.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      })[0];
      const slaStatus = calculateSLAStatus(bin, latestReport);
      const riskScore = calculateRiskScore(bin, binReports, { weather, slaStatus });
      const prediction = predictOverflow(bin, binReports);
      return { ...bin, riskScore, prediction, slaStatus };
    });

    binsWithRisk.sort((a, b) => {
      if (a.prediction.willOverflow && !b.prediction.willOverflow) return -1;
      if (!a.prediction.willOverflow && b.prediction.willOverflow) return 1;
      if (a.slaStatus.status === SLA_STATUS.BREACHED && b.slaStatus.status !== SLA_STATUS.BREACHED) return -1;
      if (a.slaStatus.status !== SLA_STATUS.BREACHED && b.slaStatus.status === SLA_STATUS.BREACHED) return 1;
      return b.riskScore - a.riskScore;
    });

    if (filter === 'high') {
      return binsWithRisk.filter(b => b.riskScore >= 70);
    }
    if (filter === 'predicted') {
      return binsWithRisk.filter(b => b.prediction.willOverflow);
    }
    if (filter === 'sla-breached') {
      return binsWithRisk.filter(b => b.slaStatus.status === SLA_STATUS.BREACHED);
    }
    return binsWithRisk;
  };

  const handleSimulateSkip = async () => {
    if (selectedZonesForSimulation.length === 0) {
      alert('Please select at least one zone to simulate skipping');
      return;
    }
    const currentWeather = weather || await getWeatherData();
    const skippedBinIds = bins
      .filter(bin => selectedZonesForSimulation.includes(bin.zone || 'default'))
      .map(bin => bin.id);
    const results = simulateCollectionSkip(bins, reports, skippedBinIds, currentWeather);
    setSimulationResults(results);
  };

  const handleSimulateWorkforce = async () => {
    const currentWeather = weather || await getWeatherData();
    const results = simulateWorkforceReduction(bins, reports, availableWorkers, currentWeather);
    setSimulationResults(results);
  };

  const zoneBreaches = getSLABreachCount(bins, reports);
  const weatherCritical = weather && isWeatherCritical(weather);

  const handleMarkCollected = async (binId) => {
    await updateDoc(doc(db, 'bins', binId), {
      lastCollectedAt: Timestamp.now(),
      overflowCount: 0
    });
  };

  const prioritizedBins = getPrioritizedBins();
  const immediateAction = prioritizedBins.filter(b => b.riskScore >= 70 || b.prediction.willOverflow);
  const canSkip = prioritizedBins.filter(b => b.riskScore < 30 && !b.prediction.willOverflow);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Intelligent collection planning</p>
      </div>

      <div className="admin-tabs">
        <button 
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={activeTab === 'simulation' ? 'active' : ''}
          onClick={() => setActiveTab('simulation')}
        >
          Simulation
        </button>
        <button 
          className={activeTab === 'workforce' ? 'active' : ''}
          onClick={() => setActiveTab('workforce')}
        >
          Workforce
        </button>
        <button 
          className={activeTab === 'report' ? 'active' : ''}
          onClick={() => setActiveTab('report')}
        >
          Report Card
        </button>
      </div>

      {weather && (
        <div className={`weather-alert ${weatherCritical ? 'critical' : ''}`}>
          <div className="weather-info">
            <strong>Weather:</strong> {weather.isRaining ? 'Raining' : 'Clear'} | 
            Humidity: {Math.round(weather.humidity)}% | 
            Temp: {Math.round(weather.temperature)}°C
            {weatherCritical && <span className="weather-warning"> - Weather conditions may increase risk</span>}
          </div>
        </div>
      )}
      
      {activeTab === 'dashboard' && (
        <>
          <AnalyticsPanel bins={bins} reports={reports} />

          <div className="sla-summary">
            <h3>SLA Breach Summary by Zone</h3>
            <div className="sla-zones">
              {Object.entries(zoneBreaches).map(([zone, count]) => (
                <div key={zone} className="sla-zone-item">
                  <span className="zone-name">{zone}</span>
                  <span className={`breach-count ${count > 0 ? 'has-breaches' : ''}`}>
                    {count} breach{count !== 1 ? 'es' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-controls">
            <div className="filter-tabs">
              <button 
                className={filter === 'all' ? 'active' : ''}
                onClick={() => setFilter('all')}
              >
                All Bins
              </button>
              <button 
                className={filter === 'high' ? 'active' : ''}
                onClick={() => setFilter('high')}
              >
                High Risk
              </button>
              <button 
                className={filter === 'predicted' ? 'active' : ''}
                onClick={() => setFilter('predicted')}
              >
                Predicted Overflow
              </button>
              <button 
                className={filter === 'sla-breached' ? 'active' : ''}
                onClick={() => setFilter('sla-breached')}
              >
                SLA Breached
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'simulation' && (
        <div className="simulation-panel">
          <h2>Cleanliness Impact Simulator</h2>
          <div className="simulation-controls">
            <div className="simulation-mode">
              <label>
                <input 
                  type="radio" 
                  checked={!simulationMode} 
                  onChange={() => setSimulationMode(false)}
                />
                Simulate Zone Skip
              </label>
              <label>
                <input 
                  type="radio" 
                  checked={simulationMode} 
                  onChange={() => setSimulationMode(true)}
                />
                Simulate Workforce Reduction
              </label>
            </div>

            {!simulationMode ? (
              <div className="zone-selection">
                <h3>Select Zones to Skip</h3>
                <div className="zones-list">
                  {Array.from(new Set(bins.map(b => b.zone || 'default'))).map(zone => (
                    <label key={zone} className="zone-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedZonesForSimulation.includes(zone)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedZonesForSimulation([...selectedZonesForSimulation, zone]);
                          } else {
                            setSelectedZonesForSimulation(selectedZonesForSimulation.filter(z => z !== zone));
                          }
                        }}
                      />
                      {zone}
                    </label>
                  ))}
                </div>
                <button className="simulate-button" onClick={handleSimulateSkip}>
                  Run Simulation
                </button>
              </div>
            ) : (
              <div className="workforce-simulation">
                <h3>Workforce Capacity</h3>
                <div className="workforce-input">
                  <label>Available Workers:</label>
                  <input
                    type="number"
                    min="1"
                    value={availableWorkers}
                    onChange={(e) => setAvailableWorkers(parseInt(e.target.value) || 1)}
                  />
                </div>
                <button className="simulate-button" onClick={handleSimulateWorkforce}>
                  Run Simulation
                </button>
              </div>
            )}

            {simulationResults && (
              <div className="simulation-results">
                <h3>Simulation Results</h3>
                <div className="simulation-summary">
                  <div className="sim-stat">
                    <span className="sim-label">Total Risk Increase</span>
                    <span className="sim-value">{simulationResults.summary.totalRiskIncrease}</span>
                  </div>
                  <div className="sim-stat">
                    <span className="sim-label">Bins at Risk</span>
                    <span className="sim-value">{simulationResults.summary.binsAtRisk}</span>
                  </div>
                  <div className="sim-stat">
                    <span className="sim-label">SLA Breaches</span>
                    <span className="sim-value">{simulationResults.summary.binsBreached}</span>
                  </div>
                </div>
                <div className="simulation-details">
                  <h4>Top Impacted Bins</h4>
                  <div className="impacted-bins">
                    {simulationResults.results
                      .sort((a, b) => b.riskChange - a.riskChange)
                      .slice(0, 10)
                      .map((result, idx) => (
                        <div key={idx} className="impacted-bin">
                          <span>{result.locationName || `Bin ${result.binId}`}</span>
                          <span className={`risk-change ${result.riskChange > 0 ? 'increase' : 'decrease'}`}>
                            {result.riskChange > 0 ? '+' : ''}{Math.round(result.riskChange)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'workforce' && workforceAssignment && (
        <div className="workforce-panel">
          <h2>Workforce Load Balancer</h2>
          <div className="workforce-summary">
            <div className="workforce-stat">
              <span className="stat-label">Available Workers</span>
              <span className="stat-value">{workforceAssignment.summary.available}</span>
            </div>
            <div className="workforce-stat">
              <span className="stat-label">Required Workers</span>
              <span className={`stat-value ${workforceAssignment.summary.overload ? 'overload' : ''}`}>
                {workforceAssignment.summary.required}
              </span>
            </div>
            <div className="workforce-stat">
              <span className="stat-label">Coverage</span>
              <span className="stat-value">{Math.round(workforceAssignment.summary.coverage)}%</span>
            </div>
            <div className="workforce-input-inline">
              <label>Adjust Workers:</label>
              <input
                type="number"
                min="1"
                value={availableWorkers}
                onChange={(e) => setAvailableWorkers(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
          {workforceAssignment.summary.overload && (
            <div className="overload-warning">
              Warning: Insufficient workforce. {workforceAssignment.summary.required - workforceAssignment.summary.available} additional workers needed.
            </div>
          )}
          {workforceAssignment.summary.underutilization && (
            <div className="underutilization-info">
              Info: {workforceAssignment.summary.remaining} workers available for additional assignments.
            </div>
          )}
          <div className="zone-assignments">
            <h3>Zone Assignments</h3>
            <div className="assignments-table">
              <div className="assignments-header">
                <div>Zone</div>
                <div>Assigned</div>
                <div>Required</div>
                <div>High Risk Bins</div>
                <div>Utilization</div>
              </div>
              {Object.values(workforceAssignment.assignments).map((assignment, idx) => (
                <div key={idx} className="assignment-row">
                  <div className="zone-name">{assignment.zone}</div>
                  <div className="assigned-count">{assignment.assigned}</div>
                  <div className={`required-count ${assignment.assigned < assignment.required ? 'insufficient' : ''}`}>
                    {assignment.required}
                  </div>
                  <div className="high-risk-count">{assignment.highRisk}</div>
                  <div className="utilization">{Math.round(assignment.utilization)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'report' && (
        <CleanlinessReportCard bins={bins} reports={reports} />
      )}

      {activeTab === 'dashboard' && (
        <>

          <div className="collection-suggestions">
            <div className="suggestion-section">
              <h2>Immediate Collection Required</h2>
              <p>{immediateAction.length} bins need urgent attention</p>
              <div className="bins-grid">
                {immediateAction.slice(0, 5).map(bin => {
                  const binReports = reports.filter(r => r.binId === bin.id);
                  const prediction = predictOverflow(bin, binReports);
                  return (
                    <div key={bin.id} className="bin-card-action">
                      <RiskCard 
                        bin={bin} 
                        riskScore={bin.riskScore} 
                        prediction={prediction}
                        slaStatus={bin.slaStatus}
                        onExplainClick={setSelectedBinForExplanation}
                      />
                      <button 
                        className="collect-button"
                        onClick={() => handleMarkCollected(bin.id)}
                      >
                        Mark Collected
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="suggestion-section">
              <h2>Can Skip</h2>
              <p>{canSkip.length} bins are low priority</p>
            </div>
          </div>

          <div className="bins-list">
            <h2>All Bins ({prioritizedBins.length})</h2>
            <div className="bins-grid">
              {prioritizedBins.map(bin => {
                const binReports = reports.filter(r => r.binId === bin.id);
                const prediction = predictOverflow(bin, binReports);
                return (
                  <div key={bin.id} className="bin-card">
                    <RiskCard 
                      bin={bin} 
                      riskScore={bin.riskScore} 
                      prediction={prediction}
                      slaStatus={bin.slaStatus}
                      onExplainClick={setSelectedBinForExplanation}
                    />
                    <button 
                      className="collect-button"
                      onClick={() => handleMarkCollected(bin.id)}
                    >
                      Mark Collected
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {selectedBinForExplanation && (
        <ExplainableAIPanel
          bin={selectedBinForExplanation}
          reports={reports.filter(r => r.binId === selectedBinForExplanation.id)}
          weather={weather}
          slaStatus={selectedBinForExplanation.slaStatus}
          onClose={() => setSelectedBinForExplanation(null)}
        />
      )}
    </div>
  );
}

