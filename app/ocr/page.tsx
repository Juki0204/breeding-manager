"use client";

import { useState } from "react";
import { recognize } from "tesseract.js";

type CropResult = {
  blob: Blob;
  dataUrl: string;
};

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

  // #ABC-0001 / ABC-0001 / ABC0001 っぽいものを拾う
  const match = normalized.match(/#?([A-Z]{3})-?(\d{4})/);

  if (!match) {
    return {
      id: "",
      normalized,
    };
  }

  return {
    id: `${match[1]}-${match[2]}`,
    normalized,
  };
};

const cropCenterFrame = (file: File): Promise<CropResult> => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;

      const cropWidth = sourceWidth * FRAME_WIDTH_RATIO;
      const cropHeight = sourceHeight * FRAME_HEIGHT_RATIO;

      const cropX = (sourceWidth - cropWidth) / 2;
      const cropY = (sourceHeight - cropHeight) / 2;

      const canvas = document.createElement("canvas");

      // OCRしやすいように少し拡大
      const scale = 2;

      canvas.width = cropWidth * scale;
      canvas.height = cropHeight * scale;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context could not be created."));
        return;
      }

      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height
      );

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create cropped image blob."));
            return;
          }

          resolve({
            blob,
            dataUrl: canvas.toDataURL("image/png"),
          });
        },
        "image/png",
        1
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Image could not be loaded."));
    };

    image.src = objectUrl;
  });
};

export default function OCRTestPage() {
  const [preview, setPreview] = useState("");
  const [croppedPreview, setCroppedPreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [normalizedText, setNormalizedText] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const resetResult = () => {
    setPreview("");
    setCroppedPreview("");
    setOcrText("");
    setNormalizedText("");
    setId("");
    setTime(null);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    resetResult();

    const originalUrl = URL.createObjectURL(file);

    setPreview(originalUrl);
    setLoading(true);

    const start = performance.now();

    try {
      const cropped = await cropCenterFrame(file);

      setCroppedPreview(cropped.dataUrl);

      const result = await recognize(cropped.blob, "eng");

      const end = performance.now();

      const text = result.data.text;
      const extracted = extractId(text);

      setTime(Math.round(end - start));
      setOcrText(text);
      setNormalizedText(extracted.normalized);
      setId(extracted.id);
    } catch (err) {
      console.error(err);
      alert("OCR処理中にエラーが発生しました。");
    } finally {
      setLoading(false);

      input.value = "";
      setInputKey((prev) => prev + 1);
    }
  };

  return (
    <main
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: 24,
        paddingBottom: 120,
      }}
    >
      <h1>OCRテスト</h1>

      <p
        style={{
          lineHeight: 1.7,
          color: "#555",
        }}
      >
        画面中央の横長エリアにIDが入るように撮影してください。
        <br />
        例：#ABC-0001
      </p>

      <input
        key={inputKey}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
      />

      {preview && (
        <section style={{ marginTop: 24 }}>
          <h2>元画像</h2>

          <div
            style={{
              position: "relative",
              width: "100%",
              overflow: "hidden",
              borderRadius: 12,
              background: "#eee",
            }}
          >
            <img
              src={preview}
              alt="preview"
              style={{
                display: "block",
                width: "100%",
              }}
            />

            <div
              style={{
                position: "absolute",
                left: `${((1 - FRAME_WIDTH_RATIO) / 2) * 100}%`,
                top: `${((1 - FRAME_HEIGHT_RATIO) / 2) * 100}%`,
                width: `${FRAME_WIDTH_RATIO * 100}%`,
                height: `${FRAME_HEIGHT_RATIO * 100}%`,
                border: "3px solid #00a86b",
                borderRadius: 10,
                boxShadow: "0 0 0 9999px rgba(0,0,0,.35)",
                pointerEvents: "none",
              }}
            />
          </div>
        </section>
      )}

      {croppedPreview && (
        <section style={{ marginTop: 24 }}>
          <h2>OCR対象エリア</h2>

          <img
            src={croppedPreview}
            alt="cropped preview"
            style={{
              display: "block",
              width: "100%",
              borderRadius: 12,
              background: "#eee",
              border: "1px solid #ddd",
            }}
          />
        </section>
      )}

      {loading && (
        <p
          style={{
            marginTop: 24,
            fontWeight: "bold",
          }}
        >
          OCR解析中...
        </p>
      )}

      {!loading && (ocrText || normalizedText || id) && (
        <>
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
        </>
      )}
    </main>
  );
}