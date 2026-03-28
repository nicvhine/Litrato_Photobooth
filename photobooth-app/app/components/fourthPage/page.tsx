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
  previewClassName?: string;
};

function stripConfig(frameId: string) {
  if (frameId === "4-vertical" || frameId === "2-vertical") {
    return {
      stripWidth: "w-[200px] sm:w-[215px]",
      stripAspect: "aspect-[1/3]",
      paperPadding: "px-[12px] pt-[12px] pb-[44px]",
      defaultGrid: "grid grid-rows-4 grid-cols-1 gap-2",
    };
  }

  return {
    stripWidth: "w-[260px] sm:w-[290px]",
    stripAspect: "aspect-[2/3]",
    paperPadding: "px-3 pt-3 pb-10",
    defaultGrid: "grid grid-rows-2 grid-cols-2 gap-2",
  };
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function Fourth() {
  const router = useRouter();

  const [frame, setFrame] = useState<SavedFrame | null>(null);
  const [shots, setShots] = useState<string[]>([]);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FRAME_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedFrame) : null;
      setFrame(parsed);
    } catch {
      setFrame(null);
    }

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

  function clearSelection() {
    setSelected([]);
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

    router.push("/components/fifthPage");
  }

  if (!frame || !slots) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-xl font-bold text-gray-900">Missing frame selection</h1>
          <p className="mt-1 text-sm text-gray-600">
            Please go back and choose a frame first.
          </p>
          <div className="mt-5">
            <Link
              href="/components/secondPage"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              ← Go to frames
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!shots.length) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 px-4 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-xl font-bold text-gray-900">No shots found</h1>
          <p className="mt-1 text-sm text-gray-600">Please take your photos again.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/components/thirdPage"
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 shadow-sm shadow-red-600/15"
            >
              Retake
            </Link>
            <Link
              href="/components/secondPage"
              className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Back
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const cfg = stripConfig(frame.id);
  const previewClassName = frame.previewClassName ?? cfg.defaultGrid;

  const atLimit = selected.length >= slots;
  const remaining = Math.max(0, slots - selected.length);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px]">
            <Link
              href="/components/thirdPage"
              className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <span aria-hidden="true">←</span>
              Back to camera
            </Link>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gray-900">
              Pick {slots} {slots === 1 ? "photo" : "photos"}
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              {remaining > 0 ? (
                <>
                  Choose{" "}
                  <span className="font-semibold text-gray-900">{remaining}</span>{" "}
                  more.
                </>
              ) : (
                <>
                  Selection complete.{" "}
                  <span className="font-semibold text-gray-900">Continue</span> when
                  ready.
                </>
              )}
            </p>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              disabled={selected.length === 0}
              className={cx(
                "rounded-full border px-4 py-2 text-sm font-semibold transition",
                selected.length === 0
                  ? "border-gray-200 bg-white text-gray-400 cursor-not-allowed"
                  : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
              )}
            >
              Clear
            </button>

            <button
              type="button"
              onClick={saveAndContinue}
              disabled={!canContinue}
              className={cx(
                "rounded-full px-6 py-2 text-sm font-semibold transition-all",
                canContinue
                  ? "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-600/15"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              )}
            >
              Continue
            </button>
          </div>
        </header>

        {/* Layout */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* LEFT: shots */}
          <section>
            <div className="rounded-3xl border border-gray-200 bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 px-1 pb-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">All shots</div>
                  <div className="text-xs text-gray-500">
                    Tap to select. Tap again to remove.
                  </div>
                </div>

                {atLimit && (
                  <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 border border-red-100">
                    Limit reached
                  </div>
                )}
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-3 gap-2">
                {shots.map((src, i) => {
                  const isSelected = selected.includes(i);
                  const order = isSelected ? selected.indexOf(i) + 1 : null;
                  const disabled = !isSelected && selected.length >= slots;

                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle(i)}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={cx(
                        "relative overflow-hidden rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-red-300",
                        isSelected
                          ? "border-red-600 ring-1 ring-red-200"
                          : "border-gray-200 hover:shadow-sm hover:border-gray-300",
                        disabled && "opacity-55 cursor-not-allowed"
                      )}
                      title={
                        isSelected
                          ? "Remove from favorites"
                          : disabled
                            ? `You can only pick ${slots}`
                            : "Add to favorites"
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Shot ${i + 1}`}
                        className="w-full aspect-[4/3] object-cover"
                        draggable={false}
                      />

                      {/* shot number */}
                      <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                        {i + 1}
                      </div>

                      {/* selected order badge */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center shadow-sm">
                          {order}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* RIGHT: strip preview */}
          <aside className="lg:sticky lg:top-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Preview</div>
                  <div className="text-xs text-gray-500">
                    Click to remove
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col items-center">
                <div
                  className={cx(
                    cfg.stripWidth,
                    cfg.stripAspect,
                    "bg-white border border-gray-200 shadow-sm",
                    cfg.paperPadding,
                    "relative"
                  )}
                >
                  <div className={cx(previewClassName, "h-full w-full")}>
                    {Array.from({ length: slots }).map((_, slotIndex) => {
                      const src = favorites[slotIndex];

                      return (
                        <div
                          key={slotIndex}
                          className="relative overflow-hidden bg-gray-100 border border-black/10"
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
                                draggable={false}
                              />

                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/15" />

                              <div className="absolute top-1.5 left-1.5 rounded-full bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                                {slotIndex + 1}
                              </div>
                            </button>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-xs text-gray-400">
                              <div className="font-semibold">Slot {slotIndex + 1}</div>
                              <div className="mt-1">Pick a photo</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
                    <div className="text-[11px] tracking-[0.35em] font-semibold text-gray-800">
                      LITRATO.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}