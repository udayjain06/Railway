"use client";
import Link from "next/link";

const modules = [
  { href:"/fatigue",     title:"Fatigue Guard",            desc:"Real-time loco pilot eye & head monitoring. Detects drowsiness before accidents.",             stat:"55% accidents = human error",  color:"border-red-400",     badge:"bg-red-50 text-red-700",       icon:"🔴" },
  { href:"/delays",      title:"Delay Radar",              desc:"Predicts cascade delays across the network with live train map.",                              stat:"Live train tracking",          color:"border-amber-400",   badge:"bg-amber-50 text-amber-700",   icon:"🟡" },
  { href:"/occupancy",   title:"Platform Pulse",           desc:"Coach-level occupancy heatmap. Tells passengers which coach has space.",                       stat:"Real-time crowd alerts",       color:"border-emerald-400", badge:"bg-emerald-50 text-emerald-700", icon:"🟢" },
  { href:"/maintenance", title:"Predictive Maintenance",   desc:"AI sensor monitoring across fleet. Predicts component failures before they happen.",           stat:"Powered by Claude AI",         color:"border-purple-400",  badge:"bg-purple-50 text-purple-700",   icon:"🔧" },
  { href:"/incidents",   title:"Incident Command Center",  desc:"Unified emergency board. Auto-generates tickets from Delay Radar & Maintenance alerts.",       stat:"End-to-end incident loop",     color:"border-blue-400",    badge:"bg-blue-50 text-blue-700",       icon:"🚨" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900">RailSaarthi</h1>
          <p className="text-gray-500 mt-1">AI-powered railway operations & safety platform</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-200">FAR AWAY 2026</span>
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">Railways Theme</span>
            <span className="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full font-medium border border-purple-200">Powered by Claude AI</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map(m => (
            <Link key={m.href} href={m.href}
              className={`bg-white rounded-xl border-t-4 ${m.color} border border-gray-100 p-5 hover:shadow-md transition-shadow block`}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xl">{m.icon}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${m.badge}`}>{m.stat}</span>
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1.5">{m.title}</h2>
              <p className="text-xs text-gray-500 leading-relaxed">{m.desc}</p>
              <div className="mt-4 text-xs text-blue-600 font-medium">Open module →</div>
            </Link>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">System status</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            {[
              { label:"Active alerts",       value:"5" },
              { label:"Trains tracked",      value:"142" },
              { label:"Stations monitored",  value:"28" },
              { label:"Incidents open",      value:"3" },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-2xl font-semibold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
