import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "./api.js";

// ─── PALETTES ────────────────────────────────────────────────────────────────
const DARK = {
  bg:        "#0B0C0E",
  panel:     "#111318",
  card:      "#171A20",
  border:    "#1F2330",
  borderHi:  "#2A3050",
  amber:     "#D99B3A",
  amberDim:  "#7A5318",
  amberGlow: "#F0B84A",
  teal:      "#3A9CB5",
  tealDim:   "#1A4F60",
  tealLight: "#5BBFD6",
  green:     "#4CAF7D",
  greenDim:  "#1E4A33",
  red:       "#C43C3C",
  redDim:    "#5A1A1A",
  text:      "#E8EAF0",
  textDim:   "#8B90A0",
  textMuted: "#454860",
  canvasBg:  "#070809",
  canvasDot: "#1A1D25",
};

const LIGHT = {
  bg:        "#F0F2F5",
  panel:     "#FFFFFF",
  card:      "#F7F8FA",
  border:    "#DDE0E8",
  borderHi:  "#BCC0D0",
  amber:     "#B8760A",
  amberDim:  "#FDE8C0",
  amberGlow: "#A05C00",
  teal:      "#1A7A94",
  tealDim:   "#C8EAF4",
  tealLight: "#0E6080",
  green:     "#2A7A50",
  greenDim:  "#C8EAD8",
  red:       "#B02020",
  redDim:    "#F4CCCC",
  text:      "#1A1C24",
  textDim:   "#4A5070",
  textMuted: "#8A90A8",
  canvasBg:  "#1A1D25",
  canvasDot: "#2A2D38",
};

// ─── GLOBAL STYLES ──────────────────────────────────────────────────────────
const GlobalStyle = ({ C }) => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&family=Inter:wght@300;400;500;600&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;font-size:13px;overflow:hidden;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:${C.panel};}
    ::-webkit-scrollbar-thumb{background:${C.borderHi};border-radius:2px;}
    .mono{font-family:'JetBrains Mono',monospace;}
    .val{font-family:'JetBrains Mono',monospace;font-weight:500;}
    @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
    @keyframes blink{0%,100%{border-color:${C.amber};}50%{border-color:transparent;}}
  `}</style>
);

// ─── THEME TOGGLE ─────────────────────────────────────────────────────────────
const ThemeToggle = ({ dark, onToggle, C }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "4px 10px",
        background: hov ? C.card : "transparent",
        border: `1px solid ${hov ? C.borderHi : C.border}`,
        borderRadius: 5, cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "'Inter',sans-serif",
      }}
    >
      <div style={{
        position: "relative", width: 34, height: 18,
        background: dark ? C.amber : C.teal,
        borderRadius: 9, transition: "background 0.25s",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 2,
          left: dark ? 18 : 2,
          width: 14, height: 14,
          background: "#fff",
          borderRadius: "50%",
          transition: "left 0.25s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}/>
      </div>
      <span style={{ fontSize: 14 }}>{dark ? "🌙" : "☀️"}</span>
      <span style={{
        fontSize: 10, fontWeight: 500, letterSpacing: "0.05em",
        color: C.textDim, textTransform: "uppercase",
      }}>
        {dark ? "Dark" : "Light"}
      </span>
    </button>
  );
};

// ─── MICRO COMPONENTS ────────────────────────────────────────────────────────
const Seg = ({ label, value, unit, color, wide = false, C }) => (
  <div style={{
    display:"flex", flexDirection:"column", gap:2,
    padding:"6px 10px",
    borderLeft:`2px solid ${color}`,
    minWidth: wide ? 140 : 90,
    flexShrink:0,
  }}>
    <span style={{fontSize:9,color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase"}}>{label}</span>
    <span className="mono" style={{fontSize:14,fontWeight:600,color,letterSpacing:"0.02em"}}>
      {value ?? <span style={{color:C.textMuted}}>—</span>}
      {unit && value != null && <span style={{fontSize:10,fontWeight:400,color:C.textDim,marginLeft:3}}>{unit}</span>}
    </span>
  </div>
);

const Badge = ({ children, color, C }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", gap:4,
    padding:"2px 7px", borderRadius:3,
    background: color+"22",
    border:`1px solid ${color}44`,
    color, fontSize:10, fontWeight:500, letterSpacing:"0.06em",
    textTransform:"uppercase",
    fontFamily:"'JetBrains Mono',monospace",
  }}>{children}</span>
);

const Dot = ({ active, color, C }) => (
  <span style={{
    display:"inline-block", width:6, height:6, borderRadius:"50%",
    background: active ? color : C.borderHi,
    boxShadow: active ? `0 0 6px ${color}` : "none",
    flexShrink:0,
  }}/>
);

const Divider = ({ v, C }) => (
  v
    ? <div style={{width:1,background:C.border,alignSelf:"stretch",margin:"0 4px"}}/>
    : <div style={{height:1,background:C.border,margin:"6px 0"}}/>
);

const Btn = ({ children, onClick, accent, danger, small, disabled, icon, style: ext = {}, C }) => {
  const [hov, setHov] = useState(false);
  const bg = disabled ? C.borderHi :
             accent ? (hov ? C.amberGlow : C.amber) :
             danger ? (hov ? C.red+"CC" : C.red) :
             hov ? C.card : "transparent";
  const col = disabled ? C.textMuted :
              (accent || danger) ? "#fff" : C.text;
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:"inline-flex", alignItems:"center", gap:6,
        padding: small ? "4px 10px" : "6px 14px",
        border:`1px solid ${disabled ? C.border : accent ? C.amber : danger ? C.red : C.borderHi}`,
        borderRadius:4, background:bg, color:col,
        fontSize: small ? 11 : 12, fontWeight:500,
        cursor:disabled?"not-allowed":"pointer",
        transition:"all 0.12s", letterSpacing:"0.03em",
        fontFamily:"'Inter',sans-serif",
        ...ext,
      }}
    >
      {icon && <span style={{fontSize:14}}>{icon}</span>}
      {children}
    </button>
  );
};

const SectionHeader = ({ label, action, actionLabel, C }) => (
  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px 6px",gap:8}}>
    <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.12em",textTransform:"uppercase",color:C.textMuted}}>{label}</span>
    {action && (
      <button onClick={action} style={{background:"none",border:"none",color:C.teal,fontSize:10,cursor:"pointer",padding:"0 2px"}}>
        {actionLabel}
      </button>
    )}
  </div>
);

// ─── CONSTANTES (synchronisées avec le backend metrology_core.py) ────────────
const ZOOM_LEVELS = [1.0, 11.1, 21.2, 31.3, 41.4, 51.5];
const RETICLE_TYPES = ["Aucun","Croix","Cercles","Graduée","Repère","Grille","Règles","Diagonales"];

// ─── VIDEO CANVAS (flux webcam réel + overlay réticule/mesures) ─────────────
// L'image <img> affiche le flux MJPEG streamé par FastAPI (caméra physique réelle).
// Un <canvas> transparent par-dessus dessine réticule / points / tangentes,
// recalculé à chaque frame pour rester collé aux dimensions réelles affichées.
const VideoCanvas = ({ reticle, calib, tangent, p1, p2, selectedMeasurePoint, onMouseMove, onClick, camOk, C }) => {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [imgKey] = useState(() => api.videoFeedUrl());

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) { frameRef.current = requestAnimationFrame(drawOverlay); return; }
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Réticule
    if (reticle !== "Aucun") {
      ctx.save(); ctx.globalAlpha = 0.65;
      const rc = "#3A9CB5";
      if (reticle === "Croix") {
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
        ctx.fillStyle = rc; ctx.fillRect(W/2-2,H/2-2,4,4);
      } else if (reticle === "Cercles") {
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        [60,120,200,300].forEach(r => { ctx.beginPath(); ctx.arc(W/2,H/2,r,0,Math.PI*2); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(W/2-16,H/2); ctx.lineTo(W/2+16,H/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W/2,H/2-16); ctx.lineTo(W/2,H/2+16); ctx.stroke();
      } else if (reticle === "Grille") {
        ctx.strokeStyle = rc+"88"; ctx.lineWidth = 0.5;
        for (let x=0;x<W;x+=60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let y=0;y<H;y+=60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
      } else if (reticle==="Graduée" || reticle==="Repère") {
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H/2-30); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W/2,H/2+30); ctx.lineTo(W/2,H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W/2-30,H/2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W/2+30,H/2); ctx.lineTo(W,H/2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W/2,H/2,30,0,Math.PI*2); ctx.stroke();
        for (let i=1;i<6;i++) {
          const ts = i%5===0 ? 12 : 6;
          ctx.beginPath(); ctx.moveTo(W/2+i*50,H/2-ts); ctx.lineTo(W/2+i*50,H/2+ts); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(W/2-i*50,H/2-ts); ctx.lineTo(W/2-i*50,H/2+ts); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(W/2-ts,H/2+i*50); ctx.lineTo(W/2+ts,H/2+i*50); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(W/2-ts,H/2-i*50); ctx.lineTo(W/2+ts,H/2-i*50); ctx.stroke();
        }
      } else if (reticle === "Règles") {
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        for (let x=0;x<W;x+=20) { const ts = x%100===0?12:6; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,ts); ctx.stroke(); }
        for (let y=0;y<H;y+=20) { const ts = y%100===0?12:6; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(ts,y); ctx.stroke(); }
      } else if (reticle === "Diagonales") {
        ctx.strokeStyle = rc; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W,0); ctx.lineTo(0,H); ctx.stroke();
      }
      ctx.restore();
    }

    // Points de mesure
    const drawCross = (px, py, color, label, active) => {
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = active ? 2 : 1.5; ctx.globalAlpha = 1;
      const s = 10, g = 3;
      ctx.beginPath(); ctx.moveTo(px-s,py); ctx.lineTo(px-g,py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px+g,py); ctx.lineTo(px+s,py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px,py-s); ctx.lineTo(px,py-g); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px,py+g); ctx.lineTo(px,py+s); ctx.stroke();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px,py,1.5,0,Math.PI*2); ctx.fill();
      if (active) { ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(px,py,s+4,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = color; ctx.font = "11px 'JetBrains Mono',monospace";
      ctx.fillText(label, px+s+4, py-2);
      ctx.restore();
    };

    if (p1) {
      drawCross(p1.x, p1.y, "#5BBFD6", "P1", selectedMeasurePoint === "p1" || !p2);
      if (p2) {
        drawCross(p2.x, p2.y, "#D99B3A", "P2", selectedMeasurePoint === "p2");
        ctx.save();
        ctx.strokeStyle = "#D99B3A"; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y); ctx.stroke();
        ctx.setLineDash([]);
        const dx=p2.x-p1.x, dy=p2.y-p1.y, dist=Math.sqrt(dx*dx+dy*dy);
        const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2-14;
        const k = calib?.k || null;
        const label = k ? `${(dist/k).toFixed(4)} mm` : `${dist.toFixed(1)} px`;
        ctx.fillStyle = "#0B0C0E"; ctx.fillRect(mx-40,my-14,80,18);
        ctx.strokeStyle = "#D99B3A"; ctx.lineWidth = 0.5; ctx.strokeRect(mx-40,my-14,80,18);
        ctx.fillStyle = "#D99B3A"; ctx.font = "bold 11px 'JetBrains Mono',monospace";
        ctx.textAlign = "center"; ctx.fillText(label,mx,my-1); ctx.textAlign = "left";
        ctx.restore();
      } else {
        const m = mouseRef.current;
        ctx.save(); ctx.strokeStyle = "#D99B3A88"; ctx.lineWidth = 1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(m.x,m.y); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
    }

    // Tangentes (lignes live envoyées par le backend pendant la session)
    const hasTangentLines = Object.values(tangent?.lines || {}).some(v => v != null);
    const hasTangentCenters = Array.isArray(tangent?.centers) && tangent.centers.length >= 2;
    const showTangents = tangent?.active || (hasTangentLines && !hasTangentCenters);
    if (showTangents) {
      const tlines = tangent.lines || {};
      const colMap = { top:"#5BBFD6", bottom:"#1A4F60", left:"#F0B84A", right:"#7A5318" };
      Object.entries(tlines).forEach(([side,pos]) => {
        if (pos == null) return;
        ctx.save(); ctx.strokeStyle = colMap[side]; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85;
        if (side==="top"||side==="bottom") { ctx.beginPath(); ctx.moveTo(0,pos); ctx.lineTo(W,pos); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(pos,0); ctx.lineTo(pos,H); ctx.stroke(); }
        ctx.restore();
      });
      const { top, bottom, left, right } = tlines;
      if (top!=null && bottom!=null && left!=null && right!=null) {
        ctx.save(); ctx.strokeStyle = "#F0B84A"; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.7;
        ctx.strokeRect(left,top,right-left,bottom-top);
        const ccx=(left+right)/2, ccy=(top+bottom)/2;
        ctx.fillStyle = "#F0B84A"; ctx.beginPath(); ctx.arc(ccx,ccy,3,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(ccx-10,ccy); ctx.lineTo(ccx+10,ccy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ccx,ccy-10); ctx.lineTo(ccx,ccy+10); ctx.stroke();
        ctx.globalAlpha = 1;
        const wPx=right-left, hPx=bottom-top, k=calib?.k||null;
        const wLbl = k ? `${(wPx/k).toFixed(3)}mm` : `${wPx.toFixed(0)}px`;
        const hLbl = k ? `${(hPx/k).toFixed(3)}mm` : `${hPx.toFixed(0)}px`;
        ctx.fillStyle = "#F0B84A"; ctx.font = "10px 'JetBrains Mono',monospace";
        ctx.textAlign = "center"; ctx.fillText(`${wLbl} × ${hLbl}`,ccx,top-6);
        ctx.textAlign = "left"; ctx.restore();
      }
    }
    if (tangent?.centers?.length) {
      tangent.centers.forEach((ct, idx) => {
        const color = idx === 0 ? "#5BBFD6" : "#F0B84A";
        const px = ct.center_px.x;
        const py = ct.center_px.y;
        ctx.save();
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
        ctx.font = "12px 'JetBrains Mono',monospace";
        ctx.fillText(idx === 0 ? "A" : "B", px + 8, py + 4);
        ctx.restore();
      });
      if (tangent.centers.length >= 2) {
        const a = tangent.centers[0].center_px;
        const b = tangent.centers[1].center_px;
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    frameRef.current = requestAnimationFrame(drawOverlay);
  }, [reticle, calib, tangent, p1, p2]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(drawOverlay);
    return () => cancelAnimationFrame(frameRef.current);
  }, [drawOverlay]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    mouseRef.current = { x, y };
    onMouseMove?.(x, y);
  };
  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    onClick?.(e.clientX - rect.left, e.clientY - rect.top);
  };

  return (
    <div style={{ position:"relative", width:"100%", height:"100%", background:"#000" }}>
      {camOk ? (
        <img
          ref={imgRef}
          src={imgKey}
          alt="Flux caméra"
          style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", userSelect:"none" }}
          draggable={false}
        />
      ) : (
        <div style={{
          width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center",
          color: C.textMuted, fontFamily:"'JetBrains Mono',monospace", fontSize:13, flexDirection:"column", gap:8,
        }}>
          <div style={{ fontSize:28 }}>⬡</div>
          <div>Caméra non détectée</div>
          <div style={{ fontSize:11, color: C.textMuted }}>Vérifiez le branchement USB</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove} onClick={handleClick}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", cursor:"crosshair" }}
      />
    </div>
  );
};

// ─── CALIBRATION MODAL ────────────────────────────────────────────────────────
// Flux réel : l'utilisateur pose P1 puis P2 sur la mire affichée à l'écran
// (distance mesurée en direct sur le flux vidéo), puis entre la longueur réelle
// connue de la mire. Le backend calcule K = distance_px / longueur_mm.
const CalibModal = ({ onClose, onSaved, reticle, calib, tangent, camOk, C }) => {
  const [mode, setMode] = useState(null);
  const [subStep, setSubStep] = useState("mode");
  const [sessionActive, setSessionActive] = useState(false);
  const [selZoom, setSelZoom] = useState(null);
  const [customZoom, setCustomZoom] = useState("");
  const [refVal, setRefVal] = useState("");
  const [calP1, setCalP1] = useState(null);
  const [calP2, setCalP2] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const overlay={position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(2px)"};
  const modal={background:C.panel,border:`1px solid ${C.borderHi}`,borderRadius:8,
    padding:28,width:520,fontFamily:"'Inter',sans-serif",boxShadow:"0 8px 40px rgba(0,0,0,0.3)"};
  const title={fontSize:15,fontWeight:600,color:C.text,marginBottom:18,
    borderBottom:`1px solid ${C.border}`,paddingBottom:12,letterSpacing:"0.02em"};

  const distPx = (calP1 && calP2)
    ? Math.sqrt((calP2.x-calP1.x)**2 + (calP2.y-calP1.y)**2)
    : null;

  const handleVideoClick = (x, y) => {
    if (!calP1) setCalP1({ x, y });
    else if (!calP2) setCalP2({ x, y });
    else { setCalP1({ x, y }); setCalP2(null); }
  };

  const startSession = async () => {
    if (!mode) return;
    setSaving(true); setError(null);
    try {
      const status = await api.startCalibrationSession(parseInt(mode, 10));
      setSessionActive(status.calibration_session?.active ?? true);
      onSaved(status);
      setSubStep("zoom");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const zoomValue = selZoom ?? parseFloat(customZoom);
    if (!zoomValue || !distPx || !refVal || zoomValue <= 0 || zoomValue > 52.6) return;
    setSaving(true); setError(null);
    try {
      const status = await api.saveCalibration(zoomValue, parseFloat(refVal), distPx);
      onSaved(status);
      if (status.calibration_session?.active) {
        setSessionActive(true);
        setSelZoom(null);
        setCustomZoom("");
        setCalP1(null);
        setCalP2(null);
        setRefVal("");
        setSubStep("zoom");
      } else {
        setSessionActive(false);
        onClose();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (subStep==="mode") return (
    <div style={overlay}><div style={modal}>
      <div style={title}>Mode de calibration</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        {[["2","Linéaire","K(z) = a·z + b","2 zooms requis"],
          ["4","Quadratique","K(z) = a·z² + b·z + c","4 zooms requis"]].map(([m,lbl,eq,sub])=>(
          <div key={m} onClick={()=>setMode(m)} style={{
            padding:16,border:`1px solid ${mode===m?C.amber:C.border}`,borderRadius:6,
            cursor:"pointer",background:mode===m?C.amberDim:C.card,transition:"all 0.15s"}}>
            <div style={{fontSize:18,fontWeight:700,color:mode===m?C.amberGlow:C.text,fontFamily:"'JetBrains Mono',monospace"}}>{m}</div>
            <div style={{fontSize:13,fontWeight:500,color:mode===m?C.amberGlow:C.text,marginTop:4}}>{lbl}</div>
            <div style={{fontSize:10,color:C.textDim,marginTop:4,fontFamily:"'JetBrains Mono',monospace"}}>{eq}</div>
            <div style={{fontSize:10,color:C.textMuted,marginTop:2}}>{sub}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16,lineHeight:1.5}}>
        Astuce : choisissez une session de {mode || "2 ou 4"} points, puis répétez
        les calibrations sur plusieurs zooms jusqu'à atteinte de {mode || "2/4"} points.
        Les graduations du réticule sont aussi calibrées par K(z) et aident à positionner précisément P1/P2.
        Le système calcule ensuite automatiquement K(z) pour les autres zooms.
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn C={C} onClick={onClose}>Annuler</Btn>
        <Btn C={C} accent disabled={!mode} onClick={startSession}>Continuer →</Btn>
      </div>
    </div></div>
  );

  if (subStep==="zoom") return (
    <div style={overlay}><div style={modal}>
      <div style={{...title,display:"flex",alignItems:"center",gap:10}}>
        Sélectionnez le zoom <Badge C={C} color={C.teal}>Mode {mode} pts</Badge>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
        {ZOOM_LEVELS.map(z=>(
          <button key={z} onClick={()=>{ setSelZoom(z); setCustomZoom(""); }} style={{
            padding:"12px 8px",border:`1px solid ${selZoom===z?C.amber:C.border}`,
            borderRadius:5,background:selZoom===z?C.amberDim:C.card,
            color:selZoom===z?C.amberGlow:C.text,cursor:"pointer",
            fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:600}}>
            {z}×
          </button>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <input value={customZoom} onChange={e=>{ setCustomZoom(e.target.value); setSelZoom(null); }}
          placeholder="Zoom personnalisé"
          style={{flex:1,padding:"10px 12px",background:C.card,border:`1px solid ${C.border}`,
            borderRadius:5,color:C.text,fontFamily:"'JetBrains Mono',monospace",fontSize:14,outline:"none"}}/>
        <span style={{fontSize:13,color:C.textDim}}>&times;</span>
      </div>
      {customZoom && (parseFloat(customZoom) <= 0 || parseFloat(customZoom) > 52.6) && (
        <div style={{fontSize:11,color:C.red,marginBottom:14}}>
          Zoom personnalisé invalide : valeur entre 0 et 52.6.
        </div>
      )}
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>
        Réglez physiquement le zoom de la caméra sur cette valeur avant de continuer.
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn C={C} onClick={()=>setSubStep("mode")}>← Retour</Btn>
        <Btn C={C} accent disabled={!selZoom && !customZoom} onClick={()=>setSubStep("points")}>Placer P1/P2 →</Btn>
      </div>
    </div></div>
  );

  if (subStep==="points") return (
    <div style={overlay}><div style={modal}>
      <div style={title}>Placez P1 puis P2 sur la mire — zoom {selZoom}×</div>
      <div style={{
        width:"100%", height:280, background:"#000", borderRadius:6, overflow:"hidden",
        marginBottom:14, border:`1px solid ${C.border}`, position:"relative",
      }}>
        <VideoCanvas
          reticle={reticle} calib={calib} tangent={{active:false}}
          p1={calP1} p2={calP2} camOk={camOk} C={C}
          onClick={handleVideoClick} onMouseMove={()=>{}}
        />
      </div>
      <div style={{ fontSize:12, color:C.textDim, marginBottom:14, display:"flex", justifyContent:"space-between" }}>
        <span>Cliquez les deux extrémités connues de la mire</span>
        <span className="mono" style={{ color: distPx ? C.amber : C.textMuted }}>
          {distPx ? `${distPx.toFixed(1)} px` : "—"}
        </span>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn C={C} small onClick={()=>{setCalP1(null);setCalP2(null);}}>Reset points</Btn>
        <Btn C={C} onClick={()=>setSubStep("zoom")}>← Retour</Btn>
        <Btn C={C} accent disabled={!distPx} onClick={()=>setSubStep("value")}>Continuer →</Btn>
      </div>
    </div></div>
  );

  if (subStep==="value") return (
    <div style={overlay}><div style={modal}>
      <div style={title}>Longueur réelle de la mire — zoom {selZoom ?? customZoom}×</div>
      <div style={{color:C.textDim,fontSize:12,marginBottom:14}}>
        Distance mesurée : <span className="mono" style={{color:C.amber}}>{distPx.toFixed(1)} px</span>
      </div>
      <div style={{marginBottom:16}}>
        <label style={{fontSize:11,color:C.textMuted,display:"block",marginBottom:6,
          textTransform:"uppercase",letterSpacing:"0.08em"}}>Longueur réelle (mm)</label>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input value={refVal} onChange={e=>setRefVal(e.target.value)} placeholder="10.000"
            autoFocus
            style={{flex:1,padding:"8px 12px",background:C.card,border:`1px solid ${C.amber}`,
              borderRadius:4,color:C.text,fontFamily:"'JetBrains Mono',monospace",fontSize:16,outline:"none"}}/>
          <span style={{color:C.textDim,fontFamily:"'JetBrains Mono',monospace"}}>mm</span>
        </div>
        {refVal && parseFloat(refVal) > 0 && (
          <div style={{marginTop:10,padding:"8px 12px",background:C.greenDim,
            border:`1px solid ${C.green}44`,borderRadius:4}}>
            <span style={{fontSize:11,color:C.textMuted}}>K calculé → </span>
            <span className="mono" style={{color:C.green,fontWeight:600}}>
              {(distPx/parseFloat(refVal)).toFixed(6)} px/mm
            </span>
          </div>
        )}
        {error && (
          <div style={{marginTop:10,padding:"8px 12px",background:C.redDim,
            border:`1px solid ${C.red}44`,borderRadius:4,color:C.red,fontSize:11}}>
            {error}
          </div>
        )}
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <Btn C={C} onClick={()=>setSubStep("points")}>← Retour</Btn>
        <Btn C={C} accent disabled={!refVal || parseFloat(refVal)<=0 || saving} onClick={handleSave}>
          {saving ? "Sauvegarde…" : "Valider calibration"}
        </Btn>
      </div>
    </div></div>
  );
  return null;
};

// ─── HISTORY PANEL ────────────────────────────────────────────────────────────
const HistoryPanel = ({ onClose, C }) => {
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMeasurements().then(d => { setMeasurements(d.measurements); setLoading(false); });
  }, []);

  const handleExport = () => { window.open(api.exportUrl(), "_blank"); };
  const handleClear = async () => {
    if (!confirm("Vider tout l'historique des mesures ?")) return;
    await api.clearMeasurements();
    setMeasurements([]);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(2px)"}}>
      <div style={{background:C.panel,border:`1px solid ${C.borderHi}`,borderRadius:8,
        width:700,maxHeight:"75vh",display:"flex",flexDirection:"column",
        boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontWeight:600,color:C.text}}>Historique des mesures</span>
          <Badge C={C} color={C.teal}>{measurements.length} entrées</Badge>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {loading ? (
            <div style={{padding:30,textAlign:"center",color:C.textMuted}}>Chargement…</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:C.card}}>
                  {["Horodatage","Zoom","K (px/mm)","Distance px","Distance mm","Distance µm"].map(h=>(
                    <th key={h} style={{padding:"7px 12px",textAlign:"left",fontSize:10,
                      color:C.textMuted,letterSpacing:"0.08em",textTransform:"uppercase",
                      borderBottom:`1px solid ${C.border}`,fontWeight:500}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...measurements].reverse().map((m,i)=>(
                  <tr key={m.id} style={{background:i%2===0?C.panel:C.card}}>
                    <td style={{padding:"7px 12px",fontSize:11,color:C.textDim,fontFamily:"'JetBrains Mono',monospace"}}>{m.timestamp}</td>
                    <td className="mono" style={{padding:"7px 12px",color:C.text}}>{m.zoom}×</td>
                    <td className="mono" style={{padding:"7px 12px",color:C.textDim}}>{m.k_factor.toFixed(4)}</td>
                    <td className="mono" style={{padding:"7px 12px",color:C.text}}>{m.distance_px.toFixed(1)}</td>
                    <td className="mono" style={{padding:"7px 12px",color:C.amber,fontWeight:600}}>{m.distance_mm.toFixed(5)}</td>
                    <td className="mono" style={{padding:"7px 12px",color:C.teal}}>{m.distance_um.toFixed(1)}</td>
                  </tr>
                ))}
                {measurements.length===0 && (
                  <tr><td colSpan={6} style={{padding:24,textAlign:"center",color:C.textMuted}}>Aucune mesure</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn C={C} danger small onClick={handleClear} disabled={measurements.length===0}>Vider</Btn>
          <Btn C={C} icon="⬇" onClick={handleExport} disabled={measurements.length===0}>Export CSV</Btn>
          <Btn C={C} accent onClick={onClose}>Fermer</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── MODEL PANEL ─────────────────────────────────────────────────────────────
const ModelPanel = ({ model, calibrations, onClose, C }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(2px)"}}>
    <div style={{background:C.panel,border:`1px solid ${C.borderHi}`,borderRadius:8,
      width:560,boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontWeight:600,color:C.text}}>Modèle de calibration</span>
        {model && <Badge C={C} color={C.green}>Actif — {model.mode === "quadratic" ? "quadratique" : "linéaire"}</Badge>}
      </div>
      <div style={{padding:20}}>
        {model ? (
          <>
            <div style={{padding:14,background:C.card,borderRadius:6,marginBottom:14,border:`1px solid ${C.border}`}}>
              <div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Équation</div>
              <div className="mono" style={{fontSize:14,color:C.amberGlow,fontWeight:500}}>{model.equation}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{padding:12,background:C.card,borderRadius:5,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>R²</div>
                <div className="mono" style={{fontSize:16,fontWeight:600,color:model.r_squared>0.999?C.green:C.amber}}>
                  {model.r_squared.toFixed(10)}
                </div>
              </div>
              <div style={{padding:12,background:C.card,borderRadius:5,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Points</div>
                <div className="mono" style={{fontSize:16,fontWeight:600,color:C.teal}}>{model.cal_points.length}</div>
              </div>
            </div>
            {model.cal_points.map(([z,k],i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:12,
                padding:"7px 12px",background:i%2===0?C.card:C.panel,borderRadius:4,marginBottom:3}}>
                <Dot C={C} active color={C.teal}/>
                <span className="mono" style={{color:C.teal,width:50}}>{z}×</span>
                <span className="mono" style={{color:C.amber,flex:1}}>{k.toFixed(8)} px/mm</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{padding:20,textAlign:"center",color:C.textMuted}}>
            <div style={{fontSize:24,marginBottom:10}}>◌</div>
            <div>Aucun modèle actif. {Object.keys(calibrations||{}).length}/2 calibrations enregistrées.</div>
            <div style={{fontSize:11,marginTop:6}}>Lancez une 2e calibration sur un autre zoom [C].</div>
          </div>
        )}
        <div style={{marginTop:16,fontSize:10,color:C.textMuted}}>
          K(z) est calculé automatiquement pour tout zoom sans recalibration, et les graduations du réticule sont ajustées en conséquence.
        </div>
      </div>
      <div style={{padding:"12px 20px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
        <Btn C={C} accent onClick={onClose}>Fermer</Btn>
      </div>
    </div>
  </div>
);

// ─── RETICLE SELECTOR ────────────────────────────────────────────────────────
const ReticleSelector = ({ current, onChange, onClose, C }) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",
    alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(2px)"}}>
    <div style={{background:C.panel,border:`1px solid ${C.borderHi}`,borderRadius:8,width:480,
      boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
      <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontWeight:600,color:C.text}}>Réticule de visée</span>
      </div>
      <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {RETICLE_TYPES.map(r=>(
          <button key={r} onClick={()=>{onChange(r);onClose();}} style={{
            padding:"10px 14px",textAlign:"left",
            border:`1px solid ${current===r?C.teal:C.border}`,
            borderRadius:5,background:current===r?C.tealDim:C.card,
            color:current===r?C.tealLight:C.text,cursor:"pointer",
            fontFamily:"'Inter',sans-serif",fontSize:12,fontWeight:current===r?500:400}}>
            {r}
          </button>
        ))}
      </div>
      <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
        <Btn C={C} onClick={onClose}>Fermer</Btn>
      </div>
    </div>
  </div>
);

// ─── ZOOM SELECTOR ────────────────────────────────────────────────────────────
const ZoomSelector = ({ current, onSelect, onClose, C }) => {
  const [custom, setCustom] = useState("");
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",
      alignItems:"center",justifyContent:"center",zIndex:100,backdropFilter:"blur(2px)"}}>
      <div style={{background:C.panel,border:`1px solid ${C.borderHi}`,borderRadius:8,width:360,
        boxShadow:"0 8px 40px rgba(0,0,0,0.3)"}}>
        <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontWeight:600,color:C.text}}>Sélection du zoom</span>
        </div>
        <div style={{padding:16,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
          {ZOOM_LEVELS.map(z=>(
            <button key={z} onClick={()=>{onSelect(z);onClose();}} style={{
              padding:"11px 8px",border:`1px solid ${current===z?C.amber:C.border}`,
              borderRadius:5,background:current===z?C.amberDim:C.card,
              color:current===z?C.amberGlow:C.text,cursor:"pointer",
              fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:600}}>
              {z}×
            </button>
          ))}
        </div>
        <div style={{padding:"0 16px 16px"}}>
          <div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>
            Valeur personnalisée
          </div>
          <div style={{display:"flex",gap:8}}>
            <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="ex: 25.0"
              style={{flex:1,padding:"7px 10px",background:C.card,border:`1px solid ${C.border}`,
                borderRadius:4,color:C.text,fontFamily:"'JetBrains Mono',monospace",fontSize:13,outline:"none"}}/>
            <Btn C={C} accent small onClick={()=>{if(custom){onSelect(parseFloat(custom));onClose();}}}>OK</Btn>
          </div>
        </div>
        <div style={{padding:"10px 16px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"flex-end"}}>
          <Btn C={C} onClick={onClose}>Annuler</Btn>
        </div>
      </div>
    </div>
  );
};

// ─── CLOCK ───────────────────────────────────────────────────────────────────
function ClockDisplay({ C }) {
  const [t, setT] = useState(new Date());
  useEffect(()=>{ const id=setInterval(()=>setT(new Date()),1000); return ()=>clearInterval(id); },[]);
  return <span className="mono" style={{fontSize:11,color:C.textDim}}>{t.toTimeString().slice(0,8)}</span>;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function KLGMetrology() {
  const [dark, setDark] = useState(true);
  const C = dark ? DARK : LIGHT;

  const [status, setStatus] = useState(null);     // dernier statut connu du backend
  const [statusMsg, setStatusMsg] = useState({ text: "Connexion au backend…", color: null });
  const [modal, setModal] = useState(null);
  const [rightTab, setRightTab] = useState("measure");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [selectedTangentSide, setSelectedTangentSide] = useState("top");
  const [selectedMeasurePoint, setSelectedMeasurePoint] = useState("p1");
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [recentMeasurements, setRecentMeasurements] = useState([]);
  const [connError, setConnError] = useState(false);

  const pollRef = useRef(null);

  const applyStatus = (data) => {
    setStatus(data);
    setConnError(false);
    if (data.message) setStatusMsg({ text: data.message, color: C[data.message_color] || data.message_color || C.textDim });
  };

  const refreshStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      applyStatus(data);
    } catch (e) {
      setConnError(true);
      setStatusMsg({ text: "Backend inaccessible — vérifiez que server.py tourne sur :8000", color: C.red });
    }
  }, [C]);

  // Poll régulier du statut (caméra connectée, fps, mesure en cours, etc.)
  useEffect(() => {
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, 1000);
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.getMeasurements().then(d => setRecentMeasurements(d.measurements)).catch(() => {});
  }, [status?.measurement_count]);

  const zoom = status?.zoom ?? ZOOM_LEVELS[2];
  const reticle = status?.reticle ?? "Croix";
  const currentK = status?.k_factor ?? null;
  const calibValid = !!currentK;
  const kComputed = !!status?.k_is_computed;
  const camOk = !!status?.camera_connected;
  const fps = status?.fps ?? 0;
  const p1 = status?.p1 ?? null;
  const p2 = status?.p2 ?? null;
  const tangent = status?.tangent ?? { active: false, lines: {} };
  const model = status?.model ?? null;
  const calibrations = status?.calibrations ?? {};
  const measurements = recentMeasurements;
  const lastMeas = measurements[measurements.length - 1];

  const startTangent = async () => {
    const data = await api.tangentStart();
    applyStatus(data);
    setRightTab("tangent");
  };
  const cancelTangent = async () => applyStatus(await api.tangentCancel());
  const resetMeasure = async () => applyStatus(await api.measureReset());

  const handleVideoClick = async (x, y) => {
    if (connError) return;
    try {
      if (tangent.active) {
        const data = await api.measureClick(x, y);
        applyStatus(data);
        return;
      }

      if (!currentK) {
        setStatusMsg({ text: "Calibration requise — [C]", color: C.red });
        return;
      }

      if (p1 == null || p2 == null) {
        const data = await api.measureClick(x, y);
        applyStatus(data);
        return;
      }

      setStatusMsg({ text: "P1 et P2 sont déjà posés. Utilisez 1/2 puis flèches pour ajuster.", color: C.amber });
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  const handleZoomChange = async (z) => {
    const data = await api.setZoom(z);
    applyStatus(data);
  };

  const handleReticleChange = async (r) => {
    const data = await api.setReticle(r);
    applyStatus(data);
  };

  const setMeasurePoint = async (point, x, y) => {
    if (!point || !["p1","p2"].includes(point)) return;
    try {
      const data = await api.measureSetPoint(point, x, y);
      applyStatus(data);
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  const moveSelectedMeasurePoint = async (dx, dy) => {
    const point = selectedMeasurePoint;
    const current = point === "p1" ? p1 : p2;
    if (!current) return;
    await setMeasurePoint(point, current.x + dx, current.y + dy);
  };

  const handleCalibSaved = (data) => applyStatus(data);

  const calibrationSession = status?.calibration_session ?? { active: false, mode: null, done: 0, target: 0, remaining: 0, points: [] };
  const tangentSides = ["top","bottom","left","right"];
  const tangentDone = Object.values(tangent.lines || {}).filter(v => v != null).length;
  const { top, bottom, left, right } = tangent.lines || {};
  const tangentCX = (left!=null && right!=null) ? ((left+right)/2).toFixed(1) : null;
  const tangentCY = (top!=null && bottom!=null) ? ((top+bottom)/2).toFixed(1) : null;
  const tangentW = (left!=null && right!=null) ? (right-left) : null;
  const tangentH = (top!=null && bottom!=null) ? (bottom-top) : null;
  const tangentState = tangent?.state || "idle";
  const tangentCenters = tangent?.centers || [];
  const centerA = tangentCenters[0] || null;
  const centerB = tangentCenters[1] || null;
  const hasBothCenters = !!(centerA && centerB);
  const tangentDistance = tangent?.distance || null;

  useEffect(() => {
    if (p1 && p2) {
      if (!["p1","p2"].includes(selectedMeasurePoint)) setSelectedMeasurePoint("p1");
    } else if (p1) {
      setSelectedMeasurePoint("p1");
    } else if (p2) {
      setSelectedMeasurePoint("p2");
    }
  }, [p1, p2]);

  const startCalibrationSession = async (mode) => {
    try {
      const data = await api.startCalibrationSession(mode);
      applyStatus(data);
      setRightTab("calib");
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  const continueTangentB = async () => {
    try {
      const data = await api.tangentNext();
      applyStatus(data);
      setRightTab("tangent");
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  const saveTangentSession = async () => {
    try {
      const data = await api.tangentSave();
      applyStatus(data);
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  const adjustTangentSide = async (side, delta) => {
    if (!side || tangent.lines?.[side] == null) return;
    try {
      const data = await api.tangentAdjust(side, delta);
      applyStatus(data);
    } catch (e) {
      setStatusMsg({ text: e.message, color: C.red });
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const key = e.key;
      const keyUpper = key.toUpperCase();
      if (keyUpper === "C" && !modal) setModal("calib");
      if (keyUpper === "Z" && !modal) setModal("zoom");
      if (keyUpper === "G" && !modal) setModal("reticle");
      if (keyUpper === "H" && !modal) setModal("history");
      if (keyUpper === "I" && !modal) setModal("model");
      if (keyUpper === "T" && !modal) (tangent.active ? cancelTangent() : startTangent());
      if (keyUpper === "R" && !modal) resetMeasure();
      if (keyUpper === "ESCAPE") { if (modal) setModal(null); else if (tangent.active) cancelTangent(); else resetMeasure(); }
      if (!modal && !tangent.active) {
        if (keyUpper === "1" && p1) setSelectedMeasurePoint("p1");
        if (keyUpper === "2" && p2) setSelectedMeasurePoint("p2");
        if ((key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") && (p1 || p2)) {
          e.preventDefault();
          const step = e.shiftKey ? 1 : 5;
          if (key === "ArrowUp") moveSelectedMeasurePoint(0, -step);
          if (key === "ArrowDown") moveSelectedMeasurePoint(0, step);
          if (key === "ArrowLeft") moveSelectedMeasurePoint(-step, 0);
          if (key === "ArrowRight") moveSelectedMeasurePoint(step, 0);
          return;
        }
      }
      if (!modal && !tangent.active && tangentDone === 4) {
        const side = selectedTangentSide;
        if (side === "top" || side === "bottom") {
          if (key === "ArrowUp") adjustTangentSide(side, -1);
          if (key === "ArrowDown") adjustTangentSide(side, 1);
        }
        if (side === "left" || side === "right") {
          if (key === "ArrowLeft") adjustTangentSide(side, -1);
          if (key === "ArrowRight") adjustTangentSide(side, 1);
        }
      }
      if (keyUpper === " " && !modal) {
        e.preventDefault();
        const idx = RETICLE_TYPES.indexOf(reticle);
        handleReticleChange(RETICLE_TYPES[(idx + 1) % RETICLE_TYPES.length]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, tangent.active, reticle, tangentDone, selectedTangentSide, selectedMeasurePoint, p1, p2]);

  const statusColor = statusMsg.color || C.textDim;

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,overflow:"hidden"}}>
      <GlobalStyle C={C}/>

      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",height:44,background:C.panel,
        borderBottom:`1px solid ${C.border}`,padding:"0 12px",gap:0,flexShrink:0,
        boxShadow: dark?"none":"0 1px 4px rgba(0,0,0,0.08)"}}>

        <div style={{display:"flex",alignItems:"center",gap:8,paddingRight:14,
          borderRight:`1px solid ${C.border}`,marginRight:12}}>
          <div style={{width:26,height:26,background:C.amberDim,border:`1.5px solid ${C.amber}`,
            borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:C.amber,fontFamily:"'JetBrains Mono',monospace"}}>KL</span>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:C.text,letterSpacing:"0.06em"}}>KLG METROLOGY</div>
            <div style={{fontSize:9,color:C.textMuted,fontFamily:"'JetBrains Mono',monospace"}}>WEB v13.0.0</div>
          </div>
        </div>

        <Seg C={C} label="cam" value={camOk?"LIVE":"OFF"} color={camOk?C.green:C.red}/>
        <Divider C={C} v/>
        <Seg C={C} label="fps" value={fps?fps.toFixed(0):null} color={fps>20?C.green:fps>10?C.amber:C.red}/>
        <Divider C={C} v/>
        <Seg C={C} label="zoom" value={zoom+"×"} color={C.amber}/>
        <Divider C={C} v/>
        <Seg C={C} label="k (px/mm)" value={currentK?currentK.toFixed(6):null}
          color={kComputed?C.amber:C.tealLight} wide/>
        {kComputed && currentK && <Badge C={C} color={C.amber}>interpolé</Badge>}
        <Divider C={C} v/>
        <Seg C={C} label="calib" value={calibValid?"OK":"NON"} color={calibValid?C.green:C.red}/>
        <Divider C={C} v/>
        {lastMeas && p2 && (<>
          <Seg C={C} label="dist mm" value={lastMeas.distance_mm.toFixed(5)} color={C.amberGlow} wide/>
          <Divider C={C} v/>
          <Seg C={C} label="dist µm" value={lastMeas.distance_um.toFixed(1)} color={C.tealLight}/>
          <Divider C={C} v/>
        </>)}
        <Seg C={C} label="réticule" value={reticle} color={C.teal}/>
        <Divider C={C} v/>
        <Seg C={C} label="mesures" value={measurements.length} color={C.textDim}/>

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          {connError && <Badge C={C} color={C.red}>Backend hors-ligne</Badge>}
          <ThemeToggle dark={dark} onToggle={()=>setDark(d=>!d)} C={C}/>
          <Divider C={C} v/>
          <ClockDisplay C={C}/>
        </div>
      </div>

      {/* ── MAIN AREA ───────────────────────────────────────────────────── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── VIDEO ─────────────────────────────────────────────────────── */}
        <div style={{flex:1,position:"relative",background:"#000",overflow:"hidden"}}>
          <VideoCanvas
            reticle={reticle} calib={currentK?{k:currentK}:null}
            tangent={tangent} p1={p1} p2={p2} selectedMeasurePoint={selectedMeasurePoint}
            camOk={camOk} C={C}
            onMouseMove={(x,y)=>setMouse({x,y})} onClick={handleVideoClick}/>

          {/* HUD bottom */}
          <div style={{position:"absolute",left:0,bottom:0,right:0,
            background:"linear-gradient(transparent,rgba(7,8,9,0.88))",
            padding:"20px 14px 10px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <div style={{fontSize:11,color:statusColor,fontFamily:"'JetBrains Mono',monospace",
                maxWidth:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                ⬡ {statusMsg.text}
              </div>
              {calibValid && (
                <div className="mono" style={{fontSize:10,color:"#5BBFD688"}}>
                  x: {(mouse.x/(currentK||1)*1000).toFixed(1)}µm &nbsp;
                  y: {(mouse.y/(currentK||1)*1000).toFixed(1)}µm
                </div>
              )}
            </div>
            <div style={{display:"flex",gap:6}}>
              {[["C","Calibrer","#D99B3A"],["Z","Zoom","#D99B3A"],["G","Réticule","#3A9CB5"],
                ["T",tangent.active?"Fin tang.":"Tangentes","#3A9CB5"],["R","Reset","#5A6080"]
              ].map(([k,lbl,col])=>(
                <div key={k} onClick={()=>{
                  if(k==="C") setModal("calib");
                  if(k==="Z") setModal("zoom");
                  if(k==="G") setModal("reticle");
                  if(k==="T") (tangent.active?cancelTangent():startTangent());
                  if(k==="R") resetMeasure();
                }} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 9px",
                  background:"rgba(10,11,14,0.75)",border:`1px solid ${col}55`,
                  borderRadius:4,cursor:"pointer"}}>
                  <span style={{width:16,height:16,background:col+"33",border:`1px solid ${col}`,
                    borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:9,fontFamily:"'JetBrains Mono',monospace",color:col,fontWeight:600}}>{k}</span>
                  <span style={{fontSize:10,color:col}}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {(tangent.active || tangentDone > 0) && (
            <div style={{position:"absolute",top:12,left:"50%",transform:"translateX(-50%)",
              background:`${C.panel}EE`,border:`1px solid ${C.teal}`,borderRadius:6,
              padding:"8px 16px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:11,color:C.teal,fontFamily:"'JetBrains Mono',monospace"}}>
                TANGENTES {tangentDone}/4
              </span>
              <div style={{display:"flex",gap:6}}>
                {tangentSides.map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:3}}>
                    <Dot C={C} active={tangent.lines?.[s]!=null} color={C.teal}/>
                    <span style={{fontSize:9,color:tangent.lines?.[s]!=null?C.tealLight:C.textMuted,
                      textTransform:"uppercase"}}>{s}</span>
                  </div>
                ))}
              </div>
              {tangent.active && tangentDone<4 && (
                <span style={{fontSize:11,color:C.amberGlow}}>
                  → {["HAUT","BAS","GAUCHE","DROITE"][tangentDone]}
                </span>
              )}
              {!tangent.active && tangentDone===4 && (
                <span style={{fontSize:11,color:C.green}}>✓ Complet</span>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ───────────────────────────────────────────────── */}
        {!panelCollapsed && (
          <div style={{width:280,background:C.panel,borderLeft:`1px solid ${C.border}`,
            display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0,
            boxShadow:dark?"none":"-2px 0 8px rgba(0,0,0,0.06)"}}>

            <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              {[["measure","Mesure"],["calib","Calibration"],["tangent","Tangentes"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setRightTab(id)} style={{
                  flex:1,padding:"9px 4px",border:"none",
                  borderBottom:`2px solid ${rightTab===id?C.amber:"transparent"}`,
                  background:"transparent",color:rightTab===id?C.amberGlow:C.textDim,
                  fontSize:10,fontWeight:rightTab===id?600:400,cursor:"pointer",
                  letterSpacing:"0.06em",textTransform:"uppercase",transition:"all 0.12s"}}>
                  {lbl}
                </button>
              ))}
            </div>

            {rightTab==="measure" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <SectionHeader C={C} label="Mesure active" action={resetMeasure} actionLabel="Reset"/>
                <div style={{padding:"4px 14px 12px"}}>
                  {[["P1",p1],["P2",p2]].map(([label,pt])=>(
                    <div key={label} style={{marginBottom:8,padding:10,background:C.card,
                      borderRadius:5,border:`1px solid ${pt?C.border:C.borderHi}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:pt?6:0}}>
                        <Dot C={C} active={!!pt} color={label==="P1"?C.tealLight:C.amber}/>
                        <span style={{fontSize:10,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</span>
                        {!pt && <span style={{fontSize:9,color:C.textMuted,marginLeft:"auto"}}>— non posé</span>}
                      </div>
                      {pt && (
                        <div className="mono" style={{fontSize:11,color:C.textDim,paddingLeft:14}}>
                          {pt.x.toFixed(1)}, {pt.y.toFixed(1)} px
                          {calibValid && <div style={{color:C.text}}>{(pt.x/currentK*1000).toFixed(1)}, {(pt.y/currentK*1000).toFixed(1)} µm</div>}
                        </div>
                      )}
                    </div>
                  ))}
                  {p1&&p2&&(()=>{
                    const dx=p2.x-p1.x,dy=p2.y-p1.y,dist=Math.sqrt(dx*dx+dy*dy);
                    const mm=currentK?dist/currentK:0,um=mm*1000;
                    return (
                      <>
                        <div style={{fontSize:10,color:C.textMuted,marginBottom:8,lineHeight:1.4}}
                          className="mono">
                          Touches 1/2 : sélectionner P1/P2 · Flèches : déplacer point actif de 0,2 px · Shift+flèches : déplacer de 2 px
                        </div>
                        <div style={{padding:12,background:C.amberDim,borderRadius:5,
                          border:`1px solid ${C.amber}66`,marginTop:4}}>
                          <div style={{fontSize:9,color:C.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.08em"}}>Résultat</div>
                          <div className="mono" style={{fontSize:18,fontWeight:600,color:C.amberGlow}}>
                            {mm.toFixed(5)}<span style={{fontSize:11,fontWeight:400,marginLeft:4}}>mm</span>
                          </div>
                          <div className="mono" style={{fontSize:13,color:C.tealLight,marginTop:2}}>{um.toFixed(2)} µm</div>
                          <div className="mono" style={{fontSize:10,color:C.textDim,marginTop:2}}>{dist.toFixed(2)} px</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <Divider C={C}/>
                <SectionHeader C={C} label="Historique session" action={()=>setModal("history")} actionLabel="Voir tout"/>
                <div style={{padding:"0 14px 14px"}}>
                  {measurements.slice(-4).reverse().map((m,i)=>(
                    <div key={m.id} style={{display:"flex",alignItems:"center",gap:8,
                      padding:"6px 8px",background:i===0?C.card:"transparent",
                      borderRadius:4,marginBottom:2}}>
                      <span style={{fontSize:9,color:C.textMuted,fontFamily:"'JetBrains Mono',monospace",minWidth:32}}>{m.zoom}×</span>
                      <span className="mono" style={{color:i===0?C.amber:C.textDim,fontSize:11,flex:1}}>
                        {m.distance_mm.toFixed(5)}<span style={{fontSize:9,color:C.textMuted}}> mm</span>
                      </span>
                      <span className="mono" style={{fontSize:9,color:C.textMuted}}>{m.distance_um.toFixed(0)}µm</span>
                    </div>
                  ))}
                  {measurements.length===0 && <div style={{fontSize:11,color:C.textMuted,textAlign:"center",padding:"12px 0"}}>Aucune mesure</div>}
                </div>
              </div>
            )}

            {rightTab==="calib" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <SectionHeader C={C} label="Modèle actif" action={()=>setModal("model")} actionLabel="Détails"/>
                <div style={{padding:"0 14px 12px"}}>
                  {model ? (
                    <div style={{padding:12,background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <Dot C={C} active color={C.green}/>
                        <Badge C={C} color={C.green}>{model.mode==="quadratic"?"quadratique":"linéaire"}</Badge>
                        <span className="mono" style={{fontSize:9,color:C.textDim,marginLeft:"auto"}}>R²={model.r_squared.toFixed(6)}</span>
                      </div>
                      <div className="mono" style={{fontSize:10,color:C.amberGlow,wordBreak:"break-all"}}>{model.equation}</div>
                    </div>
                  ) : (
                    <div style={{padding:12,background:C.card,borderRadius:5,border:`1px solid ${C.border}`,
                      textAlign:"center",color:C.textMuted,fontSize:11}}>Aucun modèle. Lancez [C].</div>
                  )}
                </div>
                <Divider C={C}/>
                <SectionHeader C={C} label="Calibrations enregistrées"/>
                <div style={{padding:"0 14px 14px"}}>
                  {Object.entries(calibrations).sort((a,b)=>parseFloat(a[0])-parseFloat(b[0])).map(([z,c])=>(
                    <div key={z} style={{padding:"8px 10px",background:C.card,borderRadius:4,marginBottom:5,
                      border:`1px solid ${String(zoom)===z?C.amber:C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                        <span className="mono" style={{fontSize:12,fontWeight:600,color:String(zoom)===z?C.amberGlow:C.text}}>{z}×</span>
                        {String(zoom)===z && <Badge C={C} color={C.amber}>actif</Badge>}
                      </div>
                      <div className="mono" style={{fontSize:10,color:C.tealLight}}>{c.k_factor.toFixed(8)} px/mm</div>
                      <div style={{fontSize:9,color:C.textMuted,marginTop:1}}>{c.date}</div>
                    </div>
                  ))}
                  {Object.keys(calibrations).length===0 && (
                    <div style={{textAlign:"center",color:C.textMuted,fontSize:11,padding:"12px 0"}}>Aucune calibration</div>
                  )}
                  <Btn C={C} accent onClick={()=>setModal("calib")}
                    style={{width:"100%",marginTop:8,justifyContent:"center"}} icon="⊕">
                    Nouvelle calibration
                  </Btn>
                </div>
                <Divider C={C}/>
                <SectionHeader C={C} label="Session calibration"/>
                <div style={{padding:"0 14px 14px"}}>
                  {calibrationSession.active ? (
                    <div style={{padding:12,background:C.tealDim,border:`1px solid ${C.teal}55`,borderRadius:5}}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>
                        Session {calibrationSession.mode} pts active — {calibrationSession.done}/{calibrationSession.target}
                      </div>
                      <div className="mono" style={{fontSize:13,color:C.tealLight}}>
                        {calibrationSession.remaining} mesure(s) restantes
                      </div>
                    </div>
                  ) : (
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <Btn C={C} small onClick={()=>startCalibrationSession(2)} style={{justifyContent:"center"}}>2 pts</Btn>
                      <Btn C={C} small onClick={()=>startCalibrationSession(4)} style={{justifyContent:"center"}}>4 pts</Btn>
                    </div>
                  )}
                </div>
                <Divider C={C}/>
                <SectionHeader C={C} label="Zoom actuel"/>
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                    {ZOOM_LEVELS.map(z=>(
                      <button key={z} onClick={()=>handleZoomChange(z)} style={{
                        padding:"7px 4px",border:`1px solid ${zoom===z?C.amber:C.border}`,
                        borderRadius:4,background:zoom===z?C.amberDim:C.card,
                        color:zoom===z?C.amberGlow:C.textDim,cursor:"pointer",
                        fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:zoom===z?600:400}}>
                        {z}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {rightTab==="tangent" && (
              <div style={{flex:1,overflowY:"auto"}}>
                <SectionHeader C={C} label="Détection tangentes"/>
                <div style={{padding:"0 14px 14px"}}>
                  <div style={{marginBottom:10}}>
                    {tangent.active ? (
                      <div style={{padding:10,background:C.tealDim,border:`1px solid ${C.teal}55`,borderRadius:5,marginBottom:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <Dot C={C} active color={C.teal}/>
                          <span style={{fontSize:11,color:C.tealLight,fontWeight:500}}>Session active — {tangentDone}/4</span>
                        </div>
                        {tangentDone<4 && (
                          <div style={{fontSize:11,color:C.amber}}>
                            → Cliquez <strong>{["HAUT","BAS","GAUCHE","DROITE"][tangentDone]}</strong>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Btn C={C} onClick={startTangent} style={{width:"100%",justifyContent:"center",marginBottom:8}} icon="◻">
                        Démarrer mesure tangentes
                      </Btn>
                    )}
                    {tangent.active && (
                      <Btn C={C} danger small onClick={cancelTangent} style={{width:"100%",justifyContent:"center"}}>Annuler</Btn>
                    )}
                  </div>
                  {centerA && !centerB && !tangent.active && (
                    <div style={{marginBottom:10,padding:10,background:C.amberDim,border:`1px solid ${C.amber}55`,borderRadius:5}}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>Centre A détecté</div>
                      <div className="mono" style={{fontSize:13,color:C.amberGlow}}>
                        {centerA.center_px.x.toFixed(1)} px, {centerA.center_px.y.toFixed(1)} px
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:8}}>
                        <Btn C={C} small onClick={continueTangentB} style={{flex:1,justifyContent:"center"}}>Centre B</Btn>
                        <Btn C={C} small onClick={saveTangentSession} style={{flex:1,justifyContent:"center"}}>Sauvegarder</Btn>
                      </div>
                    </div>
                  )}
                  {hasBothCenters && !tangent.active && (
                    <div style={{marginBottom:10,padding:10,background:C.greenDim,border:`1px solid ${C.green}55`,borderRadius:5}}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:8}}>Centres A et B détectés</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <div style={{padding:10,background:C.card,borderRadius:5}}>
                          <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>Centre A</div>
                          <div className="mono" style={{fontSize:12,color:C.amberGlow}}>{centerA.center_px.x.toFixed(1)} px</div>
                          <div className="mono" style={{fontSize:12,color:C.amberGlow}}>{centerA.center_px.y.toFixed(1)} px</div>
                        </div>
                        <div style={{padding:10,background:C.card,borderRadius:5}}>
                          <div style={{fontSize:9,color:C.textMuted,marginBottom:4}}>Centre B</div>
                          <div className="mono" style={{fontSize:12,color:C.tealLight}}>{centerB.center_px.x.toFixed(1)} px</div>
                          <div className="mono" style={{fontSize:12,color:C.tealLight}}>{centerB.center_px.y.toFixed(1)} px</div>
                        </div>
                      </div>
                      <div style={{marginTop:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                        <Btn C={C} small onClick={async ()=>{
                          if (tangentCX!=null && tangentCY!=null) {
                            const data = await api.measureSetPoint("p1", parseFloat(tangentCX), parseFloat(tangentCY));
                            applyStatus(data);
                          }
                        }} style={{flex:1,justifyContent:"center"}}>Centre → P1</Btn>
                        <Btn C={C} small onClick={async ()=>{
                          if (tangentCX!=null && tangentCY!=null) {
                            const data = await api.measureSetPoint("p2", parseFloat(tangentCX), parseFloat(tangentCY));
                            applyStatus(data);
                          }
                        }} style={{flex:1,justifyContent:"center"}}>Centre → P2</Btn>
                      </div>
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginBottom:10}}>
                    {tangentSides.map(side=>(
                      <button key={side} onClick={()=>setSelectedTangentSide(side)} style={{
                        display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,
                        padding:"8px 10px",border:`1px solid ${selectedTangentSide===side?C.amber:C.border}`,
                        borderRadius:5,background:selectedTangentSide===side?C.amberDim:C.card,
                        color:selectedTangentSide===side?C.amberGlow:C.text,cursor:"pointer",
                        fontSize:11,textTransform:"uppercase",letterSpacing:"0.06em"}}>
                        <span>{side}</span>
                        <span className="mono" style={{fontSize:10,color:selectedTangentSide===side?C.amberGlow:C.textDim}}>
                          {tangent.lines?.[side]!=null?`${tangent.lines[side].toFixed(1)} px`:"—"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{padding:"10px 12px",background:C.card,borderRadius:6,border:`1px solid ${C.border}`,marginBottom:10}}>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>Sélectionnez un côté puis utilisez les flèches clavier:</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                      <div style={{fontSize:11,color:C.text}}><strong>Haut/Bas</strong> = ↑ / ↓</div>
                      <div style={{fontSize:11,color:C.text}}><strong>Gauche/Droite</strong> = ← / →</div>
                    </div>
                  </div>
                  {tangentDone===4 && (
                    <div style={{marginTop:10,padding:12,background:C.amberDim,border:`1px solid ${C.amber}55`,borderRadius:5}}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}}>Résultats</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {[
                          ["Centre X",tangentCX?`${tangentCX} px`:null],
                          ["Centre Y",tangentCY?`${tangentCY} px`:null],
                          ["Largeur",tangentW?`${tangentW.toFixed(1)} px${calibValid?`\n${(tangentW/currentK).toFixed(4)} mm`:""}`:null],
                          ["Hauteur",tangentH?`${tangentH.toFixed(1)} px${calibValid?`\n${(tangentH/currentK).toFixed(4)} mm`:""}`:null],
                        ].map(([lbl,val])=>(
                          <div key={lbl} style={{padding:"6px 8px",background:C.card,borderRadius:4}}>
                            <div style={{fontSize:9,color:C.textMuted,marginBottom:3}}>{lbl}</div>
                            <div className="mono" style={{fontSize:11,color:C.amberGlow,whiteSpace:"pre-line"}}>{val||"—"}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                        <Btn C={C} small onClick={async ()=>{
                          if (tangentCX!=null && tangentCY!=null) {
                            const data = await api.measureSetPoint("p1", parseFloat(tangentCX), parseFloat(tangentCY));
                            applyStatus(data);
                          }
                        }} style={{flex:1,justifyContent:"center"}}>
                          Centre → P1
                        </Btn>
                        <Btn C={C} small onClick={async ()=>{
                          if (tangentCX!=null && tangentCY!=null) {
                            const data = await api.measureSetPoint("p2", parseFloat(tangentCX), parseFloat(tangentCY));
                            applyStatus(data);
                          }
                        }} style={{flex:1,justifyContent:"center"}}>
                          Centre → P2
                        </Btn>
                      </div>
                      {tangentDistance && (
                        <div style={{marginTop:10,padding:10,background:C.card,border:`1px solid ${C.border}`,borderRadius:6}}>
                          <div style={{fontSize:10,color:C.textMuted,marginBottom:6}}>Distance entre centres</div>
                          <div className="mono" style={{fontSize:13,color:C.tealLight}}>{tangentDistance.dist_mm.toFixed(5)} mm</div>
                          <div className="mono" style={{fontSize:11,color:C.textDim}}>{tangentDistance.dist_um.toFixed(1)} µm</div>
                        </div>
                      )}
                      <Btn C={C} small onClick={cancelTangent} style={{width:"100%",justifyContent:"center",marginTop:10}}>
                        Nouvelle mesure
                      </Btn>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{borderTop:`1px solid ${C.border}`,padding:"8px 12px",
              display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
              <Btn C={C} small icon="◎" onClick={()=>setModal("reticle")}>{reticle}</Btn>
              <Btn C={C} small onClick={()=>setModal("history")}>Historique</Btn>
              <Btn C={C} small onClick={()=>setModal("model")}>Modèle</Btn>
            </div>
          </div>
        )}

        <div onClick={()=>setPanelCollapsed(p=>!p)} style={{
          width:14,background:C.card,borderLeft:`1px solid ${C.border}`,
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
          <span style={{fontSize:10,color:C.textMuted,transform:`rotate(${panelCollapsed?"180":"0"}deg)`}}>◂</span>
        </div>
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {modal==="calib"   && <CalibModal C={C} reticle={reticle} calib={currentK?{k:currentK}:null} camOk={camOk}
                              onClose={()=>setModal(null)} onSaved={handleCalibSaved}/>}
      {modal==="history" && <HistoryPanel C={C} onClose={()=>setModal(null)}/>}
      {modal==="model"   && <ModelPanel C={C} model={model} calibrations={calibrations} onClose={()=>setModal(null)}/>}
      {modal==="reticle" && <ReticleSelector C={C} current={reticle} onChange={handleReticleChange} onClose={()=>setModal(null)}/>}
      {modal==="zoom"    && <ZoomSelector C={C} current={zoom} onSelect={handleZoomChange} onClose={()=>setModal(null)}/>}
    </div>
  );
}
