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
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  watermarkPdfDocument,
  downloadPdfBytes,
  readFileAsArrayBuffer,
} from '../../utils/pdfEditor';
import { loadPdfDocument, renderPdfPageToCanvas } from '../../utils/pdfRenderer';

export interface PdfWatermarkTabProps {
  currentActivePdfBytes?: ArrayBuffer | Uint8Array | null;
  currentActivePdfName?: string;
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
  onCloseModal: () => void;
  showToast: (msg: string) => void;
}

const WATERMARK_PRESETS = [
  { label: 'DRAFT', text: 'DRAFT / 方案草稿' },
  { label: 'SAMPLE', text: 'SAMPLE ONLY / 打样审阅' },
  { label: 'CONFIDENTIAL', text: 'CONFIDENTIAL / 商业机密' },
  { label: 'PAID', text: 'PAID / 已付清' },
  { label: 'APPROVED', text: 'APPROVED / 审阅通过' },
  { label: 'HALO SIGN', text: 'HALO DESIGN STUDIO' },
];

const COLOR_PRESETS = [
  { label: 'Red', hex: '#ef4444', name: '经典警示红' },
  { label: 'Gray', hex: '#64748b', name: '极简低调灰' },
  { label: 'Blue', hex: '#3b82f6', name: '科技商务蓝' },
  { label: 'Emerald', hex: '#10b981', name: '合规通过绿' },
  { label: 'Amber', hex: '#f59e0b', name: '提示警示黄' },
  { label: 'Purple', hex: '#8b5cf6', name: '奢华紫' },
];

export const PdfWatermarkTab: React.FC<PdfWatermarkTabProps> = ({
  currentActivePdfBytes,
  currentActivePdfName = 'Current_Document.pdf',
  onOpenInEditor,
  onCloseModal,
  showToast,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [pageCount, setPageCount] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Watermark Options
  const [watermarkText, setWatermarkText] = useState<string>('SAMPLE ONLY / 打样审阅');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');
  const [opacity, setOpacity] = useState<number>(0.25);
  const [fontSize, setFontSize] = useState<number>(46);
  const [rotationAngle, setRotationAngle] = useState<number>(-45);
  const [targetPagesMode, setTargetPagesMode] = useState<'all' | 'first' | 'custom'>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('1');

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadPdfData = async (bytes: ArrayBuffer | Uint8Array, name: string) => {
    try {
      setIsProcessing(true);
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      setFileBytes(uint8);
      setFileName(name);

      const doc = await loadPdfDocument(uint8);
      setPdfDoc(doc);
      setPageCount(doc.numPages);
      showToast(isZh ? `已载入文档 (${doc.numPages} 页)` : `Loaded document (${doc.numPages} pages)`);
    } catch (err: any) {
      console.error('Failed to load PDF for watermark:', err);
      showToast(isZh ? `载入失败: ${err.message}` : `Load failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render preview of Page 1
  useEffect(() => {
    if (!pdfDoc || !previewCanvasRef.current) return;
    let isMounted = true;

    renderPdfPageToCanvas(pdfDoc, 1, previewCanvasRef.current, 0.45).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [pdfDoc]);

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

  const handleUseCurrentDoc = () => {
    if (!currentActivePdfBytes) {
      showToast(isZh ? '当前暂无可用的开单文档' : 'No active quote available');
      return;
    }
    loadPdfData(currentActivePdfBytes, currentActivePdfName);
  };

  const handleApplyWatermark = async (openInEditor: boolean = false) => {
    if (!fileBytes) {
      showToast(isZh ? '请先上传需要添加水印的 PDF' : 'Please upload a PDF first');
      return;
    }
    if (!watermarkText.trim()) {
      showToast(isZh ? '请输入水印文字' : 'Please enter watermark text');
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
        text: watermarkText.trim(),
        fontSize,
        color: selectedColor,
        opacity,
        rotationDegrees: rotationAngle,
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

  return (
    <div className="space-y-4">
      {/* Upload Bar */}
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
            <span>({pageCount} {isZh ? '页' : 'pages'})</span>
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
                ? '为设计方案、图纸、开单报价单加盖「DRAFT/草稿」「SAMPLE/打样审阅」「商业机密」「已付清」等防盗用半透明防伪水印。'
                : 'Protect proprietary designs and blueprints with customizable translucent text watermarks.'}
            </p>
          </div>
        </div>
      )}

      {/* Watermark Configuration & Preview */}
      {fileBytes && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Controls Form */}
          <div className="lg:col-span-7 space-y-4 bg-slate-900/90 rounded-2xl p-4 border border-slate-800">
            {/* Watermark Text */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-pink-400" />
                  {isZh ? '水印文字内容:' : 'Watermark Text:'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {watermarkText.length} {isZh ? '字符' : 'chars'}
                </span>
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={e => setWatermarkText(e.target.value)}
                placeholder={isZh ? '输入水印文字内容...' : 'Enter watermark text...'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:border-pink-500 focus:outline-hidden"
              />

              {/* Preset Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {WATERMARK_PRESETS.map((preset, idx) => (
                  <button
                    key={`wm-preset-${preset.label}-${idx}`}
                    type="button"
                    onClick={() => setWatermarkText(preset.text)}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color & Opacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              {/* Color Swatches */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                  {isZh ? '水印颜色:' : 'Color:'}
                </label>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c, idx) => (
                    <button
                      key={`wm-color-${c.hex}-${idx}`}
                      type="button"
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                        selectedColor === c.hex
                          ? 'ring-2 ring-white scale-110 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                    />
                  ))}
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
                  min="0.08"
                  max="0.85"
                  step="0.02"
                  value={opacity}
                  onChange={e => setOpacity(parseFloat(e.target.value))}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Font Size & Rotation Angle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              {/* Font Size */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{isZh ? '字体大小:' : 'Font Size:'}</span>
                  <span className="text-slate-400 font-mono">{fontSize} pt</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[32, 42, 54, 68].map((sz, idx) => (
                    <button
                      key={`wm-sz-${sz}-${idx}`}
                      type="button"
                      onClick={() => setFontSize(sz)}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        fontSize === sz
                          ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rotation Angle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{isZh ? '倾斜角度:' : 'Angle:'}</span>
                  <span className="text-slate-400 font-mono">{rotationAngle}°</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {[-45, 0, 45, 90].map((deg, idx) => (
                    <button
                      key={`wm-deg-${deg}-${idx}`}
                      type="button"
                      onClick={() => setRotationAngle(deg)}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        rotationAngle === deg
                          ? 'bg-pink-600/30 border-pink-500 text-pink-200'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Pages */}
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
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pb-2 border-b border-slate-800">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  {isZh ? '第 1 页实时水印效果预览' : 'Live Preview (Page 1)'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {pageCount > 1 ? (isZh ? `共 ${pageCount} 页` : `${pageCount} pages`) : ''}
                </span>
              </div>

              {/* Preview Canvas Wrapper with Overlay Watermark */}
              <div className="relative mt-3 w-full aspect-[1/1.3] bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[220px] max-w-[170px] object-contain shadow-lg"
                />

                {/* Simulated Live Watermark Text */}
                <div
                  style={{
                    color: selectedColor,
                    opacity: opacity,
                    transform: `translate(-50%, -50%) rotate(${rotationAngle}deg)`,
                    fontSize: `${Math.round(fontSize * 0.42)}px`,
                  }}
                  className="absolute top-1/2 left-1/2 font-black whitespace-nowrap pointer-events-none select-none tracking-wider text-center drop-shadow-sm font-sans"
                >
                  {watermarkText || 'SAMPLE'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleApplyWatermark(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
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
