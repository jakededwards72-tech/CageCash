# CourtCash — NBA intelligence (feature branch)

This is an NBA-only adaptation of CageCash. The MMA production branch is not changed unless this branch is merged. For a separate NBA site, deploy this branch as a separate Vercel project rather than replacing CageCash's existing production deployment.

## What works now

- NBA game schedules and final/live scores for selected Eastern dates, from ESPN's publicly accessible scoreboard endpoint.
- Server-side current NBA sportsbook lines (moneyline, spreads, totals) using The Odds API v4.
- A detail screen comparing matching sportsbook lines and on-demand per-game NBA player props (points, rebounds, assists, threes and PRA) where included in the provider plan.
- Market-only no-vig calculations using median probabilities from other sportsbooks. We do not calculate an edge using the evaluated sportsbook as its own benchmark.
- Date-based slate navigation, searchable price scanner, sportsbook comparisons.
- Local pick tracker distinguishing original leans from actual wagers, with manual settling and unit-based ROI.
- Manual normal-distribution projection calculator. Assumptions are user-provided, not an automatically trained player model.

## Required configuration

1. Import the feature/courtcash-nba branch into a new Vercel project (or create a new GitHub repository from it). The original CageCash MMA production remains untouched.
2. Set THE_ODDS_API_KEY in Vercel Environment Variables server side and redeploy. Never put API keys in VITE_ browser variables.
3. The provider is The Odds API at the-odds-api.com, consistent with the existing MMA backend, not the separately branded theoddsapi.com.
4. Moneyline, spread, total, and player prop coverage depends on plan and book coverage. Free plans may offer moneyline only. If needed, request h2h only in api/nba.js. Props may be unavailable under a free plan.
5. Public Vercel access is determined by Deployment Protection. Preview links may require account authentication.

## Important limitations

The app does not automatically announce NBA best bets. A cross-book price discrepancy is NOT an independently validated predictive edge. No live injury model, starting lineup data, minutes or usage projections, or trained/calibrated player prediction pipeline exists in this release. Those need reliable data and chronological backtests.

## Local development

Node.js 20+:

    npm install
    npm run dev
    npm test
    npm run build

## Endpoints

- GET /api/nba?date=YYYY-MM-DD — schedule and matching active sportsbook lines; gracefully degrades without a key.
- GET /api/nba-props?event=ODDS_EVENT_ID — per-game player lines; requires an eligible key.
- Keys are never sent to the browser. No real-money bets can be placed here.
- Browser picks use localStorage. No cross-device sync and clearing browser data loses the log.

## Data accuracy

- Dates shown in Eastern time.
- Games matched to odds by normalized home and away names; ESPN and sportsbook IDs are never interchangeable.
- Market EV requires at least two independent peer books quoting the identical point line and both sides.
- ESPN APIs used are public but unofficial and subject to change.
