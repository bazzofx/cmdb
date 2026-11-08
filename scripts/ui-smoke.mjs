// Headless UI smoke test for the Reports page.
// Requires: dev server on $APP_URL, Chrome with --remote-debugging-port=9222.
// Run: node scripts/ui-smoke.mjs

import fs from 'fs';

const CDP = process.env.CDP_URL ?? 'http://127.0.0.1:9222';
const APP = process.env.APP_URL ?? 'http://127.0.0.1:3010/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const targets = await (await fetch(`${CDP}/json/list`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No page target found');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

let sequence = 0;
const pending = new Map();
const errors = [];

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  } else if (message.method === 'Runtime.exceptionThrown') {
    errors.push(message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text);
  } else if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
    errors.push(message.params.entry.text);
  }
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 30000);
    pending.set(id, (message) => {
      clearTimeout(timer);
      resolve(message);
    });
    socket.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.result?.exceptionDetails) {
    throw new Error(JSON.stringify(response.result.exceptionDetails));
  }
  return response.result.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Network.enable');
await send('Network.clearBrowserCookies');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url: APP });
await sleep(5000);

// Local auth is enabled by default. Sign in if the login form is present.
const smokeEmail = process.env.SMOKE_EMAIL;
const smokePassword = process.env.SMOKE_PASSWORD;
if (!smokeEmail || !smokePassword) {
  console.error('SMOKE_EMAIL and SMOKE_PASSWORD must be set in the environment.');
  process.exit(1);
}
const loginState = await evaluate(`(() => {
  const password = document.querySelector('input[type="password"]');
  if (!password) return 'already';
  const email = document.querySelector('input[type="email"]');
  if (!email) return 'no-email-field';
  const setValue = (element, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setValue(email, ${JSON.stringify(smokeEmail)});
  setValue(password, ${JSON.stringify(smokePassword)});
  password.form?.requestSubmit();
  return 'submitted';
})()`);
if (loginState === 'submitted') {
  await sleep(2000);
  // Wait for the dashboard's initial metrics request to settle.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const text = await evaluate('document.body.innerText');
    if (!text.includes('Loading infrastructure overview')) break;
    await sleep(500);
  }
}
const postLoginText = await evaluate('document.body.innerText');
if (!postLoginText.includes('Infrastructure Overview')) {
  console.log('Login state:', loginState);
  console.log('Post-login body:', postLoginText.slice(0, 500));
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

check((await evaluate('document.title')).includes('CSM'), 'Page title missing');

// Every routed view must mount without a crash or an empty workspace.
const views = [
  { label: 'Overview', marker: 'Infrastructure Overview' },
  { label: 'Inventory', marker: 'SERVER INFRASTRUCTURE INVENTORY' },
  { label: 'Business Units', marker: 'BUSINESS UNIT' },
  { label: '4_Product', marker: 'PRODUCT' },
  { label: 'Ownership', marker: 'OWNERSHIP' },
  { label: 'Infrastructure Map', marker: 'INFRASTRUCTURE' },
  { label: 'Incidents', marker: 'INCIDENT' },
  { label: 'Archive Incident', marker: 'ARCHIV' },
  { label: 'Data Sync', marker: 'DATA' },
  { label: 'Settings', marker: 'AUDIT' },
];

const viewResults = [];
for (const view of views) {
  const clicked = await evaluate(`(() => {
    const buttons = [...document.querySelectorAll('aside button')];
    const button = buttons.find(candidate =>
      [...candidate.querySelectorAll('span')].some(span => span.textContent.trim() === ${JSON.stringify(view.label)})
    );
    if (!button) return 'missing';
    button.click();
    return 'ok';
  })()`);
  check(clicked === 'ok' || (clicked === 'missing' && ['Data Sync', 'Settings', 'Incidents', 'Archive Incident'].includes(view.label)), `View ${view.label}: sidebar button missing (${clicked})`);
  if (clicked === 'missing') {
    viewResults.push({ label: view.label, characters: 0, skipped: true });
    continue;
  }
  await sleep(900);
  const text = await evaluate(`document.querySelector('main')?.innerText ?? ''`);
  check(
    text.toUpperCase().includes(view.marker.toUpperCase()),
    `View ${view.label}: did not render (missing "${view.marker}")`
  );
  viewResults.push({ label: view.label, characters: text.length });
}

// Capture the incident workbench for manual inspection, then move on to reports.
await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('aside button')];
  const button = buttons.find(candidate =>
    [...candidate.querySelectorAll('span')].some(span => span.textContent.trim() === 'Incidents')
  );
  button?.click();
  return true;
})()`);
await sleep(900);
const incidentShot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
fs.writeFileSync('.tmp-incidents.png', Buffer.from(incidentShot.result.data, 'base64'));

await evaluate(
  `(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Reports'); if (!button) throw new Error('Reports nav button not found'); button.click(); return true; })()`
);
await sleep(1200);

const expectations = [
  { id: 1, title: 'Complete Server Inventory', rows: 9, header: 'Networks', summary: 'Network segments' },
  { id: 2, title: 'Business Unit Inventory', rows: 4, header: 'Sub-BU', summary: 'Largest group' },
  { id: 3, title: 'Ownership Completeness Audit', rows: 0, header: 'Completeness', summary: 'Servers with gaps' },
  { id: 4, title: 'Servers by Manager Directory', rows: 4, header: 'Manager', summary: 'Average portfolio' },
  { id: 5, title: 'Servers by Support Team', rows: 1, header: 'Support Team', summary: 'Largest team' },
  { id: 6, title: 'Servers by Datacenter', rows: 1, header: 'Datacenter', summary: 'Largest site' },
  { id: 7, title: 'Servers by Network Segment', rows: 9, header: 'Network Segment', summary: 'Busiest segment' },
  { id: 8, title: 'Servers with Secure Boot Disabled', rows: 3, header: 'Primary IP', summary: 'Share of estate' },
  { id: 9, title: 'Missing Ownership Metadata', rows: 0, header: 'Missing Fields', summary: 'Affected servers' },
  { id: 10, title: 'Incident Impact Summary', rows: 2, header: 'Incident', summary: 'Stakeholder emails' },
  { id: 11, title: 'Vulnerability Assessment Posture', rows: 5, header: 'Risk', summary: 'Critical exposure' },
  { id: 12, title: 'Patching Lifecycle Progress', rows: 5, header: 'Campaign', summary: 'Overdue targets' },
];

const results = [];
const availableReportIds = await evaluate(`(() => {
  const catalogue = document.querySelector('[data-testid="report-catalogue"]');
  if (!catalogue) return [];
  return [...catalogue.querySelectorAll('button')]
    .map(button => {
      const match = button.textContent.trim().match(/^(\\d+)\\./);
      return match ? Number(match[1]) : null;
    })
    .filter(Boolean);
})()`);

const reportSkips = [];
for (const expected of expectations) {
  if (!availableReportIds.includes(expected.id)) {
    reportSkips.push(expected.id);
    continue;
  }
  const clicked = await evaluate(`(() => {
    const catalogue = document.querySelector('[data-testid="report-catalogue"]');
    if (!catalogue) return 'no-catalogue';
    const buttons = [...catalogue.querySelectorAll('button')];
    const button = buttons.find(candidate => candidate.textContent.trim().startsWith(${JSON.stringify(`${expected.id}.`)}));
    if (!button) return 'no-button';
    button.click();
    return 'ok';
  })()`);
  check(clicked === 'ok', `Report ${expected.id}: catalogue click failed (${clicked})`);
  await sleep(450);

  const data = await evaluate(`(() => {
    const heading = [...document.querySelectorAll('h2')].find(el => /^\\d+\\./.test(el.textContent.trim()));
    const table = document.querySelector('table');
    const headers = table ? [...table.querySelectorAll('thead th')].map(th => th.textContent.trim()) : [];
    const rowCount = table ? table.querySelectorAll('tbody tr').length : 0;
    const main = document.querySelector('main')?.innerText ?? '';
    return { title: heading ? heading.textContent.trim() : '', headers, rowCount, main };
  })()`);

  results.push({ id: expected.id, title: data.title, rows: data.rowCount, columns: data.headers.length });
  check(data.title.includes(expected.title), `Report ${expected.id}: title "${data.title}" does not include "${expected.title}"`);
  check(data.headers.includes(expected.header), `Report ${expected.id}: missing column "${expected.header}"`);
  check(data.rowCount === expected.rows, `Report ${expected.id}: expected ${expected.rows} rows, rendered ${data.rowCount}`);
  check(
    data.main.toUpperCase().includes(expected.summary.toUpperCase()),
    `Report ${expected.id}: missing summary card "${expected.summary}"`
  );

  if (expected.rows === 0) {
    check(
      data.main.includes('Every server has a complete ownership record') ||
        data.main.includes('No orphaned assets'),
      `Report ${expected.id}: empty state message missing`
    );
  }
}

// Search narrows the visible rows.
await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Complete Server Inventory'));
  if (button) button.click();
  return true;
})()`);
await sleep(400);
const beforeSearch = await evaluate(`document.querySelectorAll('tbody tr').length`);
await evaluate(`(() => {
  const input = document.querySelector('input[placeholder^="Search this report"]');
  if (!input) throw new Error('search input not found');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'br1-sse-esx-23');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(500);
const afterSearch = await evaluate(`document.querySelectorAll('tbody tr').length`);
check(afterSearch > 0 && afterSearch < beforeSearch, `Search did not narrow rows (${beforeSearch} → ${afterSearch})`);

await evaluate(`(() => {
  const input = document.querySelector('input[placeholder^="Search this report"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(400);

const capture = async (name) => {
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(name, Buffer.from(screenshot.result.data, 'base64'));
};
await capture('.tmp-reports-inventory.png');

await evaluate(`(() => {
  const catalogue = document.querySelector('[data-testid="report-catalogue"]');
  const buttons = catalogue ? [...catalogue.querySelectorAll('button')] : [];
  if (buttons[11]) buttons[11].click();
  return true;
})()`);
await sleep(500);
await capture('.tmp-reports-patching.png');

await evaluate(`(() => {
  const catalogue = document.querySelector('[data-testid="report-catalogue"]');
  const buttons = catalogue ? [...catalogue.querySelectorAll('button')] : [];
  if (buttons[10]) buttons[10].click();
  return true;
})()`);
await sleep(500);
await capture('.tmp-reports-vulnerability.png');

// Row click opens the server drawer.
await evaluate(`(() => {
  const catalogue = document.querySelector('[data-testid="report-catalogue"]');
  const buttons = catalogue ? [...catalogue.querySelectorAll('button')] : [];
  if (buttons[0]) buttons[0].click();
  return true;
})()`);
await sleep(400);
await evaluate(`(() => {
  const table = document.querySelector('table');
  const row = table?.querySelector('tbody tr');
  if (row) row.click();
  return true;
})()`);
await sleep(800);
const drawerText = await evaluate(`document.body.innerText`);
check(
  drawerText.includes('SERVER PROFILE') || drawerText.includes('Server Profile') || drawerText.includes('Infrastructure'),
  'Server drawer did not open from a report row'
);

console.log('View rendering');
for (const result of viewResults) {
  console.log(`  ✓ ${result.label.padEnd(20)} ${String(result.characters).padStart(5)} chars`);
}

console.log('\nReport rendering');
console.log('ID  Title                                      Rows  Cols');
for (const result of results) {
  console.log(
    `${String(result.id).padEnd(3)} ${result.title.slice(0, 42).padEnd(42)} ${String(result.rows).padStart(4)} ${String(result.columns).padStart(5)}`
  );
}
if (reportSkips.length > 0) console.log(`Skipped reports not available to this role: ${reportSkips.join(', ')}`);

const badResources = await evaluate(
  `performance.getEntriesByType('resource').filter(r => (r.responseStatus || 0) >= 400).map(r => r.name)`
);
if (badResources.length > 0) console.log('Failed resources:', badResources.join(', '));

const ignorableResources = badResources.every(
  url => url.includes('favicon') || url.endsWith('/api/me')
);
const realErrors = errors.filter(
  (error) =>
    error &&
    !error.includes('favicon') &&
    !error.includes('Download the React DevTools') &&
    !error.includes('@vite/client') &&
    !error.includes('WebSocket') &&
    !error.includes('status of 401') &&
    !(error.includes('Failed to load resource') && ignorableResources)
);
check(realErrors.length === 0, `Console errors: ${realErrors.slice(0, 3).join(' | ')}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} UI check(s) FAILED:`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log('\nUI smoke test passed.');
socket.close();
process.exit(0);
