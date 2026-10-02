# SA Lottery Probability Lab

A probability lab for the South African National Lottery (Lotto, Lotto Plus 1, Lotto 5 Max, Daily Lotto, PowerBall, PowerBall Xtra), hosted on GitHub Pages. A scheduled GitHub Action pulls the official results every night, rebuilds the day's forecast picks and can push them to your phone.

> Every combination has exactly the same chance of being drawn. The picks come from the lab's Forecast generator (hot frequency, recent form, pairs, balance, avoiding popular combinations). The lab's own backtests show these picks do no better than random numbers. Treat them as a way of choosing numbers, not an edge.

## How it works

| Time (SAST) | What runs |
|---|---|
| 23:00 nightly | `scripts/update-draws.mjs` pulls every draw from the official results API into `data/draws.json` / `data/draws.js`. `scripts/picks.mjs` builds 5 picks for each game's next draw into `data/picks.json` / `data/picks.js`. The workflow commits `data/` and redeploys the site. |
| 07:00 daily | Catches up on any results missed overnight, redeploys and sends **today's picks** to your phone. The message also shows how the previous picks did against the results. |
| Any push to `main` | Redeploys the site. |

GitHub can start scheduled runs 5–30 minutes late at busy times.

The page shows the 5 picks for whichever game is selected at the top. The phone notification only includes games drawn that day. The draw schedule is worked out from recent draw dates: Daily Lotto every day, Lotto on Wednesdays and Saturdays, PowerBall on Tuesdays and Fridays.

## Setup

1. **Create the repo and push.** Make a new GitHub repository (for example `sa-lottery-lab`), then from this folder run:
   ```bash
   git remote add origin https://github.com/<you>/sa-lottery-lab.git
   ```
   ```bash
   git push -u origin main
   ```
   Keep the repo public. GitHub Pages on a private repo needs a paid plan.
2. **Turn on Pages.** Go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. **Set up phone notifications.** Use ntfy, Telegram, or both.
   - **ntfy (easiest, free, no account):** install the ntfy app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/app/ntfy/id1625396347)), tap **+** and subscribe to a topic name that's hard to guess, such as `salab-7f3k9q2m`. Anyone who knows the name can read it. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add `NTFY_TOPIC` with that name.
   - **Telegram:** create a bot with @BotFather and send it a message. Then open `https://api.telegram.org/bot<TOKEN>/getUpdates` to find your chat id. Add the secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
4. **Test it.** Go to **Actions → Nightly results, picks and deploy → Run workflow**, leaving *Send the picks notification* ticked. The site will be at `https://<you>.github.io/sa-lottery-lab/`, and tapping the notification opens it.

### Optional settings

Set these under **Settings → Secrets and variables → Actions → Variables**:

| Variable | Default | Meaning |
|---|---|---|
| `PICK_GAMES` | all games | Games to include in the notification, as comma-separated ids: `lotto,plus1,plus2,daily,pb,pbx` |
| `PICKS_PER_GAME` | `5` | Tickets per game in the notification (1–5). The page always shows 5. |
| `NTFY_SERVER` | `https://ntfy.sh` | Self-hosted ntfy server. For a protected topic, also add the secret `NTFY_TOKEN`. |

## Updating on demand

The **Update now** button on the picks card starts the same workflow, waits for it (about a minute), then reloads the new results and picks. You can also choose to send the picks to your phone. The first time, it asks for a GitHub token, which is saved only in that browser:

1. Create a [fine-grained token](https://github.com/settings/personal-access-tokens/new).
2. Under **Repository access**, choose **Only select repositories** and pick this repo.
3. Under **Permissions**, add **Actions** and set it to **Read and write**. Nothing else is needed.

That token can only start and read this repo's workflow runs. Use **Forget saved token** in the update panel to remove it from a browser. Without a token, use **Actions → Run workflow** on GitHub instead.

## Local use

Requires Node 20+. There are no dependencies.

```bash
npm run update
```
```bash
npm run picks
```
```bash
npm run serve
```

`update` fetches results, `picks` rebuilds the picks, and `serve` previews the site at http://localhost:8080. Opening `index.html` directly works too.

## Files

- `index.html`: the page (markup and styles)
- `js/core.js`: game rules, maths, strategies and the forecast model, shared by the page and the scripts
- `js/app.js`: the page's UI
- `data/`: synced results and picks (written by the workflow)
- `scripts/`: the results sync, picks/notify and local server
- `.github/workflows/nightly.yml`: the schedule

Results come from the public results API behind nationallottery.co.za (`/api/engine/draw/issueWinPoolInfoPageQuery`). That API refuses GitHub's servers (HTTP 403), so on GitHub the sync falls back to the latest 10 draws listed on za.lottonumbers.com. Run `npm run update` on your own PC to refill the full official history if a long gap ever builds up. If both sources fail, the run is marked failed and GitHub emails you, but the site and notification still go out using the last good data.
