import pdfParse from "pdf-parse/lib/pdf-parse.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

// ─── Pre-process PDF text to clean up column merging ─────────────────────────
// Indian bank PDFs extracted via pdf-parse merge columns onto one line.
// e.g. "AMAZON PAY INDIA PVT LT BANGALORE IN 24 1,235.00"
// The reward points column (small integer like 24) sits just before the amount.
// Strategy: for each line that looks like a transaction, strip any small integer
// that appears immediately before the final amount, then send the cleaned text
// to Groq so it only ever sees one number at the end of each transaction line.

function cleanStatementText(raw) {
  const lines = raw.split("\n");
  const cleaned = lines.map(line => {
    // Match lines that end with a currency amount (Indian format, optional CR suffix)
    // e.g. "...BANGALORE IN 24 1,235.00" or "...MUMBAI IN 17 860.00"
    // Pattern: optional small integer (reward points 1-5 digits) followed by the amount
    const amountPattern = /^(.*?)\s+(\d{1,5})\s+([\d,]+\.\d{2})\s*(CR)?$/;
    const match = line.match(amountPattern);
    if (match) {
      const prefix = match[1];       // merchant + location
      // match[2] is the reward points integer — DROP it
      const amount = match[3].replace(/,/g, ""); // clean amount
      const cr = match[4] ? " CR" : "";
      return `${prefix} ${amount}${cr}`;
    }
    return line;
  });
  return cleaned.join("\n");
}

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

    // Step 1: Extract raw text from PDF
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const pdfData = await pdfParse(pdfBuffer);
    const rawText = pdfData.text;

    if (!rawText || rawText.trim().length < 20) {
      return res.status(400).json({ error: { message: "Could not extract text from this PDF. It may be a scanned image — please use a text-based PDF." } });
    }

    // Step 2: Clean the text — strip reward points column
    const cleanedText = cleanStatementText(rawText);

    // Step 3: Send cleaned text to Groq
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
            content: `You are a bank statement parser. Extract purchase transactions from the text.
Rules:
- Each transaction line ends with a single decimal number — that is the amount
- Skip any line ending in CR (that is a credit/payment/refund)
- The amount is ALWAYS the last number on the line
- Return ONLY a valid JSON array, no markdown, no backticks, no explanation`,
          },
          {
            role: "user",
            content: `${prompt}\n\nCleaned statement text:\n\n${cleanedText}`,
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
