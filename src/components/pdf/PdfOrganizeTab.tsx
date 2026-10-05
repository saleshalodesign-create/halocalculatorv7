import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Download,
  RotateCw,
  RotateCcw,
  Trash2,
  MoveLeft,
  MoveRight,
  FileText,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Eye,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  organizePdfDocument,
  downloadPdfBytes,
  readFileAsArrayBuffer,
} from '../../utils/pdfEditor';
import { loadPdfDocument, renderPdfPageToCanvas } from '../../utils/pdfRenderer';

export interface PdfOrganizeTabProps {
  currentActivePdfBytes?: ArrayBuffer | Uint8Array | null;
  currentActivePdfName?: string;
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
  onCloseModal: () => void;
  showToast: (msg: string) => void;
}

interface PageItem {
  id: string;
  originalIndex: number; // 0-based
  rotation: number; // 0, 90, 180, 270
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const PdfOrganizeTab: React.FC<PdfOrganizeTabProps> = ({
  currentActivePdfBytes,
  currentActivePdfName = 'Current_Document.pdf',
  onOpenInEditor,
  onCloseModal,
  showToast,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  const [pages, setPages] = useState<PageItem[]>([]);
  const [deletedPages, setDeletedPages] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultBytes, setResultBytes] = useState<Uint8Array | null>(null);
  const [resultName, setResultName] = useState<string>('');

  // Thumbnails canvas refs
  const canvasRefs = useRef<{ [originalIndex: number]: HTMLCanvasElement | null }>({});

  const loadPdfData = async (bytes: ArrayBuffer | Uint8Array, name: string) => {
    try {
      setIsProcessing(true);
      const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      setFileBytes(uint8);
      setFileName(name);
      setFileSize(uint8.byteLength);
      setResultBytes(null);

      const loadedDoc = await loadPdfDocument(uint8);
      setPdfDoc(loadedDoc);

      const count = loadedDoc.numPages;
      const initialPages: PageItem[] = [];
      for (let i = 0; i < count; i++) {
        initialPages.push({
          id: `page-${i}-${Date.now()}`,
          originalIndex: i,
          rotation: 0,
        });
      }
      setPages(initialPages);
      setDeletedPages([]);
      showToast(isZh ? `已成功载入 ${count} 页 PDF` : `Loaded ${count} pages`);
    } catch (err: any) {
      console.error('Failed to load PDF in organize tab:', err);
      showToast(isZh ? `加载失败: ${err.message}` : `Load failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Render thumbnails
  useEffect(() => {
    if (!pdfDoc || pages.length === 0) return;

    let isMounted = true;
    const renderThumbnails = async () => {
      for (const pageItem of pages) {
        const canvas = canvasRefs.current[pageItem.originalIndex];
        if (!canvas) continue;
        try {
          await renderPdfPageToCanvas(pdfDoc, pageItem.originalIndex + 1, canvas, 0.4);
        } catch {
          // ignore individual cancel/render failure
        }
        if (!isMounted) break;
      }
    };

    renderThumbnails();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, pages]);

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

  // Rotation actions
  const rotateSinglePage = (pageId: string, deltaAngle: number) => {
    setPages(prev =>
      prev.map(p => {
        if (p.id !== pageId) return p;
        const nextRot = ((p.rotation + deltaAngle) % 360 + 360) % 360;
        return { ...p, rotation: nextRot };
      })
    );
  };

  const rotateAllPages = (deltaAngle: number) => {
    setPages(prev =>
      prev.map(p => ({
        ...p,
        rotation: ((p.rotation + deltaAngle) % 360 + 360) % 360,
      }))
    );
    showToast(isZh ? `已全部旋转 ${deltaAngle > 0 ? '+' : ''}${deltaAngle}°` : `Rotated all pages`);
  };

  const resetAllRotations = () => {
    setPages(prev => prev.map(p => ({ ...p, rotation: 0 })));
    showToast(isZh ? '已重置所有页面旋转角度' : 'Reset rotations');
  };

  // Reorder actions
  const movePage = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;

    setPages(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Delete / restore actions
  const deletePage = (index: number) => {
    if (pages.length <= 1) {
      showToast(isZh ? '文档至少需保留 1 页' : 'At least one page must remain');
      return;
    }
    const removed = pages[index];
    setDeletedPages(prev => [...prev, removed.originalIndex]);
    setPages(prev => prev.filter((_, i) => i !== index));
    showToast(isZh ? `已移除第 ${index + 1} 页 (原第 ${removed.originalIndex + 1} 页)` : 'Page removed');
  };

  const restoreAllPages = () => {
    if (!pdfDoc) return;
    const count = pdfDoc.numPages;
    const restored: PageItem[] = [];
    for (let i = 0; i < count; i++) {
      restored.push({
        id: `page-${i}-${Date.now()}`,
        originalIndex: i,
        rotation: 0,
      });
    }
    setPages(restored);
    setDeletedPages([]);
    showToast(isZh ? '已恢复全部原始页面' : 'Restored all pages');
  };

  // Export organized PDF
  const handleExport = async (openInEditor: boolean = false) => {
    if (!fileBytes || pages.length === 0) {
      showToast(isZh ? '请先载入 PDF 页面' : 'Please load a PDF first');
      return;
    }

    try {
      setIsProcessing(true);
      const pageOrder = pages.map(p => p.originalIndex);
      const rotations: Record<number, number> = {};
      pages.forEach(p => {
        if (p.rotation !== 0) {
          rotations[p.originalIndex] = p.rotation;
        }
      });

      const organizedBytes = await organizePdfDocument(fileBytes, pageOrder, rotations);
      const baseName = fileName.replace(/\.pdf$/i, '');
      const outName = `${baseName}_organized.pdf`;

      setResultBytes(organizedBytes);
      setResultName(outName);

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(organizedBytes, outName);
        onCloseModal();
      } else {
        downloadPdfBytes(organizedBytes, outName);
        showToast(isZh ? '✨ PDF 整理与旋转完成！已自动下载' : 'PDF organized & downloaded successfully!');
      }
    } catch (err: any) {
      console.error('Failed to export organized PDF:', err);
      showToast(isZh ? `导出失败: ${err.message}` : `Export failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload & Top Action Bar */}
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
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
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
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>{isZh ? '使用当前开单文档' : 'Use Current Quote'}</span>
            </button>
          )}
        </div>

        {fileBytes && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-semibold text-slate-200 max-w-[200px] truncate">{fileName}</span>
            <span>({formatFileSize(fileSize)})</span>
            {deletedPages.length > 0 && (
              <button
                type="button"
                onClick={restoreAllPages}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isZh ? `恢复已删 (${deletedPages.length}页)` : `Restore (${deletedPages.length})`}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!fileBytes && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-slate-950/40"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <RotateCw className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-base text-white">
              {isZh ? '上传需要整理或旋转页面的 PDF' : 'Upload PDF to Organize & Rotate Pages'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {isZh
                ? '支持每页 90° / 180° / 270° 单独或批量旋转，支持拖动调整前后页面顺序、剔除空白页及指定页面导出。'
                : 'Rotate individual or all pages, reorder pages, and delete unwanted blank or draft pages.'}
            </p>
          </div>
        </div>
      )}

      {/* Pages Workspace */}
      {fileBytes && pages.length > 0 && (
        <div className="space-y-4">
          {/* Batch Quick Operations Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400 font-semibold px-2">
                {isZh ? '批量旋转:' : 'Batch Rotate:'}
              </span>
              <button
                type="button"
                onClick={() => rotateAllPages(90)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
              >
                <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                <span>{isZh ? '全部顺时针 90°' : 'All +90° CW'}</span>
              </button>
              <button
                type="button"
                onClick={() => rotateAllPages(-90)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isZh ? '全部逆时针 90°' : 'All -90° CCW'}</span>
              </button>
              <button
                type="button"
                onClick={() => rotateAllPages(180)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                <span>{isZh ? '全部 180°' : 'All 180°'}</span>
              </button>
              <button
                type="button"
                onClick={resetAllRotations}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-slate-200 border border-slate-700 flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>{isZh ? '复原角度' : 'Reset'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-300 font-bold px-2">
              {isZh ? `当前剩余 ${pages.length} 页` : `${pages.length} pages remaining`}
            </div>
          </div>

          {/* Page Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[50vh] overflow-y-auto p-1 mac-scrollbar">
            {pages.map((p, idx) => (
              <div
                key={`org-page-${p.id}-${idx}`}
                className="group relative rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-2 flex flex-col justify-between transition-all shadow-md"
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 pb-1.5 border-b border-slate-800/80">
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                    {isZh ? `第 ${idx + 1} 页` : `Page ${idx + 1}`}
                  </span>
                  {p.rotation !== 0 && (
                    <span className="px-1 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px]">
                      +{p.rotation}°
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    #{p.originalIndex + 1}
                  </span>
                </div>

                {/* Canvas Thumbnail Area */}
                <div className="relative w-full aspect-[1/1.3] my-2 bg-slate-950/80 rounded-lg overflow-hidden flex items-center justify-center border border-slate-800/50">
                  <div
                    style={{
                      transform: `rotate(${p.rotation}deg)`,
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="flex items-center justify-center max-w-full max-h-full"
                  >
                    <canvas
                      ref={el => {
                        canvasRefs.current[p.originalIndex] = el;
                      }}
                      className="max-h-[140px] max-w-[105px] object-contain shadow-sm"
                    />
                  </div>
                </div>

                {/* Tool Buttons */}
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-1">
                  {/* Rotate CCW */}
                  <button
                    type="button"
                    onClick={() => rotateSinglePage(p.id, -90)}
                    title={isZh ? '逆时针旋转 90°' : 'Rotate -90°'}
                    className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Rotate CW */}
                  <button
                    type="button"
                    onClick={() => rotateSinglePage(p.id, 90)}
                    title={isZh ? '顺时针旋转 90°' : 'Rotate +90°'}
                    className="p-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Left */}
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => movePage(idx, 'left')}
                    title={isZh ? '向前移动' : 'Move Earlier'}
                    className={`p-1 rounded-md transition-colors ${
                      idx === 0
                        ? 'opacity-30 cursor-not-allowed bg-slate-900 text-slate-600'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                    }`}
                  >
                    <MoveLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Right */}
                  <button
                    type="button"
                    disabled={idx === pages.length - 1}
                    onClick={() => movePage(idx, 'right')}
                    title={isZh ? '向后移动' : 'Move Later'}
                    className={`p-1 rounded-md transition-colors ${
                      idx === pages.length - 1
                        ? 'opacity-30 cursor-not-allowed bg-slate-900 text-slate-600'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer'
                    }`}
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => deletePage(idx)}
                    title={isZh ? '剔除此页' : 'Delete Page'}
                    className="p-1 rounded-md bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Export Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                {isZh ? '生成结果:' : 'Output:'}
              </span>
              <span>
                {pages.length} {isZh ? '个页面' : 'pages'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {onOpenInEditor && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleExport(true)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-400" />
                  <span>{isZh ? '在编辑器中打开' : 'Open in Editor'}</span>
                </button>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleExport(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                {isProcessing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? isZh
                      ? '处理中...'
                      : 'Processing...'
                    : isZh
                    ? '导出并下载整理后的 PDF'
                    : 'Download Organized PDF'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
