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
  const [linesThreshold, setLinesThreshold] = useState(100);
  const [linesMinLength, setLinesMinLength] = useState(50);
  const [linesMaxGap, setLinesMaxGap] = useState(10);

  // Circles (Hough) defaults
  const [circlesDp, setCirclesDp] = useState(1.2);
  const [circlesMinDist, setCirclesMinDist] = useState(30);
  const [circlesParam1, setCirclesParam1] = useState(50);
  const [circlesParam2, setCirclesParam2] = useState(30);
  const [circlesMinRadius, setCirclesMinRadius] = useState(10);
  const [circlesMaxRadius, setCirclesMaxRadius] = useState(100);

  // Ellipses defaults
  const [ellipsesMinArea, setEllipsesMinArea] = useState(100);
  const [ellipsesMaxArea, setEllipsesMaxArea] = useState(50000);
  const [ellipsesMinAspect, setEllipsesMinAspect] = useState(0.2);

  const handleApply = async () => {
    if (!imageId) return;
    setIsProcessing(true);
    setResults([]);

    try {
      const params: Record<string, unknown> = { shape };

      if (shape === "lines") {
        params.threshold = linesThreshold;
        params.min_line_length = linesMinLength;
        params.max_line_gap = linesMaxGap;
      } else if (shape === "circles") {
        params.dp = circlesDp;
        params.min_dist = circlesMinDist;
        params.param1 = circlesParam1;
        params.param2 = circlesParam2;
        params.min_radius = circlesMinRadius;
        params.max_radius = circlesMaxRadius;
      } else if (shape === "ellipses") {
        params.min_area = ellipsesMinArea;
        params.max_area = ellipsesMaxArea;
        params.min_aspect_ratio = ellipsesMinAspect;
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
              <SelectItem value="ellipses">Ellipses</SelectItem>
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
              <span className="control-label">Min Length — {linesMinLength}</span>
              <Slider min={5} max={200} step={5} value={[linesMinLength]} onValueChange={([v]) => setLinesMinLength(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Max Gap — {linesMaxGap}</span>
              <Slider min={1} max={50} step={1} value={[linesMaxGap]} onValueChange={([v]) => setLinesMaxGap(v)} />
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
              <Slider min={5} max={100} step={5} value={[circlesParam2]} onValueChange={([v]) => setCirclesParam2(v)} />
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
            <div className="control-group min-w-[130px]">
              <span className="control-label">Min Area — {ellipsesMinArea}</span>
              <Slider min={10} max={5000} step={50} value={[ellipsesMinArea]} onValueChange={([v]) => setEllipsesMinArea(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Max Area — {ellipsesMaxArea}</span>
              <Slider min={1000} max={100000} step={500} value={[ellipsesMaxArea]} onValueChange={([v]) => setEllipsesMaxArea(v)} />
            </div>
            <div className="control-group min-w-[130px]">
              <span className="control-label">Min Aspect — {ellipsesMinAspect.toFixed(2)}</span>
              <Slider min={0.05} max={1} step={0.05} value={[ellipsesMinAspect]} onValueChange={([v]) => setEllipsesMinAspect(v)} />
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
