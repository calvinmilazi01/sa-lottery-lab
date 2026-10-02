// Results sync for your own PC. The official results API refuses GitHub's servers but works from
// South African connections, so Windows Task Scheduler runs this nightly (see README):
// fetch official results -> rebuild picks -> push data/ to GitHub, which then redeploys the site.
//
// It works in a separate clone (default %LOCALAPPDATA%\sa-lottery-lab-sync) that it resets to
// GitHub's main each time, so your own working copy is never touched. Log: <clone>\..\sa-lottery-lab-sync.log
//
// Env: SALAB_REPO (clone URL), SALAB_SYNC_DIR (clone folder)
import { spawnSync } from "node:child_process";
import { existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const REPO_URL = process.env.SALAB_REPO || "https://github.com/calvinmilazi01/sa-lottery-lab.git";
const DIR = process.env.SALAB_SYNC_DIR || join(process.env.LOCALAPPDATA || homedir(), "sa-lottery-lab-sync");
const LOG = join(dirname(DIR), "sa-lottery-lab-sync.log");
const OWNER = REPO_URL.match(/github\.com[/:]([^/]+)\//)?.[1] || "sync";

const log = msg => { const line = `[${new Date().toISOString()}] ${msg}`; console.log(line); try { appendFileSync(LOG, line + "\n"); } catch {} };
function run(cmd, args, { cwd = DIR, allowFail = false } = {}) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  if (out) for (const l of out.split("\n")) log(`  ${l}`);
  if (r.status !== 0 && !allowFail) throw new Error(`${cmd} ${args.join(" ")} exited with ${r.status ?? r.error?.message}`);
  return r.status;
}

try {
  log("Sync started");
  if (!existsSync(join(DIR, ".git"))) {
    log(`Cloning ${REPO_URL} into ${DIR}`);
    run("git", ["clone", "--quiet", REPO_URL, DIR], { cwd: dirname(DIR) });
    run("git", ["config", "user.name", "SA Lottery Lab PC sync"]);
    run("git", ["config", "user.email", `${OWNER}@users.noreply.github.com`]);
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    run("git", ["fetch", "--quiet", "origin"]);
    run("git", ["reset", "--quiet", "--hard", "origin/main"]);
    // update-draws exits 1 if some games failed but still saves what it got; git diff decides below
    if (run(process.execPath, ["scripts/update-draws.mjs"], { allowFail: true }) !== 0) log("Some games failed to sync (see above)");
    run(process.execPath, ["scripts/picks.mjs"]);
    run("git", ["add", "data/"]);
    if (run("git", ["diff", "--cached", "--quiet"], { allowFail: true }) === 0) { log("No new data; nothing to push"); break; }
    const day = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
    run("git", ["commit", "--quiet", "-m", `Results and picks for ${day} (PC sync)`]);
    if (run("git", ["push", "--quiet", "origin", "HEAD:main"], { allowFail: true }) === 0) { log("Pushed to GitHub"); break; }
    if (attempt === 3) throw new Error("Push kept failing (GitHub changed underneath, or sign-in expired)");
    log(`Push rejected, retrying (${attempt}/3)`);
  }
  log("Sync finished");
} catch (e) {
  log(`Sync FAILED: ${e.message}`);
  process.exit(1);
}
