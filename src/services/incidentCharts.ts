import type { ReportData } from './incidentReportGenerator.js';

/**
 * Converts a base64 Data URL to a Uint8Array suitable for docx ImageRun.
 */
export function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates a retina-crisp 2D canvas context.
 */
function createRetinaCanvas(width: number, height: number, scale = 2): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

/**
 * Draws a professional card background with title.
 */
function drawCardBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  title: string,
  subtitle?: string
) {
  // Card background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Title bar
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 13px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(title, 16, 24);

  if (subtitle) {
    ctx.fillStyle = '#64748B';
    ctx.font = 'normal 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(subtitle, 16, 38);
  }

  // Divider
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const lineY = subtitle ? 46 : 34;
  ctx.moveTo(16, lineY);
  ctx.lineTo(width - 16, lineY);
  ctx.stroke();
}

/**
 * 1. TRIAGE STATUS DISTRIBUTION PIE/DONUT CHART
 */
export function generateTriageStatusPieChart(data: ReportData, width = 500, height = 260): string {
  const { canvas, ctx } = createRetinaCanvas(width, height);
  drawCardBackground(ctx, width, height, 'Triage Status Distribution', 'Categorized operational response states across impacted systems');

  const { hostDetails, affectedList } = data;
  const statusCounts: Record<string, number> = {
    Patched: 0,
    Patching: 0,
    Contacted: 0,
    'To be contacted': 0,
    Isolated: 0,
    Other: 0,
  };

  affectedList.forEach(s => {
    const d = hostDetails[s.id];
    const status = d?.status || 'To be contacted';
    if (status === 'Patched' || status === 'Patch') {
      statusCounts.Patched++;
    } else if (status === 'Patching') {
      statusCounts.Patching++;
    } else if (status === 'Contacted') {
      statusCounts.Contacted++;
    } else if (status === 'Isolated') {
      statusCounts.Isolated++;
    } else if (status === 'To be contacted') {
      statusCounts['To be contacted']++;
    } else {
      statusCounts.Other++;
    }
  });

  const total = affectedList.length || 1;
  const slices = [
    { label: 'Patched', count: statusCounts.Patched, color: '#10B981' },
    { label: 'Patching Active', count: statusCounts.Patching, color: '#06B6D4' },
    { label: 'Contacted', count: statusCounts.Contacted, color: '#3B82F6' },
    { label: 'To be Contacted', count: statusCounts['To be contacted'], color: '#F59E0B' },
    { label: 'Isolated / Quarantine', count: statusCounts.Isolated, color: '#EF4444' },
  ].filter(s => s.count > 0);

  if (statusCounts.Other > 0) {
    slices.push({ label: 'Other', count: statusCounts.Other, color: '#94A3B8' });
  }

  // Draw Donut Chart
  const centerX = 120;
  const centerY = 150;
  const radius = 70;
  const innerRadius = 40;

  let startAngle = -Math.PI / 2;

  slices.forEach(slice => {
    const sliceAngle = (slice.count / total) * (Math.PI * 2);
    const endAngle = startAngle + sliceAngle;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    // White outline between slices
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    startAngle = endAngle;
  });

  // Center cutout text
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(total), centerX, centerY - 6);

  ctx.fillStyle = '#64748B';
  ctx.font = 'normal 9px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('SERVERS', centerX, centerY + 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Draw Legend on Right
  const legendX = 230;
  let legendY = 80;

  slices.forEach(slice => {
    const pct = Math.round((slice.count / total) * 100);

    // Color pill
    ctx.fillStyle = slice.color;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, 14, 14, 3);
    ctx.fill();

    // Label
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 11px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(slice.label, legendX + 22, legendY + 11);

    // Count & percentage
    ctx.fillStyle = '#64748B';
    ctx.font = 'normal 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${slice.count} hosts (${pct}%)`, legendX + 160, legendY + 11);

    legendY += 26;
  });

  return canvas.toDataURL('image/png');
}

/**
 * 2. REMEDIATION PROGRESS & STAKEHOLDER OUTREACH DONUT CHART
 */
export function generateRemediationDonutChart(data: ReportData, width = 500, height = 260): string {
  const { canvas, ctx } = createRetinaCanvas(width, height);
  drawCardBackground(ctx, width, height, 'Remediation Completion & Outreach', 'Patch verification status vs remaining mitigation workload');

  const { metrics } = data;
  const total = metrics.totalServers || 1;
  const patched = metrics.patchedCount;
  const remaining = Math.max(0, total - patched);

  // Left Donut: Remediation Progress
  const center1X = 110;
  const center1Y = 145;
  const radius = 62;
  const innerRadius = 42;

  // Track
  ctx.beginPath();
  ctx.arc(center1X, center1Y, radius, 0, Math.PI * 2);
  ctx.arc(center1X, center1Y, innerRadius, 0, Math.PI * 2, true);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();

  // Progress Fill
  const fillAngle = (patched / total) * (Math.PI * 2);
  if (fillAngle > 0) {
    ctx.beginPath();
    ctx.arc(center1X, center1Y, radius, -Math.PI / 2, -Math.PI / 2 + fillAngle);
    ctx.arc(center1X, center1Y, innerRadius, -Math.PI / 2 + fillAngle, -Math.PI / 2, true);
    ctx.fillStyle = '#10B981';
    ctx.fill();
  }

  // Center text
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${metrics.patchedPct}%`, center1X, center1Y - 6);

  ctx.fillStyle = '#059669';
  ctx.font = 'bold 9px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('PATCHED', center1X, center1Y + 12);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Middle/Right: Breakdown Stats & Progress Bars
  const barStartX = 210;
  let currentY = 75;

  const items = [
    { label: 'Patched Systems', count: patched, pct: metrics.patchedPct, color: '#10B981', desc: 'Verified remediated' },
    { label: 'Pending Remediation', count: remaining, pct: 100 - metrics.patchedPct, color: '#F59E0B', desc: 'Awaiting patch/reboot' },
    { label: 'Stakeholder Outreach', count: metrics.communicatedCount, pct: metrics.communicatedPct, color: '#3B82F6', desc: 'Owners notified' },
    { label: 'Documented Tickets/Notes', count: metrics.hasNotesCount, pct: metrics.hasNotesPct, color: '#8B5CF6', desc: 'Audit trail recorded' },
  ];

  items.forEach(item => {
    // Label and values
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(item.label, barStartX, currentY);

    ctx.fillStyle = '#64748B';
    ctx.font = 'normal 9px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${item.count}/${total} (${item.pct}%)`, width - 20, currentY);
    ctx.textAlign = 'left';

    // Bar track
    const barY = currentY + 4;
    const barWidth = width - barStartX - 20;
    ctx.fillStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.roundRect(barStartX, barY, barWidth, 7, 3);
    ctx.fill();

    // Bar fill
    const fillW = Math.max(2, (item.pct / 100) * barWidth);
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(barStartX, barY, fillW, 7, 3);
    ctx.fill();

    currentY += 38;
  });

  return canvas.toDataURL('image/png');
}

/**
 * 3. BUSINESS UNIT IMPACT & PATCH STATUS (HORIZONTAL BAR CHART)
 */
export function generateBusinessUnitBarChart(data: ReportData, width = 600, height = 280): string {
  const { canvas, ctx } = createRetinaCanvas(width, height);
  drawCardBackground(ctx, width, height, 'Business Unit Impact & Remediation Progress', 'Distribution of affected hosts and patch verification by organizational unit');

  const { buBreakdown } = data;
  if (buBreakdown.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText('No Business Unit impact recorded', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const maxTotal = Math.max(...buBreakdown.map(b => b.total), 1);
  const startX = 140;
  const maxBarWidth = width - startX - 110;
  let currentY = 70;

  buBreakdown.forEach(bu => {
    const pct = bu.total > 0 ? Math.round((bu.patched / bu.total) * 100) : 0;
    const totalBarWidth = (bu.total / maxTotal) * maxBarWidth;
    const patchedBarWidth = (bu.patched / maxTotal) * maxBarWidth;

    // BU Label (left aligned, truncated if necessary)
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10.5px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(bu.name, 16, currentY + 13);

    // Total Background Bar Track
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(startX, currentY, totalBarWidth, 18, 4);
    ctx.fill();

    // Patched Fill Bar
    if (bu.patched > 0) {
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.roundRect(startX, currentY, patchedBarWidth, 18, 4);
      ctx.fill();
    }

    // Numbers & percentage text on the right
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${bu.patched}/${bu.total}`, startX + totalBarWidth + 8, currentY + 13);

    ctx.fillStyle = bu.patched === bu.total ? '#059669' : '#64748B';
    ctx.font = 'normal 9.5px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`(${pct}%)`, startX + totalBarWidth + 48, currentY + 13);

    currentY += 36;
  });

  // Legend at bottom
  const legendY = height - 20;
  ctx.fillStyle = '#10B981';
  ctx.beginPath();
  ctx.roundRect(startX, legendY, 12, 12, 2);
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = 'normal 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText('Patched Systems', startX + 18, legendY + 10);

  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(startX + 140, legendY, 12, 12, 2);
  ctx.fill();
  ctx.fillStyle = '#64748B';
  ctx.fillText('Total Affected in Scope', startX + 158, legendY + 10);

  return canvas.toDataURL('image/png');
}

/**
 * 4. PRODUCT WORKLOAD DISTRIBUTION (HORIZONTAL BAR CHART)
 */
export function generateProductBarChart(data: ReportData, width = 600, height = 260): string {
  const { canvas, ctx } = createRetinaCanvas(width, height);
  drawCardBackground(ctx, width, height, 'Impacted Products & Workload Roles', 'Top product platforms affected by vulnerability blast radius');

  const { productBreakdown, metrics } = data;
  const totalServers = metrics.totalServers || 1;

  if (productBreakdown.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText('No Product details recorded', 20, 80);
    return canvas.toDataURL('image/png');
  }

  // Top products (up to 6)
  const topProducts = productBreakdown.slice(0, 6);
  const maxCount = Math.max(...topProducts.map(([, c]) => c), 1);
  const startX = 140;
  const maxBarWidth = width - startX - 100;
  let currentY = 70;

  const colors = ['#2563EB', '#3B82F6', '#60A5FA', '#818CF8', '#A78BFA', '#C084FC'];

  topProducts.forEach(([prod, count], idx) => {
    const pct = Math.round((count / totalServers) * 100);
    const barWidth = (count / maxCount) * maxBarWidth;

    // Label
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10.5px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(prod, 16, currentY + 13);

    // Track
    ctx.fillStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.roundRect(startX, currentY, maxBarWidth, 17, 3);
    ctx.fill();

    // Bar Fill
    ctx.fillStyle = colors[idx % colors.length];
    ctx.beginPath();
    ctx.roundRect(startX, currentY, Math.max(6, barWidth), 17, 3);
    ctx.fill();

    // Value text
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${count} hosts`, startX + barWidth + 8, currentY + 13);

    ctx.fillStyle = '#64748B';
    ctx.font = 'normal 9.5px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`(${pct}%)`, startX + barWidth + 56, currentY + 13);

    currentY += 32;
  });

  return canvas.toDataURL('image/png');
}

/**
 * 5. MANAGER ACCOUNTABILITY & REMEDIATION RATE (BAR CHART)
 */
export function generateManagerBarChart(data: ReportData, width = 600, height = 240): string {
  const { canvas, ctx } = createRetinaCanvas(width, height);
  drawCardBackground(ctx, width, height, 'Responsible Manager Accountability', 'Operational leadership oversight and server remediation progress');

  const { managerAccountability } = data;
  if (managerAccountability.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText('No manager accountability data recorded', 20, 80);
    return canvas.toDataURL('image/png');
  }

  const managers = managerAccountability.slice(0, 5);
  const maxTotal = Math.max(...managers.map(m => m.total), 1);
  const startX = 140;
  const maxBarWidth = width - startX - 110;
  let currentY = 70;

  managers.forEach(mgr => {
    const totalBarWidth = (mgr.total / maxTotal) * maxBarWidth;
    const patchedBarWidth = (mgr.patched / maxTotal) * maxBarWidth;
    const pct = mgr.total > 0 ? Math.round((mgr.patched / mgr.total) * 100) : 0;

    // Manager Name
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 10px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(mgr.name, 16, currentY + 12);

    // Track
    ctx.fillStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.roundRect(startX, currentY, totalBarWidth, 16, 3);
    ctx.fill();

    // Patched Fill
    if (mgr.patched > 0) {
      ctx.fillStyle = '#F59E0B'; // Amber for operational managers
      ctx.beginPath();
      ctx.roundRect(startX, currentY, patchedBarWidth, 16, 3);
      ctx.fill();
    }

    // Text
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9.5px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`${mgr.patched}/${mgr.total}`, startX + totalBarWidth + 8, currentY + 12);

    ctx.fillStyle = '#64748B';
    ctx.font = 'normal 9px Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`(${pct}%)`, startX + totalBarWidth + 48, currentY + 12);

    currentY += 30;
  });

  return canvas.toDataURL('image/png');
}
