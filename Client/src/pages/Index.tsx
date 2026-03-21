import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ImageUploadPanel from "@/components/ImageUploadPanel";
import SpatialFiltersTab from "@/components/SpatialFiltersTab";
import EdgeDetectionTab from "@/components/EdgeDetectionTab";
import HistogramsTab from "@/components/HistogramsTab";
import FrequencyTab from "@/components/FrequencyTab";
import ActiveContourTab from "@/components/ActiveContourTab";
import LandingHero from "@/components/LandingHero";
import { loadImageToCanvas, getImageData } from "@/lib/imageProcessing";
import { Sliders, ScanLine, BarChart3, Waves, Spline } from "lucide-react";

const useImageUpload = (label: string) => {
  const [url, setUrl] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [data, setData] = useState<ImageData | null>(null);

  const load = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    const canvas = await loadImageToCanvas(file);
    setData(getImageData(canvas));

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error(`${label} upload failed`);
      const result = await response.json();
      setId(result.image_id);
    } catch (error) {
      console.error(`${label} Error:`, error);
    }
  }, [label]);

  const clear = useCallback(() => {
    setUrl(null);
    setId(null);
    setData(null);
  }, []);

  return { url, id, data, load, clear };
};

const Index = () => {
  const imageA = useImageUpload("Image A");
  const imageB = useImageUpload("Image B");
  const [activeTab, setActiveTab] = useState("spatial");

  if (!imageA.data) {
    return <LandingHero onImageLoad={imageA.load} />;
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
            <TabsTrigger value="contour" className="tab-trigger-modern">
              <Spline size={12} /> Active Contour
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 panel-glass p-5 min-h-0">
            <TabsContent value="spatial" className="h-full m-0">
              <SpatialFiltersTab imageId={imageA.id} />
            </TabsContent>
            <TabsContent value="edge" className="h-full m-0">
              <EdgeDetectionTab imageId={imageA.id} />
            </TabsContent>
            <TabsContent value="histogram" className="h-full m-0">
              <HistogramsTab sourceData={imageA.data} imageId={imageA.id} />
            </TabsContent>
            <TabsContent value="frequency" className="h-full m-0">
              <FrequencyTab imageIdA={imageA.id} imageIdB={imageB.id} />
            </TabsContent>
            <TabsContent value="contour" className="h-full m-0">
              <ActiveContourTab imageId={imageA.id} imageUrl={imageA.url} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Right panel */}
      <div className="w-[260px] shrink-0 p-5 flex flex-col gap-4">
        <div className="panel-glass p-4">
          <ImageUploadPanel
            imageUrl={imageA.url}
            onImageLoad={imageA.load}
            onClear={imageA.clear}
            label={activeTab === "frequency" ? "Low Pass (A)" : "Source Image"}
          />
        </div>
        {activeTab === "frequency" && (
          <div className="panel-glass p-4">
            <ImageUploadPanel
              imageUrl={imageB.url}
              onImageLoad={imageB.load}
              onClear={imageB.clear}
              label="High Pass (B)"
            />
          </div>
        )}
        <div className="panel-glass p-4 flex-1">
          <span className="control-label">Image Info</span>
          <div className="mt-3 space-y-2 text-[11px] text-muted-foreground font-mono">
            <div className="flex justify-between">
              <span>Width</span>
              <span className="text-foreground/70">{imageA.data.width}px</span>
            </div>
            <div className="flex justify-between">
              <span>Height</span>
              <span className="text-foreground/70">{imageA.data.height}px</span>
            </div>
            <div className="h-px bg-border/30" />
            <div className="flex justify-between">
              <span>Pixels</span>
              <span className="text-foreground/70">{(imageA.data.width * imageA.data.height).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;