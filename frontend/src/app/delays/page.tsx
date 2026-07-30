"use client";
import { useEffect, useRef, useState } from "react";

interface Train {
  id: string; name: string; from: string; to: string;
  scheduled: string; currentDelay: number; predictedDelay: number;
  status: "on-time" | "delayed" | "critical";
  affectedTrains: string[]; platform: string; lastStation: string;
  lat: number; lng: number;
}

const MOCK_TRAINS: Train[] = [
  { id:"12301", name:"Rajdhani Express",   from:"New Delhi", to:"Howrah",    scheduled:"16:10", currentDelay:45, predictedDelay:72, status:"critical", affectedTrains:["12302","13006"], platform:"P-9", lastStation:"Kanpur",  lat:26.46, lng:80.35 },
  { id:"12951", name:"Mumbai Rajdhani",    from:"Mumbai",    to:"New Delhi", scheduled:"17:00", currentDelay:18, predictedDelay:35, status:"delayed",  affectedTrains:["12952"],          platform:"P-2", lastStation:"Surat",   lat:21.17, lng:72.83 },
  { id:"22691", name:"Bangalore Rajdhani", from:"Bangalore", to:"New Delhi", scheduled:"20:00", currentDelay:0,  predictedDelay:12, status:"on-time",  affectedTrains:[],                 platform:"P-6", lastStation:"Nagpur",  lat:21.14, lng:79.08 },
  { id:"12002", name:"Bhopal Shatabdi",    from:"New Delhi", to:"Bhopal",    scheduled:"06:00", currentDelay:8,  predictedDelay:8,  status:"delayed",  affectedTrains:[],                 platform:"P-4", lastStation:"Agra",    lat:27.18, lng:78.01 },
  { id:"12627", name:"Karnataka Express",  from:"New Delhi", to:"Bangalore", scheduled:"22:30", currentDelay:0,  predictedDelay:0,  status:"on-time",  affectedTrains:[],                 platform:"P-1", lastStation:"On time", lat:23.25, lng:77.40 },
  { id:"13006", name:"Amritsar Mail",      from:"Amritsar",  to:"Howrah",    scheduled:"19:15", currentDelay:0,  predictedDelay:0,  status:"on-time",  affectedTrains:[],                 platform:"P-3", lastStation:"On time", lat:28.90, lng:76.60 },
];

const statusColor: Record<string, string> = {
  critical: "text-red-600", delayed: "text-amber-600", "on-time": "text-emerald-600"
};
const statusBadge: Record<string, string> = {
  critical: "bg-red-50 text-red-700", delayed: "bg-amber-50 text-amber-700", "on-time": "bg-emerald-50 text-emerald-700"
};

export default function DelaysPage() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const leafletRef  = useRef<any>(null);
  const markersRef  = useRef<any[]>([]);
  const [trains,    setTrains]   = useState<Train[]>([]);
  const [selected,  setSelected] = useState<Train | null>(null);
  const [lastUpd,   setLastUpd]  = useState("");
  const [mapReady,  setMapReady] = useState(false);

  async function loadLeaflet(): Promise<void> {
    if ((window as any).L) return;
    await new Promise<void>((res, rej) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const s = document.createElement("script");
      s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      s.onload = () => res(); s.onerror = () => rej();
      document.head.appendChild(s);
    });
  }

  function initMap(data: Train[]) {
    const L = (window as any).L;
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([22.5, 80], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors", maxZoom: 18,
    }).addTo(map);
    leafletRef.current = map;

    // Add train markers
    data.forEach(t => {
      const color = t.status === "critical" ? "#E24B4A" : t.status === "delayed" ? "#EF9F27" : "#1D9E75";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const marker = L.marker([t.lat, t.lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;min-width:180px;">
            <div style="font-weight:500;margin-bottom:4px;">${t.name} #${t.id}</div>
            <div style="color:#666;font-size:12px;">${t.from} → ${t.to}</div>
            <div style="margin-top:6px;padding:4px 8px;border-radius:6px;background:${t.status==="critical"?"#FCEBEB":t.status==="delayed"?"#FAEEDA":"#E1F5EE"};color:${color};font-size:12px;font-weight:500;">
              ${t.predictedDelay === 0 ? "On time" : `+${t.predictedDelay} min delay`}
            </div>
          </div>`);
      markersRef.current.push(marker);
    });
    setMapReady(true);
  }

  async function fetchData() {
    let data = MOCK_TRAINS;
    try {
      const res = await fetch("http://localhost:8000/api/delays");
      const json = await res.json();
      // Merge lat/lng from mock since backend doesn't have it
      data = json.trains.map((t: any) => ({
        ...t,
        lat: MOCK_TRAINS.find(m => m.id === t.id)?.lat ?? 22.5,
        lng: MOCK_TRAINS.find(m => m.id === t.id)?.lng ?? 80,
      }));
    } catch {}
    setTrains(data);
    setLastUpd(new Date().toLocaleTimeString());
    return data;
  }

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    (async () => {
      const data = await fetchData();
      await loadLeaflet();
      // Small delay to ensure mapRef is mounted
      setTimeout(() => initMap(data), 100);
      interval = setInterval(fetchData, 30000);
    })();
    return () => {
      clearInterval(interval);
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }
    };
  }, []);

  const critical = trains.filter(t => t.status === "critical").length;
  const delayed  = trains.filter(t => t.status === "delayed").length;
  const onTime   = trains.filter(t => t.status === "on-time").length;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Delay radar</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Updated {lastUpd}</span>
            <button onClick={fetchData} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Refresh</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Critical delays", value: critical, color: "text-red-600" },
            { label: "Minor delays",    value: delayed,  color: "text-amber-600" },
            { label: "On time",         value: onTime,   color: "text-emerald-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className={`text-3xl font-semibold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Live train positions</span>
            <div className="flex gap-3 text-xs">
              {[["#E24B4A","Critical"],["#EF9F27","Delayed"],["#1D9E75","On time"]].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ background: c }} />
                  <span className="text-gray-500">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div ref={mapRef} style={{ height: "360px", width: "100%" }} />
        </div>

        {/* Train cards */}
        <div className="space-y-3">
          {trains.map(t => (
            <div key={t.id} onClick={() => setSelected(selected?.id === t.id ? null : t)}
              className="bg-white rounded-xl border border-gray-100 p-4 cursor-pointer hover:border-gray-200 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{t.name}</span>
                    <span className="text-xs text-gray-400">#{t.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[t.status]}`}>{t.status}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.from} → {t.to} · {t.scheduled} · {t.platform} · {t.lastStation}</div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-semibold ${statusColor[t.status]}`}>
                    {t.predictedDelay === 0 ? "On time" : `+${t.predictedDelay} min`}
                  </div>
                  <div className="text-xs text-gray-400">predicted</div>
                </div>
              </div>
              {selected?.id === t.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Delay breakdown</div>
                    <div className="text-sm text-gray-500">Current: <span className={`font-medium ${statusColor[t.status]}`}>{t.currentDelay === 0 ? "None" : `+${t.currentDelay} min`}</span></div>
                    <div className="text-sm text-gray-500 mt-1">Cascade total: <span className={`font-medium ${statusColor[t.status]}`}>{t.predictedDelay === 0 ? "None" : `+${t.predictedDelay} min`}</span></div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Trains affected</div>
                    {t.affectedTrains.length === 0
                      ? <div className="text-sm text-gray-400">None</div>
                      : <div className="flex flex-wrap gap-1">{t.affectedTrains.map(id => <span key={id} className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded-full">#{id}</span>)}</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
