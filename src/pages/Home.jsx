import MapView from '../components/MapView';

export default function Home() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Waste Intelligence Map</h1>
        <p>Real-time cleanliness risk visualization</p>
      </div>
      <MapView />
    </div>
  );
}

