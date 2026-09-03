# Lifeline Connections NJ — Frontend (PWA)

A static, installable Progressive Web App. No build step required — plain
HTML/CSS/JS, so it deploys as-is.

## 1. Point it at your backend

Before deploying, tell the frontend where the API lives. Easiest way: add
one line right before `<script src="app.js">` in `index.html`:

```html
<script>window.LIFELINE_API_BASE_URL = 'https://api.lifelineconnectionsnj.com';</script>
<script src="app.js"></script>
```

(Use `http://localhost:3001` while developing locally against the backend.)

## 2. Local preview

Any static file server works, e.g.:

```bash
cd frontend
npx serve .
```

Service workers require HTTPS or `localhost`, so `npx serve` (localhost) is
fine for testing the offline behavior.

## 3. Deploy

**Vercel** or **Netlify** (recommended, both have generous free tiers):

1. Push this `frontend/` folder to a GitHub repo (can be the same repo as
   the backend, in a subfolder)
2. New Project on vercel.com or Netlify, point it at the repo, set the root
   directory to `frontend`
3. No build command needed — it's static. Output directory: `frontend` (or
   leave default if root is already set to `frontend`)
4. Deploy. You'll get a URL like `lifeline-connections-nj.vercel.app`

## 4. Connect your domain

In your domain registrar (wherever `lifelineconnectionsnj.com` is
registered):

1. In Vercel/Netlify, go to your project's Domain settings and add
   `www.lifelineconnectionsnj.com`
2. They'll give you a CNAME record (something like
   `cname.vercel-dns.com`) — add that in your registrar's DNS settings
   under the `www` subdomain
3. If you also want the bare `lifelineconnectionsnj.com` (no `www`) to
   work, Vercel/Netlify will give you an A record to add too, or you can
   redirect the bare domain to `www`
4. DNS changes can take a few minutes to a few hours to propagate. Both
   platforms issue free SSL certificates automatically once the domain
   verifies.

## 5. Test the PWA install

Once live on HTTPS:
- **Android/Chrome**: visit the site, you should see an install prompt (or
  the "Install app" button in the top bar we wired up)
- **iOS/Safari**: Share button → "Add to Home Screen" (Safari doesn't
  support the automatic install prompt, but "Add to Home Screen" gives
  the same result)

## Notes

- `service-worker.js` caches the app shell on first visit and the last
  successful API response after that, so the app keeps working with no
  connection.
- Icons in `icons/` were generated from the provided logo. Regenerate them
  if the logo changes (192×192, 512×512, 512×512 maskable, 180×180 for
  iOS).
