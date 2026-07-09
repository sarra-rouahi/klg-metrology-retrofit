#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
CameraManager — capture webcam réelle (OpenCV), thread dédié.
================================================================================
Repris et adapté de jarreb.py : capture en arrière-plan, reconnexion auto si la
caméra se déconnecte, flip horizontal/vertical, calcul FPS.

Le frame courant est exposé via get_jpeg_frame() pour être streamé en MJPEG
par le serveur FastAPI (server.py).
================================================================================
"""

import threading
import time
import logging
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger("KLGMetrology.Camera")


class CameraManager:
    def __init__(self, camera_index: int = 0) -> None:
        self._camera_index = camera_index
        self._cap: Optional[cv2.VideoCapture] = None
        self._thread: Optional[threading.Thread] = None
        self._running: bool = False
        self._reconnect_delay: float = 2.0

        self._lock = threading.Lock()
        self._frame: Optional[np.ndarray] = None
        self._jpeg: Optional[bytes] = None
        self._connected: bool = False
        self._fps: float = 0.0

        self._fps_counter = 0
        self._fps_timer = time.time()

        self.flip_horizontal: bool = True
        self.flip_vertical: bool = False

    # ---- lifecycle ---------------------------------------------------------
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, name="CameraThread", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5.0)
        self._release()

    def set_camera_index(self, index: int) -> None:
        """Change de caméra à chaud (utile s'il y a plusieurs périphériques USB)."""
        self._camera_index = index
        self._release()  # force une reconnexion sur la nouvelle source

    # ---- internal -----------------------------------------------------------
    def _apply_flip(self, frame: np.ndarray) -> np.ndarray:
        if self.flip_horizontal and self.flip_vertical:
            return cv2.flip(frame, -1)
        elif self.flip_horizontal:
            return cv2.flip(frame, 1)
        elif self.flip_vertical:
            return cv2.flip(frame, 0)
        return frame

    def _connect(self) -> bool:
        try:
            if self._cap is not None:
                self._cap.release()
            # CAP_DSHOW = backend Windows recommandé pour les webcams USB.
            # Sur Linux/Mac, on retombe automatiquement sur le backend par défaut.
            try:
                self._cap = cv2.VideoCapture(self._camera_index, cv2.CAP_DSHOW)
            except Exception:
                self._cap = cv2.VideoCapture(self._camera_index)
            if not self._cap.isOpened():
                self._cap.release()
                self._cap = cv2.VideoCapture(self._camera_index)
            self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
            self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
            self._cap.set(cv2.CAP_PROP_FPS, 30)
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            ret, frame = self._cap.read()
            if ret and frame is not None:
                with self._lock:
                    self._connected = True
                return True
            with self._lock:
                self._connected = False
            return False
        except Exception as exc:
            logger.error(f"Erreur connexion caméra: {exc}")
            with self._lock:
                self._connected = False
            return False

    def _release(self) -> None:
        try:
            if self._cap is not None:
                self._cap.release()
                self._cap = None
            with self._lock:
                self._connected = False
        except Exception:
            pass

    def _loop(self) -> None:
        while self._running:
            try:
                if self._cap is None or not self._cap.isOpened():
                    if not self._connect():
                        time.sleep(self._reconnect_delay)
                        continue
                ret, frame = self._cap.read()
                if not ret or frame is None:
                    self._release()
                    time.sleep(self._reconnect_delay)
                    continue
                frame = self._apply_flip(frame)
                ok, jpeg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                with self._lock:
                    self._frame = frame
                    if ok:
                        self._jpeg = jpeg.tobytes()
                    self._connected = True
                self._update_fps()
            except Exception as exc:
                logger.error(f"Erreur acquisition: {exc}")
                with self._lock:
                    self._connected = False
                    self._frame = None
                time.sleep(self._reconnect_delay)

    def _update_fps(self) -> None:
        self._fps_counter += 1
        now = time.time()
        if self._fps_counter >= 30:
            with self._lock:
                self._fps = round(self._fps_counter / (now - self._fps_timer), 1)
            self._fps_counter = 0
            self._fps_timer = now

    # ---- public getters -----------------------------------------------------
    def get_frame(self) -> Optional[np.ndarray]:
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    def get_jpeg_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._jpeg

    @property
    def connected(self) -> bool:
        with self._lock:
            return self._connected

    @property
    def fps(self) -> float:
        with self._lock:
            return self._fps

    @property
    def frame_size(self) -> Optional[tuple]:
        f = self.get_frame()
        if f is None:
            return None
        h, w = f.shape[:2]
        return (w, h)


def list_available_cameras(max_check: int = 5) -> list:
    """Scanne les index de caméra disponibles (utile pour choisir la bonne webcam USB)."""
    available = []
    for i in range(max_check):
        cap = cv2.VideoCapture(i)
        if cap is not None and cap.isOpened():
            ret, _ = cap.read()
            if ret:
                available.append(i)
            cap.release()
    return available
