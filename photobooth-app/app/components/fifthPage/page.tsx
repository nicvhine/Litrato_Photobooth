"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

const FAVORITES_KEY = "litrato_favorites_v1";

type SavedFrame = {
  id: "4-vertical" | "4-2x2" | "1" | "6-2x3" | "2-vertical" | string;
  slots: number;
  title?: string;
  subtitle?: string;
  previewClassName?: string;
};

type FavoritesPayload = {
  frame: SavedFrame;
  selectedIndexes: number[];
  favorites: string[];
  createdAt: string;
};

type FilterKey = "none" | "bw" | "warm" | "cool" | "vintage" | "contrast" | "soft";
type ThemeKey = "classic" | "black" | "cream" | "pink" | "sky" | "gray";

type SliderState = {
  brightness: number;
  contrast: number;
  saturate: number;
  warmth: number;
  fade: number;
  grain: number;
};

type FilterPreset = {
  key: FilterKey;
  label: string;
  sliders: SliderState;
};

function stripConfig(frameId: string) {
  const isStrip = frameId === "4-vertical" || frameId === "2-vertical";
  if (isStrip) {
    return {
      stripWidth: "w-[165px] sm:w-[185px] lg:w-[195px]",
      stripAspect: "aspect-[1/3.08]",
      paperPadding: "px-[10px] pt-[10px] pb-[58px]",
      defaultGrid:
        frameId === "2-vertical"
          ? "grid grid-rows-2 grid-cols-1 gap-2"
          : "grid grid-rows-4 grid-cols-1 gap-2",
    };
  }

  return {
    stripWidth: "w-[220px] sm:w-[250px] lg:w-[270px]",
    stripAspect: "aspect-[2/3]",
    paperPadding: "px-3 pt-3 pb-12",
    defaultGrid:
      frameId === "6-2x3"
        ? "grid grid-rows-3 grid-cols-2 gap-2"
        : frameId === "1"
          ? "grid grid-rows-1 grid-cols-1 gap-2"
          : "grid grid-rows-2 grid-cols-2 gap-2",
  };
}

function themeStyles(theme: ThemeKey) {
  switch (theme) {
    case "black":
      return { paper: "#0b0b0d", ink: "#ffffff" };
    case "cream":
      return { paper: "#fff7e9", ink: "#111827" };
    case "pink":
      return { paper: "#ffe7f2", ink: "#111827" };
    case "sky":
      return { paper: "#e8f2ff", ink: "#111827" };
    case "gray":
      return { paper: "#5d5a5a", ink: "#ffffff" };
    case "classic":
    default:
      return { paper: "#ffffff", ink: "#111827" };
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function photoFilterCss(s: SliderState) {
  const warmSepia = clamp(Math.abs(s.warmth) / 60, 0, 0.35);
  const warmHue = s.warmth >= 0 ? -8 : 8;
  return [
    `brightness(${s.brightness})`,
    `contrast(${s.contrast})`,
    `saturate(${s.saturate})`,
    `sepia(${warmSepia})`,
    `hue-rotate(${warmHue}deg)`,
  ].join(" ");
}

function fadeOverlayOpacity(fade: number) {
  return clamp(fade, 0, 0.35);
}

function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isAppleMobile = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1;
  return isAppleMobile || isIPadOS;
}

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

/**
 * Best-effort download for iOS + Android + desktop:
 * - If Web Share (with files) is available: use it (best UX on iOS/Android).
 * - Else if iOS: open in new tab so user can Share/Save.
 * - Else: <a download> normal download.
 */
async function downloadImageEverywhere(filename: string, blob: Blob) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  try {
    const navAny = navigator as any;
    if (navAny?.canShare?.({ files: [file] }) && navAny?.share) {
      await navAny.share({
        files: [file],
        title: "LITRATO",
        text: "Save your photobooth strip",
      });
      return;
    }
  } catch {
    // ignore and fallback
  }

  const url = URL.createObjectURL(blob);

  if (isIOSDevice()) {
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  if (isAndroidDevice()) {
    setTimeout(() => {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        // ignore
      }
    }, 250);
  }

  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("canvas.toBlob() returned null"));
      else resolve(blob);
    }, "image/png");
  });
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    (img as any).decoding = "async";

    img.onload = async () => {
      try {
        if ("decode" in img) await img.decode();
      } catch {
        // ignore
      }
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Fifth() {
  const [data, setData] = useState<FavoritesPayload | null>(null);

  const [theme, setTheme] = useState<ThemeKey>("classic");
  const [logoText, setLogoText] = useState("LITRATO.");
  const [showDate, setShowDate] = useState(true);

  const presets: FilterPreset[] = useMemo(
    () => [
      {
        key: "none",
        label: "Original",
        sliders: { brightness: 1, contrast: 1, saturate: 1, warmth: 0, fade: 0, grain: 0 },
      },
      {
        key: "soft",
        label: "Soft",
        sliders: {
          brightness: 1.05,
          contrast: 0.98,
          saturate: 0.98,
          warmth: 8,
          fade: 0.1,
          grain: 0.08,
        },
      },
      {
        key: "warm",
        label: "Warm",
        sliders: {
          brightness: 1.03,
          contrast: 1.05,
          saturate: 1.1,
          warmth: 18,
          fade: 0.06,
          grain: 0.1,
        },
      },
      {
        key: "cool",
        label: "Cool",
        sliders: {
          brightness: 1.02,
          contrast: 1.06,
          saturate: 1.05,
          warmth: -18,
          fade: 0.06,
          grain: 0.1,
        },
      },
      {
        key: "vintage",
        label: "Vintage",
        sliders: {
          brightness: 1.04,
          contrast: 0.95,
          saturate: 0.9,
          warmth: 14,
          fade: 0.16,
          grain: 0.18,
        },
      },
      {
        key: "contrast",
        label: "Pop",
        sliders: {
          brightness: 1.0,
          contrast: 1.18,
          saturate: 1.12,
          warmth: 6,
          fade: 0.03,
          grain: 0.08,
        },
      },
      {
        key: "bw",
        label: "B&W",
        sliders: {
          brightness: 1.02,
          contrast: 1.08,
          saturate: 0,
          warmth: 0,
          fade: 0.08,
          grain: 0.14,
        },
      },
    ],
    []
  );

  const [activePreset, setActivePreset] = useState<FilterKey>("soft");
  const [sliders, setSliders] = useState<SliderState>(
    () => presets.find((p) => p.key === "soft")!.sliders
  );

  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const parsed = raw ? (JSON.parse(raw) as FavoritesPayload) : null;
      setData(parsed && parsed.favorites?.length ? parsed : null);
    } catch {
      setData(null);
    }
  }, []);

  const frame = data?.frame ?? null;
  const slots = frame?.slots ?? 0;

  const cfg = useMemo(() => (frame ? stripConfig(frame.id) : null), [frame]);

  const previewClassName = useMemo(() => {
    if (!frame || !cfg) return "";
    return frame.previewClassName ?? cfg.defaultGrid;
  }, [frame, cfg]);

  const themeVars = useMemo(() => themeStyles(theme), [theme]);

  const paperStyle: React.CSSProperties = useMemo(
    () => ({ backgroundColor: themeVars.paper, color: themeVars.ink }),
    [themeVars.paper, themeVars.ink]
  );

  const imgFilterStyle: React.CSSProperties = useMemo(
    () => ({ filter: photoFilterCss(sliders) }),
    [sliders]
  );

  function applyPreset(presetKey: FilterKey) {
    const p = presets.find((x) => x.key === presetKey);
    if (!p) return;
    setActivePreset(presetKey);
    setSliders(p.sliders);
  }

  function resetToActivePreset() {
    applyPreset(activePreset);
  }

  function drawTrackedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    trackingPx: number
  ) {
    if (!text) return;
    const chars = Array.from(text);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + trackingPx * Math.max(0, chars.length - 1);
    let cursor = x - total / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cursor, y);
      cursor += widths[i] + trackingPx;
    }
  }

  function applyCanvasFilter(ctx: CanvasRenderingContext2D, s: SliderState) {
    const warmSepia = clamp(Math.abs(s.warmth) / 60, 0, 0.35);
    const warmHue = s.warmth >= 0 ? -8 : 8;
    ctx.filter = [
      `brightness(${s.brightness})`,
      `contrast(${s.contrast})`,
      `saturate(${s.saturate})`,
      `sepia(${warmSepia})`,
      `hue-rotate(${warmHue}deg)`,
    ].join(" ");
  }

  function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number, amount: number) {
    const a = clamp(amount, 0, 0.35);
    if (a <= 0) return;

    const dots = Math.floor((W * H) / 2200);
    ctx.save();
    ctx.globalAlpha = a * 0.18;
    ctx.fillStyle = "#000";
    for (let i = 0; i < dots; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    ctx.globalAlpha = a * 0.12;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < dots * 0.6; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    ctx.restore();
  }

  async function exportPNG() {
    if (!data || !frame || !cfg) return;

    setExporting(true);

    try {
      const paper = themeVars.paper;
      const ink = themeVars.ink;

      const isStrip = frame.id === "4-vertical" || frame.id === "2-vertical";
      const W = isStrip ? 1000 : 1400;
      const H = isStrip ? Math.round(W * 3.08) : Math.round(W * 1.5);

      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvasRef.current = canvas;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("2D canvas context not available");

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, W, H);

      const padX = Math.round(W * 0.06);
      const padTop = Math.round(H * 0.045);
      const padBottom = Math.round(H * 0.18);

      const contentX = padX;
      const contentY = padTop;
      const contentW = W - padX * 2;
      const contentH = H - padTop - padBottom;

      let rows = 2;
      let cols = 2;
      if (frame.id === "4-vertical") {
        rows = 4;
        cols = 1;
      } else if (frame.id === "2-vertical") {
        rows = 2;
        cols = 1;
      } else if (frame.id === "1") {
        rows = 1;
        cols = 1;
      } else if (frame.id === "6-2x3") {
        rows = 3;
        cols = 2;
      } else if (frame.id === "4-2x2") {
        rows = 2;
        cols = 2;
      }

      const gap = Math.round(Math.min(contentW, contentH) * (isStrip ? 0.018 : 0.02));
      const cellW = Math.floor((contentW - gap * (cols - 1)) / cols);
      const cellH = Math.floor((contentH - gap * (rows - 1)) / rows);

      function clipRect(ctx2: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
        ctx2.beginPath();
        ctx2.rect(x, y, w, h);
        ctx2.closePath();
        ctx2.clip();
      }

      const images = await Promise.all(data.favorites.slice(0, slots).map((src) => loadImage(src)));

      let imgIndex = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (imgIndex >= slots) break;

          const x = contentX + c * (cellW + gap);
          const y = contentY + r * (cellH + gap);

          ctx.save();
          ctx.fillStyle = "rgba(0,0,0,0.06)";
          ctx.fillRect(x, y, cellW, cellH);

          clipRect(ctx, x, y, cellW, cellH);

          applyCanvasFilter(ctx, sliders);

          const img = images[imgIndex];
          const scale = Math.max(cellW / img.width, cellH / img.height);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const dx = x + (cellW - dw) / 2;
          const dy = y + (cellH - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);

          ctx.restore();
          ctx.filter = "none";

          ctx.strokeStyle = "rgba(0,0,0,0.10)";
          ctx.lineWidth = Math.max(1, Math.round(W * 0.0012));
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);

          const f = fadeOverlayOpacity(sliders.fade);
          if (f > 0) {
            ctx.save();
            ctx.globalAlpha = f;
            ctx.fillStyle = "#fff";
            ctx.fillRect(x, y, cellW, cellH);
            ctx.restore();
          }

          imgIndex++;
        }
      }

      drawGrain(ctx, W, H, sliders.grain);

      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";

      const logoY = H - Math.round(H * 0.095);
      const dateY = H - Math.round(H * 0.055);

      ctx.font = `800 ${Math.round(W * 0.048)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
      drawTrackedText(ctx, (logoText || "LITRATO.").trim(), W / 2, logoY, Math.round(W * 0.008));

      if (showDate) {
        ctx.font = `600 ${Math.round(W * 0.028)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
        ctx.fillStyle = ink === "#ffffff" ? "rgba(255,255,255,0.78)" : "rgba(17,24,39,0.58)";
        const date = new Date(data.createdAt || Date.now()).toLocaleDateString();
        ctx.fillText(date, W / 2, dateY);
      }

      const blob = await canvasToPngBlob(canvas);
      await downloadImageEverywhere("litrato-strip.png", blob);
    } catch (e) {
      console.error(e);
      alert(
        "Export failed. On iPhone/iPad/Android, your browser may show a share sheet instead of a direct download."
      );
    } finally {
      setExporting(false);
    }
  }

  const downloadHint = useMemo(() => {
    if (typeof navigator === "undefined") return "";
    const navAny = navigator as any;
    const sharePossible = !!navAny?.canShare && !!navAny?.share;
    if (sharePossible) return "Tip: your phone will open a Share sheet—choose Save Image / Files.";
    if (isIOSDevice()) return "Tip: on iPhone/iPad it may open in a new tab—use Share → Save Image.";
    if (isAndroidDevice()) return "Tip: on Android it should download or open—use Save/Download if prompted.";
    return "";
  }, []);

  if (!data || !frame || !cfg) {
    return (
      <div className="min-h-screen bg-[#fbfbfc] px-4 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-xl font-semibold text-gray-900">Nothing to decorate</h1>
          <p className="mt-1 text-sm text-gray-600">Go back and select your favorites first.</p>
          <div className="mt-4">
            <Link
              href="/pages/fourth"
              className="text-sm text-gray-700 hover:text-gray-900 underline underline-offset-4"
            >
              Back to selection
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const previewGrainOpacity = clamp(sliders.grain, 0, 0.35) * 0.45;

  return (
    <div className="min-h-screen bg-[#fbfbfc] px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-gray-500">DECORATE</div>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">Finish your strip</h1>
            {downloadHint ? <p className="mt-2 text-xs text-gray-500">{downloadHint}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pages/fourth"
              className="text-sm text-gray-700 hover:text-gray-900 underline underline-offset-4"
            >
              Back
            </Link>

            <button
              type="button"
              onClick={exportPNG}
              disabled={exporting}
              className={cx(
                "rounded-full px-5 py-2 text-sm font-semibold transition",
                exporting
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/15"
              )}
            >
              {exporting ? "Exporting..." : "Download / Share"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[360px_360px_1fr] gap-6 items-start">
          <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-sm font-medium text-gray-900">Theme & filters</div>

            <div className="mt-4">
              <label className="text-xs text-gray-500">Theme</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["classic", "black", "cream", "pink", "sky", "gray"] as ThemeKey[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm capitalize transition",
                      theme === t ? "border-red-600 ring-2 ring-red-200" : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs text-gray-500">Auto filters</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className={cx(
                      "rounded-xl border px-3 py-2 text-sm transition",
                      activePreset === p.key
                        ? "border-red-600 ring-2 ring-red-200"
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-200/70 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
            <div className="text-sm font-medium text-gray-900">Fine tune</div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Adjustments</label>
                <button
                  type="button"
                  onClick={resetToActivePreset}
                  className="text-xs text-gray-600 hover:text-gray-900 underline underline-offset-4"
                >
                  Reset
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <Slider
                  label="Brightness"
                  min={0.7}
                  max={1.3}
                  step={0.01}
                  value={sliders.brightness}
                  onChange={(v) => setSliders((s) => ({ ...s, brightness: v }))}
                />
                <Slider
                  label="Contrast"
                  min={0.7}
                  max={1.3}
                  step={0.01}
                  value={sliders.contrast}
                  onChange={(v) => setSliders((s) => ({ ...s, contrast: v }))}
                />
                <Slider
                  label="Saturation"
                  min={0}
                  max={1.6}
                  step={0.01}
                  value={sliders.saturate}
                  onChange={(v) => setSliders((s) => ({ ...s, saturate: v }))}
                />
                <Slider
                  label="Warmth"
                  min={-25}
                  max={25}
                  step={1}
                  value={sliders.warmth}
                  onChange={(v) => setSliders((s) => ({ ...s, warmth: v }))}
                />
                <Slider
                  label="Fade"
                  min={0}
                  max={0.35}
                  step={0.01}
                  value={sliders.fade}
                  onChange={(v) => setSliders((s) => ({ ...s, fade: v }))}
                />
                <Slider
                  label="Grain"
                  min={0}
                  max={0.35}
                  step={0.01}
                  value={sliders.grain}
                  onChange={(v) => setSliders((s) => ({ ...s, grain: v }))}
                />
              </div>
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">

              <div className="mt-3 flex items-center gap-2">
                <input
                  id="showDate"
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                />
                <label htmlFor="showDate" className="text-sm text-gray-700">
                  Show date
                </label>
              </div>
            </div>
          </section>

          <section className="flex justify-center lg:justify-start">
            <div className="flex flex-col items-center lg:items-start">
              <div
                className={cx(
                  cfg.stripWidth,
                  cfg.stripAspect,
                  "border border-gray-200 shadow-[0_18px_40px_rgba(0,0,0,0.10)]",
                  cfg.paperPadding,
                  "relative bg-white"
                )}
                style={paperStyle}
              >
                <div className={cx(previewClassName, "h-full w-full relative z-[1]")}>
                  {Array.from({ length: slots }).map((_, slotIndex) => {
                    const src = data.favorites[slotIndex];
                    return (
                      <div key={slotIndex} className="relative overflow-hidden bg-black/5 border border-black/10">
                        {src ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`Photo ${slotIndex + 1}`}
                              className="w-full h-full object-cover object-center"
                              style={imgFilterStyle}
                              draggable={false}
                            />
                            {sliders.fade > 0 && (
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: "white",
                                  opacity: fadeOverlayOpacity(sliders.fade),
                                  mixBlendMode: "screen",
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            Empty
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {previewGrainOpacity > 0 && (
                  <div
                    className="absolute inset-0 pointer-events-none z-[2]"
                    style={{
                      opacity: previewGrainOpacity,
                      backgroundImage:
                        "radial-gradient(circle at 10% 20%, rgba(0,0,0,0.9) 1px, transparent 1px), radial-gradient(circle at 70% 50%, rgba(0,0,0,0.75) 1px, transparent 1px), radial-gradient(circle at 30% 80%, rgba(0,0,0,0.8) 1px, transparent 1px)",
                      backgroundSize: "18px 18px",
                      mixBlendMode: "overlay",
                    }}
                    aria-hidden="true"
                  />
                )}

                <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center justify-center z-[3] pointer-events-none">
                  <div className="text-[10px] tracking-[0.42em] font-semibold">
                    {(logoText || "LITRATO.").trim()}
                  </div>
                  {showDate && (
                    <div
                      className="mt-1 text-[9px] tabular-nums"
                      style={{
                        color:
                          themeVars.ink === "#ffffff"
                            ? "rgba(255,255,255,0.78)"
                            : "rgba(17,24,39,0.58)",
                      }}
                    >
                      {new Date(data.createdAt || Date.now()).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}

function Slider(props: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">{props.label}</div>
        <div className="text-xs text-gray-400 tabular-nums">{props.value.toFixed(2)}</div>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 w-full"
      />
    </div>
  );
}