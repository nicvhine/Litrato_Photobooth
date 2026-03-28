import { useCallback, useMemo, useRef, useState } from "react";

const MAX_SHOTS = 8;

export function useCameraCapture() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // shutter effect
  const [isShuttering, setIsShuttering] = useState(false);
  const shutterTimeoutRef = useRef<number | null>(null);

  // popup gate
  const [showShotsPopup, setShowShotsPopup] = useState(true);

  const [isAuto, setIsAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const countdownRef = useRef<number | null>(null);

  // synchronous guards
  const isAutoRef = useRef(false);
  const isCapturingRef = useRef(false);

  const canTakeMore = photos.length < MAX_SHOTS;
  const controlsLocked = showShotsPopup || !!error;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopAuto = useCallback(() => {
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    countdownRef.current = null;

    isAutoRef.current = false;
    setIsAuto(false);
    setCountdown(null);
  }, []);

  const persistShots = useCallback((next: string[]) => {
    try {
      localStorage.setItem("litrato_shots_v1", JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const triggerShutter = useCallback(() => {
    if (shutterTimeoutRef.current) window.clearTimeout(shutterTimeoutRef.current);

    setIsShuttering(true);
    shutterTimeoutRef.current = window.setTimeout(() => {
      setIsShuttering(false);
      shutterTimeoutRef.current = null;
    }, 120);
  }, []);

  const capture = useCallback(() => {
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
  }, [canTakeMore, facingMode, persistShots, ready, stopAuto, triggerShutter]);

  const startAuto = useCallback(() => {
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
  }, [canTakeMore, capture, ready]);

  return useMemo(
    () => ({
      // state
      photos,
      error,
      ready,
      facingMode,
      isShuttering,
      showShotsPopup,
      isAuto,
      countdown,
      canTakeMore,
      controlsLocked,

      // setters/refs (export what you actually need)
      setPhotos,
      setError,
      setReady,
      setFacingMode,
      setShowShotsPopup,
      videoRef,
      streamRef,

      // actions
      triggerShutter,
      persistShots,
      stopAuto,
      stopStream,
      capture,
      startAuto,
    }),
    [
      photos,
      error,
      ready,
      facingMode,
      isShuttering,
      showShotsPopup,
      isAuto,
      countdown,
      canTakeMore,
      controlsLocked,
      triggerShutter,
      persistShots,
      stopAuto,
      stopStream,
      capture,
      startAuto,
    ],
  );
}