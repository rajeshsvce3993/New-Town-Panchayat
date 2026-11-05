import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export interface HeaderMetaItem {
  label: string;
  value: string;
}

export interface HtmlPdfOptions {
  title: string;
  subtitle?: string;
  departmentHeader?: string;
  metadata?: HeaderMetaItem[];
  headers: string[];
  rows: (string | number)[][];
  totalRow?: (string | number)[];
  filename: string;
  landscape?: boolean;
  returnBlob?: boolean;
  lang?: 'ta' | 'en';
}

/**
 * Sanitize Excel worksheet name:
 * - Max 31 characters
 * - Characters \ / ? * : [ ] are not allowed
 */
export function sanitizeSheetName(name: string, fallback: string = 'Sheet'): string {
  if (!name || typeof name !== 'string') return fallback;
  let clean = name.replace(/[\\/?*:[\]]/g, '_').trim();
  if (clean.length > 31) {
    clean = clean.substring(0, 31);
  }
  return clean || fallback;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    if (link.parentNode) link.parentNode.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1500);
}

function escapePdfHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appendCanvasPages(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
  startNewPage: boolean
) {
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / Math.max(canvas.width, 1);
  const imgData = canvas.toDataURL('image/jpeg', 0.84);
  let heightLeft = imgHeight;
  let position = 0;
  let first = true;
  while (heightLeft > 0.4 || first) {
    if (startNewPage || !first) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
    position -= pageHeight;
    first = false;
    startNewPage = true;
    if (heightLeft <= 0.4) break;
  }
}

/**
 * Renders an HTML table with full Unicode & Tamil font support and converts it to high-res PDF.
 * Large registers are painted in row chunks so the canvas never exceeds browser limits.
 */
export async function generateHtmlTablePDF(options: HtmlPdfOptions): Promise<{ blob: Blob; filename: string } | boolean> {
  const {
    title,
    subtitle,
    departmentHeader = options.lang === 'ta' 
      ? 'தமிழ்நாடு அரசு • பேரூராட்சிகள் இயக்ககம்' 
      : 'Government of Tamil Nadu • Directorate of Town Panchayats',
    metadata = [],
    headers,
    rows,
    totalRow,
    filename,
    landscape = false,
    returnBlob = false,
    lang = 'en'
  } = options;

  if (typeof window === 'undefined') return false;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = landscape
    ? (headers.length > 12 ? '1440px' : '1120px')
    : '820px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.padding = '24px 28px';
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Mukta Malar', sans-serif";
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  const metadataHtml = metadata.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(${Math.min(metadata.length, 3)}, 1fr); gap: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      ${metadata.map(m => `
        <div style="font-size: 11px; line-height: 1.4;">
          <span style="font-weight: 700; color: #475569;">${escapePdfHtml(m.label)}:</span>
          <span style="color: #0f172a; font-weight: 600; margin-left: 4px;">${escapePdfHtml(m.value)}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  const theadHtml = `
    <thead>
      <tr style="background-color: #1e3a8a; color: #ffffff;">
        ${headers.map((h, i) => `
          <th style="padding: 8px 10px; font-size: 10.5px; font-weight: 700; border: 1px solid #0f172a; text-align: ${i === headers.length - 1 && typeof rows[0]?.[i] === 'number' ? 'right' : 'left'}; white-space: normal; line-height: 1.3;">
            ${escapePdfHtml(h)}
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const renderBody = (chunk: (string | number)[][], includeTotal: boolean) => `
    <tbody>
      ${chunk.map((row, rIdx) => `
        <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          ${row.map((cell, cIdx) => `
            <td style="padding: 6.5px 10px; font-size: 10px; border: 1px solid #cbd5e1; color: #1e293b; text-align: ${cIdx === row.length - 1 && typeof cell === 'number' ? 'right' : 'left'}; line-height: 1.35;">
              ${escapePdfHtml(cell !== null && cell !== undefined ? cell : '-')}
            </td>
          `).join('')}
        </tr>
      `).join('')}
      ${includeTotal && totalRow ? `
        <tr style="background-color: #e2e8f0; font-weight: 700;">
          ${totalRow.map((cell, cIdx) => `
            <td style="padding: 7px 10px; font-size: 10.5px; border: 1px solid #94a3b8; color: #0f172a; font-weight: 800; text-align: ${cIdx === totalRow.length - 1 ? 'right' : 'left'};">
              ${escapePdfHtml(cell)}
            </td>
          `).join('')}
        </tr>
      ` : ''}
    </tbody>
  `;

  const bannerHtml = `
    <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 3px;">
          ${escapePdfHtml(departmentHeader)}
        </div>
        <h1 style="font-size: 18px; font-weight: 800; color: #1e3a8a; margin: 0; line-height: 1.2;">
          ${escapePdfHtml(title)}
        </h1>
        ${subtitle ? `
          <p style="font-size: 10.5px; color: #64748b; margin: 3px 0 0 0;">
            ${escapePdfHtml(subtitle)}
          </p>
        ` : ''}
      </div>
      <div style="text-align: right; font-size: 9.5px; color: #64748b; line-height: 1.3;">
        <div>${lang === 'ta' ? 'அறிக்கை உருவாக்கப்பட்ட தேதி' : 'Generated on'}:</div>
        <div style="font-weight: 700; color: #1e293b;">${escapePdfHtml(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} (IST)</div>
      </div>
    </div>
    ${metadataHtml}
  `;

  document.body.appendChild(container);

  try {
    if (typeof document !== 'undefined' && (document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }

    const orientation = landscape ? 'l' : 'p';
    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const chunkSize = landscape ? 22 : 30;
    const totalChunks = Math.max(1, Math.ceil(rows.length / chunkSize));

    for (let i = 0; i < totalChunks; i++) {
      const chunk = rows.slice(i * chunkSize, (i + 1) * chunkSize);
      const isFirst = i === 0;
      const isLast = i === totalChunks - 1;
      container.innerHTML = `
        <div style="width: 100%; box-sizing: border-box;">
          ${isFirst ? bannerHtml : ''}
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
            ${theadHtml}
            ${renderBody(chunk, isLast)}
          </table>
          <div style="margin-top: 14px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
            <span>${lang === 'ta' ? 'கள ஆய்வு மேலாண்மை அமைப்பு (EMS)' : 'Field Inspection Management System'}</span>
            <span>${lang === 'ta' ? `பக்கம் ${i + 1}` : `Page ${i + 1}`}</span>
          </div>
        </div>
      `;
      const canvas = await html2canvas(container, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      if (i === 0) {
        appendCanvasPages(pdf, canvas, pageWidth, pageHeight, false);
      } else {
        appendCanvasPages(pdf, canvas, pageWidth, pageHeight, true);
      }
    }

    // jsPDF starts with a blank page; the first chunk fills it. Extra blank first page
    // is avoided because appendCanvasPages(startNewPage=false) draws on page 1.
    const blob = pdf.output('blob');
    if (returnBlob) {
      return { blob, filename };
    }
    triggerBrowserDownload(blob, filename);
    return true;
  } catch (err) {
    console.error('Failed to generate HTML PDF:', err);
    throw err;
  } finally {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Downloads a ZIP file containing multiple Blob items
 */
export async function downloadZipArchive(
  files: { filename: string; blob: Blob }[],
  zipFilename: string
) {
  const zip = new JSZip();
  files.forEach(f => {
    zip.file(f.filename, f.blob);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(content);
  link.download = zipFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Exports a multi-sheet Excel file
 */
export function exportMultiSheetExcel(
  sheets: { name: string; data: (string | number)[][] }[],
  filename: string
) {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  sheets.forEach((s, idx) => {
    let sheetName = sanitizeSheetName(s.name, `Sheet${idx + 1}`);
    // Ensure uniqueness
    if (usedNames.has(sheetName.toLowerCase())) {
      sheetName = sanitizeSheetName(`${sheetName.substring(0, 27)}_${idx + 1}`);
    }
    usedNames.add(sheetName.toLowerCase());

    const safeData = (s.data || []).map((row) =>
      (row || []).map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (typeof cell === 'number' && Number.isFinite(cell)) return cell;
        return String(cell);
      })
    );
    const ws = XLSX.utils.aoa_to_sheet(safeData);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  triggerBrowserDownload(
    new Blob([out], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
}
