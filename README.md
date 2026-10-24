# CourtCash NBA — independent player projection workspace

Live site: https://courtcash-nba.vercel.app

This is a separate Vercel project deployed from the feature/courtcash-nba branch of CageCash. Original MMA production is unaffected.

## Primary workflow (no sportsbook API needed)

1. Pick an NBA matchup from the ESPN schedule.
2. Open the **Projection engine** tab (default), search or select a player.
3. Select points, rebounds, assists, made threes, or points+rebounds+assists (PRA).
4. The **experimental independent model** estimates playing time and per-minute production, blending current and prior regular-season logs available *before that game's tipoff*.
5. Inspect the estimate, approximate 80% range, actual recent performances, sample sizes, and historical walk-forward mean absolute error where there are enough games.
6. Enter any prop line and optional book price yourself. The interface gives an approximate over/under probability and estimated break-even / model-assumed EV. These are *not validated betting edges*.
7. Override expected minutes manually to evaluate scenarios. Save your own initial lean separately from an actual wager in the tracker.

A key missing or props unavailable response only affects the optional **Book props** tab, **Game lines** tab, and market-price scanner. It never gates the projection engine.

## Independent model (lib/nba-projection.mjs)

- Reads valid regular-season ESPN logs strictly before the selected game.
- Requires at least 3 usable current-season games **or** 8 usable previous-season games, otherwise returns no estimate.
- Blends exponentially decayed per-minute rates across seasons; shrinks early current-season samples toward established prior data.
- Estimates playing time from recent minutes and prior-season minutes, with a user-adjustable minutes scenario.
- Provides an approximate distribution based on observed variance and explicit conservative variance floors. Reports sample-confidence grades, current/prior weighting, and a normal-approximation over/under calculation at a user-supplied line.
- Separately offers a small rolling historical error check, **not** external calibration, official tips or a wagering recommendation.
- Injury flags, if present in the ESPN roster feed, are shown as context only. **No** verified injury, confirmed lineup, usage, opponent defense, rest, schedule or pace adjustment is modeled.

NBA performance is noisy. The numbers are hypotheses to test, not guarantees. Do not treat model-implied EV as actual profitable value until an independent chronological test has established calibration and realistic performance.

## Optional sportsbook data

- `THE_ODDS_API_KEY` server-side Vercel environment variable enables supported provider markets. Never expose any provider key through `VITE_` env vars.
- Integration uses **the-odds-api.com** V4 (with hyphens), *not* the similarly named **theoddsapi.com** service.
- Player props depend on sportsbook markets, provider tier and matched event IDs, and may remain unavailable. Manual prop entry and projections still work without them.
- The price scanner shows cross-book no-vig comparisons, *not* the independent player model.

## Other capabilities

- NBA calendar, matchups, and scores (ESPN public scoreboard).
- Current/prior-season real player game logs and recent sample rates (ESPN public, unofficial feeds).
- Browser-local betting tracker separating your original lean from placed wagers and recording units, ROI and outcomes; clearing browser storage loses this record.
- Manual scenario lab separate from automated player projection.
- No ability to place real-money wagers.

## Local development

Node.js 22+:

    npm install
    npm test
    npm run build
    npm run dev

## Routes

- `GET /api/nba?date=YYYY-MM-DD` — ESPN scoreboard and optional odds.
- `GET /api/nba-roster?away=ESPN_TEAM_ID&home=ESPN_TEAM_ID` — roster and available ESPN injury statuses.
- `GET /api/nba-research?athlete=ESPN_ATHLETE_ID&cutoff=TIPOFF_ISO&game=ESPN_GAME_ID` — game logs with strict pregame cutoff.
- `GET /api/nba-props?event=ODDS_EVENT_ID` — optional bookmaker player prop feed.

The model is pure and independently unit tested in `tests/nba-projection.test.mjs`.
