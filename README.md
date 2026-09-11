# MANIK Admin Dashboard

A private React app for managing the MANIK site — separate from the public
site, with its own login. Talks to the `manik-backend` API.

## Setup

```bash
npm install
cp .env.example .env
```

In `.env`, set `VITE_API_URL` to wherever your backend is running:
- Local testing: `http://localhost:5000`
- Live: your deployed Render/Railway backend URL

```bash
npm run dev
```

## Before you can log in

The backend needs at least one admin account to exist first. From the
`manik-backend` project folder, run `npm run create-admin` (see that
project's README) — that's your own login for now.

## Adding the owner's login (presentation day)

Log in with your own account, go to **Admins** in the sidebar, click
**Add admin**, and either type in his details yourself or hand him the
screen to fill in his own email and password. No terminal needed.

## Pages

- **Overview** — quick stats: product count, quote requests, new/unread, projects
- **Products** — add/edit/delete products, manage categories, upload photos
- **Quote requests** — inbox of everything submitted through the public site's quote form, with status tracking (New/Contacted/Closed)
- **Projects** — manage the "completed work" gallery shown on the public site
- **Admins** — see who has dashboard access, add or remove logins

## Deploying

This is a static site once built (`npm run build` → `dist/`), so Vercel or
Netlify both work well — same as the public MANIK site. Just remember to
set `VITE_API_URL` as an environment variable in whichever host you use,
pointing at your live backend.

## Note on connecting to the public site

The public MANIK site currently shows hardcoded sample data. It isn't
wired to this backend yet — that's the next phase. Once that's done,
anything added here (products, projects) will show up live on the real
site automatically.
