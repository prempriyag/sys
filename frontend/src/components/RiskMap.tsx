import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';

const RiskMap = ({ booths }) => {
    // Default center (Bangalore approx)
    const position = [12.9716, 77.5946];
    // Only show booths with valid lat/lng to avoid NaN on map
    const boothsWithCoords = (booths || []).filter(
        (b) => b != null && typeof b.lat === 'number' && typeof b.lng === 'number' && !Number.isNaN(b.lat) && !Number.isNaN(b.lng)
    );

    return (
        <MapContainer center={position} zoom={13} style={{ height: '500px', width: '100%', borderRadius: '12px' }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {boothsWithCoords.map((booth) => (
                <CircleMarker
                    key={booth.booth_id}
                    center={[booth.lat, booth.lng]}
                    radius={10}
                    fillOpacity={0.7}
                    pathOptions={{
                        color: booth.risk_category === 'HIGH_RISK' ? 'red' : 'green',
                        fillColor: booth.risk_category === 'HIGH_RISK' ? 'red' : 'green'
                    }}
                >
                    <Popup>
                        <strong>Booth {booth.booth_id}</strong><br />
                        Risk: {booth.risk_category}
                    </Popup>
                </CircleMarker>
            ))}
        </MapContainer>
    );
};

export default RiskMap;
