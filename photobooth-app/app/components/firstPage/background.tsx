export default function PhotoStrip({
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