"use client";
import { useEffect, useState } from "react";

interface Sensor {
  id: string; component: string; train: string; coach: string;
  value: number; unit: string; normal: [number, number];
  warning: number; critical: number; trend: "stable" | "rising" | "falling"; lastChecked: string;
}
interface Alert {
  id: string; trainId: string; component: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string; predictedFailureIn: string; action: string; timestamp: string;
}
interface AiAnalysis { summary: string; topRisk: string; recommendation: string; loading: boolean; }

function r(min: number, max: number) { return Math.round((min + Math.random() * (max - min)) * 10) / 10; }

function makeSensors(): Sensor[] {
  return [
    { id:"s1", component:"Wheel Bearing Temp",   train:"12301", coach:"C3", value:r(55,95),  unit:"°C",  normal:[20,65], warning:70, critical:85, trend:"rising",  lastChecked:"2 min ago" },
    { id:"s2", component:"Axle Vibration",        train:"12301", coach:"C3", value:r(1.2,4.5),unit:"g",  normal:[0,2],   warning:2.5,critical:3.8,trend:"rising",  lastChecked:"2 min ago" },
    { id:"s3", component:"Brake Pad Thickness",   train:"12951", coach:"C1", value:r(4,18),   unit:"mm", normal:[12,25], warning:8,  critical:5,  trend:"falling", lastChecked:"5 min ago" },
    { id:"s4", component:"Pantograph Pressure",   train:"12951", coach:"--", value:r(60,100), unit:"kPa",normal:[70,90], warning:65, critical:58, trend:"stable",  lastChecked:"1 min ago" },
    { id:"s5", component:"Engine Oil Pressure",   train:"22691", coach:"--", value:r(28,48),  unit:"psi",normal:[35,45], warning:32, critical:28, trend:"falling", lastChecked:"3 min ago" },
    { id:"s6", component:"Suspension Deflection", train:"12002", coach:"C5", value:r(12,35),  unit:"mm", normal:[10,25], warning:28, critical:35, trend:"stable",  lastChecked:"4 min ago" },
    { id:"s7", component:"Wheel Flange Wear",     train:"13006", coach:"C2", value:r(2,9),    unit:"mm", normal:[0,5],   warning:6,  critical:8,  trend:"rising",  lastChecked:"6 min ago" },
    { id:"s8", component:"AC Compressor Load",    train:"12627", coach:"C4", value:r(40,90),  unit:"%",  normal:[30,75], warning:80, critical:90, trend:"stable",  lastChecked:"1 min ago" },
  ];
}

function getSeverity(s: Sensor): "ok"|"low"|"medium"|"high"|"critical" {
  const v = s.value;
  const isBelow = ["Pressure","Thickness","Oil"].some(k => s.component.includes(k));
  if (isBelow) {
    if (v <= s.critical) return "critical";
    if (v <= s.warning)  return "high";
    if (v < s.normal[0]) return "medium";
  } else {
    if (v >= s.critical) return "critical";
    if (v >= s.warning)  return "high";
    if (v > s.normal[1]) return "medium";
  }
  if (s.trend === "rising" && v > s.normal[1] * 0.85) return "low";
  return "ok";
}

function makeAlerts(sensors: Sensor[]): Alert[] {
  const sevOrder = { critical:0, high:1, medium:2, low:3 };
  const timeMap  = { low:"7-10 days", medium:"3-5 days", high:"24-48 hours", critical:"Immediate" };
  const actMap   = {
    low:      "Schedule inspection at next depot stop",
    medium:   "Inspect at terminus — reduce speed if worsening",
    high:     "Alert maintenance crew — prepare for depot inspection",
    critical: "Stop train at next station — immediate inspection required",
  };
  return sensors
    .map(s => {
      const sev = getSeverity(s);
      if (sev === "ok") return null;
      return {
        id:`a-${s.id}`, trainId:s.train, component:s.component,
        severity: sev as Alert["severity"],
        message:`${s.component} on Train #${s.train}${s.coach!=="--"?` Coach ${s.coach}`:""} reading ${s.value}${s.unit}`,
        predictedFailureIn: timeMap[sev],
        action: actMap[sev],
        timestamp: new Date().toLocaleTimeString(),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => sevOrder[a.severity] - sevOrder[b.severity]) as Alert[];
}

const SEV_BG: Record<string,string> = {
  ok:       "bg-emerald-50 text-emerald-700",
  low:      "bg-blue-50 border-blue-200 text-blue-900",
  medium:   "bg-amber-50 border-amber-200 text-amber-900",
  high:     "bg-orange-50 border-orange-300 text-orange-900",
  critical: "bg-red-50 border-red-400 text-red-900",
};
const SEV_TEXT: Record<string,string> = { ok:"text-emerald-600", low:"text-blue-600", medium:"text-amber-600", high:"text-orange-600", critical:"text-red-600" };
const TREND: Record<string,string> = { rising:"↑ rising", falling:"↓ falling", stable:"→ stable" };
const TREND_COL: Record<string,string> = { rising:"text-red-500", falling:"text-amber-500", stable:"text-gray-400" };

export default function MaintenancePage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [alerts,  setAlerts]  = useState<Alert[]>([]);
  const [tab,     setTab]     = useState<"alerts"|"sensors">("alerts");
  const [lastUpd, setLastUpd] = useState("");
  const [ai,      setAi]      = useState<AiAnalysis>({ summary:"", topRisk:"", recommendation:"", loading:false });
  const [aiDone,  setAiDone]  = useState(false);

  function refresh() {
    const s = makeSensors(); setSensors(s);
    setAlerts(makeAlerts(s));
    setLastUpd(new Date().toLocaleTimeString());
  }

  useEffect(() => { refresh(); const iv = setInterval(refresh, 15000); return () => clearInterval(iv); }, []);

  async function runAI() {
    if (!alerts.length) return;
    setAi(a => ({ ...a, loading:true }));
    const lines = alerts.slice(0,4).map(a => `- Train #${a.trainId}: ${a.component} (${a.severity}) — failure in ${a.predictedFailureIn}`).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          messages:[{ role:"user", content:`You are an Indian Railways predictive maintenance AI. Analyze these sensor alerts:\n${lines}\n\nRespond ONLY in this exact JSON format:\n{"summary":"2 sentence fleet health summary","topRisk":"single most urgent risk","recommendation":"most important immediate action"}` }]
        })
      });
      const data = await res.json();
      const parsed = JSON.parse(data.content[0].text.replace(/```json|```/g,"").trim());
      setAi({ ...parsed, loading:false }); setAiDone(true);
    } catch {
      const crit = alerts.filter(a=>a.severity==="critical").length;
      setAi({
        summary:`Fleet monitoring shows ${alerts.length} active alerts across ${new Set(alerts.map(a=>a.trainId)).size} trains. ${crit} critical issue${crit!==1?"s":""} require immediate attention.`,
        topRisk: alerts[0] ? `${alerts[0].component} on Train #${alerts[0].trainId} — predicted failure: ${alerts[0].predictedFailureIn}.` : "No critical risk.",
        recommendation: alerts[0]?.action ?? "Continue routine monitoring.",
        loading:false,
      });
      setAiDone(true);
    }
  }

  const crit = alerts.filter(a=>a.severity==="critical").length;
  const high = alerts.filter(a=>a.severity==="high").length;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Predictive Maintenance AI</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">Auto-refresh · {lastUpd}</span>
            <button onClick={refresh} className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Refresh now</button>
          </div>
        </div>

        {crit > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-6 flex items-center gap-3 animate-pulse">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-semibold text-red-900">{crit} Critical Alert{crit>1?"s":""} — Immediate Action Required</div>
              <div className="text-sm text-red-700 mt-0.5">{alerts.filter(a=>a.severity==="critical").map(a=>`Train #${a.trainId}: ${a.component}`).join("  ·  ")}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:"Critical",value:crit, color:"text-red-600" },
            { label:"High",    value:high, color:"text-orange-600" },
            { label:"Monitored sensors", value:sensors.length, color:"text-blue-600" },
            { label:"Trains tracked",    value:new Set(sensors.map(s=>s.train)).size, color:"text-gray-700" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className={`text-3xl font-semibold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* AI Panel */}
        <div className="bg-white rounded-xl border border-purple-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">AI Fleet Analysis</span>
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">Powered by Claude</span>
            </div>
            <button onClick={runAI} disabled={ai.loading}
              className="text-sm px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 font-medium">
              {ai.loading ? "Analysing..." : aiDone ? "Re-analyse" : "Run AI Analysis"}
            </button>
          </div>
          {!aiDone && !ai.loading && (
            <div className="text-sm text-gray-400 text-center py-6">Click "Run AI Analysis" to get Claude's fleet health assessment based on current sensor data</div>
          )}
          {ai.loading && (
            <div className="text-sm text-purple-500 text-center py-6 animate-pulse">Analysing {alerts.length} alerts across {new Set(alerts.map(a=>a.trainId)).size} trains...</div>
          )}
          {aiDone && (
            <div className="space-y-3">
              <div className="bg-purple-50 rounded-lg p-3">
                <div className="text-xs text-purple-500 font-medium mb-1 uppercase tracking-wide">Fleet health summary</div>
                <p className="text-sm text-purple-900 leading-relaxed">{ai.summary}</p>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs text-red-500 font-medium mb-1 uppercase tracking-wide">Top risk</div>
                  <p className="text-sm text-red-900 leading-relaxed">{ai.topRisk}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <div className="text-xs text-emerald-600 font-medium mb-1 uppercase tracking-wide">Recommended action</div>
                  <p className="text-sm text-emerald-900 leading-relaxed">{ai.recommendation}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(["alerts","sensors"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t?"bg-gray-900 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {t==="alerts" ? `Active Alerts (${alerts.length})` : `Sensor Readings (${sensors.length})`}
            </button>
          ))}
        </div>

        {tab === "alerts" && (
          <div className="space-y-3">
            {alerts.length === 0
              ? <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-emerald-600 font-medium">✅ All systems normal</div>
              : alerts.map(a => (
                <div key={a.id} className={`rounded-xl border-2 p-4 ${SEV_BG[a.severity]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">Train #{a.trainId} — {a.component}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase border ${SEV_BG[a.severity]}`}>{a.severity}</span>
                      </div>
                      <p className="text-sm opacity-80">{a.message}</p>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="opacity-60 text-xs mb-0.5">Predicted failure in</div>
                          <div className="font-semibold">{a.predictedFailureIn}</div>
                        </div>
                        <div>
                          <div className="opacity-60 text-xs mb-0.5">Action required</div>
                          <div className="font-medium">{a.action}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs opacity-50 flex-shrink-0">{a.timestamp}</div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {tab === "sensors" && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  {["Component","Train · Coach","Reading","Normal range","Trend","Status"].map(h => (
                    <th key={h} className={`p-4 font-medium ${h==="Reading"||h==="Normal range"?"text-right":"text-left"} ${h==="Trend"||h==="Status"?"text-center":""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sensors.map(s => {
                  const sev = getSeverity(s);
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-900">{s.component}</td>
                      <td className="p-4 text-gray-500">#{s.train}{s.coach!=="--"?` · ${s.coach}`:""}</td>
                      <td className={`p-4 text-right font-semibold tabular-nums ${SEV_TEXT[sev]}`}>{s.value} {s.unit}</td>
                      <td className="p-4 text-right text-gray-400">{s.normal[0]}–{s.normal[1]} {s.unit}</td>
                      <td className={`p-4 text-center text-xs font-medium ${TREND_COL[s.trend]}`}>{TREND[s.trend]}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase ${SEV_BG[sev]}`}>{sev}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
