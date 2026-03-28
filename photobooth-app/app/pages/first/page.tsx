"use client";

import Link from "next/link";

function PhotoStrip({
  className = "",
  rotation = 0,
}: {
  className?: string;
  rotation?: number;
}) {
  return (
    <div
      aria-hidden="true"
      className={[
        "pointer-events-none absolute w-[200px] border border-black/15 bg-black",
        "shadow-2xl shadow-black/10 backdrop-blur-[2px]",
        className,
      ].join(" ")}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <div className="p-4">
        {/* holes/perf hint */}
        <div className="mb-3 flex justify-between opacity-50">
          <div className="h-2 w-10 bg-black/15" />
          <div className="h-2 w-16 bg-black/10" />
        </div>

        <div className="space-y-4">
          <div className="h-28 w-full bg-white ring-1 ring-black/5" />
          <div className="h-28 w-full bg-white ring-1 ring-black/5" />
          <div className="h-28 w-full bg-white ring-1 ring-black/5" />
        </div>

        <div className="mt-4 h-2 w-24 bg-black/10 opacity-60" />
      </div>
    </div>
  );
}

export default function First() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-white">
      {/* background */}
      <div className="pointer-events-none absolute inset-0">
        {/* glows (behind strips) */}
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 " />
        <div className="absolute -bottom-24 right-[-4rem] h-80 w-80 rounded-full" />

        {/* photobooth strips */}
        <PhotoStrip
          className="left-[-40px] top-10 opacity-[0.22] sm:opacity-[0.28]"
          rotation={-12}
        />
        <PhotoStrip
          className="right-[-50px] top-24 opacity-[0.18] sm:opacity-[0.24]"
          rotation={11}
        />
        <PhotoStrip
          className="left-10 bottom-[-30px] hidden opacity-[0.16] sm:block"
          rotation={7}
        />

        {/* optional: keep this VERY subtle or remove it */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] [background-size:18px_18px] opacity-20" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-medium text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-600" />
            Photo booth experience
          </span>

          <h1 className="text-balance text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            LITRATO.
          </h1>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/pages/second"
              className="group inline-flex items-center justify-center rounded-full bg-red-600 px-8 py-3 text-lg font-semibold text-white shadow-lg shadow-red-600/20 transition hover:-translate-y-0.5 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
            >
              Start
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}