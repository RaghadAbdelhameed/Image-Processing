import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ImageUploadPanel from "@/components/ImageUploadPanel";
import SpatialFiltersTab from "@/components/SpatialFiltersTab";
import EdgeDetectionTab from "@/components/EdgeDetectionTab";
import HistogramsTab from "@/components/HistogramsTab";
import FrequencyTab from "@/components/FrequencyTab";
import LandingHero from "@/components/LandingHero";
import { loadImageToCanvas, getImageData } from "@/lib/imageProcessing";
import { Sliders, ScanLine, BarChart3, Waves } from "lucide-react";

const Index = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageBId, setImageBId] = useState<string | null>(null);
  const [imageBUrl, setImageBUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("spatial");

  const handleImageLoad = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const canvas = await loadImageToCanvas(file);
    setImageData(getImageData(canvas));

    // Upload to backend
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setImageId(data.image_id);
    } catch (error) {
      console.error('Upload error:', error);
      // Handle error (e.g., alert user)
    }
  }, []);

  const handleClear = useCallback(() => {
    setImageUrl(null);
    setImageData(null);
    setImageId(null);
  }, []);

  const handleImageBLoad = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageBUrl(url);

    // Upload Image B to backend
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setImageBId(data.image_id); // Store the ID for Image B
    } catch (error) {
      console.error('Upload B error:', error);
    }
  }, []);

  const handleImageBClear = useCallback(() => {
    setImageBUrl(null);
    setImageBId(null);
  }, []);

  if (!imageData) {
    return <LandingHero onImageLoad={handleImageLoad} />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background">
      {/* Main workspace */}
      <div className="flex-1 flex flex-col min-w-0 p-5 pr-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Image Equalizer
              </span>
            </h1>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="bg-card/40 backdrop-blur-md border border-border/30 self-start mb-4 rounded-xl p-1 h-auto">
            <TabsTrigger value="spatial" className="tab-trigger-modern">
              <Sliders size={12} /> Spatial Filters
            </TabsTrigger>
            <TabsTrigger value="edge" className="tab-trigger-modern">
              <ScanLine size={12} /> Edge Detection
            </TabsTrigger>
            <TabsTrigger value="histogram" className="tab-trigger-modern">
              <BarChart3 size={12} /> Histograms
            </TabsTrigger>
            <TabsTrigger value="frequency" className="tab-trigger-modern">
              <Waves size={12} /> Frequency & Hybrid
            </TabsTrigger>
          </TabsList>
          <div className="flex-1 panel-glass p-5 min-h-0">
            <TabsContent value="spatial" className="h-full m-0">
              <SpatialFiltersTab imageId={imageId} />
            </TabsContent>
            <TabsContent value="edge" className="h-full m-0">
              <EdgeDetectionTab imageId={imageId} />
            </TabsContent>
            <TabsContent value="histogram" className="h-full m-0">
              <HistogramsTab sourceData={imageData} />
            </TabsContent>
            <TabsContent value="frequency" className="h-full m-0">
              <FrequencyTab 
                imageIdA={imageId} 
                imageIdB={imageBId} 
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Right panel */}
      <div className="w-[260px] shrink-0 p-5 flex flex-col gap-4">
        <div className="panel-glass p-4">
          <ImageUploadPanel
            imageUrl={imageUrl}
            onImageLoad={handleImageLoad}
            onClear={handleClear}
            label={activeTab === "frequency" ? "Low Pass (A)" : "Source Image"}
          />
        </div>
        {activeTab === "frequency" && (
          <div className="panel-glass p-4">
            <ImageUploadPanel
              imageUrl={imageBUrl}
              onImageLoad={handleImageBLoad}
              onClear={handleImageBClear}
              label="High Pass (B)"
            />
          </div>
        )}
        <div className="panel-glass p-4 flex-1">
          <span className="control-label">Image Info</span>
          <div className="mt-3 space-y-2 text-[11px] text-muted-foreground font-mono">
            <div className="flex justify-between">
              <span>Width</span>
              <span className="text-foreground/70">{imageData.width}px</span>
            </div>
            <div className="flex justify-between">
              <span>Height</span>
              <span className="text-foreground/70">{imageData.height}px</span>
            </div>
            <div className="h-px bg-border/30" />
            <div className="flex justify-between">
              <span>Pixels</span>
              <span className="text-foreground/70">{(imageData.width * imageData.height).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;