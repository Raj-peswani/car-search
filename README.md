# SoCal Used-Car Deal Finder

Fork of [catesandrew/car-search](https://github.com/catesandrew/car-search), verified October 8, 2026. Next.js 16, React 19, SQLite/Drizzle. Favorites, notes, price history and source parsers are preserved.

## Run

Requires Node 22+ and pnpm 11+. From this directory:

```sh
pnpm install
pnpm db:push
pnpm db:migrate
pnpm dev
```

Open http://127.0.0.1:3000. Production: `pnpm build`, then `pnpm start`. App binds to loopback; keep it local (no multi-user authentication). Data is stored in `data/car-search.db`, ignored by Git. Back up existing databases before db:push. Migration seeds defaults only when configuration is empty.

## Search

Default center **Huntington Beach 92648**, **100-mile radius**, configurable in Settings. Advertised price **≤ $12,000**, **2014+**, hard mileage **≤ 120,000**, preferred **<100,000**. Selected models: Toyota Corolla/Camry/Yaris, Honda Civic/Accord/Fit, Hyundai Elantra/Sonata. Toggle models in Settings.

Reported salvage/rebuilt/lemon/flood/frame/structural damage is excluded. Clean title, one/two owners, personal use, no-accident reports and dealer ratings ≥4 improve the score. Unknown price/year/mileage/title/distance is marked for verification. Known disqualifiers are excluded; use the verified-only filter to hide missing data. “Verified” means supplied data meets filters, not an independent inspection. Distance requires distanceMiles and searchZip matching the configured center. Changing ZIP invalidates old distance claims. No guessed distances.

## Source status — October 8, 2026

| Source | Current status |
|---|---|
| Permitted JSON exports / manual research | **Working**, tested through Import page/API |
| auto.dev official API | Integrated; needs your free-account API key; live results unverified until connected |
| Cars.com | Standard Chrome check returned **0 listings**; unverified/unavailable |
| AutoTrader | Standard Chrome check returned **0 listings**; unverified/unavailable |
| KBB | Standard Chrome check returned **0 listings**; unverified/unavailable |
| Facebook Marketplace | Automation disabled/unsupported; permitted import only |
| CarGurus, Craigslist, eBay, auto.dev | No adapters |

**No live feed verified.** Zero results may mean access restrictions or changed markup, not absence of cars. Automated polling is off by default.

Original parsers are preserved in `vendor/car-deals-mcp`, from [catesandrew/car_deals_search_mcp](https://github.com/catesandrew/car_deals_search_mcp), upstream SiddarthaKoppaka. MIT license included. **Removed stealth plugins and browser security overrides.** No CAPTCHA bypass, proxies, disposable accounts or login automation. Facebook adapter is retained for reference but cannot be enabled by the app.

Optional future authorized source: copy .env.local.example to .env.local, set CAR_DEALS_MCP_PATH to the absolute path of **vendor/car-deals-mcp/src/server.js** (upstream's dist/index.js path is incorrect), and choose CAR_DEALS_SOURCES. Set PUPPETEER_EXECUTABLE_PATH to installed Chrome, or use `pnpm --filter car-deals-mcp exec puppeteer browsers install chrome`. Test Scan Now first. Start `pnpm worker` only after verifying access/permission; it uses the configured interval. Stop when restricted; no access bypasses.

## Connect live inventory

Open http://127.0.0.1:3000/sources. Create an auto.dev Free account, obtain your API key, and paste it in the local connection screen. The key is stored in the ignored .env.local file, never returned by the status API or committed. Alternatively set AUTO_DEV_API_KEY in .env.local. The app reads the saved key without a restart. Scan Now then calls the official v2 listings endpoint with your filters. API errors/quota limits are reported without retries. At most three 20-record pages per scan; additional inventory may require later scans. Automatic polling remains off. Source: https://docs.auto.dev/v2/reference/searchVehicleListings.

The provider's pricing page currently lists 1,000 free calls/month, capped, no card required: https://www.auto.dev/pricing. Check current terms and quotas before signup. Three calls per hourly scan can exceed that quota, so use manual scans. No paid plan is selected by this app.

Radius evidence from this adapter means the provider applied the requested ZIP/radius, not a fabricated exact distance. Changing ZIP or narrowing radius invalidates broader query evidence. Title and history remain unknown unless supplied; a CARFAX link alone is never treated as clean history. Dealer rating and title history are not inferred from undocumented API fields. Tests use fixtures; no real feed is claimed before an authenticated scan succeeds.

## Import

Open `/import`, paste an array. Required: source and at least one of id/vin/url. **Price is dollars**, stored internally in cents. Optional: year/make/model/mileage/location, titleStatus, description, ownerCount, dealerRating (0–5), oneOwner/noAccidents/personalUse, distanceMiles/searchZip, listedAt (ISO timestamp), mandatoryFeesCents, and boolean salvage/rebuilt/lemon/flood/frameDamage/structuralDamage. Omitted history stays unknown. Maximum 500 records / 2 MB. `examples/demo-listings.json` is clearly **fictional** test data, not inventory.

## Transparent score (0–10)

| Component | Points |
|---|---|
| Market | 0–4: clamp(2 + 8 × (median − price)/median); neutral 2 with fewer than 3 peers |
| Mileage | 0–2: clamp(2 × (120000 − mileage)/120000); unknown 1 |
| History | 0–2: clean .6; one owner .5 (two .25); personal use .4; no accidents .5; unknown gets no bonus |
| Dealer | 0–1: clamp((rating − 3)/2); unknown .5 |
| Age | 0–.5: clamp(.5 × (20 − age)/20); unknown .25 |
| Days on market | 0–.5: min(.5, days/120); unknown .25; uses actual source date |
| Fee/conditional-price risk | Subtract 1 when detected |

Components appear on cards/detail pages. Peers exclude self, use same make/base model, ±2 years, ±30k miles, seen within 30 days, matching ZIP and distance ≤150 miles, no detected damage/add-ons. Fictional and real peers never mix. Asking-price comparisons are not appraisals or sale prices; budget-limited feeds can bias medians. First-observed date is separate from actual days on market.

Mandatory fees/protection packages/reconditioning and conditional financing/down-payment prices are flagged. No invented OTD total: advertised prices exclude taxes/registration; request an itemized OTD quote. Detection is limited to supplied data/text. Verify title/history and get an independent inspection.

## Checks

`pnpm test` covers hard limits, missing evidence, damage negation, market exclusions, normalization and import validation. `pnpm build` checks production. Runtime checks performed: configuration round-trip, repeat imports without duplicates, damage exclusion, add-on flags, favorites, price history, comparables, radius and statistics. Upstream docs retain the original truck-search documentation; this README describes the fork. Upstream declares MIT.
