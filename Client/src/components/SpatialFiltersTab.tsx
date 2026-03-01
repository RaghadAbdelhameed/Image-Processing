import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import { ImageIcon, Play } from "lucide-react";

interface Props {
  imageId: string | null;
}

export default function SpatialFiltersTab({ imageId }: Props) {
  const [noiseType, setNoiseType] = useState("gaussian");
  const [filterType, setFilterType] = useState("gaussian");
  const [noiseRatio, setNoiseRatio] = useState(0.3);
  const [kernelSize, setKernelSize] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);
  const [noisyUrl, setNoisyUrl] = useState<string | null>(null);
  const [filteredUrl, setFilteredUrl] = useState<string | null>(null);

  const handleApply = async () => {
    if (!imageId) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`http://localhost:8000/apply_spatial?image_id=${imageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noise_type: noiseType,
          filter_type: filterType,
          noise_ratio: noiseRatio,
          kernel_size: kernelSize,
        }),
      });
      if (!response.ok) throw new Error('Failed to apply filters');
      const data = await response.json();
      setNoisyUrl(`data:image/png;base64,${data.noisy_image}`);
      setFilteredUrl(`data:image/png;base64,${data.filtered_image}`);
    } catch (error) {
      console.error('Error:', error);
      // Handle error (e.g., show toast)
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Applying filters..." />
      <div className="flex gap-4 flex-wrap items-end">
        <div className="control-group min-w-[130px]">
          <span className="control-label">Noise Type</span>
          <Select value={noiseType} onValueChange={setNoiseType}>
            <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="uniform">Uniform</SelectItem>
              <SelectItem value="gaussian">Gaussian</SelectItem>
              <SelectItem value="salt&pepper">Salt & Pepper</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="control-group min-w-[130px]">
          <span className="control-label">Filter Type</span>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-xs bg-background/40 border-border/40 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="average">Average</SelectItem>
              <SelectItem value="gaussian">Gaussian</SelectItem>
              <SelectItem value="median">Median</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="control-group min-w-[140px]">
          <span className="control-label">Noise Ratio: {noiseRatio.toFixed(2)}</span>
          <Slider value={[noiseRatio]} onValueChange={([v]) => setNoiseRatio(v)} min={0} max={1} step={0.01} className="mt-1" />
        </div>
        <div className="control-group min-w-[140px]">
          <span className="control-label">Kernel: {kernelSize}×{kernelSize}</span>
          <Slider value={[kernelSize]} onValueChange={([v]) => setKernelSize(v)} min={3} max={7} step={2} className="mt-1" />
        </div>
        <Button onClick={handleApply} disabled={isProcessing || !imageId} size="sm" className="btn-apply">
          <Play size={12} /> Apply
        </Button>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        {[{ url: noisyUrl, label: "Noisy Image" }, { url: filteredUrl, label: "Filtered Image" }].map(({ url, label }) => (
          <div key={label} className="flex flex-col gap-1.5 min-h-0">
            <span className="control-label text-center">{label}</span>
            <div className="image-display flex-1 min-h-0">
              {url ? (
                <img src={url} alt={label} className="w-full h-full object-contain" />
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