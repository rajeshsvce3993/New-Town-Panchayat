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

/**
 * Renders an HTML table with full Unicode & Tamil font support and converts it to high-res PDF
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

  // Create temporary container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = landscape ? '1120px' : '820px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.padding = '32px 36px';
  container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Tamil', 'Latha', 'Mukta Malar', sans-serif";
  container.style.boxSizing = 'border-box';
  container.style.zIndex = '-9999';

  // Build metadata items HTML
  const metadataHtml = metadata.length > 0 ? `
    <div style="display: grid; grid-template-columns: repeat(${Math.min(metadata.length, 3)}, 1fr); gap: 10px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
      ${metadata.map(m => `
        <div style="font-size: 11px; line-height: 1.4;">
          <span style="font-weight: 700; color: #475569;">${m.label}:</span>
          <span style="color: #0f172a; font-weight: 600; margin-left: 4px;">${m.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  // Build Table HTML
  const theadHtml = `
    <thead>
      <tr style="background-color: #1e3a8a; color: #ffffff;">
        ${headers.map((h, i) => `
          <th style="padding: 8px 10px; font-size: 10.5px; font-weight: 700; border: 1px solid #0f172a; text-align: ${i === headers.length - 1 && typeof rows[0]?.[i] === 'number' ? 'right' : 'left'}; white-space: normal; line-height: 1.3;">
            ${h}
          </th>
        `).join('')}
      </tr>
    </thead>
  `;

  const tbodyHtml = `
    <tbody>
      ${rows.map((row, rIdx) => `
        <tr style="background-color: ${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          ${row.map((cell, cIdx) => `
            <td style="padding: 6.5px 10px; font-size: 10px; border: 1px solid #cbd5e1; color: #1e293b; text-align: ${cIdx === row.length - 1 && typeof cell === 'number' ? 'right' : 'left'}; line-height: 1.35;">
              ${cell !== null && cell !== undefined ? cell : '-'}
            </td>
          `).join('')}
        </tr>
      `).join('')}
      ${totalRow ? `
        <tr style="background-color: #e2e8f0; font-weight: 700;">
          ${totalRow.map((cell, cIdx) => `
            <td style="padding: 7px 10px; font-size: 10.5px; border: 1px solid #94a3b8; color: #0f172a; font-weight: 800; text-align: ${cIdx === totalRow.length - 1 ? 'right' : 'left'};">
              ${cell}
            </td>
          `).join('')}
        </tr>
      ` : ''}
    </tbody>
  `;

  container.innerHTML = `
    <div style="width: 100%; box-sizing: border-box;">
      <div style="border-bottom: 2px solid #1e3a8a; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #0284c7; letter-spacing: 0.5px; margin-bottom: 3px;">
            ${departmentHeader}
          </div>
          <h1 style="font-size: 18px; font-weight: 800; color: #1e3a8a; margin: 0; line-height: 1.2;">
            ${title}
          </h1>
          ${subtitle ? `
            <p style="font-size: 10.5px; color: #64748b; margin: 3px 0 0 0;">
              ${subtitle}
            </p>
          ` : ''}
        </div>
        <div style="text-align: right; font-size: 9.5px; color: #64748b; line-height: 1.3;">
          <div>${lang === 'ta' ? 'அறிக்கை உருவாக்கப்பட்ட தேதி' : 'Generated on'}:</div>
          <div style="font-weight: 700; color: #1e293b;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)</div>
        </div>
      </div>

      ${metadataHtml}

      <table style="width: 100%; border-collapse: collapse; margin-top: 6px;">
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <div style="margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
        <span>${lang === 'ta' ? 'கள ஆய்வு மேலாண்மை அமைப்பு (EMS)' : 'Field Inspection Management System'}</span>
        <span>${lang === 'ta' ? 'பக்கம் 1' : 'Page 1'}</span>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    if (typeof document !== 'undefined' && (document as any).fonts && (document as any).fonts.ready) {
      await (document as any).fonts.ready;
    }
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const orientation = landscape ? 'l' : 'p';
    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    if (returnBlob) {
      const blob = pdf.output('blob');
      return { blob, filename };
    } else {
      pdf.save(filename);
      return true;
    }
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

    const ws = XLSX.utils.aoa_to_sheet(s.data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  XLSX.writeFile(wb, filename);
}
