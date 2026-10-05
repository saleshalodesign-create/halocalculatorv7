import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  Image as ImageIcon,
  Trash2,
  MoveUp,
  MoveDown,
  ExternalLink,
  RefreshCw,
  Plus,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  convertImagesToPdf,
  imageFileToBytes,
  downloadPdfBytes,
  ImagesToPdfOptions,
} from '../../utils/pdfEditor';

export interface PdfImagesToPdfTabProps {
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
  onCloseModal: () => void;
  showToast: (msg: string) => void;
}

interface ImageItem {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfImagesToPdfTab: React.FC<PdfImagesToPdfTabProps> = ({
  onOpenInEditor,
  onCloseModal,
  showToast,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<'fit' | 'a4_portrait' | 'a4_landscape'>('a4_portrait');
  const [margin, setMargin] = useState<'none' | 'compact' | 'normal'>('compact');
  const [outputName, setOutputName] = useState<string>('Site_Photos_Compilation.pdf');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setIsProcessing(true);
      const newItems: ImageItem[] = [];

      for (const file of files) {
        try {
          const { bytes, mimeType } = await imageFileToBytes(file);
          const dataUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
          newItems.push({
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: file.name,
            size: file.size,
            dataUrl,
            bytes,
            mimeType,
          });
        } catch (err: any) {
          console.error(`Failed to process image ${file.name}:`, err);
        }
      }

      setImages(prev => [...prev, ...newItems]);
      showToast(isZh ? `已添加 ${newItems.length} 张图片` : `Added ${newItems.length} images`);
    } catch (err: any) {
      showToast(isZh ? `导入失败: ${err.message}` : `Import failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= images.length) return;
    setImages(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIdx];
      updated[targetIdx] = temp;
      return updated;
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setImages([]);
  };

  const handleGeneratePdf = async (openInEditor: boolean = false) => {
    if (images.length === 0) {
      showToast(isZh ? '请先上传至少一张图片' : 'Please upload at least one image');
      return;
    }

    try {
      setIsProcessing(true);
      const options: ImagesToPdfOptions = {
        pageSize,
        margin,
      };

      const pdfBytes = await convertImagesToPdf(
        images.map(img => ({ bytes: img.bytes, mimeType: img.mimeType })),
        options
      );

      const finalName = outputName.trim().endsWith('.pdf')
        ? outputName.trim()
        : `${outputName.trim()}.pdf`;

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(pdfBytes, finalName);
        onCloseModal();
      } else {
        downloadPdfBytes(pdfBytes, finalName);
        showToast(isZh ? '✨ 图片已成功合成 PDF 并下载！' : 'Images converted to PDF successfully!');
      }
    } catch (err: any) {
      console.error('Failed to convert images to PDF:', err);
      showToast(isZh ? `生成失败: ${err.message}` : `Generation failed: ${err.message}`);
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
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isZh ? '添加图片文件 (JPG / PNG / WebP)...' : 'Add Image Files...'}</span>
          </button>
        </div>

        {images.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              {isZh ? `已选择 ${images.length} 张图片` : `${images.length} images selected`}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isZh ? '清空' : 'Clear'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {images.length === 0 && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-teal-500 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-slate-950/40"
        >
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <ImageIcon className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-base text-white">
              {isZh ? '上传现场测量照片、招牌效果图或施工底稿' : 'Upload Photos or Renderings to Convert to PDF'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {isZh
                ? '支持将多张现场安装勘测照片、招牌设计图纸一键编排并导出为高清正式 PDF 文件，方便快速发送给客户或施工队。'
                : 'Combine multiple job photos, site proofs, and mockups into a single clean PDF for clients or installers.'}
            </p>
          </div>
        </div>
      )}

      {/* Images List and Configuration */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Images Queue List */}
          <div className="lg:col-span-7 space-y-2 max-h-[50vh] overflow-y-auto mac-scrollbar pr-1">
            {images.map((img, idx) => (
              <div
                key={`img-item-${img.id}-${idx}`}
                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-teal-500/50 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center text-xs font-bold text-slate-400 font-mono">
                    {idx + 1}
                  </span>
                  <div className="w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{img.name}</p>
                    <p className="text-[11px] text-slate-500">{formatFileSize(img.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveImage(idx, 'up')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      idx === 0
                        ? 'opacity-25 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                    }`}
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === images.length - 1}
                    onClick={() => moveImage(idx, 'down')}
                    className={`p-1.5 rounded-lg transition-colors ${
                      idx === images.length - 1
                        ? 'opacity-25 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                    }`}
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Settings & Generate Column */}
          <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h4 className="font-bold text-xs text-slate-300 uppercase tracking-wider pb-2 border-b border-slate-800">
                {isZh ? 'PDF 页面与版式设置' : 'Page Layout Options'}
              </h4>

              {/* Page Format */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isZh ? '页面尺寸规范:' : 'Page Size Format:'}
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPageSize('a4_portrait')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors flex items-center justify-between ${
                      pageSize === 'a4_portrait'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{isZh ? 'A4 纵向 (适合现场勘测清单)' : 'A4 Portrait'}</span>
                    <span className="text-[10px] opacity-70">210 × 297 mm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPageSize('a4_landscape')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors flex items-center justify-between ${
                      pageSize === 'a4_landscape'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{isZh ? 'A4 横向 (适合门头招牌展开展览)' : 'A4 Landscape'}</span>
                    <span className="text-[10px] opacity-70">297 × 210 mm</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPageSize('fit')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors flex items-center justify-between ${
                      pageSize === 'fit'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{isZh ? '自适应原图比例 (无黑边裁切)' : 'Fit to Original Dimensions'}</span>
                    <span className="text-[10px] opacity-70">Auto</span>
                  </button>
                </div>
              </div>

              {/* Page Margin */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isZh ? '页面留白边距:' : 'Page Margin:'}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMargin('none')}
                    className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      margin === 'none'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isZh ? '无边距 (满版)' : 'None'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMargin('compact')}
                    className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      margin === 'compact'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isZh ? '紧凑 (10mm)' : 'Compact'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMargin('normal')}
                    className={`py-1.5 rounded-lg text-xs font-semibold border text-center transition-colors ${
                      margin === 'normal'
                        ? 'bg-teal-600/25 border-teal-500 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isZh ? '标准 (20mm)' : 'Standard'}
                  </button>
                </div>
              </div>

              {/* Output Filename */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  {isZh ? '保存文档文件名:' : 'Output File Name:'}
                </label>
                <input
                  type="text"
                  value={outputName}
                  onChange={e => setOutputName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-xs focus:border-teal-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleGeneratePdf(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? isZh
                      ? '正在合成 PDF...'
                      : 'Converting...'
                    : isZh
                    ? `合成并下载 PDF (${images.length} 张图)`
                    : `Generate & Download PDF (${images.length})`}
                </span>
              </button>

              {onOpenInEditor && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleGeneratePdf(true)}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-400" />
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
