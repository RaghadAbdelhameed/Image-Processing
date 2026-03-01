import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  sourceData: ImageData | null;
  imageBUrl: string | null;
}

export default function FrequencyTab({ sourceData, imageBUrl }: Props) {
  const [lowCutoff, setLowCutoff] = useState(30);
  const [highCutoff, setHighCutoff] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ lp: string; hp: string; hybrid: string } | null>(null);

  const handleApply = () => {
    if (!sourceData || !imageBUrl) return;
    setIsProcessing(true);
    // TODO: Call server endpoint
    setTimeout(() => setIsProcessing(false), 1500);
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Generating hybrid..." />
      <div className="flex gap-4 items-end flex-wrap">
        <div className="control-group min-w-[150px]">
          <span className="control-label">Low Pass Cutoff: {lowCutoff}</span>
          <Slider value={[lowCutoff]} onValueChange={([v]) => setLowCutoff(v)} min={5} max={80} step={1} className="mt-1" />
        </div>
        <div className="control-group min-w-[150px]">
          <span className="control-label">High Pass Cutoff: {highCutoff}</span>
          <Slider value={[highCutoff]} onValueChange={([v]) => setHighCutoff(v)} min={5} max={80} step={1} className="mt-1" />
        </div>
        <Button onClick={handleApply} disabled={isProcessing || !sourceData || !imageBUrl} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {["Low Pass (A)", "High Pass (B)", "Hybrid"].map((label, i) => (
          <div key={label} className="flex flex-col gap-1.5 min-h-0">
            <span className="control-label text-center">{label}</span>
            <div className={`image-display flex-1 min-h-0 ${i === 2 ? "glow-border" : ""}`}>
              {results ? (
                <img
                  src={i === 0 ? results.lp : i === 1 ? results.hp : results.hybrid}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon size={28} className="text-muted-foreground/15" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
