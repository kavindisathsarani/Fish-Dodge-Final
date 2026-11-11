# Fish Dodge: Count to Survive

CIS045-3 Distributed Service Architectures - Assignment 1.
A 2D underwater game (10 progressively challenging levels) with fish food collectibles and a Fish Count mini-game powered by the Fish Game API.
Plain HTML + CSS + JavaScript (ES modules). No build step, no framework.

## 1. Run it
ES modules require an HTTP origin rather than `file://`:
- **VS Code:** install "Live Server", right-click `index.html` > *Open with Live Server*, or
- **Terminal:** `npm start` (runs `npx serve . -l 5173`), then open http://localhost:5173

With empty Supabase settings the game runs in **local mode**: accounts and progress are saved in localStorage (passwords hashed with salted SHA-256).

## 2. Switch to Supabase
1. Supabase dashboard > **SQL Editor** > paste `supabase/schema.sql` > Run (creates the 3 base tables: `profiles`, `player_progress`, `game_runs` + RLS).
2. Run `supabase/leaderboard.sql` > Run (adds the `get_leaderboard()` function and permission to display usernames on the global board).
3. Run `supabase/delete_account.sql` > Run (adds the `delete_my_account()` function for player account deletion).
4. **Authentication > Providers > Email**: turn **OFF "Confirm email"** (players log in with a username, not email).
5. **Project Settings > API**: copy Project URL and publishable/anon key into `js/config.js`.

Usernames map to `username@fishdodge.app` internally for Supabase Auth.

## 3. Fish Game API
`js/api.js` connects to `https://marcconrad.com/uob/fish/api.php?out=json&base64=no`.
It receives an image URL and solution count. The raw response is printed in DevTools console (F12) as `[Fish API] raw response`.

## 4. Gameplay Rules & Features
- **10 Levels:** Each level is faster, with narrower gaps and denser rock walls. World speed rises 215 → 385 px/s, the fish's swim speed 330 → 465 px/s, the gap shrinks 118 → 64 px, columns grow from 7 → 25 and come closer together. Columns get thicker (2-3 rocks deep) in later levels, and from level 4 the gaps drift up and down. The generator guarantees every gap is reachable in time, so each level is always beatable.
- **Fish Food Collectibles:** Orange glowing pellets appear between obstacle walls (+50 points each). Collecting them triggers a particle burst effect.
- **Scoring System:**
  - Passing a rock column: +25 points
  - Collecting fish food: +50 points
  - Level completion: +250 points
  - Correct Fish Count mini-game answer: +50 points
- **Life System:** 3 lives per run. Rock collision triggers screen-shake, red flash, -1 life, and glides the fish back to the last cleared checkpoint (a short smooth rewind) with 1.6s invulnerability.
- **Fish Count Mini-Game:** At 0 lives, players solve a 60-second counting challenge from the Fish Game API. Correct answer restores all 3 lives and restarts the level from the beginning with a +50 bonus.
- **Global Leaderboard:** Ranks all registered players by highest achieved score, displaying ranks with medals (🥇🥈🥉), highlighting the current user, and showing total registered players.
- **Account & Security:** Password updates handled in a dedicated modal with show/hide password toggles and live validation. Account deletion requires explicit typing of "DELETE".
- **Viva Demo / Dev Mode:** Hold **Shift + D** on the Main Menu to toggle a developer level selector allowing direct jumps to any level (1–10).

## 5. Architecture & Four Core Criteria

| File | Primary Role | Assessment Criterion |
|---|---|---|
| `index.html` | Clean UI structure and screen sections | User Interface |
| `css/main.css`, `css/hud.css` | Underwater theme, glassmorphism, responsive layout | User Interface |
| `js/app.js` | Coordinates screen transitions, forms, and game events | Event-Driven Programming |
| `js/events.js` | Custom EventTarget event bus (`emit` / `on`) | Low Coupling / High Cohesion |
| `js/input.js` | Keyboard, on-screen buttons and press-and-drag steering (the fish follows your finger/mouse) | Event-Driven Programming |
| `js/art.js` | All artwork (fish, food, corals, kelp, rocks) drawn from code as SVG; used by the menus and baked into sprites for the game | High Cohesion |
| `js/rng.js` | Small seeded random generator so levels and art are deterministic | High Cohesion |
| `js/game.js` | Canvas game loop (sprite-based, hi-dpi, eased movement), collisions, particles | High Cohesion |
| `js/levels.js` | Deterministic level config, procedural obstacle & food generation | Low Coupling / High Cohesion |
| `js/scoring.js` | Centralized score rules and calculations | High Cohesion |
| `js/fish-count.js` | Mini-game logic, countdown timer, submission handling | Event-Driven Programming |
| `js/api.js` | External Fish Game API client | Interoperability |
| `js/supabase.js`, `js/config.js` | Supabase SDK initialization (loaded in the background with a time limit) and config | Interoperability |
| `js/auth.js` | Registration, login, password-checked session restore, password change, account deletion. The username cookie only pre-fills the login box; it never logs you in | Virtual Identity |
| `js/progress.js` | Progress synchronization, run histories, global leaderboard RPC | Virtual Identity |
| `js/ui.js` | HUD, menu statistics, leaderboard DOM rendering, live hints | High Cohesion |
| `js/validation.js` | Reusable username/password validation rules | High Cohesion |

### Key Viva Discussion Points:
1. **Low Coupling & High Cohesion:** `game.js` contains no DOM references or database calls; it interacts strictly with canvas and emits events through `events.js`. Data generation (`levels.js`) and score calculations (`scoring.js`) are pure modules.
2. **Event-Driven Programming:** Custom event bus decouples systems (e.g. `food-collected`, `life-lost`, `out-of-lives`, `level-complete`). UI and audio hooks react asynchronously without direct function coupling.
3. **Interoperability:** Integration with the external REST Fish Game API via asynchronous HTTP fetch with JSON parsing, alongside Supabase BaaS (PostgREST API and RPC calls).
4. **Virtual Identity:** User accounts, encrypted authentication, Row Level Security (RLS) policies ensuring players only modify their own records, and RPC-based public leaderboards without exposing privileged database keys.

## 6. Verification Checklist
- [x] Register new account with validation hints
- [x] Login with show/hide password toggle
- [x] Collect glowing fish food (+50 score + particles)
- [x] Rock collision screen-shake and life deduction
- [x] Out-of-lives triggers Fish Count mini-game
- [x] Correct count restores 3 lives and restarts level (+50 pts)
- [x] Global leaderboard displays ranks, medals, and highlights user
- [x] Password update modal functions with validation
- [x] Account deletion with "DELETE" confirmation
- [x] Shift + D dev shortcut for quick level demonstration

## v5 – reference-art look
- New backgrounds `assets/bg-login.jpg`, `bg-menu.jpg`, `bg-ocean.jpg` (+ tall `-m` versions for phones), cut from the reference images.
- New logo `assets/logo.webp` on sign-in, register and home.
- Frosted-glass cards, glossy pill buttons, glass frame around the game canvas. All game logic, ids and data-actions unchanged.

## Leaderboard fix (new players missing)
Run `supabase/fix_new_players.sql` once in the Supabase SQL editor (it adds a trigger that creates the profile and progress rows for every new account, repairs existing players, and makes the leaderboard resilient). Also turn off Authentication > Providers > Email > "Confirm email".
