export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: "GEMINI_API_KEY not set in environment variables" } });
  }

  try {
    const { pdfBase64, prompt } = req.body;

    const payload = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: "application/pdf",
              data: pdfBase64,
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.error?.message || `Gemini API error ${response.status}`;
      return res.status(response.status).json({ error: { message: msg } });
    }

    // Extract text from Gemini response and return in a normalised shape
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
