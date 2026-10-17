// Server-side Gemini call. Returns null on any failure so callers use deterministic fallback text.
export async function generateText(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null; // quota / auth errors fall back silently (never log the prompt)
    const text = (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text && text.length > 40 && text.length < 3000 ? text : null;
  } catch { return null; }
}
