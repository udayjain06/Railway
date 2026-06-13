from fastapi import APIRouter
from pydantic import BaseModel
import base64, cv2, numpy as np, sys, os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "ml"))
from fatigue_detector import FatigueDetector

router = APIRouter()
detector = FatigueDetector()

class FrameRequest(BaseModel):
    frame: str          # base64-encoded JPEG
    pilot_id: str = "pilot_001"

class FatigueResponse(BaseModel):
    pilot_id: str
    perclos: float      # % of time eyes closed (0–1)
    head_nod: bool
    alert_level: str    # "normal" | "warning" | "critical"
    message: str

@router.post("/analyze", response_model=FatigueResponse)
def analyze_frame(req: FrameRequest):
    # decode base64 → OpenCV image
    img_bytes = base64.b64decode(req.frame)
    arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    result = detector.analyze(frame)

    alert_level = "normal"
    message = "Driver alert — all good."
    if result["perclos"] > 0.35 or result["head_nod"]:
        alert_level = "warning"
        message = "Drowsiness detected — please take a break."
    if result["perclos"] > 0.6:
        alert_level = "critical"
        message = "CRITICAL: Driver microsleep detected! Applying brakes."

    return FatigueResponse(
        pilot_id=req.pilot_id,
        perclos=round(result["perclos"], 3),
        head_nod=result["head_nod"],
        alert_level=alert_level,
        message=message,
    )

@router.get("/status")
def status():
    return {"module": "fatigue_guard", "ready": True}
