# Gym Stone

A workout calendar inspired by Language Miner's Sunday-first activity calendar.

**Open the app:** https://erendragneel.github.io/gym-stone/

- Select a day to plan exercises or log already completed workouts.
- Check and uncheck completion; remove entries when needed.
- Enter minutes and an optional start time for completed exercises.
- Track current streak, total active days, XP, and day/week/month training hours.
- Browse and preview 149 exercises across 13 muscle group categories.
- Progress is stored locally in this browser, without cross-device synchronization.
- Import PNG/JPG/WebP workout screenshots from Garmin Connect, Apple Fitness, Samsung Health, or another app.
- English text recognition runs locally, then you review activity, date, start time, duration, distance and calories before saving.
- Add a new completed activity or update an existing planned/completed workout. Walking, hiking, treadmill sessions and other custom activities remain in your calendar after reload.
- Original screenshots are saved privately in this browser using IndexedDB, with a gallery and links from calendar entries. Identical screenshot files are detected to avoid duplicate records. Deleting a screenshot keeps its workout and training hours; deleting a workout keeps its screenshot in the gallery.

Screenshot import reads shared screenshots; the app does not connect directly to Garmin, Apple, Samsung accounts or watches. Screenshots and recognition text never upload to GitHub, Sites, or a remote OCR service. Recognition assets are bundled with the app. English OCR can miss labels or misread values; all fields are editable before confirmation. Storage is device-local; clearing browser data removes records and screenshots. Use the same app URL and browser to access saved history.

The daily chart groups workout durations by their recorded start hour; workouts without a start time have a separate bucket. Weekly and monthly charts show hours per calendar day. The week begins Sunday. Unentered durations count as zero and are flagged for entry. Future days support planning, with completion available on today and past dates.

The library combines supplied anime GIFs with simplified articulated illustrations. The incomplete Incline Dumbbell Curl file was replaced with an illustrated loop; damaged ending frames in Rope Hammer Cable Curl and Horizontal Cable Rotation were recovered from their valid frames. Lateral Band Walk's empty source file was replaced. Duplicate exercise names are merged with muscle-group memberships retained. This is a curated library, not every possible exercise or variation.

## Validation

All 149 GIFs in the separate downloadable library were decoded frame by frame and checked for multiple distinct frames and infinite looping. `gif-audit.json` records results. The app serves smaller animated WebP copies to reduce loading time; the GIF ZIP preserves the GIF versions. Browser checks cover planning, completion, duration totals, day/week/month charts, persistence, animation preview, and mobile overflow.

Optional WebMCP tools feature-detect browser support. A supported WebMCP context was unavailable for tool execution validation. The standard interface was tested directly.

## Local use

Serve `dist` with a local HTTP server and open its address. For example: `python -m http.server 5173 --directory dist`. Opening the HTML directly as a file does not support loading the exercise catalog.
