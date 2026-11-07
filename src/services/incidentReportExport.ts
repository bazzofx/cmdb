// Shared incident report export: Markdown, Word and PDF.
// Both the active triage page and the archive used to duplicate these handlers.

import type { ReportData } from './incidentReportGenerator.js';
import {
  generateMarkdownReport,
  generatePdfReport,
  generateWordDocx,
} from './incidentReportGenerator.js';
import { downloadBlob, downloadText } from '../utils/export.js';

export type IncidentReportFormat = 'markdown' | 'word' | 'pdf';

export async function exportIncidentReport(
  payload: ReportData,
  format: IncidentReportFormat
): Promise<void> {
  const base = `incident_${payload.incident.incident_reference}_report`;

  if (format === 'markdown') {
    downloadText(`${base}.md`, generateMarkdownReport(payload), 'text/markdown;charset=utf-8');
    return;
  }

  if (format === 'pdf') {
    const doc = generatePdfReport(payload);
    downloadBlob(`${base}.pdf`, doc.output('blob'));
    return;
  }

  const blob = await generateWordDocx(payload);
  downloadBlob(`${base}.docx`, blob);
}
