import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import ProcessingOverlay from "./ProcessingOverlay";
import {
  computeHistogram,
  toGrayscale,
  imageDataToDataURL,
} from "@/lib/imageProcessing";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Play, ImageIcon, BarChart3, TrendingUp } from "lucide-react";

interface Props {
  sourceData: ImageData | null;
  imageId: string | null;
}

type Mode = "gray" | "rgb";
type Action = "none" | "equalize" | "normalize";
type ChartView = "histogram" | "cdf";

// ── Chart data builder (identical to original) ───────────────────────────────

function buildChartData(hists: number[][], cdfs: number[][], mode: Mode) {
  return Array.from({ length: 256 }, (_, i) => {
    if (mode === "gray") {
      return { i, hist: hists[0][i], cdf: cdfs[0][i] };
    }
    return {
      i,
      R_hist: hists[0][i],
      G_hist: hists[1][i],
      B_hist: hists[2][i],
      R_cdf: cdfs[0][i],
      G_cdf: cdfs[1][i],
      B_cdf: cdfs[2][i],
    };
  });
}

const CHANNEL_COLORS = {
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  gray: "#a78bfa",
};

// ── Chart renderers (identical to original) ──────────────────────────────────

const renderGrayChart = (
  data: ReturnType<typeof buildChartData>,
  chartView: ChartView
) => {
  if (chartView === "histogram") {
    return (
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="grayGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHANNEL_COLORS.gray} stopOpacity={0.6} />
            <stop offset="95%" stopColor={CHANNEL_COLORS.gray} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={63} />
        <YAxis tick={{ fontSize: 9 }} />
        <Tooltip
          contentStyle={{ background: "#0f0f14", border: "1px solid #2a2a3a", fontSize: 10 }}
          formatter={(v: number) => [v.toLocaleString(), "Count"]}
          labelFormatter={(l) => `Value: ${l}`}
        />
        <Area type="monotone" dataKey="hist" stroke={CHANNEL_COLORS.gray} fill="url(#grayGrad)" strokeWidth={1} dot={false} />
      </AreaChart>
    );
  }
  return (
    <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
      <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={63} />
      <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
      <Tooltip
        contentStyle={{ background: "#0f0f14", border: "1px solid #2a2a3a", fontSize: 10 }}
        formatter={(v: number) => [v.toFixed(4), "CDF"]}
        labelFormatter={(l) => `Value: ${l}`}
      />
      <Line type="monotone" dataKey="cdf" stroke={CHANNEL_COLORS.gray} strokeWidth={1.5} dot={false} />
    </LineChart>
  );
};

const renderRGBChart = (
  data: ReturnType<typeof buildChartData>,
  chartView: ChartView
) => {
  const channels = ["R", "G", "B"] as const;
  if (chartView === "histogram") {
    return (
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          {channels.map((ch) => (
            <linearGradient key={ch} id={`grad_${ch}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0.45} />
              <stop offset="95%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={63} />
        <YAxis tick={{ fontSize: 9 }} />
        <Tooltip
          contentStyle={{ background: "#0f0f14", border: "1px solid #2a2a3a", fontSize: 10 }}
          labelFormatter={(l) => `Value: ${l}`}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {channels.map((ch) => (
          <Area
            key={ch}
            type="monotone"
            dataKey={`${ch}_hist`}
            name={ch}
            stroke={CHANNEL_COLORS[ch]}
            fill={`url(#grad_${ch})`}
            strokeWidth={1}
            dot={false}
          />
        ))}
      </AreaChart>
    );
  }
  return (
    <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
      <XAxis dataKey="i" tick={{ fontSize: 9 }} interval={63} />
      <YAxis domain={[0, 1]} tick={{ fontSize: 9 }} />
      <Tooltip
        contentStyle={{ background: "#0f0f14", border: "1px solid #2a2a3a", fontSize: 10 }}
        formatter={(v: number) => [v.toFixed(4)]}
        labelFormatter={(l) => `Value: ${l}`}
      />
      <Legend wrapperStyle={{ fontSize: 10 }} />
      {channels.map((ch) => (
        <Line
          key={ch}
          type="monotone"
          dataKey={`${ch}_cdf`}
          name={ch}
          stroke={CHANNEL_COLORS[ch]}
          strokeWidth={1.5}
          dot={false}
        />
      ))}
    </LineChart>
  );
};

const renderChart = (
  data: ReturnType<typeof buildChartData>,
  mode: Mode,
  chartView: ChartView,
  empty: boolean
) => {
  if (empty || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/30 text-xs">
        Apply to see result chart
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      {mode === "gray" ? renderGrayChart(data, chartView) : renderRGBChart(data, chartView)}
    </ResponsiveContainer>
  );
};

// ── Main component ───────────────────────────────────────────────────────────

const API_BASE = "http://localhost:8000";

export default function HistogramsTab({ sourceData, imageId }: Props) {
  const [mode, setMode] = useState<Mode>("gray");
  const [action, setAction] = useState<Action>("none");
  const [chartView, setChartView] = useState<ChartView>("histogram");
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<ImageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Source histogram — computed client-side from sourceData, exactly like original ──
  const sourceHistData = useMemo(() => {
    if (!sourceData) return null;
    const data = mode === "gray" ? toGrayscale(sourceData) : sourceData;
    return computeHistogram(data, mode);
  }, [sourceData, mode]);

  // ── Result histogram — computed client-side from processedData, exactly like original ──
  const resultHistData = useMemo(() => {
    if (!processedData) return null;
    return computeHistogram(processedData, mode);
  }, [processedData, mode]);

  const sourceChartData = useMemo(
    () => sourceHistData ? buildChartData(sourceHistData.hist, sourceHistData.cdf, mode) : [],
    [sourceHistData, mode]
  );

  const resultChartData = useMemo(
    () => resultHistData ? buildChartData(resultHistData.hist, resultHistData.cdf, mode) : [],
    [resultHistData, mode]
  );

  const handleApply = async () => {
    if (!sourceData) return;

    // "View Only" — just convert client-side, no server call needed
    if (action === "none") {
      const result = mode === "gray" ? toGrayscale(sourceData) : sourceData;
      setProcessedData(result);
      setResultUrl(imageDataToDataURL(result));
      return;
    }

    // Equalize / Normalize — call server
    if (!imageId) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/apply_histogram?image_id=${imageId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, action }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(detail?.detail ?? `Server error ${res.status}`);
      }

      const json = await res.json() as { result_image: string };

      // Decode the base64 PNG back into an ImageData so the result histogram
      // can be computed client-side exactly as the original did
      const img = new Image();
      img.src = `data:image/png;base64,${json.result_image}`;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      const resultImageData = canvas.getContext("2d")!.getImageData(0, 0, img.width, img.height);

      setProcessedData(resultImageData);
      setResultUrl(`data:image/png;base64,${json.result_image}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 relative">
      <ProcessingOverlay isProcessing={isProcessing} label="Processing..." />

      {/* Controls */}
      <div className="flex gap-2 items-center flex-wrap">
        {/* Mode */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-background/30 border border-border/30">
          {(["gray", "rgb"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResultUrl(null); setProcessedData(null); }}
              className={`toggle-btn ${mode === m ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m === "gray" ? "Grayscale" : "RGB"}
            </button>
          ))}
        </div>

        {/* Action */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-background/30 border border-border/30">
          {(["none", "equalize", "normalize"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={`toggle-btn capitalize ${action === a ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
            >
              {a === "none" ? "View Only" : a}
            </button>
          ))}
        </div>

        {/* Chart view */}
        <div className="flex gap-1 p-0.5 rounded-lg bg-background/30 border border-border/30">
          <button
            onClick={() => setChartView("histogram")}
            className={`toggle-btn flex items-center gap-1 ${chartView === "histogram" ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
          >
            <BarChart3 size={10} /> Histogram
          </button>
          <button
            onClick={() => setChartView("cdf")}
            className={`toggle-btn flex items-center gap-1 ${chartView === "cdf" ? "toggle-btn-active" : "text-muted-foreground hover:text-foreground"}`}
          >
            <TrendingUp size={10} /> CDF
          </button>
        </div>

        <Button
          onClick={handleApply}
          disabled={isProcessing || !sourceData}
          size="sm"
          className="btn-apply"
        >
          <Play size={12} /> Apply
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/40 rounded px-2 py-1">
          {error}
        </div>
      )}

      {/* 2×2 grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 min-h-0">

        {/* Source image */}
        <div className="flex flex-col gap-1 min-h-0">
          <span className="control-label text-center">Source Image</span>
          <div className="image-display flex-1 min-h-0">
            {sourceData ? (
              <SourcePreview data={sourceData} mode={mode} />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/15" />
            )}
          </div>
        </div>

        {/* Source histogram/CDF */}
        <div className="flex flex-col gap-1 min-h-0">
          <span className="control-label text-center">
            Source {chartView === "histogram" ? "Histogram" : "CDF"}
          </span>
          <div className="image-display flex-1 min-h-0 p-2">
            {renderChart(sourceChartData, mode, chartView, sourceChartData.length === 0)}
          </div>
        </div>

        {/* Result image */}
        <div className="flex flex-col gap-1 min-h-0">
          <span className="control-label text-center">
            Result{action !== "none" ? ` (${action}d)` : ""}
          </span>
          <div className="image-display flex-1 min-h-0">
            {resultUrl ? (
              <img src={resultUrl} alt="Result" className="w-full h-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted-foreground/20">
                <ImageIcon size={28} />
                <span className="text-[10px]">Press Apply</span>
              </div>
            )}
          </div>
        </div>

        {/* Result histogram/CDF */}
        <div className="flex flex-col gap-1 min-h-0">
          <span className="control-label text-center">
            Result {chartView === "histogram" ? "Histogram" : "CDF"}
          </span>
          <div className="image-display flex-1 min-h-0 p-2">
            {renderChart(resultChartData, mode, chartView, !resultHistData)}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Source preview — identical to original ───────────────────────────────────

function SourcePreview({ data, mode }: { data: ImageData; mode: Mode }) {
  const url = useMemo(() => {
    const d = mode === "gray" ? toGrayscale(data) : data;
    const c = document.createElement("canvas");
    c.width = d.width;
    c.height = d.height;
    c.getContext("2d")!.putImageData(d, 0, 0);
    return c.toDataURL();
  }, [data, mode]);

  return <img src={url} alt="Source" className="w-full h-full object-contain" />;
}