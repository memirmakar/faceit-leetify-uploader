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

### Easiest: download the installer (.exe)

1. Go to the **[Releases](https://github.com/memirmakar/faceit-leetify-uploader/releases/latest)**
   page and download **`FaceitLeetifyUploader-Setup.exe`**.
2. Double-click it. It downloads the tool and runs the setup below.

> The installer isn't code-signed, so Windows SmartScreen may show a warning the
> first time. Click **More info → Run anyway**. You can read exactly what it does
> in [`bootstrap.ps1`](bootstrap.ps1) and [`install.ps1`](install.ps1).

### Alternative: from source

1. **Download this repo** (green *Code* button → *Download ZIP*, then unzip;
   or `git clone`).
2. Double-click **`install.cmd`**.

Either way, the installer will:
- install Node.js if you don't have it,
- install dependencies and a browser,
- ask which **detection mode** you want (see below),
- ask what time to run daily (default **7:00 PM**),
- register the scheduled task,
- open a browser for you to **log into FACEIT** once,
- optionally do a first upload right away.

That's it — from then on it runs itself.

### Two ways to detect your matches

The installer asks you to pick one:

- **With a FACEIT API key** *(recommended)* — finds your matches via FACEIT's
  official Data API. Most reliable; the daily "what's new" check never depends on
  the browser. Needs a free key (2-minute signup, below).
- **No API key** — finds your matches through your logged-in browser session
  instead. One less thing to set up, but match detection then rides the same
  browser path as the upload, so it's a bit more sensitive to FACEIT changes.

Both modes upload demos the same way. You can switch later by editing
`DISCOVERY_MODE` in `.env` (`api` or `browser`).

---

## Getting a FACEIT Data API key (free)

*Only needed if you chose the **With a FACEIT API key** mode. In no-key mode you
can skip this entirely.*

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

## Saving demos locally (optional)

By default the tool never stores demos on your PC — it just hands Leetify a link
and Leetify downloads them server-side.

If you turn on local saving (the installer offers it, or set the vars below), each
demo is also:
- downloaded and **decompressed** to a playable `.dem` (FACEIT serves `.dem.zst`),
- named **`<date>-<map>-<win|loss>-<yourscore>-<oppscore>.dem`**
  (e.g. `2026-09-15-de_dust2-loss-8-13.dem` — your rounds first),
- saved to your CS2 folder so it shows up in-game,
- **auto-deleted after `DEMO_RETENTION_DAYS` days** (default 5).

Pruning only ever removes files this tool created (matching that naming pattern),
so your own recordings and other demos are never touched.

```
SAVE_DEMOS=true
DEMO_DIR=C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo
DEMO_RETENTION_DAYS=5
```

## Configuration (`.env`)

Created by the installer.

**API-key mode** (`DISCOVERY_MODE=api`, the default) needs:

```
FACEIT_NICKNAME=your_nickname
FACEIT_DATA_API_KEY=your_data_api_key
```

**No-key mode** needs only:

```
DISCOVERY_MODE=browser
```

Optional overrides:

| Key              | Default  | Meaning                                             |
|------------------|----------|-----------------------------------------------------|
| `DISCOVERY_MODE` | `api`    | `api` (key) or `browser` (logged-in session).       |
| `LOOKBACK_DAYS`  | `30`     | How far back to consider matches.                   |
| `HISTORY_LIMIT`  | `20`     | How many recent matches to scan per run.            |
| `MAX_PER_RUN`    | ∞        | Cap uploads per run.                                |
| `DELAY_MS`       | `4000`   | Pause between matches.                               |
| `BROWSER_CHANNEL`| `msedge` | `msedge`, `chrome`, or `chromium` (bundled).        |
| `SAVE_DEMOS`     | `false`  | Also save demos locally (see above).                |
| `DEMO_DIR`       | —        | Where to save demos (your CS2 `...\game\csgo`).     |
| `DEMO_RETENTION_DAYS` | `5` | Auto-delete saved demos after this many days.       |

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
| `src/faceit.js`   | FACEIT Data API (find matches, api mode).               |
| `src/faceit-browser.js` | Find matches via logged-in session (browser mode).|
| `src/faceit-demo.js` | Turnstile + `download-url` (get presigned link).     |
| `src/leetify.js`  | Submit to Leetify.                                      |
| `src/demos.js`    | Optional: save/decompress/name/prune local demo files.  |
| `src/browser.js`  | Persistent logged-in browser, launched minimized.       |
| `src/login.js`    | One-time / occasional FACEIT login.                     |
| `src/state.js`    | Remembers uploaded/failed matches.                      |
| `src/notifier.js` | Desktop notification when attention is needed.          |

## License

MIT — see [LICENSE](LICENSE).
