#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
KLG Metrology — Serveur FastAPI
================================================================================
Pont entre l'interface React et la logique métier Python (metrology_core.py)
+ la caméra réelle (camera.py).

Lancer :
    python server.py
Puis ouvrir :
    http://localhost:8000
================================================================================
"""

import argparse
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from metrology_core import (
    CalibrationManager, MeasurementStore, TangentSession,
    SessionCalibration, SmartCalibrationModel,
    ALLOWED_ZOOM_LEVELS, APP_NAME, APP_VERSION,
)
from camera import CameraManager, list_available_cameras

# ------------------------------------------------------------------------------
# Logging
# ------------------------------------------------------------------------------
Path("logs").mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    handlers=[
        logging.FileHandler("logs/server.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger("KLGMetrology.Server")

# ------------------------------------------------------------------------------
# Etat global de l'application (simple, mono-utilisateur / mono-poste)
# ------------------------------------------------------------------------------
calib_mgr = CalibrationManager()
meas_store = MeasurementStore()
tangent_session = TangentSession()
camera = CameraManager(camera_index=0)

app_state = {
    "zoom": ALLOWED_ZOOM_LEVELS[2] if len(ALLOWED_ZOOM_LEVELS) > 2 else ALLOWED_ZOOM_LEVELS[0],
    "reticle": "Croix",
    "p1": None,
    "p2": None,
}
calibration_session: Optional[SessionCalibration] = None

# ------------------------------------------------------------------------------
# FastAPI app
# ------------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Démarrage {APP_NAME} v{APP_VERSION}")
    camera.start()
    yield
    camera.stop()


app = FastAPI(title=APP_NAME, version=APP_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# Helpers
# ==============================================================================
def current_k_factor():
    k, is_computed = calib_mgr.get_k_factor(app_state["zoom"])
    return k, is_computed


def status_payload(message: Optional[str] = None, color: Optional[str] = None):
    k, is_computed = current_k_factor()
    payload = {
        "camera_connected": camera.connected,
        "fps": camera.fps,
        "frame_size": camera.frame_size,
        "zoom": app_state["zoom"],
        "k_factor": k,
        "k_is_computed": is_computed,
        "calibration_valid": k is not None,
        "reticle": app_state["reticle"],
        "p1": app_state["p1"],
        "p2": app_state["p2"],
        "measurement_count": len(meas_store.history),
        "model": calib_mgr.get_model_dict(),
        "calibrations": calib_mgr.get_all_calibrations(),
        "tangent": {
            "active": tangent_session.active,
            "state": tangent_session.state,
            "step": tangent_session.step,
            "lines": tangent_session.lines,
            "centers": tangent_session.centers,
            "distance": tangent_session.distance,
        },
        "message": message,
        "message_color": color,
    }
    if calibration_session is not None:
        payload["calibration_session"] = {
            "active": calibration_session.active,
            "mode": calibration_session.mode,
            "done": len(calibration_session.points),
            "target": calibration_session.target_count,
            "remaining": calibration_session.remaining,
            "points": calibration_session.points,
        }
    return payload


# ==============================================================================
# Schemas
# ==============================================================================
class ZoomRequest(BaseModel):
    zoom: float


class ReticleRequest(BaseModel):
    reticle: str


class CalibSaveRequest(BaseModel):
    zoom: float
    reference_mm: float
    measured_px: float


class CalibrationSessionRequest(BaseModel):
    mode: int


class PointClickRequest(BaseModel):
    x: float
    y: float


class TangentAdjustRequest(BaseModel):
    side: str
    delta: float


class MeasurePointSetRequest(BaseModel):
    point: str
    x: float
    y: float


class CameraIndexRequest(BaseModel):
    index: int


# ==============================================================================
# Routes — état / statut
# ==============================================================================
@app.get("/api/status")
def get_status():
    return status_payload()


@app.get("/api/cameras")
def get_cameras():
    return {"available": list_available_cameras()}


@app.post("/api/camera/select")
def select_camera(req: CameraIndexRequest):
    camera.set_camera_index(req.index)
    return status_payload(f"Caméra → index {req.index}", "amber")


@app.post("/api/camera/flip")
def flip_camera():
    camera.flip_horizontal = not camera.flip_horizontal
    return status_payload(f"Miroir H: {'ON' if camera.flip_horizontal else 'OFF'}", "amber")


# ==============================================================================
# Routes — flux vidéo (MJPEG)
# ==============================================================================
def mjpeg_generator():
    import time
    boundary = b"--frame"
    while True:
        jpeg = camera.get_jpeg_frame()
        if jpeg is not None:
            yield (boundary + b"\r\n"
                   b"Content-Type: image/jpeg\r\n"
                   b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                   + jpeg + b"\r\n")
        time.sleep(1 / 30)


@app.get("/api/video_feed")
def video_feed():
    return StreamingResponse(
        mjpeg_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ==============================================================================
# Routes — zoom / réticule
# ==============================================================================
@app.post("/api/zoom")
def set_zoom(req: ZoomRequest):
    app_state["zoom"] = req.zoom
    app_state["p1"] = None
    app_state["p2"] = None
    k, is_computed = current_k_factor()
    label = "(calibration exacte)" if (k is not None and not is_computed) else "(K interpolé)" if k else "(non calibré)"
    return status_payload(f"Zoom → {req.zoom}× {label}", "amber")


@app.post("/api/reticle")
def set_reticle(req: ReticleRequest):
    app_state["reticle"] = req.reticle
    return status_payload(f"Réticule → {req.reticle}", "teal")


# ==============================================================================
# Routes — calibration
# ==============================================================================
@app.post("/api/calibration/save")
def save_calibration(req: CalibSaveRequest):
    global calibration_session
    if req.reference_mm <= 0:
        raise HTTPException(400, "La longueur de référence doit être > 0")
    k = req.measured_px / req.reference_mm
    calib_mgr.save_calibration(req.zoom, k, req.reference_mm)
    payload = status_payload(f"Calibration {req.zoom}× OK — K = {k:.6f} px/mm", "green")
    if calibration_session is not None and calibration_session.active:
        calibration_session.add_point(req.zoom, k)
        payload["calibration_session"] = {
            "active": calibration_session.active,
            "mode": calibration_session.mode,
            "done": len(calibration_session.points),
            "target": calibration_session.target_count,
            "remaining": calibration_session.remaining,
            "points": calibration_session.points,
        }
        if calibration_session.is_complete:
            session_model = SmartCalibrationModel()
            session_model.fit(calibration_session.points)
            payload["session_model"] = session_model.to_dict()
            payload["message"] = f"Session terminée — modèle calculé ({session_model.get_equation_str()})"
            payload["message_color"] = "teal"
            calibration_session = None
        else:
            payload["message"] = (
                f"Calibration {req.zoom}× OK — session {len(calibration_session.points)}/{calibration_session.target_count}" )
            payload["message_color"] = "amber"
    return payload


@app.post("/api/calibration/session/start")
def start_calibration_session(req: CalibrationSessionRequest):
    global calibration_session
    if req.mode not in (2, 4):
        raise HTTPException(400, "Mode de session invalide")
    calibration_session = SessionCalibration(mode=req.mode)
    return status_payload(f"Session calibration {req.mode} pts démarrée", "teal")


@app.get("/api/calibration/session")
def get_calibration_session():
    if calibration_session is None:
        return {"active": False}
    return {
        "active": calibration_session.active,
        "mode": calibration_session.mode,
        "done": len(calibration_session.points),
        "target": calibration_session.target_count,
        "remaining": calibration_session.remaining,
        "points": calibration_session.points,
    }


@app.get("/api/calibration/model")
def get_model():
    return {"model": calib_mgr.get_model_dict(), "calibrations": calib_mgr.get_all_calibrations()}


# ==============================================================================
# Routes — mesure point-à-point (clic sur la vidéo)
# ==============================================================================
@app.post("/api/measure/click")
def measure_click(req: PointClickRequest):
    # Si une session de tangentes est active, le clic lui est dédié.
    if tangent_session.active:
        k, _ = current_k_factor()
        result = tangent_session.place(req.x, req.y, k)
        payload = status_payload()
        payload["tangent_event"] = result
        if result["status"] == "done":
            if tangent_session.state == "center_a_ok":
                payload["message"] = "Centre A OK — appelez /api/tangent/next pour détecter le centre B"
                payload["message_color"] = "green"
            elif tangent_session.state == "both_centers":
                payload["tangent_result"] = tangent_session.distance
                payload["message"] = "Centre B OK — distance calculée"
                payload["message_color"] = "teal"
        else:
            payload["message"] = f"Tangente {result['side'].upper()} posée ({result['step']}/4)"
            payload["message_color"] = "amber"
        return payload

    k, _ = current_k_factor()
    if k is None:
        return status_payload("Calibration requise — [C]", "red")

    if app_state["p1"] is None:
        app_state["p1"] = {"x": req.x, "y": req.y}
        return status_payload("P1 posé — cliquez P2", "amber")

    if app_state["p2"] is None:
        app_state["p2"] = {"x": req.x, "y": req.y}
        p1, p2 = app_state["p1"], app_state["p2"]
        dist_px = ((p2["x"] - p1["x"]) ** 2 + (p2["y"] - p1["y"]) ** 2) ** 0.5
        record = meas_store.add(app_state["zoom"], k, dist_px, (p1["x"], p1["y"]), (p2["x"], p2["y"]))
        payload = status_payload(f"Distance : {record['distance_mm']:.5f} mm / {record['distance_um']:.1f} µm", "amberGlow")
        payload["last_measurement"] = record
        return payload

    return status_payload("P1 et P2 sont déjà posés. Utilisez [R] pour réinitialiser avant une nouvelle mesure", "amber")


@app.post("/api/measure/reset")
def measure_reset():
    app_state["p1"] = None
    app_state["p2"] = None
    return status_payload("Mesure réinitialisée", "textDim")


# ==============================================================================
# Routes — tangentes
# ==============================================================================
@app.post("/api/tangent/start")
def tangent_start():
    tangent_session.start()
    return status_payload("Mode tangentes — cliquez HAUT (TOP)", "teal")


@app.post("/api/tangent/next")
def tangent_next():
    if tangent_session.start_second_detection():
        return status_payload("Mode tangentes B — cliquez HAUT (TOP)", "teal")
    return status_payload("Impossible : définissez d'abord le centre A", "red")


@app.post("/api/tangent/adjust")
def tangent_adjust(req: TangentAdjustRequest):
    try:
        tangent_session.adjust_line(req.side, req.delta)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    payload = status_payload(f"Tangente {req.side.upper()} ajustée de {req.delta:+.1f} px", "teal")
    if all(v is not None for v in tangent_session.lines.values()):
        k, _ = current_k_factor()
        payload["tangent_result"] = tangent_session.compute_result(k)
    return payload


@app.post("/api/tangent/save")
def tangent_save():
    path = tangent_session.save_session()
    if path:
        return status_payload(f"Tangentes sauvegardées dans {Path(path).name}", "green")
    raise HTTPException(500, "Échec de la sauvegarde des tangentes")


@app.post("/api/measure/set_point")
def measure_set_point(req: MeasurePointSetRequest):
    if req.point not in ("p1", "p2"):
        raise HTTPException(400, "Le point doit être 'p1' ou 'p2'")
    app_state[req.point] = {"x": req.x, "y": req.y}
    return status_payload(f"{req.point.upper()} repositionné", "amber")


@app.post("/api/tangent/cancel")
def tangent_cancel():
    tangent_session.cancel()
    return status_payload("Tangentes annulées", "textDim")


# ==============================================================================
# Routes — historique / export
# ==============================================================================
@app.get("/api/measurements")
def get_measurements():
    return {"measurements": meas_store.history}


@app.post("/api/measurements/clear")
def clear_measurements():
    meas_store.clear()
    return status_payload("Historique vidé", "textDim")


@app.get("/api/measurements/export")
def export_measurements():
    path = meas_store.export_csv()
    if not path:
        raise HTTPException(404, "Aucune mesure à exporter")
    return FileResponse(path, filename=Path(path).name, media_type="text/csv")


# ==============================================================================
# Sert le frontend buildé (React) — placé dans frontend/dist après `npm run build`
# ==============================================================================
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def root():
        return JSONResponse({
            "message": "Frontend non buildé. Lance `npm run build` dans /frontend, "
                        "ou lance le frontend en mode dev avec `npm run dev` (Vite) "
                        "et ouvre http://localhost:5173"
        })


def main():
    import uvicorn
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--camera", type=int, default=0, help="Index de la caméra (défaut=0)")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    camera.set_camera_index(args.camera)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
