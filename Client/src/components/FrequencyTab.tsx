import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  imageIdA: string | null;
  imageIdB: string | null;
}

export default function FrequencyTab({ imageIdA, imageIdB }: Props) {
  const [lowCutoff, setLowCutoff] = useState(30);
  const [highCutoff, setHighCutoff] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ lp: string; hp: string; hybrid: string } | null>(null);

  const handleApply = async () => {
    if (!imageIdA || !imageIdB) return;
    setIsProcessing(true);

    try {
      const response = await fetch(`http://localhost:8000/apply_hybrid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_id_1: imageIdA,
          image_id_2: imageIdB,
          radius_low: lowCutoff,
          radius_high: highCutoff
        }),
      });

      if (!response.ok) throw new Error("Processing failed");
      
      const data = await response.json();

      // Map the backend response keys (lp_image, hp_image, hybrid_image) 
      // to your results state
      setResults({
        lp: `data:image/png;base64,${data.lp_image}`,
        hp: `data:image/png;base64,${data.hp_image}`,
        hybrid: `data:image/png;base64,${data.hybrid_image}`,
      });
    } catch (error) {
      console.error("Hybrid processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Generating hybrid..." />
      <div className="flex gap-4 items-end flex-wrap">
        <div className="control-group min-w-[150px]">
          <span className="control-label">Low Pass Cutoff (A): {lowCutoff}</span>
          <Slider value={[lowCutoff]} onValueChange={([v]) => setLowCutoff(v)} min={5} max={150} step={1} className="mt-1" />
        </div>
        <div className="control-group min-w-[150px]">
          <span className="control-label">High Pass Cutoff (B): {highCutoff}</span>
          <Slider value={[highCutoff]} onValueChange={([v]) => setHighCutoff(v)} min={5} max={150} step={1} className="mt-1" />
        </div>
        <Button onClick={handleApply} disabled={isProcessing || !imageIdA || !imageIdB} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>
      
      <div className="flex-1 grid grid-cols-3 gap-4 min-h-0">
        {[
          { label: "Low Pass (A)", key: "lp" },
          { label: "High Pass (B)", key: "hp" },
          { label: "Hybrid Result", key: "hybrid" }
        ].map((item, i) => (
          <div key={item.label} className="flex flex-col gap-1.5 min-h-0">
            <span className="control-label text-center">{item.label}</span>
            <div className={`image-display flex-1 min-h-0 ${i === 2 ? "glow-border" : ""}`}>
              {results ? (
                <img src={results[item.key as keyof typeof results]} alt={item.label} className="w-full h-full object-contain" />
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