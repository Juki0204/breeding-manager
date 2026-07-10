"use client";

type LoaderProps = {
  show: boolean;
  success?: boolean;
  image: string;
};

export default function Loader({
  show,
  success = false,
  image,
}: LoaderProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-10 grid place-items-center bg-black/50">

      <div className="w-72">

        <div className="relative mx-auto w-36 h-20">

          <img
            src={image}
            alt=""
            draggable={false}
            className={`w-full h-full object-contain select-none contrast-125
              ${success
                ? "loader-image-complete"
                : "loader-image-scanning"
              }
            `}
          />

          <div
            className={`
              absolute
              left-0
              top-1/2
              w-full
              h-0.75
              rounded-full
              bg-emerald-300
              shadow-[0_0_10px_4px_rgba(52,211,153,.9)]
              ${success
                ? "loader-scan-line-finish"
                : "loader-scan-line"
              }
            `}
          />
        </div>

        <p
          className={`
            mt-6
            text-center
            font-bold
            tracking-wider
            text-lg
            ${success ? "text-yellow-400" : "text-white"}
          `}
        >
          {success
            ? "見つかりました！"
            : "個体を探しています..."}
        </p>

      </div>

    </div>
  );
}