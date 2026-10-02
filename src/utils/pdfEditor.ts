import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import { QuoteItem, QuoteRecord } from '../types';
import { createDocumentPDFFile } from './pdfGenerator';
import { DocumentType } from './messaging';

export interface PdfAnnotation {
  id: string;
  pageIndex: number; // 0-based
  type:
    | 'text'
    | 'whiteout'
    | 'stamp'
    | 'signature'
    | 'image'
    | 'highlight'
    | 'line'
    | 'rectangle'
    | 'freehand'
    | 'checkmark'
    | 'sticky'
    | 'link';
  // Position in normalized coordinates [0..1] relative to page width and height
  xPercent: number; // 0 to 1 (left to right)
  yPercent: number; // 0 to 1 (top to bottom)
  widthPercent?: number; // 0 to 1
  heightPercent?: number; // 0 to 1

  // Specific properties
  text?: string;
  fontSize?: number; // in points (e.g. 10, 12, 14, 18, 24)
  textColor?: string; // hex e.g. '#000000', '#dc2626'
  backgroundColor?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  fontFamily?: string;
  fontDisplayName?: string;

  // Track original text item covered by this annotation
  coveredTextId?: string;

  // Shapes & borders
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;

  // Link tool URL
  linkUrl?: string;

  // Stamp types: PAID, APPROVED, REVISED, VOID, TAX_INVOICE, HALO_SEAL
  stampType?: 'PAID' | 'APPROVED' | 'REVISED' | 'VOID' | 'TAX_INVOICE' | 'HALO_SEAL' | 'CUSTOM';
  stampText?: string;
  stampColor?: string;

  // Image / Signature / Freehand data URL
  imageDataUrl?: string;
}

let annotationIdCounter = 0;
/**
 * Generates a globally unique, collision-proof annotation ID.
 * Incorporates timestamp, high-resolution performance timer, incrementing counter, and random hash.
 */
export const generateUniqueAnnotationId = (): string => {
  annotationIdCounter += 1;
  const time = Date.now();
  const perf = typeof performance !== 'undefined' ? Math.round(performance.now() * 100) : 0;
  const rand = Math.random().toString(36).substring(2, 8);
  return `ann-${time}-${perf}-${annotationIdCounter}-${rand}`;
};

export interface StampPreset {
  id: string;
  label: string;
  text: string;
  color: string;
  borderColor: string;
  bgColor: string;
  rotation: number;
}

export const STAMP_PRESETS: StampPreset[] = [
  {
    id: 'PAID',
    label: 'PAID',
    text: 'PAID / 已付款',
    color: '#059669',
    borderColor: '#059669',
    bgColor: '#ecfdf5',
    rotation: -10,
  },
  {
    id: 'APPROVED',
    label: 'APPROVED',
    text: 'APPROVED / 审阅通过',
    color: '#2563eb',
    borderColor: '#2563eb',
    bgColor: '#eff6ff',
    rotation: -8,
  },
  {
    id: 'TAX_INVOICE',
    label: 'TAX INVOICE',
    text: 'TAX INVOICE / 正式发票',
    color: '#7c3aed',
    borderColor: '#7c3aed',
    bgColor: '#f5f3ff',
    rotation: 0,
  },
  {
    id: 'REVISED',
    label: 'REVISED',
    text: 'REVISED / 已修改重出',
    color: '#d97706',
    borderColor: '#d97706',
    bgColor: '#fffbeb',
    rotation: -8,
  },
  {
    id: 'URGENT',
    label: 'URGENT',
    text: 'URGENT / 加急制作',
    color: '#dc2626',
    borderColor: '#dc2626',
    bgColor: '#fef2f2',
    rotation: -12,
  },
  {
    id: 'VOID',
    label: 'VOID',
    text: 'VOID / 作废',
    color: '#b91c1c',
    borderColor: '#b91c1c',
    bgColor: '#fef2f2',
    rotation: -15,
  },
  {
    id: 'HALO_SEAL',
    label: 'HALO CHOP',
    text: 'HALO DESIGN HUB (UEN: 53142015M)',
    color: '#b91c1c',
    borderColor: '#b91c1c',
    bgColor: '#fff1f2',
    rotation: 0,
  },
];

/**
 * Converts a hex color string to pdf-lib rgb values (0..1)
 */
export const hexToRgb = (hex: string = '#000000'): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '');
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16) / 255;
    g = parseInt(clean.substring(2, 4), 16) / 255;
    b = parseInt(clean.substring(4, 6), 16) / 255;
  }
  return {
    r: isNaN(r) ? 0 : r,
    g: isNaN(g) ? 0 : g,
    b: isNaN(b) ? 0 : b,
  };
};

/**
 * Checks if a string contains non-ASCII characters (e.g. Chinese characters)
 */
export const hasNonAscii = (str: string): boolean => {
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-\u007F]/.test(str);
};

/**
 * Renders text or stamp into a PNG Data URL using Canvas for 100% Unicode and Chinese character support
 */
export const renderStampToDataUrl = (
  text: string,
  color: string,
  bgColor: string,
  fontSize: number = 16
): { dataUrl: string; width: number; height: number } => {
  if (typeof document === 'undefined') return { dataUrl: '', width: 0, height: 0 };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const scale = 3; // High DPI for crisp vector-like quality in PDF
  const fontStyle = `bold ${fontSize * scale}px "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.font = fontStyle;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const paddingX = 20 * scale;
  const paddingY = 10 * scale;
  const width = Math.ceil(textWidth + paddingX * 2);
  const height = Math.ceil(fontSize * scale + paddingY * 2);

  canvas.width = width;
  canvas.height = height;

  ctx.font = fontStyle;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Double border for authentic rubber stamp look
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 * scale;
  ctx.strokeRect(3 * scale, 3 * scale, width - 6 * scale, height - 6 * scale);

  ctx.lineWidth = 1 * scale;
  ctx.strokeRect(6 * scale, 6 * scale, width - 12 * scale, height - 12 * scale);

  // Text
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: width / scale,
    height: height / scale,
  };
};

/**
 * Renders arbitrary text to a high-DPI PNG Data URL to guarantee full Unicode (Chinese, English, etc.) support
 * and automatically preserve the original font family, weight, and italic slant
 */
export const renderTextToDataUrl = (
  text: string,
  color: string = '#000000',
  fontSize: number = 12,
  isBold: boolean = false,
  isItalic: boolean = false,
  fontFamily: string = 'Arial, "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  backgroundColor?: string,
  isUnderline: boolean = false,
  targetBoxHeight?: number
): { dataUrl: string; width: number; height: number } => {
  if (typeof document === 'undefined') return { dataUrl: '', width: 0, height: 0 };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const scale = 3;
  const effectiveFont = fontFamily || 'Arial, "Segoe UI", -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize * scale}px ${effectiveFont}`;
  
  // Measure text width using exact font style
  ctx.font = fontStyle;
  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;

  // Exact height strictly matching the target box height, or font-proportional height
  const boxHPt = targetBoxHeight && targetBoxHeight > 0 ? targetBoxHeight : Math.max(8, fontSize * 1.15);
  const canvasHeight = Math.ceil(boxHPt * scale);
  
  // Padding matching screen CSS px-0.5 / px-1 (1pt padding)
  const padLeft = 1 * scale;
  const padRight = 2 * scale;
  const canvasWidth = Math.ceil(textWidth + padLeft + padRight);

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // Setting canvas width/height resets context state, re-apply:
  ctx.font = fontStyle;
  ctx.textBaseline = 'middle';

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.fillStyle = color;
  ctx.fillText(text, padLeft, canvasHeight / 2);

  if (isUnderline) {
    ctx.fillStyle = color;
    const lineY = Math.min(canvasHeight - 2 * scale, Math.floor(canvasHeight / 2 + (fontSize * scale) / 2.2));
    ctx.fillRect(padLeft, lineY, textWidth, Math.max(2, Math.floor(1.5 * scale)));
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvasWidth / scale,
    height: boxHPt,
  };
};

/**
 * Renders an authentic cursive calligraphy signature to PNG Data URL
 */
export const generateSignatureDataUrl = (
  name: string,
  color: string = '#0f172a',
  style: 'script' | 'cursive' | 'formal' = 'script'
): { dataUrl: string; width: number; height: number } => {
  if (typeof document === 'undefined') return { dataUrl: '', width: 0, height: 0 };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', width: 0, height: 0 };

  const scale = 3;
  const rawW = 320;
  const rawH = 110;
  canvas.width = rawW * scale;
  canvas.height = rawH * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let font = `italic ${38 * scale}px "Brush Script MT", "Segoe Script", "Caveat", "Dancing Script", cursive`;
  if (style === 'script') {
    font = `italic ${42 * scale}px "Caveat", "Great Vibes", "Brush Script MT", "Segoe Script", cursive`;
  } else if (style === 'formal') {
    font = `italic bold ${34 * scale}px "Snell Roundhand", "Apple Chancery", "Bickham Script Pro", "Brush Script MT", cursive`;
  }

  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = name.trim() || 'Authorized Signature';
  ctx.fillText(text, (rawW * scale) / 2, (rawH * scale) / 2 - 8 * scale);

  // Handwritten ink flourish underline
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const startX = Math.max(20 * scale, ((rawW * scale) - textWidth) / 2);
  const endX = Math.min((rawW * scale) - 20 * scale, startX + textWidth + 24 * scale);
  const lineY = (rawH * scale) / 2 + 18 * scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, lineY);
  ctx.quadraticCurveTo((rawW * scale) / 2, lineY - 6 * scale, endX, lineY + 3 * scale);
  ctx.stroke();

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: rawW,
    height: rawH,
  };
};

/**
 * Reads a File object as ArrayBuffer
 */
export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export interface PdfEditOptions {
  rotations?: Record<number, number>; // pageIndex -> rotation degrees (0, 90, 180, 270)
  watermarkText?: string;
  watermarkColor?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;
  watermarkFontSize?: number;
  watermarkLayout?: 'center' | 'tiled';
  deletePages?: number[]; // list of 0-based page indices to remove
  addBlankPage?: boolean;
  pageOrder?: number[]; // list of page indices in new sequence
}

/**
 * Gets page count of an arbitrary PDF
 */
export const getPdfPageCount = async (pdfBytes: ArrayBuffer | Uint8Array): Promise<number> => {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    return pdfDoc.getPageCount();
  } catch (err) {
    console.warn('Could not read page count of PDF:', err);
    return 1;
  }
};

/**
 * Creates a clean blank A4 PDF page
 */
export const createBlankA4PdfBytes = async (): Promise<ArrayBuffer> => {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595.28, 841.89]); // A4 in points
  const bytes = await pdfDoc.save();
  return bytes.buffer as ArrayBuffer;
};

/**
 * Generates fresh PDF ArrayBuffer for a Halo Quote, Invoice or Receipt
 */
export const generateHaloPdfBytes = async (
  items: QuoteItem[],
  data: Partial<QuoteRecord> = {},
  docType: DocumentType = 'quote',
  grandTotal: number = 0,
  discountAmount: number = 0,
  finalTotal: number = 0
): Promise<ArrayBuffer> => {
  const output = createDocumentPDFFile(
    docType,
    items,
    data,
    grandTotal,
    discountAmount,
    finalTotal
  );

  return await output.blob.arrayBuffer();
};

/**
 * Applies visual annotations, whiteouts, text, stamps, signatures, rotations and watermarks to any PDF
 */
export const applyPdfAnnotations = async (
  pdfBytes: ArrayBuffer | Uint8Array,
  annotations: PdfAnnotation[] = [],
  options: PdfEditOptions = {}
): Promise<Uint8Array> => {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

  // Optional: Add blank page if requested
  if (options.addBlankPage) {
    pdfDoc.addPage([595.28, 841.89]);
  }

  // Optional: Delete pages (sorted descending so indices don't shift)
  if (options.deletePages && options.deletePages.length > 0) {
    const toDelete = Array.from(new Set(options.deletePages))
      .filter(p => p >= 0 && p < pdfDoc.getPageCount())
      .sort((a, b) => b - a);

    // Keep at least one page
    if (toDelete.length < pdfDoc.getPageCount()) {
      for (const pIdx of toDelete) {
        pdfDoc.removePage(pIdx);
      }
    }
  }

  let finalPdfDoc = pdfDoc;
  if (options.pageOrder && options.pageOrder.length > 0) {
    const validIndices = options.pageOrder.filter(idx => idx >= 0 && idx < pdfDoc.getPageCount());
    if (validIndices.length === pdfDoc.getPageCount()) {
      const reorderedDoc = await PDFDocument.create();
      const copied = await reorderedDoc.copyPages(pdfDoc, validIndices);
      copied.forEach(p => reorderedDoc.addPage(p));
      finalPdfDoc = reorderedDoc;
    }
  }

  const pages = finalPdfDoc.getPages();
  const totalPages = pages.length;

  // Apply page rotations if requested
  if (options.rotations) {
    for (const [pageIdxStr, rotDeg] of Object.entries(options.rotations)) {
      const pIdx = parseInt(pageIdxStr, 10);
      if (pIdx >= 0 && pIdx < totalPages) {
        pages[pIdx].setRotation(degrees(rotDeg));
      }
    }
  }

  // Load standard fonts as fallback for pure ASCII text
  const helveticaFont = await finalPdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await finalPdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Apply global watermark if requested
  if (options.watermarkText && options.watermarkText.trim()) {
    const wmText = options.watermarkText.trim();
    const wmColor = options.watermarkColor || '#94a3b8';
    const wmOpacity = options.watermarkOpacity ?? 0.25;
    const wmRotation = options.watermarkRotation ?? 45;
    const wmFontSize = options.watermarkFontSize || 48;
    const wmLayout = options.watermarkLayout || 'center';

    // Render watermark via high-resolution PNG dataUrl for full Unicode/Chinese support and crisp rotation
    const { dataUrl, width, height } = renderTextToDataUrl(
      wmText,
      wmColor,
      wmFontSize,
      true,
      false,
      'Arial, "Segoe UI", sans-serif'
    );

    if (dataUrl) {
      try {
        const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
        const embedded = await finalPdfDoc.embedPng(imgBytes);
        const rad = (wmRotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        for (const page of pages) {
          const pw = page.getWidth();
          const ph = page.getHeight();

          if (wmLayout === 'tiled') {
            // Draw a repeating grid of watermarks (4 rows x 3 columns)
            const rows = 4;
            const cols = 3;
            const tileW = width * 0.55;
            const tileH = height * 0.55;

            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const cx = (pw * (c + 0.5)) / cols;
                const cy = (ph * (r + 0.5)) / rows;
                const x = cx - ((tileW / 2) * cos - (tileH / 2) * sin);
                const y = cy - ((tileW / 2) * sin + (tileH / 2) * cos);

                page.drawImage(embedded, {
                  x,
                  y,
                  width: tileW,
                  height: tileH,
                  opacity: Math.min(1, wmOpacity * 0.85),
                  rotate: degrees(wmRotation),
                });
              }
            }
          } else {
            // Center single large watermark with accurate rotation around center
            const cx = pw / 2;
            const cy = ph / 2;
            const x = cx - ((width / 2) * cos - (height / 2) * sin);
            const y = cy - ((width / 2) * sin + (height / 2) * cos);

            page.drawImage(embedded, {
              x,
              y,
              width,
              height,
              opacity: wmOpacity,
              rotate: degrees(wmRotation),
            });
          }
        }
      } catch (e) {
        console.warn('Could not draw watermark image', e);
      }
    }
  }

  // Apply annotations
  if (annotations && annotations.length > 0) {
    for (const ann of annotations) {
      const targetPageIdx = Math.max(0, Math.min(totalPages - 1, ann.pageIndex || 0));
      const page = pages[targetPageIdx];
      const pageWidth = page.getWidth();
      const pageHeight = page.getHeight();

      // Convert normalized (0..1) percentage coordinates to PDF points
      // Note: PDF y=0 is at bottom, while screen y=0 is at top
      const pdfX = Math.max(0, Math.min(pageWidth, ann.xPercent * pageWidth));
      const pdfY = Math.max(0, Math.min(pageHeight, pageHeight - ann.yPercent * pageHeight));

      if (ann.type === 'whiteout') {
        const defaultBoxH = Math.max(8, (ann.fontSize || 12) * 1.15);
        const boxH = Math.max(8, ann.heightPercent ? ann.heightPercent * pageHeight : defaultBoxH);
        const minBoxW = (ann.widthPercent || 0.15) * pageWidth;

        // Optional replacement text inside whiteout box
        if (ann.text) {
          const size = ann.fontSize || 12;
          const { dataUrl, width } = renderTextToDataUrl(
            ann.text,
            ann.textColor || '#000000',
            size,
            ann.isBold,
            ann.isItalic,
            ann.fontFamily,
            undefined,
            ann.isUnderline,
            boxH
          );

          const finalBoxW = Math.max(minBoxW, width + 1);

          // 1. Draw pure white rectangle covering old text / typo
          page.drawRectangle({
            x: pdfX,
            y: pdfY - boxH,
            width: finalBoxW,
            height: boxH,
            color: rgb(1, 1, 1),
          });

          // 2. Draw replacement text perfectly aligned with 0 vertical jump
          if (dataUrl) {
            try {
              const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
              const img = await finalPdfDoc.embedPng(imgBytes);
              page.drawImage(img, {
                x: pdfX,
                y: pdfY - boxH,
                width: width,
                height: boxH,
              });
            } catch (e) {
              console.warn('Could not draw whiteout replacement text', e);
            }
          }
        } else {
          // Empty whiteout box
          page.drawRectangle({
            x: pdfX,
            y: pdfY - boxH,
            width: minBoxW,
            height: boxH,
            color: rgb(1, 1, 1),
          });
        }
      } else if (ann.type === 'highlight') {
        const boxW = (ann.widthPercent || 0.2) * pageWidth;
        const boxH = (ann.heightPercent || 0.035) * pageHeight;
        const bgRgb = hexToRgb(ann.backgroundColor || '#fef08a');
        page.drawRectangle({
          x: pdfX,
          y: pdfY - boxH,
          width: boxW,
          height: boxH,
          color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          opacity: 0.45,
        });
      } else if (ann.type === 'rectangle') {
        const boxW = (ann.widthPercent || 0.15) * pageWidth;
        const boxH = (ann.heightPercent || 0.08) * pageHeight;
        const strokeRgb = hexToRgb(ann.strokeColor || ann.textColor || '#000000');
        const hasFill = ann.fillColor && ann.fillColor !== 'transparent';
        const fillRgb = hasFill ? hexToRgb(ann.fillColor!) : undefined;
        page.drawRectangle({
          x: pdfX,
          y: pdfY - boxH,
          width: boxW,
          height: boxH,
          borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
          borderWidth: ann.strokeWidth || 2,
          color: fillRgb ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined,
        });
      } else if (ann.type === 'line') {
        const lineW = (ann.widthPercent || 0.2) * pageWidth;
        const strokeRgb = hexToRgb(ann.strokeColor || ann.textColor || '#000000');
        page.drawLine({
          start: { x: pdfX, y: pdfY },
          end: { x: pdfX + lineW, y: pdfY },
          thickness: ann.strokeWidth || 2,
          color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
        });
      } else if (ann.type === 'checkmark') {
        const size = ann.fontSize || 20;
        const { dataUrl, width, height } = renderTextToDataUrl(
          '✓',
          ann.textColor || '#16a34a',
          size,
          true
        );
        if (dataUrl) {
          try {
            const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
            const img = await finalPdfDoc.embedPng(imgBytes);
            page.drawImage(img, {
              x: pdfX,
              y: pdfY - height,
              width: width,
              height: height,
            });
          } catch (e) {
            console.warn('Could not embed checkmark in PDF', e);
          }
        }
      } else if (ann.type === 'text' && ann.text) {
        const size = ann.fontSize || 12;
        const boxH = Math.max(8, ann.heightPercent ? ann.heightPercent * pageHeight : size * 1.15);
        const { dataUrl, width } = renderTextToDataUrl(
          ann.text,
          ann.textColor || '#000000',
          size,
          ann.isBold,
          ann.isItalic,
          ann.fontFamily,
          ann.backgroundColor,
          ann.isUnderline,
          boxH
        );
        if (dataUrl) {
          try {
            const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
            const img = await finalPdfDoc.embedPng(imgBytes);
            page.drawImage(img, {
              x: pdfX,
              y: pdfY - boxH,
              width: width,
              height: boxH,
            });
          } catch (e) {
            console.warn('Could not embed text in PDF', e);
          }
        }
      } else if (ann.type === 'stamp') {
        const preset = STAMP_PRESETS.find(p => p.id === ann.stampType) || {
          id: 'CUSTOM',
          label: ann.stampText || 'STAMP',
          text: ann.stampText || 'APPROVED',
          color: ann.stampColor || '#059669',
          borderColor: ann.stampColor || '#059669',
          bgColor: '#ecfdf5',
          rotation: -10,
        };

        const stampText = ann.stampText || preset.text;
        const color = ann.stampColor || preset.color;
        const bgColor = preset.bgColor;
        const fontSize = ann.fontSize || 15;

        // Render stamps as high-resolution PNG image to guarantee 100% Unicode & Chinese support
        const { dataUrl, width, height } = renderStampToDataUrl(stampText, color, bgColor, fontSize);
        if (dataUrl) {
          try {
            const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
            const img = await finalPdfDoc.embedPng(imgBytes);
            page.drawImage(img, {
              x: pdfX,
              y: pdfY - height,
              width: width,
              height: height,
              rotate: degrees(preset.rotation),
            });
          } catch (e) {
            console.warn('Could not embed stamp in PDF', e);
          }
        }
      } else if ((ann.type === 'signature' || ann.type === 'image' || ann.type === 'freehand') && ann.imageDataUrl) {
        try {
          const imageBytes = await fetch(ann.imageDataUrl).then(res => res.arrayBuffer());
          let embeddedImage;
          if (ann.imageDataUrl.includes('image/png') || ann.imageDataUrl.startsWith('data:image/png')) {
            embeddedImage = await finalPdfDoc.embedPng(imageBytes);
          } else {
            embeddedImage = await finalPdfDoc.embedJpg(imageBytes);
          }

          const targetW = (ann.widthPercent || 0.22) * pageWidth;
          const targetH = (ann.heightPercent || 0.18) * pageHeight;
          const naturalW = embeddedImage.width;
          const naturalH = embeddedImage.height;

          // Object-contain aspect ratio calculation matching screen CSS:
          // Strictly preserves the original image aspect ratio without deformation/stretching!
          const imgAspect = naturalW / naturalH;
          const boxAspect = targetW / targetH;

          let drawW = targetW;
          let drawH = targetH;
          let drawX = pdfX;
          let drawY = pdfY - targetH;

          if (boxAspect > imgAspect) {
            // Box is wider than image: fit height, center horizontally
            drawW = targetH * imgAspect;
            drawH = targetH;
            drawX = pdfX + (targetW - drawW) / 2;
            drawY = pdfY - targetH;
          } else {
            // Box is taller than image: fit width, center vertically
            drawW = targetW;
            drawH = targetW / imgAspect;
            drawX = pdfX;
            drawY = (pdfY - targetH) + (targetH - drawH) / 2;
          }

          page.drawImage(embeddedImage, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        } catch (err) {
          console.warn('Could not embed signature/image in PDF:', err);
        }
      } else if (ann.type === 'sticky') {
        const noteW = (ann.widthPercent || 0.16) * pageWidth;
        const noteH = (ann.heightPercent || 0.08) * pageHeight;
        const bgRgb = hexToRgb(ann.backgroundColor || '#fef08a');
        page.drawRectangle({
          x: pdfX,
          y: pdfY - noteH,
          width: noteW,
          height: noteH,
          color: rgb(bgRgb.r, bgRgb.g, bgRgb.b),
          borderColor: rgb(0.85, 0.75, 0.2),
          borderWidth: 1,
        });
        if (ann.text) {
          const { dataUrl, width, height } = renderTextToDataUrl(
            ann.text,
            '#422006',
            9,
            false,
            false,
            'Arial, sans-serif'
          );
          if (dataUrl) {
            try {
              const imgBytes = await fetch(dataUrl).then(r => r.arrayBuffer());
              const img = await finalPdfDoc.embedPng(imgBytes);
              page.drawImage(img, {
                x: pdfX + 4,
                y: pdfY - noteH + Math.max(0, (noteH - height) / 2),
                width: Math.min(width, noteW - 8),
                height: Math.min(height, noteH - 4),
              });
            } catch (e) {
              console.warn('Could not draw sticky note text', e);
            }
          }
        }
      } else if (ann.type === 'link') {
        const boxW = (ann.widthPercent || 0.15) * pageWidth;
        const boxH = (ann.heightPercent || 0.04) * pageHeight;
        // Subtle blue indicator box for link
        page.drawRectangle({
          x: pdfX,
          y: pdfY - boxH,
          width: boxW,
          height: boxH,
          borderColor: rgb(0.15, 0.45, 0.95),
          borderWidth: 1,
          color: rgb(0.85, 0.92, 1.0),
          opacity: 0.2,
        });
      }
    }
  }

  return await finalPdfDoc.save();
};

/**
 * Downloads a Uint8Array or Blob as a PDF file
 */
export const downloadPdfBytes = (bytes: Uint8Array | Blob, filename: string): void => {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

/**
 * Creates an object URL from PDF bytes for iframe or preview
 */
export const createPdfUrl = (bytes: Uint8Array | ArrayBuffer | Blob): string => {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

/**
 * Parses user input page range strings like "1-3, 5, 8-10" into sorted 0-based page index array
 */
export const parsePageRange = (rangeStr: string, totalPages: number): number[] => {
  const indices = new Set<number>();
  const clean = rangeStr.trim();
  if (!clean) return [];

  const parts = clean.split(/[,，\s]+/);
  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        indices.add(page - 1);
      }
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
};

export interface PdfJoinItem {
  id: string;
  name: string;
  bytes: ArrayBuffer | Uint8Array;
  size: number;
  pageCount: number;
  selectedRangeText?: string;
}

/**
 * Merges multiple PDF files in given order into a single unified PDF
 */
export const mergePdfDocuments = async (
  items: PdfJoinItem[]
): Promise<Uint8Array> => {
  if (!items || items.length === 0) {
    throw new Error('No PDF files provided to merge.');
  }

  const mergedDoc = await PDFDocument.create();

  for (const item of items) {
    const srcDoc = await PDFDocument.load(item.bytes, { ignoreEncryption: true });
    const count = srcDoc.getPageCount();

    let pageIndicesToCopy: number[] = [];
    if (item.selectedRangeText && item.selectedRangeText.trim()) {
      pageIndicesToCopy = parsePageRange(item.selectedRangeText, count);
    }
    if (pageIndicesToCopy.length === 0) {
      pageIndicesToCopy = srcDoc.getPageIndices();
    }

    if (pageIndicesToCopy.length > 0) {
      const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndicesToCopy);
      copiedPages.forEach(p => mergedDoc.addPage(p));
    }
  }

  return await mergedDoc.save();
};

/**
 * Splits / extracts specified pages (0-based indices) into a new PDF
 */
export const splitPdfDocument = async (
  pdfBytes: ArrayBuffer | Uint8Array,
  pageIndices: number[]
): Promise<Uint8Array> => {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const validIndices = pageIndices.filter(i => i >= 0 && i < total);

  if (validIndices.length === 0) {
    throw new Error('No valid pages selected for splitting.');
  }

  const splitDoc = await PDFDocument.create();
  const copied = await splitDoc.copyPages(srcDoc, validIndices);
  copied.forEach(p => splitDoc.addPage(p));
  return await splitDoc.save();
};

/**
 * Splits an entire PDF into individual 1-page PDF documents
 */
export const splitPdfToPages = async (
  pdfBytes: ArrayBuffer | Uint8Array
): Promise<{ pageNumber: number; bytes: Uint8Array }[]> => {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const results: { pageNumber: number; bytes: Uint8Array }[] = [];

  for (let i = 0; i < total; i++) {
    const singleDoc = await PDFDocument.create();
    const [page] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(page);
    const bytes = await singleDoc.save();
    results.push({ pageNumber: i + 1, bytes });
  }

  return results;
};

/**
 * Splits a PDF every N pages (e.g. chunks of 2 pages, 5 pages)
 */
export const splitPdfByChunkSize = async (
  pdfBytes: ArrayBuffer | Uint8Array,
  chunkSize: number = 1
): Promise<{ rangeText: string; bytes: Uint8Array }[]> => {
  const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const step = Math.max(1, chunkSize);
  const results: { rangeText: string; bytes: Uint8Array }[] = [];

  for (let start = 0; start < total; start += step) {
    const end = Math.min(total, start + step);
    const indices: number[] = [];
    for (let p = start; p < end; p++) indices.push(p);

    const chunkDoc = await PDFDocument.create();
    const pages = await chunkDoc.copyPages(srcDoc, indices);
    pages.forEach(p => chunkDoc.addPage(p));
    const bytes = await chunkDoc.save();
    const rangeText = start + 1 === end ? `Page_${start + 1}` : `Pages_${start + 1}-${end}`;
    results.push({ rangeText, bytes });
  }

  return results;
};
