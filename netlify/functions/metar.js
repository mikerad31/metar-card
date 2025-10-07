// netlify/functions/metar.js
export default async (req, context) => {
  const url = new URL(req.url);
  const icao = (url.searchParams.get("icao") || "").toUpperCase();

  if (!/^[A-Z]{4}$/.test(icao)) {
    return new Response("Invalid ICAO", { status: 400 });
  }

  // Optional paid/free keys (use if you have them)
  const CHECKWX_API_KEY = context?.env?.CHECKWX_API_KEY; // https://checkwx.com
  // const AVWX_API_KEY = context?.env?.AVWX_API_KEY;     // https://avwx.rest

  // NOAA fallback (free)
  const NOAA = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`;

  // Try CheckWX if key provided
  if (CHECKWX_API_KEY) {
    try {
      const r = await fetch(`https://api.checkwx.com/metar/${icao}?format=raw`, {
        headers: { "X-API-Key": CHECKWX_API_KEY },
      });
      if (r.ok) {
        const txt = (await r.text()).trim();
        if (txt) return new Response(txt, { status: 200 });
      }
    } catch {}
  }

  // Try NOAA (best-effort)
  try {
    const r = await fetch(NOAA, { headers: { "User-Agent": "metar-card" } });
    if (r.ok) {
      const txt = (await r.text()).trim();
      if (txt) return new Response(txt, { status: 200 });
    }
  } catch {}

  return new Response("Unavailable", { status: 502 });
};
