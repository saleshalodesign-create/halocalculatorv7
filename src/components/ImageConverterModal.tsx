import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  Sliders,
  Image as ImageIcon,
  Layers,
  FileText,
  Plus,
  Maximize2,
  Lock,
  Unlock,
  Archive,
  Eye,
  Sparkles,
  Check,
  ArrowRight,
  Filter,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Copy,
  Code,
  Droplet,
  Stamp,
  Gauge,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Smartphone,
} from 'lucide-react';
import {
  TargetImageFormat,
  ImageConversionOptions,
  ConvertedImageResult,
  convertImageFile,
  normalizeInputImage,
  formatFileSize,
  downloadBlobFile,
  downloadAllAsZip,
  buildMultiImagePdf,
  copyImageBlobToClipboard,
  copyTextToClipboard,
} from '../utils/imageConverter';
import { useLanguage } from '../context/LanguageContext';

export interface ImageConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInEditor?: (bytes: ArrayBuffer | Uint8Array, fileName: string) => void;
}

interface QueuedImageItem {
  id: string;
  file: File;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  status: 'idle' | 'converting' | 'done' | 'error';
  result?: ConvertedImageResult;
  error?: string;
  isHeic?: boolean;
}

export const ImageConverterModal: React.FC<ImageConverterModalProps> = ({
  isOpen,
  onClose,
  onOpenInEditor,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  // Active view: 'batch' or 'compare'
  const [activeView, setActiveView] = useState<'batch' | 'compare'>('batch');

  // Sidebar sub-tab: 'format_resize' | 'effects' | 'watermark'
  const [sidebarTab, setSidebarTab] = useState<'format_resize' | 'effects' | 'watermark'>('format_resize');

  // Target Format
  const [targetFormat, setTargetFormat] = useState<TargetImageFormat>('png');
  const [quality, setQuality] = useState<number>(0.85);
  const [targetMaxKb, setTargetMaxKb] = useState<string>(''); // Target max size limit

  // Resize & Dimensions
  const [resizeMode, setResizeMode] = useState<'original' | 'percent' | 'custom'>('original');
  const [scalePercent, setScalePercent] = useState<number>(100);
  const [customWidth, setCustomWidth] = useState<string>('');
  const [customHeight, setCustomHeight] = useState<string>('');
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [icoSize, setIcoSize] = useState<number>(32);

  // Transformations
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [flipHorizontal, setFlipHorizontal] = useState<boolean>(false);
  const [flipVertical, setFlipVertical] = useState<boolean>(false);

  // Filters & Adjustments
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [saturation, setSaturation] = useState<number>(100);
  const [grayscale, setGrayscale] = useState<boolean>(false);
  const [invert, setInvert] = useState<boolean>(false);
  const [sepia, setSepia] = useState<boolean>(false);
  const [sharpen, setSharpen] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<boolean>(false);
  const [thresholdVal, setThresholdVal] = useState<number>(128);

  // Watermark
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.4);
  const [watermarkPosition, setWatermarkPosition] = useState<
    'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'tile'
  >('bottom-right');
  const [watermarkColor, setWatermarkColor] = useState<string>('#ffffff');

  // Multi-PDF Merge modal / popover
  const [pdfMergeMenuOpen, setPdfMergeMenuOpen] = useState<boolean>(false);

  // Queue state
  const [queue, setQueue] = useState<QueuedImageItem[]>([]);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);
  const [selectedItemForCompare, setSelectedItemForCompare] = useState<QueuedImageItem | null>(null);

  // Studio zoom
  const [studioZoom, setStudioZoom] = useState<number>(1);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string>('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Available Formats
  const ALL_FORMATS: {
    id: TargetImageFormat;
    label: string;
    subLabelZh: string;
    subLabelEn: string;
    badge?: string;
  }[] = [
    { id: 'png', label: 'PNG', subLabelZh: '无损透明', subLabelEn: 'Lossless' },
    { id: 'jpeg', label: 'JPG', subLabelZh: '通用照片', subLabelEn: 'Universal' },
    { id: 'webp', label: 'WEBP', subLabelZh: '高效网页', subLabelEn: 'Web Optimized' },
    { id: 'avif', label: 'AVIF', subLabelZh: 'iPhone / HDR', subLabelEn: 'Apple / HDR', badge: 'iOS 16+' },
    { id: 'tiff', label: 'TIFF', subLabelZh: 'ProRAW / 印刷', subLabelEn: 'Pro / Master', badge: 'Pro' },
    { id: 'bmp', label: 'BMP', subLabelZh: '工业位图', subLabelEn: 'Bitmap' },
    { id: 'gif', label: 'GIF', subLabelZh: '网络动图', subLabelEn: 'Graphics' },
    { id: 'pdf', label: 'PDF', subLabelZh: '排版文档', subLabelEn: 'Document' },
    { id: 'ico', label: 'ICO', subLabelZh: '网站图标', subLabelEn: 'Favicon' },
    { id: 'svg', label: 'SVG', subLabelZh: '矢量容器', subLabelEn: 'Vector' },
  ];

  // Presets
  const PRESET_OPTIONS = [
    { label: '4K (3840×2160)', w: 3840, h: 2160 },
    { label: 'Full HD (1920×1080)', w: 1920, h: 1080 },
    { label: 'HD (1280×720)', w: 1280, h: 720 },
    { label: 'Square 1:1 (1080×1080)', w: 1080, h: 1080 },
    { label: 'Story 9:16 (1080×1920)', w: 1080, h: 1920 },
    { label: 'App Icon (512×512)', w: 512, h: 512 },
    { label: 'Favicon (64×64)', w: 64, h: 64 },
  ];

  const handleApplyPreset = (w: number, h: number) => {
    setResizeMode('custom');
    setCustomWidth(String(w));
    setCustomHeight(String(h));
  };

  // Reset Filters
  const handleResetAdjustments = () => {
    setBrightness(0);
    setContrast(0);
    setSaturation(100);
    setGrayscale(false);
    setInvert(false);
    setSepia(false);
    setSharpen(false);
    setThreshold(false);
    setThresholdVal(128);
    setRotation(0);
    setFlipHorizontal(false);
    setFlipVertical(false);
    showToast(isZh ? '已重置滤镜与旋转参数' : 'Reset filters and transform');
  };

  // Add files to queue with iPhone HEIC / HEIF auto-decoding
  const handleFilesAdded = useCallback(
    async (fileList: FileList | File[]) => {
      const newItems: QueuedImageItem[] = [];
      let heicCount = 0;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const lowerName = file.name.toLowerCase();
        const isImg =
          file.type.startsWith('image/') ||
          lowerName.endsWith('.heic') ||
          lowerName.endsWith('.heif') ||
          lowerName.endsWith('.svg') ||
          lowerName.endsWith('.pdf') ||
          lowerName.endsWith('.bmp') ||
          lowerName.endsWith('.webp') ||
          lowerName.endsWith('.avif') ||
          lowerName.endsWith('.tiff') ||
          lowerName.endsWith('.tif') ||
          lowerName.endsWith('.gif') ||
          lowerName.endsWith('.ico');
        if (!isImg) continue;

        // Decode iPhone HEIC/HEIF photo if applicable
        const { blob: displayBlob, isHeic } = await normalizeInputImage(file);
        if (isHeic) heicCount++;

        const previewUrl = URL.createObjectURL(displayBlob);
        const img = new Image();
        img.src = previewUrl;

        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
          img.onerror = () => resolve({ w: 800, h: 600 });
        });

        newItems.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          previewUrl,
          originalWidth: dims.w,
          originalHeight: dims.h,
          status: 'idle',
          isHeic,
        });
      }

      if (newItems.length > 0) {
        setQueue((prev) => [...prev, ...newItems]);
        if (!selectedItemForCompare) {
          setSelectedItemForCompare(newItems[0]);
        }
        if (heicCount > 0) {
          showToast(
            isZh
              ? `已成功解析 ${heicCount} 张 iPhone HEIC 原图，已载入队列！`
              : `Successfully decoded ${heicCount} iPhone HEIC photo(s)!`
          );
        } else {
          showToast(
            isZh
              ? `已添加 ${newItems.length} 张图片到队列`
              : `Added ${newItems.length} image${newItems.length > 1 ? 's' : ''}`
          );
        }
      }
    },
    [isZh, selectedItemForCompare]
  );

  // Global Clipboard Paste Listener (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      const pastedFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            const fileName = `Pasted_Image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
            const file = new File([blob], fileName, { type: blob.type });
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        handleFilesAdded(pastedFiles);
        showToast(isZh ? '已直接从剪贴板粘贴图片！' : 'Pasted image from clipboard!');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, handleFilesAdded, isZh]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFilesAdded(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Convert a single queued item
  const handleConvertSingleItem = async (itemId: string): Promise<ConvertedImageResult | null> => {
    const item = queue.find((q) => q.id === itemId);
    if (!item) return null;

    setQueue((prev) =>
      prev.map((q) => (q.id === itemId ? { ...q, status: 'converting', error: undefined } : q))
    );

    try {
      const options: ImageConversionOptions = {
        format: targetFormat,
        quality: quality,
        maintainAspectRatio: maintainAspect,
        backgroundColor:
          targetFormat === 'jpeg' || targetFormat === 'bmp' || targetFormat === 'tiff'
            ? backgroundColor
            : undefined,
        rotation,
        flipHorizontal,
        flipVertical,
        brightness,
        contrast,
        saturation,
        grayscale,
        invert,
        sepia,
        sharpen,
        threshold,
        thresholdVal,
        watermarkText: watermarkText.trim() || undefined,
        watermarkOpacity,
        watermarkPosition,
        watermarkColor,
        icoSize: targetFormat === 'ico' ? icoSize : undefined,
        targetMaxKb: targetMaxKb ? parseInt(targetMaxKb, 10) : undefined,
      };

      if (resizeMode === 'percent') {
        options.scalePercent = scalePercent;
      } else if (resizeMode === 'custom') {
        if (customWidth) options.width = parseInt(customWidth, 10);
        if (customHeight) options.height = parseInt(customHeight, 10);
      }

      const result = await convertImageFile(item.file, options);

      setQueue((prev) =>
        prev.map((q) => (q.id === itemId ? { ...q, status: 'done', result } : q))
      );

      if (selectedItemForCompare?.id === itemId) {
        setSelectedItemForCompare((prev) => (prev ? { ...prev, status: 'done', result } : null));
      }

      return result;
    } catch (err: any) {
      console.error('Failed to convert image:', err);
      setQueue((prev) =>
        prev.map((q) => (q.id === itemId ? { ...q, status: 'error', error: err.message || 'Error' } : q))
      );
      return null;
    }
  };

  // Convert all items in queue
  const handleConvertAll = async () => {
    if (queue.length === 0) return;
    setIsProcessingAll(true);

    try {
      for (const item of queue) {
        await handleConvertSingleItem(item.id);
      }
      showToast(isZh ? '所有图片已完成转换！' : 'All images converted successfully!');
    } finally {
      setIsProcessingAll(false);
    }
  };

  // Download all converted items as a ZIP archive
  const handleDownloadAllZip = async () => {
    const doneResults = queue.map((q) => q.result).filter(Boolean) as ConvertedImageResult[];
    if (doneResults.length === 0) {
      showToast(isZh ? '暂无可下载的已转换图片，请先点击转换' : 'No converted images to download');
      return;
    }

    try {
      const zipName = `Halo_Converted_${targetFormat.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.zip`;
      await downloadAllAsZip(doneResults, zipName);
      showToast(
        isZh
          ? `已打包生成并下载 ZIP (${doneResults.length} 张)`
          : `Downloaded ZIP (${doneResults.length} images)`
      );
    } catch (err: any) {
      console.error('Failed to zip images:', err);
      showToast(isZh ? `ZIP 导出失败: ${err.message}` : 'Failed to create ZIP');
    }
  };

  // Merge all into 1 multi-page PDF
  const handleMergeAllToPdf = async (pageSize: 'fit' | 'a4_portrait' | 'a4_landscape') => {
    setPdfMergeMenuOpen(false);
    if (queue.length === 0) return;

    try {
      showToast(isZh ? '正在合并生成多页 PDF...' : 'Generating multi-page PDF...');
      const itemsToEmbed: { blob: Blob; width: number; height: number; title?: string }[] = [];

      for (const q of queue) {
        if (q.result?.blob) {
          itemsToEmbed.push({
            blob: q.result.blob,
            width: q.result.convertedWidth,
            height: q.result.convertedHeight,
            title: q.file.name,
          });
        } else {
          itemsToEmbed.push({
            blob: q.file,
            width: q.originalWidth,
            height: q.originalHeight,
            title: q.file.name,
          });
        }
      }

      const mergedPdfBlob = await buildMultiImagePdf(itemsToEmbed, pageSize);
      const fileName = `Halo_Image_Dossier_${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlobFile(mergedPdfBlob, fileName);
      showToast(
        isZh
          ? `已成功生成多页合并 PDF (${itemsToEmbed.length} 页)`
          : `Generated multi-page PDF (${itemsToEmbed.length} pages)`
      );
    } catch (err: any) {
      console.error('Failed to merge into PDF:', err);
      showToast(isZh ? `PDF 合并失败: ${err.message}` : 'Failed to merge into PDF');
    }
  };

  // Copy converted image to clipboard
  const handleCopyImageToClipboard = async (result: ConvertedImageResult) => {
    const success = await copyImageBlobToClipboard(result.blob);
    if (success) {
      showToast(isZh ? '已将图片复制到系统剪贴板！可直接粘贴' : 'Image copied to clipboard!');
    } else {
      showToast(isZh ? '复制失败，请直接使用下载按钮' : 'Copy failed, please download directly');
    }
  };

  // Copy Base64 Data URL to clipboard
  const handleCopyBase64 = async (result: ConvertedImageResult) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      await copyTextToClipboard(dataUrl);
      showToast(isZh ? 'Base64 Data URL 已复制到剪贴板！' : 'Base64 Data URL copied to clipboard!');
    };
    reader.readAsDataURL(result.blob);
  };

  // Remove single item
  const handleRemoveItem = (id: string) => {
    setQueue((prev) => {
      const next = prev.filter((q) => q.id !== id);
      if (selectedItemForCompare?.id === id) {
        setSelectedItemForCompare(next[0] || null);
      }
      return next;
    });
  };

  // Clear all
  const handleClearAll = () => {
    queue.forEach((q) => {
      URL.revokeObjectURL(q.previewUrl);
      if (q.result?.dataUrl) URL.revokeObjectURL(q.result.dataUrl);
    });
    setQueue([]);
    setSelectedItemForCompare(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="apple-liquid-glass relative w-full max-w-6xl max-h-[94vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* macOS Style Window Titlebar */}
          <div className="flex items-center justify-between px-4 py-3 bg-white/40 dark:bg-white/[0.04] backdrop-blur-xl border-b border-white/50 dark:border-white/10 select-none">
            {/* Traffic Lights */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-3.5 h-3.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                title="Close"
              >
                <X className="w-2.5 h-2.5 text-black/70 opacity-0 hover:opacity-100 transition-opacity" />
              </button>
              <div className="w-3.5 h-3.5 rounded-full bg-amber-500/80 cursor-default" />
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500/80 cursor-default" />
            </div>

            {/* Window Title */}
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-white">
              <span className="p-1.5 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25">
                <ImageIcon className="w-4 h-4" />
              </span>
              <span>
                {isZh
                  ? 'Halo 图片转换工作台 — iPhone HEIC / AVIF / TIFF / WEBP 多格式互转'
                  : 'Halo Image Converter — iPhone HEIC, AVIF, TIFF, WEBP Studio'}
              </span>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Bar / Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView('batch')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'batch'
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isZh ? '批量转换队列' : 'Batch Queue'}</span>
                {queue.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">
                    {queue.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveView('compare')}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeView === 'compare'
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>{isZh ? '画质对比与工作台' : 'Studio & Compare'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-cyan-400/90 font-mono hidden sm:flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>{isZh ? '支持 iPhone HEIC / HEIF 原图解析' : 'iPhone HEIC / HEIF supported'}</span>
              </span>
              {toastMsg && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  {toastMsg}
                </span>
              )}
            </div>
          </div>

          {/* Main Layout: Options Sidebar + Workspace */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left Controls & Parameters Sidebar */}
            <div className="w-full md:w-80 lg:w-94 p-4 bg-slate-950/70 border-r border-slate-800 overflow-y-auto mac-scrollbar space-y-4 shrink-0">
              {/* Sidebar Sub-tabs */}
              <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setSidebarTab('format_resize')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    sidebarTab === 'format_resize'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>{isZh ? '格式与尺寸' : 'Format & Size'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('effects')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    sidebarTab === 'effects'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>{isZh ? '滤镜与旋转' : 'Filters'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSidebarTab('watermark')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    sidebarTab === 'watermark'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Stamp className="w-3.5 h-3.5" />
                  <span>{isZh ? '水印标记' : 'Watermark'}</span>
                </button>
              </div>

              {/* TAB 1: FORMAT & RESIZE */}
              {sidebarTab === 'format_resize' && (
                <>
                  {/* Target Format Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isZh ? '目标输出格式 (10种格式)' : 'Target Format (10 Formats)'}</span>
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ALL_FORMATS.map((fmt, idx) => (
                        <button
                          key={`${fmt.id}-${idx}`}
                          type="button"
                          onClick={() => setTargetFormat(fmt.id)}
                          className={`py-2 px-2.5 text-left rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            targetFormat === fmt.id
                              ? 'bg-cyan-600 border-cyan-400 text-white shadow-md shadow-cyan-600/30'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <span className="font-mono font-bold text-xs uppercase block">{fmt.label}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {isZh ? fmt.subLabelZh : fmt.subLabelEn}
                            </span>
                          </div>
                          {fmt.badge && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                targetFormat === fmt.id
                                  ? 'bg-white/20 text-white'
                                  : 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                              }`}
                            >
                              {fmt.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality & Max KB (for JPEG / WEBP / AVIF) */}
                  {(targetFormat === 'jpeg' || targetFormat === 'webp' || targetFormat === 'avif') && (
                    <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300">
                          {isZh ? '压缩质量 (Quality)' : 'Quality'}:
                        </span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {Math.round(quality * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1.0"
                        step="0.05"
                        value={quality}
                        onChange={(e) => setQuality(parseFloat(e.target.value))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>{isZh ? '极小体积' : 'Small'}</span>
                        <span>{isZh ? '推荐 85%' : 'Balanced'}</span>
                        <span>{isZh ? '最高画质' : 'Best'}</span>
                      </div>

                      {/* Smart Target Max KB */}
                      <div className="pt-1.5 border-t border-slate-800/80">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="text-slate-300 font-semibold flex items-center gap-1">
                            <Gauge className="w-3 h-3 text-cyan-400" />
                            {isZh ? '限制目标体积 (Max KB)' : 'Target Max Size'}
                          </span>
                          {targetMaxKb && (
                            <button
                              type="button"
                              onClick={() => setTargetMaxKb('')}
                              className="text-cyan-400 hover:underline text-[10px] cursor-pointer"
                            >
                              {isZh ? '清除限制' : 'Clear'}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            placeholder={isZh ? '例如: 500 (留空为无限制)' : 'e.g. 500 KB (empty=none)'}
                            value={targetMaxKb}
                            onChange={(e) => setTargetMaxKb(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-cyan-400"
                          />
                          <div className="flex items-center gap-1">
                            {['200', '500', '1024'].map((kb, idx) => (
                              <button
                                key={`${kb}-${idx}`}
                                type="button"
                                onClick={() => setTargetMaxKb(kb)}
                                className={`px-2 py-1 rounded-md text-[10px] font-mono border cursor-pointer ${
                                  targetMaxKb === kb
                                    ? 'bg-cyan-600 border-cyan-400 text-white font-bold'
                                    : 'bg-slate-800 border-slate-700 text-slate-300'
                                }`}
                              >
                                {kb}K
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ICO Size Selector */}
                  {targetFormat === 'ico' && (
                    <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isZh ? 'Windows/Web 图标规格' : 'Favicon / Icon Size'}:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[16, 32, 48, 64, 128, 256].map((sz, idx) => (
                          <button
                            key={`${sz}-${idx}`}
                            type="button"
                            onClick={() => setIcoSize(sz)}
                            className={`py-1 text-center rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                              icoSize === sz
                                ? 'bg-cyan-600 border-cyan-400 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {sz}×{sz}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Background Color Fill (For JPEG, BMP, and TIFF) */}
                  {(targetFormat === 'jpeg' || targetFormat === 'bmp' || targetFormat === 'tiff') && (
                    <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                      <label className="text-xs font-bold text-slate-300 block">
                        {isZh
                          ? '底色填充 (JPG/BMP/TIFF 不支持透明)'
                          : 'Background Color (No Alpha in JPG/BMP/TIFF)'}:
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                        />
                        <div className="flex items-center gap-1.5 flex-1">
                          {['#ffffff', '#000000', '#f8fafc', '#0f172a'].map((c, idx) => (
                            <button
                              key={`${c}-${idx}`}
                              type="button"
                              onClick={() => setBackgroundColor(c)}
                              className={`w-6 h-6 rounded-md border transition-transform cursor-pointer ${
                                backgroundColor === c ? 'scale-110 ring-2 ring-cyan-400' : 'opacity-70'
                              }`}
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Resize & Scaling Controls */}
                  <div className="space-y-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isZh ? '尺寸调整 (Resize)' : 'Resize Options'}</span>
                    </label>

                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'original', labelZh: '原尺寸', labelEn: 'Original' },
                        { id: 'percent', labelZh: '百分比', labelEn: 'Percent' },
                        { id: 'custom', labelZh: '自定义', labelEn: 'Custom' },
                      ].map((m, idx) => (
                        <button
                          key={`${m.id}-${idx}`}
                          type="button"
                          onClick={() => setResizeMode(m.id as any)}
                          className={`py-1.5 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            resizeMode === m.id
                              ? 'bg-blue-600 border-blue-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {isZh ? m.labelZh : m.labelEn}
                        </button>
                      ))}
                    </div>

                    {/* Percentage Scale */}
                    {resizeMode === 'percent' && (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{isZh ? '缩放比例' : 'Scale'}:</span>
                          <span className="font-mono text-cyan-400 font-bold">{scalePercent}%</span>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {[25, 50, 75, 150, 200].map((p, idx) => (
                            <button
                              key={`${p}-${idx}`}
                              type="button"
                              onClick={() => setScalePercent(p)}
                              className={`py-1 text-center rounded-md text-[11px] font-mono border cursor-pointer ${
                                scalePercent === p
                                  ? 'bg-cyan-600 border-cyan-400 text-white font-bold'
                                  : 'bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Width & Height */}
                    {resizeMode === 'custom' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block mb-0.5">
                              {isZh ? '宽度 (px)' : 'Width (px)'}
                            </span>
                            <input
                              type="number"
                              placeholder="1920"
                              value={customWidth}
                              onChange={(e) => setCustomWidth(e.target.value)}
                              className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-cyan-400"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => setMaintainAspect(!maintainAspect)}
                            className={`p-2 rounded-lg border mt-3 transition-colors cursor-pointer ${
                              maintainAspect
                                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-400'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                            title={isZh ? '锁定长宽比例' : 'Lock Aspect Ratio'}
                          >
                            {maintainAspect ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <div className="flex-1">
                            <span className="text-[10px] text-slate-400 block mb-0.5">
                              {isZh ? '高度 (px)' : 'Height (px)'}
                            </span>
                            <input
                              type="number"
                              placeholder="1080"
                              value={customHeight}
                              onChange={(e) => setCustomHeight(e.target.value)}
                              className="w-full px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>

                        {/* Presets Grid */}
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 block">
                            {isZh ? '快速常用分辨率预设:' : 'Quick Resolution Presets:'}
                          </span>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            {PRESET_OPTIONS.map((pr, idx) => (
                              <button
                                key={`${pr.label}-${idx}`}
                                type="button"
                                onClick={() => handleApplyPreset(pr.w, pr.h)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-left truncate cursor-pointer transition-colors"
                              >
                                {pr.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* TAB 2: FILTERS & TRANSFORM */}
              {sidebarTab === 'effects' && (
                <div className="space-y-3">
                  {/* Rotation & Flip */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <RotateCw className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isZh ? '旋转与镜像' : 'Rotate & Flip'}</span>
                      </span>
                      {(rotation !== 0 || flipHorizontal || flipVertical) && (
                        <span className="text-[10px] text-cyan-400 font-mono">
                          {rotation}° {flipHorizontal ? 'H' : ''} {flipVertical ? 'V' : ''}
                        </span>
                      )}
                    </label>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { r: 0, label: '0°' },
                        { r: 90, label: '90°' },
                        { r: 180, label: '180°' },
                        { r: 270, label: '270°' },
                      ].map((item, idx) => (
                        <button
                          key={`${item.r}-${idx}`}
                          type="button"
                          onClick={() => setRotation(item.r as any)}
                          className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                            rotation === item.r
                              ? 'bg-cyan-600 border-cyan-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFlipHorizontal(!flipHorizontal)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          flipHorizontal
                            ? 'bg-cyan-600 border-cyan-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FlipHorizontal className="w-3.5 h-3.5" />
                        <span>{isZh ? '水平翻转' : 'Flip H'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFlipVertical(!flipVertical)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          flipVertical
                            ? 'bg-cyan-600 border-cyan-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <FlipVertical className="w-3.5 h-3.5" />
                        <span>{isZh ? '垂直翻转' : 'Flip V'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Brightness, Contrast, Saturation */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                      <span>{isZh ? '亮度 / 对比度 / 饱和度' : 'Color Adjustments'}</span>
                      <button
                        type="button"
                        onClick={handleResetAdjustments}
                        className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        {isZh ? '重置全部' : 'Reset All'}
                      </button>
                    </label>

                    {/* Brightness */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{isZh ? '亮度 (Brightness)' : 'Brightness'}</span>
                        <span className="font-mono text-cyan-400">{brightness > 0 ? `+${brightness}` : brightness}</span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    {/* Contrast */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{isZh ? '对比度 (Contrast)' : 'Contrast'}</span>
                        <span className="font-mono text-cyan-400">{contrast > 0 ? `+${contrast}` : contrast}</span>
                      </div>
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    {/* Saturation */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">{isZh ? '饱和度 (Saturation)' : 'Saturation'}</span>
                        <span className="font-mono text-cyan-400">{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={saturation}
                        onChange={(e) => setSaturation(parseInt(e.target.value, 10))}
                        className="w-full accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Creative & Industrial Filters */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      {isZh ? '特效与工业滤镜' : 'Creative & Stencil Filters'}
                    </label>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGrayscale(!grayscale)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          grayscale
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '黑白灰度' : 'Grayscale'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSharpen(!sharpen)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          sharpen
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '锐化增强' : 'Sharpen'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSepia(!sepia)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          sepia
                            ? 'bg-amber-700 border-amber-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '怀旧暖色' : 'Sepia'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setInvert(!invert)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          invert
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '底片反相' : 'Invert'}
                      </button>
                    </div>

                    {/* Laser / Signage Binary High-Contrast Threshold */}
                    <div className="pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={threshold}
                            onChange={(e) => setThreshold(e.target.checked)}
                            className="rounded accent-cyan-500 cursor-pointer"
                          />
                          <span>{isZh ? '纯黑白二值化 (激光雕刻/标牌切割)' : 'Laser / CNC Binary Threshold'}</span>
                        </label>
                        {threshold && (
                          <span className="font-mono text-xs text-cyan-400">{thresholdVal}</span>
                        )}
                      </div>
                      {threshold && (
                        <div className="mt-1.5 space-y-1">
                          <input
                            type="range"
                            min="1"
                            max="254"
                            value={thresholdVal}
                            onChange={(e) => setThresholdVal(parseInt(e.target.value, 10))}
                            className="w-full accent-cyan-400 cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>{isZh ? '偏白' : 'More White'}</span>
                            <span>{isZh ? '偏黑' : 'More Black'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WATERMARK */}
              {sidebarTab === 'watermark' && (
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Stamp className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isZh ? '添加防伪/品牌水印' : 'Branding Watermark'}</span>
                    </label>
                    {watermarkText && (
                      <button
                        type="button"
                        onClick={() => setWatermarkText('')}
                        className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                      >
                        {isZh ? '清除' : 'Clear'}
                      </button>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">
                      {isZh ? '水印文字 (留空则不添加):' : 'Watermark Text:'}
                    </span>
                    <input
                      type="text"
                      placeholder={isZh ? '例如: 报价样品 / HALO SIGNAGE' : 'e.g. SAMPLE / CONFIDENTIAL'}
                      value={watermarkText}
                      onChange={(e) => setWatermarkText(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-cyan-400"
                    />
                  </div>

                  {watermarkText && (
                    <>
                      {/* Position */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block">
                          {isZh ? '水印位置:' : 'Position:'}
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: 'center', labelZh: '居中', labelEn: 'Center' },
                            { id: 'bottom-right', labelZh: '右下角', labelEn: 'Bottom-R' },
                            { id: 'top-right', labelZh: '右上角', labelEn: 'Top-R' },
                            { id: 'bottom-left', labelZh: '左下角', labelEn: 'Bottom-L' },
                            { id: 'tile', labelZh: '全屏平铺', labelEn: 'Tile' },
                          ].map((pos, idx) => (
                            <button
                              key={`${pos.id}-${idx}`}
                              type="button"
                              onClick={() => setWatermarkPosition(pos.id as any)}
                              className={`py-1 text-center rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                watermarkPosition === pos.id
                                  ? 'bg-cyan-600 border-cyan-400 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                              }`}
                            >
                              {isZh ? pos.labelZh : pos.labelEn}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Opacity */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">{isZh ? '透明度' : 'Opacity'}:</span>
                          <span className="font-mono text-cyan-400">
                            {Math.round(watermarkOpacity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.1"
                          max="1.0"
                          step="0.05"
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>

                      {/* Color */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 block">
                          {isZh ? '文字颜色:' : 'Color:'}
                        </span>
                        <div className="flex items-center gap-2">
                          {[
                            { color: '#ffffff', label: '白' },
                            { color: '#000000', label: '黑' },
                            { color: '#ef4444', label: '红' },
                            { color: '#06b6d4', label: '青' },
                          ].map((c, idx) => (
                            <button
                              key={`${c.color}-${idx}`}
                              type="button"
                              onClick={() => setWatermarkColor(c.color)}
                              className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                watermarkColor === c.color
                                  ? 'border-cyan-400 ring-2 ring-cyan-400/50 bg-slate-800'
                                  : 'border-slate-700 bg-slate-900 text-slate-400'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: c.color }}
                              />
                              <span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right Main Panel: Batch Queue or Studio Compare */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-900/60 p-4 min-h-0">
              {/* VIEW 1: BATCH QUEUE */}
              {activeView === 'batch' && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                  {/* Top Bar: Add Images + Batch Execution Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.heic,.heif,.svg,.pdf,.bmp,.webp,.avif,.tiff,.tif,.gif,.ico"
                        multiple
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-cyan-600/25 cursor-pointer active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isZh ? '选择图片添加...' : 'Add Images...'}</span>
                      </button>

                      {queue.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>{isZh ? '清空' : 'Clear'}</span>
                        </button>
                      )}
                    </div>

                    {/* Batch Execution Buttons */}
                    {queue.length > 0 && (
                      <div className="flex items-center gap-2">
                        {/* Convert All */}
                        <button
                          type="button"
                          disabled={isProcessingAll}
                          onClick={handleConvertAll}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-blue-600/30 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
                        >
                          {isProcessingAll ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-cyan-300" />
                          )}
                          <span>{isZh ? '一键转换全部' : 'Convert All'}</span>
                        </button>

                        {/* Download All as ZIP */}
                        <button
                          type="button"
                          onClick={handleDownloadAllZip}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
                        >
                          <Archive className="w-4 h-4" />
                          <span>{isZh ? '打包 ZIP' : 'ZIP'}</span>
                        </button>

                        {/* Merge All into Multi-Page PDF Dropdown */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setPdfMergeMenuOpen(!pdfMergeMenuOpen)}
                            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-purple-600/30 cursor-pointer active:scale-95 transition-all"
                          >
                            <FileText className="w-4 h-4" />
                            <span>{isZh ? '合并为多页 PDF' : 'Merge to PDF'}</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          {pdfMergeMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-30 space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 block">
                                {isZh ? '选择页面版式:' : 'Page Layout:'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleMergeAllToPdf('fit')}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
                              >
                                {isZh ? '自适应原图尺寸' : 'Auto-Fit Original'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMergeAllToPdf('a4_portrait')}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
                              >
                                {isZh ? 'A4 纵向 (Portrait)' : 'A4 Portrait'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMergeAllToPdf('a4_landscape')}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-slate-200 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
                              >
                                {isZh ? 'A4 横向 (Landscape)' : 'A4 Landscape'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Empty Drag and Drop State */}
                  {queue.length === 0 && (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 text-center cursor-pointer transition-colors bg-slate-950/40 ${
                        isDragOver
                          ? 'border-cyan-400 bg-cyan-950/20'
                          : 'border-slate-800 hover:border-cyan-500/60'
                      }`}
                    >
                      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-inner">
                        <Upload className="w-8 h-8" />
                      </div>
                      <h4 className="font-bold text-base sm:text-lg text-white flex items-center justify-center gap-2">
                        <span>{isZh ? '点击或拖拽图片到此处' : 'Click or Drag & Drop Images Here'}</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-1.5 max-w-lg leading-relaxed">
                        {isZh
                          ? '全面支持 iPhone 苹果相机照片 (.heic / .heif)、AVIF、PNG、JPG、WEBP、TIFF (ProRAW)、BMP、GIF、SVG、PDF。支持 Ctrl+V 直接粘贴系统截屏！'
                          : 'Full support for iPhone Camera photos (.heic / .heif), AVIF, PNG, JPG, WEBP, TIFF (ProRAW), BMP, GIF, SVG, PDF. Press Ctrl+V anytime to paste screenshots!'}
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 text-[11px] font-mono text-cyan-400/90 bg-cyan-950/50 px-3.5 py-1.5 rounded-full border border-cyan-500/30">
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                          <Smartphone className="w-3.5 h-3.5" />
                          iPhone HEIC
                        </span>
                        <span className="text-slate-500">•</span>
                        <span>AVIF</span>
                        <span className="text-slate-500">•</span>
                        <span>TIFF</span>
                        <span className="text-slate-500">•</span>
                        <span>PNG</span>
                        <span className="text-slate-500">•</span>
                        <span>JPG</span>
                        <span className="text-slate-500">•</span>
                        <span>WEBP</span>
                        <span className="text-slate-500">•</span>
                        <span>BMP</span>
                        <span className="text-slate-500">•</span>
                        <span>GIF</span>
                        <span className="text-slate-500">•</span>
                        <span>PDF</span>
                        <span className="text-slate-500">•</span>
                        <span>ICO</span>
                      </div>
                    </div>
                  )}

                  {/* Queue Items List */}
                  {queue.length > 0 && (
                    <div className="flex-1 overflow-y-auto mac-scrollbar pr-1 space-y-2">
                      {queue.map((item, index) => {
                        const isDone = item.status === 'done' && !!item.result;
                        const isConverting = item.status === 'converting';

                        return (
                          <div
                            key={`${item.id}-${index}`}
                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors"
                          >
                            {/* Left: Thumbnail & File Info */}
                            <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                              <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 font-mono font-bold text-xs text-slate-400 flex items-center justify-center shrink-0">
                                {index + 1}
                              </span>

                              <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 relative">
                                <img
                                  src={item.previewUrl}
                                  alt={item.file.name}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-xs">
                                    {item.file.name}
                                  </p>
                                  {item.isHeic && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
                                      <Smartphone className="w-2.5 h-2.5" />
                                      iPhone HEIC
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                                  <span>{formatFileSize(item.file.size)}</span>
                                  <span>•</span>
                                  <span className="text-slate-300">
                                    {item.originalWidth} × {item.originalHeight} px
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Middle: Conversion Result & Comparison Info */}
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                              <ArrowRight className="w-4 h-4 text-slate-600 hidden sm:block" />

                              {isDone && item.result ? (
                                <div className="flex items-center gap-2.5">
                                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-cyan-500/40 overflow-hidden flex items-center justify-center shrink-0">
                                    <img
                                      src={item.result.dataUrl}
                                      alt={item.result.convertedName}
                                      className="max-w-full max-h-full object-contain"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/40 text-[10px] font-mono font-bold uppercase">
                                        {item.result.format}
                                      </span>
                                      <span className="text-xs text-emerald-400 font-mono font-bold">
                                        {formatFileSize(item.result.convertedSize)}
                                      </span>
                                      {item.result.convertedSize < item.file.size && (
                                        <span className="text-[10px] text-emerald-400 font-bold">
                                          (-
                                          {Math.round(
                                            (1 - item.result.convertedSize / item.file.size) * 100
                                          )}
                                          %)
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                                      {item.result.convertedWidth} × {item.result.convertedHeight} px
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
                                  {isConverting
                                    ? isZh
                                      ? '正在转换中...'
                                      : 'Converting...'
                                    : `${isZh ? '待转为' : 'To'}: ${targetFormat.toUpperCase()}`}
                                </span>
                              )}
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              {isDone && item.result ? (
                                <>
                                  {/* Copy Image to Clipboard */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyImageToClipboard(item.result!)}
                                    className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 cursor-pointer"
                                    title={isZh ? '复制图片到剪贴板' : 'Copy Image to Clipboard'}
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Copy Base64 */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyBase64(item.result!)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                                    title={isZh ? '复制 Base64 Data URL' : 'Copy Base64'}
                                  >
                                    <Code className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Inspect in Studio */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemForCompare(item);
                                      setActiveView('compare');
                                    }}
                                    className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 cursor-pointer"
                                    title={isZh ? '在画质对比台查看' : 'Inspect in Studio'}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Open in PDF Editor if PDF format */}
                                  {onOpenInEditor && item.result.format === 'pdf' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        const buf = await item.result!.blob.arrayBuffer();
                                        onOpenInEditor(buf, item.result!.convertedName);
                                        onClose();
                                      }}
                                      className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 cursor-pointer"
                                      title={isZh ? '在 PDF 编辑器中打开' : 'Open in PDF Editor'}
                                    >
                                      <FileCheck className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  {/* Download Single */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadBlobFile(item.result!.blob, item.result!.convertedName)
                                    }
                                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 transition-all"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>{isZh ? '下载' : 'Download'}</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isConverting}
                                  onClick={() => handleConvertSingleItem(item.id)}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50"
                                >
                                  {isConverting ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isZh ? '转换' : 'Convert'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: STUDIO & REAL-TIME COMPARE */}
              {activeView === 'compare' && (
                <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                  {selectedItemForCompare ? (
                    <div className="flex-1 flex flex-col overflow-hidden space-y-3">
                      {/* Compare Header */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-white truncate max-w-xs">
                            {selectedItemForCompare.file.name}
                          </span>
                          {selectedItemForCompare.isHeic && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center gap-0.5">
                              <Smartphone className="w-2.5 h-2.5" />
                              iPhone HEIC
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-mono">
                            ({selectedItemForCompare.originalWidth} × {selectedItemForCompare.originalHeight} px)
                          </span>
                        </div>

                        {/* Zoom & Action Controls */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                            <button
                              type="button"
                              onClick={() => setStudioZoom(Math.max(0.5, studioZoom - 0.25))}
                              className="p-1 hover:text-white text-slate-400 cursor-pointer"
                              title="Zoom Out"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-mono text-[11px] px-1 text-slate-300">
                              {Math.round(studioZoom * 100)}%
                            </span>
                            <button
                              type="button"
                              onClick={() => setStudioZoom(Math.min(3, studioZoom + 0.25))}
                              className="p-1 hover:text-white text-slate-400 cursor-pointer"
                              title="Zoom In"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleConvertSingleItem(selectedItemForCompare.id)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{isZh ? '以当前参数渲染' : 'Render with Settings'}</span>
                          </button>

                          {selectedItemForCompare.result && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopyImageToClipboard(selectedItemForCompare.result!)}
                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>{isZh ? '复制图片' : 'Copy'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  downloadBlobFile(
                                    selectedItemForCompare.result!.blob,
                                    selectedItemForCompare.result!.convertedName
                                  )
                                }
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>{isZh ? '下载结果' : 'Download'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Side by Side Canvases */}
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0 overflow-hidden">
                        {/* Original Canvas Box */}
                        <div className="flex flex-col rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-300">
                            <span>{isZh ? '原始图像 (Original)' : 'Original'}</span>
                            <span className="font-mono text-slate-400">
                              {formatFileSize(selectedItemForCompare.file.size)}
                            </span>
                          </div>
                          <div className="flex-1 p-4 flex items-center justify-center overflow-auto mac-scrollbar bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                            <img
                              src={selectedItemForCompare.previewUrl}
                              alt="Original"
                              style={{ transform: `scale(${studioZoom})`, transformOrigin: 'center' }}
                              className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform"
                            />
                          </div>
                        </div>

                        {/* Converted Canvas Box */}
                        <div className="flex flex-col rounded-xl bg-slate-950 border border-cyan-500/30 overflow-hidden">
                          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-cyan-300">
                            <span>
                              {isZh ? '转换后效果 (Output)' : 'Converted Output'} (
                              {targetFormat.toUpperCase()})
                            </span>
                            {selectedItemForCompare.result && (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-emerald-400 font-bold">
                                  {formatFileSize(selectedItemForCompare.result.convertedSize)}
                                </span>
                                {selectedItemForCompare.result.convertedSize <
                                  selectedItemForCompare.file.size && (
                                  <span className="text-[10px] text-emerald-400 font-bold">
                                    (-
                                    {Math.round(
                                      (1 -
                                        selectedItemForCompare.result.convertedSize /
                                          selectedItemForCompare.file.size) *
                                        100
                                    )}
                                    %)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 p-4 flex items-center justify-center overflow-auto mac-scrollbar bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                            {selectedItemForCompare.result ? (
                              <img
                                src={selectedItemForCompare.result.dataUrl}
                                alt="Converted"
                                style={{ transform: `scale(${studioZoom})`, transformOrigin: 'center' }}
                                className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform"
                              />
                            ) : (
                              <div className="text-center p-6 text-slate-500">
                                <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-600 animate-pulse" />
                                <p className="text-xs">
                                  {isZh
                                    ? '点击上方「以当前参数渲染」预览调色、格式及压缩效果'
                                    : 'Click Render to preview adjustments and output'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <ImageIcon className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-sm">
                        {isZh ? '请先在批量队列中添加并选择一张图片' : 'Please select an image from the batch queue'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveView('batch')}
                        className="mt-3 px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold text-xs cursor-pointer"
                      >
                        {isZh ? '返回队列' : 'Back to Queue'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
