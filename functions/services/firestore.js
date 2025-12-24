const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const getBin = async (binId) => {
  const binDoc = await db.collection('bins').doc(binId).get();
  if (!binDoc.exists) {
    return null;
  }
  return { id: binDoc.id, ...binDoc.data() };
};

const getBinReports = async (binId, limitHours = 48) => {
  const cutoffTime = admin.firestore.Timestamp.fromMillis(
    Date.now() - (limitHours * 60 * 60 * 1000)
  );
  
  const snapshot = await db.collection('reports')
    .where('binId', '==', binId)
    .where('createdAt', '>=', cutoffTime)
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getAllBins = async () => {
  const snapshot = await db.collection('bins').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getAllReports = async (limitHours = 48) => {
  const cutoffTime = admin.firestore.Timestamp.fromMillis(
    Date.now() - (limitHours * 60 * 60 * 1000)
  );
  
  const snapshot = await db.collection('reports')
    .where('createdAt', '>=', cutoffTime)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const updateBin = async (binId, updates) => {
  await db.collection('bins').doc(binId).update(updates);
};

const getLatestReportForBin = async (binId) => {
  const snapshot = await db.collection('reports')
    .where('binId', '==', binId)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
};

module.exports = {
  db,
  getBin,
  getBinReports,
  getAllBins,
  getAllReports,
  updateBin,
  getLatestReportForBin
};

