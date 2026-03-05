import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface BoothWithCoords {
  booth_id: number;
  lat: number;
  lng: number;
  risk_category?: string;
  [key: string]: unknown;
}

interface RiskMapProps {
  booths: BoothWithCoords[] | null | undefined;
}

const RiskMap = ({ booths }: RiskMapProps) => {
  const position: [number, number] = [12.9716, 77.5946];
  const boothsWithCoords = (booths || []).filter(
    (b: BoothWithCoords) =>
      b != null &&
      typeof b.lat === 'number' &&
      typeof b.lng === 'number' &&
      !Number.isNaN(b.lat) &&
      !Number.isNaN(b.lng)
  );

  return (
    <MapContainer
      {...({ center: position, zoom: 13, style: { height: '500px', width: '100%', borderRadius: '12px' } } as any)}
    >
      <TileLayer
        {...({
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        } as any)}
      />
      {boothsWithCoords.map((booth: BoothWithCoords) => (
        <CircleMarker
          key={booth.booth_id}
          {...({
            center: [booth.lat, booth.lng],
            radius: 10,
            pathOptions: {
              color: booth.risk_category === 'HIGH_RISK' ? 'red' : 'green',
              fillColor: booth.risk_category === 'HIGH_RISK' ? 'red' : 'green',
              fillOpacity: 0.7,
            },
          } as any)}
        >
          <Popup>
            <strong>Booth {booth.booth_id}</strong>
            <br />
            Risk: {booth.risk_category}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default RiskMap;
