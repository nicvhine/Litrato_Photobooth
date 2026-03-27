"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SHOTS_KEY = "litrato_shots_v1";
const FRAME_KEY = "litrato_frame_v1";
const FAVORITES_KEY = "litrato_favorites_v1";

type SavedFrame = {
  id: "4-vertical" | "4-2x2" | "1" | "6-2x3" | "2-vertical" | string;
  slots: number;
  title?: string;
  subtitle?: string;
  previewClassName?: string; // stored from second.tsx
};

function stripConfig(frameId: string) {
  // Photostrip sizes (Korean booth vibe)
  if (frameId === "4-vertical" || frameId === "2-vertical") {
    return {
      stripWidth: "w-[200px] sm:w-[215px]",
      stripAspect: "aspect-[1/3]", // tall narrow
      paperPadding: "px-[12px] pt-[12px] pb-[44px]", // big bottom space for logo
      defaultGrid: "grid grid-rows-4 grid-cols-1 gap-2",
    };
  }

  // Grid frames / single print
  return {
    stripWidth: "w-[260px] sm:w-[290px]",
    stripAspect: "aspect-[2/3]",
    paperPadding: "px-3 pt-3 pb-10",
    defaultGrid: "grid grid-rows-2 grid-cols-2 gap-2",
  };
}

export default function Fourth() {
  const router = useRouter();

  const [frame, setFrame] = useState<SavedFrame | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    // Load frame
    try {
      const raw = localStorage.getItem(FRAME_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedFrame) : null;
      setFrame(parsed);
    } catch {
      setFrame(null);
    }

    // Load shots
    try {
      const rawShots = localStorage.getItem(SHOTS_KEY);
      const parsedShots = rawShots ? (JSON.parse(rawShots) as string[]) : [];
      setShots(Array.isArray(parsedShots) ? parsedShots : []);
    } catch {
      setShots([]);
    }
  }, []);

  const slots = frame?.slots ?? 0;

  const favorites = useMemo(() => {
    return selected.map((idx) => shots[idx]).filter(Boolean);
  }, [selected, shots]);

  const canContinue = useMemo(() => {
    return slots > 0 && selected.length === slots;
  }, [selected.length, slots]);

  function toggle(i: number) {
    if (!slots) return;

    setSelected((prev) => {
      const exists = prev.includes(i);
      if (exists) return prev.filter((x) => x !== i);

      if (prev.length >= slots) return prev;
      return [...prev, i];
    });
  }

  function removeBySlot(slotIndex: number) {
    setSelected((prev) => prev.filter((_, i) => i !== slotIndex));
  }

  function move(slotIndex: number, dir: -1 | 1) {
    setSelected((prev) => {
      const to = slotIndex + dir;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[slotIndex], next[to]] = [next[to], next[slotIndex]];
      return next;
    });
  }

  function saveAndContinue() {
    if (!canContinue) return;

    localStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify({
        frame,
        selectedIndexes: selected,
        favorites,
        createdAt: new Date().toISOString(),
      })
    );

    router.push("/pages/fifth");
  }

  if (!frame || !slots) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-xl font-bold">Missing frame selection</h1>
          <p className="mt-1 text-sm text-gray-600">
            Please go back and choose a frame first.
          </p>
          <div className="mt-4">
            <Link
              href="/pages/second"
              className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-4"
            >
              Go to frames
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!shots.length) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-xl font-bold">No shots found</h1>
          <p className="mt-1 text-sm text-gray-600">
            Please take your photos again.
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href="/pages/third"
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
            >
              Retake
            </Link>
            <Link
              href="/pages/second"
              className="self-center text-sm text-gray-600 hover:text-gray-900 underline underline-offset-4"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const cfg = stripConfig(frame.id);
  const previewClassName = frame.previewClassName ?? cfg.defaultGrid;

  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              Pick {slots} {slots === 1 ? "photo" : "photos"}
            </h1>
            <p className="mt-1 text-xs text-gray-500">
              Selected: {selected.length}/{slots}
            </p>
          </div>
        </div>

        {/* Two-pane layout */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          {/* LEFT: all shots (smaller thumbs) */}
        <div>
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-2 gap-1">
            {shots.map((src, i) => {
            const isSelected = selected.includes(i);
            const order = isSelected ? selected.indexOf(i) + 1 : null;
            const atLimit = !isSelected && selected.length >= slots;

            return (
                <button
                key={i}
                type="button"
                onClick={() => toggle(i)}
                disabled={atLimit}
                aria-pressed={isSelected}
                className={[
                    "relative overflow-hidden rounded-md border transition-all focus:outline-none focus:ring-2 focus:ring-red-300",
                    isSelected
                    ? "border-red-600 ring-1 ring-red-200"
                    : "border-gray-200 hover:shadow-sm",
                    atLimit ? "opacity-50 cursor-not-allowed" : "",
                ].join(" ")}
                title={
                    isSelected
                    ? "Remove from favorites"
                    : atLimit
                        ? `You can only pick ${slots}`
                        : "Add to favorites"
                }
                >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={src}
                    alt={`Shot ${i + 1}`}
                    // ✅ smaller + less “zoom” cropping than 3/4
                    className="w-full aspect-[4/3] object-cover max-h-40"
                />

                <div className="absolute top-1 left-1 rounded-full bg-black/60 text-white text-[9px] px-1 py-0.5">
                    {i + 1}
                </div>

                {isSelected && (
                    <div className="absolute top-1 right-1 rounded-full bg-red-600 text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center">
                    {order}
                    </div>
                )}
                </button>
            );
            })}
        </div>
        </div>

          {/* RIGHT: photostrip preview (no gray card background) */}
          <aside className="lg:sticky lg:top-6">
            <div className="flex flex-col items-center">
              {/* The strip itself (white only, like a real print) */}
              <div
                className={[
                  cfg.stripWidth,
                  cfg.stripAspect,
                  "bg-white border border-gray-200 shadow-sm",
                  cfg.paperPadding,
                  "relative",
                ].join(" ")}
              >
                {/* Photos grid */}
                <div className={[previewClassName, "h-full w-full"].join(" ")}>
                  {Array.from({ length: slots }).map((_, slotIndex) => {
                    const src = favorites[slotIndex];

                    return (
                      <div
                        key={slotIndex}
                        className={[
                          "relative overflow-hidden bg-gray-100 border border-black/10",
                        ].join(" ")}
                      >
                        {src ? (
                          <button
                            type="button"
                            onClick={() => removeBySlot(slotIndex)}
                            className="group block w-full h-full"
                            title="Remove from strip"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={`Favorite ${slotIndex + 1}`}
                              className="w-full h-full object-cover"
                            />

                            {/* subtle hover */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/15" />

                            {/* slot number */}
                            <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                              {slotIndex + 1}
                            </div>

                            {/* reorder controls */}
                            <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  move(slotIndex, -1);
                                }}
                                disabled={slotIndex === 0}
                                className={[
                                  "rounded-md bg-white/90 border border-gray-200 px-2 py-1 text-[10px] hover:bg-white",
                                  slotIndex === 0 ? "opacity-40 cursor-not-allowed" : "",
                                ].join(" ")}
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  move(slotIndex, 1);
                                }}
                                disabled={slotIndex === selected.length - 1}
                                className={[
                                  "rounded-md bg-white/90 border border-gray-200 px-2 py-1 text-[10px] hover:bg-white",
                                  slotIndex === selected.length - 1
                                    ? "opacity-40 cursor-not-allowed"
                                    : "",
                                ].join(" ")}
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                          </button>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                            Slot {slotIndex + 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Logo area bottom (bigger space already reserved via pb-*) */}
                <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                  <div className="text-[11px] tracking-[0.35em] font-semibold text-gray-800">
                    LITRATO.
                  </div>
                </div>
              </div>

              {/* Actions under the strip (no background card) */}
              <div className="mt-4 w-full flex items-center justify-end">
                <button
                  type="button"
                  onClick={saveAndContinue}
                  disabled={!canContinue}
                  className={[
                    "justify-end rounded-full px-6 py-2 text-sm font-semibold transition-all",
                    canContinue
                      ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed",
                  ].join(" ")}
                >
                  Continue
                </button>
              </div>

            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}