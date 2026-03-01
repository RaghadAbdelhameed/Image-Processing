import { useCallback } from "react";
import { Upload, X } from "lucide-react";

interface Props {
  imageUrl: string | null;
  onImageLoad: (file: File) => void;
  onClear: () => void;
  label?: string;
  compact?: boolean;
}

export default function ImageUploadPanel({ imageUrl, onImageLoad, onClear, label = "Upload Image", compact = false }: Props) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onImageLoad(file);
  }, [onImageLoad]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImageLoad(file);
  }, [onImageLoad]);

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2.5"}`}>
      <span className="control-label">{label}</span>
      {imageUrl ? (
        <div className="relative group">
          <div className="image-display aspect-square rounded-xl">
            <img src={imageUrl} alt="Uploaded" className="w-full h-full object-contain" />
          </div>
          <button
            onClick={onClear}
            className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-foreground hover:bg-background/90 transition-all opacity-0 group-hover:opacity-100"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="image-display aspect-square cursor-pointer hover:border-primary/30 transition-all duration-200 flex-col gap-2 rounded-xl"
        >
          <Upload size={compact ? 16 : 20} className="text-muted-foreground/50" />
          <span className="text-[10px] text-muted-foreground/50">Drop or click</span>
          <input type="file" accept="image/*" onChange={handleChange} className="hidden" />
        </label>
      )}
    </div>
  );
}
