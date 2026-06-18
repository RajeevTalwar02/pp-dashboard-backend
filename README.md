# PP Dashboard — Live Data Backend

This folder is everything needed to make your dashboard pull fresh data
automatically, instead of having numbers typed into the HTML file.

## What's in here

```
pp-dashboard-backend/
├── api/
│   ├── refresh-data.js   <- runs on a schedule, scrapes sources, saves to Supabase
│   └── latest-data.js    <- the dashboard page calls this to read the latest data
├── vercel.json            <- tells Vercel to run refresh-data.js every 6 hours
├── package.json
└── README.md               <- this file
```

## One-time setup

### 1. Create the Supabase table (if you haven't already)

In your Supabase project → Table Editor → New table → name it
`dashboard_metrics` with these columns:

| Column        | Type        | Notes                          |
|---------------|-------------|----------------------------------|
| id            | int8        | primary key, auto-increment      |
| metric_key    | text        | UNIQUE constraint — add this!    |
| value         | text        | stores JSON as a string          |
| source_url    | text        |                                   |
| updated_at    | timestamptz | default `now()`                  |

Important: `metric_key` needs a **UNIQUE constraint** for the upsert in
refresh-data.js to work. In the Table Editor, click the column → add
constraint → Unique.

### 2. Push this folder to GitHub

```bash
cd pp-dashboard-backend
git init
git add .
git commit -m "Initial backend setup"
# create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/pp-dashboard-backend.git
git push -u origin main
```

### 3. Connect the repo to Vercel

1. Go to vercel.com → sign in → **Add New Project**
2. Import the GitHub repo you just pushed
3. Before deploying, go to **Environment Variables** and add:

| Key                  | Value                                      |
|-----------------------|--------------------------------------------|
| `FIRECRAWL_API_KEY`   | your key from firecrawl.dev (starts `fc-`) |
| `SUPABASE_URL`        | from Supabase → Settings → API             |
| `SUPABASE_ANON_KEY`   | from Supabase → Settings → API             |
| `CRON_SECRET`         | make up any random long string yourself    |

4. Click **Deploy**

Vercel will now automatically run `api/refresh-data.js` every 6 hours
(see the schedule in `vercel.json`), and `api/latest-data.js` will be
live at:

```
https://YOUR-PROJECT-NAME.vercel.app/api/latest-data
```

### 4. Test it manually before waiting for the cron

You can trigger a refresh manually to make sure it works, using the
CRON_SECRET you set:

```bash
curl -X POST https://YOUR-PROJECT-NAME.vercel.app/api/refresh-data \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Check the response — it should list each source as `"status": "ok"`.
If something says `"status": "error"`, the message will tell you why
(usually a bad selector on the source page, or a typo in env vars).

Then check:
```
https://YOUR-PROJECT-NAME.vercel.app/api/latest-data
```
You should see your scraped data as JSON.

### 5. Point your dashboard HTML at the live endpoint

In `PP_Dashboard.html`, add a small script that fetches from your new
endpoint and fills in the page. See `frontend-integration-example.js`
for exactly how to wire this into the existing charts and tiles.

### 6. Buy your domain and connect it

Once you're happy with the Vercel preview URL, go to Vercel project →
Settings → Domains → add your purchased domain → follow the DNS
instructions Vercel gives you (usually just one CNAME record at your
registrar).

## Adding more sources later

Open `api/refresh-data.js` and add another object to the `SOURCES`
array following the same shape — `key`, `url`, `prompt`, `schema`.
Each one costs roughly 1 (scrape) + 5 (JSON extraction) = ~6 Firecrawl
credits per run.

## Cost reminder

Free Firecrawl tier = 1,000 credits/month, no card needed. At ~6
credits per source per run, 2 sources, running every 6 hours (4x/day):
6 credits × 2 sources × 4 runs/day × 30 days ≈ 1,440 credits/month —
slightly over free tier. Either run every 8–12 hours instead of 6, or
move to the $16/month Hobby tier (5,000 credits) once you add more
sources.
