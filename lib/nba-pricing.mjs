// Shared pricing engine for The Odds API v4.
// No bookmaker is allowed to validate its own apparent edge.
export const decimal = (american) => {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
};
export const american = (dec) => {
  if (!(dec > 1)) return null;
  return dec >= 2 ? Math.round((dec - 1) * 100) : -Math.round(100 / (dec - 1));
};
export const fairAmerican = (p) => {
  if (!(p > 0 && p < 1)) return null;
  return p >= 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p);
};
const median = (values) => {
  const a = values.filter(Number.isFinite).sort((a,b) => a-b);
  if (!a.length) return null;
  const n = a.length;
  return n % 2 ? a[(n-1)/2] : (a[n/2-1]+a[n/2])/2;
};
const name = (text) => String(text || "").toLowerCase()
  .replace(/los angeles clippers/g, "la clippers")
  .replace(/los angeles lakers/g, "la lakers")
  .replace(/[^a-z0-9]/g, "");
const sameTeam = (a,b) => name(a) === name(b);
const num = (n) => n === null || n === undefined || n === "" ? null : Number(n);
function appendPair(map, eventId, key, player, line, outcomes, book, updated) {
  if (outcomes.length !== 2) return;
  const a = outcomes[0], b = outcomes[1];
  const da = decimal(a.price), db = decimal(b.price);
  if (!da || !db) return;
  const pa = 1 / da, pb = 1 / db, sum = pa + pb;
  if (!(sum > 0.95 && sum < 1.35)) return;
  for (const [o,d,p] of [[a,da,pa/sum],[b,db,pb/sum]]) {
    const side = o.side;
    const marketId = [eventId,key,player || "",String(line),side].join("|");
    if (!map.has(marketId)) map.set(marketId,{id:marketId,eventId,market:key,player:player || null,line,side,selection:o.selection,quotes:[]});
    map.get(marketId).quotes.push({bookmakerID:book.key,bookmaker:book.title || book.key,odds:Number(o.price),decimal:d,pairedNoVig:p,updatedAt:updated || null});
  }
}
function collect(event, allowed) {
  const map = new Map();
  const away = event.away_team, home = event.home_team;
  for (const book of event.bookmakers || []) {
    if (!book.key) continue;
    for (const market of book.markets || []) {
      const key = market.key;
      if (!allowed.includes(key)) continue;
      const list = market.outcomes || [];
      if (key === "h2h" || key === "spreads") {
        const a = list.find(x => sameTeam(x.name,away));
        const h = list.find(x => sameTeam(x.name,home));
        if (!a || !h) continue;
        const ap = num(a.point), hp = num(h.point);
        if (key === "spreads" && (!Number.isFinite(ap) || !Number.isFinite(hp) || Math.abs(ap + hp) > 0.001)) continue;
        const line = key === "h2h" ? "ML" : ap;
        appendPair(map,event.id,key,null,line,[
          {price:a.price,side:"away",selection:away + (key === "spreads" ? " " + (ap > 0 ? "+" : "") + ap : "")},
          {price:h.price,side:"home",selection:home + (key === "spreads" ? " " + (hp > 0 ? "+" : "") + hp : "")}
        ],book,market.last_update || book.last_update);
      } else if (key === "totals" || key.startsWith("player_")) {
        const players = key === "totals" ? [""] : [...new Set(list.map(x => String(x.description || "").trim()).filter(Boolean))];
        for (const player of players) {
          const candidates = list.filter(x => key === "totals" || String(x.description || "").trim() === player);
          const lines = [...new Set(candidates.map(x => num(x.point)).filter(Number.isFinite))];
          for (const line of lines) {
            const o = candidates.find(x => x.name === "Over" && num(x.point) === line);
            const u = candidates.find(x => x.name === "Under" && num(x.point) === line);
            if (!o || !u) continue;
            appendPair(map,event.id,key,player,line,[
              {price:o.price,side:"Over",selection:(player ? player + " " : "") + "Over " + line},
              {price:u.price,side:"Under",selection:(player ? player + " " : "") + "Under " + line}
            ],book,market.last_update || book.last_update);
          }
        }
      }
    }
  }
  return [...map.values()];
}
export function normalizeMarkets(event, allowed=["h2h","spreads","totals"]) {
  if (!event?.id) return [];
  return collect(event,allowed).map(group => {
    const quotes = group.quotes;
    const center = median(quotes.map(q => q.pairedNoVig));
    // Exclude badly mis-mapped/stale-market probabilities when consensus exists.
    const valid = quotes.length >= 3 ? quotes.filter(q => Math.abs(q.pairedNoVig-center) <= 0.12) : quotes;
    const pool = valid.length >= 2 ? valid : quotes;
    const ranked = [...pool].sort((a,b) => b.decimal-a.decimal);
    const best = ranked[0];
    if (!best) return null;
    const peers = pool.filter(q => q.bookmakerID !== best.bookmakerID);
    const p = peers.length >= 2 ? median(peers.map(q => q.pairedNoVig)) : null;
    return {
      id:group.id,eventId:group.eventId,market:group.market,player:group.player,
      line:group.line,side:group.side,selection:group.selection,
      bestBook:{bookmakerID:best.bookmakerID,bookmaker:best.bookmaker,odds:best.odds,decimal:best.decimal,updatedAt:best.updatedAt},
      fairProbability:p,fairOdds:p === null ? null : fairAmerican(p),
      edge:p === null ? null : 100 * (p-1/best.decimal),
      ev:p === null ? null : 100 * (p*best.decimal-1),
      peerBooks:peers.length,books:quotes.map(q=>({bookmakerID:q.bookmakerID,bookmaker:q.bookmaker,odds:q.odds,updatedAt:q.updatedAt,excluded:!pool.includes(q)})).sort((a,b)=>decimal(b.odds)-decimal(a.odds)),
      integrity: p === null ? "INSUFFICIENT_PEERS" : pool.length >= 4 ? "GOOD" : "LIMITED"
    };
  }).filter(Boolean).sort((a,b) => (b.ev ?? -1000)-(a.ev ?? -1000));
}
export function normalizeOddsEvents(raw) {
  return Array.isArray(raw) ? raw.map(e => ({
    eventId:e.id,away:e.away_team,home:e.home_team,startTime:e.commence_time,
    markets:normalizeMarkets(e)
  })) : [];
}
export function matchOddsGame(game, oddsGames) {
  return oddsGames.find(e=>sameTeam(e.away,game.away.name) && sameTeam(e.home,game.home.name)) || null;
}
