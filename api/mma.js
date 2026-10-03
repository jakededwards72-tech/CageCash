const BASE = "https://api.sportsgameodds.com/v2/events";

function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace("+", ""));
  return Number.isFinite(n) ? n : null;
}
function dec(o) {
  o = num(o);
  if (o === null || o === 0) return null;
  return o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o);
}
function prob(o) {
  o = num(o);
  if (o === null || o === 0) return null;
  return o < 0 ? Math.abs(o) / (Math.abs(o) + 100) : 100 / (o + 100);
}
function teamName(t, fallback) {
  return t?.names?.long || t?.names?.medium || t?.names?.short || t?.name || t?.displayName || fallback;
}
function bookQuote(id, q) {
  if (!q || q.available === false) return null;
  const odds = num(q.odds);
  if (odds === null) return null;
  return {
    bookmakerID: id,
    odds,
    decimal: dec(odds),
    openOdds: num(q.openOdds),
    closeOdds: num(q.closeOdds),
    deeplink: q.deeplink || null
  };
}
function normalOdd(odd) {
  const books = Object.entries(odd?.byBookmaker || {})
    .map(([id, q]) => bookQuote(id, q))
    .filter(Boolean)
    .sort((a, b) => (b.decimal || 0) - (a.decimal || 0));
  const bestBook = books[0] || null;
  const fairOdds = num(odd?.fairOdds);
  const fairProbability = prob(fairOdds);
  const bestImplied = bestBook ? prob(bestBook.odds) : null;
  return {
    oddID: odd?.oddID || null,
    marketName: odd?.marketName || null,
    periodID: odd?.periodID || null,
    betTypeID: odd?.betTypeID || null,
    sideID: odd?.sideID || null,
    fairOdds,
    fairProbability,
    bestBook,
    edge: fairProbability !== null && bestImplied !== null ? (fairProbability - bestImplied) * 100 : null,
    ev: fairProbability !== null && bestBook?.decimal ? (fairProbability * bestBook.decimal - 1) * 100 : null,
    books
  };
}
function normalEvent(e) {
  const rawOdds = Array.isArray(e?.odds) ? e.odds : Object.values(e?.odds || {});
  const markets = rawOdds.map(normalOdd);
  const gameML = markets.filter(m => m.betTypeID === "ml" && (!m.periodID || m.periodID === "game"));
  return {
    eventID: e?.eventID || String(Math.random()),
    leagueID: e?.leagueID || e?.league?.leagueID || "MMA",
    startTime: e?.status?.startsAt || e?.startTime || e?.info?.startTime || null,
    started: Boolean(e?.status?.started),
    home: { name: teamName(e?.teams?.home, "Home fighter") },
    away: { name: teamName(e?.teams?.away, "Away fighter") },
    moneyline: {
      home: gameML.find(m => m.sideID === "home") || null,
      away: gameML.find(m => m.sideID === "away") || null
    },
    markets
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const key = process.env.SPORTSGAMEODDS_API_KEY;
  if (!key) return res.status(500).json({ ok: false, code: "KEY_MISSING", error: "SPORTSGAMEODDS_API_KEY is not configured in Vercel." });

  const url = new URL(BASE);
  url.searchParams.set("sportID", "MMA");
  url.searchParams.set("oddsAvailable", "true");
  url.searchParams.set("includeOpenCloseOdds", "true");
  url.searchParams.set("limit", "100");

  try {
    const r = await fetch(url, { headers: { "x-api-key": key, "accept": "application/json" } });
    const body = await r.json().catch(() => null);
    if (!r.ok || !body?.success) {
      return res.status(r.status || 502).json({ ok: false, code: "UPSTREAM_ERROR", error: body?.error || `SportsGameOdds HTTP ${r.status}` });
    }
    const events = (body.data || []).map(normalEvent).sort((a, b) => {
      const aa = a.startTime ? new Date(a.startTime).getTime() : Infinity;
      const bb = b.startTime ? new Date(b.startTime).getTime() : Infinity;
      return aa - bb;
    });
    res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=30");
    return res.status(200).json({ ok: true, provider: "SportsGameOdds", fetchedAt: new Date().toISOString(), events });
  } catch (e) {
    return res.status(502).json({ ok: false, code: "FETCH_FAILED", error: e instanceof Error ? e.message : "Unable to load MMA odds." });
  }
}