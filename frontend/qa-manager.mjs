export default async function run(page, ui) {
  const out = {};

  // --- Reports page ---
  await page.goto('http://localhost:5173/manager/reports', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  out.reports = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    subtitle: document.querySelector('.mgr-subtitle')?.innerText,
    kpis: [...document.querySelectorAll('.rpt-kpi-label')].map((e) => e.innerText),
    decisions: [...document.querySelectorAll('.mgr-decision strong')].map((e) => e.innerText),
    panels: [...document.querySelectorAll('.rpt-panel-head h3')].map((e) => e.innerText),
    alert: document.querySelector('.rpt-alert')?.innerText || null,
    loading: !!document.querySelector('.rpt-loading'),
  }));

  // --- Activity log page ---
  await page.goto('http://localhost:5173/manager/audit-log', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  out.log = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    days: [...document.querySelectorAll('.mgr-log-day h2')].map((e) => e.innerText),
    rows: document.querySelectorAll('.mgr-log-item').length,
    firstAction: document.querySelector('.mgr-log-action')?.innerText || null,
    empty: document.querySelector('.mgr-log-empty')?.innerText || null,
    alert: document.querySelector('.alert-error')?.innerText || null,
  }));

  return out;
}
