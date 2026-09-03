# Lifeline Connections NJ — Backend API

Express + PostgreSQL API serving `/api/resources` and `/api/weather/alerts`.
Weather data comes live from the National Weather Service (api.weather.gov);
zip-to-coordinates lookups use the free Zippopotam.us API.

## 1. Local setup

```bash
cd backend
cp .env.example .env      # then edit .env with your real DATABASE_URL
npm install
npm run migrate           # creates tables and seeds a few sample resources
npm run dev                # starts on http://localhost:3001
```

Requires **Node 18+** (uses the built-in `fetch`).

## 2. Get a free Postgres database

Any of these work well and have free tiers:

- **Supabase** — supabase.com, gives you a connection string immediately
- **Neon** — neon.tech, serverless Postgres, generous free tier
- **Railway** — railway.app, one-click Postgres + easy backend hosting in the same place

Copy the connection string into `DATABASE_URL` in your `.env`.

## 3. Add real resources

The migration seeds 3 sample resources so the API returns something on day
one. Add the rest either directly in SQL, or via:

```
POST /api/resources
Content-Type: application/json

{
  "organization_name": "...",
  "nims_category": "Emergency Housing",
  "nims_type": 1,
  "zip_code": "07302",
  "address": "...",
  "phone_number": "..."
}
```

This endpoint has no authentication yet — add an admin auth check
(API key or login) before making it publicly reachable in production.

## 4. Deploy

**Render** (recommended for simplicity):
1. Push this `backend/` folder to a GitHub repo
2. New Web Service on render.com, connect the repo, root directory `backend`
3. Build command: `npm install` — Start command: `npm start`
4. Add environment variables: `DATABASE_URL`, `ALLOWED_ORIGINS` (your frontend
   domain, e.g. `https://www.lifelineconnectionsnj.com`)
5. Once deployed you'll get a URL like `https://lifeline-api.onrender.com`,
   or attach a custom subdomain like `api.lifelineconnectionsnj.com`

**Railway** and **Fly.io** work the same way, roughly: connect repo, set env
vars, deploy.

## 5. Point the frontend at it

In the deployed frontend, set `window.LIFELINE_API_BASE_URL` to your
backend's URL (see `frontend/README.md`).

## Notes on the free APIs used

- **api.weather.gov** requires a descriptive `User-Agent` header (already
  set in `zipResolver.js` and `routes/weather.js`) — update the email in
  `NWS_USER_AGENT` to a real inbox you monitor, per NWS's usage policy.
- **api.zippopotam.us** needs no API key and has no published rate limit,
  but is a small community-run service — for higher reliability at scale,
  consider swapping in the Census Bureau Geocoder or a paid geocoding API.
- Weather alerts are cached in `weather_alerts` for 10 minutes per zip to
  avoid hammering NWS on every request (see `CACHE_TTL_MINUTES` in
  `routes/weather.js`).
