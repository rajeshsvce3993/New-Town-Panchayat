import { jsPDF } from 'jspdf';
import { JpegPptxDeck } from '@/lib/slideDeckExport';
import {
  extractSlideFields,
  extractSlidePhotos,
  slideHeadline,
  type SlideLang,
} from '@/lib/inspectionSlideContent';

type Theme = 'dark' | 'light';

const W = 1280;
const H = 720;

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${line} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) line = next;
    else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) break;
    }
  }
  if (lines.length < maxLines) lines.push(line);
  else lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawContainedImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = Number((img as any).width || (img as any).naturalWidth || w);
  const ih = Number((img as any).height || (img as any).naturalHeight || h);
  const scale = Math.min(w / Math.max(iw, 1), h / Math.max(ih, 1));
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

export async function renderInspectionSlideJpeg(opts: {
  work: any;
  index: number;
  total: number;
  lang: SlideLang;
  theme: Theme;
  fields: any[];
  loadImage: (url: string) => Promise<CanvasImageSource | null>;
}): Promise<string> {
  const { work, index, total, lang, theme, fields, loadImage } = opts;
  const dark = theme !== 'light';
  const photos = extractSlidePhotos(work, fields, lang).slice(0, 2);
  const details = extractSlideFields(work, fields, lang);
  const head = slideHeadline(work, lang);
  const images = await Promise.all(photos.map((p) => loadImage(p.url)));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create slide canvas');

  ctx.fillStyle = dark ? '#020617' : '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
  ctx.fillRect(0, 0, W, 86);
  ctx.fillStyle = '#0e7490';
  ctx.fillRect(0, 86, W, 3);

  ctx.fillStyle = '#0e7490';
  roundRect(ctx, 18, 22, 92, 42, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px Inter, "Noto Sans Tamil", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${index + 1}/${total}`, 64, 43);

  ctx.textAlign = 'left';
  ctx.fillStyle = dark ? '#e2e8f0' : '#0f172a';
  ctx.font = '800 16px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(head.inspector, 128, 36);
  ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
  ctx.font = '600 12px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(`${head.designation}  •  ${head.workId}`, 128, 58);

  ctx.textAlign = 'right';
  ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';
  ctx.font = '800 18px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(`${head.subject}  •  ${head.category}`, W - 24, 36);
  ctx.fillStyle = dark ? '#cbd5e1' : '#334155';
  ctx.font = '700 12px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(
    [head.tp, head.ward, head.street, head.time, head.gps ? `GPS ${head.gps}` : '']
      .filter(Boolean)
      .join('  •  '),
    W - 24,
    62
  );

  const photoX = 18;
  const photoY = 106;
  const photoW = 740;
  const photoH = 594;
  ctx.fillStyle = dark ? '#020617' : '#e2e8f0';
  roundRect(ctx, photoX, photoY, photoW, photoH, 16);
  ctx.fill();

  if (!photos.length) {
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '700 16px Inter, "Noto Sans Tamil", sans-serif';
    ctx.fillText(lang === 'ta' ? 'புகைப்படம் இல்லை' : 'NO PHOTO', photoX + photoW / 2, photoY + photoH / 2);
  } else {
    const cols = photos.length === 1 ? 1 : 2;
    const cellW = (photoW - 20 - (cols - 1) * 10) / cols;
    photos.forEach((p, i) => {
      const x = photoX + 10 + i * (cellW + 10);
      const y = photoY + 10;
      const imgH = photoH - 64;
      ctx.fillStyle = '#000000';
      roundRect(ctx, x, y, cellW, imgH, 10);
      ctx.fill();
      ctx.save();
      roundRect(ctx, x, y, cellW, imgH, 10);
      ctx.clip();
      if (images[i]) drawContainedImage(ctx, images[i] as CanvasImageSource, x, y, cellW, imgH);
      ctx.restore();
      ctx.fillStyle = '#FBBF24';
      roundRect(ctx, x, y + imgH, cellW, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#7F1D1D';
      ctx.textAlign = 'center';
      ctx.font = '800 12px Inter, "Noto Sans Tamil", sans-serif';
      ctx.fillText(p.label, x + cellW / 2, y + imgH + 18);
    });
  }

  const tableX = 778;
  const tableY = 106;
  const tableW = 484;
  const tableH = 594;
  ctx.fillStyle = dark ? '#0f172a' : '#ffffff';
  roundRect(ctx, tableX, tableY, tableW, tableH, 16);
  ctx.fill();
  ctx.strokeStyle = dark ? '#1e293b' : '#e2e8f0';
  ctx.lineWidth = 1;
  roundRect(ctx, tableX, tableY, tableW, tableH, 16);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = dark ? '#fbbf24' : '#0f172a';
  ctx.font = '800 13px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(lang === 'ta' ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE', tableX + 16, tableY + 28);

  ctx.fillStyle = dark ? '#1e293b' : '#e2e8f0';
  ctx.fillRect(tableX + 12, tableY + 42, tableW - 24, 28);
  ctx.fillStyle = dark ? '#fde68a' : '#0f172a';
  ctx.font = '800 11px Inter, "Noto Sans Tamil", sans-serif';
  ctx.fillText(lang === 'ta' ? 'தலைப்புகள்' : 'HEADINGS', tableX + 20, tableY + 60);
  ctx.fillText(lang === 'ta' ? 'விவரங்கள்' : 'DETAILS', tableX + 260, tableY + 60);

  const rowH = 28;
  details.slice(0, 16).forEach((row, i) => {
    const y = tableY + 72 + i * rowH;
    ctx.fillStyle = i % 2 === 0 ? (dark ? '#020617' : '#f8fafc') : (dark ? '#0b1220' : '#ffffff');
    ctx.fillRect(tableX + 12, y, tableW - 24, rowH);
    ctx.fillStyle = dark ? '#93c5fd' : '#1e3a8a';
    ctx.font = '700 11px Inter, "Noto Sans Tamil", sans-serif';
    ctx.fillText(wrapText(ctx, row.label, 230, 1)[0], tableX + 20, y + 18);
    ctx.fillStyle = dark ? '#f8fafc' : '#0f172a';
    ctx.font = '800 11px Inter, "Noto Sans Tamil", sans-serif';
    ctx.fillText(wrapText(ctx, row.value, 190, 1)[0], tableX + 260, y + 18);
  });

  if (!details.length) {
    ctx.fillStyle = dark ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '600 13px Inter, "Noto Sans Tamil", sans-serif';
    ctx.fillText(
      lang === 'ta' ? 'புல விவரங்கள் இல்லை' : 'NO FIELD DETAILS',
      tableX + tableW / 2,
      tableY + tableH / 2
    );
  }

  return canvas.toDataURL('image/jpeg', 0.8);
}

export async function buildInspectionSlidesFile(opts: {
  works: any[];
  lang: SlideLang;
  theme: Theme;
  fields: any[];
  format: 'pdf' | 'ppt';
  filename: string;
  loadImage: (url: string) => Promise<CanvasImageSource | null>;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const { works, lang, theme, fields, format, filename, loadImage, onProgress } = opts;
  if (!works.length) throw new Error('No slides to export');
  const pptx = format === 'ppt' ? new JpegPptxDeck() : null;
  let pdf: jsPDF | null = null;
  let orient: 'l' | 'p' = 'l';
  let done = 0;
  const chunkSize = 4;

  for (let start = 0; start < works.length; start += chunkSize) {
    const chunk = works.slice(start, start + chunkSize);
    const frames = await Promise.all(
      chunk.map((work, offset) =>
        renderInspectionSlideJpeg({
          work,
          index: start + offset,
          total: works.length,
          lang,
          theme,
          fields,
          loadImage,
        })
      )
    );
    for (const jpeg of frames) {
      if (format === 'ppt') {
        pptx?.addSlide(jpeg);
      } else if (!pdf) {
        const probe = new jsPDF();
        const props = probe.getImageProperties(jpeg);
        orient = props.width >= props.height ? 'l' : 'p';
        pdf = new jsPDF({ orientation: orient, unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const ratio = Math.min(pageW / props.width, pageH / props.height);
        pdf.addImage(
          jpeg,
          'JPEG',
          (pageW - props.width * ratio) / 2,
          (pageH - props.height * ratio) / 2,
          props.width * ratio,
          props.height * ratio
        );
      } else {
        pdf.addPage('a4', orient);
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const props = pdf.getImageProperties(jpeg);
        const ratio = Math.min(pageW / props.width, pageH / props.height);
        pdf.addImage(
          jpeg,
          'JPEG',
          (pageW - props.width * ratio) / 2,
          (pageH - props.height * ratio) / 2,
          props.width * ratio,
          props.height * ratio
        );
      }
      done += 1;
      onProgress?.(done, works.length);
    }
  }

  if (format === 'ppt') {
    await pptx!.save(filename.endsWith('.pptx') ? filename : `${filename}.pptx`);
    return;
  }
  if (!pdf) throw new Error('No slides captured');
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
