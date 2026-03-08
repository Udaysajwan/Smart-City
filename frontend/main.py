# main.py
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import uuid

# Firebase imports
import firebase_admin
from firebase_admin import credentials, storage, firestore
from google.cloud.firestore import GeoPoint

app = FastAPI()

# --- PRIORITY AI CONFIGURATION ---
# Priority levels: critical, high, medium, low
PRIORITY_RULES = {
    "traffic": "high",           # Traffic issues = high priority
    "street_light": "high",      # Street light issues = high priority (safety)
    "pothole": "medium",        # Road damage = medium priority
    "garbage": "low",            # Garbage = low priority
    "other": "medium"            # Default
}

# Keywords that increase priority
HIGH_PRIORITY_KEYWORDS = [
    "emergency", "accident", "danger", "unsafe", "injury", 
    "flood", "fire", "broken", "critical", "urgent", "deadly"
]

def detect_priority(issue_type, description, confidence):
    """AI-powered priority detection based on issue type and description"""
    
    # Start with base priority from issue type
    priority = PRIORITY_RULES.get(issue_type.lower(), "medium")
    
    # Check description for high-priority keywords
    desc_lower = description.lower()
    keyword_count = sum(1 for keyword in HIGH_PRIORITY_KEYWORDS if keyword in desc_lower)
    
    # Upgrade priority based on keywords
    if keyword_count >= 2:
        priority = "critical"
    elif keyword_count == 1:
        if priority == "low":
            priority = "medium"
        elif priority == "medium":
            priority = "high"
    
    # Lower confidence = lower priority (AI unsure)
    if confidence < 0.5 and priority in ["high", "critical"]:
        priority = "medium"
    
    return priority

# --- 1. ENABLE CORS ---
# Allows the frontend (citizen.html) to communicate with this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. INITIALIZE MODELS & FIREBASE ---
# Ensure "best.pt" and "firebase_key.json" are in the same directory
model = YOLO("best.pt") 

cred = credentials.Certificate("firebase_key.json")
firebase_admin.initialize_app(cred, {
    "storageBucket": "smart-city-ada8d.firebasestorage.app" 
})

db = firestore.client()
bucket = storage.bucket()

@app.post("/submit_report")
async def submit_report(
    file: UploadFile = File(...),
    description: str = Form(""),
    address: str = Form(""),
    lat: str = Form("0"),
    lng: str = Form("0")
):
    try:
        # Read image for YOLO analysis
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run YOLO prediction
        results = model.predict(image)
        detections = []
        for r in results:
            for box in r.boxes:
                detections.append({
                    "issue": model.names[int(box.cls[0])],
                    "confidence": float(box.conf[0])
                })

        # Process AI results
        issue_detected = "Unknown Issue"
        confidence = 0.0
        if detections:
            best = max(detections, key=lambda x: x['confidence'])
            issue_detected = best["issue"]
            confidence = best["confidence"]

        # --- AI PRIORITY DETECTION ---
        priority = detect_priority(issue_detected, description, confidence)

        # --- COORDINATE PROCESSING ---
        try:
            lat_float = float(lat)
            lng_float = float(lng)
        except (ValueError, TypeError):
            lat_float = 0.0
            lng_float = 0.0
        
        location_point = GeoPoint(lat_float, lng_float)

        # Upload image to Firebase Storage
        file_id = str(uuid.uuid4())
        blob = bucket.blob(f"reports/{file_id}.jpg")
        blob.upload_from_string(image_bytes, content_type=file.content_type)
        blob.make_public()
        image_url = blob.public_url

        # Save record to Firestore with AI-detected priority
        report_data = {
            "issue": issue_detected,
            "priority": priority,            # AI-detected priority
            "confidence": confidence,
            "description": description,
            "address": address,
            "location": location_point,
            "latitude": lat_float,
            "longitude": lng_float,
            "imageUrl": image_url,
            "status": "pending",
            "createdAt": firestore.SERVER_TIMESTAMP
        }

        db.collection("reports").document(file_id).set(report_data)
        return {"message": "Success", "report": report_data}

    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

