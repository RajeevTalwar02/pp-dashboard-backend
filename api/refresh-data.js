// api/refresh-data.js
//
// This is a Vercel Serverless Function. Vercel Cron calls this URL on a
// schedule (see vercel.json). It scrapes each source via Firecrawl,
// asks Firecrawl's JSON mode to pull out specific numbers, and writes
// the results into your Supabase table.
//
// Required environment variables (set these in the Vercel dashboard,
// NEVER commit them to a file):
//   FIRECRAWL_API_KEY   -> starts with fc-
//   SUPABASE_URL        -> https://xxxx.supabase.co
//   SUPABASE_ANON_KEY    -> your anon/publishable key
//   CRON_SECRET          -> a random string you make up, to stop randoms
//                            from triggering your scraper by guessing the URL

import { createClient } from '@supabase/supabase-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// 1. DEFINE YOUR SOURCES + WHAT TO EXTRACT FROM EACH
// ---------------------------------------------------------------------
// Each entry = one Firecrawl /v2/scrape call with a JSON-mode schema.
// Start small. Add more sources once this works end-to-end.

const SOURCES = [
   {
    key: 'siam_pv_total',
    // The statistics.aspx archive page can serve old cached tables.
    // The press-release page publishes one current "Monthly Performance"
    // announcement, which is far more reliable for "latest month" data.
    url: 'https://www.siam.in/press-release.aspx?mpgid=48&pgidtrail=50',
    prompt:
      'This page shows SIAM monthly press releases. Find the MOST RECENT "Monthly Performance" press release at the top of the page (the latest month announced, not an older one further down). From it, extract: the month and year being reported, and the total domestic Passenger Vehicle (PV) sales figure in units for that month. Ignore production figures and any prior-month releases below the latest one.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'The month name of the most recent release, e.g. "April"' },
        year: { type: 'string', description: 'The year of the most recent release, e.g. "2026"' },
        total_pv_units: { type: 'number', description: 'Total domestic PV sales units for that month' },
      },
      required: ['total_pv_units', 'month', 'year'],
    },
  },
  {
    key: 'autocar_latest_news',
    url: 'https://www.autocarindia.com/car-news',
    prompt:
      'List the 5 most recent automotive news headlines on this page, each with a one-sentence summary and the article URL if visible.',
    schema: {
      type: 'object',
      properties: {
        headlines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
      required: ['headlines'],
    },
  },
  // Add more sources here following the same shape, e.g. FADA, EVReporter.
];

// ---------------------------------------------------------------------
// 2. CALL FIRECRAWL FOR ONE SOURCE
// ---------------------------------------------------------------------
async function scrapeSource(source) {
  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: source.url,
      onlyMainContent: true,
      formats: [
        {
          type: 'json',
          prompt: source.prompt,
          schema: source.schema,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firecrawl error for ${source.key}: ${response.status} ${errText}`);
  }

  const result = await response.json();
  return result.data?.json ?? result.json ?? null;
}

// ---------------------------------------------------------------------
// 3. SAVE RESULT TO SUPABASE
// ---------------------------------------------------------------------
async function saveToSupabase(metricKey, value, sourceUrl) {
  const { error } = await supabase
    .from('dashboard_metrics')
    .upsert(
      {
        metric_key: metricKey,
        value: JSON.stringify(value),
        source_url: sourceUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'metric_key' }
    );

  if (error) {
    throw new Error(`Supabase write error for ${metricKey}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// 4. THE HANDLER VERCEL CALLS
// ---------------------------------------------------------------------
export default async function handler(req, res) {
  // Simple protection so only your own Cron job (or you, manually) can
  // trigger this — anyone else hitting the URL gets rejected.
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = [];

  for (const source of SOURCES) {
    try {
      const data = await scrapeSource(source);
      await saveToSupabase(source.key, data, source.url);
      results.push({ key: source.key, status: 'ok' });
    } catch (err) {
      console.error(err);
      results.push({ key: source.key, status: 'error', message: err.message });
      // Continue to the next source even if one fails.
    }
  }

  return res.status(200).json({
    ranAt: new Date().toISOString(),
    results,
  });
}
