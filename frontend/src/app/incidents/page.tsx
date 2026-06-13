"use client";
import { useEffect, useRef, useState } from "react";

type Severity = "critical" | "high" | "medium" | "low";
type Status   = "open" | "assigned" | "in-progress" | "resolved";

interface Incident {
  id: string;
  title: string;
  source: "Delay Radar" | "Predictive Maintenance" | "Fatigue Guard" | "Manual";
  trainId: string;
  location: string;
  severity: Severity;
  status: Status;
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  timeline: { time: Date; action: string; by: string }[];
  aiSummary?: string;
}

const TEAMS = [
  "Delhi Control Room", "Mumbai Maintenance Crew", "Howrah Safety Team",
  "Bhopal Operations", "Bangalore Rapid Response", "Chennai Track Unit",
];

function makeId() { return "INC-" + Math.random().toString(36).slice(2,7).toUpperCase(); }
function ago(d: Date) {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

const SEV_BG: Record<Severity, string> = {
  critical: "bg-red-50 border-red-400 text-red-900",
  high:     "bg-orange-50 border-orange-300 text-orange-900",
  medium:   "bg-amber-50 border-amber-200 text-amber-900",
  low:      "bg-blue-50 border-blue-200 text-blue-900",
};
const SEV_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-blue-100 text-blue-700",
};
const STATUS_BADGE: Record<Status, string> = {
  open:        "bg-gray-100 text-gray-700",
  assigned:    "bg-purple-100 text-purple-700",
  "in-progress": "bg-blue-100 text-blue-700",
  resolved:    "bg-emerald-100 text-emerald-700",
};
const STATUS_NEXT: Record<Status, Status> = {
  open: "assigned", assigned: "in-progress", "in-progress": "resolved", resolved: "resolved",
};
const STATUS_ACTION: Record<Status, string> = {
  open: "Assign Team", assigned: "Start Work", "in-progress": "Mark Resolved", resolved: "Resolved ✓",
};

const SEED_INCIDENTS: Omit<Incident, "id" | "createdAt" | "updatedAt" | "timeline">[] = [
  {
    title: "Cascade delay — 72 min predicted",
    source: "Delay Radar", trainId: "12301", location: "Kanpur Junction",
    severity: "critical", status: "assigned",
    assignedTo: "Delhi Control Room",
    aiSummary: "Rajdhani Express 12301 running 45 minutes late at Kanpur. Cascade model predicts 72-minute total delay affecting trains 12302 and 13006. Platform reallocation at Howrah recommended.",
  },
  {
    title: "Wheel bearing temp critical — 89°C",
    source: "Predictive Maintenance", trainId: "12301", location: "Kanpur Loco Shed",
    severity: "critical", status: "open",
    assignedTo: "",
    aiSummary: "Wheel bearing on Coach C3 of train 12301 reading 89°C — exceeds critical threshold of 85°C. Immediate inspection required. Predicted bearing failure within 200km if unaddressed.",
  },
  {
    title: "Loco pilot fatigue warning",
    source: "Fatigue Guard", trainId: "12951", location: "Surat",
    severity: "high", status: "in-progress",
    assignedTo: "Mumbai Maintenance Crew",
    aiSummary: "PERCLOS score reached 28% for loco pilot on Mumbai Rajdhani. Fatigue Guard flagged drowsiness at 17:42. Relief crew dispatch initiated from Surat depot.",
  },
  {
    title: "Brake pad thickness below warning",
    source: "Predictive Maintenance", trainId: "12951", location: "Surat Yard",
    severity: "high", status: "assigned",
    assignedTo: "Mumbai Maintenance Crew",
    aiSummary: "Coach C1 brake pad reading 7mm — below 8mm warning threshold. Replacement scheduled at Mumbai terminus. Speed restriction of 100 km/h recommended until serviced.",
  },
  {
    title: "Minor delay cascade — 35 min",
    source: "Delay Radar", trainId: "12951", location: "Surat",
    severity: "medium", status: "resolved",
    assignedTo: "Bhopal Operations",
    resolvedAt: new Date(Date.now() - 1800000),
    aiSummary: "Mumbai Rajdhani delay cascade resolved. Train recovered 12 minutes between Surat and Vadodara. Predicted total delay revised down to 23 minutes.",
  },
];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selected,  setSelected]  = useState<Incident | null>(null);
  const [filter,    setFilter]    = useState<Status | "all">("all");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [showNew,   setShowNew]   = useState(false);
  const newTitleRef = useRef<HTMLInputElement>(null);
  const tickerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const seeded = SEED_INCIDENTS.map((inc, i) => ({
      ...inc,
      id: makeId(),
      createdAt: new Date(now - (i + 1) * 420000),
      updatedAt: new Date(now - i * 120000),
      timeline: [
        { time: new Date(now - (i+1)*420000), action: `Incident detected by ${inc.source}`, by: "System" },
        ...(inc.status !== "open" ? [{ time: new Date(now - i*300000), action: `Assigned to ${inc.assignedTo}`, by: "Control Room" }] : []),
        ...(inc.status === "in-progress" ? [{ time: new Date(now - i*120000), action: "Team on site — investigation started", by: inc.assignedTo }] : []),
        ...(inc.status === "resolved" ? [
          { time: new Date(now - i*300000), action: `Assigned to ${inc.assignedTo}`, by: "Control Room" },
          { time: inc.resolvedAt!, action: "Issue resolved — train cleared for operation", by: inc.assignedTo }
        ] : []),
      ],
    })) as Incident[];
    setIncidents(seeded);

    // Simulate live new incident after 20s
    tickerRef.current = setInterval(() => {
      setIncidents(prev => {
        if (prev.length >= 8) { clearInterval(tickerRef.current!); return prev; }
        const newInc: Incident = {
          id: makeId(),
          title: "Engine oil pressure dropping — 31 psi",
          source: "Predictive Maintenance",
          trainId: "22691",
          location: "Nagpur",
          severity: "medium",
          status: "open",
          assignedTo: "",
          createdAt: new Date(),
          updatedAt: new Date(),
          timeline: [{ time: new Date(), action: "Incident detected by Predictive Maintenance", by: "System" }],
        };
        return [newInc, ...prev];
      });
      clearInterval(tickerRef.current!);
    }, 20000);

    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, []);

  function advance(inc: Incident) {
    if (inc.status === "resolved") return;
    const next = STATUS_NEXT[inc.status];
    const team = inc.assignedTo || TEAMS[Math.floor(Math.random() * TEAMS.length)];
    const actionMap: Record<Status, string> = {
      assigned:      `Assigned to ${team}`,
      "in-progress": `${team} started work`,
      resolved:      `Resolved by ${team}`,
      open:          "",
    };
    setIncidents(prev => prev.map(i => {
      if (i.id !== inc.id) return i;
      return {
        ...i, status: next, assignedTo: team, updatedAt: new Date(),
        resolvedAt: next === "resolved" ? new Date() : i.resolvedAt,
        timeline: [...i.timeline, { time: new Date(), action: actionMap[next], by: next === "assigned" ? "Control Room" : team }],
      };
    }));
    setSelected(prev => prev?.id === inc.id ? { ...prev, status: next, assignedTo: team, updatedAt: new Date(),
      timeline: [...prev.timeline, { time: new Date(), action: actionMap[next], by: next === "assigned" ? "Control Room" : team }] } : prev);
  }

  async function generateAI(inc: Incident) {
    if (inc.aiSummary || aiLoading) return;
    setAiLoading(inc.id);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 300,
          messages: [{ role: "user", content: `Railway incident: "${inc.title}" on Train #${inc.trainId} at ${inc.location}. Source: ${inc.source}. Severity: ${inc.severity}. Write a 2-sentence operational summary for the control room. Be factual and direct. No markdown.` }]
        })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text ?? "";
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, aiSummary: text } : i));
      setSelected(prev => prev?.id === inc.id ? { ...prev, aiSummary: text } : prev);
    } catch {
      const fallback = `${inc.source} flagged ${inc.title.toLowerCase()} on Train #${inc.trainId} at ${inc.location}. Severity assessed as ${inc.severity} — immediate ${inc.severity === "critical" ? "action required" : "monitoring recommended"}.`;
      setIncidents(prev => prev.map(i => i.id === inc.id ? { ...i, aiSummary: fallback } : i));
      setSelected(prev => prev?.id === inc.id ? { ...prev, aiSummary: fallback } : prev);
    }
    setAiLoading(null);
  }

  function createManual() {
    const title = newTitleRef.current?.value.trim();
    if (!title) return;
    const inc: Incident = {
      id: makeId(), title, source: "Manual", trainId: "----", location: "Control Room",
      severity: "medium", status: "open", assignedTo: "",
      createdAt: new Date(), updatedAt: new Date(),
      timeline: [{ time: new Date(), action: "Manual incident raised by Control Room", by: "Operator" }],
    };
    setIncidents(prev => [inc, ...prev]);
    setShowNew(false);
    if (newTitleRef.current) newTitleRef.current.value = "";
  }

  const filtered   = filter === "all" ? incidents : incidents.filter(i => i.status === filter);
  const openCount  = incidents.filter(i => i.status === "open").length;
  const critCount  = incidents.filter(i => i.severity === "critical" && i.status !== "resolved").length;
  const resolvedCount = incidents.filter(i => i.status === "resolved").length;
  const avgResolveMins = (() => {
    const resolved = incidents.filter(i => i.resolvedAt);
    if (!resolved.length) return null;
    const avg = resolved.reduce((s, i) => s + (i.resolvedAt!.getTime() - i.createdAt.getTime()), 0) / resolved.length;
    return Math.round(avg / 60000);
  })();

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
            <span className="text-gray-300">/</span>
            <h1 className="text-xl font-semibold text-gray-900">Incident Command Center</h1>
          </div>
          <button onClick={() => setShowNew(true)}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800 font-medium">
            + Raise Incident
          </button>
        </div>

        {critCount > 0 && (
          <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 mb-6 flex items-center gap-3 animate-pulse">
            <span className="text-2xl">🚨</span>
            <div>
              <div className="font-semibold text-red-900">{critCount} Critical Incident{critCount>1?"s":""} — Unresolved</div>
              <div className="text-sm text-red-700 mt-0.5">{incidents.filter(i=>i.severity==="critical"&&i.status!=="resolved").map(i=>`#${i.trainId}: ${i.title}`).join("  ·  ")}</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label:"Open",           value: openCount,       color:"text-red-600" },
            { label:"In progress",    value: incidents.filter(i=>i.status==="in-progress").length, color:"text-blue-600" },
            { label:"Resolved today", value: resolvedCount,   color:"text-emerald-600" },
            { label:"Avg resolve time", value: avgResolveMins ? `${avgResolveMins}m` : "—", color:"text-gray-700" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
              <div className={`text-3xl font-semibold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(["all","open","assigned","in-progress","resolved"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter===f ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {f === "all" ? `All (${incidents.length})` : `${f} (${incidents.filter(i=>i.status===f).length})`}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Incident list */}
          <div className="space-y-3">
            {filtered.map(inc => (
              <div key={inc.id} onClick={() => { setSelected(inc); generateAI(inc); }}
                className={`rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm ${selected?.id===inc.id ? "ring-2 ring-blue-400" : ""} ${SEV_BG[inc.severity]}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${SEV_BADGE[inc.severity]}`}>{inc.severity}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[inc.status]}`}>{inc.status}</span>
                    <span className="text-xs opacity-50">{inc.id}</span>
                  </div>
                  <span className="text-xs opacity-40 flex-shrink-0">{ago(inc.createdAt)}</span>
                </div>
                <div className="font-medium text-sm mb-1">{inc.title}</div>
                <div className="text-xs opacity-70">Train #{inc.trainId} · {inc.location} · via {inc.source}</div>
                {inc.status !== "resolved" && (
                  <button onClick={e => { e.stopPropagation(); advance(inc); }}
                    className="mt-3 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-current/20 transition-colors">
                    {STATUS_ACTION[inc.status]}
                  </button>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">No incidents</div>
            )}
          </div>

          {/* Detail panel */}
          <div>
            {selected ? (
              <div className="bg-white rounded-xl border border-gray-100 p-5 sticky top-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-semibold text-gray-900">{selected.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{selected.id} · Train #{selected.trainId} · {selected.location}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500">✕</button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label:"Source",   value: selected.source },
                    { label:"Severity", value: selected.severity },
                    { label:"Status",   value: selected.status },
                    { label:"Assigned", value: selected.assignedTo || "Unassigned" },
                  ].map(r => (
                    <div key={r.label} className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-0.5">{r.label}</div>
                      <div className="text-sm font-medium text-gray-900">{r.value}</div>
                    </div>
                  ))}
                </div>

                {/* AI Summary */}
                <div className="bg-purple-50 rounded-lg p-3 mb-4">
                  <div className="text-xs text-purple-500 font-medium mb-1 uppercase tracking-wide">AI Summary</div>
                  {aiLoading === selected.id
                    ? <div className="text-sm text-purple-400 animate-pulse">Generating analysis...</div>
                    : <p className="text-sm text-purple-900 leading-relaxed">{selected.aiSummary || "Click incident to generate AI summary"}</p>
                  }
                </div>

                {/* Timeline */}
                <div>
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">Timeline</div>
                  <div className="space-y-3">
                    {selected.timeline.map((t, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className={`w-2 h-2 rounded-full mt-1 ${i===0?"bg-blue-500":"bg-gray-300"}`} />
                        </div>
                        <div>
                          <div className="text-gray-700">{t.action}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{ago(t.time)} · {t.by}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selected.status !== "resolved" && (
                  <button onClick={() => advance(selected)}
                    className="w-full mt-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
                    {STATUS_ACTION[selected.status]}
                  </button>
                )}
                {selected.status === "resolved" && (
                  <div className="mt-4 bg-emerald-50 rounded-lg p-3 text-center text-sm text-emerald-700 font-medium">
                    ✅ Resolved {selected.resolvedAt ? ago(selected.resolvedAt) : ""}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
                Click an incident to see details & timeline
              </div>
            )}
          </div>
        </div>

        {/* New incident modal */}
        {showNew && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
              <div className="font-semibold text-gray-900 mb-4">Raise Manual Incident</div>
              <input ref={newTitleRef} placeholder="Describe the incident..." autoFocus
                className="w-full border border-gray-200 rounded-lg p-3 text-sm outline-none focus:border-blue-400 mb-4" />
              <div className="flex gap-3">
                <button onClick={createManual} className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">Create Incident</button>
                <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
