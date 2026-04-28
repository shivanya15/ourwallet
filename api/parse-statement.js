import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "GROQ_API_KEY not set in environment variables" } });
  }

  try {
    const { pdfBase64, prompt } = req.body;

    // Step 1: Extract text from PDF
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const pdfData = await pdfParse(pdfBuffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length < 20) {
      return res.status(400).json({ error: { message: "Could not extract text from this PDF. It may be a scanned image — please try a text-based PDF." } });
    }

    // Step 2: Send extracted text to Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: "You are a bank statement parser. You extract transaction data from raw text and return only valid JSON arrays. Never include explanations, markdown, or backticks in your response.",
          },
          {
            role: "user",
            content: `${prompt}\n\nHere is the raw text extracted from the PDF:\n\n${pdfText}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || `Groq API error ${response.status}`;
      return res.status(response.status).json({ error: { message: msg } });
    }

    const text = data?.choices?.[0]?.message?.content || "[]";
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
