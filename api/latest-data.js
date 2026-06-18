// api/latest-data.js
//
// The dashboard page calls THIS endpoint (not Firecrawl, not Supabase
// directly) every time someone loads PP_Dashboard.html. It just reads
// whatever the scraper job last saved, and returns it as JSON.
//
// Required environment variables (same Supabase ones as refresh-data.js):
//   SUPABASE_URL
//   SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  const { data, error } = await supabase
    .from('dashboard_metrics')
    .select('metric_key, value, source_url, updated_at');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Reshape into a simple { metric_key: {...} } object so the frontend
  // doesn't have to loop through an array every time.
  const shaped = {};
  for (const row of data) {
    shaped[row.metric_key] = {
      value: JSON.parse(row.value),
      sourceUrl: row.source_url,
      updatedAt: row.updated_at,
    };
  }

  // Cache for 5 minutes at the edge so repeated page loads don't all
  // hit Supabase directly — cheap and keeps things fast.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
  return res.status(200).json(shaped);
}
