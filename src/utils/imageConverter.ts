import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import heic2any from 'heic2any';

export type TargetImageFormat =
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'avif'
  | 'tiff'
  | 'bmp'
  | 'gif'
  | 'pdf'
  | 'ico'
  | 'svg';

export interface ImageConversionOptions {
  format: TargetImageFormat;
  quality: number; // 0.1 to 1.0 (for JPEG, WEBP, AVIF)
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
  fitMode?: 'contain' | 'cover' | 'stretch';
  scalePercent?: number; // e.g. 50, 100, 200
  backgroundColor?: string; // e.g. '#ffffff' for JPG/BMP/TIFF fill
  rotation?: 0 | 90 | 180 | 270;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  // Filters & Adjustments
  brightness?: number; // -100 to 100
  contrast?: number; // -100 to 100
  saturation?: number; // 0 to 200 (100 is normal)
  grayscale?: boolean;
  invert?: boolean;
  sepia?: boolean;
  threshold?: boolean; // Binary 1-bit high-contrast (laser/signage)
  thresholdVal?: number; // 0 to 255 (default 128)
  sharpen?: boolean;
  // Watermark
  watermarkText?: string;
  watermarkOpacity?: number; // 0.1 to 1.0
  watermarkPosition?: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'tile';
  watermarkColor?: string;
  // Target Max KB compression
  targetMaxKb?: number;
  // ICO size
  icoSize?: number; // 16, 32, 48, 64, 128, 256
}

export interface ConvertedImageResult {
  id: string;
  originalName: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  convertedName: string;
  convertedSize: number;
  convertedWidth: number;
  convertedHeight: number;
  blob: Blob;
  dataUrl: string;
  format: TargetImageFormat;
}

/**
 * Normalizes an input image file:
 * If it is an iPhone HEIC/HEIF photo, decodes it into a browser-displayable JPEG Blob.
 */
export const normalizeInputImage = async (
  file: File | Blob
): Promise<{ blob: Blob; isHeic: boolean; originalName: string }> => {
  const name = file instanceof File ? file.name : 'image';
  const isHeic =
    name.toLowerCase().endsWith('.heic') ||
    name.toLowerCase().endsWith('.heif') ||
    file.type.toLowerCase().includes('heic') ||
    file.type.toLowerCase().includes('heif');

  if (isHeic) {
    try {
      const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.95,
      });
      const single = Array.isArray(converted) ? converted[0] : converted;
      return { blob: single, isHeic: true, originalName: name };
    } catch (err) {
      console.warn('Failed to decode iPhone HEIC file with heic2any:', err);
    }
  }

  return { blob: file, isHeic: false, originalName: name };
};

/**
 * Loads an image File or Blob into an HTMLImageElement
 */
export const loadImageElement = (fileOrBlob: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fileOrBlob);
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${err}`));
    };
    img.src = url;
  });
};

/**
 * Reads File as ArrayBuffer
 */
export const readFileBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Formats byte size to human readable string (e.g. 1.2 MB, 350 KB)
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/**
 * Builds a valid Windows/Web .ico file buffer embedding PNG payload
 */
export const buildIcoFromPngBlob = async (pngBlob: Blob, size: number = 32): Promise<Blob> => {
  const pngArrayBuffer = await pngBlob.arrayBuffer();
  const pngBytes = new Uint8Array(pngArrayBuffer);
  const dataSize = pngBytes.length;

  const headerAndDirSize = 6 + 16;
  const totalIcoSize = headerAndDirSize + dataSize;
  const icoBuffer = new ArrayBuffer(totalIcoSize);
  const view = new DataView(icoBuffer);

  // ICONHEADER (6 bytes)
  view.setUint16(0, 0, true); // Reserved, must be 0
  view.setUint16(2, 1, true); // Image type: 1 = ICO
  view.setUint16(4, 1, true); // Number of images: 1

  // ICONDIRENTRY (16 bytes)
  const icoW = size >= 256 ? 0 : size;
  const icoH = size >= 256 ? 0 : size;
  view.setUint8(6, icoW); // Width
  view.setUint8(7, icoH); // Height
  view.setUint8(8, 0); // Color count
  view.setUint8(9, 0); // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, dataSize, true); // Image data size in bytes
  view.setUint32(18, headerAndDirSize, true); // Offset of image data from beginning of file

  // Copy PNG bytes
  const icoUint8 = new Uint8Array(icoBuffer);
  icoUint8.set(pngBytes, headerAndDirSize);

  return new Blob([icoBuffer], { type: 'image/x-icon' });
};

/**
 * Encodes Canvas pixel buffer to standard Windows 24-bit uncompressed BMP
 */
export const buildBmpFromCanvas = (canvas: HTMLCanvasElement): Blob => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context for BMP');
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // 24-bit BMP: 3 bytes per pixel (BGR)
  const rowBytes = Math.ceil((width * 3) / 4) * 4;
  const imageSize = rowBytes * height;
  const headerSize = 54;
  const fileSize = headerSize + imageSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x4d42, false); // 'BM'
  view.setUint32(2, fileSize, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint32(10, headerSize, true);

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, imageSize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 0, true);
  view.setUint32(50, 0, true);

  const uint8 = new Uint8Array(buffer);
  let offset = headerSize;

  for (let y = height - 1; y >= 0; y--) {
    let rowOffset = offset;
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 4;
      uint8[rowOffset++] = data[srcIndex + 2]; // B
      uint8[rowOffset++] = data[srcIndex + 1]; // G
      uint8[rowOffset++] = data[srcIndex]; // R
    }
    while (rowOffset < offset + rowBytes) {
      uint8[rowOffset++] = 0;
    }
    offset += rowBytes;
  }

  return new Blob([buffer], { type: 'image/bmp' });
};

/**
 * Builds a valid uncompressed baseline RGB TIFF file from Canvas
 */
export const buildTiffFromCanvas = (canvas: HTMLCanvasElement): Blob => {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context for TIFF');
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const numEntries = 12;
  const ifdOffset = 8;
  const ifdSize = 2 + numEntries * 12 + 4;
  const extraDataOffset = ifdOffset + ifdSize;

  const bitsPerSampleOffset = extraDataOffset;
  const xResOffset = bitsPerSampleOffset + 6;
  const yResOffset = xResOffset + 8;
  const pixelDataOffset = yResOffset + 8;

  const pixelDataSize = width * height * 3;
  const totalFileSize = pixelDataOffset + pixelDataSize;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  // TIFF Header (Little Endian 'II')
  view.setUint16(0, 0x4949, false);
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOffset, true);

  // IFD count
  view.setUint16(ifdOffset, numEntries, true);

  let entryPtr = ifdOffset + 2;
  const writeTag = (tag: number, type: number, count: number, valOrOffset: number) => {
    view.setUint16(entryPtr, tag, true);
    view.setUint16(entryPtr + 2, type, true);
    view.setUint32(entryPtr + 4, count, true);
    view.setUint32(entryPtr + 8, valOrOffset, true);
    entryPtr += 12;
  };

  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  writeTag(258, 3, 3, bitsPerSampleOffset); // BitsPerSample
  writeTag(259, 3, 1, 1); // Compression: 1 = uncompressed
  writeTag(262, 3, 1, 2); // PhotometricInterpretation: 2 = RGB
  writeTag(273, 4, 1, pixelDataOffset); // StripOffsets
  writeTag(277, 3, 1, 3); // SamplesPerPixel: 3
  writeTag(278, 4, 1, height); // RowsPerStrip
  writeTag(279, 4, 1, pixelDataSize); // StripByteCounts
  writeTag(282, 5, 1, xResOffset); // XResolution
  writeTag(283, 5, 1, yResOffset); // YResolution
  writeTag(296, 3, 1, 2); // ResolutionUnit: 2 = inch

  view.setUint32(entryPtr, 0, true);

  view.setUint16(bitsPerSampleOffset, 8, true);
  view.setUint16(bitsPerSampleOffset + 2, 8, true);
  view.setUint16(bitsPerSampleOffset + 4, 8, true);

  view.setUint32(xResOffset, 72, true);
  view.setUint32(xResOffset + 4, 1, true);

  view.setUint32(yResOffset, 72, true);
  view.setUint32(yResOffset + 4, 1, true);

  let outIdx = pixelDataOffset;
  for (let i = 0; i < data.length; i += 4) {
    uint8[outIdx++] = data[i]; // R
    uint8[outIdx++] = data[i + 1]; // G
    uint8[outIdx++] = data[i + 2]; // B
  }

  return new Blob([buffer], { type: 'image/tiff' });
};

/**
 * Converts an image file to a single-page PDF document
 */
export const buildPdfFromImage = async (
  imageBlob: Blob,
  imgWidth: number,
  imgHeight: number
): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create();
  const imageBytes = await imageBlob.arrayBuffer();

  let embeddedImage;
  if (imageBlob.type === 'image/png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  }

  const maxDimension = 841.89; // A4 height points
  let pageW = imgWidth;
  let pageH = imgHeight;

  if (pageW > maxDimension || pageH > maxDimension) {
    const ratio = Math.min(maxDimension / pageW, maxDimension / pageH);
    pageW = Math.round(pageW * ratio);
    pageH = Math.round(pageH * ratio);
  }

  const page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
  });

  const pdfBytes = await pdfDoc.save();
  const safeBytes = new Uint8Array(pdfBytes);
  return new Blob([safeBytes], { type: 'application/pdf' });
};

/**
 * Merges multiple images into a single multi-page PDF document
 */
export const buildMultiImagePdf = async (
  items: { blob: Blob; width: number; height: number; title?: string }[],
  pageSize: 'fit' | 'a4_portrait' | 'a4_landscape' = 'fit'
): Promise<Blob> => {
  const pdfDoc = await PDFDocument.create();

  for (const item of items) {
    const imgBytes = await item.blob.arrayBuffer();
    let embeddedImg;
    const isPng = item.blob.type === 'image/png';
    try {
      embeddedImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);
    } catch {
      embeddedImg = await pdfDoc.embedJpg(imgBytes);
    }

    if (pageSize === 'a4_portrait') {
      const page = pdfDoc.addPage([595.28, 841.89]);
      const margin = 28;
      const availW = 595.28 - margin * 2;
      const availH = 841.89 - margin * 2;
      const ratio = Math.min(availW / item.width, availH / item.height);
      const drawW = item.width * ratio;
      const drawH = item.height * ratio;
      const drawX = (595.28 - drawW) / 2;
      const drawY = (841.89 - drawH) / 2;
      page.drawImage(embeddedImg, { x: drawX, y: drawY, width: drawW, height: drawH });
    } else if (pageSize === 'a4_landscape') {
      const page = pdfDoc.addPage([841.89, 595.28]);
      const margin = 28;
      const availW = 841.89 - margin * 2;
      const availH = 595.28 - margin * 2;
      const ratio = Math.min(availW / item.width, availH / item.height);
      const drawW = item.width * ratio;
      const drawH = item.height * ratio;
      const drawX = (841.89 - drawW) / 2;
      const drawY = (595.28 - drawH) / 2;
      page.drawImage(embeddedImg, { x: drawX, y: drawY, width: drawW, height: drawH });
    } else {
      const maxDim = 1200;
      let w = item.width;
      let h = item.height;
      if (w > maxDim || h > maxDim) {
        const r = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * r);
        h = Math.round(h * r);
      }
      const page = pdfDoc.addPage([w, h]);
      page.drawImage(embeddedImg, { x: 0, y: 0, width: w, height: h });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
};

/**
 * Converts image file/blob with full transformations, filters, resize, watermark, and format encoding
 */
export const convertImageFile = async (
  file: File | Blob,
  options: ImageConversionOptions,
  customName?: string
): Promise<ConvertedImageResult> => {
  // Normalize iPhone HEIC / HEIF photo if applicable
  const { blob: normalizedBlob, originalName: resolvedName } = await normalizeInputImage(file);
  const originalName = customName || resolvedName;
  const originalSize = file.size;

  // Load into Image element
  const img = await loadImageElement(normalizedBlob);
  const origW = img.naturalWidth || img.width || 800;
  const origH = img.naturalHeight || img.height || 600;

  // Calculate base target dimensions
  let targetW = origW;
  let targetH = origH;

  if (options.scalePercent && options.scalePercent !== 100) {
    const factor = options.scalePercent / 100;
    targetW = Math.max(1, Math.round(origW * factor));
    targetH = Math.max(1, Math.round(origH * factor));
  } else if (options.width || options.height) {
    if (options.maintainAspectRatio) {
      if (options.width && options.height) {
        const ratio = Math.min(options.width / origW, options.height / origH);
        targetW = Math.max(1, Math.round(origW * ratio));
        targetH = Math.max(1, Math.round(origH * ratio));
      } else if (options.width) {
        targetW = Math.max(1, Math.round(options.width));
        targetH = Math.max(1, Math.round((origH / origW) * targetW));
      } else if (options.height) {
        targetH = Math.max(1, Math.round(options.height));
        targetW = Math.max(1, Math.round((origW / origH) * targetH));
      }
    } else {
      targetW = Math.max(1, Math.round(options.width || origW));
      targetH = Math.max(1, Math.round(options.height || origH));
    }
  }

  // If target format is ICO, set standard icon size
  if (options.format === 'ico') {
    const icoSz = options.icoSize || 32;
    targetW = icoSz;
    targetH = icoSz;
  }

  // Calculate final canvas dimensions considering rotation
  const rot = options.rotation || 0;
  let canvasW = targetW;
  let canvasH = targetH;
  if (rot === 90 || rot === 270) {
    canvasW = targetH;
    canvasH = targetW;
  }

  // Draw to offscreen HTML5 canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get 2D canvas context');

  // Background color handling
  if (options.format === 'jpeg' || options.format === 'bmp' || options.format === 'tiff') {
    ctx.fillStyle = options.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else if (options.backgroundColor && options.backgroundColor !== 'transparent') {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Draw image with Rotation & Flipping
  ctx.save();
  ctx.translate(canvasW / 2, canvasH / 2);
  if (rot !== 0) {
    ctx.rotate((rot * Math.PI) / 180);
  }
  if (options.flipHorizontal || options.flipVertical) {
    ctx.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
  }

  ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
  ctx.restore();

  // Apply Pixel Filters
  const hasPixelFilter =
    options.grayscale ||
    options.invert ||
    options.sepia ||
    options.threshold ||
    (options.brightness && options.brightness !== 0) ||
    (options.contrast && options.contrast !== 0) ||
    (options.saturation !== undefined && options.saturation !== 100);

  if (hasPixelFilter) {
    const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
    const d = imgData.data;
    const brightness = options.brightness || 0;
    const contrast = options.contrast || 0;
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const saturation = (options.saturation ?? 100) / 100;
    const thresholdVal = options.thresholdVal ?? 128;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      if (brightness !== 0) {
        r += brightness * 2.55;
        g += brightness * 2.55;
        b += brightness * 2.55;
      }

      if (contrast !== 0) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

      if (saturation !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + saturation * (r - gray);
        g = gray + saturation * (g - gray);
        b = gray + saturation * (b - gray);
      }

      if (options.grayscale) {
        const v = 0.299 * r + 0.587 * g + 0.114 * b;
        r = v;
        g = v;
        b = v;
      }

      if (options.sepia) {
        const tr = 0.393 * r + 0.769 * g + 0.189 * b;
        const tg = 0.349 * r + 0.686 * g + 0.168 * b;
        const tb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = tr;
        g = tg;
        b = tb;
      }

      if (options.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      r = Math.min(255, Math.max(0, r));
      g = Math.min(255, Math.max(0, g));
      b = Math.min(255, Math.max(0, b));

      if (options.threshold) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const val = lum >= thresholdVal ? 255 : 0;
        r = val;
        g = val;
        b = val;
      }

      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Sharpening
  if (options.sharpen) {
    const srcData = ctx.getImageData(0, 0, canvasW, canvasH);
    const dstData = ctx.createImageData(canvasW, canvasH);
    const src = srcData.data;
    const dst = dstData.data;
    const kernel = [0, -0.6, 0, -0.6, 3.4, -0.6, 0, -0.6, 0];

    for (let y = 1; y < canvasH - 1; y++) {
      for (let x = 1; x < canvasW - 1; x++) {
        const dstIdx = (y * canvasW + x) * 4;
        let r = 0;
        let g = 0;
        let b = 0;

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const srcIdx = ((y + ky) * canvasW + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            r += src[srcIdx] * weight;
            g += src[srcIdx + 1] * weight;
            b += src[srcIdx + 2] * weight;
          }
        }

        dst[dstIdx] = Math.min(255, Math.max(0, r));
        dst[dstIdx + 1] = Math.min(255, Math.max(0, g));
        dst[dstIdx + 2] = Math.min(255, Math.max(0, b));
        dst[dstIdx + 3] = src[dstIdx + 3];
      }
    }
    ctx.putImageData(dstData, 0, 0);
  }

  // Watermark Overlay
  if (options.watermarkText && options.watermarkText.trim().length > 0) {
    ctx.save();
    const text = options.watermarkText.trim();
    const fontSize = Math.max(14, Math.round(canvasW / 24));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = options.watermarkColor || '#ffffff';
    ctx.globalAlpha = Math.min(1, Math.max(0.1, options.watermarkOpacity ?? 0.45));
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;

    const pos = options.watermarkPosition || 'bottom-right';

    if (pos === 'tile') {
      ctx.rotate((-22 * Math.PI) / 180);
      const stepX = Math.round(canvasW / 2.5);
      const stepY = Math.round(canvasH / 3.5);
      for (let x = -canvasW; x < canvasW * 2; x += stepX) {
        for (let y = -canvasH; y < canvasH * 2; y += stepY) {
          ctx.fillText(text, x, y);
        }
      }
    } else if (pos === 'center') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvasW / 2, canvasH / 2);
    } else if (pos === 'top-right') {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(text, canvasW - 20, 20);
    } else if (pos === 'bottom-left') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, 20, canvasH - 20);
    } else {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(text, canvasW - 20, canvasH - 20);
    }
    ctx.restore();
  }

  // Export based on format
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  let finalBlob: Blob;
  let finalExt = 'png';

  const compressToTargetMaxKb = async (
    targetMime: 'image/jpeg' | 'image/webp' | 'image/avif',
    initialQuality: number,
    maxKb: number
  ): Promise<Blob> => {
    const maxBytes = maxKb * 1024;
    let currQ = initialQuality;
    let bestBlob: Blob | null = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const b = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(blob => (blob ? res(blob) : rej(new Error('Compression failed'))), targetMime, currQ);
      });
      bestBlob = b;
      if (b.size <= maxBytes) return b;
      currQ = Math.max(0.1, currQ - 0.2);
    }
    return bestBlob!;
  };

  if (options.format === 'jpeg') {
    finalExt = 'jpg';
    if (options.targetMaxKb && options.targetMaxKb > 0) {
      finalBlob = await compressToTargetMaxKb('image/jpeg', options.quality, options.targetMaxKb);
    } else {
      finalBlob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(b => (b ? res(b) : rej(new Error('JPEG conversion failed'))), 'image/jpeg', options.quality);
      });
    }
  } else if (options.format === 'webp') {
    finalExt = 'webp';
    if (options.targetMaxKb && options.targetMaxKb > 0) {
      finalBlob = await compressToTargetMaxKb('image/webp', options.quality, options.targetMaxKb);
    } else {
      finalBlob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(b => (b ? res(b) : rej(new Error('WEBP conversion failed'))), 'image/webp', options.quality);
      });
    }
  } else if (options.format === 'avif') {
    finalExt = 'avif';
    try {
      if (options.targetMaxKb && options.targetMaxKb > 0) {
        finalBlob = await compressToTargetMaxKb('image/avif', options.quality, options.targetMaxKb);
      } else {
        finalBlob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(b => (b ? res(b) : rej(new Error('AVIF failed'))), 'image/avif', options.quality);
        });
      }
    } catch {
      // Fallback to WebP if AVIF is unsupported on older browser
      finalBlob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob(b => (b ? res(b) : rej(new Error('AVIF fallback failed'))), 'image/webp', options.quality);
      });
    }
  } else if (options.format === 'tiff') {
    finalExt = 'tiff';
    finalBlob = buildTiffFromCanvas(canvas);
  } else if (options.format === 'bmp') {
    finalExt = 'bmp';
    finalBlob = buildBmpFromCanvas(canvas);
  } else if (options.format === 'gif') {
    finalExt = 'gif';
    finalBlob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => (b ? res(b) : rej(new Error('GIF conversion failed'))), 'image/gif');
    });
  } else if (options.format === 'ico') {
    finalExt = 'ico';
    const pngBlob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => (b ? res(b) : rej(new Error('PNG for ICO failed'))), 'image/png');
    });
    finalBlob = await buildIcoFromPngBlob(pngBlob, canvasW);
  } else if (options.format === 'pdf') {
    finalExt = 'pdf';
    const rasterBlob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => (b ? res(b) : rej(new Error('Raster for PDF failed'))), 'image/jpeg', 0.95);
    });
    finalBlob = await buildPdfFromImage(rasterBlob, canvasW, canvasH);
  } else if (options.format === 'svg') {
    finalExt = 'svg';
    const dataUrl = canvas.toDataURL('image/png');
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
  <image width="${canvasW}" height="${canvasH}" xlink:href="${dataUrl}"/>
</svg>`;
    finalBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  } else {
    // Default PNG
    finalExt = 'png';
    finalBlob = await new Promise<Blob>((res, rej) => {
      canvas.toBlob(b => (b ? res(b) : rej(new Error('PNG conversion failed'))), 'image/png');
    });
  }

  const convertedName = `${baseName}_converted.${finalExt}`;
  const dataUrl = URL.createObjectURL(finalBlob);

  return {
    id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    originalName,
    originalSize,
    originalWidth: origW,
    originalHeight: origH,
    convertedName,
    convertedSize: finalBlob.size,
    convertedWidth: canvasW,
    convertedHeight: canvasH,
    blob: finalBlob,
    dataUrl,
    format: options.format,
  };
};

/**
 * Triggers browser download for a Blob
 */
export const downloadBlobFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/**
 * Copies an image Blob directly to system clipboard as image/png
 */
export const copyImageBlobToClipboard = async (blob: Blob): Promise<boolean> => {
  try {
    let pngBlob = blob;
    if (blob.type !== 'image/png') {
      const img = await loadImageElement(blob);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        pngBlob = await new Promise<Blob>((res, rej) => {
          canvas.toBlob(b => (b ? res(b) : rej(new Error('PNG conversion failed'))), 'image/png');
        });
      }
    }
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
    return true;
  } catch (err) {
    console.error('Clipboard copy error:', err);
    return false;
  }
};

/**
 * Copies text to system clipboard
 */
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * Packages multiple converted images into a single ZIP archive
 */
export const downloadAllAsZip = async (
  results: ConvertedImageResult[],
  zipName: string = 'Converted_Images.zip'
) => {
  if (results.length === 0) return;
  const zip = new JSZip();

  for (const item of results) {
    const arrayBuffer = await item.blob.arrayBuffer();
    zip.file(item.convertedName, arrayBuffer);
  }

  const zipContent = await zip.generateAsync({ type: 'blob' });
  downloadBlobFile(zipContent, zipName);
};
