import { Loader2 } from "lucide-react";

interface Props {
  isProcessing: boolean;
  label?: string;
}

export default function ProcessingOverlay({ isProcessing, label = "Processing..." }: Props) {
  if (!isProcessing) return null;

  return (
    <div className="absolute inset-0 z-20 bg-background/70 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary/30" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-semibold text-foreground tracking-wide">{label}</span>
        <div className="w-28 h-1 rounded-full bg-secondary overflow-hidden">
          <div className="h-full rounded-full animate-shimmer"
            style={{
              width: "50%",
              background: "linear-gradient(90deg, hsl(var(--primary) / 0.3), hsl(var(--primary)), hsl(var(--primary) / 0.3))"
            }}
          />
        </div>
      </div>
    </div>
  );
}
