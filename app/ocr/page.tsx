"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 512;

const FRAME_WIDTH_RATIO = 0.9;
const FRAME_HEIGHT_RATIO = 0.28;

const DETECTION_INTERVAL = 150;
const STABLE_REQUIRED_MS = 900;
const MARGIN_PX = 24;

const DARK_LUMINANCE_THRESHOLD = 120;
const MIN_DARK_RATE = 0.004;
const MAX_DARK_RATE = 0.25;

const MAX_CENTER_MOVE = 8;
const MAX_SIZE_DIFF = 18;
const MAX_DARK_RATE_DIFF = 0.03;

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

type ScanPhase = "idle" | "scanning" | "detecting" | "ocr" | "done";

export default function OCRCameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastDetectAtRef = useRef(0);
  const prevSnapshotRef = useRef<DetectionSnapshot | null>(null);
  const stableStartedAtRef = useRef<number | null>(null);
  const ocrRunningRef = useRef(false);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState("");
  const [rawText, setRawText] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [stableMs, setStableMs] = useState(0);

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

  const isSnapshotStable = (
    current: DetectionSnapshot,
    prev: DetectionSnapshot
  ) => {
    const centerMove = Math.hypot(
      current.centerX - prev.centerX,
      current.centerY - prev.centerY
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

  const detectTextLikeShape = (): DetectionSnapshot | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });

    if (!canvas || !ctx) return null;

    const monitor = getMonitorRect();

    const imageData = ctx.getImageData(
      monitor.x,
      monitor.y,
      monitor.w,
      monitor.h
    );

    const { data, width, height } = imageData;

    let darkCount = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    // 2px飛ばしで軽量化
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

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const sampledPixels = Math.ceil(width / step) * Math.ceil(height / step);
    const darkRate = darkCount / sampledPixels;

    if (darkRate < MIN_DARK_RATE || darkRate > MAX_DARK_RATE) {
      return null;
    }

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;

    if (bboxWidth <= 0 || bboxHeight <= 0) {
      return null;
    }

    const aspectRatio = bboxWidth / bboxHeight;

    // 横長の文字列っぽい形だけ拾う
    if (aspectRatio < 2.2) {
      return null;
    }

    // 小さすぎるノイズを除外
    if (bboxWidth < monitor.w * 0.25 || bboxHeight < 14) {
      return null;
    }

    // マージン枠の端に触れている場合は除外
    const edgePadding = 4;

    if (
      minX <= edgePadding ||
      minY <= edgePadding ||
      maxX >= width - edgePadding ||
      maxY >= height - edgePadding
    ) {
      return null;
    }

    const globalBox = {
      x: monitor.x + minX,
      y: monitor.y + minY,
      w: bboxWidth,
      h: bboxHeight,
    };

    return {
      bbox: globalBox,
      darkRate,
      centerX: globalBox.x + globalBox.w / 2,
      centerY: globalBox.y + globalBox.h / 2,
    };
  };

  const resetDetection = () => {
    prevSnapshotRef.current = null;
    stableStartedAtRef.current = null;
    setStableMs(0);
    setPhase(cameraReady ? "scanning" : "idle");
  };

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    setCameraReady(false);
    setPhase((current) => (current === "ocr" || current === "done" ? current : "idle"));
    resetDetection();
  };

  const createOcrImage = async (): Promise<Blob> => {
    const sourceCanvas = canvasRef.current;

    if (!sourceCanvas) {
      throw new Error("カメラcanvasがありません。");
    }

    const cropCanvas = document.createElement("canvas");

    const frame = getFrameRect();

    cropCanvas.width = frame.w;
    cropCanvas.height = frame.h;

    const ctx = cropCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context could not be created.");
    }

    ctx.drawImage(
      sourceCanvas,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      0,
      0,
      cropCanvas.width,
      cropCanvas.height
    );

    const dataUrl = cropCanvas.toDataURL("image/jpeg", 0.8);
    setCroppedPreview(dataUrl);

    return new Promise((resolve, reject) => {
      cropCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Blob生成に失敗しました。"));
            return;
          }

          resolve(blob);
        },
        "image/jpeg",
        0.8
      );
    });
  };

  const captureAndOcr = async () => {
    if (ocrRunningRef.current) return;

    ocrRunningRef.current = true;

    setLoading(true);
    setPhase("ocr");
    setRawText("");
    setId(null);
    setTime(null);

    const start = performance.now();

    try {
      const blob = await createOcrImage();

      // OCRフェーズに入ったらカメラ停止
      stopCamera();

      setTimeout(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);

      const formData = new FormData();
      formData.append("image", blob, "ocr-target.jpg");

      const res = await fetch("/api/ocr", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "OCR API Error");
      }

      setId(data.id ?? null);
      setRawText(data.rawText ?? "");
      setTime(Math.round(performance.now() - start));
      setPhase("done");
    } catch (error) {
      console.error(error);
      alert("OCR処理中にエラーが発生しました。");
      setPhase("idle");
    } finally {
      setLoading(false);
      ocrRunningRef.current = false;
    }
  };

  const runAutoDetection = (now: number) => {
    if (!cameraReady || loading || ocrRunningRef.current) return;

    if (now - lastDetectAtRef.current < DETECTION_INTERVAL) return;

    lastDetectAtRef.current = now;

    const snapshot = detectTextLikeShape();

    if (!snapshot) {
      resetDetection();
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

    const stableStartedAt = stableStartedAtRef.current ?? now;
    const duration = now - stableStartedAt;

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

    ctx.drawImage(
      video,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE
    );

    runAutoDetection(now);

    animationRef.current = requestAnimationFrame(drawCameraToCanvas);
  };

  const startCamera = async () => {
    try {
      setCroppedPreview("");
      setRawText("");
      setId(null);
      setTime(null);
      setPhase("scanning");
      setStableMs(0);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      if (!videoRef.current) return;

      videoRef.current.srcObject = mediaStream;
      await videoRef.current.play();

      setCameraReady(true);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      animationRef.current = requestAnimationFrame(drawCameraToCanvas);
    } catch (error) {
      console.error(error);
      alert("カメラを起動できませんでした。HTTPS環境で確認してください。");
      setPhase("idle");
    }
  };

  const toggleCamera = () => {
    if (cameraReady) {
      stopCamera();
      return;
    }

    startCamera();
  };

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
    <main style={{ padding: 16, paddingBottom: 120 }}>
      <h1>Gemini OCRカメラテスト</h1>

      <p style={{ lineHeight: 1.7, color: "#555" }}>
        IDを枠内に合わせてください。
        <br />
        文字列が安定すると自動で読み取ります。
      </p>

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
          {loading
            ? "読み取り中..."
            : isDetecting
              ? `認識中... ${Math.min(
                100,
                Math.round((stableMs / STABLE_REQUIRED_MS) * 100)
              )}%`
              : "IDを枠内に合わせてください"}
        </p>
      </div>

      <div
        className="justify-center"
        style={{ display: "flex", gap: 12, marginTop: 16 }}
      >
        <button
          type="button"
          className={
            cameraReady
              ? "py-2 px-4 border border-neutral-600 rounded-md w-full"
              : "py-2 px-4 bg-green-700 w-full text-white rounded-md"
          }
          onClick={toggleCamera}
          disabled={loading}
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

        <section style={{ marginTop: 24 }}>
          <h2>読み取り結果</h2>

          <p style={{ fontSize: 32, fontWeight: "bold", margin: 0 }}>
            {loading ? "解析中..." : id || "検出できませんでした"}
          </p>
        </section>

        <section style={{ marginTop: 24 }}>
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

        <section style={{ marginTop: 24 }}>
          <h2>処理時間</h2>

          <p>{time ? `${time} ms` : "-"}</p>
        </section>
      </div>
    </main>
  );
}