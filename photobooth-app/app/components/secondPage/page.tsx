"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type LayoutKey = "4-vertical" | "4-2x2" | "1" | "6-2x3" | "2-vertical";

type FrameOption = {
  id: LayoutKey;
  title: string;
  subtitle: string;
  slots: number; // how many favorites needed later
  previewClassName: string;
};

const FRAME_KEY = "litrato_frame_v1";

export default function Second() {
  const frames: FrameOption[] = useMemo(
    () => [
      {
        id: "4-vertical",
        title: "4 Photos",
        subtitle: "1 × 4 strip",
        slots: 4,
        previewClassName: "grid grid-rows-4 grid-cols-1 gap-2",
      },
      {
        id: "4-2x2",
        title: "4 Photos",
        subtitle: "2 × 2 grid",
        slots: 4,
        previewClassName: "grid grid-rows-2 grid-cols-2 gap-2",
      },
      {
        id: "1",
        title: "1 Photo",
        subtitle: "Single shot",
        slots: 1,
        previewClassName: "grid grid-rows-1 grid-cols-1 gap-2",
      },
      {
        id: "6-2x3",
        title: "6 Photos",
        subtitle: "2 × 3 grid",
        slots: 6,
        previewClassName: "grid grid-rows-3 grid-cols-2 gap-2",
      },
      {
        id: "2-vertical",
        title: "2 Photos",
        subtitle: "Double shots",
        slots: 2,
        previewClassName: "grid grid-rows-2 grid-cols-1 gap-2",
      },
    ],
    []
  );

  const [selected, setSelected] = useState<FrameOption | null>(null);

  function saveFrameAndGo(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!selected) {
      e.preventDefault();
      return;
    }

    try {
      localStorage.removeItem(FRAME_KEY);
    } catch {
      // ignore
    }

    try {
      localStorage.setItem(
        FRAME_KEY,
        JSON.stringify({
          id: selected.id,
          slots: selected.slots,
          title: selected.title,
          subtitle: selected.subtitle,
          previewClassName: selected.previewClassName,
        })
      );
    } catch {
      e.preventDefault();
    }
  }

  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Choose your frame</h1>
        <p className="text-gray-600 mb-8">
          Select a frame, then click <span className="font-semibold">Next</span>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {frames.map((f) => {
            const active = selected?.id === f.id;

            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelected(f)}
                className={[
                  "text-left rounded-2xl border p-4 transition-all hover:shadow-md",
                  active ? "border-red-600 ring-2 ring-red-200" : "border-gray-200",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{f.title}</div>
                    <div className="text-sm text-gray-500">{f.subtitle}</div>
                  </div>

                  <div
                    className={[
                      "w-24 h-32 rounded-xl bg-gray-50 border border-gray-200 p-2",
                      f.previewClassName,
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {Array.from({ length: f.slots }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-md bg-gray-200/80 border border-gray-300"
                      />
                    ))}
                  </div>
                </div>

                {active && (
                  <div className="mt-3 text-sm text-red-700 font-medium">
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-between">
          <Link
            href="/pages/first"
            className="text-gray-600 hover:text-gray-900 underline underline-offset-4"
          >
            Back
          </Link>

          <Link
            href={selected ? "/components/thirdPage" : "#"}
            onClick={saveFrameAndGo}
            aria-disabled={!selected}
            tabIndex={!selected ? -1 : 0}
            className={[
              "inline-flex items-center justify-center rounded-full px-8 py-3 font-semibold transition-all",
              selected
                ? "bg-red-600 text-white hover:bg-red-700 shadow-md"
                : "bg-gray-200 text-gray-500 cursor-not-allowed",
            ].join(" ")}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}