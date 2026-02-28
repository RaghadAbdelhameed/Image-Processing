import { Upload, Sliders, ScanLine, BarChart3, Waves, Sparkles, ArrowRight } from "lucide-react";

interface Props {
  onImageLoad: (file: File) => void;
}

export default function LandingHero({ onImageLoad }: Props) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onImageLoad(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageLoad(file);
  };

  const features = [
    { icon: Sliders, label: "Spatial Filters", desc: "Noise & smoothing" },
    { icon: ScanLine, label: "Edge Detection", desc: "Sobel, Canny & more" },
    { icon: BarChart3, label: "Histograms", desc: "Equalize & normalize" },
    { icon: Waves, label: "Frequency", desc: "Hybrid images" },
  ];

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-[20%] left-[15%] w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none opacity-30"
        style={{ background: "radial-gradient(circle, hsl(160 85% 40% / 0.3), transparent 70%)" }} />
      <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, hsl(220 60% 55% / 0.3), transparent 70%)" }} />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(hsl(220 15% 90%) 1px, transparent 1px), linear-gradient(90deg, hsl(220 15% 90%) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="flex flex-col items-center gap-12 max-w-xl px-6 relative z-10">
        {/* Badge */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-card/40 backdrop-blur-md">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-[11px] font-medium text-muted-foreground tracking-wide">Image Processing Toolkit</span>
        </div>

        {/* Title */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
            Image{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Equalizer
            </span>
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
            Apply filters, detect edges, analyze histograms, and create hybrid images — all in one place.
          </p>
        </div>

        {/* Upload Zone */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="w-full max-w-xs cursor-pointer group"
        >
          <div className="relative rounded-2xl border border-dashed border-border/60 hover:border-primary/40 bg-card/30 backdrop-blur-md p-8 flex flex-col items-center gap-4 transition-all duration-300 group-hover:bg-card/50 group-hover:shadow-[0_0_50px_-12px_hsl(160_85%_40%/0.2)]">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center group-hover:bg-primary/15 group-hover:scale-105 transition-all duration-300">
              <Upload size={20} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground/90">Drop your image here</p>
              <p className="text-[11px] text-muted-foreground mt-1">or click to browse · PNG, JPG, WEBP</p>
            </div>
            <div className="flex items-center gap-1.5 text-primary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>Get started</span>
              <ArrowRight size={12} />
            </div>
          </div>
          <input type="file" accept="image/*" onChange={handleChange} className="hidden" />
        </label>

        {/* Feature cards */}
        <div className="grid grid-cols-4 gap-2.5 w-full max-w-md">
          {features.map((f, i) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card/30 border border-border/30 backdrop-blur-sm hover:bg-card/50 hover:border-border/50 transition-all duration-200"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <f.icon size={14} className="text-primary/80" />
              <span className="text-[10px] font-semibold text-foreground/70 text-center leading-tight">{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
