"use client";

import Loader from "@/components/common/Loader";
import ShowDetails from "@/components/common/ShowDetails";
import { useEffect, useRef, useState } from "react";
import { FaXmark } from "react-icons/fa6";

const CANVAS_SIZE = 512;

const FRAME_WIDTH_RATIO = 0.9;
const FRAME_HEIGHT_RATIO = 0.28;

const DETECTION_INTERVAL = 150;
const STABLE_REQUIRED_MS = 900;
const MARGIN_PX = 24;

const DARK_LUMINANCE_THRESHOLD = 80;
const MIN_DARK_RATE = 0.005;
const MAX_DARK_RATE = 0.35;

const MAX_CENTER_MOVE = 12;
const MAX_SIZE_DIFF = 24;
const MAX_DARK_RATE_DIFF = 0.04;

// OpenCV.jsによる「文字列らしさ」判定
const MIN_COMPONENT_COUNT = 3;
const MIN_TEXT_ASPECT_RATIO = 1.3;
const MAX_VERTICAL_CENTER_SPREAD_RATE = 0.6;
const MAX_LARGEST_COMPONENT_RATE = 0.72;

// 点状ノイズだけを除外するため、かなり緩めに設定
const MIN_COMPONENT_AREA = 3;
const MIN_COMPONENT_WIDTH = 2;
const MIN_COMPONENT_HEIGHT = 2;

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type DetectionSnapshot = {
  bbox: Rect;
  darkRate: number;
  centerX: number;
  centerY: number;
};

type TextComponent = {
  x: number;
  y: number;
  w: number;
  h: number;
  area: number;
  centerX: number;
  centerY: number;
};

type TextLikeAnalysis = {
  components: TextComponent[];
  bbox: Rect;
};

type OpenCv = typeof import("@techstark/opencv-js");
type OpenCvModule = OpenCv & {
  onRuntimeInitialized?: () => void;
};

type ScanPhase = "idle" | "scanning" | "detecting" | "ocr" | "done";

export default function OCRCameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<OpenCv | null>(null);

  const cameraReadyRef = useRef(false);
  const loadingRef = useRef(false);
  const ocrRunningRef = useRef(false);

  const lastDetectAtRef = useRef(0);
  const prevSnapshotRef = useRef<DetectionSnapshot | null>(null);
  const stableStartedAtRef = useRef<number | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState("");
  const [rawText, setRawText] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [stableMs, setStableMs] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [openCvReady, setOpenCvReady] = useState(false);

  const [isSearching, setIsSearching] = useState<boolean>(false); //サーチ中フラグ
  const [searchFinished, setSearchFinished] = useState<boolean>(false); //サーチ完了フラグ
  const [isResultOpen, setIsResultOpen] = useState<boolean>(false); //詳細表示中フラグ

  const log = (message: string) => {
    const logTime = new Date().toLocaleTimeString("ja-JP", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    setLogs((prev) => [...prev, `[${logTime}] ${message}`]);
  };

  const getFrameRect = (): Rect => {
    const frameWidth = CANVAS_SIZE * FRAME_WIDTH_RATIO;
    const frameHeight = CANVAS_SIZE * FRAME_HEIGHT_RATIO;

    return {
      x: (CANVAS_SIZE - frameWidth) / 2,
      y: (CANVAS_SIZE - frameHeight) / 2,
      w: frameWidth,
      h: frameHeight,
    };
  };

  const getMonitorRect = (): Rect => {
    const frame = getFrameRect();

    const x = Math.max(0, frame.x - MARGIN_PX);
    const y = Math.max(0, frame.y - MARGIN_PX);
    const right = Math.min(CANVAS_SIZE, frame.x + frame.w + MARGIN_PX);
    const bottom = Math.min(CANVAS_SIZE, frame.y + frame.h + MARGIN_PX);

    return {
      x,
      y,
      w: right - x,
      h: bottom - y,
    };
  };

  const resetDetection = () => {
    prevSnapshotRef.current = null;
    stableStartedAtRef.current = null;
    setStableMs(0);
  };

  const analyzeTextLikeComponents = (
    imageData: ImageData,
  ): TextLikeAnalysis | null => {
    const cv = cvRef.current;

    if (!cv) return null;

    let src: InstanceType<OpenCv["Mat"]> | null = null;
    let gray: InstanceType<OpenCv["Mat"]> | null = null;
    let binary: InstanceType<OpenCv["Mat"]> | null = null;
    let contours: InstanceType<OpenCv["MatVector"]> | null = null;
    let hierarchy: InstanceType<OpenCv["Mat"]> | null = null;

    try {
      src = cv.matFromImageData(imageData);
      gray = new cv.Mat();
      binary = new cv.Mat();
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();

      // CanvasのRGBA画像をグレースケール化
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 暗い文字・線を白、背景を黒に反転
      cv.threshold(
        gray,
        binary,
        DARK_LUMINANCE_THRESHOLD,
        255,
        cv.THRESH_BINARY_INV,
      );

      // 文字内部の穴を別カウントしないよう、外側輪郭だけ取得
      cv.findContours(
        binary,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE,
      );

      const components: TextComponent[] = [];

      for (let index = 0; index < contours.size(); index++) {
        const contour = contours.get(index);

        try {
          const area = cv.contourArea(contour);
          const rect = cv.boundingRect(contour);

          // ハイフンや#を残しつつ、点状ノイズだけ除外
          if (
            area < MIN_COMPONENT_AREA ||
            rect.width < MIN_COMPONENT_WIDTH ||
            rect.height < MIN_COMPONENT_HEIGHT
          ) {
            continue;
          }

          components.push({
            x: rect.x,
            y: rect.y,
            w: rect.width,
            h: rect.height,
            area,
            centerX: rect.x + rect.width / 2,
            centerY: rect.y + rect.height / 2,
          });
        } finally {
          contour.delete();
        }
      }

      // 条件1：文字の塊が3個以上ある
      if (components.length < MIN_COMPONENT_COUNT) return null;

      const minX = Math.min(...components.map((component) => component.x));
      const minY = Math.min(...components.map((component) => component.y));
      const maxX = Math.max(
        ...components.map((component) => component.x + component.w),
      );
      const maxY = Math.max(
        ...components.map((component) => component.y + component.h),
      );

      const bbox: Rect = {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY,
      };

      if (bbox.w <= 0 || bbox.h <= 0) return null;

      // 条件2：全体が横長
      if (bbox.w / bbox.h < MIN_TEXT_ASPECT_RATIO) return null;

      // 条件3：各輪郭が概ね横方向に並んでいる
      // 文字サイズ自体は比較しないので、ハイフンや#の小ささは許容する
      const centerYs = components.map((component) => component.centerY);
      const centerYSpread = Math.max(...centerYs) - Math.min(...centerYs);

      if (centerYSpread > bbox.h * MAX_VERTICAL_CENTER_SPREAD_RATE) {
        return null;
      }

      // 条件4：1つの巨大な塊が全体を占有していない
      const totalArea = components.reduce(
        (total, component) => total + component.area,
        0,
      );
      const largestArea = Math.max(
        ...components.map((component) => component.area),
      );

      if (
        totalArea <= 0 ||
        largestArea / totalArea > MAX_LARGEST_COMPONENT_RATE
      ) {
        return null;
      }

      return { components, bbox };
    } catch (error) {
      console.error("OpenCV text detection error:", error);
      return null;
    } finally {
      // OpenCV.jsのMatは必ず明示的に解放する
      src?.delete();
      gray?.delete();
      binary?.delete();
      contours?.delete();
      hierarchy?.delete();
    }
  };

  const detectTextLikeShape = (): DetectionSnapshot | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !ctx || !cvRef.current) return null;

    const monitor = getMonitorRect();
    const imageData = ctx.getImageData(
      monitor.x,
      monitor.y,
      monitor.w,
      monitor.h,
    );

    const { data, width, height } = imageData;

    // 既存の軽量な黒ピクセル率判定を第1ゲートとして残す
    let darkCount = 0;
    const step = 2;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminance < DARK_LUMINANCE_THRESHOLD) {
          darkCount++;
        }
      }
    }

    const sampledPixels = Math.ceil(width / step) * Math.ceil(height / step);
    const darkRate = darkCount / sampledPixels;

    if (darkRate < MIN_DARK_RATE || darkRate > MAX_DARK_RATE) return null;

    // 第2ゲート：OpenCVで4条件を満たす文字列形状か判定
    const analysis = analyzeTextLikeComponents(imageData);

    if (!analysis) return null;

    const globalBox: Rect = {
      x: monitor.x + analysis.bbox.x,
      y: monitor.y + analysis.bbox.y,
      w: analysis.bbox.w,
      h: analysis.bbox.h,
    };

    // 元の最低サイズ判定は維持
    if (globalBox.w < monitor.w * 0.12 || globalBox.h < 6) return null;

    return {
      bbox: globalBox,
      darkRate,
      centerX: globalBox.x + globalBox.w / 2,
      centerY: globalBox.y + globalBox.h / 2,
    };
  };

  const isSnapshotStable = (
    current: DetectionSnapshot,
    prev: DetectionSnapshot,
  ) => {
    const centerMove = Math.hypot(
      current.centerX - prev.centerX,
      current.centerY - prev.centerY,
    );

    const widthDiff = Math.abs(current.bbox.w - prev.bbox.w);
    const heightDiff = Math.abs(current.bbox.h - prev.bbox.h);
    const darkRateDiff = Math.abs(current.darkRate - prev.darkRate);

    return (
      centerMove <= MAX_CENTER_MOVE &&
      widthDiff <= MAX_SIZE_DIFF &&
      heightDiff <= MAX_SIZE_DIFF &&
      darkRateDiff <= MAX_DARK_RATE_DIFF
    );
  };

  const createOcrImage = async (): Promise<string> => {
    const imageStart = performance.now();

    const sourceCanvas = canvasRef.current;

    if (!sourceCanvas) throw new Error("カメラcanvasがありません。");

    const frame = getFrameRect();
    const cropCanvas = document.createElement("canvas");

    cropCanvas.width = frame.w;
    cropCanvas.height = frame.h;

    const ctx = cropCanvas.getContext("2d");

    if (!ctx) throw new Error("Canvas context could not be created.");

    ctx.drawImage(
      sourceCanvas,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height,
    );

    log(`drawImage: ${(performance.now() - imageStart).toFixed(0)}ms`);

    const dataUrlStart = performance.now();
    const dataUrl = cropCanvas.toDataURL("image/jpeg", 0.8);

    setCroppedPreview(dataUrl);

    log(`toDataURL: ${(performance.now() - dataUrlStart).toFixed(0)}ms`);
    log(`base64サイズ: ${(dataUrl.length / 1024).toFixed(1)}KB`);

    return dataUrl;
  };

  const stopCamera = () => {
    const stopStart = performance.now();

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    cameraReadyRef.current = false;

    setCameraReady(false);
    resetDetection();

    log(`stopCamera: ${(performance.now() - stopStart).toFixed(0)}ms`);
  };

  const captureAndOcr = async () => {
    if (ocrRunningRef.current) return;

    ocrRunningRef.current = true;
    loadingRef.current = true;

    setLogs([]);
    setLoading(true);
    setPhase("ocr");
    setRawText("");
    setId(null);
    setTime(null);

    const totalStart = performance.now();

    log("OCR開始");

    try {
      const createStart = performance.now();
      const dataUrl = await createOcrImage();

      log(
        `createOcrImage合計: ${(performance.now() - createStart).toFixed(0)}ms`,
      );

      stopCamera();

      log("Gemini API送信");

      /* ここでローダーを出す */
      setIsSearching(true);

      const fetchStart = performance.now();

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: dataUrl,
        }),
      });

      log(`fetch完了: ${(performance.now() - fetchStart).toFixed(0)}ms`);

      const jsonStart = performance.now();
      const data = await res.json();

      log(`json解析: ${(performance.now() - jsonStart).toFixed(0)}ms`);

      if (!res.ok) {
        throw new Error(data.error ?? "OCR API Error");
      }

      if (data.debug?.gemini) {
        log(`Gemini処理: ${data.debug.gemini}ms`);
      }

      if (data.debug?.api) {
        log(`API全体: ${data.debug.api}ms`);
      }

      setId(data.id ?? null);
      setRawText(data.rawText ?? "");

      /* ここでローダーを消す、オーバーレイを出す、詳細にidを受け渡す */
      if (data.id) {
        setSearchFinished(true);
        setIsResultOpen(true);
      } else {
        setIsSearching(false);
      }

      const total = Math.round(performance.now() - totalStart);

      setTime(total);
      setPhase("done");

      log(`OCR結果: ${data.id ?? "検出なし"}`);
      log(`合計: ${total}ms`);
    } catch (error) {
      console.error(error);

      log(`ERROR: ${error instanceof Error ? error.message : "不明なエラー"}`);

      alert("OCR処理中にエラーが発生しました。");
      setPhase("idle");
      setIsSearching(false);
    } finally {
      setLoading(false);
      loadingRef.current = false;
      ocrRunningRef.current = false;
    }
  };

  const runAutoDetection = (now: number) => {
    if (
      !cameraReadyRef.current ||
      !cvRef.current ||
      loadingRef.current ||
      ocrRunningRef.current
    ) {
      return;
    }

    if (now - lastDetectAtRef.current < DETECTION_INTERVAL) return;

    lastDetectAtRef.current = now;

    const snapshot = detectTextLikeShape();

    if (!snapshot) {
      resetDetection();
      setPhase("scanning");
      return;
    }

    const prev = prevSnapshotRef.current;

    if (!prev) {
      prevSnapshotRef.current = snapshot;
      stableStartedAtRef.current = now;
      setPhase("detecting");
      setStableMs(0);
      return;
    }

    const stable = isSnapshotStable(snapshot, prev);
    prevSnapshotRef.current = snapshot;

    if (!stable) {
      stableStartedAtRef.current = now;
      setPhase("detecting");
      setStableMs(0);
      return;
    }

    const startedAt = stableStartedAtRef.current ?? now;
    const duration = now - startedAt;

    setPhase("detecting");
    setStableMs(Math.round(duration));

    if (duration >= STABLE_REQUIRED_MS) {
      captureAndOcr();
    }
  };

  const drawCameraToCanvas = (now: number) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !ctx || !video.videoWidth || !video.videoHeight) {
      animationRef.current = requestAnimationFrame(drawCameraToCanvas);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const scale = Math.max(CANVAS_SIZE / vw, CANVAS_SIZE / vh);
    const sw = CANVAS_SIZE / scale;
    const sh = CANVAS_SIZE / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    runAutoDetection(now);

    animationRef.current = requestAnimationFrame(drawCameraToCanvas);
  };

  const startCamera = async () => {
    try {
      setCroppedPreview("");
      setRawText("");
      setId(null);
      setTime(null);
      setLogs([]);
      setPhase("scanning");
      setStableMs(0);
      resetDetection();

      log("カメラ起動開始");

      const cameraStart = performance.now();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      log(`getUserMedia: ${(performance.now() - cameraStart).toFixed(0)}ms`);

      streamRef.current = mediaStream;

      if (!videoRef.current) return;

      const playStart = performance.now();

      videoRef.current.srcObject = mediaStream;
      await videoRef.current.play();

      log(`video.play: ${(performance.now() - playStart).toFixed(0)}ms`);

      cameraReadyRef.current = true;

      setCameraReady(true);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = requestAnimationFrame(drawCameraToCanvas);

      log("カメラ起動完了");
    } catch (error) {
      console.error(error);

      log(
        `CAMERA ERROR: ${error instanceof Error ? error.message : "不明なエラー"
        }`,
      );

      alert("カメラを起動できませんでした。HTTPS環境で確認してください。");
      setPhase("idle");
    }
  };

  const toggleCamera = () => {
    if (cameraReadyRef.current) {
      stopCamera();
      setPhase("idle");
      return;
    }

    startCamera();
  };

  const closeSearchResult = () => {
    setId(null);
    setIsSearching(false);
    setSearchFinished(false);
    setIsResultOpen(false);
  };

  useEffect(() => {
    let mounted = true;

    const initializeOpenCv = async () => {
      try {
        log("OpenCV.js読み込み開始");

        const imported = await import("@techstark/opencv-js");
        const importedWithDefault = imported as typeof imported & {
          default?: OpenCvModule | Promise<OpenCvModule>;
        };

        const moduleCandidate = importedWithDefault.default ?? imported;
        const cvModule = (await moduleCandidate) as OpenCvModule;

        if (!cvModule.Mat) {
          await new Promise<void>((resolve) => {
            cvModule.onRuntimeInitialized = () => resolve();
          });
        }

        if (!mounted) return;

        cvRef.current = cvModule;
        setOpenCvReady(true);
        log("OpenCV.js読み込み完了");
      } catch (error) {
        console.error(error);
        setOpenCvReady(false);
        log(
          `OpenCV ERROR: ${error instanceof Error
            ? error.message
            : "OpenCV.jsの初期化に失敗しました。"
          }`,
        );
      }
    };

    void initializeOpenCv();

    return () => {
      mounted = false;
      cvRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const isDetecting = phase === "detecting";
  const frameColor = isDetecting ? "#ef4444" : "#00a86b";

  return (
    <main className="p-4 pt-2 pb-30">
      <h1 className="text-center font-bold tracking-widest pb-1">
        個体識別スキャナー
      </h1>

      <ol className="text-sm list-decimal p-2 pl-6 mb-4 bg-neutral-200 rounded-xl">
        <li>カメラ起動ボタンを押す</li>
        <li>緑の枠内にラベルのIDが書かれた部分を収める</li>
        <li>そのまま約1秒ほどキープすると解析開始</li>
        <li>解析が完了（2～3秒）⇒ 結果を表示</li>
      </ol>

      <video ref={videoRef} playsInline muted style={{ display: "none" }} />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: CANVAS_SIZE,
          margin: "0 auto",
          background: "#111",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "1 / 1",
            background: "#000",
          }}
        />

        <div
          style={{
            position: "absolute",
            left: `${((1 - FRAME_WIDTH_RATIO) / 2) * 100}%`,
            top: `${((1 - FRAME_HEIGHT_RATIO) / 2) * 100}%`,
            width: `${FRAME_WIDTH_RATIO * 100}%`,
            height: `${FRAME_HEIGHT_RATIO * 100}%`,
            border: `2px solid ${frameColor}`,
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.45)",
            pointerEvents: "none",
            transition: "border-color .15s ease",
          }}
        />

        <p
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 12,
            margin: 0,
            textAlign: "center",
            color: "#fff",
            fontWeight: "bold",
            textShadow: "0 1px 4px rgba(0,0,0,.8)",
          }}
        >
          {!openCvReady
            ? "文字認識を準備しています..."
            : loading
              ? "読み取り中..."
              : isDetecting
                ? `認識中... ${Math.min(
                  100,
                  Math.round((stableMs / STABLE_REQUIRED_MS) * 100),
                )}%`
                : "IDを枠内に合わせてください"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          type="button"
          onClick={toggleCamera}
          disabled={loading || !openCvReady}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 8,
            border: cameraReady ? "1px solid #525252" : "none",
            background: cameraReady ? "#fff" : "#15803d",
            color: cameraReady ? "#111" : "#fff",
          }}
        >
          {cameraReady ? "カメラ停止" : "カメラ起動"}
        </button>
      </div>

      <div ref={resultRef}>
        {croppedPreview && (
          <section style={{ marginTop: 24 }}>
            <h2>API送信用画像</h2>

            <img
              src={croppedPreview}
              alt="cropped"
              width={CANVAS_SIZE}
              height={CANVAS_SIZE * FRAME_HEIGHT_RATIO}
              style={{
                display: "block",
                width: "100%",
                maxWidth: CANVAS_SIZE,
                height: "auto",
                borderRadius: 12,
                border: "1px solid #ddd",
                objectFit: "contain",
              }}
            />
          </section>
        )}

        <section
          className={`mt-6 w-full p-6 pb-20 fixed left-0 z-20 bg-neutral-100 rounded-t-3xl shadow-3xl overflow-hidden transition-[bottom] duration-300 ${isResultOpen ? "delay-1000 bottom-0" : "-bottom-full"}`}
        >
          {id && <h2 className="pb-2 text-center font-bold">{id}</h2>}

          <div className="absolute right-6 top-6">
            <FaXmark onClick={closeSearchResult} />
          </div>

          <ShowDetails id={id ?? null} />
        </section>

        <Loader
          show={isSearching}
          success={searchFinished}
          image="/img/beetle_loader.png"
        />

        {/* <div
          className={`overlay bg-black/50 w-full h-dvh fixed top-0 left-0 z-10 pointer-events-none transition-opacity duration-300 ${id ? "opacity-100" : "opacity-0"}`}
        ></div> */}

        <section className="mt-6">
          <h2>Gemini rawText</h2>

          <pre
            style={{
              background: "#eee",
              padding: 16,
              whiteSpace: "pre-wrap",
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {rawText || "-"}
          </pre>
        </section>

        <section className="mt-6">
          <h2>処理時間</h2>

          <p>{time ? `${time} ms` : "-"}</p>
        </section>

        <section className="mt-6">
          <h2>デバッグログ</h2>

          <pre className="bg-neutral-900 text-green-400 p-4 rounded-lg text-xs whitespace-pre-wrap max-h-80 overflow-auto">
            {logs.length ? logs.join("\n") : "ログなし"}
          </pre>
        </section>
      </div>
    </main>
  );
}
