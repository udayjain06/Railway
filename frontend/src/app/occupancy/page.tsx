"use client";
import { useEffect, useState } from "react";

interface Coach {
  id: string;
  type: string;
  capacity: number;
  occupied: number;
  status: "low" | "medium" | "high" | "overcrowded";
}

interface Platform {
  id: string;
  station: string;
  train: string;
  trainNo: string;
  arrivesIn: number; // minutes
  coaches: Coach[];
}

function makeCoaches(): Coach[] {
  const types = ["SL", "SL", "SL", "3A", "3A", "2A", "1A", "GEN", "GEN"];
  return types.map((type, i) => {
    const capacity = type === "GEN" ? 100 : type === "SL" ? 72 : type === "3A" ? 64 : type === "2A" ? 46 : 24;
    const occupied = Math.floor(capacity * (0.3 + Math.random() * 0.85));
    const pct = occupied / capacity;
    const status: Coach["status"] = pct > 0.95 ? "overcrowded" : pct > 0.75 ? "high" : pct > 0.4 ? "medium" : "low";
    return { id: `C${i + 1}`, type, capacity, occupied, status };
  });
}

const MOCK_PLATFORMS: Platform[] = [
  { id: "P1", station: "New Delhi", train: "Rajdhani Express", trainNo: "12301", arrivesIn: 8, coaches: makeCoaches() },
  { id: "P4", station: "New Delhi", train: "Bhopal Shatabdi", trainNo: "12002", arrivesIn: 22, coaches: makeCoaches() },
  { id: "P9", station: "New Delhi", train: "Mumbai Mail", trainNo: "12137", arrivesIn: 35, coaches: makeCoaches() },
];

const statusColors: Record<Coach["status"], string> = {
  low: "bg-emerald-400",
  medium: "bg-amber-300",
  high: "bg-orange-400",
  overcrowded: "bg-red-500",
};

const statusLabels: Record<Coach["status"], string> = {
  low: "Plenty of space",
  medium: "Moderate",
  high: "Filling up",
  overcrowded: "Overcrowded",
};

export default function OccupancyPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selected, setSelected] = useState<string>("P1");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("http://localhost:8000/api/occupancy");
        const data = await res.json();
        setPlatforms(data.platforms);
      } catch {
        setPlatforms(MOCK_PLATFORMS);
      }
    }
    load();
    const interval = setInterval(() => {
      setPlatforms(MOCK_PLATFORMS.map((p) => ({ ...p, coaches: makeCoaches(), arrivesIn: Math.max(0, p.arrivesIn - 1) })));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const platform = platforms.find((p) => p.id === selected);
  const bestCoach = platform?.coaches.reduce((best, c) =>
    (c.capacity - c.occupied) > (best.capacity - best.occupied) ? c : best,
    platform.coaches[0]
  );

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Platform pulse</h1>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          {platforms.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border ${
                selected === p.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {p.id} — {p.train}
            </button>
          ))}
        </div>

        {platform && (
          <>
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{platform.train} #{platform.trainNo}</div>
                  <div className="text-sm text-gray-400 mt-0.5">{platform.station} · {platform.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold text-blue-600">{platform.arrivesIn} min</div>
                  <div className="text-xs text-gray-400">until arrival</div>
                </div>
              </div>

              {bestCoach && (
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="text-emerald-700 font-medium text-sm">
                    Recommended: Coach {bestCoach.id} ({bestCoach.type})
                  </div>
                  <div className="text-emerald-600 text-sm">
                    {bestCoach.capacity - bestCoach.occupied} seats free
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
              <div className="text-sm font-medium text-gray-700 mb-4">Coach occupancy heatmap</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {platform.coaches.map((coach) => {
                  const pct = Math.round((coach.occupied / coach.capacity) * 100);
                  return (
                    <div key={coach.id} className="flex-shrink-0 w-16 text-center">
                      <div className={`${statusColors[coach.status]} rounded-lg h-20 flex flex-col items-center justify-center transition-all`}>
                        <div className="text-white text-xs font-semibold">{coach.id}</div>
                        <div className="text-white text-xs">{pct}%</div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{coach.type}</div>
                      <div className="text-xs text-gray-300">{coach.occupied}/{coach.capacity}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-sm font-medium text-gray-700 mb-3">Coach details</div>
              <div className="space-y-2">
                {platform.coaches.map((c) => {
                  const pct = Math.round((c.occupied / c.capacity) * 100);
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 w-6">{c.id}</span>
                      <span className="text-xs text-gray-500 w-8">{c.type}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${statusColors[c.status]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium w-16 text-right ${
                        c.status === "overcrowded" ? "text-red-600" : c.status === "high" ? "text-orange-500" : c.status === "medium" ? "text-amber-600" : "text-emerald-600"
                      }`}>
                        {statusLabels[c.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-4 text-xs text-gray-400">
              {(["low", "medium", "high", "overcrowded"] as Coach["status"][]).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${statusColors[s]}`} />
                  {statusLabels[s]}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
