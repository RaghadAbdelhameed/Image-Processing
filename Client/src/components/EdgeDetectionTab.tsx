import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  imageId: string | null;
}

export default function EdgeDetectionTab({ imageId }: Props) {
  const [method, setMethod] = useState("sobel");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ url: string; label: string }[]>([]);

  const handleApply = async () => {
    if (!imageId) return;

    setIsProcessing(true);
    setResults([]); // clear previous results

    try {
      const response = await fetch(`http://localhost:8000/apply_edge?image_id=${imageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });

      if (!response.ok) throw new Error("Failed to detect edges");

      const data = await response.json();

      let newResults: { url: string; label: string }[];

      if (method === "canny") {
        newResults = [
          {
            url: `data:image/png;base64,${data.edges}`,
            label: "Canny Edge",
          },
        ];
      } else {
        newResults = [
          {
            url: `data:image/png;base64,${data.gx}`,
            label: "X-Gradient",
          },
          {
            url: `data:image/png;base64,${data.gy}`,
            label: "Y-Gradient",
          },
          {
            url: `data:image/png;base64,${data.magnitude}`,
            label: "Magnitude",
          },
        ];
      }

      setResults(newResults);
    } catch (error) {
      console.error("Edge detection error:", error);
      // TODO: show toast/error message to user
    } finally {
      setIsProcessing(false);
    }
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

        <Button
          onClick={handleApply}
          disabled={isProcessing || !imageId}
          size="sm"
          className="btn-apply"
        >
          <Play size={12} /> Apply
        </Button>
      </div>

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