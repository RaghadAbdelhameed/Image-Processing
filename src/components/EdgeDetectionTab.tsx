import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  sourceData: ImageData | null;
}

export default function EdgeDetectionTab({ sourceData }: Props) {
  const [method, setMethod] = useState("sobel");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ url: string; label: string }[]>([]);

  const handleApply = () => {
    if (!sourceData) return;
    setIsProcessing(true);
    // TODO: Call server endpoint
    setTimeout(() => setIsProcessing(false), 1500);
  };

  const isCanny = method === "canny";
  const placeholderLabels = isCanny ? ["Canny Edge"] : ["X-Gradient", "Y-Gradient", "Magnitude"];

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Detecting edges..." />
      <div className="flex gap-4 items-end">
        <div className="control-group min-w-[160px]">
          <span className="control-label">Edge Mask</span>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sobel">Sobel</SelectItem>
              <SelectItem value="roberts">Roberts</SelectItem>
              <SelectItem value="prewitt">Prewitt</SelectItem>
              <SelectItem value="canny">Canny</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} disabled={isProcessing || !sourceData} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>
      <div className={`flex-1 grid ${isCanny ? "grid-cols-1" : "grid-cols-3"} gap-4 min-h-0`}>
        {results.length > 0 ? results.map((r) => (
          <div key={r.label} className="flex flex-col gap-1.5 min-h-0">
            <span className="control-label text-center">{r.label}</span>
            <div className="image-display flex-1 min-h-0">
              <img src={r.url} alt={r.label} className="w-full h-full object-contain" />
            </div>
          </div>
        )) : placeholderLabels.map((label) => (
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
