# CageCash

Mobile-first MMA betting intelligence.

## Live data
CageCash now includes a Vercel serverless endpoint at `api/mma.js` that requests live/upcoming MMA odds from SportsGameOdds. The browser never receives the provider API key.

## Vercel setup
Add this Environment Variable to the CageCash project:

`SPORTSGAMEODDS_API_KEY`

Set its value to your SportsGameOdds API key, enable it for Production (and Preview/Development if desired), then redeploy.

## Current live capabilities
- Automatic MMA event ingestion
- Sportsbook-specific prices
- Best-price detection
- Consensus no-vig fair odds
- Expected value and price-edge calculations
- Value Scanner
- Fight market pages

## Model distinction
The live pricing layer is real. Provider fair odds are consensus no-vig market estimates, not independent CageCash fighter predictions. The independent fighter model should be connected only after a reliable historical fighter/performance data source is available and can be validated out-of-sample.
