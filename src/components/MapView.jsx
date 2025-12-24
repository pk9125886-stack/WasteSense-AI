import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calculateRiskScore, getRiskLevel } from '../services/riskEngine';
import Heatmap from './Heatmap';

export default function MapView() {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [bins, setBins] = useState([]);
  const [reports, setReports] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=visualization`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = initializeMap;
    } else {
      initializeMap();
    }

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, []);

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

    return () => {
      unsubscribeBins();
      unsubscribeReports();
    };
  }, []);

  useEffect(() => {
    if (bins.length > 0 && reports.length >= 0 && mapInstanceRef.current) {
      updateMarkers();
      updateHeatmap();
    }
  }, [bins, reports]);

  const initializeMap = () => {
    if (mapRef.current && window.google) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 40.7128, lng: -74.0060 },
        zoom: 12,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      });
    }
  };

  const updateMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    bins.forEach(bin => {
      const binReports = reports.filter(r => r.binId === bin.id);
      const riskScore = calculateRiskScore(bin, binReports);
      const riskLevel = getRiskLevel(riskScore);

      const markerColor = riskLevel === 'high' ? '#dc2626' : riskLevel === 'medium' ? '#f59e0b' : '#10b981';
      
      const marker = new window.google.maps.Marker({
        position: { lat: bin.lat, lng: bin.lng },
        map: mapInstanceRef.current,
        title: `${bin.locationName} - Risk: ${riskScore}`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerColor,
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 8px;">
            <strong>${bin.locationName}</strong><br/>
            Risk Score: ${riskScore}/100<br/>
            Level: ${riskLevel.toUpperCase()}<br/>
            Last Collected: ${bin.lastCollectedAt ? new Date(bin.lastCollectedAt.toMillis()).toLocaleDateString() : 'Never'}
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current, marker);
      });

      markersRef.current.push(marker);
    });
  };

  const updateHeatmap = () => {
    const points = bins.map(bin => {
      const binReports = reports.filter(r => r.binId === bin.id);
      const riskScore = calculateRiskScore(bin, binReports);
      return {
        location: new window.google.maps.LatLng(bin.lat, bin.lng),
        weight: riskScore / 100
      };
    });
    setHeatmapData(points);
  };

  return (
    <div className="map-container">
      <div ref={mapRef} className="map" />
      {heatmapData.length > 0 && window.google && (
        <Heatmap map={mapInstanceRef.current} data={heatmapData} />
      )}
    </div>
  );
}

