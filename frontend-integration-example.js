// frontend-integration-example.js
//
// HOW TO USE THIS:
// Open PP_Dashboard.html, and right before the closing </body> tag,
// add a <script> tag with code like this. Replace YOUR-PROJECT-NAME
// with your actual Vercel project name once deployed.
//
// This does NOT replace your existing Chart.js code — it RUNS BEFORE
// the charts are created, and updates the data arrays they use.

const API_BASE = 'https://YOUR-PROJECT-NAME.vercel.app';

async function loadLiveData() {
  try {
    const res = await fetch(`${API_BASE}/api/latest-data`);
    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Could not load live data, falling back to static values:', err);
    return null; // The page will just keep showing whatever is hardcoded.
  }
}

function applyLiveData(data) {
  if (!data) return; // nothing to apply, keep static fallback values

  // Example: update the "India PV Sales — Apr '26" KPI tile
  if (data.siam_pv_total) {
    const { total_pv_units, month, year } = data.siam_pv_total.value;
    const tile = document.querySelector('#kpi-pv-total .val');
    const label = document.querySelector('#kpi-pv-total .lbl');
    if (tile) tile.textContent = total_pv_units.toLocaleString('en-IN');
    if (label) label.textContent = `India PV Sales — ${month} '${year}`;
  }

  // Example: rebuild the news list from live headlines
  if (data.autocar_latest_news) {
    const headlines = data.autocar_latest_news.value.headlines || [];
    const container = document.querySelector('#news-feed-container');
    if (container && headlines.length) {
      container.innerHTML = headlines
        .map(
          (h) => `
        <div class="news-item" onclick="window.open('${h.url || '#'}','_blank')">
          <div class="ndot" style="background:#0EA5E9;"></div>
          <div>
            <div class="ntitle">${h.title}</div>
            <div class="nmeta">${h.summary || ''}</div>
          </div>
        </div>`
        )
        .join('');
    }
  }

  // Show a small "last updated" timestamp somewhere on the page so
  // it's obvious to anyone viewing that this is live, not static.
  const anyTimestamp = Object.values(data)[0]?.updatedAt;
  if (anyTimestamp) {
    const tsEl = document.querySelector('.tb-ts');
    if (tsEl) {
      const d = new Date(anyTimestamp);
      tsEl.textContent = `Live data · last refreshed ${d.toLocaleString('en-IN')}`;
    }
  }
}

// Run on page load, BEFORE your existing Chart.js initialization code.
(async () => {
  const liveData = await loadLiveData();
  applyLiveData(liveData);
  // ... your existing new Chart(...) calls continue right after this,
  // and will now use whatever values applyLiveData() just updated.
})();
