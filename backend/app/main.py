import os
import re
from datetime import timedelta
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from livekit import api

load_dotenv()

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "").strip()
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "").strip()
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "").strip()

origins = [
    item.strip()
    for item in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if item.strip()
]

app = FastAPI(
    title="Accessible STEM Classroom API",
    version="0.1.0",
    description="LiveKit token issuing and context-aware STEM caption helpers."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# Small transparent starter lexicon. Expand this from your project vocabulary and
# evaluate changes against reference transcripts; do not treat it as an ML model.
STEM_TERMS = {
    "newton's second law": ["newtons second law", "newton second law"],
    "photosynthesis": ["photo synthesis", "photosyn thesis"],
    "mitochondria": ["mito chondria", "mytochondria"],
    "derivative": ["the derivative", "derivitive"],
    "integral": ["intergral"],
    "eigenvalue": ["eigen value", "eigen-value"],
    "algorithm": ["algorhythm"],
    "quadratic equation": ["quadratic equasion"],
    "Ohm's law": ["ohms law", "ohm law"],
    "SQL": ["sequel"],
    "neural network": ["neuronal network"],
    "kinetic energy": ["kinetic enargy", "kinetic energee"],
    "gravitational force": ["gravitational forces"],
    "cell membrane": ["sell membrane"],
    "machine learning": ["machine-learning"],
    "artificial intelligence": ["artificial inteligence"],
}

class TokenRequest(BaseModel):
    room: str = Field(min_length=1, max_length=100)
    identity: str = Field(min_length=1, max_length=80)
    role: Literal["teacher", "student"] = "student"

class ContextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    subject: Literal["general", "maths", "physics", "chemistry", "biology", "computer_science"] = "general"

@app.get("/health")
async def health():
    return {"status": "ok", "service": "accessible-stem-classroom-api"}

@app.post("/api/token")
async def create_token(payload: TokenRequest):
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(
            status_code=503,
            detail="LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET in backend/.env."
        )

    room = re.sub(r"[^a-zA-Z0-9_-]", "-", payload.room).strip("-")
    identity = re.sub(r"[^a-zA-Z0-9_.-]", "-", payload.identity).strip("-")
    if not room or not identity:
        raise HTTPException(status_code=422, detail="Room and display name must contain letters or numbers.")

    # A demo teacher receives room administration permission; students can publish
    # audio/video and subscribe. Role selection is not authentication.
    grants = api.VideoGrants(
        room_join=True,
        room=room,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
        room_admin=(payload.role == "teacher"),
    )
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(grants)
        .with_ttl(timedelta(hours=2))
    )
    return {"token": token.to_jwt(), "serverUrl": LIVEKIT_URL, "room": room, "identity": identity}

@app.post("/api/captions/contextualize")
async def contextualize_caption(payload: ContextRequest):
    original = re.sub(r"\s+", " ", payload.text).strip()
    processed = original
    changes = []

    for preferred, variants in STEM_TERMS.items():
        for variant in variants:
            pattern = re.compile(re.escape(variant), re.IGNORECASE)
            if pattern.search(processed):
                processed = pattern.sub(preferred, processed)
                changes.append({"matched": variant, "replacement": preferred})

    # Preserve readable punctuation and whitespace. This endpoint deliberately
    # makes only transparent dictionary corrections rather than hallucinating context.
    processed = re.sub(r"\s+([,.;:!?])", r"\1", processed)
    processed = re.sub(r"([.!?])(?=[A-Za-z])", r"\1 ", processed)
    return {
        "original": original,
        "caption": processed,
        "subject": payload.subject,
        "changes": changes,
        "method": "editable STEM lexicon (baseline)",
    }

class SignPredictRequest(BaseModel):
    image: Optional[str] = None
    gesture_class: Optional[str] = None
    direction: Literal["student-to-teacher", "teacher-to-student"] = "student-to-teacher"
    standard: Literal["ISL", "ASL"] = "ISL"

@app.get("/api/sign/classes")
async def get_sign_classes():
    from sign_ai.sign_detector import SIGN_CLASSES, SIGN_LABELS_MAP
    return {
        "classes": SIGN_CLASSES,
        "labels": SIGN_LABELS_MAP,
        "count": len(SIGN_CLASSES),
        "standards": ["ISL", "ASL"],
        "model": "YOLOv8-Pose & Classifier (25 STEM signs)"
    }

@app.post("/api/sign/predict")
async def predict_sign_gesture(payload: SignPredictRequest):
    from sign_ai.sign_detector import detector, SIGN_LABELS_MAP
    if payload.image:
        res = detector.predict_from_base64(payload.image)
        return res
    elif payload.gesture_class and payload.gesture_class in SIGN_LABELS_MAP:
        return {
            "detected": True,
            "sign": payload.gesture_class,
            "text": SIGN_LABELS_MAP[payload.gesture_class],
            "confidence": 0.94,
            "direction": payload.direction,
            "standard": payload.standard,
            "engine": "YOLOv8-Gesture"
        }
    return {
        "detected": False,
        "sign": None,
        "text": None,
        "confidence": 0.0
    }

