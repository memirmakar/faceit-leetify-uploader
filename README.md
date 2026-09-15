# FACEIT → Leetify auto-uploader

Automatically finds your new FACEIT **CS2** matches and uploads their demos to
[Leetify](https://leetify.com) — every day, on a schedule, with **zero clicks**.
No more opening each match room and pressing "upload".

You enter your FACEIT nickname and a (free) FACEIT API key once. Everything else
is automated.

> Windows only. Runs while you're logged in (it drives a real browser window,
> kept minimized and out of your way).

---

## How it works

Leetify has no official FACEIT auto-import (FACEIT rate-limited demo downloads),
so every tool for this uses your logged-in browser. This one does the same, but
as a controlled, logged, scheduled job instead of a flaky extension:

1. **FACEIT Data API** (free key) lists your recent matches — no bot-check.
2. A **real, logged-in browser** (Edge, dedicated profile) mints a Cloudflare
   Turnstile token and calls FACEIT's `download-url` API to get a presigned demo
   link — exactly the flow the FACEIT website uses.
3. That link is **POSTed to Leetify**, which downloads and processes the demo.

Already-uploaded matches are remembered, so runs only pick up new games.

---

## Install

1. **Download this repo** (green *Code* button → *Download ZIP*, then unzip;
   or `git clone`).
2. Double-click **`install.cmd`**.

The installer will:
- install Node.js if you don't have it,
- install dependencies and a browser,
- ask for your **FACEIT nickname** and **Data API key** (see below),
- ask what time to run daily (default **7:00 PM**),
- register the scheduled task,
- open a browser for you to **log into FACEIT** once,
- optionally do a first upload right away.

That's it — from then on it runs itself.

---

## Getting a FACEIT Data API key (free)

1. Go to **https://developers.faceit.com** and sign in with your FACEIT account.
2. Click **Create App** (name it anything, e.g. `Leetify uploader`).
3. Open the app, go to the **API Keys** panel, and **create a new key**.
   - Type: **Client** or **Server** is fine.
   - Scope: **Data API** (the default, free tier).
4. Copy the key value — it looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
   Paste it into the installer when asked.

> This is the **free Data API** key. It is *not* the "Downloads API" (that one
> needs a separate application and is currently paused for non-commercial use —
> this tool doesn't need it).

---

## Everyday use

You don't need to do anything. The only thing that ever recurs: if your saved
FACEIT login expires, a run will upload nothing and you'll get a **desktop
notification**. Fix it by logging in again:

```
node src\login.js
```

(or just re-run `install.cmd` and it'll walk you through it).

### Handy commands

Run from the project folder. If `node` isn't recognized, open a fresh terminal.

```
node src\index.js         # run an upload now (see live output)
node src\list-matches.js  # show what FACEIT sees (no uploads)
node src\login.js         # refresh your FACEIT login
```

Manage the schedule (PowerShell):

```powershell
# Change the daily time
Set-ScheduledTask -TaskName "FaceitLeetifyUploader" -Trigger (New-ScheduledTaskTrigger -Daily -At 7:00PM)

# Run it right now
Start-ScheduledTask -TaskName "FaceitLeetifyUploader"

# Turn off / on / remove
Disable-ScheduledTask   -TaskName "FaceitLeetifyUploader"
Enable-ScheduledTask    -TaskName "FaceitLeetifyUploader"
Unregister-ScheduledTask -TaskName "FaceitLeetifyUploader" -Confirm:$false
```

---

## Configuration (`.env`)

Created by the installer. Required:

```
FACEIT_NICKNAME=your_nickname
FACEIT_DATA_API_KEY=your_data_api_key
```

Optional overrides:

| Key              | Default  | Meaning                                             |
|------------------|----------|-----------------------------------------------------|
| `LOOKBACK_DAYS`  | `30`     | How far back to consider matches.                   |
| `HISTORY_LIMIT`  | `20`     | How many recent matches to scan per run.            |
| `MAX_PER_RUN`    | ∞        | Cap uploads per run.                                |
| `DELAY_MS`       | `4000`   | Pause between matches.                               |
| `BROWSER_CHANNEL`| `msedge` | `msedge`, `chrome`, or `chromium` (bundled).        |

---

## Notes & limits

- **30-day window:** FACEIT only serves demos for ~30 days. Older matches can't
  be uploaded by any tool.
- **Transient Leetify errors** (e.g. `504 Gateway Timeout`) are retried on later
  runs automatically (up to 6 attempts per match).
- Uses a **dedicated browser profile** (`.browser-profile/`), separate from your
  normal browsing — it never touches your everyday browser session.
- **Privacy:** your key and login stay on your machine. `.env`, the browser
  profile, logs, and match state are git-ignored and never leave your computer.

---

## Project layout

| Path              | What                                                    |
|-------------------|---------------------------------------------------------|
| `install.cmd`     | One-click installer.                                    |
| `run.cmd`         | What the scheduled task runs.                            |
| `src/index.js`    | Main job: detect → presign → upload.                    |
| `src/faceit.js`   | FACEIT Data API (find matches).                         |
| `src/faceit-demo.js` | Turnstile + `download-url` (get presigned link).     |
| `src/leetify.js`  | Submit to Leetify.                                      |
| `src/browser.js`  | Persistent logged-in browser, launched minimized.       |
| `src/login.js`    | One-time / occasional FACEIT login.                     |
| `src/state.js`    | Remembers uploaded/failed matches.                      |
| `src/notifier.js` | Desktop notification when attention is needed.          |

## License

MIT — see [LICENSE](LICENSE).
