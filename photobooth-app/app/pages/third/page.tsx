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
    // hard guard: never allow overlapping captures
    if (isCapturingRef.current) return;
    if (!videoRef.current) return;
    if (!ready) return;

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
        // ✅ most reliable place to enforce MAX_SHOTS
        if (prev.length >= MAX_SHOTS) return prev;

        // If the exact same frame somehow gets captured twice in a row, block it:
        // (optional safety; remove if you don't want this)
        if (prev[prev.length - 1] === dataUrl) return prev;

        const next = [...prev, dataUrl].slice(0, MAX_SHOTS);
        persistShots(next);

        // stop auto immediately when hitting max
        if (next.length >= MAX_SHOTS) stopAuto();

        return next;
      });
    } finally {
      // small cooldown prevents double-fire from interval tick jitter
      window.setTimeout(() => {
        isCapturingRef.current = false;
      }, 180);
    }
  }

  function startAuto() {
    if (isAutoRef.current) return;
    if (!ready) return;
    if (photos.length >= MAX_SHOTS) return;

    isAutoRef.current = true;
    setIsAuto(true);

    // start at 5 if you want; 5 is fine
    setCountdown(5);

    if (countdownRef.current) window.clearInterval(countdownRef.current);

    countdownRef.current = window.setInterval(() => {
      setCountdown((c) => {
        const current = c ?? 5;
        const next = current - 1;

        if (next <= 0) {
          capture();
          return 5; // reset for next shot
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
    // wipe previous shots only
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

  async function handleOkayAndStart() {
    setShowShotsPopup(false);
    await startCamera(facingMode);
  }

  const canTakeMore = photos.length < MAX_SHOTS;

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-start justify-start gap-4">
          <div />
          <Link
            href="/pages/second"
            className="text-gray-600 hover:text-gray-900 underline underline-offset-4"
          >
            Back
          </Link>
        </div>

        {/* Centered Camera */}
        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-2xl rounded-3xl border border-gray-200 overflow-hidden bg-black">
            <div className="relative aspect-[4/3] sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className={[
                  "w-full h-full object-cover",
                  facingMode === "user" ? "scale-x-[-1]" : "",
                ].join(" ")}
              />

              {/* Shutter flash overlay */}
              <div
                className={[
                  "absolute inset-0 pointer-events-none transition-opacity duration-150",
                  isShuttering ? "opacity-100" : "opacity-0",
                ].join(" ")}
                style={{ background: "white", mixBlendMode: "screen" }}
                aria-hidden="true"
              />

              {/* Countdown overlay */}
              {isAuto && ready && canTakeMore && countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rounded-full bg-black/60 text-white font-bold w-20 h-20 flex items-center justify-center text-3xl">
                    {countdown}
                  </div>
                </div>
              )}

              {!ready && !error && !showShotsPopup && (
                <div className="absolute inset-0 flex items-center justify-center text-white/90">
                  Starting camera…
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center gap-3">
                  <div className="font-semibold">Camera error</div>
                  <div className="text-sm text-white/80">{error}</div>
                  <button
                    className="mt-2 bg-white text-black px-5 py-2 rounded-full font-semibold"
                    onClick={() => startCamera(facingMode)}
                    type="button"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="p-4 bg-white">
              <div className="grid grid-cols-3 items-center gap-3">
                <div className="justify-self-start">
                  <button
                    onClick={flipCamera}
                    className="px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50"
                    type="button"
                    disabled={showShotsPopup}
                    aria-disabled={showShotsPopup}
                    title={showShotsPopup ? "Press OKAY to start camera" : "Flip"}
                  >
                    Flip
                  </button>
                </div>

                <div className="justify-self-center flex items-center gap-3">
                  <button
                    onClick={startAuto}
                    disabled={!ready || !canTakeMore || showShotsPopup}
                    className={[
                      "px-8 py-3 rounded-full font-semibold transition-all flex items-center justify-center",
                      ready && canTakeMore && !showShotsPopup
                        ? "bg-red-600 text-white hover:bg-red-700 shadow-md"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed",
                    ].join(" ")}
                    type="button"
                    aria-label="Start shutter (5s)"
                    title="Start shutter (5s)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="h-6 w-6"
                      aria-hidden="true"
                    >
                      <path d="M9 2a1 1 0 0 0-.8.4L6.75 4H5a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3h-1.75L15.8 2.4A1 1 0 0 0 15 2H9zm3 6a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z" />
                    </svg>
                  </button>

                  <span className="text-sm text-gray-600 tabular-nums whitespace-nowrap">
                    {photos.length}/{MAX_SHOTS}
                  </span>
                </div>

                <div className="justify-self-end" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showShotsPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="text-lg text-gray-900">
              You only have 8 shots. Make the best out of it.
            </div>

            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={handleOkayAndStart}
                className="px-5 py-2 rounded-full bg-black text-white font-semibold hover:bg-gray-900"
              >
                OKAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}