from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time, random, os, httpx

try:
    from dotenv import load_dotenv
    load_dotenv()
except:
    pass

try:
    import google.generativeai as genai
    GEMINI_KEY = os.getenv("GEMINI_API_KEY")
    if GEMINI_KEY:
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel("gemini-2.5-flash")
        GEMINI_AVAILABLE = True
        print("Gemini ready")
    else:
        GEMINI_AVAILABLE = False
except:
    GEMINI_AVAILABLE = False

RAIL_API_KEY = os.getenv("RAIL_API_KEY", "")

app = FastAPI(title="RailSaarthi API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class FrameInput(BaseModel):
    frame: str

class ChatRequest(BaseModel):
    question: str

# ── Fatigue ───────────────────────────────────────────────────────────────────
@app.post("/api/fatigue")
async def detect_fatigue(body: FrameInput):
    if body.frame == "NO_FACE":
        return {"is_closed": False, "no_face": True}
    return {"is_closed": random.random() < 0.08, "no_face": False}

# ── Delays — tries real API first, falls back to mock ─────────────────────────
TRAIN_NUMBERS = ["12301", "12951", "22691", "12002", "12627", "13006"]

STATION_COORDS = {
    "NDLS":[28.64,77.22],"HWH":[22.58,88.34],"MMCT":[18.94,72.83],
    "SBC":[12.97,77.59],"CNB":[26.45,80.35],"BPL":[23.26,77.41],
    "AGC":[27.18,78.01],"NGP":[21.14,79.08],"ST":[21.17,72.83],
    "LKO":[26.85,80.95],"ASR":[31.63,74.87],"GKP":[26.75,83.37],
}

MOCK_TRAINS = [
    {"id":"12301","name":"Howrah Rajdhani",    "from":"New Delhi","to":"Howrah",    "scheduled":"16:10","currentDelay":45,"predictedDelay":72,"status":"critical","affectedTrains":["13006"],"platform":"P-9","lastStation":"Kanpur", "lat":26.46,"lng":80.35},
    {"id":"12951","name":"Mumbai Rajdhani",    "from":"Mumbai",   "to":"New Delhi", "scheduled":"17:00","currentDelay":18,"predictedDelay":35,"status":"delayed", "affectedTrains":[],       "platform":"P-2","lastStation":"Surat",  "lat":21.17,"lng":72.83},
    {"id":"22691","name":"Bangalore Rajdhani", "from":"Bangalore","to":"New Delhi", "scheduled":"20:00","currentDelay":0, "predictedDelay":12,"status":"on-time", "affectedTrains":[],       "platform":"P-6","lastStation":"Nagpur", "lat":21.14,"lng":79.08},
    {"id":"12002","name":"Bhopal Shatabdi",    "from":"New Delhi","to":"Bhopal",    "scheduled":"06:00","currentDelay":8, "predictedDelay":8, "status":"delayed", "affectedTrains":[],       "platform":"P-4","lastStation":"Agra",   "lat":27.18,"lng":78.01},
    {"id":"12627","name":"Karnataka Express",  "from":"New Delhi","to":"Bangalore", "scheduled":"22:30","currentDelay":0, "predictedDelay":0, "status":"on-time", "affectedTrains":[],       "platform":"P-1","lastStation":"On time","lat":23.25,"lng":77.40},
    {"id":"13006","name":"Amritsar Mail",      "from":"Amritsar", "to":"Howrah",    "scheduled":"19:15","currentDelay":0, "predictedDelay":0, "status":"on-time", "affectedTrains":[],       "platform":"P-3","lastStation":"On time","lat":28.90,"lng":76.60},
]

def parse_delay(s: str) -> int:
    if not s or s in ["-","00 M","0 M"]: return 0
    import re
    h = re.search(r"(\d+)\s*H", s, re.I)
    m = re.search(r"(\d+)\s*M", s, re.I)
    return (int(h.group(1))*60 if h else 0) + (int(m.group(1)) if m else 0)

async def fetch_real_train(train_no: str) -> dict | None:
    if not RAIL_API_KEY:
        return None
    try:
        today = time.strftime("%Y%m%d")
        url = f"https://indianrailapi.com/api/v2/livetrainstatus/apikey/{RAIL_API_KEY}/trainnumber/{train_no}/date/{today}/"
        async with httpx.AsyncClient(timeout=8) as client:
            res = await client.get(url)
            data = res.json()
        if data.get("ResponseCode") != "200":
            return None
        current = data.get("CurrentStation", {})
        delay = parse_delay(current.get("DelayInDeparture", "0 M"))
        predicted = min(delay + int(delay * 0.6), delay + 30)
        sc = current.get("StationCode", "")
        coords = STATION_COORDS.get(sc, [22.5, 80.0])
        mock = next((m for m in MOCK_TRAINS if m["id"] == train_no), {})
        status = "critical" if predicted > 30 else "delayed" if predicted > 5 else "on-time"
        return {
            "id": train_no,
            "name": data.get("TrainName", mock.get("name", f"Train {train_no}")),
            "from": mock.get("from", "Origin"),
            "to":   mock.get("to", "Destination"),
            "scheduled": mock.get("scheduled", "--:--"),
            "currentDelay": delay,
            "predictedDelay": predicted,
            "status": status,
            "affectedTrains": [],
            "platform": mock.get("platform", "--"),
            "lastStation": current.get("StationName", "Unknown"),
            "lat": coords[0], "lng": coords[1],
            "isReal": True,
        }
    except Exception as e:
        print(f"Train {train_no} fetch failed: {e}")
        return None

@app.get("/api/delays")
async def get_delays():
    real_data = []
    if RAIL_API_KEY:
        import asyncio
        results = await asyncio.gather(*[fetch_real_train(n) for n in TRAIN_NUMBERS])
        real_data = [r for r in results if r is not None]

    if real_data:
        print(f"Real data: {len(real_data)}/{len(TRAIN_NUMBERS)} trains")
        # Fill missing with mock
        real_ids = {t["id"] for t in real_data}
        for m in MOCK_TRAINS:
            if m["id"] not in real_ids:
                real_data.append({**m, "isReal": False})
        return {"trains": real_data, "updated_at": time.time(), "source": "live"}
    else:
        print("Using mock data")
        return {"trains": [{**m, "isReal": False} for m in MOCK_TRAINS], "updated_at": time.time(), "source": "mock"}

# ── Occupancy ─────────────────────────────────────────────────────────────────
def gen_coaches():
    types=["SL","SL","SL","3A","3A","2A","1A","GEN","GEN"]
    caps={"SL":72,"3A":64,"2A":46,"1A":24,"GEN":100}
    out=[]
    for i,t in enumerate(types):
        c=caps[t]; o=min(c,int(c*(0.3+random.random()*0.85))); p=o/c
        s="overcrowded" if p>0.95 else "high" if p>0.75 else "medium" if p>0.4 else "low"
        out.append({"id":f"C{i+1}","type":t,"capacity":c,"occupied":o,"status":s})
    return out

@app.get("/api/occupancy")
async def get_occupancy():
    return {"platforms":[
        {"id":"P1","station":"New Delhi","train":"Rajdhani Express","trainNo":"12301","arrivesIn":random.randint(5,15),"coaches":gen_coaches()},
        {"id":"P4","station":"New Delhi","train":"Bhopal Shatabdi", "trainNo":"12002","arrivesIn":random.randint(20,30),"coaches":gen_coaches()},
        {"id":"P9","station":"New Delhi","train":"Mumbai Mail",      "trainNo":"12137","arrivesIn":random.randint(30,45),"coaches":gen_coaches()},
    ]}

# ── Gemini Chat ───────────────────────────────────────────────────────────────
@app.post("/api/chat")
async def chat(req: ChatRequest):
    if not GEMINI_AVAILABLE:
        return {"answer": "AI chat unavailable — GEMINI_API_KEY not set."}
    try:
        prompt = f"You are RailSaarthi AI, an intelligent assistant for Indian Railways. Answer concisely:\n\n{req.question}"
        response = model.generate_content(prompt)
        return {"answer": response.text}
    except Exception as e:
        return {"answer": f"Error: {str(e)}"}

@app.get("/")
async def root():
    return {"status":"ok","service":"RailSaarthi API","gemini":GEMINI_AVAILABLE,"rail_api":bool(RAIL_API_KEY)}