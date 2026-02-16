
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { getBoothKPI, getRiskMap, getConstituencies } from '../../services/api';
import 'leaflet/dist/leaflet.css';

const BoothAnalysis: React.FC = () => {
    const { boothId } = useParams<{ boothId: string }>();
    const navigate = useNavigate();

    const [kpi, setKpi] = useState<any>(null);
    const [mapData, setMapData] = useState<any[]>([]);
    const [constituencies, setConstituencies] = useState<{ id: number; name: string; district: string }[]>([]);
    const [constituencyId, setConstituencyId] = useState<number | null>(null);

    useEffect(() => {
        getConstituencies().then((res) => {
            const list = res.data || [];
            setConstituencies(list);
            if (list.length > 0 && constituencyId == null) {
                setConstituencyId(list[0].id);
            }
        });
    }, []);

    useEffect(() => {
        if (boothId) {
            getBoothKPI(parseInt(boothId)).then((res) => setKpi(res.data));
        } else if (constituencyId != null) {
            getRiskMap(constituencyId).then((res) => {
                const data = res.data || [];
                setMapData(data.filter((b: any) => b != null && typeof b.lat === 'number' && typeof b.lng === 'number' && !Number.isNaN(b.lat) && !Number.isNaN(b.lng)));
            });
        }
    }, [boothId, constituencyId]);

    // Color logic
    const getRiskColor = (risk: string) => {
        if (risk === 'HIGH_RISK') return 'red';
        if (risk === 'HIGH_OPPORTUNITY') return 'blue';
        if (risk === 'ANOMALY') return 'purple';
        return 'green';
    };

    if (boothId) {
        // Single Booth View
        if (!kpi) return <div className="p-6">Loading booth analysis...</div>;

        return (
            <div className="p-6 bg-gray-100 min-h-screen">
                <button onClick={() => navigate('/booth-analysis')} className="mb-4 text-blue-600 hover:underline">
                    &larr; Back to Map
                </button>
                <h1 className="text-3xl font-bold mb-6 text-gray-800">Booth Analysis: {kpi.booth_number || boothId}</h1>

                <div className="bg-white p-6 rounded-xl shadow-md mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Risk Status</h2>
                        <span className={`px-3 py-1 rounded-full text-white font-bold ${kpi.risk_category === 'HIGH_RISK' ? 'bg-red-500' :
                            kpi.risk_category === 'ANOMALY' ? 'bg-purple-500' : 'bg-green-500'
                            }`}>
                            {kpi.risk_category || 'NORMAL'}
                        </span>
                    </div>
                    {/* KPI Cards from previous step */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-gray-500 text-sm">Total Voters (Pre)</h3>
                            <p className="text-2xl font-bold">{kpi.total_pre}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <h3 className="text-gray-500 text-sm">Total Voters (Post)</h3>
                            <p className="text-2xl font-bold">{kpi.total_post}</p>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <h3 className="text-green-700 text-sm">Additions</h3>
                            <p className="text-2xl font-bold text-green-600">+{kpi.additions}</p>
                        </div>
                        <div className="p-4 bg-red-50 rounded-lg">
                            <h3 className="text-red-700 text-sm">Deletions</h3>
                            <p className="text-2xl font-bold text-red-600">-{kpi.deletions}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Map View (All Booths)
    return (
        <div className="p-6 bg-gray-100 min-h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Risk Map Analysis</h1>
                <select
                    value={constituencyId ?? ''}
                    onChange={(e) => setConstituencyId(Number(e.target.value))}
                    className="p-2 rounded border"
                >
                    {constituencies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} - {c.district}</option>
                    ))}
                </select>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-md overflow-hidden relative" style={{ minHeight: '600px' }}>
                {/* Check if we have data to center the map, else default to some coords */}
                <MapContainer center={[12.9716, 77.5946]} zoom={12} style={{ height: '100%', width: '100%' }} key={constituencyId}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {mapData.map(booth => (
                        <CircleMarker
                            key={booth.booth_id}
                            center={[booth.lat, booth.lng]}
                            pathOptions={{ color: getRiskColor(booth.risk_category), fillColor: getRiskColor(booth.risk_category), fillOpacity: 0.7 }}
                            radius={8}
                            eventHandlers={{
                                click: () => navigate(`/booth-analysis/${booth.booth_id}`)
                            }}
                        >
                            <Popup>
                                <div className="text-sm">
                                    <strong>Booth: {booth.booth_number}</strong><br />
                                    Risk: {booth.risk_category}<br />
                                    <button onClick={() => navigate(`/booth-analysis/${booth.booth_id}`)} className="text-blue-500 underline mt-1">
                                        View Analysis
                                    </button>
                                </div>
                            </Popup>
                        </CircleMarker>
                    ))}
                </MapContainer>

                {/* Legend */}
                <div className="absolute bottom-4 left-4 bg-white p-3 rounded shadow-lg z-[1000] text-sm">
                    <h4 className="font-bold mb-2">Risk Legend</h4>
                    <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> High Risk (Deletion)</div>
                    <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> High Opportunity</div>
                    <div className="flex items-center gap-2 mb-1"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Anomaly ({'>'}15/House)</div>
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Normal</div>
                </div>
            </div>
        </div>
    );
};

export default BoothAnalysis;
