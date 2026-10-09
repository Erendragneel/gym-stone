# Gym Stone

A workout calendar inspired by Language Miner's Sunday-first activity calendar.

Every exercise preview includes front and back muscle-group maps. Dark red marks primary muscles; light red marks assisting muscles and stabilizers. Written muscle lists provide the same information without relying on color. Stretches label their main and supporting stretch targets. Maps work with both exercise characters and offline, and scale from phones to desktop. Mapping references are available in each preview. `verify-muscle-maps.cjs` validates coverage, color roles, preview switching, mobile layout, planning/logging, profile switching, persistence and offline loading.

**Open the app:** https://erendragneel.github.io/gym-stone/

Download the [250 new exercises / 500 male and female GIFs](https://github.com/Erendragneel/gym-stone/releases/tag/v1.6.0), [reframed original GIF libraries](https://github.com/Erendragneel/gym-stone/releases/tag/v1.3.0), [warm-up and cooldown GIFs](https://github.com/Erendragneel/gym-stone/releases/tag/v1.4.0), or [pregnancy GIFs](https://github.com/Erendragneel/gym-stone/releases/tag/v1.5.0).

- Select a day to plan exercises or log already completed workouts.
- Check and uncheck completion; remove entries when needed.
- Enter sets and reps for strength, or minutes for cardio, holds and timed activity. Weight-capable exercises also have an optional decimal weight and a kilograms/pounds dropdown, including timed carries and holds. Each entry saves its amount and unit; workout and sync conflict summaries display them. Bodyweight strength moves support added weight; assisted machines label assistance separately. Tracking can be changed per entry. New exercise quantities start blank; an optional start time supports the daily chart.
- Track current streak, total active days, XP, and day/week/month training hours. Progress compares each exercise’s latest result with its first log, previous session and personal best. Weight also shows the last different load. Log optional distance in km, mi or m to compare distances and average speed/pace; rep totals and timed holds have histories too. Completed workouts that beat an earlier best earn one +50 XP bonus, with a badge and a celebration. First logs set baselines; tied records earn no bonus. Rewards recalculate from saved history when entries are edited, deleted or synced, without duplicate awards.
- Open Nutrition to log breakfast, lunch, dinner and snacks for any selected day. Enter calories and optional protein, carbs and fat for the portion eaten; unknown macros stay blank and totals are marked as incomplete. Edit or delete foods, undo the last deletion, and track water in mL with undo for the last drink.
- Set optional daily calorie, macro and water goals. Nutrition uses the same selected date as the workout calendar, while its totals stay separate from training. Diaries and goals are saved offline on this device, separately for each player; they do not sync across devices. Clearing browser data removes the nutrition diary.
- Browse and preview 425 exercises across muscle groups, cardio and mobility. Combine name search with equipment and difficulty filters. The 250 new moves include form cues and male/female illustrated examples.
- Dedicated Warm-up and Cooldown sections contain 12 exercises with animations and timing guidance for before/after training.
- A dedicated Pregnancy section contains 14 modified cardio, strength and mobility examples, with adjustments, primary guidance links, clinician tailoring and stop signs. Pregnancy animation identity stays fixed when the general profile gender changes.
- The Pregnancy tab, category and exercises are available only when the saved player profile is Female. Changing to Male exits the Pregnancy category and closes its preview; previously saved workouts remain in the calendar.
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

The 425-move catalog combines the original 149 exercises, 12 warm-up/cooldown moves, 14 pregnancy moves and 250 new exercises. General demonstrations use matching adult male and female anime athletes: tan skin, red tanks, charcoal shorts and red shoes, with short spiky hair or a high ponytail. Pregnancy examples use a separate fixed prenatal character.

The 250 new exercises use paired pose sheets created with built-in ImageGen, reviewed for the named movement, complete people and equipment, stable supports and cable/load connections. Each sheet contains three male poses above three female poses. Whole source cells are retained and surrounded by a 40-pixel margin; GIFs use opaque discrete poses without blended motion ghosts. Illustrated playback demonstrates the movement and does not prescribe sets, reps or session time. All 32 final contact pages passed visual framing and caption checks; results are retained in `animation-source/expansion-v16/visual-verification.json`.

Final native artwork, exact prompts and per-sheet review choices are retained in `animation-source/expansion-v16/sheets`; the complete exercise specifications are in `animation-source/expansion-v16/jobs.json`. To reproduce the assets from these saved sources, run `build-expanded-library.py --from-sources` with Pillow and NumPy. The generator preserves all 175 pre-expansion catalog entries exactly, keeping saved exercise IDs and workout links intact.

## Validation

`verify-nutrition.cjs` checks food creation, editing and deletion, optional macros, daily totals and goals, water tracking, calendar date selection, player isolation, storage-failure recovery, persistence, mobile layout and offline loading.

The app serves smaller animated WebPs; downloadable packs preserve GIF versions. `audit-expanded-library.py` independently decodes all 500 new GIFs and 500 new WebPs, checks dimensions, opaque frames, distinct poses, infinite loops and exact timing, verifies ZIP hashes, and confirms all previous catalog entries remain unchanged. `animation-source/expansion-v16/decoded-audit.json` retains its results.

`verify-expanded-library.cjs` checks all 425 moves, combined search/equipment/level filters, isolation of the guided sections, blank strength/timed quantities, totals, gender switching, all 500 WebPs from the server, persistence and 360-pixel scrolling/preview layout. Existing checks cover sets/reps, stretches, pregnancy guidance, onboarding, planning, charts, screenshot import, sharing, installation and mobile overflow. Real Supabase checks previously verified signup/sign-in, private profile/calendar ownership, revisions and two-device syncing. Mock checks cover calendar synchronization, offline recovery and conflict choices. See `supabase/README.md` for applied migrations and account setup.

Optional WebMCP tools feature-detect browser support. A supported WebMCP context was unavailable for tool execution validation. The standard interface was tested directly.

## Local use

Serve `dist` with a local HTTP server and open its address. For example: `python -m http.server 5173 --directory dist`. Opening the HTML directly as a file does not support loading the exercise catalog. For a device-only development preview, temporarily use empty URL/key values in `dist/cloud-config.js`; restore the public production config before publishing. Online username sign-in is configured for the published app origins.
