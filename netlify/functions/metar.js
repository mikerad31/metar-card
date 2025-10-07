// netlify/functions/metar.js (CommonJS)
exports.handler = async (event, context) => {
  try {
    const icao = (event.queryStringParameters?.icao || "").toUpperCase();
    if (!/^[A-Z]{4}$/.test(icao)) {
      return plain(400, "Invalid ICAO");
    }

    // Optional key (https://checkwx.com)
    const CHECKWX_API_KEY = process.env.CHECKWX_API_KEY;

    // 1) Try CheckWX if key present
    if (CHECKWX_API_KEY) {
      try {
        const r = await fetch(`https://api.checkwx.com/metar/${icao}?format=raw`, {
          headers: { "X-API-Key": CHECKWX_API_KEY },
        });
        if (r.ok) {
          const txt = (await r.text()).trim();
          if (txt) return plain(200, txt);
        }
      } catch {}
    }

    // 2) NOAA fallback (free, best-effort)
    const NOAA = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`;
    try {
      const r = await fetch(NOAA, { headers: { "User-Agent": "metar-card" } });
      if (r.ok) {
        const txt = (await r.text()).trim();
        if (txt) return plain(200, txt);
      }
    } catch {}

    return plain(502, "Unavailable");
  } catch (err) {
    return plain(500, "Server error");
  }
};

function plain(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // CORS: safe both locally and on Netlify
      "Access-Control-Allow-Origin": "*",
    },
    body,
  };
}