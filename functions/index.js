const functions = require('firebase-functions');
const { recalculateBinRisk } = require('./engines/riskEngine');
const { monitorSLAForAllBins } = require('./engines/slaEngine');
const { predictOverflowForAllBins } = require('./engines/predictionEngine');

const simulateWeatherData = () => {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();
  
  const isRainySeason = month >= 5 && month <= 9;
  const baseRainChance = isRainySeason ? 0.3 : 0.1;
  const rainChance = baseRainChance + (Math.random() * 0.2);
  const isRaining = Math.random() < rainChance;
  
  const baseHumidity = isRainySeason ? 70 : 50;
  const humidity = baseHumidity + (Math.random() * 20) - 10;
  
  return {
    isRaining,
    humidity: Math.max(0, Math.min(100, humidity)),
    temperature: 20 + (Math.random() * 15),
    timestamp: Date.now()
  };
};

exports.onBinWrite = functions.firestore
  .document('bins/{binId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      return null;
    }
    
    const before = change.before.data();
    const after = change.after.data();
    
    const relevantFields = ['lastCollectedAt', 'overflowCount', 'locationName', 'slaDuration'];
    const hasRelevantChange = relevantFields.some(field => {
      const beforeVal = before?.[field];
      const afterVal = after?.[field];
      
      if (beforeVal?.toMillis && afterVal?.toMillis) {
        return beforeVal.toMillis() !== afterVal.toMillis();
      }
      
      return beforeVal !== afterVal;
    });
    
    if (!hasRelevantChange) {
      return null;
    }
    
    const binId = context.params.binId;
    const weather = simulateWeatherData();
    
    await recalculateBinRisk(binId, weather);
  });

exports.onReportWrite = functions.firestore
  .document('reports/{reportId}')
  .onWrite(async (change, context) => {
    const reportData = change.after.exists ? change.after.data() : change.before.data();
    const binId = reportData?.binId;
    
    if (!binId) {
      return null;
    }
    
    const weather = simulateWeatherData();
    await recalculateBinRisk(binId, weather);
  });

exports.slaMonitor = functions.pubsub
  .schedule('every 12 minutes')
  .onRun(async (context) => {
    const result = await monitorSLAForAllBins();
    return result;
  });

exports.overflowPrediction = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    const result = await predictOverflowForAllBins();
    return result;
  });

