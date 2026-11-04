import { jsPDF } from 'jspdf';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ImageRun,
} from 'docx';
import type { Incident, IncidentImpact, ServerRecord, IncidentHostDetail } from '../types/index.js';
import {
  generateTriageStatusPieChart,
  generateRemediationDonutChart,
  generateBusinessUnitBarChart,
  generateProductBarChart,
  generateManagerBarChart,
  base64ToUint8Array,
} from './incidentCharts.js';

export interface ReportData {
  incident: Incident;
  impact: IncidentImpact | null;
  affectedList: ServerRecord[];
  hostDetails: Record<string, IncidentHostDetail>;
  metrics: {
    totalServers: number;
    patchedCount: number;
    patchedPct: number;
    communicatedCount: number;
    communicatedPct: number;
    hasNotesCount: number;
    hasNotesPct: number;
    isolatedCount: number;
  };
  buBreakdown: Array<{
    name: string;
    total: number;
    patched: number;
    communicated: number;
  }>;
  productBreakdown: Array<[string, number]>;
  managerAccountability: Array<{
    name: string;
    email: string;
    total: number;
    patched: number;
  }>;
}

function renderAsciiBar(pct: number, length = 14): string {
  const filled = Math.min(length, Math.max(0, Math.round((pct / 100) * length)));
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${pct}%`;
}

// ============================================================================
// 1. MARKDOWN REPORT GENERATOR (WITH VISUAL ASCII CHARTS & PROGRESS METRICS)
// ============================================================================
export function generateMarkdownReport(data: ReportData): string {
  const { incident, metrics, buBreakdown, productBreakdown, managerAccountability, affectedList, hostDetails } = data;
  const now = new Date().toLocaleString();

  let md = `# Incident Remediation & Triage Operational Report\n\n`;
  md += `**Incident Reference:** \`${incident.incident_reference}\`  \n`;
  md += `**Title:** ${incident.incident_title}  \n`;
  md += `**Severity:** ${incident.severity}  \n`;
  md += `**Status:** ${incident.status}  \n`;
  md += `**Assigned Lead:** ${incident.assigned_engineer || 'SecOps Lead'}  \n`;
  md += `**Date Detected:** ${incident.date_detected ? new Date(incident.date_detected).toLocaleDateString() : 'N/A'}  \n`;
  md += `**Detection Source:** ${incident.detection_source || 'SIEM / Vulnerability Scanner'}  \n`;
  md += `**IoC / CVE:** \`${incident.ioc_or_vulnerability || 'N/A'}\`  \n`;
  md += `**Report Generated:** ${now}  \n\n`;

  if (incident.status === 'Closed' || incident.status === 'Archived') {
    md += `### Closure & Archive Summary\n`;
    md += `- **Closed At:** ${incident.closed_at ? new Date(incident.closed_at).toLocaleString() : 'N/A'}\n`;
    md += `- **Closed By:** ${incident.closed_by || 'SecOps Admin'}\n`;
    md += `- **Closure Notes:** ${incident.description || 'Incident contained, verified, and archived.'}\n\n`;
  } else {
    md += `### Description\n${incident.description || 'No detailed description recorded.'}\n\n`;
  }

  md += `---\n\n`;
  md += `## 1. Executive Remediation Metrics & Progress\n\n`;
  md += `| Metric | Count / Status | Progress & Proportion |\n`;
  md += `| :--- | :--- | :--- |\n`;
  md += `| **Impacted Assets in Scope** | ${metrics.totalServers} servers | ${renderAsciiBar(100)} |\n`;
  md += `| **Remediated / Patched Systems** | ${metrics.patchedCount} / ${metrics.totalServers} servers | **${renderAsciiBar(metrics.patchedPct)}** |\n`;
  md += `| **Stakeholder Outreach** | ${metrics.communicatedCount} / ${metrics.totalServers} notified | ${renderAsciiBar(metrics.communicatedPct)} |\n`;
  md += `| **Notes & Ticket Documentation** | ${metrics.hasNotesCount} / ${metrics.totalServers} documented | ${renderAsciiBar(metrics.hasNotesPct)} |\n`;
  md += `| **Quarantine / Isolated Hosts** | ${metrics.isolatedCount} hosts | Active Containment Mode |\n\n`;

  md += `## 2. Business Unit Impact & Patch Distribution (Bar Representation)\n\n`;
  md += `| Business Unit | Total Servers | Patched | Communication | Remediated Progress |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  buBreakdown.forEach(bu => {
    const pct = bu.total > 0 ? Math.round((bu.patched / bu.total) * 100) : 0;
    md += `| **${bu.name}** | ${bu.total} | ${bu.patched} | ${bu.communicated}/${bu.total} | \`${renderAsciiBar(pct, 10)}\` |\n`;
  });
  md += `\n`;

  md += `## 3. Product Workloads (4_Product) Distribution\n\n`;
  md += `| Product Platform | Impacted Systems | Proportion |\n`;
  md += `| :--- | :--- | :--- |\n`;
  productBreakdown.forEach(([prod, count]) => {
    const pct = metrics.totalServers > 0 ? Math.round((count / metrics.totalServers) * 100) : 0;
    md += `| **${prod}** | ${count} | \`${renderAsciiBar(pct, 10)}\` |\n`;
  });
  md += `\n`;

  md += `## 4. Operational Stakeholders & Manager Accountability\n\n`;
  md += `| Responsible Manager | Contact Email | Assigned Servers | Remediated Status |\n`;
  md += `| :--- | :--- | :--- | :--- |\n`;
  managerAccountability.forEach(mgr => {
    const pct = mgr.total > 0 ? Math.round((mgr.patched / mgr.total) * 100) : 0;
    md += `| **${mgr.name}** | ${mgr.email || 'N/A'} | ${mgr.total} | ${mgr.patched}/${mgr.total} (${pct}%) |\n`;
  });
  md += `\n`;

  md += `## 5. Detailed Host Triage & Remediation Inventory\n\n`;
  md += `| Host | VM | IP | Business Unit | Product | Triage Status | Patch Status | Engineer | Ticket | Notes |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  affectedList.forEach(s => {
    const d = hostDetails[s.id] || {};
    const notesClean = (d.notes || '').replace(/[\r\n]+/g, ' ');
    md += `| \`${s.host}\` | \`${s.vm}\` | ${s.primary_ip_address} | ${s.business_unit} | ${s.product} | **${d.status || 'To be contacted'}** | ${d.patching_status || 'Not Started'} | ${d.patch_engineer || '-'} | ${d.ticket_number || '-'} | ${notesClean || '-'} |\n`;
  });
  md += `\n`;

  md += `---\n*Generated by NexusInfra SOC Intelligence Console*\n`;

  return md;
}

// ============================================================================
// 2. WORD (.DOCX) REPORT GENERATOR (WITH EMBEDDED PIE, DONUT & BAR CHARTS)
// ============================================================================
export async function generateWordDocx(data: ReportData): Promise<Blob> {
  const { incident, metrics, buBreakdown, productBreakdown, managerAccountability, affectedList, hostDetails } = data;
  const now = new Date().toLocaleString();

  // Generate high-resolution visual chart images for DOCX embedding
  const statusPieDataUrl = generateTriageStatusPieChart(data, 520, 250);
  const remediationDonutDataUrl = generateRemediationDonutChart(data, 520, 250);
  const buBarDataUrl = generateBusinessUnitBarChart(data, 540, 260);
  const productBarDataUrl = generateProductBarChart(data, 540, 240);
  const managerBarDataUrl = generateManagerBarChart(data, 540, 220);

  const statusPieBytes = base64ToUint8Array(statusPieDataUrl);
  const remediationDonutBytes = base64ToUint8Array(remediationDonutDataUrl);
  const buBarBytes = base64ToUint8Array(buBarDataUrl);
  const productBarBytes = base64ToUint8Array(productBarDataUrl);
  const managerBarBytes = base64ToUint8Array(managerBarDataUrl);

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Header / Title Banner
          new Paragraph({
            text: `INCIDENT TRIAGE & REMEDIATION REPORT`,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: `${incident.incident_reference} · ${incident.incident_title}`,
                bold: true,
                size: 26,
                color: '2563EB',
              }),
            ],
            spacing: { after: 80 },
          }),
          new Paragraph({
            text: `Generated: ${now} | Assigned Lead: ${incident.assigned_engineer || 'SecOps Lead'} | Classification: CONFIDENTIAL`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // Incident Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Severity Level:', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: incident.severity, bold: true, color: incident.severity === 'Critical' ? 'DC2626' : 'D97706' })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Incident Status:', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: incident.status, bold: true })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Vulnerability / CVE / IoC:', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: incident.ioc_or_vulnerability || 'N/A' })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Detection Source:', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ text: incident.detection_source || 'SIEM Alert' })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 200 } }),

          // SECTION 1: KEY METRICS & VISUAL PIE/DONUT CHARTS
          new Paragraph({
            text: '1. Executive Remediation Metrics & Visual Analytics',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 120 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Remediation Metric', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Value', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Coverage & Progress', bold: true })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Impacted Infrastructure Scope' })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.totalServers} servers` })] }),
                  new TableCell({ children: [new Paragraph({ text: '100% Blast Radius' })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Remediated / Patched Systems' })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.patchedCount} / ${metrics.totalServers} servers` })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${metrics.patchedPct}% Complete`, bold: true, color: '16A34A' })] })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Stakeholder Outreach & Notification' })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.communicatedCount} / ${metrics.totalServers}` })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.communicatedPct}% Contacted` })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Ticket & Notes Documentation' })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.hasNotesCount} / ${metrics.totalServers}` })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.hasNotesPct}% Documented` })] }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ text: 'Quarantine & Containment' })] }),
                  new TableCell({ children: [new Paragraph({ text: `${metrics.isolatedCount} hosts` })] }),
                  new TableCell({ children: [new Paragraph({ text: 'Isolated from Production Network' })] }),
                ],
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 150 } }),

          // VISUAL CHART 1: PIE / DONUT CHART
          new Paragraph({
            text: 'Chart 1: Triage Status Distribution (Pie / Donut Chart)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: statusPieBytes,
                transformation: { width: 490, height: 235 },
                type: 'png',
              }),
            ],
            spacing: { after: 150 },
          }),

          // VISUAL CHART 2: REMEDIATION PROGRESS DONUT CHART
          new Paragraph({
            text: 'Chart 2: Remediation Completion & Outreach Tracking (Donut Gauge)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 150, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: remediationDonutBytes,
                transformation: { width: 490, height: 235 },
                type: 'png',
              }),
            ],
            spacing: { after: 250 },
          }),

          // SECTION 2: BUSINESS UNIT IMPACT (HORIZONTAL BAR CHART + TABLE)
          new Paragraph({
            text: '2. Impacted Business Units (Bar Chart & Analytics)',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 250, after: 80 },
          }),

          // VISUAL CHART 3: BUSINESS UNIT BAR CHART
          new Paragraph({
            text: 'Chart 3: Systems by Business Unit & Patch Verification (Horizontal Bar Chart)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: buBarBytes,
                transformation: { width: 490, height: 235 },
                type: 'png',
              }),
            ],
            spacing: { after: 150 },
          }),

          // Business Units Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Business Unit', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Total Systems', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Patched', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Notified', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Completion %', bold: true })] })] }),
                ],
              }),
              ...buBreakdown.map(bu => {
                const pct = bu.total > 0 ? Math.round((bu.patched / bu.total) * 100) : 0;
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: bu.name })] }),
                    new TableCell({ children: [new Paragraph({ text: String(bu.total) })] }),
                    new TableCell({ children: [new Paragraph({ text: String(bu.patched) })] }),
                    new TableCell({ children: [new Paragraph({ text: `${bu.communicated} / ${bu.total}` })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${pct}%`, bold: true, color: pct === 100 ? '16A34A' : '0F172A' })] })] }),
                  ],
                });
              }),
            ],
          }),

          new Paragraph({ text: '', spacing: { after: 250 } }),

          // SECTION 3: PRODUCTS & WORKLOADS (BAR CHARTS)
          new Paragraph({
            text: '3. Products & Operational Stakeholder Oversight',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 80 },
          }),

          // VISUAL CHART 4: PRODUCT BAR CHART
          new Paragraph({
            text: 'Chart 4: Impacted Workload Products (Horizontal Bar Chart)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: productBarBytes,
                transformation: { width: 490, height: 215 },
                type: 'png',
              }),
            ],
            spacing: { after: 150 },
          }),

          // VISUAL CHART 5: MANAGER ACCOUNTABILITY BAR CHART
          new Paragraph({
            text: 'Chart 5: Manager Remediation Progress (Bar Chart)',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 80 },
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: managerBarBytes,
                transformation: { width: 490, height: 200 },
                type: 'png',
              }),
            ],
            spacing: { after: 250 },
          }),

          // SECTION 4: DETAILED HOST INVENTORY
          new Paragraph({
            text: '4. Detailed Host Triage & Remediation Inventory',
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 200, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Host / VM', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Primary IP', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'BU & Product', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Triage Status', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Engineer & Ticket', bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Operational Notes', bold: true })] })] }),
                ],
              }),
              ...affectedList.map(s => {
                const d = hostDetails[s.id] || {};
                return new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: `${s.host}\n(${s.vm})` })] }),
                    new TableCell({ children: [new Paragraph({ text: s.primary_ip_address })] }),
                    new TableCell({ children: [new Paragraph({ text: `${s.business_unit}\n${s.product}` })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: d.status || 'To be contacted', bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: `${d.patch_engineer || 'None'}\n${d.ticket_number ? '#' + d.ticket_number : ''}` })] }),
                    new TableCell({ children: [new Paragraph({ text: d.notes || '-' })] }),
                  ],
                });
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}

// ============================================================================
// 3. PDF REPORT GENERATOR (WITH HIGH-RESOLUTION PIE, DONUT & BAR CHARTS)
// ============================================================================
export function generatePdfReport(data: ReportData): jsPDF {
  const { incident, metrics, buBreakdown, productBreakdown, managerAccountability, affectedList, hostDetails } = data;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 35;

  // ---------------------------------------------------------
  // PAGE 1: EXECUTIVE BANNER, METRICS & VISUAL PIE/DONUT CHARTS
  // ---------------------------------------------------------
  // Header Banner
  doc.setFillColor(13, 20, 36);
  doc.rect(0, 0, pageWidth, 75, 'F');

  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('NEXUSINFRA // INCIDENT TRIAGE & REMEDIATION REPORT', 40, 32);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(147, 197, 253);
  doc.text(`Incident Ref: ${incident.incident_reference}  |  Generated: ${new Date().toLocaleDateString()}  |  Classification: RESTRICTED`, 40, 52);

  y = 90;

  // Incident Overview Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(40, y, pageWidth - 80, 65, 4, 4, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Incident: ${incident.incident_title}`, 50, y + 18);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Severity: ${incident.severity}     |     Status: ${incident.status}     |     Lead: ${incident.assigned_engineer || 'SecOps Lead'}`, 50, y + 34);
  doc.text(`IoC / Vulnerability: ${incident.ioc_or_vulnerability || 'N/A'}     |     Source: ${incident.detection_source || 'SIEM Alert'}`, 50, y + 50);

  y += 78;

  // 4 Top Metric Cards
  const metricCards = [
    { title: 'Impacted Assets', val: `${metrics.totalServers}`, sub: '100% Blast Radius', col: [59, 130, 246] },
    { title: 'Patched Systems', val: `${metrics.patchedCount} / ${metrics.totalServers}`, sub: `${metrics.patchedPct}% Complete`, col: [16, 185, 129] },
    { title: 'Stakeholder Outreach', val: `${metrics.communicatedCount} / ${metrics.totalServers}`, sub: `${metrics.communicatedPct}% Contacted`, col: [6, 182, 212] },
    { title: 'Documented Notes', val: `${metrics.hasNotesCount} / ${metrics.totalServers}`, sub: `${metrics.hasNotesPct}% Coverage`, col: [139, 92, 246] },
  ];

  const cardWidth = (pageWidth - 80 - 30) / 4;
  metricCards.forEach((c, idx) => {
    const x = 40 + idx * (cardWidth + 10);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, 48, 4, 4, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(c.title.toUpperCase(), x + 8, y + 14);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(c.val, x + 8, y + 30);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(c.sub, x + 8, y + 42);
  });

  y += 62;

  // SECTION 1: VISUAL CHARTS (PIE & DONUT)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('1. Operational Remediation Analytics (Pie & Donut Charts)', 40, y);

  y += 12;

  // Generate charts for PDF
  const statusPieDataUrl = generateTriageStatusPieChart(data, 500, 250);
  const remediationDonutDataUrl = generateRemediationDonutChart(data, 500, 250);

  // Embed Chart 1 and Chart 2 side-by-side on Page 1
  const chartWidth = (pageWidth - 80 - 15) / 2; // ~250 pt each
  const chartHeight = 150;

  doc.addImage(statusPieDataUrl, 'PNG', 40, y, chartWidth, chartHeight);
  doc.addImage(remediationDonutDataUrl, 'PNG', 40 + chartWidth + 15, y, chartWidth, chartHeight);

  y += chartHeight + 20;

  // Page 1 Footer Summary Note
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(40, y, pageWidth - 80, 40, 3, 3, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('EXECUTIVE REMEDIATION SUMMARY:', 48, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${metrics.patchedCount} of ${metrics.totalServers} impacted hosts (${metrics.patchedPct}%) have verified patches applied. ${metrics.communicatedCount} stakeholders notified. Isolation protocols engaged for ${metrics.isolatedCount} host(s).`,
    48,
    y + 28
  );

  // ---------------------------------------------------------
  // PAGE 2: BUSINESS UNIT & PRODUCT VISUAL BAR CHARTS
  // ---------------------------------------------------------
  doc.addPage();
  y = 40;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('2. Business Unit & Workload Blast Radius Analytics (Bar Charts)', 40, y);

  y += 15;

  // Chart 3: Business Unit Impact Horizontal Bar Chart
  const buBarDataUrl = generateBusinessUnitBarChart(data, 600, 240);
  doc.addImage(buBarDataUrl, 'PNG', 40, y, pageWidth - 80, 160);

  y += 175;

  // Chart 4: Product Workloads Horizontal Bar Chart
  const productBarDataUrl = generateProductBarChart(data, 600, 220);
  doc.addImage(productBarDataUrl, 'PNG', 40, y, pageWidth - 80, 150);

  y += 165;

  // Chart 5: Manager Accountability Bar Chart
  const managerBarDataUrl = generateManagerBarChart(data, 600, 200);
  doc.addImage(managerBarDataUrl, 'PNG', 40, y, pageWidth - 80, 140);

  y += 155;

  // Business Unit Summary Table on Page 2
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Business Unit Breakdown Matrix', 40, y);
  y += 10;

  // Table header
  doc.setFillColor(30, 41, 59);
  doc.rect(40, y, pageWidth - 80, 16, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('BUSINESS UNIT', 46, y + 11);
  doc.text('TOTAL SERVERS', 220, y + 11);
  doc.text('PATCHED', 310, y + 11);
  doc.text('NOTIFIED', 390, y + 11);
  doc.text('PROGRESS %', 470, y + 11);
  y += 16;

  buBreakdown.forEach((bu, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(40, y, pageWidth - 80, 15, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(bu.name, 46, y + 11);
    doc.text(String(bu.total), 220, y + 11);
    doc.text(String(bu.patched), 310, y + 11);
    doc.text(`${bu.communicated} / ${bu.total}`, 390, y + 11);
    const pct = bu.total > 0 ? Math.round((bu.patched / bu.total) * 100) : 0;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(pct === 100 ? 16 : 15, pct === 100 ? 185 : 23, pct === 100 ? 129 : 42);
    doc.text(`${pct}%`, 470, y + 11);
    y += 15;
  });

  // ---------------------------------------------------------
  // PAGE 3+: DETAILED HOST TRIAGE & REMEDIATION INVENTORY
  // ---------------------------------------------------------
  doc.addPage();
  y = 40;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('3. Detailed Host Triage & Remediation Inventory', 40, y);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Comprehensive audit list of all ${affectedList.length} infrastructure systems in scope`, 40, y + 14);

  y += 24;

  const drawTableHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(40, y, pageWidth - 80, 18, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('HOST / VM', 45, y + 12);
    doc.text('PRIMARY IP', 175, y + 12);
    doc.text('BU / PRODUCT', 255, y + 12);
    doc.text('TRIAGE STATUS', 370, y + 12);
    doc.text('ENGINEER / TICKET', 450, y + 12);
    y += 18;
  };

  drawTableHeader();

  affectedList.forEach((s, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. Detailed Host Triage Inventory (Continued)', 40, y);
      y += 16;
      drawTableHeader();
    }

    const d = hostDetails[s.id] || {};
    const isPatched = d.status === 'Patched' || d.status === 'Patch';

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.rect(40, y, pageWidth - 80, 22, 'F');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(s.host, 45, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`VM: ${s.vm}`, 45, y + 19);

    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(s.primary_ip_address, 175, y + 14);

    doc.text(`${s.business_unit}`, 255, y + 10);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(s.product, 255, y + 19);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    if (isPatched) {
      doc.setTextColor(16, 185, 129);
    } else if (d.status === 'Isolated') {
      doc.setTextColor(239, 68, 68);
    } else {
      doc.setTextColor(217, 119, 6);
    }
    doc.text(d.status || 'To be contacted', 370, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const engTicket = `${d.patch_engineer || 'Unassigned'}${d.ticket_number ? ' #' + d.ticket_number : ''}`;
    doc.text(engTicket.slice(0, 22), 450, y + 14);

    y += 22;
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `NexusInfra SOC Intelligence Console - Confidential Incident Report (${incident.incident_reference}) - Page ${i} of ${totalPages}`,
      40,
      822
    );
  }

  return doc;
}
