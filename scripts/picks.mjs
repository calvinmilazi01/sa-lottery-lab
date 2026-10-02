// Builds 5 forecast picks for every game's next draw with the app's forecast generator (default
// settings), scores each game's previous picks against its results, and optionally pushes a phone
// notification with the picks for games drawn today.
//
//   node scripts/picks.mjs            write data/picks.json + data/picks.js
//   node scripts/picks.mjs --notify   ...and send today's picks via ntfy and/or Telegram (see README)
//
// Env: PICK_DATE=YYYY-MM-DD (default: today in SAST, or tomorrow after 21:00 SAST)
//      PICK_GAMES=lotto,daily,...  games to include in the notification (default: all)
//      PICKS_PER_GAME=1..5  tickets per game in the notification (default 5; the site always gets 5)
//      NTFY_TOPIC, NTFY_SERVER, NTFY_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SITE_URL
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { GAMES, setSeeds, forecastCombos, mulberry32, hashStr, divisions, fmtOddsPlain } = require("../js/core.js");

const env = process.env;
const DATA = JSON.parse(readFileSync(new URL("../data/draws.json", import.meta.url), "utf8"));
const PICKS_JSON = new URL("../data/picks.json", import.meta.url);
const PICKS_JS = new URL("../data/picks.js", import.meta.url);
setSeeds(DATA.draws);

// Same defaults as the Forecast generator tab
const OPTS = { window: 30, halfLife: 8, hot: 1, recent: 1, overdue: 0, pairs: 1, balance: 1, avoid: 1 };
const TICKETS = 5;
const perGame = Math.min(TICKETS, Math.max(1, +env.PICKS_PER_GAME || TICKETS));
const only = env.PICK_GAMES ? env.PICK_GAMES.split(",").map(s => s.trim()) : null;

const sastNow = new Date(Date.now() + 2 * 3600e3);
const addDays = (iso, k) => new Date(Date.parse(iso + "T12:00:00Z") + k * 864e5).toISOString().slice(0, 10);
const today = sastNow.toISOString().slice(0, 10);
const date = env.PICK_DATE || (sastNow.getUTCHours() >= 21 ? addDays(today, 1) : today);
const weekday = d => new Date(d + "T12:00:00Z").getUTCDay();
const fmtDay = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const rands = v => v >= 1e6 ? `R${+(v / 1e6).toFixed(1)}m` : `R${Math.round(v / 1000)}k`;

// A game "runs" on a weekday if its recent draws hit that weekday at least half as often as an even
// spread over its draw days would (so it follows schedule changes without a hard-coded calendar).
function drawsOn(g, d) {
  const recent = g.seed.slice(-28);
  if (recent.length < 5) return false;
  const days = new Set(recent.map(x => weekday(x.d))).size;
  return recent.filter(x => weekday(x.d) === weekday(d)).length >= 0.5 * recent.length / days;
}
const nextDraw = g => { for (let k = 0; k < 8; k++) { const d = addDays(date, k); if (drawsOn(g, d)) return d; } return null; };

// Score a game's earlier picks once its draw is in
function score(g, p) {
  const draw = g.seed.find(x => x.d === p.date);
  if (!draw) return null;
  return {
    date: p.date, draw: { n: draw.n, b: draw.b },
    tickets: p.tickets.map(tk => ({
      t: tk.t, pb: tk.pb,
      matches: tk.t.filter(x => draw.n.includes(x)).length,
      bonus: g.type === "sep" ? tk.pb === draw.b : g.type === "same" ? tk.t.includes(draw.b) : false,
    })),
  };
}

const old = existsSync(PICKS_JSON) ? JSON.parse(readFileSync(PICKS_JSON, "utf8")) : null;
const games = {};
for (const g of Object.values(GAMES)) {
  const when = g.retired ? null : nextDraw(g);
  if (!when) continue;
  const D = g.seed.filter(x => x.d < when);
  if (D.length < 5) continue;
  const rng = mulberry32(hashStr(when + g.id));
  const { combos } = forecastCombos(g, D, D.length, OPTS, TICKETS, 20000, rng, D);
  const prev = old?.games?.[g.id], prevDate = prev?.date || old?.date;
  const legacy = old?.previous?.games?.[g.id];   // older file layout kept one shared "previous" block
  let previous = prev?.previous ?? (legacy ? { ...legacy, date: old.previous.date } : null);
  if (prev && prevDate < when) previous = score(g, { ...prev, date: prevDate }) || previous;
  games[g.id] = {
    name: g.name, date: when, basedOn: D.length,
    tickets: combos.map(c => ({ t: c.t, pb: c.pb ?? null, score: +c.score.toFixed(2) })),
    jackpot: DATA.info?.[g.id]?.nextJackpot ?? null,
    odds: fmtOddsPlain(divisions(g)[0].p),
    previous,
  };
}

const out = { generated: new Date().toISOString(), date, settings: OPTS, games };
writeFileSync(PICKS_JSON, JSON.stringify(out, null, 1) + "\n");
writeFileSync(PICKS_JS, "window.SALAB_PICKS=" + JSON.stringify(out) + ";\n");

// ---------- message: games drawn on `date` ----------
const nums = tk => tk.t.join(" ") + (tk.pb != null ? ` + PB ${tk.pb}` : "");
const todays = Object.entries(games).filter(([id, p]) => p.date === date && (!only || only.includes(id))).map(([, p]) => p);
const lines = [];
if (!todays.length) lines.push(`No draws scheduled for ${fmtDay(date)}.`);
for (const p of todays) {
  lines.push(`${p.name}${p.jackpot ? ` (${rands(p.jackpot)})` : ""}:`);
  for (const tk of p.tickets.slice(0, perGame)) lines.push(`  ${nums(tk)}`);
}
const recent = Object.entries(games).filter(([id, p]) => p.previous && p.previous.date >= addDays(date, -1) && (!only || only.includes(id)));
if (recent.length) {
  lines.push("", "Last results vs picks:");
  for (const [, p] of recent) {
    const pv = p.previous, best = pv.tickets.reduce((a, b) => (b.matches > a.matches ? b : a));
    lines.push(`  ${p.name} ${fmtDay(pv.date)}: ${pv.draw.n.join(" ")}${pv.draw.b != null ? ` + ${pv.draw.b}` : ""} - best pick matched ${best.matches}${best.bonus ? " + bonus" : ""}`);
  }
}
lines.push("", "Every combination has the same odds; these are the forecast model's top scores.");
const title = `Lottery picks for ${fmtDay(date)}`;
const body = lines.join("\n");
console.log(title + "\n" + body);

if (process.argv.includes("--notify")) {
  let sent = 0, tried = 0;
  // Accept the bare topic or a pasted subscription link ("ntfy.sh/topic", "https://ntfy.sh/topic"), ignoring stray whitespace
  const topic = (env.NTFY_TOPIC || "").trim().replace(/^(https?:\/\/)?[^/\s]+\.[^/\s]+\//i, "").replace(/^\/+|\/+$/g, "");
  if (env.NTFY_TOPIC && !/^[\w-]{1,64}$/.test(topic)) {
    tried++;
    console.error("ntfy: NTFY_TOPIC isn't a valid topic name. Use only letters, numbers, - or _ (no spaces), e.g. salab-k7q2m9xw4t.");
  } else if (topic) {
    tried++;
    const r = await fetch(`${(env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "")}/${topic}`, {
      method: "POST", body,
      headers: {
        Title: title, Tags: "game_die", Priority: "default",
        ...(env.SITE_URL ? { Click: env.SITE_URL } : {}),
        ...(env.NTFY_TOKEN ? { Authorization: `Bearer ${env.NTFY_TOKEN}` } : {}),
      },
    });
    console.log(`ntfy: HTTP ${r.status}${r.ok ? "" : ` ${(await r.text()).trim()}`}`); if (r.ok) sent++;
  }
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    tried++;
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: `${title}\n\n${body}${env.SITE_URL ? `\n\n${env.SITE_URL}` : ""}`, disable_web_page_preview: true }),
    });
    console.log(`telegram: HTTP ${r.status}`); if (r.ok) sent++;
  }
  if (!sent) {
    console.error(tried ? "No notification was delivered (see the error above)." : "No notification sent: set NTFY_TOPIC and/or TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.");
    process.exit(1);
  }
}
