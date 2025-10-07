// netlify/functions/metar.js
exports.handler = async (event) => {
  const icao = (event.queryStringParameters?.icao || "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(icao)) return plain(400, "Invalid ICAO");

  const CHECKWX_API_KEY = process.env.CHECKWX_API_KEY;
  // Try CheckWX if key provided
if (CHECKWX_API_KEY) {
  try {
    const r = await fetch(`https://api.checkwx.com/metar/${icao}?format=raw`, {
      headers: { "X-API-Key": CHECKWX_API_KEY },
    });

    if (r.ok) {
      const ctype = r.headers.get("content-type") || "";
      const body = await r.text();

      // CheckWX often returns JSON with data:[ "METAR ...." ]
      if (ctype.includes("application/json") || body.trim().startsWith("{")) {
        try {
          const json = JSON.parse(body);
          const line = json?.data?.[0];
          if (line) return plain(200, line.trim());
        } catch {}
      }

      // Or sometimes plain text list; pick first METAR-looking line
      const line = body.split("\n").find(l => /^(METAR|SPECI)\b/.test(l));
      if (line) return plain(200, line.trim());
    }
  } catch {}
}

  // NOAA fallback
  try {
    const r = await fetch(
      `https://aviationweather.gov/api/data/metar?ids=${icao}&format=raw`,
      { headers: { "User-Agent": "metar-card" } }
    );
    if (r.ok) {
      const txt = (await r.text()).trim();
      if (txt) return plain(200, txt);
    }
  } catch {}

  return plain(502, "Unavailable");
};

function plain(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
    body,
  };
}
