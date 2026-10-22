# Lifeline Connections NJ, Inc.

A public safety and community resilience platform for New Jersey: zip-code
resource lookup (crisis, housing, mental health) plus live weather alerts,
built as an offline-resilient Progressive Web App.

```
lifeline-connections-nj/
├── backend/     Express + Postgres API (resources, weather alerts)
└── frontend/    Static PWA (installable, works offline)
```

## Fastest path to a live site on www.lifelineconnectionsnj.com

1. **Database**: create a free Postgres instance (Supabase, Neon, or
   Railway). Run `npm run migrate` from `backend/` to create the schema
   and seed 3 sample resources. → see `backend/README.md`

2. **Backend**: deploy the `backend/` folder to Render, Railway, or
   Fly.io. Set `DATABASE_URL` and `ALLOWED_ORIGINS` env vars. You'll get
   a URL like `https://lifeline-api.onrender.com`. → see `backend/README.md`

3. **Frontend**: set `window.LIFELINE_API_BASE_URL` in `index.html` to
   your backend's URL, then deploy the `frontend/` folder to Vercel or
   Netlify (no build step, it's static). → see `frontend/README.md`

4. **Domain**: in Vercel/Netlify's domain settings, add
   `www.lifelineconnectionsnj.com`, then add the CNAME record they give
   you in your domain registrar's DNS settings. SSL is automatic.

5. **Add real resources**: the seed data is just 3 sample entries. Use the
   `POST /api/resources` endpoint (or direct SQL) to load your actual
   verified resource list before sharing the site publicly.

Total cost to get this live: **$0/month** on free tiers, until traffic or
data volume outgrows them.

## What's real vs. what to still add

**Already wired to real data:**
- Live weather alerts from the National Weather Service, by zip code
- Zip → coordinates via a free geocoding API
- Postgres-backed resource search, filterable by NIMS category/type
- Offline caching (service worker + localStorage) so crisis numbers and
  the last search stay available with no connection
- Installable as a home-screen app on iOS/Android (PWA)

**Still needs your input before public launch:**
- Real, verified NJ resource data (only 3 sample entries are seeded)
- Basic auth on `POST /api/resources` before it's publicly reachable
- A privacy policy / terms page if you're collecting any donor or contact
  information
