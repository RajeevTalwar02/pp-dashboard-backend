import { createClient } from '@supabase/supabase-js';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================================
// MONTHLY URL UPDATE SECTION — update these ~8th of each month
// =====================================================================
const FADA_URL = 'https://www.autoguideindia.com/reports/auto-retail-growth-may-2026-fada-pv-sales-surge/';
const JATO_BODY_URL = 'https://m.dailyhunt.in/news/india/english/ht+auto-epaper-htateng/over+half+of+indias+397000+passenger+vehicle+sales+in+may+2026+were+suvs-newsid-n715517259';
const JATO_TREND_URL = 'https://www.jato.com/resources/media-and-press-releases/indias-passenger-vehicle-market-records-3.96-lakh-units-in-may-2026-up-21.6-yoy';
const AUTOPUNDITZ_URL = 'https://www.autopunditz.com/post/auto-punditz-monthly-auto-brief-may-2026-edition';
// =====================================================================

const SOURCES = [
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
  {
    key: 'fada_pv_retail',
    url: FADA_URL,
    prompt: 'This page reports FADA monthly vehicle retail data. Extract the month and year, total PV retail units, PV YoY growth percentage, 2W retail units, 2W YoY growth percentage, CV retail units, CV YoY growth percentage, and total all-vehicle retail units.',
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
      },
      required: ['pv_units', 'month', 'year'],
    },
  },
  {
    key: 'fada_powertrain_mix',
    url: FADA_URL,
    prompt: 'This page reports FADA monthly vehicle retail data including powertrain mix. Extract the PV EV share percentage, PV CNG share percentage, 2W EV share percentage, overall alternative fuel share percentage, month and year being reported.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'string' },
        pv_ev_share_pct: { type: 'number' },
        pv_cng_share_pct: { type: 'number' },
        tw_ev_share_pct: { type: 'number' },
        alt_fuel_share_pct: { type: 'number' },
      },
      required: ['pv_ev_share_pct', 'month', 'year'],
    },
  },
  {
    key: 'jato_body_type',
    url: JATO_BODY_URL,
    prompt: 'This article reports India passenger vehicle body type sales shares for a specific month. Extract the SUV share percentage of total PV sales, hatchback share percentage, sedan share percentage, and MPV share percentage. All four figures are stated explicitly as percentages in the article text. Also extract the month and year being reported.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'string' },
        suv_share_pct: { type: 'number' },
        hatchback_share_pct: { type: 'number' },
        sedan_share_pct: { type: 'number' },
        mpv_share_pct: { type: 'number' },
      },
      required: ['suv_share_pct', 'month', 'year'],
    },
  },
  {
    key: 'jato_pv_trend',
    url: JATO_TREND_URL,
    prompt: 'This is a Jato Dynamics India monthly PV market press release. Extract the month and year, total PV registrations in units, PV YoY growth percentage, and MoM growth percentage.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'string' },
        total_pv_units: { type: 'number' },
        pv_yoy_pct: { type: 'number' },
        pv_mom_pct: { type: 'number' },
      },
      required: ['total_pv_units', 'month', 'year'],
    },
  },
  {
    key: 'autopunditz_segments',
    url: AUTOPUNDITZ_URL,
    prompt: 'This is a monthly auto industry brief. Extract only figures explicitly stated in the text: MUV total units and YoY growth percentage, sedan YoY growth percentage. Also extract the month and year being reported.',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        year: { type: 'string' },
        muv_units: { type: 'number' },
        muv_yoy_pct: { type: 'number' },
        sedan_yoy_pct: { type: 'number' },
      },
      required: ['month', 'year'],
    },
  },
];

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

export default async function handler(req, res) {
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
    }
  }

  return res.status(200).json({
    ranAt: new Date().toISOString(),
    results,
  });
}