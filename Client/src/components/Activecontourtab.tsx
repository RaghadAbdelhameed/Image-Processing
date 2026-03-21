import { useState, useRef, useEffect } from "react";
import { Loader2, Play, RotateCcw, MousePointer2, Move } from "lucide-react";

const API = "http://localhost:8000";

interface ContourPoint { 0: number; 1: number; }

interface SnakeResult {
  result_image: string;
  initial_contour: ContourPoint[];
  final_contour: ContourPoint[];
}

interface Rect { x1: number; y1: number; x2: number; y2: number }

interface Props {
  imageId: string | null;
  imageUrl: string | null;
}

// ─── small slider ────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step, onChange, valueDisplay,
}: {
  label: string; value: number; min: number; max: number;
  step: number; onChange: (v: number) => void; valueDisplay?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="control-label">{label}</span>
        <span className="text-[10px] font-mono text-primary">
          {valueDisplay ?? value}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 accent-primary cursor-pointer"
      />
    </div>
  );
}

// ─── contour overlay canvas ──────────────────────────────────────────────────
function ContourOverlay({
  width, height, initial, final: finalC,
}: {
  width: number; height: number;
  initial: ContourPoint[]; final: ContourPoint[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    const draw = (pts: ContourPoint[], color: string, dash: number[]) => {
      if (!pts.length) return;
      ctx.beginPath();
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(p => ctx.lineTo(p[0], p[1]));
      ctx.closePath();
      ctx.stroke();
    };

    draw(initial, "rgba(239,68,68,0.7)", [4, 3]);
    draw(finalC,  "rgba(34,197,94,0.9)", []);
  }, [width, height, initial, finalC]);

  return (
    <canvas
      ref={ref} width={width} height={height}
      className="absolute inset-0 pointer-events-none"
    />
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function ActiveContourTab({ imageId, imageUrl }: Props) {
  const [result,    setResult]    = useState<SnakeResult | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [rect,      setRect]      = useState<Rect | null>(null);
  const [drawing,   setDrawing]   = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const previewRef  = useRef<HTMLDivElement>(null);
  const imgRef      = useRef<HTMLImageElement>(null);
  const [imgSize,   setImgSize]   = useState({ w: 0, h: 0 });
  const [dispSize,  setDispSize]  = useState({ w: 0, h: 0 });

  // reset when image changes
  useEffect(() => {
    setRect(null);
    setResult(null);
    setError(null);
  }, [imageId]);

  const [alpha,    setAlpha]    = useState(0.1);
  const [beta,     setBeta]     = useState(0.1);
  const [gamma,    setGamma]    = useState(1.0);
  const [maxIter,  setMaxIter]  = useState(300);
  const [adaptive, setAdaptive] = useState(true);

  // ── rect drawing ─────────────────────────────────────────────────────────
  const toNatural = (px: number, py: number) => {
    if (!dispSize.w || !imgSize.w) return { x: px, y: py };
    return {
      x: Math.round(px * imgSize.w / dispSize.w),
      y: Math.round(py * imgSize.h / dispSize.h),
    };
  };

  const getRelXY = (e: React.MouseEvent) => {
    const box = previewRef.current!.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return;
    e.preventDefault();
    setDragStart(getRelXY(e));
    setRect(null);
    setDrawing(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !dragStart) return;
    const p = getRelXY(e);
    setRect({
      x1: Math.min(dragStart.x, p.x), y1: Math.min(dragStart.y, p.y),
      x2: Math.max(dragStart.x, p.x), y2: Math.max(dragStart.y, p.y),
    });
  };

  const onMouseUp = () => { setDrawing(false); setDragStart(null); };

  const onImgLoad = () => {
    if (!imgRef.current) return;
    setImgSize({ w: imgRef.current.naturalWidth,  h: imgRef.current.naturalHeight });
    setDispSize({ w: imgRef.current.offsetWidth,  h: imgRef.current.offsetHeight });
  };

  // ── run snake ─────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!imageId || !rect) return;
    setLoading(true); setError(null); setResult(null);

    const n1 = toNatural(rect.x1, rect.y1);
    const n2 = toNatural(rect.x2, rect.y2);

    try {
      const res = await fetch(`${API}/apply_snake?image_id=${imageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          x1: n1.x, y1: n1.y, x2: n2.x, y2: n2.y,
          alpha, beta, gamma,
          max_iterations: maxIter,
          adaptive_weights: adaptive,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: SnakeResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const canRun = !!imageId && !!rect && !loading;

  const scaleContour = (pts: ContourPoint[]) =>
    pts.map(p => [
      p[0] * dispSize.w / imgSize.w,
      p[1] * dispSize.h / imgSize.h,
    ] as ContourPoint);

  return (
    <div className="flex gap-5 h-full">
      {/* ── LEFT COLUMN: controls ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 w-52 shrink-0">

        {!imageUrl && (
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
            <MousePointer2 size={11} className="mt-0.5 shrink-0 text-primary" />
            Upload an image using the panel on the right first
          </div>
        )}
        {imageUrl && !rect && (
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
            <MousePointer2 size={11} className="mt-0.5 shrink-0 text-primary" />
            Draw a rectangle around the object to initialise the contour
          </div>
        )}
        {rect && (
          <div className="flex items-start gap-1.5 text-[10px] text-green-500 leading-relaxed">
            <Move size={11} className="mt-0.5 shrink-0" />
            Region selected — adjust params then run
          </div>
        )}

        {/* params */}
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Parameters
          </span>
          <Slider label="α – Elasticity" value={alpha} min={0} max={1} step={0.01}
            onChange={setAlpha} valueDisplay={alpha.toFixed(2)} />
          <Slider label="β – Rigidity"   value={beta}  min={0} max={1} step={0.01}
            onChange={setBeta}  valueDisplay={beta.toFixed(2)} />
          <Slider label="γ – Edge pull"  value={gamma} min={0} max={2} step={0.05}
            onChange={setGamma} valueDisplay={gamma.toFixed(2)} />
          <Slider label="Max iterations" value={maxIter} min={50} max={600} step={50}
            onChange={setMaxIter} />

          <div className="flex items-center justify-between">
            <span className="control-label">Adaptive weights</span>
            <button
              onClick={() => setAdaptive(v => !v)}
              className={`w-8 h-4 rounded-full transition-colors ${
                adaptive ? "bg-primary" : "bg-muted"
              } relative`}
            >
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                adaptive ? "left-4.5" : "left-0.5"
              }`} />
            </button>
          </div>
        </div>

        {/* run / reset */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading
              ? <><Loader2 size={12} className="animate-spin" />Running…</>
              : <><Play size={12} />Run Snake</>}
          </button>
          <button
            onClick={() => { setRect(null); setResult(null); setError(null); }}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw size={11} />Reset
          </button>
        </div>

        {error && (
          <p className="text-[10px] text-red-400 leading-relaxed break-words">{error}</p>
        )}
      </div>

      {/* ── RIGHT COLUMN: image panels ────────────────────────────────── */}
      <div className="flex flex-1 gap-4 overflow-hidden">

        {/* Input + rectangle selector */}
        <div className="flex flex-col gap-2 flex-1">
          <span className="control-label">Select Region</span>
          <div
            ref={previewRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            className={`relative flex-1 image-display rounded-xl overflow-hidden ${
              imageUrl ? "cursor-crosshair" : ""
            }`}
          >
            {imageUrl ? (
              <>
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Input"
                  onLoad={onImgLoad}
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
                {rect && (
                  <div
                    className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                    style={{
                      left: rect.x1, top: rect.y1,
                      width: rect.x2 - rect.x1,
                      height: rect.y2 - rect.y1,
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                <MousePointer2 size={24} />
                <span className="text-[10px]">No image uploaded yet</span>
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="flex flex-col gap-2 flex-1">
          <span className="control-label">Result</span>
          <div className="relative flex-1 image-display rounded-xl overflow-hidden">
            {result ? (
              <>
                <img
                  src={`data:image/png;base64,${result.result_image}`}
                  alt="Snake result"
                  className="w-full h-full object-contain"
                />
                {dispSize.w > 0 && (
                  <ContourOverlay
                    width={dispSize.w}
                    height={dispSize.h}
                    initial={scaleContour(result.initial_contour)}
                    final={scaleContour(result.final_contour)}
                  />
                )}
              </>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/50">
                <Loader2 size={28} className="animate-spin text-primary" />
                <span className="text-[10px]">Running greedy snake…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
                <Play size={24} />
                <span className="text-[10px]">Result will appear here</span>
              </div>
            )}
          </div>

          {result && (
            <div className="flex gap-4 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-px border-t-2 border-dashed border-red-400" />
                <span className="text-[10px] text-muted-foreground">Initial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-px border-t-2 border-green-400" />
                <span className="text-[10px] text-muted-foreground">Final</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}