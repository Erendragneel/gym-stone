# Gym Stone online profiles

Dedicated project: `skadxestusbzrmglsyei` · https://skadxestusbzrmglsyei.supabase.co

The migration `202610050001_gym_stone_profiles.sql` was applied successfully through the Supabase SQL editor on October 5, 2026. Treat it as applied and immutable. Before using a future CLI migration push, mark this exact version applied with `supabase migration repair 202610050001 --status applied`; do not run it again. The `gym-login` Edge Function was deployed from the included source, with legacy JWT verification retained. Its server environment supplies the service role and anon keys automatically. Never put the service role key into the static app.

Supabase Auth owns password hashing, sessions, confirmation and recovery. The browser stores session tokens, never a password. The public legacy anon key satisfies the function gateway. The function validates credentials with Supabase Auth, resolves usernames only on the server, returns generic failed-login messages, and limits username attempts to ten per minute. Profile table policies allow each authenticated player to read/update only their own profile. Anonymous visitors cannot read the table or call the private username resolver. Username creation is case-insensitively unique and happens in the Auth user creation transaction.

## Enabled account setup

Immediate signup is enabled, matching Language Miner's chosen flow. Email confirmation is off; an account email is linked but its ownership is not verified. No Brevo account or SMTP sender is configured. Email reminders and password recovery emails are unavailable, and the app does not offer sending them. Keep `emailDeliveryReady` and `remindersReady` false until a working sender and delivery flow are verified.

Auth return URLs are configured for `https://erendragneel.github.io/gym-stone/dist/` and `https://gym-stone-quest.elijio-villa.chatgpt.site/`. Password minimum is eight characters (updated October 6, 2026). `dist/cloud-config.js` contains only this project's public URL and legacy anon key, with no server secrets.

`verify-password-controls.cjs` verifies the seven/eight-character boundary against the live server and both visibility controls. `verify-live-cloud.cjs` passed against the actual project: immediate signup, server password minimum, case-insensitive username login/uniqueness, wrong-password rejection, own-profile updates, two-player isolation, calendar revision conflicts and two browser devices loading the same profile/day. It creates clearly named synthetic QA accounts with `example.invalid` email addresses; random passwords and sessions are never printed or written to disk. Synthetic QA accounts from these verification runs remain in the project. They contain test data only.

Profiles and goals sync online. Calendar entries sync online through per-day revision checks, with a durable IndexedDB outbox and explicit review when devices change the same day. Original watch screenshots and raw recognized text remain in the current device/browser, partitioned by player account. Existing anonymous device records remain in the original browser database; the profile offers an unchecked option to import them. Import copies screenshots locally and syncs reviewed activity details, while preserving the original history.

`verify-onboarding.cjs` validates the browser flow against a mock backend. It does not establish that SMTP or production signup is configured. Live anonymous probes verified that `gym-login` rejects invalid credentials and that anonymous callers cannot read profiles or invoke username resolution.

Live rollback-only SQL checks in `verify-profile-policies.sql` also passed: authenticated players see only their own row, can update their own profile, cannot update another player, cannot spoof their username through profile data, and invalid frequency, zero weight and future birthdays are rejected. Anonymous profile reads and username resolution are denied. Synthetic test users and edits were rolled back.

Migration `202610050002_workout_calendar.sql` is applied and immutable. Mark every applied version listed here before future CLI pushes. Live rollback-only checks in `verify-calendar-policies.sql` passed: own-day saves, revisions, stale-write rejection, duplicate rejection, direct-write denial, two-player isolation and anonymous read/write denial. `verify-calendar-sync.cjs` checks two browser devices, durable offline edits, both conflict choices and deletion against a mock backend.

Migration `202610050003_email_preferences.sql` is applied and immutable. Before future CLI migration pushes, mark all three versions (202610050001, 202610050002, 202610050003) as applied. Its preferences table and validated save RPC prepare optional reminder settings; they do not send emails. Live rollback-only assertions in `verify-email-preferences.sql` passed for own preferences, day normalization, invalid day/time/time-zone rejection, direct-write denial, two-player isolation and anonymous read/write denial. No delivery worker or reminder schedule is deployed.

