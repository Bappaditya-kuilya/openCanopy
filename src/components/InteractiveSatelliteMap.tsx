import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface InteractiveSatelliteMapProps {
  center: [number, number];
  polygonCoords: [number, number][];
  onCoordinatePick?: (lat: number, lon: number) => void;
  editable?: boolean;
  onPolygonChange?: (coords: [number, number][]) => void;
  heightClass?: string;
}

export const InteractiveSatelliteMap: React.FC<InteractiveSatelliteMapProps> = ({
  center,
  polygonCoords,
  onCoordinatePick,
  editable = false,
  onPolygonChange,
  heightClass = 'h-72',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polygonLayerRef = useRef<L.Polygon | null>(null);
  const markerLayerRef = useRef<L.CircleMarker | null>(null);
  const vertexMarkersRef = useRef<L.CircleMarker[]>([]);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const prevCenterRef = useRef<[number, number]>(center);

  // Refs to prevent stale closures in Leaflet event listeners
  const polygonCoordsRef = useRef(polygonCoords);
  const editableRef = useRef(editable);
  const onPolygonChangeRef = useRef(onPolygonChange);
  const onCoordinatePickRef = useRef(onCoordinatePick);

  useEffect(() => {
    polygonCoordsRef.current = polygonCoords;
    editableRef.current = editable;
    onPolygonChangeRef.current = onPolygonChange;
    onCoordinatePickRef.current = onCoordinatePick;
  }, [polygonCoords, editable, onPolygonChange, onCoordinatePick]);

  const [layerMode, setLayerMode] = useState<'satellite' | 'topo'>('satellite');

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    const esriImagery = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 18 }
    ).addTo(map);

    tileLayerRef.current = esriImagery;
    mapInstanceRef.current = map;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(4));
      const lon = Number(e.latlng.lng.toFixed(4));
      if (editableRef.current && onPolygonChangeRef.current) {
        onPolygonChangeRef.current([...polygonCoordsRef.current, [lat, lon]]);
      } else if (onCoordinatePickRef.current) {
        onCoordinatePickRef.current(lat, lon);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);
    const nextUrl =
      layerMode === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(nextUrl, { maxZoom: 18 }).addTo(map);
  }, [layerMode]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polygonLayerRef.current) {
      map.removeLayer(polygonLayerRef.current);
      polygonLayerRef.current = null;
    }
    if (markerLayerRef.current) {
      map.removeLayer(markerLayerRef.current);
      markerLayerRef.current = null;
    }
    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];

    if (polygonCoords && polygonCoords.length >= 3) {
      const poly = L.polygon(polygonCoords, {
        color: '#0f9d58',
        weight: 2.5,
        fillColor: '#0f9d58',
        fillOpacity: 0.22,
      }).addTo(map);
      polygonLayerRef.current = poly;

      polygonCoords.forEach((pt) => {
        const vm = L.circleMarker(pt, {
          radius: 4.5,
          color: '#ffffff',
          weight: 2,
          fillColor: '#0f9d58',
          fillOpacity: 1,
        }).addTo(map);
        vertexMarkersRef.current.push(vm);
      });
    }

    const centerMarker = L.circleMarker(center, {
      radius: 6,
      color: '#ffffff',
      weight: 2,
      fillColor: '#5486bd',
      fillOpacity: 1,
    }).addTo(map);
    markerLayerRef.current = centerMarker;

    if (
      prevCenterRef.current[0] !== center[0] ||
      prevCenterRef.current[1] !== center[1]
    ) {
      prevCenterRef.current = center;
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, polygonCoords]);

  return (
    <div className="relative rounded-[8px] overflow-hidden border border-[#e5e7eb] bg-[#f5f7f7]">
      <div ref={mapContainerRef} className={`w-full ${heightClass} z-0`} />

      {/* GeeksforGeeks Light chip toggle */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-white/95 p-1 rounded-[8px] border border-[#e5e7eb]">
        <button
          type="button"
          onClick={() => setLayerMode('satellite')}
          className={`px-3 py-1.5 rounded-[4px] text-[12px] transition-colors cursor-pointer ${
            layerMode === 'satellite'
              ? 'bg-[#0f9d58] text-white font-semibold'
              : 'bg-white text-[#273239] hover:bg-[#f5f7f7]'
          }`}
        >
          Optical Satellite
        </button>
        <button
          type="button"
          onClick={() => setLayerMode('topo')}
          className={`px-3 py-1.5 rounded-[4px] text-[12px] transition-colors cursor-pointer ${
            layerMode === 'topo'
              ? 'bg-[#0f9d58] text-white font-semibold'
              : 'bg-white text-[#273239] hover:bg-[#f5f7f7]'
          }`}
        >
          Terrain Relief
        </button>
      </div>

      {/* Bottom coordinate helper bar */}
      <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/95 border border-[#e5e7eb] rounded-[8px] px-3 py-2 flex items-center justify-between text-[12px] text-[#273239]">
        <span>
          {editable
            ? 'Click on the map to add polygon vertices'
            : 'Click any coordinate to fetch live Sentinel-2 STAC & Open-Meteo data'}
        </span>
        <span className="font-mono text-[#5486bd] font-medium">
          {center[0].toFixed(4)}°N, {center[1].toFixed(4)}°E
        </span>
      </div>
    </div>
  );
};
