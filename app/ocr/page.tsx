"use client";

import { useState } from "react";
import { recognize } from "tesseract.js";

export default function OCRTestPage() {
  const [preview, setPreview] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const handleFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const input = e.currentTarget;
    const file = input.files?.[0];

    console.log("onChange");
    console.log(file);

    if (!file) return;

    setPreview(URL.createObjectURL(file));

    setLoading(true);

    const start = performance.now();

    try {
      const result = await recognize(file, "eng");

      const end = performance.now();

      setTime(Math.round(end - start));

      const text = result.data.text;

      setOcrText(text);

      const match = text.match(/#([A-Z0-9-]+)/i);

      setId(match?.[1] ?? "");
    } catch (err) {
      console.error(err);
    }

    setLoading(false);

    // inputをリセット（同じファイルでも再度選択できるように）
    input.value = "";

    // input自体も作り直す
    setInputKey((prev) => prev + 1);
  };

  return (
    <main
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <h1>OCRテスト</h1>

      <input
        key={inputKey}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
      />

      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{
            width: "100%",
            marginTop: 20,
            borderRadius: 8,
          }}
        />
      )}

      {loading && <p>OCR解析中...</p>}

      {!loading && (
        <>
          <h2>OCR結果</h2>

          <pre
            style={{
              background: "#eee",
              padding: 16,
              whiteSpace: "pre-wrap",
            }}
          >
            {ocrText}
          </pre>

          <h2>抽出ID</h2>

          <p
            style={{
              fontSize: 28,
              fontWeight: "bold",
            }}
          >
            {id || "検出できませんでした"}
          </p>

          <h2>認識時間</h2>

          <p>{time ? `${time} ms` : "-"}</p>
        </>
      )}
    </main>
  );
}