"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type FacingMode = "user" | "environment";

const MAX_SHOTS = 8;

const SHOTS_KEY = "litrato_shots_v1";
const FRAME_KEY = "litrato_frame_v1";

type SavedFrame = {
  id: string;
  slots: number;
  title?: string;
  subtitle?: string;
};

export default function Third() {
  const router = useRouter();

  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  // shutter effect
  const [isShuttering, setIsShuttering] = useState(false);
  const shutterTimeoutRef = useRef<number | null>(null);

  // popup gate
  const [showShotsPopup, setShowShotsPopup] = useState(true);

  // auto shutter + countdown
  const [isAuto, setIsAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // timers
  const countdownRef = useRef<number | null>(null);

  // synchronous guards
  const isAutoRef = useRef(false);
  const isCapturingRef = useRef(false);

  const canTakeMore = photos.length < MAX_SHOTS;
  const controlsLocked = showShotsPopup || !!error;

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function stopAuto() {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    countdownRef.current = null;

    isAutoRef.current = false;
    setIsAuto(false);
    setCountdown(null);
  }

  function persistShots(next: string[]) {
    try {
      localStorage.setItem(SHOTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function triggerShutter() {
    if (shutterTimeoutRef.current) window.clearTimeout(shutterTimeoutRef.current);

    setIsShuttering(true);
    shutterTimeoutRef.current = window.setTimeout(() => {
      setIsShuttering(false);
      shutterTimeoutRef.current = null;
    }, 120);
  }

  function capture() {
    if (isCapturingRef.current) return;
    if (!videoRef.current) return;
    if (!ready) return;
    if (!canTakeMore) return;

    isCapturingRef.current = true;

    try {
      const video = videoRef.current;

      const canvas = document.createElement("canvas");
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      triggerShutter();

      // mirror for selfie camera
      if (facingMode === "user") {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, w, h);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

      setPhotos((prev) => {
        if (prev.length >= MAX_SHOTS) return prev;
        if (prev[prev.length - 1] === dataUrl) return prev;

        const next = [...prev, dataUrl].slice(0, MAX_SHOTS);
        persistShots(next);

        if (next.length >= MAX_SHOTS) stopAuto();
        return next;
      });
    } finally {
      window.setTimeout(() => {
        isCapturingRef.current = false;
      }, 180);
    }
  }

  function startAuto() {
    if (isAutoRef.current) return;
    if (!ready) return;
    if (!canTakeMore) return;

    isAutoRef.current = true;
    setIsAuto(true);

    setCountdown(5);

    if (countdownRef.current) window.clearInterval(countdownRef.current);

    countdownRef.current = window.setInterval(() => {
      setCountdown((c) => {
        const current = c ?? 5;
        const next = current - 1;

        if (next <= 0) {
          capture();
          return 5;
        }

        return next;
      });
    }, 1000);
  }

  async function startCamera(mode: FacingMode) {
    setError(null);
    setReady(false);

    stopAuto();
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve) => {
        const v = videoRef.current!;
        const onLoaded = () => {
          v.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        v.addEventListener("loadedmetadata", onLoaded);
      });

      await videoRef.current.play();
      setReady(true);
    } catch (e: any) {
      setError(e?.message ?? "Could not access the camera.");
      setReady(false);
    }
  }

  // init
  useEffect(() => {
    try {
      localStorage.removeItem(SHOTS_KEY);
    } catch {
      // ignore
    }

    return () => {
      stopAuto();
      stopStream();

      if (shutterTimeoutRef.current) {
        window.clearTimeout(shutterTimeoutRef.current);
        shutterTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // after 8 shots -> go to fourth
  useEffect(() => {
    if (photos.length === MAX_SHOTS) {
      persistShots(photos);

      let frame: SavedFrame | null = null;
      try {
        const raw = localStorage.getItem(FRAME_KEY);
        frame = raw ? (JSON.parse(raw) as SavedFrame) : null;
      } catch {
        frame = null;
      }

      if (!frame?.slots) {
        router.replace("/pages/second");
        return;
      }

      router.replace("/pages/fourth");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos.length]);

  async function flipCamera() {
    stopAuto();
    const next: FacingMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    await startCamera(next);
  }

  async function handleStart() {
    setShowShotsPopup(false);
    await startCamera(facingMode);
  }

  const progressPct = Math.round((photos.length / MAX_SHOTS) * 100);

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/pages/second"
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <span aria-hidden="true">←</span>
            Back
          </Link>

          <div className="w-[120px] text-right">
            <div className="text-sm font-semibold tabular-nums text-gray-900">
              {photos.length}/{MAX_SHOTS}
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-red-600 transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </header>

        {/* Camera card */}
        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <div className="relative bg-black">
              <div className="relative aspect-[4/3] sm:aspect-video">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={[
                    "h-full w-full object-cover",
                    facingMode === "user" ? "scale-x-[-1]" : "",
                  ].join(" ")}
                />

                {/* subtle top/bottom fades to help overlays */}
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden="true"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0) 30%), linear-gradient(to top, rgba(0,0,0,0.35), rgba(0,0,0,0) 30%)",
                  }}
                />

                {/* Shutter flash overlay */}
                <div
                  className={[
                    "pointer-events-none absolute inset-0 transition-opacity duration-150",
                    isShuttering ? "opacity-100" : "opacity-0",
                  ].join(" ")}
                  style={{ background: "white", mixBlendMode: "screen" }}
                  aria-hidden="true"
                />

                {/* Countdown overlay */}
                {isAuto && ready && canTakeMore && countdown !== null && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="grid place-items-center rounded-full bg-black/65 text-white shadow-2xl ring-1 ring-white/15">
                      <div className="h-24 w-24 rounded-full grid place-items-center">
                        <span className="text-4xl font-extrabold tabular-nums">
                          {countdown}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!ready && !error && !showShotsPopup && (
                  <div className="absolute inset-0 grid place-items-center text-white/90">
                    <div className="rounded-2xl bg-black/45 px-4 py-2 text-sm">
                      Starting camera…
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                    <div className="text-lg font-semibold">Camera error</div>
                    <div className="text-sm text-white/80">{error}</div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-gray-100"
                        onClick={() => startCamera(facingMode)}
                        type="button"
                      >
                        Try again
                      </button>
                      <Link
                        href="/pages/second"
                        className="rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        Go back
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="p-4 sm:p-5">
              <div className="grid grid-cols-3 items-center gap-3">
                {/* Left */}
                <div className="justify-self-start">
                  <button
                    onClick={flipCamera}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={controlsLocked || !ready}
                    title={showShotsPopup ? "Start camera first" : "Flip camera"}
                  >
                    Flip
                  </button>
                </div>

                {/* Center */}
                <div className="justify-self-center flex items-center gap-3">
                  <button
                    onClick={isAuto ? stopAuto : startAuto}
                    disabled={!ready || !canTakeMore || controlsLocked}
                    className={[
                      "inline-flex items-center justify-center rounded-full px-8 py-3 text-sm font-semibold transition",
                      ready && canTakeMore && !controlsLocked
                        ? isAuto
                          ? "bg-gray-900 text-white hover:bg-black"
                          : "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-600/15"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed",
                    ].join(" ")}
                    type="button"
                  >
                    {isAuto ? "Stop auto" : "Start auto (5s)"}
                  </button>

                  <button
                    onClick={capture}
                    disabled={!ready || !canTakeMore || controlsLocked}
                    className={[
                      "rounded-full border px-5 py-3 text-sm font-semibold transition",
                      ready && canTakeMore && !controlsLocked
                        ? "border-gray-200 text-gray-900 hover:bg-gray-50"
                        : "border-gray-200 text-gray-400 cursor-not-allowed",
                    ].join(" ")}
                    type="button"
                    title="Take one photo now"
                  >
                    Snap
                  </button>
                </div>

              </div>

              {/* Helper line */}
              <div className="mt-4 text-center text-xs text-gray-500">
                Tip: Use <span className="font-semibold text-gray-700">Snap</span>{" "}
                for manual shots, or{" "}
                <span className="font-semibold text-gray-700">Start auto</span>{" "}
                for the countdown.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popup */}
      {showShotsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="text-sm font-semibold text-gray-900">Heads up</div>
            <div className="mt-2 text-lg font-semibold text-gray-900">
              You only get {MAX_SHOTS} shots.
            </div>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              Tap <span className="font-semibold text-gray-800">Start auto</span>{" "}
              to begin a 5-second countdown between photos, or{" "}
              <span className="font-semibold text-gray-800">Snap</span> to take
              one instantly.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Link
                href="/pages/second"
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={handleStart}
                className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Start camera
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}