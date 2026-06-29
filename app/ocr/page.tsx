"use client";

import { useEffect, useRef, useState } from "react";
import { recognize } from "tesseract.js";

const FRAME_WIDTH_RATIO = 0.9;
const FRAME_HEIGHT_RATIO = 0.22;

const normalizeOcrText = (text: string) => {
  return text
    .toUpperCase()
    .replace(/[ー−–—―]/g, "-")
    .replace(/\s+/g, "")
    .replace(/--+/g, "-");
};

const extractId = (text: string) => {
  const normalized = normalizeOcrText(text);

  const match = normalized.match(/#?([A-Z]{3})-?(\d{4})/);

  return {
    id: match ? `${match[1]}-${match[2]}` : "",
    normalized,
  };
};

export default function OCRCameraPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [croppedPreview, setCroppedPreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [normalizedText, setNormalizedText] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);

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

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (error) {
      console.error(error);
      alert("カメラを起動できませんでした。HTTPS環境で確認してください。");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraReady(false);
  };

  const captureAndOcr = async () => {
    const video = videoRef.current;
    const frame = frameRef.current;

    if (!video || !frame || !cameraReady) return;

    setLoading(true);
    setCroppedPreview("");
    setOcrText("");
    setNormalizedText("");
    setId("");
    setTime(null);

    const start = performance.now();

    try {
      const videoRect = video.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();

      const scaleX = video.videoWidth / videoRect.width;
      const scaleY = video.videoHeight / videoRect.height;

      const cropX = (frameRect.left - videoRect.left) * scaleX;
      const cropY = (frameRect.top - videoRect.top) * scaleY;
      const cropWidth = frameRect.width * scaleX;
      const cropHeight = frameRect.height * scaleY;

      const canvas = document.createElement("canvas");

      const scale = 3;

      canvas.width = cropWidth * scale;
      canvas.height = cropHeight * scale;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Canvas context could not be created.");
      }

      ctx.drawImage(
        video,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (!result) {
            reject(new Error("Blob生成に失敗しました。"));
            return;
          }

          resolve(result);
        }, "image/png");
      });

      setCroppedPreview(canvas.toDataURL("image/png"));

      const result = await recognize(blob, "eng");

      const extracted = extractId(result.data.text);

      setOcrText(result.data.text);
      setNormalizedText(extracted.normalized);
      setId(extracted.id);
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
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return (
    <main
      style={{
        padding: 16,
        paddingBottom: 120,
      }}
    >
      <h1>OCRカメラテスト</h1>

      <p
        style={{
          lineHeight: 1.7,
          color: "#555",
        }}
      >
        IDを緑の枠内に合わせて読み取ってください。
        <br />
        例：#ABC-0001
      </p>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 700,
          margin: "0 auto",
          background: "#111",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "contain",
            background: "#000",
          }}
        />

        <div
          ref={frameRef}
          style={{
            position: "absolute",
            left: `${((1 - FRAME_WIDTH_RATIO) / 2) * 100}%`,
            top: `${((1 - FRAME_HEIGHT_RATIO) / 2) * 100}%`,
            width: `${FRAME_WIDTH_RATIO * 100}%`,
            height: `${FRAME_HEIGHT_RATIO * 100}%`,
            border: "3px solid #00a86b",
            borderRadius: 10,
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

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 16,
        }}
      >
        {!cameraReady ? (
          <button type="button" onClick={startCamera}>
            カメラ起動
          </button>
        ) : (
          <button type="button" onClick={captureAndOcr} disabled={loading}>
            {loading ? "解析中..." : "読み取る"}
          </button>
        )}

        {cameraReady && (
          <button type="button" onClick={stopCamera}>
            カメラ停止
          </button>
        )}
      </div>

      {croppedPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>OCR対象エリア</h2>

          <img
            src={croppedPreview}
            alt="cropped"
            style={{
              display: "block",
              width: "100%",
              maxWidth: 700,
              borderRadius: 12,
              border: "1px solid #ddd",
            }}
          />
        </section>
      )}

      <section style={{ marginTop: 24 }}>
        <h2>OCR結果</h2>

        <pre
          style={{
            background: "#eee",
            padding: 16,
            whiteSpace: "pre-wrap",
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {ocrText || "-"}
        </pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>正規化後</h2>

        <pre
          style={{
            background: "#eee",
            padding: 16,
            whiteSpace: "pre-wrap",
            borderRadius: 8,
            overflowX: "auto",
          }}
        >
          {normalizedText || "-"}
        </pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>抽出ID</h2>

        <p
          style={{
            fontSize: 32,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          {id || "検出できませんでした"}
        </p>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>認識時間</h2>

        <p>{time ? `${time} ms` : "-"}</p>
      </section>
    </main>
  );
}