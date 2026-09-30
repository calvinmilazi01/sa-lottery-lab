// Pulls every draw since the June 2026 rule change from the official National Lottery results API
// and writes data/draws.json (for scripts) and data/draws.js (for the page, works from file:// too).
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
const JSON_PATH = new URL("../data/draws.json", import.meta.url);
const JS_PATH = new URL("../data/draws.js", import.meta.url);

async function fetchPage(gameId, winPoolId, pageNum) {
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json", "user-agent": "sa-lottery-lab (nightly results sync)" },
        body: JSON.stringify({ gameId, winPoolId, pageNum, pageSize: 100 }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j.code !== 0 || !j.data) throw new Error(`API said: ${j.msg}`);
      return j.data;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise(res => setTimeout(res, 2000 * attempt));
    }
  }
}

// drawTime is UTC; draws happen around 21:00 SAST (UTC+2), so shift before taking the date
const sastDate = iso => new Date(Date.parse(iso) + 2 * 3600e3).toISOString().slice(0, 10);

function toDraw(g, row) {
  const nums = row.winNumList.map(Number), K = g.K;
  const n = nums.slice(0, K).sort((a, b) => a - b), b = g.type === "none" ? null : nums[K] ?? null;
  const ok = n.length === K && new Set(n).size === K && n.every(x => Number.isInteger(x) && x >= 1 && x <= g.N)
    && (b == null || (Number.isInteger(b) && b >= 1 && b <= (g.type === "sep" ? g.B : g.N)));
  return ok ? [sastDate(row.drawTime), n, b] : null;
}

const store = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, "utf8")) : { draws: {}, info: {} };
let failures = 0, added = 0;

for (const [id, [gameId, winPoolId]] of Object.entries(POOLS)) {
  const g = GAMES[id];
  try {
    const rows = [];
    for (let page = 1, pages = 1; page <= pages; page++) {
      const d = await fetchPage(gameId, winPoolId, page);
      pages = d.pages; rows.push(...d.list);
    }
    const byDate = new Map((store.draws[id] || []).map(d => [d[0], d]));
    const before = byDate.size;
    for (const row of rows) {
      const d = toDraw(g, row);
      if (d) byDate.set(d[0], d); else console.warn(`${id}: skipped malformed draw ${row.drawTime} ${row.winNumList}`);
    }
    store.draws[id] = [...byDate.values()].sort((a, b) => a[0].localeCompare(b[0]));
    added += byDate.size - before;
    const latest = rows.find(r => r.isLatestIssue) || rows[0];
    if (latest) store.info[id] = {
      lastDraw: sastDate(latest.drawTime),
      nextJackpot: latest.nextJackpot / 100,         // API amounts are in cents
      boardsSold: Math.round(latest.saleMoney / 100 / g.price),
    };
    console.log(`${id}: ${store.draws[id].length} draws, latest ${store.info[id]?.lastDraw}`);
  } catch (e) {
    failures++;
    console.error(`${id}: fetch failed (${e.message}); keeping existing data`);
  }
}

if (failures === Object.keys(POOLS).length) {
  console.error("Every game failed to fetch. The results API may be down or blocking this runner.");
  process.exit(1);
}

store.updated = new Date().toISOString();
writeFileSync(JSON_PATH, JSON.stringify(store) + "\n");
writeFileSync(JS_PATH, "window.SALAB_DATA=" + JSON.stringify(store) + ";\n");
console.log(`Done: ${added} new draw(s).`);
