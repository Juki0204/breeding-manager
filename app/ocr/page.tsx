"use client";

import { useEffect, useRef, useState } from "react";

const CANVAS_SIZE = 512;

const FRAME_WIDTH_RATIO = 0.9;
const FRAME_HEIGHT_RATIO = 0.28;

export default function OCRCameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState("");
  const [rawText, setRawText] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);

  const drawCameraToCanvas = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !ctx || !video.videoWidth || !video.videoHeight) {
      animationRef.current = requestAnimationFrame(drawCameraToCanvas);
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    // cover相当で中央トリミングして512×512に描画
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

    animationRef.current = requestAnimationFrame(drawCameraToCanvas);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (!videoRef.current) return;

      videoRef.current.srcObject = mediaStream;
      await videoRef.current.play();

      setCameraReady(true);
      drawCameraToCanvas();
    } catch (error) {
      console.error(error);
      alert("カメラを起動できませんでした。HTTPS環境で確認してください。");
    }
  };

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraReady(false);
  };

  const createOcrImage = async (): Promise<Blob> => {
    const sourceCanvas = canvasRef.current;

    if (!sourceCanvas) {
      throw new Error("カメラcanvasがありません。");
    }

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = CANVAS_SIZE;
    cropCanvas.height = CANVAS_SIZE;

    const ctx = cropCanvas.getContext("2d");

    if (!ctx) {
      throw new Error("Canvas context could not be created.");
    }

    const frameWidth = CANVAS_SIZE * FRAME_WIDTH_RATIO;
    const frameHeight = CANVAS_SIZE * FRAME_HEIGHT_RATIO;
    const frameX = (CANVAS_SIZE - frameWidth) / 2;
    const frameY = (CANVAS_SIZE - frameHeight) / 2;

    // 緑枠内だけを切り抜いて512×512へ拡大
    ctx.drawImage(
      sourceCanvas,
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      0,
      0,
      CANVAS_SIZE,
      CANVAS_SIZE
    );

    const dataUrl = cropCanvas.toDataURL("image/png");
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
        "image/png",
        1
      );
    });
  };

  const captureAndOcr = async () => {
    if (!cameraReady) return;

    setLoading(true);
    setRawText("");
    setId(null);
    setTime(null);

    const start = performance.now();

    try {
      const blob = await createOcrImage();

      const formData = new FormData();
      formData.append("image", blob, "ocr-target-512.png");

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
    } catch (error) {
      console.error(error);
      alert("OCR処理中にエラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return (
    <main style={{ padding: 16, paddingBottom: 120 }}>
      <h1>Gemini OCRカメラテスト</h1>

      <p style={{ lineHeight: 1.7, color: "#555" }}>
        IDを緑の枠内に合わせて読み取ってください。
        <br />
        例：#ABC-0001
      </p>

      <video
        ref={videoRef}
        playsInline
        muted
        style={{ display: "none" }}
      />

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
            border: "2px solid #00a86b",
            borderRadius: 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,.45)",
            pointerEvents: "none",
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
          IDを枠内に合わせてください
        </p>
      </div>

      <div className="justify-center" style={{ display: "flex", gap: 12, marginTop: 16 }}>
        {cameraReady && (
          <button type="button" className="py-2 px-4 border border-neutral-600 rounded-md" onClick={stopCamera}>
            カメラ停止
          </button>
        )}

        {!cameraReady ? (
          <button type="button" className="py-2 px-4 bg-green-700 w-full text-white rounded-md" onClick={startCamera}>
            カメラ起動
          </button>
        ) : (
          <button type="button" className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md" onClick={captureAndOcr} disabled={loading}>
            {loading ? "解析中..." : "読み取る"}
          </button>
        )}
      </div>

      {croppedPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>API送信用画像 512×512</h2>

          <img
            src={croppedPreview}
            alt="cropped"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              display: "block",
              width: "100%",
              maxWidth: CANVAS_SIZE,
              aspectRatio: "1 / 1",
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
          {id || "検出できませんでした"}
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
    </main>
  );
}