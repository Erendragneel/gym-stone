# Gym Stone

A workout calendar inspired by Language Miner's Sunday-first activity calendar.

Every exercise preview includes front and back muscle-group maps. Dark red marks primary muscles; light red marks assisting muscles and stabilizers. Written muscle lists provide the same information without relying on color. Stretches label their main and supporting stretch targets. Maps work with both exercise characters and offline, and scale from phones to desktop. Mapping references are available in each preview. `verify-muscle-maps.cjs` validates coverage, color roles, preview switching, mobile layout, planning/logging, profile switching, persistence and offline loading.

**Open the app:** https://erendragneel.github.io/gym-stone/

Download the [male GIF library](https://github.com/Erendragneel/gym-stone/releases/download/v1.1.0/Gym_Stone_Anime_Exercise_GIF_Library_v1.1.zip) or [female GIF library](https://github.com/Erendragneel/gym-stone/releases/download/v1.2.0/Gym_Stone_Female_Anime_Exercise_GIF_Library_v1.2.zip). Each contains 149 exercises.

- Select a day to plan exercises or log already completed workouts.
- Check and uncheck completion; remove entries when needed.
- Enter minutes and an optional start time for completed exercises.
- Track current streak, total active days, XP, and day/week/month training hours.
- Browse and preview 149 exercises across 13 muscle group categories.
- Share Game shows the public game link and an offline-generated QR code, with copy, device sharing, and PNG download. Shared links contain no workout or screenshot data.
- Download App installs Gym Stone as a browser app on supported browsers, with iPhone/iPad, Android, and desktop instructions when automatic installation is unavailable. Installed apps use the new Gym Stone logo.
- A service worker keeps the calendar available offline after an online visit; exercise animations and OCR files are cached when loaded. Offline caches and original screenshots remain local to the same browser and app origin.
- Create a Supabase account with a username, email and password. Profiles, goals and reviewed workout details sync across devices; offline calendar edits are saved on the device and sent after reconnection. Conflicting edits on the same day are shown for review.
- One editing tab per player is allowed in the same browser. A second tab asks you to close the first and retry, preventing stale offline tabs from overwriting the shared workout history or sync queue. Separate devices can sync normally.
- Set your birthday (age is calculated), gender, current/optional goal weight, training goal and 1–7 workout days per week. Optional sliders set both minutes per workout and hours per week.
- Choose Male or Female in your profile to display the matching anime exercise examples.
- Signup is immediate; account email addresses are linked but unverified. Email reminders and password recovery emails are unavailable because no email sender is connected.
- Gym Stone has its own installed-app identity (`/gym-stone/`), distinct from Language Miner's existing identity on the same GitHub Pages domain. Its launch URL and offline scope stay inside `gym-stone/dist/`, and changing the app ID does not change the saved-data location. If an older Language Miner shortcut opens Gym Stone, revisit `https://erendragneel.github.io/language-miner/` in the browser that installed it, then install Gym Stone separately from its official URL. Keep browser site data when repairing an old installation so both games retain their progress.
- Import PNG/JPG/WebP workout screenshots from Garmin Connect, Apple Fitness, Samsung Health, or another app.
- English text recognition runs locally, then you review activity, date, start time, duration, distance and calories before saving.
- Add a new completed activity or update an existing planned/completed workout. Walking, hiking, treadmill sessions and other custom activities remain in your calendar after reload.
- Original screenshots are saved privately in this browser using IndexedDB, with a gallery and links from calendar entries. Identical screenshot files are detected to avoid duplicate records. Deleting a screenshot keeps its workout and training hours; deleting a workout keeps its screenshot in the gallery.

Screenshot import reads shared screenshots; the app does not connect directly to Garmin, Apple, Samsung accounts or watches. Screenshots and recognition text never upload to GitHub, Sites, or a remote OCR service. Recognition assets are bundled with the app. English OCR can miss labels or misread values; all fields are editable before confirmation. Original screenshots are device-local; clearing browser data removes those photos and any unsynced edits. Reviewed activity details sync to your signed-in account. Existing device-only history can be copied into an account using the unchecked import option in the profile; this preserves the original history.

The daily chart groups workout durations by their recorded start hour; workouts without a start time have a separate bucket. Weekly and monthly charts show hours per calendar day. The week begins Sunday. Unentered durations count as zero and are flagged for entry. Future days support planning, with completion available on today and past dates.

The library preserves 122 supplied anime animations and adds 27 detailed anime keyframe loops matching the original character art: muscular anatomy, black spiky hair, red top, dark shorts, red shoes, and gray studio framing. The simplified diagram loops have been replaced. New loops follow the original reference chat's 5.2-second cycles, 0.8-second endpoint pauses, and form captions. Six generated motion keyframes are assembled with gentle transitions; these are instructional illustrations rather than recorded or motion-captured demonstrations. Selected source sheets and exact built-in generation prompts are in `animation-source`.

Every catalog exercise also has an adult female athlete counterpart: dark ponytail, medium tan skin, red tank, charcoal shorts and red shoes in the same gray studio. All 149 female GIF/WebP pairs use the original male movement as a reference. Their selected artwork, prompts and motion corrections are retained under `animation-source/female`. These are illustrated keyframe loops with transitions.

The incomplete Incline Dumbbell Curl and empty Lateral Band Walk source files have new anime replacements. Damaged ending frames in Rope Hammer Cable Curl and Horizontal Cable Rotation were recovered from their valid frames. Duplicate exercise names are merged with muscle-group memberships retained. Exercise IDs are unchanged so saved workout history keeps its links. This is a curated library, not every possible exercise or variation.

## Validation

All 149 GIFs in the separate downloadable library were decoded frame by frame and checked for multiple distinct frames and infinite looping. `gif-audit.json` records results. The 27 refreshed GIFs also have verified 5.2-second timing. The app serves smaller animated WebP copies to reduce loading time; the GIF ZIP preserves the GIF versions. The female library is decoded frame by frame with verified 5.2-second infinite loops; `female-animation-audit.json` records all 149 GIF/WebP pairs and their hashes. Browser checks cover onboarding, gender selection, goal sliders, planning, completion, duration totals, day/week/month charts, persistence, animation preview, screenshot import, sharing, installation and mobile overflow. Real Supabase checks verify signup/sign-in, private profile/calendar ownership, revisions and two-device syncing. Mock checks exercise offline outbox recovery and both conflict choices. `verify-tab-storage.cjs` checks native browser locks, safe takeover of offline history/outbox, separate-player leases and profile responses arriving after a save. See `supabase/README.md` for applied migrations and account setup.

Optional WebMCP tools feature-detect browser support. A supported WebMCP context was unavailable for tool execution validation. The standard interface was tested directly.

## Local use

Serve `dist` with a local HTTP server and open its address. For example: `python -m http.server 5173 --directory dist`. Opening the HTML directly as a file does not support loading the exercise catalog. For a device-only development preview, temporarily use empty URL/key values in `dist/cloud-config.js`; restore the public production config before publishing. Online username sign-in is configured for the published app origins.
