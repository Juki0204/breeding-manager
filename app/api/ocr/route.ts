import { GoogleGenAI, Type } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("image");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { id: null, rawText: "", error: "画像がありません" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: file.type || "image/jpeg",
            data: base64,
          },
        },
        {
          text: `
画像内に書かれている管理IDを読み取ってください。

ルール:
- 英字、数字、ハイフンで構成されます
- 例: #ABC-0001, ABC-0001, 2026-A-01
- 読み取れない場合は null を返してください
- 余計な説明は不要です

返却形式:
{
  "id": "ABC-0001",
  "rawText": "読み取った文字列"
}
          `.trim(),
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              nullable: true,
            },
            rawText: {
              type: Type.STRING,
            },
          },
          required: ["id", "rawText"],
        },
      },
    });

    const text = response.text ?? "{}";
    const json = JSON.parse(text);

    return NextResponse.json({
      id: json.id ?? null,
      rawText: json.rawText ?? "",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { id: null, rawText: "", error: "OCR処理に失敗しました" },
      { status: 500 }
    );
  }
}