"use client";

type LoaderProps = {
  show: boolean;
  finishing?: boolean;
  text?: string;
};

export default function Loader({
  show,
  finishing = false,
  text = "個体を探しています...",
}: LoaderProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-72 h-72">
        <svg
          viewBox="0 0 120 120"
          className={`
            absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2
            text-amber-100
            ${finishing ? "animate-beetle-finish" : "animate-beetle-fly"}
          `}
          fill="currentColor"
        >
          {/* 簡易クワガタSVG */}
          <path d="M60 42c12 0 20 12 20 28s-8 32-20 32-20-16-20-32 8-28 20-28Z" />
          <path d="M50 36c0-10-8-18-18-22 2 12 7 22 16 28Z" />
          <path d="M70 36c0-10 8-18 18-22-2 12-7 22-16 28Z" />
          <path d="M42 58 20 48M42 72 18 72M44 86 24 98" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <path d="M78 58 100 48M78 72 102 72M76 86 96 98" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          <circle cx="52" cy="38" r="5" />
          <circle cx="68" cy="38" r="5" />
        </svg>

        <div className="absolute left-1/2 top-[62%] -translate-x-1/2 text-center">
          <p className="text-white font-bold tracking-wider">{text}</p>

          <div className="mt-3 flex justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/90 animate-dot" />
            <span className="h-2 w-2 rounded-full bg-white/70 animate-dot [animation-delay:.15s]" />
            <span className="h-2 w-2 rounded-full bg-white/50 animate-dot [animation-delay:.3s]" />
          </div>
        </div>
      </div>
    </div>
  );
}
