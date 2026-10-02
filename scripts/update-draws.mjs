// Pulls every draw since the June 2026 rule change from the official National Lottery results API
// and writes data/draws.json (for scripts) and data/draws.js (for the page, works from file:// too).
// The official API refuses some networks (it returns 403 to GitHub's runners), so any game it can't
// serve falls back to the latest 10 draws listed on za.lottonumbers.com.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { GAMES } = require("../js/core.js");

const API = "https://www.nationallottery.co.za/api/engine/draw/issueWinPoolInfoPageQuery";
// gameId / winPoolId pairs from the site's getGamePoolList call
const POOLS = {
  lotto: [11101, 100], plus1: [11101, 101], plus2: [11101, 102],
  daily: [11001, 100], pb: [11201, 100], pbx: [11201, 101],
};
// Fallback: results page and which <ul class="balls ..."> list inside each draw belongs to the game
const FALLBACK = {
  lotto: ["lotto", "lotto-main"], plus1: ["lotto", "plus-1"], plus2: ["lotto", "lotto-5-max"],
  daily: ["daily-lotto", ""], pb: ["powerball", ""], pbx: ["powerball", "pb-xtra"],
};
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const JSON_PATH = new URL("../data/draws.json", import.meta.url);
const JS_PATH = new URL("../data/draws.js", import.meta.url);

async function retry(fn) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); } catch (e) {
      if (attempt >= 3 || /HTTP 4\d\d/.test(e.message)) throw e;   // a 4xx won't fix itself
      await new Promise(res => setTimeout(res, 2000 * attempt));
    }
  }
}

const fetchPage = (gameId, winPoolId, pageNum) => retry(async () => {
  const r = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json", accept: "application/json, text/plain, */*", "user-agent": UA,
      origin: "https://www.nationallottery.co.za", referer: "https://www.nationallottery.co.za/results",
    },
    body: JSON.stringify({ gameId, winPoolId, pageNum, pageSize: 100 }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  if (j.code !== 0 || !j.data) throw new Error(`API said: ${j.msg}`);
  return j.data;
});

const pageCache = new Map();
const fetchFallbackPage = slug => {
  if (!pageCache.has(slug)) pageCache.set(slug, retry(async () => {
    const r = await fetch(`https://za.lottonumbers.com/${slug}/results`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  }));
  return pageCache.get(slug);
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
async function fallbackDraws(g, id) {
  const [slug, cls] = FALLBACK[id], html = await fetchFallbackPage(slug), out = [];
  for (const block of html.split('<div class="draw">').slice(1)) {
    const dm = block.match(/<div>\s*(\d{1,2}) ([A-Za-z]+) (\d{4})\s*<\/div>/);
    const lists = [...block.matchAll(/<ul class="balls\s*([^"]*)">([\s\S]*?)<\/ul>/g)];
    // Lotto lists are always tagged; PowerBall and Daily Lotto's main list has no extra class
    const list = lists.find(l => l[1].trim() === cls) || (cls === "lotto-main" ? lists[0] : null);
    if (!dm || !list || MONTHS.indexOf(dm[2].toLowerCase()) < 0) continue;
    const date = `${dm[3]}-${String(MONTHS.indexOf(dm[2].toLowerCase()) + 1).padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    const balls = [...list[2].matchAll(/<li class="ball ([^"]*)">\s*(\d+)\s*<\/li>/g)];
    const d = toDraw(g, date, [...balls.filter(b => b[1] === "ball"), ...balls.filter(b => b[1] !== "ball")].map(b => b[2]));
    if (d) out.push(d);
  }
  if (!out.length) throw new Error("no draws found on the page (layout may have changed)");
  return out;
}

// drawTime is UTC; draws happen around 21:00 SAST (UTC+2), so shift before taking the date
const sastDate = iso => new Date(Date.parse(iso) + 2 * 3600e3).toISOString().slice(0, 10);

function toDraw(g, date, list) {
  const nums = list.map(Number), K = g.K;
  const n = nums.slice(0, K).sort((a, b) => a - b), b = g.type === "none" ? null : nums[K] ?? null;
  const ok = n.length === K && new Set(n).size === K && n.every(x => Number.isInteger(x) && x >= 1 && x <= g.N)
    && (b == null || (Number.isInteger(b) && b >= 1 && b <= (g.type === "sep" ? g.B : g.N)));
  return ok ? [date, n, b] : null;
}

const store = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, "utf8")) : { draws: {}, info: {} };
let failures = 0, added = 0;

for (const [id, [gameId, winPoolId]] of Object.entries(POOLS)) {
  const g = GAMES[id], byDate = new Map((store.draws[id] || []).map(d => [d[0], d])), before = byDate.size;
  let source = "official";
  try {
    const rows = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      const d = await fetchPage(gameId, winPoolId, page);
      pages = d.pages; rows.push(...d.list);
    }
    for (const row of rows) {
      const d = toDraw(g, sastDate(row.drawTime), row.winNumList);
      if (d) byDate.set(d[0], d); else console.warn(`${id}: skipped malformed draw ${row.drawTime} ${row.winNumList}`);
    }
    const latest = rows.find(r => r.isLatestIssue) || rows[0];
    if (latest) store.info[id] = {
      lastDraw: sastDate(latest.drawTime),
      nextJackpot: latest.nextJackpot / 100,         // API amounts are in cents
      boardsSold: Math.round(latest.saleMoney / 100 / g.price),
    };
  } catch (e) {
    console.warn(`${id}: official API failed (${e.message}); trying za.lottonumbers.com`);
    try {
      source = "fallback";
      // Official data wins: only fill dates we don't already have
      for (const d of await fallbackDraws(g, id)) if (!byDate.has(d[0])) byDate.set(d[0], d);
    } catch (e2) {
      failures++;
      console.error(`${id}: fallback failed too (${e2.message}); keeping existing data`);
      continue;
    }
  }
  store.draws[id] = [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
  added += byDate.size - before;
  console.log(`${id}: ${store.draws[id].length} draws, latest ${store.draws[id].at(-1)?.[0]} (${source}, +${byDate.size - before})`);
}

if (failures === Object.keys(POOLS).length) {
  console.error("Every game failed on both sources. Existing data is unchanged.");
  process.exit(1);
}

store.updated = new Date().toISOString();
writeFileSync(JSON_PATH, JSON.stringify(store) + "\n");
writeFileSync(JS_PATH, "window.SALAB_DATA=" + JSON.stringify(store) + ";\n");
console.log(`Done: ${added} new draw(s).`);
if (failures) process.exit(1);   // partial failure: data saved, but flag the run so you hear about it
