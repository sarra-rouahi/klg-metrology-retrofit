#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
KLG Metrology - Core métier
================================================================================
Logique métier extraite et adaptée de jarreb.py (KLG Metrology Professional).

Ce module ne touche à AUCUNE fenêtre/UI : il expose uniquement des classes
Python pures (modèle de calibration, gestion des mesures, persistance JSON/CSV)
que le serveur FastAPI (server.py) pilote, et que la caméra (camera.py) utilise.

La logique numérique (np.polyfit pour le modèle K(z) linéaire/quadratique,
interpolation, calcul de distance) est conservée à l'identique de l'original.
================================================================================
"""

import json
import csv
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple, List, Dict, Any

import numpy as np

# ------------------------------------------------------------------------------
# CONSTANTES
# ------------------------------------------------------------------------------
APP_NAME = "KLG Metrology Professional"
APP_VERSION = "13.0.0-web"

DATA_DIR = Path("data")
CALIB_FILE = DATA_DIR / "calibrations.json"
CALIB_HIST = DATA_DIR / "calibrations_history.json"
MEAS_FILE = DATA_DIR / "measurements.json"
EXPORT_DIR = DATA_DIR / "exports"

ZOOM_MIN = 1.0
ZOOM_MAX = 52.6
ALLOWED_ZOOM_LEVELS: List[float] = [1.0, 11.1, 21.2, 31.3, 41.4, 51.5]


# ==============================================================================
# SmartCalibrationModel
# ==============================================================================
class SmartCalibrationModel:
    """
    2 points -> modèle linéaire    K(z) = a*z + b
    4+ points -> modèle quadratique K(z) = a*z^2 + b*z + c
    """

    def __init__(self) -> None:
        self.mode: int = 2  # 2 = linéaire, 4 = quadratique
        self.coeffs: List[float] = []
        self.valid: bool = False
        self.timestamp: str = ""
        self.r_squared: float = 0.0
        self.residuals: List[float] = []
        self.cal_points: List[Tuple[float, float]] = []

    def fit(self, points: List[Tuple[float, float]]) -> bool:
        if len(points) < 2:
            return False
        self.cal_points = sorted(points, key=lambda p: p[0])
        zs = np.array([p[0] for p in self.cal_points], dtype=np.float64)
        ks = np.array([p[1] for p in self.cal_points], dtype=np.float64)
        deg = 2 if len(points) >= 4 else 1
        self.mode = 4 if deg == 2 else 2
        try:
            coeffs_np = np.polyfit(zs, ks, deg)
            self.coeffs = [float(c) for c in coeffs_np]
            k_pred = np.polyval(coeffs_np, zs)
            self.residuals = [float(k - kp) for k, kp in zip(ks, k_pred)]
            ss_res = float(np.sum((ks - k_pred) ** 2))
            ss_tot = float(np.sum((ks - np.mean(ks)) ** 2))
            self.r_squared = 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0
            self.valid = True
            self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            return True
        except Exception:
            return False

    def get_k_for_zoom(self, zoom: float) -> Optional[float]:
        if not self.valid or not self.coeffs:
            return None
        k = float(np.polyval(self.coeffs, max(ZOOM_MIN, min(ZOOM_MAX, zoom))))
        return max(0.001, k)

    def get_equation_str(self) -> str:
        if not self.valid:
            return "Non calibré"
        if len(self.coeffs) == 3:
            a, b, c = self.coeffs
            return f"K(z) = {a:.8f}·z² + {b:.6f}·z + {c:.4f}"
        elif len(self.coeffs) == 2:
            a, b = self.coeffs
            return f"K(z) = {a:.6f}·z + {b:.4f}"
        return "?"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "mode": "quadratic" if self.mode == 4 else "linear",
            "coeffs": self.coeffs,
            "valid": self.valid,
            "timestamp": self.timestamp,
            "r_squared": self.r_squared,
            "residuals": self.residuals,
            "cal_points": [[z, k] for z, k in self.cal_points],
            "equation": self.get_equation_str(),
        }

    @classmethod
    def from_dict(cls, data: Dict) -> "SmartCalibrationModel":
        m = cls()
        m.mode = 4 if data.get("mode") in (4, "quadratic") else 2
        m.coeffs = [float(c) for c in data.get("coeffs", [])]
        m.valid = bool(data.get("valid", False))
        m.timestamp = str(data.get("timestamp", ""))
        m.r_squared = float(data.get("r_squared", 0.0))
        m.residuals = [float(r) for r in data.get("residuals", [])]
        m.cal_points = [(float(p[0]), float(p[1])) for p in data.get("cal_points", [])]
        return m


# ==============================================================================
# SessionCalibration
# ==============================================================================
class SessionCalibration:
    """Gère une session de calibration séquentielle de 2 ou 4 mesures."""

    def __init__(self, mode: int = 2) -> None:
        self.mode: int = mode if mode in (2, 4) else 2
        self.target_count: int = self.mode
        self.current_index: int = 0
        self.points: List[Tuple[float, float]] = []

    @property
    def active(self) -> bool:
        return self.current_index < self.target_count

    @property
    def is_complete(self) -> bool:
        return len(self.points) >= self.target_count

    @property
    def remaining(self) -> int:
        return self.target_count - len(self.points)

    def add_point(self, zoom: float, k_factor: float) -> None:
        self.points.append((zoom, k_factor))
        self.current_index += 1

    def reset(self) -> None:
        self.current_index = 0
        self.points.clear()


# ==============================================================================
# CalibrationManager
# ==============================================================================
class CalibrationManager:
    """Gère les calibrations par zoom + le modèle K(z) global, avec persistance JSON."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._data: Dict[str, Any] = {"camera": "Tagarno ZIP+", "calibrations": {}, "smart_model": None}
        self._smart_model: Optional[SmartCalibrationModel] = None
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        try:
            if CALIB_FILE.exists():
                with open(CALIB_FILE, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
                if self._data.get("smart_model"):
                    self._smart_model = SmartCalibrationModel.from_dict(self._data["smart_model"])
            else:
                self._save()
        except Exception:
            self._data = {"camera": "Tagarno ZIP+", "calibrations": {}, "smart_model": None}

    def _save(self) -> None:
        self._data["smart_model"] = self._smart_model.to_dict() if (self._smart_model and self._smart_model.valid) else None
        with open(CALIB_FILE, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def _archive_old(self, zoom_key: str, old_entry: Dict) -> None:
        try:
            hist: Dict = {"history": []}
            if CALIB_HIST.exists():
                with open(CALIB_HIST, "r", encoding="utf-8") as f:
                    hist = json.load(f)
            hist["history"].append({
                "zoom": zoom_key,
                "k_factor": old_entry.get("k_factor"),
                "date": old_entry.get("date"),
                "archived_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
            with open(CALIB_HIST, "w", encoding="utf-8") as f:
                json.dump(hist, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def save_calibration(self, zoom: float, k_factor: float, reference_mm: float) -> None:
        with self._lock:
            key = str(zoom)
            calibs = self._data.setdefault("calibrations", {})
            if key in calibs:
                self._archive_old(key, calibs[key])
            calibs[key] = {
                "k_factor": round(k_factor, 8),
                "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "reference_mm": reference_mm,
            }
            self._rebuild_smart_model()
            self._save()

    def _rebuild_smart_model(self) -> None:
        calibs = self._data.get("calibrations", {})
        valid_calibs = []
        for z_str, cal in calibs.items():
            try:
                z, k = float(z_str), float(cal["k_factor"])
                if z > 0 and k > 0:
                    valid_calibs.append((z, k))
            except Exception:
                pass
        if len(valid_calibs) < 2:
            self._smart_model = None
            return
        model = SmartCalibrationModel()
        self._smart_model = model if model.fit(valid_calibs) else None

    def has_calibration(self, zoom: float) -> bool:
        return str(zoom) in self._data.get("calibrations", {})

    def get_k_factor(self, zoom: float) -> Tuple[Optional[float], bool]:
        """Retourne (k_factor, is_computed). is_computed=True si interpolé/modèle (pas calibration exacte)."""
        calibs = self._data.get("calibrations", {})
        key = str(zoom)
        if key in calibs:
            return float(calibs[key]["k_factor"]), False
        if self._smart_model and self._smart_model.valid:
            k = self._smart_model.get_k_for_zoom(zoom)
            if k:
                return k, True
        k_i = self._interpolate(zoom, calibs)
        return (k_i, True) if k_i else (None, False)

    def _interpolate(self, zoom: float, calibs: Dict) -> Optional[float]:
        try:
            points = [(float(k), float(v["k_factor"])) for k, v in calibs.items()]
            if len(points) < 2:
                return None
            points.sort(key=lambda p: p[0])
            zs = [p[0] for p in points]
            if zoom <= zs[0]:
                return points[0][1]
            if zoom >= zs[-1]:
                return points[-1][1]
            for i in range(len(points) - 1):
                z1, k1 = points[i]
                z2, k2 = points[i + 1]
                if z1 <= zoom <= z2:
                    return k1 + (zoom - z1) / (z2 - z1) * (k2 - k1)
        except Exception:
            pass
        return None

    def get_all_calibrations(self) -> Dict:
        return dict(self._data.get("calibrations", {}))

    def check_drift(self, zoom: float, new_k: float) -> Optional[float]:
        calibs = self._data.get("calibrations", {})
        key = str(zoom)
        if key not in calibs:
            return None
        try:
            old_k = float(calibs[key]["k_factor"])
            return abs(new_k - old_k) / old_k * 100.0 if old_k != 0 else None
        except Exception:
            return None

    def load_zoom_profile(self, zoom: float) -> Tuple[Optional[float], bool]:
        k, is_computed = self.get_k_factor(zoom)
        return k, is_computed

    def get_num_calibrations(self) -> int:
        return len(self._data.get("calibrations", {}))

    def get_model(self) -> Optional[SmartCalibrationModel]:
        return self._smart_model

    def get_model_dict(self) -> Optional[Dict]:
        if self._smart_model and self._smart_model.valid:
            return self._smart_model.to_dict()
        return None


# ==============================================================================
# MeasurementRecord + MeasurementStore
# ==============================================================================
class MeasurementStore:
    """Historique des mesures point-à-point, avec persistance JSON + export CSV."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._history: List[Dict[str, Any]] = []
        self._session_start = datetime.now()
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        self._load_previous()

    def _load_previous(self) -> None:
        try:
            if MEAS_FILE.exists():
                with open(MEAS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._history = data.get("measurements", [])
        except Exception:
            self._history = []

    def add(self, zoom: float, k_factor: float, dist_px: float,
             p1: Tuple[float, float], p2: Tuple[float, float]) -> Dict[str, Any]:
        dist_mm = dist_px / k_factor if k_factor else 0.0
        dist_um = dist_mm * 1000.0
        record = {
            "id": int(datetime.now().timestamp() * 1000),
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "zoom": zoom,
            "k_factor": round(k_factor, 8),
            "distance_px": round(dist_px, 4),
            "distance_mm": round(dist_mm, 6),
            "distance_um": round(dist_um, 3),
            "point1": list(p1),
            "point2": list(p2),
        }
        with self._lock:
            self._history.append(record)
            self._save_json()
        return record

    def _save_json(self) -> None:
        try:
            data = {
                "session_start": self._session_start.strftime("%Y-%m-%d %H:%M:%S"),
                "total_measurements": len(self._history),
                "measurements": self._history,
            }
            with open(MEAS_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def export_csv(self) -> Optional[str]:
        with self._lock:
            if not self._history:
                return None
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            path = EXPORT_DIR / f"measurements_{ts}.csv"
            with open(path, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f, delimiter=";")
                w.writerow(["Timestamp", "Zoom", "KFactor", "DistancePx", "DistanceMm", "DistanceUm"])
                for rec in self._history:
                    w.writerow([rec["timestamp"], rec["zoom"], rec["k_factor"],
                                rec["distance_px"], rec["distance_mm"], rec["distance_um"]])
            return str(path)

    @property
    def history(self) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._history)

    def clear(self) -> None:
        with self._lock:
            self._history = []
            self._save_json()


# ==============================================================================
# TangentSession — détection de tangentes (haut/bas/gauche/droite) -> centre+dims
# ==============================================================================
class TangentSession:
    SIDES = ["top", "bottom", "left", "right"]

    def __init__(self) -> None:
        self.active: bool = False
        self.state: str = "idle"
        self.step: int = 0
        self.lines: Dict[str, Optional[float]] = {s: None for s in self.SIDES}
        self.centers: List[Dict[str, Any]] = []
        self.distance: Optional[Dict[str, Any]] = None

    def start(self) -> None:
        self.active = True
        self.state = "placing_a"
        self.step = 0
        self.lines = {s: None for s in self.SIDES}
        self.centers = []
        self.distance = None

    def cancel(self) -> None:
        self.active = False
        self.state = "idle"
        self.step = 0
        self.lines = {s: None for s in self.SIDES}
        self.centers = []
        self.distance = None

    def start_second_detection(self) -> bool:
        if len(self.centers) != 1 or self.active:
            return False
        self.active = True
        self.state = "placing_b"
        self.step = 0
        self.lines = {s: None for s in self.SIDES}
        self.distance = None
        return True

    def place(self, x: float, y: float, k_factor: Optional[float] = None) -> Dict[str, Any]:
        if not self.active or self.step >= 4:
            return {"status": "ignored"}
        side = self.SIDES[self.step]
        pos = y if side in ("top", "bottom") else x
        self.lines[side] = pos
        self.step += 1
        done = self.step >= 4
        if done:
            result = self.compute_result(k_factor)
            if result is not None:
                self.centers.append(result)
                if len(self.centers) == 2:
                    self._compute_distance()
            self.active = False
            self.state = "both_centers" if len(self.centers) == 2 else "center_a_ok"
        else:
            self.state = "placing_a" if len(self.centers) == 0 else "placing_b"
        return {
            "status": "done" if done else "placed",
            "side": side,
            "step": self.step,
            "lines": dict(self.lines),
            "state": self.state,
            "centers": list(self.centers),
        }

    def undo_last(self) -> bool:
        if self.step <= 0:
            return False
        self.step -= 1
        side = self.SIDES[self.step]
        self.lines[side] = None
        self.state = "placing_a" if len(self.centers) == 0 else "placing_b"
        return True

    def adjust_line(self, side: str, delta: float) -> None:
        if side not in self.SIDES:
            raise ValueError(f"Side must be one of {', '.join(self.SIDES)}")
        if self.lines.get(side) is None:
            raise ValueError(f"Tangent line '{side}' n'est pas encore définie")
        self.lines[side] += delta

    def compute_result(self, k_factor: Optional[float]) -> Optional[Dict[str, Any]]:
        top, bottom, left, right = (self.lines.get(s) for s in self.SIDES)
        if None in (top, bottom, left, right):
            return None
        if top > bottom:
            top, bottom = bottom, top
        if left > right:
            left, right = right, left
        w_px = right - left
        h_px = bottom - top
        cx_px = (left + right) / 2.0
        cy_px = (top + bottom) / 2.0
        label = "A" if len(self.centers) == 0 else "B"
        k = float(k_factor) if k_factor else None
        result = {
            "label": label,
            "center_px": {"x": round(cx_px, 4), "y": round(cy_px, 4)},
            "center_mm": {"x": round(cx_px / k, 6), "y": round(cy_px / k, 6)} if k else None,
            "width_px": round(w_px, 4),
            "height_px": round(h_px, 4),
            "width_mm": round(w_px / k, 6) if k else None,
            "height_mm": round(h_px / k, 6) if k else None,
            "lines": dict(self.lines),
            "k_factor": round(k, 8) if k else None,
        }
        return result

    def _compute_distance(self) -> None:
        if len(self.centers) < 2:
            self.distance = None
            return
        a = self.centers[0]
        b = self.centers[1]
        if a.get("center_mm") is None or b.get("center_mm") is None:
            self.distance = None
            return
        dx_px = b["center_px"]["x"] - a["center_px"]["x"]
        dy_px = b["center_px"]["y"] - a["center_px"]["y"]
        dx_mm = b["center_mm"]["x"] - a["center_mm"]["x"]
        dy_mm = b["center_mm"]["y"] - a["center_mm"]["y"]
        dist_px = float((dx_px ** 2 + dy_px ** 2) ** 0.5)
        dist_mm = float((dx_mm ** 2 + dy_mm ** 2) ** 0.5)
        self.distance = {
            "center_A": a,
            "center_B": b,
            "dx_px": round(dx_px, 4),
            "dy_px": round(dy_px, 4),
            "dx_mm": round(dx_mm, 6),
            "dy_mm": round(dy_mm, 6),
            "dist_px": round(dist_px, 4),
            "dist_mm": round(dist_mm, 6),
            "dist_um": round(dist_mm * 1000.0, 3),
        }

    def save_session(self) -> Optional[str]:
        try:
            EXPORT_DIR.mkdir(parents=True, exist_ok=True)
            det_file = EXPORT_DIR / "detections_tangentes.json"
            data: Dict[str, Any] = {"sessions": []}
            if det_file.exists():
                with open(det_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            session: Dict[str, Any] = {"timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
            if self.centers:
                session["center_A"] = self.centers[0]
            if len(self.centers) > 1:
                session["center_B"] = self.centers[1]
            if self.distance:
                session["distance"] = self.distance
            data["sessions"].append(session)
            with open(det_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return str(det_file)
        except Exception:
            return None
