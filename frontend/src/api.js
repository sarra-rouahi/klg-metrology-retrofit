// ─── CLIENT API ──────────────────────────────────────────────────────────────
// Toutes les requêtes passent par /api/*, proxyfié vers FastAPI en dev (vite.config.js)
// et servi directement par le même serveur en production (server.py).

const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  getStatus: () => request("/status"),
  getCameras: () => request("/cameras"),
  selectCamera: (index) => request("/camera/select", { method: "POST", body: JSON.stringify({ index }) }),
  flipCamera: () => request("/camera/flip", { method: "POST" }),

  setZoom: (zoom) => request("/zoom", { method: "POST", body: JSON.stringify({ zoom }) }),
  setReticle: (reticle) => request("/reticle", { method: "POST", body: JSON.stringify({ reticle }) }),

  saveCalibration: (zoom, reference_mm, measured_px) =>
    request("/calibration/save", { method: "POST", body: JSON.stringify({ zoom, reference_mm, measured_px }) }),
  getModel: () => request("/calibration/model"),

  measureClick: (x, y) => request("/measure/click", { method: "POST", body: JSON.stringify({ x, y }) }),
  measureReset: () => request("/measure/reset", { method: "POST" }),

  tangentStart: () => request("/tangent/start", { method: "POST" }),
  tangentNext: () => request("/tangent/next", { method: "POST" }),
  tangentCancel: () => request("/tangent/cancel", { method: "POST" }),
  tangentAdjust: (side, delta) => request("/tangent/adjust", {
    method: "POST",
    body: JSON.stringify({ side, delta }),
  }),
  tangentSave: () => request("/tangent/save", { method: "POST" }),
  measureSetPoint: (point, x, y) => request("/measure/set_point", {
    method: "POST",
    body: JSON.stringify({ point, x, y }),
  }),

  startCalibrationSession: (mode) => request("/calibration/session/start", {
    method: "POST",
    body: JSON.stringify({ mode }),
  }),
  getCalibrationSession: () => request("/calibration/session"),

  getMeasurements: () => request("/measurements"),
  clearMeasurements: () => request("/measurements/clear", { method: "POST" }),
  exportUrl: () => BASE + "/measurements/export",

  videoFeedUrl: () => BASE + "/video_feed?t=" + Date.now(),
};
