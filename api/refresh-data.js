import { createClient } from '@supabase/supabase-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------
// STATIC SOURCES — URL never changes, always shows latest content
// ---------------------------------------------------------------------
const STATIC_SOURCES = [
  {
    key: 'siam_pv_total',
    url: 'https://www.siam.in/press-release.aspx?mpgid=48&pgidtrail=50',
    prompt: 'This page shows SIAM monthly press releases. Find the MOST RECENT "Monthly Performance" press release at the top of the page. Extract the month, year, and total domestic Passenger Vehicle (PV) sales figure in units for that month only.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'string' },
        total_pv_units: { type: 'number' },
      },
      required: ['total_pv_units', 'month', 'year'],
    },
  },
  {
    key: 'autocar_latest_news',
    url: 'https://www.autocarindia.com/car-news',
    prompt: 'List the 5 most recent automotive news headlines on this page, each with a one-sentence summary and the article URL.',
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
  {
    key: 'ev_market_news',
    url: 'https://evreporter.com/category/market/',
    prompt: 'List the 3 most recent EV market news headlines on this page relevant to India, each with a one-sentence summary and article URL.',
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
];

// ---------------------------------------------------------------------
// STEP 1 — Find the latest FADA article URL automatically
// Searches autoguideindia.com so we never need to hardcode URLs again
// ---------------------------------------------------------------------
async function findLatestFadaArticleUrl() {
  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: 'https://www.autoguideindia.com/?s=FADA+vehicle+retail',
      onlyMainContent: true,
      formats: [
        {
          type: 'json',
          prompt: 'Find the URL of the most recent article about FADA monthly vehicle retail data (the one with the highest/most recent month and year). Return just that single article URL.',
          schema: {
            type: 'object',
            properties: {
              latest_article_url: { type: 'string', description: 'Full URL of the most recent FADA monthly retail article' },
              month: { type: 'string' },
              year: { type: 'string' },
            },
            required: ['latest_article_url'],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not find latest FADA article: ${response.status}`);
  }

  const result = await response.json();
  const data = result.data?.json ?? result.json ?? null;
  return data?.latest_article_url ?? null;
}

// ---------------------------------------------------------------------
// STEP 2 — Scrape the actual FADA article for all data in one call
// ---------------------------------------------------------------------
async function scrapeFadaRetail(articleUrl) {
  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: articleUrl,
      onlyMainContent: true,
      formats: [
        {
          type: 'json',
          prompt: 'This page reports FADA monthly vehicle retail data. Extract the month and year, total PV retail units, PV YoY growth percentage, 2W retail units, 2W YoY growth percentage, CV retail units, CV YoY growth percentage, total all-vehicle retail units, PV EV share percentage, PV CNG share percentage, 2W EV share percentage, and overall alternative fuel share percentage.',
          schema: {
            type: 'object',
            properties: {
              month: { type: 'string' },
              year: { type: 'string' },
              pv_units: { type: 'number' },
              pv_yoy_pct: { type: 'number' },
              tw_units: { type: 'number' },
              tw_yoy_pct: { type: 'number' },
              cv_units: { type: 'number' },
              cv_yoy_pct: { type: 'number' },
              total_units: { type: 'number' },
              pv_ev_share_pct: { type: 'number' },
              pv_cng_share_pct: { type: 'number' },
              tw_ev_share_pct: { type: 'number' },
              alt_fuel_share_pct: { type: 'number' },
            },
            required: ['pv_units', 'month', 'year'],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Could not scrape FADA article ${articleUrl}: ${response.status}`);
  }

  const result = await response.json();
  return result.data?.json ?? result.json ?? null;
}

// ---------------------------------------------------------------------
// CORE FUNCTIONS
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
// HANDLER
// ---------------------------------------------------------------------
export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = [];

  // 1. Static sources
  for (const source of STATIC_SOURCES) {
    try {
      const data = await scrapeSource(source);
      await saveToSupabase(source.key, data, source.url);
      results.push({ key: source.key, status: 'ok' });
    } catch (err) {
      console.error(err);
      results.push({ key: source.key, status: 'error', message: err.message });
    }
  }

  // 2. Dynamic FADA — auto-finds latest article then scrapes it
  try {
    const latestUrl = await findLatestFadaArticleUrl();
    if (!latestUrl) throw new Error('Could not find latest FADA article URL');

    const fadaData = await scrapeFadaRetail(latestUrl);

    await saveToSupabase('fada_pv_retail', fadaData, latestUrl);
    await saveToSupabase('fada_powertrain_mix', {
      month: fadaData.month,
      year: fadaData.year,
      pv_ev_share_pct: fadaData.pv_ev_share_pct,
      pv_cng_share_pct: fadaData.pv_cng_share_pct,
      tw_ev_share_pct: fadaData.tw_ev_share_pct,
      alt_fuel_share_pct: fadaData.alt_fuel_share_pct,
    }, latestUrl);

    results.push({ key: 'fada_pv_retail', status: 'ok', source: latestUrl });
    results.push({ key: 'fada_powertrain_mix', status: 'ok', source: latestUrl });
  } catch (err) {
    console.error(err);
    results.push({ key: 'fada_dynamic', status: 'error', message: err.message });
  }

  return res.status(200).json({
    ranAt: new Date().toISOString(),
    results,
  });
}