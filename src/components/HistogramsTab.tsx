import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  sourceData: ImageData | null;
}

type Mode = "gray" | "rgb";

export default function HistogramsTab({ sourceData }: Props) {
  const [mode, setMode] = useState<Mode>("gray");
  const [action, setAction] = useState<"none" | "equalize" | "normalize">("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleApply = () => {
    if (!sourceData) return;
    setIsProcessing(true);
    // TODO: Call server endpoint
    setTimeout(() => setIsProcessing(false), 1500);
  };

  const handleAction = (a: "equalize" | "normalize") => {
    setAction(prev => prev === a ? "none" : a);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Processing histogram..." />
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex gap-1 p-0.5 rounded-lg bg-background/30 border border-border/30">
          {(["gray", "rgb"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`toggle-btn ${mode === m ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "gray" ? "Grayscale" : "RGB"}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-0.5 rounded-lg bg-background/30 border border-border/30">
          {(["equalize", "normalize"] as const).map((a) => (
            <button
              key={a}
              onClick={() => handleAction(a)}
              className={`toggle-btn capitalize ${action === a ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
            >
              {a}
            </button>
          ))}
        </div>
        <Button onClick={handleApply} disabled={isProcessing || !sourceData} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        <div className="flex flex-col gap-1.5 min-h-0">
          <span className="control-label text-center">Result</span>
          <div className="image-display flex-1 min-h-0">
            {resultUrl ? (
              <img src={resultUrl} alt="Result" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/15" />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 min-h-0">
          <span className="control-label text-center">Histogram & CDF</span>
          <div className="image-display flex-1 min-h-0 p-2">
            <canvas ref={canvasRef} width={400} height={250} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
