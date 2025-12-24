import { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function Report() {
  const [formData, setFormData] = useState({
    binId: '',
    status: 'half',
    description: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [bins, setBins] = useState([]);

  useEffect(() => {
    const loadBins = async () => {
      const binsQuery = query(collection(db, 'bins'));
      const snapshot = await getDocs(binsQuery);
      const binsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBins(binsData);
    };
    loadBins();
  }, []);

  const calculateCredibilityScore = async (binId) => {
    const recentReportsQuery = query(
      collection(db, 'reports'),
      where('binId', '==', binId),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const snapshot = await getDocs(recentReportsQuery);
    const recentReports = snapshot.docs.map(doc => doc.data());

    if (recentReports.length === 0) return 0.7;

    const statusCounts = {};
    recentReports.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    const mostCommonStatus = Object.keys(statusCounts).reduce((a, b) => 
      statusCounts[a] > statusCounts[b] ? a : b
    );

    if (formData.status === mostCommonStatus) {
      return Math.min(0.9, 0.5 + (recentReports.length * 0.05));
    }

    return Math.max(0.3, 0.7 - (recentReports.length * 0.05));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.binId) {
      alert('Please select a bin location');
      return;
    }

    const credibilityScore = await calculateCredibilityScore(formData.binId);

    await addDoc(collection(db, 'reports'), {
      binId: formData.binId,
      status: formData.status,
      description: formData.description,
      credibilityScore,
      createdAt: Timestamp.now()
    });

    setSubmitted(true);
    setFormData({ binId: '', status: 'half', description: '' });
    
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Report Bin Status</h1>
        <p>Submit a cleanliness report</p>
      </div>
      <div className="report-form-container">
        {submitted && (
          <div className="success-message">
            Report submitted successfully
          </div>
        )}
        <form onSubmit={handleSubmit} className="report-form">
          <div className="form-group">
            <label htmlFor="binId">Bin Location</label>
            <select
              id="binId"
              value={formData.binId}
              onChange={(e) => setFormData({ ...formData, binId: e.target.value })}
              required
            >
              <option value="">Select a location</option>
              {bins.map(bin => (
                <option key={bin.id} value={bin.id}>
                  {bin.locationName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="status">Current Status</label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              required
            >
              <option value="empty">Empty</option>
              <option value="half">Half Full</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows="4"
            />
          </div>
          <button type="submit" className="submit-button">
            Submit Report
          </button>
        </form>
      </div>
    </div>
  );
}

