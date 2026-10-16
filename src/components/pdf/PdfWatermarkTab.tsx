import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  FileText,
  ExternalLink,
  RefreshCw,
  Stamp,
  Sliders,
  Palette,
  Type,
  Eye,
  CheckCircle2,
  Image as ImageIcon,
  Grid,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Check,
  RotateCw,
} from 'lucide-react';
import { Theme, ThemeType } from '../../types';
import { getModalThemeStyle } from '../../utils/columnThemes';
import { useLanguage } from '../../context/LanguageContext';
import {
  watermarkPdfDocument,
  downloadPdfBytes,
  readFileAsArrayBuffer,
  renderStampToDataUrl,
} from '../../utils/pdfEditor';
import { getHaloLogoBase64 } from '../../utils/pdfGenerator';
import { loadPdfDocument, renderPdfPageToCanvas } from '../../utils/pdfRenderer';

export interface PdfWatermarkTabProps {
  currentActivePdfBytes?: ArrayBuffer | Uint8Array | null;
  currentActivePdfName?: string;
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
  onCloseModal: () => void;
  showToast: (msg: string) => void;
  theme?: ThemeType;
}

const WATERMARK_PRESETS = [
  { label: 'SAMPLE', text: 'SAMPLE ONLY / 打样审阅' },
  { label: 'DRAFT', text: 'DRAFT / 方案草稿' },
  { label: 'CONFIDENTIAL', text: 'CONFIDENTIAL / 商业机密' },
  { label: 'PAID', text: 'PAID / 已付清' },
  { label: 'APPROVED', text: 'APPROVED / 审阅通过' },
  { label: 'DO NOT COPY', text: 'DO NOT COPY / 严禁复印' },
  { label: 'FOR REVIEW', text: 'CLIENT REVIEW / 客户确认' },
  { label: 'HALO SIGN', text: 'HALO DESIGN STUDIO' },
];

const COLOR_PRESETS = [
  { label: 'Red', hex: '#ef4444', name: '经典警示红' },
  { label: 'Gray', hex: '#64748b', name: '极简低调灰' },
  { label: 'Blue', hex: '#2563eb', name: '科技商务蓝' },
  { label: 'Emerald', hex: '#10b981', name: '合规通过绿' },
  { label: 'Amber', hex: '#f59e0b', name: '提示警示黄' },
  { label: 'Purple', hex: '#8b5cf6', name: '奢华紫' },
];

const FONT_PRESETS = [
  {
    id: 'modern',
    nameZh: '现代无衬线 (Sans)',
    nameEn: 'Modern Sans',
    font: '-apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "SF Pro Display", "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'serif',
    nameZh: '正式衬线 (Serif)',
    nameEn: 'Formal Serif',
    font: '"Times New Roman", Times, Georgia, "Songti SC", "SimSun", serif',
  },
  {
    id: 'mono',
    nameZh: '等宽数字 (Mono)',
    nameEn: 'Tech Mono',
    font: '"Space Mono", "Courier New", Menlo, Monaco, monospace',
  },
  {
    id: 'impact',
    nameZh: '粗体醒目 (Impact)',
    nameEn: 'Impact Bold',
    font: 'Impact, "Arial Black", "SF Pro Display", sans-serif',
  },
];

const LAYOUT_OPTIONS = [
  { id: 'center', labelZh: '正中单个', labelEn: 'Center' },
  { id: 'tiled', labelZh: '全屏平铺 (防盗版)', labelEn: 'Tiled Grid' },
  { id: 'topLeft', labelZh: '左上角', labelEn: 'Top-Left' },
  { id: 'topRight', labelZh: '右上角', labelEn: 'Top-Right' },
  { id: 'bottomLeft', labelZh: '左下角', labelEn: 'Bottom-Left' },
  { id: 'bottomRight', labelZh: '右下角', labelEn: 'Bottom-Right' },
  { id: 'header', labelZh: '页眉横幅', labelEn: 'Header' },
  { id: 'footer', labelZh: '页脚横幅', labelEn: 'Footer' },
];

export const PdfWatermarkTab: React.FC<PdfWatermarkTabProps> = ({
  currentActivePdfBytes,
  currentActivePdfName = 'Current_Document.pdf',
  onOpenInEditor,
  onCloseModal,
  showToast,
  theme = Theme.DARK,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';
  const modalTheme = getModalThemeStyle(theme);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(1);

  // Watermark Mode: Text vs Image/Logo
  const [watermarkMode, setWatermarkMode] = useState<'text' | 'image'>('text');

  // Text Watermark Options
  const [watermarkText, setWatermarkText] = useState<string>('SAMPLE ONLY / 打样审阅');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.25);
  const [fontSize, setFontSize] = useState<number>(44);
  const [rotationAngle, setRotationAngle] = useState<number>(-45);
  const [selectedFont, setSelectedFont] = useState<string>(FONT_PRESETS[0].font);
  const [isOutline, setIsOutline] = useState<boolean>(false);
  const [outlineWidth, setOutlineWidth] = useState<number>(2);

  // Layout & Density
  const [layout, setLayout] = useState<
    'center' | 'tiled' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'header' | 'footer'
  >('center');
  const [tiledDensity, setTiledDensity] = useState<'compact' | 'normal' | 'sparse'>('normal');

  // Image Watermark Options
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageScale, setImageScale] = useState<number>(0.45);
  const [activeImagePreset, setActiveImagePreset] = useState<'none' | 'halo_logo' | 'halo_chop' | 'custom'>('halo_logo');

  // Target Pages
  const [targetPagesMode, setTargetPagesMode] = useState<'all' | 'first' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('1');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Load default preset logo on mount
  useEffect(() => {
    try {
      const haloLogo = getHaloLogoBase64('DESIGN HUB');
      if (haloLogo) {
        setImageDataUrl(haloLogo);
      }
    } catch (_) {}
  }, []);

  const loadPdfData = async (bytes: ArrayBuffer | Uint8Array, name: string) => {
    try {
      setIsProcessing(true);
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      setFileBytes(uint8);
      setFileName(name);

      const doc = await loadPdfDocument(uint8);
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      setPreviewPageIndex(1);
      showToast(isZh ? `已载入文档 (${doc.numPages} 页)` : `Loaded document (${doc.numPages} pages)`);
    } catch (err: any) {
      console.error('Failed to load PDF for watermark:', err);
      showToast(isZh ? `载入失败: ${err.message}` : `Load failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render preview of current page
  useEffect(() => {
    if (!pdfDoc || !previewCanvasRef.current) return;
    let isMounted = true;

    renderPdfPageToCanvas(pdfDoc, previewPageIndex, previewCanvasRef.current, 0.45).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pdfDoc, previewPageIndex]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await readFileAsArrayBuffer(file);
      await loadPdfData(buffer, file.name);
    } catch (err: any) {
      showToast(isZh ? `读取文件失败: ${err.message}` : `Failed to read file: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageDataUrl(reader.result);
          setActiveImagePreset('custom');
          setWatermarkMode('image');
          showToast(isZh ? '图片徽标已上传！' : 'Custom logo image loaded!');
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast(isZh ? `读取图片失败: ${err.message}` : `Failed to load image: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleSelectImagePreset = (type: 'halo_logo' | 'halo_chop') => {
    setActiveImagePreset(type);
    setWatermarkMode('image');
    if (type === 'halo_logo') {
      const logo = getHaloLogoBase64('DESIGN HUB');
      setImageDataUrl(logo);
      setImageScale(0.5);
      showToast(isZh ? '已应用 Halo Design 官方 Logo' : 'Selected Halo Design Logo');
    } else if (type === 'halo_chop') {
      const { dataUrl } = renderStampToDataUrl('HALO DESIGN HUB\nUEN: 53142015M', '#b91c1c', '#fff1f2', 15);
      setImageDataUrl(dataUrl);
      setImageScale(0.65);
      showToast(isZh ? '已应用官方公司印章' : 'Selected Official Company Seal');
    }
  };

  const handleUseCurrentDoc = () => {
    if (!currentActivePdfBytes) {
      showToast(isZh ? '当前暂无可用的开单文档' : 'No active quote available');
      return;
    }
    loadPdfData(currentActivePdfBytes, currentActivePdfName);
  };

  // Append dynamic tags to watermark text
  const handleInsertTag = (tag: string) => {
    if (tag === 'date') {
      const d = new Date().toISOString().split('T')[0];
      setWatermarkText(prev => `${prev} ${d}`);
    } else if (tag === 'time') {
      const tStr = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      setWatermarkText(prev => `${prev} ${tStr}`);
    } else if (tag === 'confidential') {
      setWatermarkText(prev => `${prev} [CONFIDENTIAL]`);
    } else if (tag === 'uen') {
      setWatermarkText(prev => `${prev} UEN: 53142015M`);
    }
  };

  const handleApplyWatermark = async (openInEditor: boolean = false) => {
    if (!fileBytes) {
      showToast(isZh ? '请先上传需要添加水印的 PDF' : 'Please upload a PDF first');
      return;
    }

    if (watermarkMode === 'text' && !watermarkText.trim()) {
      showToast(isZh ? '请输入水印文字' : 'Please enter watermark text');
      return;
    }

    if (watermarkMode === 'image' && !imageDataUrl) {
      showToast(isZh ? '请先上传或选择徽标印章图片' : 'Please upload or select an image');
      return;
    }

    try {
      setIsProcessing(true);
      const targetPages =
        targetPagesMode === 'all'
          ? 'all'
          : targetPagesMode === 'first'
          ? 'first'
          : customPageRange;

      const watermarkedBytes = await watermarkPdfDocument(fileBytes, {
        type: watermarkMode,
        text: watermarkText.trim(),
        imageDataUrl: watermarkMode === 'image' ? imageDataUrl : undefined,
        imageScale,
        fontSize,
        color: selectedColor,
        opacity,
        rotationDegrees: layout === 'header' || layout === 'footer' ? 0 : rotationAngle,
        fontFamily: selectedFont,
        isOutline,
        outlineWidth,
        layout,
        tiledDensity,
        targetPages,
      });

      const baseName = fileName.replace(/\.pdf$/i, '');
      const outName = `${baseName}_watermarked.pdf`;

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(watermarkedBytes, outName);
        onCloseModal();
      } else {
        downloadPdfBytes(watermarkedBytes, outName);
        showToast(isZh ? '✨ 水印添加成功！已开始自动下载' : 'Watermark added successfully! Downloaded.');
      }
    } catch (err: any) {
      console.error('Failed to add watermark:', err);
      showToast(isZh ? `添加水印失败: ${err.message}` : `Watermark failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Computed rotation angle for preview display
  const effectivePreviewAngle = layout === 'header' || layout === 'footer' ? 0 : rotationAngle;

  return (
    <div className="space-y-4">
      {/* Upload & Source Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>{isZh ? '选择 PDF 文件...' : 'Select PDF File...'}</span>
          </button>

          {currentActivePdfBytes && (
            <button
              type="button"
              onClick={handleUseCurrentDoc}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4 text-pink-400" />
              <span>{isZh ? '使用当前开单文档' : 'Use Current Quote'}</span>
            </button>
          )}
        </div>

        {fileBytes && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-200 max-w-[200px] truncate">{fileName}</span>
            <span>
              ({pageCount} {isZh ? '页' : 'pages'})
            </span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {!fileBytes && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-pink-500 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-slate-950/40"
        >
          <div className="w-14 h-14 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Stamp className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-base text-white">
              {isZh ? '上传需要添加水印盖章的 PDF' : 'Upload PDF to Add Watermark'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {isZh
                ? '支持文字水印（实体填充 / 空心描边）、全屏平铺防盗版矩阵、官方印章徽标与全套排版布局。'
                : 'Supports text watermarks (solid / outline), anti-piracy tiled grid, official seal & logo presets.'}
            </p>
          </div>
        </div>
      )}

      {/* Watermark Configuration & Preview */}
      {fileBytes && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Controls Column */}
          <div className="lg:col-span-7 space-y-4 bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
            {/* Watermark Type Selector (Text vs Image) */}
            <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setWatermarkMode('text')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  watermarkMode === 'text'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>{isZh ? '文字水印 (Text)' : 'Text Watermark'}</span>
              </button>

              <button
                type="button"
                onClick={() => setWatermarkMode('image')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  watermarkMode === 'image'
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isZh ? '徽标印章水印 (Image / Seal)' : 'Image / Logo Watermark'}</span>
              </button>
            </div>

            {/* --- SECTION 1: TEXT MODE CONTROLS --- */}
            {watermarkMode === 'text' && (
              <div className="space-y-3.5">
                {/* Watermark Text Input & Quick Tags */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-pink-400" />
                      {isZh ? '水印文字内容:' : 'Watermark Text:'}
                    </span>
                    {/* Dynamic tag insert buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleInsertTag('date')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                        title="Insert today's date"
                      >
                        + {isZh ? '日期' : 'Date'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('time')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                        title="Insert current time"
                      >
                        + {isZh ? '时间' : 'Time'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertTag('confidential')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 transition-colors"
                        title="Append CONFIDENTIAL"
                      >
                        + {isZh ? '机密' : 'Conf'}
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={watermarkText}
                    onChange={e => setWatermarkText(e.target.value)}
                    placeholder={isZh ? '输入水印文字内容...' : 'Enter watermark text...'}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:border-pink-500 focus:outline-hidden"
                  />

                  {/* Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {WATERMARK_PRESETS.map((preset, idx) => (
                      <button
                        key={`wm-preset-${preset.label}-${idx}`}
                        type="button"
                        onClick={() => setWatermarkText(preset.text)}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                          watermarkText === preset.text
                            ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Family & Typography Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      {isZh ? '字体风格:' : 'Font Style:'}
                    </label>
                    <select
                      value={selectedFont}
                      onChange={e => setSelectedFont(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:border-pink-500 outline-none"
                    >
                      {FONT_PRESETS.map(f => (
                        <option key={f.id} value={f.font}>
                          {isZh ? f.nameZh : f.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Solid vs Hollow Outline Style */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span>{isZh ? '字型渲染:' : 'Fill Style:'}</span>
                      {isOutline && (
                        <span className="text-[10px] text-pink-400 font-mono">
                          {outlineWidth}px
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsOutline(false)}
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          !isOutline
                            ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '实体文字 (Solid)' : 'Solid Fill'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsOutline(true)}
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          isOutline
                            ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {isZh ? '空心镂空 (Outline)' : 'Outline'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- SECTION 2: IMAGE / LOGO MODE CONTROLS --- */}
            {watermarkMode === 'image' && (
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
                      {isZh ? '选择徽标印章预设或上传自定义图片:' : 'Logo & Seal Presets:'}
                    </span>
                  </label>

                  {/* Preset Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectImagePreset('halo_logo')}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        activeImagePreset === 'halo_logo'
                          ? 'bg-pink-600/20 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-lime-400" />
                      <span className="text-[11px] font-bold">Halo Design Logo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectImagePreset('halo_chop')}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        activeImagePreset === 'halo_chop'
                          ? 'bg-pink-600/20 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Stamp className="w-4 h-4 text-red-400" />
                      <span className="text-[11px] font-bold">{isZh ? '官方红色印章' : 'Official Seal'}</span>
                    </button>

                    <input
                      ref={imageUploadRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => imageUploadRef.current?.click()}
                      className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all cursor-pointer ${
                        activeImagePreset === 'custom'
                          ? 'bg-pink-600/20 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-4 h-4 text-indigo-400" />
                      <span className="text-[11px] font-bold">{isZh ? '上传自定义图片' : 'Upload Image'}</span>
                    </button>
                  </div>
                </div>

                {/* Image Scale Slider */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>{isZh ? '图片尺寸缩放:' : 'Image Size Scale:'}</span>
                    <span className="text-pink-400 font-mono">{Math.round(imageScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.15"
                    max="1.2"
                    step="0.05"
                    value={imageScale}
                    onChange={e => setImageScale(parseFloat(e.target.value))}
                    className="w-full accent-pink-500 cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* --- SECTION 3: LAYOUT & POSITIONING --- */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Grid className="w-3.5 h-3.5 text-indigo-400" />
                  {isZh ? '排版布局位置:' : 'Layout & Placement:'}
                </span>
                {layout === 'tiled' && (
                  <span className="text-[11px] text-pink-400 font-bold">
                    {isZh ? '防盗截图平铺矩阵' : 'Anti-Theft Matrix'}
                  </span>
                )}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {LAYOUT_OPTIONS.map(opt => (
                  <button
                    key={`wm-layout-${opt.id}`}
                    type="button"
                    onClick={() => setLayout(opt.id as any)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer ${
                      layout === opt.id
                        ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isZh ? opt.labelZh : opt.labelEn}
                  </button>
                ))}
              </div>

              {/* Tiled Grid Density selector */}
              {layout === 'tiled' && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">{isZh ? '平铺密度:' : 'Grid Density:'}</span>
                  {(['sparse', 'normal', 'compact'] as const).map(density => (
                    <button
                      key={`density-${density}`}
                      type="button"
                      onClick={() => setTiledDensity(density)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        tiledDensity === density
                          ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {density === 'sparse'
                        ? isZh
                          ? '稀疏 (3×2)'
                          : 'Sparse'
                        : density === 'compact'
                        ? isZh
                          ? '密集 (5×4)'
                          : 'Dense'
                        : isZh
                        ? '适中 (4×3)'
                        : 'Normal'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* --- SECTION 4: COLOR & OPACITY --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              {/* Color Swatches + Native Color Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    {isZh ? '水印颜色:' : 'Color:'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono uppercase">{selectedColor}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  {COLOR_PRESETS.map((c, idx) => (
                    <button
                      key={`wm-color-${c.hex}-${idx}`}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        selectedColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'ring-2 ring-white scale-110 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    />
                  ))}

                  {/* Native Color Picker for custom brand color */}
                  <label
                    title={isZh ? '自定义任意颜色' : 'Custom color'}
                    className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center cursor-pointer hover:border-white transition-colors overflow-hidden"
                    style={{ backgroundColor: selectedColor }}
                  >
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={e => setSelectedColor(e.target.value)}
                      className="opacity-0 w-0 h-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    {isZh ? '透明度:' : 'Opacity:'}
                  </span>
                  <span className="text-pink-400 font-mono">{Math.round(opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.85"
                  step="0.02"
                  value={opacity}
                  onChange={e => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            {/* --- SECTION 5: FONT SIZE & ROTATION ANGLE --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              {/* Font Size (Slider + Steppers) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{isZh ? '字体大小:' : 'Font Size:'}</span>
                  <span className="text-slate-400 font-mono">{fontSize} pt</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="96"
                  step="2"
                  value={fontSize}
                  onChange={e => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
                <div className="flex items-center gap-1">
                  {[28, 44, 56, 72].map(sz => (
                    <button
                      key={`sz-${sz}`}
                      type="button"
                      onClick={() => setFontSize(sz)}
                      className={`flex-1 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                        fontSize === sz
                          ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {sz}pt
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation Angle (Slider + Presets) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1">
                    <RotateCw className="w-3 h-3 text-pink-400" />
                    {isZh ? '倾斜角度:' : 'Angle:'}
                  </span>
                  <span className="text-slate-400 font-mono">{effectivePreviewAngle}°</span>
                </div>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="5"
                  disabled={layout === 'header' || layout === 'footer'}
                  value={rotationAngle}
                  onChange={e => setRotationAngle(parseInt(e.target.value, 10))}
                  className="w-full accent-pink-500 cursor-pointer disabled:opacity-40"
                />
                <div className="flex items-center gap-1">
                  {[
                    { deg: -45, label: '↗ -45°' },
                    { deg: 0, label: '→ 0°' },
                    { deg: 45, label: '↘ 45°' },
                    { deg: 90, label: '↑ 90°' },
                  ].map(a => (
                    <button
                      key={`angle-${a.deg}`}
                      type="button"
                      disabled={layout === 'header' || layout === 'footer'}
                      onClick={() => setRotationAngle(a.deg)}
                      className={`flex-1 py-0.5 rounded text-[10px] font-semibold border transition-colors disabled:opacity-30 ${
                        rotationAngle === a.deg
                          ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* --- SECTION 6: TARGET PAGES --- */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-bold text-slate-300">
                {isZh ? '盖印应用页面范围:' : 'Apply to Pages:'}
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetPagesMode('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    targetPagesMode === 'all'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isZh ? '全部页面 (All Pages)' : 'All Pages'}
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPagesMode('first')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    targetPagesMode === 'first'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isZh ? '仅首页 (First Page Only)' : 'First Page Only'}
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPagesMode('custom')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    targetPagesMode === 'custom'
                      ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isZh ? '指定页码范围' : 'Custom Range'}
                </button>

                {targetPagesMode === 'custom' && (
                  <input
                    type="text"
                    value={customPageRange}
                    onChange={e => setCustomPageRange(e.target.value)}
                    placeholder="如: 1, 3-5"
                    className="w-28 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Live Preview Column */}
          <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between">
            <div>
              {/* Preview Header & Multi-page controls */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  {isZh ? `第 ${previewPageIndex} 页实时水印效果预览` : `Live Preview (Page ${previewPageIndex})`}
                </span>

                {pageCount > 1 && (
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      disabled={previewPageIndex <= 1}
                      onClick={() => setPreviewPageIndex(p => Math.max(1, p - 1))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-3 h-3 text-slate-300" />
                    </button>
                    <span className="font-mono text-slate-400 px-1">
                      {previewPageIndex} / {pageCount}
                    </span>
                    <button
                      type="button"
                      disabled={previewPageIndex >= pageCount}
                      onClick={() => setPreviewPageIndex(p => Math.min(pageCount, p + 1))}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-3 h-3 text-slate-300" />
                    </button>
                  </div>
                )}
              </div>

              {/* Preview Canvas Wrapper with Overlay Watermark */}
              <div className="relative mt-3 w-full aspect-[1/1.3] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 select-none">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[240px] max-w-[185px] object-contain shadow-lg"
                />

                {/* --- LIVE SIMULATED WATERMARK OVERLAY --- */}
                {layout === 'tiled' ? (
                  /* Tiled Grid Matrix Pattern Overlay */
                  <div className="absolute inset-0 pointer-events-none overflow-hidden grid grid-cols-3 grid-rows-4 p-2 gap-1 items-center justify-items-center">
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <div
                        key={`tile-preview-${idx}`}
                        style={{
                          color: isOutline ? 'transparent' : selectedColor,
                          opacity: opacity * 0.85,
                          transform: `rotate(${effectivePreviewAngle}deg)`,
                          fontSize: `${Math.round(fontSize * 0.22)}px`,
                          fontFamily: selectedFont,
                          WebkitTextStroke: isOutline ? `${outlineWidth * 0.6}px ${selectedColor}` : 'none',
                        }}
                        className="font-black whitespace-nowrap text-center tracking-wider"
                      >
                        {watermarkMode === 'image' && imageDataUrl ? (
                          <img
                            src={imageDataUrl}
                            alt="Watermark Tile"
                            style={{
                              width: `${Math.round(imageScale * 38)}px`,
                              opacity: opacity * 0.85,
                            }}
                            className="object-contain"
                          />
                        ) : (
                          watermarkText || 'SAMPLE'
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Single Placement Overlay (Center, Corners, Header, Footer) */
                  <div
                    style={{
                      color: isOutline ? 'transparent' : selectedColor,
                      opacity: opacity,
                      transform: `translate(-50%, -50%) rotate(${effectivePreviewAngle}deg)`,
                      fontSize: `${Math.round(fontSize * 0.42)}px`,
                      fontFamily: selectedFont,
                      WebkitTextStroke: isOutline ? `${outlineWidth}px ${selectedColor}` : 'none',
                      left:
                        layout === 'topLeft' || layout === 'bottomLeft'
                          ? '30%'
                          : layout === 'topRight' || layout === 'bottomRight'
                          ? '70%'
                          : '50%',
                      top:
                        layout === 'topLeft' || layout === 'topRight'
                          ? '30%'
                          : layout === 'bottomLeft' || layout === 'bottomRight'
                          ? '70%'
                          : layout === 'header'
                          ? '15%'
                          : layout === 'footer'
                          ? '85%'
                          : '50%',
                    }}
                    className="absolute font-black whitespace-nowrap pointer-events-none select-none tracking-wider text-center drop-shadow-sm"
                  >
                    {watermarkMode === 'image' && imageDataUrl ? (
                      <img
                        src={imageDataUrl}
                        alt="Watermark Logo"
                        style={{
                          width: `${Math.round(imageScale * 140)}px`,
                          opacity: opacity,
                        }}
                        className="object-contain"
                      />
                    ) : (
                      watermarkText || 'SAMPLE'
                    )}
                  </div>
                )}
              </div>

              {/* Status summary tag */}
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                <span>
                  {watermarkMode === 'text' ? (isZh ? '模式: 文字水印' : 'Mode: Text') : (isZh ? '模式: 徽标印章' : 'Mode: Logo')}
                </span>
                <span>
                  {layout === 'tiled' ? (isZh ? '平铺矩阵 (全屏)' : 'Tiled Matrix') : (isZh ? '单点定位' : 'Single Position')}
                </span>
                <span>{effectivePreviewAngle}°</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleApplyWatermark(false)}
                className={`w-full py-2.5 rounded-xl ${modalTheme.activeTabGradient} flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all text-white font-bold text-xs sm:text-sm shadow-md`}
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? isZh
                      ? '水印压印中...'
                      : 'Applying...'
                    : isZh
                    ? '生成并下载加水印 PDF'
                    : 'Download Watermarked PDF'}
                </span>
              </button>

              {onOpenInEditor && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleApplyWatermark(true)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-pink-400" />
                  <span>{isZh ? '生成并在 PDF 编辑器中打开' : 'Open in Editor'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
