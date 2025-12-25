import { useEffect, useRef } from 'react';

export default function Heatmap({ map, data }) {
  const heatmapRef = useRef(null);

  useEffect(() => {
    if (!map || !window.google || !data.length) return;

    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }

    heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
      data: data,
      map: map,
      radius: 30,
      opacity: 0.6,
      gradient: [
        'rgba(0, 255, 0, 0)',
        'rgba(255, 255, 0, 0.5)',
        'rgba(255, 165, 0, 0.7)',
        'rgba(255, 0, 0, 0.9)'
      ]
    });

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }
    };
  }, [map, data]);

  return null;
}




