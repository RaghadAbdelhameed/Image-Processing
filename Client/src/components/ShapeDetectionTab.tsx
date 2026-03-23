import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  imageId: string | null;
}

export default function ShapeDetectionTab({ imageId }: Props) {
  const [shape, setShape] = useState("lines");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ url: string; label: string }[]>([]);

  // Lines (Hough) defaults
  const [linesThreshold, setLinesThreshold] = useState(160);
  const [linesRho, setLinesRho] = useState(1);
  const [linesTheta, setLinesTheta] = useState(1);

  // Circles (Hough) defaults
  const [circlesDp, setCirclesDp] = useState(1.2);
  const [circlesMinDist, setCirclesMinDist] = useState(30);
  const [circlesParam1, setCirclesParam1] = useState(50);
  const [circlesParam2, setCirclesParam2] = useState(55);
  const [circlesMinRadius, setCirclesMinRadius] = useState(10);
  const [circlesMaxRadius, setCirclesMaxRadius] = useState(100);

  // Ellipses (Arc-Support) defaults 
  const [edgeThresh, setEdgeThresh] = useState(50);     // 10–200
  const [trThresh, setTrThresh] = useState(0.5);        // 0.1–1.0
  const [minSize, setMinSize] = useState(25);           // 10–100

  const handleApply = async () => {
    if (!imageId) return;
    setIsProcessing(true);
    setResults([]);

    try {
      if (shape === "ellipses") {
        // Keep Ellipse logic as is
        const response = await fetch(`http://localhost:8000/apply_ellipse?image_id=${imageId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            edge_thresh: edgeThresh,
            tr_thresh: trThresh,
            min_size: minSize,
          }),
        });

        if (!response.ok) throw new Error("Ellipse detection failed");

        const data = await response.json();

        setResults([
          {
            url: `data:image/png;base64,${data.result_image}`,
            label: `Detected Ellipses (${data.num_ellipses} found)`,
          },
        ]);
      } else if (shape === "lines") {
        // Updated to call /apply_line to match app.py
        const response = await fetch(`http://localhost:8000/apply_line?image_id=${imageId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threshold: linesThreshold,
            rho: linesRho,
            theta: linesTheta,
          }),
        });

        if (!response.ok) throw new Error("Line detection failed");

        const data = await response.json();
        setResults([
          { 
            url: `data:image/png;base64,${data.result}`, 
            label: `Detected Lines` 
          },
        ]);
      } else if (shape === "circles") {
        const response = await fetch(`http://localhost:8000/apply_circle?image_id=${imageId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dp: circlesDp,
            min_dist: circlesMinDist,
            param1: circlesParam1,
            param2: circlesParam2,
            min_radius: circlesMinRadius,
            max_radius: circlesMaxRadius,
          }),
        });

        if (!response.ok) throw new Error("Circle detection failed");

        const data = await response.json();
        setResults([
          { 
            url: `data:image/png;base64,${data.result}`, 
            label: `Detected Circles` 
          },
        ]);
      }else {
        // Generic handler for other shapes (e.g., circles if implemented later)
        const params: Record<string, unknown> = { shape };
        if (shape === "circles") {
          params.dp = circlesDp;
          params.min_dist = circlesMinDist;
          params.param1 = circlesParam1;
          params.param2 = circlesParam2;
          params.min_radius = circlesMinRadius;
          params.max_radius = circlesMaxRadius;
        }

        const response = await fetch(`http://localhost:8000/detect_shapes?image_id=${imageId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!response.ok) throw new Error("Shape detection failed");

        const data = await response.json();
        setResults([
          { url: `data:image/png;base64,${data.result}`, label: `Detected ${shape.charAt(0).toUpperCase() + shape.slice(1)}` },
        ]);
      }
    } catch (error) {
      console.error("Shape detection error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Detecting shapes..." />

      <div className="flex gap-4 items-end flex-wrap">
        <div className="control-group min-w-[160px]">
          <span className="control-label">Shape Type</span>
          <Select value={shape} onValueChange={setShape}>
            <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">Lines</SelectItem>
              <SelectItem value="circles">Circles</SelectItem>
              <SelectItem value="ellipses">Ellipses (Arc-Support)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {shape === "lines" && (
          <>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Threshold — {linesThreshold}</span>
              <Slider min={10} max={300} step={5} value={[linesThreshold]} onValueChange={([v]) => setLinesThreshold(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Rho Res — {linesRho}</span>
              <Slider min={0.5} max={2} step={0.1} value={[linesRho]} onValueChange={([v]) => setLinesRho(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Theta Res — {linesTheta}</span>
              <Slider min={0.5} max={2} step={0.1} value={[linesTheta]} onValueChange={([v]) => setLinesTheta(v)} />
            </div>
          </>
        )}

        {shape === "circles" && (
          <>
            <div className="control-group min-w-[110px]">
              <span className="control-label">DP — {circlesDp.toFixed(1)}</span>
              <Slider min={1} max={3} step={0.1} value={[circlesDp]} onValueChange={([v]) => setCirclesDp(v)} />
            </div>
            <div className="control-group min-w-[110px]">
              <span className="control-label">Min Dist — {circlesMinDist}</span>
              <Slider min={5} max={200} step={5} value={[circlesMinDist]} onValueChange={([v]) => setCirclesMinDist(v)} />
            </div>
            <div className="control-group min-w-[110px]">
              <span className="control-label">Param1 — {circlesParam1}</span>
              <Slider min={10} max={200} step={5} value={[circlesParam1]} onValueChange={([v]) => setCirclesParam1(v)} />
            </div>
            <div className="control-group min-w-[110px]">
              <span className="control-label">Param2 — {circlesParam2}</span>
              <Slider min={10} max={100} step={1} value={[circlesParam2]} onValueChange={([v]) => setCirclesParam2(v)} />
            </div>
            <div className="control-group min-w-[110px]">
              <span className="control-label">Min R — {circlesMinRadius}</span>
              <Slider min={0} max={200} step={5} value={[circlesMinRadius]} onValueChange={([v]) => setCirclesMinRadius(v)} />
            </div>
            <div className="control-group min-w-[110px]">
              <span className="control-label">Max R — {circlesMaxRadius}</span>
              <Slider min={10} max={500} step={10} value={[circlesMaxRadius]} onValueChange={([v]) => setCirclesMaxRadius(v)} />
            </div>
          </>
        )}

        {shape === "ellipses" && (
          <>
            <div className="control-group min-w-[150px]">
              <span className="control-label">Edge Threshold — {edgeThresh}</span>
              <Slider min={10} max={200} step={5} value={[edgeThresh]} onValueChange={([v]) => setEdgeThresh(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Inlier Ratio (Strictness) — {trThresh.toFixed(2)}</span>
              <Slider min={0.1} max={1} step={0.05} value={[trThresh]} onValueChange={([v]) => setTrThresh(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Min Arc Size — {minSize}</span>
              <Slider min={10} max={100} step={5} value={[minSize]} onValueChange={([v]) => setMinSize(v)} />
            </div>
          </>
        )}

        <Button onClick={handleApply} disabled={isProcessing || !imageId} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 gap-4 min-h-0">
        {results.length > 0
          ? results.map((r) => (
              <div key={r.label} className="flex flex-col gap-1.5 min-h-0">
                <span className="control-label text-center">{r.label}</span>
                <div className="image-display flex-1 min-h-0">
                  <img src={r.url} alt={r.label} className="w-full h-full object-contain" />
                </div>
              </div>
            ))
          : (
              <div className="flex flex-col gap-1.5 min-h-0">
                <span className="control-label text-center">Detection Result</span>
                <div className="image-display flex-1 min-h-0">
                  <ImageIcon size={28} className="text-muted-foreground/15" />
                </div>
              </div>
            )}
      </div>
    </div>
  );
}