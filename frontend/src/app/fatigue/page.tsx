"use client";
import { useEffect, useRef, useState } from "react";

const WINDOW = 20;
const DECAY  = 3;
type Level = "safe" | "warning" | "danger" | "no_face";

interface ChartPoint { t: number; v: number; }
interface Report { timestamp: string; duration: string; maxPerclos: number; avgPerclos: number; headNods: number; recommendation: string; aiSummary: string; }

export default function FatiguePage() {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const chartRef    = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<any>(null);

  const history      = useRef<boolean[]>([]);
  const openStreak   = useRef(0);
  const noFaceCnt    = useRef(0);
  const wasNoFace    = useRef(false);
  const fpsBuf       = useRef<number[]>([]);
  const chartData    = useRef<ChartPoint[]>([]);
  const sessionStart = useRef<number>(0);
  const headNodCount = useRef(0);
  const maxPerclos   = useRef(0);
  const perclosSum   = useRef(0);
  const frameTotal   = useRef(0);

  const [on,          setOn]          = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [mlReady,     setMlReady]     = useState(false);
  const [perclos,     setPerclos]     = useState(0);
  const [level,       setLevel]       = useState<Level>("safe");
  const [msg,         setMsg]         = useState("Initialising face detection...");
  const [noFace,      setNoFace]      = useState(false);
  const [fps,         setFps]         = useState(0);
  const [report,      setReport]      = useState<Report | null>(null);
  const [genLoading,  setGenLoading]  = useState(false);
  const [showReport,  setShowReport]  = useState(false);

  // ── Load MediaPipe from CDN ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadML() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js");
        const FaceMesh = (window as any).FaceMesh;
        if (!FaceMesh) throw new Error("no FaceMesh");
        const fm = new FaceMesh({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
        fm.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        fm.onResults((r: any) => {
          if (cancelled) return;
          if (!r.multiFaceLandmarks?.length) { handleNoFace(); return; }
          const lm  = r.multiFaceLandmarks[0];
          const ear = (calcEAR(lm,[362,385,387,263,373,380]) + calcEAR(lm,[33,160,158,133,153,144])) / 2;
          handleFaceDetected(ear < 0.22, false);
        });
        await fm.initialize();
        if (!cancelled) { detectorRef.current = fm; setMlReady(true); setMsg("Ready — press Start"); }
      } catch {
        if (!cancelled) { detectorRef.current = null; setMlReady(true); setMsg("Ready (simulation) — press Start"); }
      }
    }
    loadML();
    return () => { cancelled = true; };
  }, []);

  function loadScript(src: string): Promise<void> {
    return new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement("script");
      s.src = src; s.crossOrigin = "anonymous";
      s.onload = () => res(); s.onerror = () => rej();
      document.head.appendChild(s);
    });
  }

  function calcEAR(lm: any[], idx: number[]): number {
    const d = (a: any, b: any) => Math.sqrt((lm[a].x-lm[b].x)**2+(lm[a].y-lm[b].y)**2);
    return (d(idx[1],idx[5]) + d(idx[2],idx[4])) / (2 * d(idx[0],idx[3]));
  }

  function hardReset() {
    history.current = []; openStreak.current = 0; noFaceCnt.current = 0;
    wasNoFace.current = false; fpsBuf.current = []; chartData.current = [];
    headNodCount.current = 0; maxPerclos.current = 0;
    perclosSum.current = 0; frameTotal.current = 0;
    setPerclos(0); setLevel("safe"); setMsg("Press Start to begin");
    setNoFace(false); setFps(0); setReport(null); setShowReport(false);
  }

  function pushFrame(closed: boolean) {
    if (closed) { openStreak.current = 0; history.current.push(true); }
    else {
      openStreak.current++; history.current.push(false);
      if (openStreak.current >= DECAY) {
        const i = history.current.indexOf(true);
        if (i !== -1) history.current.splice(i, 1);
      }
    }
    while (history.current.length > WINDOW) history.current.shift();
  }

  function getPerclos() {
    if (!history.current.length) return 0;
    return Math.round(history.current.filter(Boolean).length / history.current.length * 100);
  }

  // ── Draw PERCLOS chart ────────────────────────────────────────────────────
  function drawChart(currentPerclos: number) {
    const now = Date.now();
    chartData.current.push({ t: now, v: currentPerclos });
    // Keep last 60 seconds
    const cutoff = now - 60000;
    chartData.current = chartData.current.filter(p => p.t > cutoff);

    const canvas = chartRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(128,128,128,0.15)";
    ctx.lineWidth = 1;
    [15, 30].forEach(y => {
      const py = H - (y / 100) * H;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(W, py); ctx.stroke();
      ctx.fillStyle = "rgba(128,128,128,0.5)";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${y}%`, 4, py - 3);
    });

    if (chartData.current.length < 2) return;
    const tMin = chartData.current[0].t;
    const tMax = now;
    const tRange = Math.max(tMax - tMin, 1);

    // Fill area
    ctx.beginPath();
    chartData.current.forEach((p, i) => {
      const x = ((p.t - tMin) / tRange) * W;
      const y = H - (p.v / 100) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, currentPerclos > 30 ? "rgba(226,75,74,0.3)" : currentPerclos > 15 ? "rgba(239,159,39,0.3)" : "rgba(29,158,117,0.3)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.fill();

    // Line
    ctx.beginPath();
    chartData.current.forEach((p, i) => {
      const x = ((p.t - tMin) / tRange) * W;
      const y = H - (p.v / 100) * H;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = currentPerclos > 30 ? "#E24B4A" : currentPerclos > 15 ? "#EF9F27" : "#1D9E75";
    ctx.lineWidth = 2; ctx.stroke();
  }

  async function start() {
    hardReset(); setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      sessionStart.current = Date.now();
      setOn(true); runLoop();
    } catch { alert("Camera access denied."); }
    setLoading(false);
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; timerRef.current = null;
    setOn(false); hardReset(); setMsg("Camera stopped");
  }

  function runLoop() {
    timerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const now = Date.now();
      fpsBuf.current.push(now);
      fpsBuf.current = fpsBuf.current.filter(t => now - t < 5000);
      setFps(Math.round(fpsBuf.current.length / 5));
      if (detectorRef.current) {
        await detectorRef.current.send({ image: video });
      } else {
        const n = history.current.length;
        handleFaceDetected(n > 40 && Math.random() < 0.30, true);
      }
    }, 500);
  }

  function handleNoFace() {
    noFaceCnt.current++;
    wasNoFace.current = true;
    if (noFaceCnt.current >= 2) {
      history.current = []; openStreak.current = 0;
      setPerclos(0); setLevel("no_face");
      setMsg("👤 No face detected — monitoring paused");
      setNoFace(true);
    }
  }

  function handleFaceDetected(isClosed: boolean, demo: boolean) {
    if (wasNoFace.current) { history.current = []; openStreak.current = 0; wasNoFace.current = false; }
    noFaceCnt.current = 0; setNoFace(false);
    pushFrame(isClosed);
    const p = getPerclos();
    // Track stats for report
    frameTotal.current++;
    perclosSum.current += p;
    if (p > maxPerclos.current) maxPerclos.current = p;
    setPerclos(p);
    drawChart(p);
    const d = demo ? " (demo)" : "";
    if (p > 30) { setLevel("danger"); setMsg(`🚨 Critical fatigue — eyes closed >30%${d}`); beep(880); }
    else if (p > 15) { setLevel("warning"); setMsg(`⚠️ Drowsiness detected${d}`); beep(440); }
    else { setLevel("safe"); setMsg(`✅ All clear — monitoring active${d}`); }
  }

  // ── Generate AI Report ────────────────────────────────────────────────────
  async function generateReport() {
    setGenLoading(true);
    const sessionSec = Math.round((Date.now() - sessionStart.current) / 1000);
    const mm = Math.floor(sessionSec / 60), ss = sessionSec % 60;
    const avgP = frameTotal.current > 0 ? Math.round(perclosSum.current / frameTotal.current) : 0;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a railway safety AI system. Generate a concise fatigue incident report based on these metrics:
- Session duration: ${mm}m ${ss}s
- Max PERCLOS score: ${maxPerclos.current}%
- Average PERCLOS score: ${avgP}%
- Head nod events: ${headNodCount.current}
- Alert level reached: ${level}

Write a professional 3-sentence safety report including: what was detected, severity assessment, and recommended action. Be direct and factual. Do not use markdown.`
          }]
        })
      });
      const data = await res.json();
      const aiText = data.content?.[0]?.text || "Report generation failed — please try again.";
      setReport({
        timestamp: new Date().toLocaleString(),
        duration: `${mm}m ${ss}s`,
        maxPerclos: maxPerclos.current,
        avgPerclos: avgP,
        headNods: headNodCount.current,
        recommendation: maxPerclos.current > 30 ? "Immediate rest required" : maxPerclos.current > 15 ? "Break recommended" : "Continue with monitoring",
        aiSummary: aiText,
      });
      setShowReport(true);
    } catch {
      setReport({
        timestamp: new Date().toLocaleString(),
        duration: `${mm}m ${ss}s`,
        maxPerclos: maxPerclos.current,
        avgPerclos: avgP,
        headNods: headNodCount.current,
        recommendation: maxPerclos.current > 30 ? "Immediate rest required" : "Continue monitoring",
        aiSummary: `Fatigue monitoring session completed. Peak PERCLOS of ${maxPerclos.current}% detected over ${mm}m ${ss}s. ${maxPerclos.current > 30 ? "Critical fatigue levels reached — immediate intervention recommended." : "Fatigue levels within acceptable range."}`,
      });
      setShowReport(true);
    }
    setGenLoading(false);
  }

  function beep(freq: number) {
    try {
      const a = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.1, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.25);
      o.start(); o.stop(a.currentTime + 0.25);
    } catch {}
  }

  useEffect(() => () => { stop(); }, []);

  const banner = {
    safe:    "bg-emerald-50 border-emerald-300 text-emerald-800",
    warning: "bg-amber-50 border-amber-400 text-amber-900 animate-pulse",
    danger:  "bg-red-50 border-red-500 text-red-900 animate-pulse",
    no_face: "bg-gray-100 border-gray-300 text-gray-500",
  }[level];
  const bar = perclos > 30 ? "bg-red-500" : perclos > 15 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <a href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</a>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">Fatigue guard</h1>
          {mlReady && (
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">
              {detectorRef.current ? "MediaPipe ready" : "Simulation mode"}
            </span>
          )}
        </div>

        <div className={`rounded-xl border-2 p-4 mb-6 text-center text-lg font-medium transition-all duration-300 ${banner}`}>
          {msg}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Camera */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="relative aspect-video bg-gray-900">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {!on && <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">{mlReady ? "Camera off" : "Loading ML model..."}</div>}
              {on && noFace && <div className="absolute inset-0 flex items-center justify-center bg-black/50"><span className="text-white text-sm">No face in frame</span></div>}
              {on && <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">{fps} fps</div>}
            </div>
            <div className="p-4 flex gap-2">
              <button onClick={on ? stop : start} disabled={loading || !mlReady}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${on ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200" : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"}`}>
                {loading ? "Starting..." : !mlReady ? "Loading..." : on ? "⏹ Stop" : "▶ Start monitoring"}
              </button>
              {on && (
                <button onClick={generateReport} disabled={genLoading}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 disabled:opacity-50">
                  {genLoading ? "Generating..." : "Generate Report"}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">PERCLOS</div>
              <div className="text-5xl font-semibold text-gray-900 mb-3 tabular-nums">{noFace ? "—" : `${perclos}%`}</div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className={`h-3 rounded-full transition-all duration-300 ${bar}`} style={{ width: noFace ? "0%" : `${Math.min(perclos,100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>0% safe</span><span>15% warning</span><span>30% danger</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Session max", value: `${maxPerclos.current}%` },
                { label: "Face", value: noFace ? "Away" : "Present" },
                { label: "Status", value: level },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-base font-semibold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PERCLOS Chart */}
        {on && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
            <div className="text-sm font-medium text-gray-700 mb-3">PERCLOS — last 60 seconds</div>
            <canvas ref={chartRef} width={900} height={120} className="w-full" />
          </div>
        )}

        {/* AI Report */}
        {showReport && report && (
          <div className="bg-white rounded-xl border border-purple-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-semibold text-gray-900">AI Incident Report</div>
                <div className="text-xs text-gray-400 mt-0.5">{report.timestamp}</div>
              </div>
              <button onClick={() => setShowReport(false)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Close</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "Duration",     value: report.duration },
                { label: "Max PERCLOS",  value: `${report.maxPerclos}%` },
                { label: "Avg PERCLOS",  value: `${report.avgPerclos}%` },
                { label: "Head nods",    value: String(report.headNods) },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-semibold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>
            <div className={`rounded-lg p-3 mb-4 text-sm font-medium ${report.maxPerclos > 30 ? "bg-red-50 text-red-700" : report.maxPerclos > 15 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
              Recommendation: {report.recommendation}
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-xs text-purple-500 font-medium mb-1 uppercase tracking-wide">AI Analysis</div>
              <p className="text-sm text-purple-900 leading-relaxed">{report.aiSummary}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
