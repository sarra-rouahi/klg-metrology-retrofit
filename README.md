# KLG Metrology Professional

**Hardware + software retrofit of an obsolete industrial metrology machine — bringing a discontinued PCB inspection system back to life with a new camera and a modern software stack.**

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-green)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![React](https://img.shields.io/badge/React-Frontend-61DAFB)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

---

## The Problem

The KLG metrology station was originally used for dimensional inspection of PCBs on a production line. Over time it became effectively unusable:

- Its original optical system lacked the measurement precision required for reliable PCB inspection, with no consistent way to validate the accuracy of a reading.
- There was **no software feedback on zoom position** — any change to the optical zoom silently invalidated the calibration, with no safeguard to catch it.
- Its optical system only produced a usable image in near-total darkness, making it impractical for daily production use.
Rather than discarding the machine, this project takes a **retrofit approach**: upgrade the acquisition hardware and rebuild the entire calibration and measurement layer in software, so that an otherwise obsolete machine becomes a precise, traceable, network-accessible inspection tool again.

## The Innovation

- **Hardware upgrade** — the imprecise original optical system was replaced with a **Tagarno ZIP+** industrial camera, selected as the new acquisition hardware to restore the image quality and precision needed for PCB dimensional inspection.
- **Zoom-aware adaptive calibration** — since the new camera provides no physical zoom sensor, the operator declares the current zoom level and the system fits a scale-factor model `K(zoom)` using `numpy.polyfit`: linear (`K = a·z + b`) with 2 calibration points, quadratic (`K = a·z² + b·z + c`) with 4+ points, with R² and residuals computed to validate model quality, plus drift detection to flag a calibration that has silently gone stale.
- **Physical vs. digital zoom separation** — a software lock (`zoom_physical_locked`) distinguishes the physical optical zoom (which requires recalibration) from digital/display-only zoom, preventing an entire class of silent measurement errors that plagued the original system.
- **Modern technology stack** — built on Python and OpenCV for image acquisition and processing, NumPy for the calibration math, FastAPI for the backend REST API and MJPEG video streaming, and React (Vite) for the frontend, turning a machine tied to one PC into a tool usable from any device on the local network.
## Features

- **Point-to-point measurement** — two-click distance measurement in px / mm / µm, with persisted history and CSV export.
- **Tangent detection** — 4-click sequence (top/bottom/left/right) to compute object center, width, and height automatically.
- **Metrology reticle** — on-screen graticule calibrated in real physical units (10 / 50 / 100 µm) overlaid on the live video feed.
- **Calibration management** — JSON-persisted calibration profiles per zoom level, automatic archiving of superseded calibrations, linear interpolation fallback when no exact model is available.
- **Full traceability** — timestamped measurement history, calibration history, CSV export for quality audits.
- **Live camera control** — USB camera capture via OpenCV in a dedicated thread, automatic reconnection, horizontal/vertical flip, FPS monitoring.

## Architecture

```
klg-metrology/
├── backend/                    Python (FastAPI)
│   ├── metrology_core.py       Business logic: calibration models, measurements, tangents
│   ├── camera.py               Camera capture (OpenCV), threading, auto-reconnect
│   ├── server.py                REST API + MJPEG video stream + static frontend serving
│   └── requirements.txt
├── frontend/                   React (Vite)
│   └── src/
│       ├── KLGMetrology.jsx    Main UI: video overlay, HUD, keyboard shortcuts
│       └── api.js              REST client (fetch → /api/*)
├── start.sh / start.bat        One-click launch (Linux/macOS/Windows)
└── README.md
```

**How it communicates:**
The frontend displays the real camera feed as an MJPEG stream — not a simulation. User actions (click to measure, calibrate, change zoom) call the backend REST API, which runs the same calibration and measurement logic as the original script and returns the updated state. Everything is persisted to disk (`backend/data/`) in the same JSON/CSV format as the legacy tool, preserving continuity with historical measurement data.

## Tech Stack

| Layer | Technology |
|---|---|
| Computer vision / acquisition | Python, OpenCV |
| Calibration modeling | NumPy (`polyfit`, R², residuals) |
| Backend / API | FastAPI, MJPEG streaming |
| Frontend | React (Vite) |
| Data persistence | JSON, CSV |

## Getting Started

Requires **Python 3.9+** and **Node.js 18+**.

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
npm run build
```

**Run:**
- Linux/macOS: `./start.sh`
- Windows: double-click `start.bat`
- Manually: `cd backend && python server.py --camera 0`, then open `http://localhost:8000`

> `--camera 0` is your USB camera index. If multiple cameras are connected, try `--camera 1`, `--camera 2`, etc., or call `GET /api/cameras` to list detected devices.

**Development mode** (hot reload on the frontend):
```bash
# Terminal 1
cd backend && python server.py

# Terminal 2
cd frontend && npm run dev
```


## Keyboard Shortcuts

`C` Calibrate · `Z` Zoom · `G` Reticle · `T` Tangent mode · `R` Reset · `H` Toggle HUD · `I` Info · `Space` Confirm · `Esc` Cancel

## Result

An industrial metrology station that had been taken out of service is now a fully operational, network-accessible PCB inspection tool — with adaptive calibration, traceable measurements, and a modern interface — without any hardware replacement.

