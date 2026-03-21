import { useState } from "react";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface Props {
  imageId: string | null;
}

export default function EdgeDetectionTab({ imageId }: Props) {
  const [method, setMethod]               = useState("sobel");
  const [cannyMode, setCannyMode]         = useState("automatic");
  const [lowThreshold, setLowThreshold]   = useState(50);
  const [highThreshold, setHighThreshold] = useState(150);
  const [sigma, setSigma]                 = useState(1.0);
  const [isProcessing, setIsProcessing]   = useState(false);
  const [results, setResults]             = useState<{ url: string; label: string }[]>([]);

  const handleApply = async () => {
    if (!imageId) return;

    setIsProcessing(true);
    setResults([]);

    try {
      const body: Record<string, unknown> = { method };

      if (method === "canny") {
        body.canny_mode = cannyMode;
        body.sigma      = sigma;

        if (cannyMode === "manual") {
          body.low_threshold  = lowThreshold;
          body.high_threshold = highThreshold;
        }
      }

      const response = await fetch(
        `http://localhost:8000/apply_edge?image_id=${imageId}`,
        {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(body),
        }
      );

      if (!response.ok) throw new Error("Failed to detect edges");

      const data = await response.json();

      const newResults: { url: string; label: string }[] =
        method === "canny"
          ? [{ url: `data:image/png;base64,${data.edges}`, label: "Canny Edge" }]
          : [
              { url: `data:image/png;base64,${data.gx}`,        label: "X-Gradient" },
              { url: `data:image/png;base64,${data.gy}`,        label: "Y-Gradient" },
              { url: `data:image/png;base64,${data.magnitude}`, label: "Magnitude"  },
            ];

      setResults(newResults);
    } catch (error) {
      console.error("Edge detection error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const isCanny         = method === "canny";
  const isManual        = cannyMode === "manual";
  const placeholderLabels = isCanny
    ? ["Canny Edge"]
    : ["X-Gradient", "Y-Gradient", "Magnitude"];

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Detecting edges..." />

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex gap-4 items-end flex-wrap">

        {/* Edge method */}
        <div className="control-group min-w-[160px]">
          <span className="control-label">Edge Mask</span>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sobel">Sobel</SelectItem>
              <SelectItem value="roberts">Roberts</SelectItem>
              <SelectItem value="prewitt">Prewitt</SelectItem>
              <SelectItem value="canny">Canny</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Canny-only controls */}
        {isCanny && (
          <>
            {/* Mode */}
            <div className="control-group min-w-[160px]">
              <span className="control-label">Canny Mode</span>
              <Select value={cannyMode} onValueChange={setCannyMode}>
                <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sigma — always visible when Canny is selected */}
            <div className="control-group min-w-[140px]">
              <span className="control-label">Sigma — {sigma.toFixed(1)}</span>
              <Slider
                min={0.5} max={3.0} step={0.1}
                value={[sigma]}
                onValueChange={([v]) => setSigma(v)}
              />
            </div>

            {/* Manual thresholds */}
            {isManual && (
              <>
                <div className="control-group min-w-[140px]">
                  <span className="control-label">Low Threshold — {lowThreshold}</span>
                  <Slider
                    min={0} max={255} step={1}
                    value={[lowThreshold]}
                    onValueChange={([v]) => setLowThreshold(v)}
                  />
                </div>

                <div className="control-group min-w-[140px]">
                  <span className="control-label">High Threshold — {highThreshold}</span>
                  <Slider
                    min={0} max={255} step={1}
                    value={[highThreshold]}
                    onValueChange={([v]) => setHighThreshold(v)}
                  />
                </div>
              </>
            )}
          </>
        )}

        <Button
          onClick={handleApply}
          disabled={isProcessing || !imageId}
          size="sm"
          className="btn-apply"
        >
          <Play size={12} /> Apply
        </Button>
      </div>

      {/* ── Results grid ─────────────────────────────────────────────────── */}
      <div className={`flex-1 grid ${isCanny ? "grid-cols-1" : "grid-cols-3"} gap-4 min-h-0`}>
        {results.length > 0
          ? results.map((r) => (
              <div key={r.label} className="flex flex-col gap-1.5 min-h-0">
                <span className="control-label text-center">{r.label}</span>
                <div className="image-display flex-1 min-h-0">
                  <img src={r.url} alt={r.label} className="w-full h-full object-contain" />
                </div>
              </div>
            ))
          : placeholderLabels.map((label) => (
              <div key={label} className="flex flex-col gap-1.5 min-h-0">
                <span className="control-label text-center">{label}</span>
                <div className="image-display flex-1 min-h-0">
                  <ImageIcon size={28} className="text-muted-foreground/15" />
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}