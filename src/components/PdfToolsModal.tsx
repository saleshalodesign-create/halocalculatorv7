import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Layers,
  Scissors,
  Upload,
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileCheck,
  CheckCircle2,
  FileText,
  Plus,
  RefreshCw,
  ExternalLink,
  Split,
  ChevronRight,
  Eye,
  Check,
  Copy,
} from 'lucide-react';
import {
  PdfJoinItem,
  mergePdfDocuments,
  splitPdfDocument,
  splitPdfToPages,
  splitPdfByChunkSize,
  parsePageRange,
  getPdfPageCount,
  downloadPdfBytes,
  readFileAsArrayBuffer,
} from '../utils/pdfEditor';
import { useLanguage } from '../context/LanguageContext';

export interface PdfToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'join' | 'split';
  currentActivePdfBytes?: ArrayBuffer | Uint8Array | null;
  currentActivePdfName?: string;
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
}

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'join',
  currentActivePdfBytes,
  currentActivePdfName = 'Current_Document.pdf',
  onOpenInEditor,
}) => {
  const { language } = useLanguage();
  const isZh = language === 'zh';

  const [activeTab, setActiveTab] = useState<'join' | 'split'>(initialTab);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string>('');
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  // -------------------------------------------------------------
  // TAB 1: PDF JOINER (MERGE) STATE
  // -------------------------------------------------------------
  const [joinFiles, setJoinFiles] = useState<PdfJoinItem[]>([]);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Automatically offer current document if joinFiles is empty
  const handleAddCurrentDocumentToJoin = async () => {
    if (!currentActivePdfBytes) {
      showToast(isZh ? '当前暂无可用的开单文档' : 'No active document available');
      return;
    }
    const count = await getPdfPageCount(currentActivePdfBytes);
    const newItem: PdfJoinItem = {
      id: `join-curr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: currentActivePdfName || 'Halo_Quotation.pdf',
      bytes: currentActivePdfBytes,
      size: currentActivePdfBytes.byteLength,
      pageCount: count,
      selectedRangeText: '',
    };
    setJoinFiles(prev => [...prev, newItem]);
    showToast(isZh ? `已加入当前文档 (共 ${count} 页)` : `Added current document (${count} pages)`);
  };

  const handleJoinFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newItems: PdfJoinItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      try {
        const buffer = await readFileAsArrayBuffer(file);
        const count = await getPdfPageCount(buffer);
        newItems.push({
          id: `join-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          bytes: buffer,
          size: file.size,
          pageCount: count,
          selectedRangeText: '',
        });
      } catch (err) {
        console.warn('Failed to parse PDF file for join:', file.name, err);
      }
    }

    if (newItems.length > 0) {
      setJoinFiles(prev => [...prev, ...newItems]);
      showToast(isZh ? `已添加 ${newItems.length} 个 PDF 文件` : `Added ${newItems.length} PDF files`);
    }
    e.target.value = '';
  };

  const handleMoveFileUp = (index: number) => {
    if (index <= 0) return;
    setJoinFiles(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveFileDown = (index: number) => {
    if (index >= joinFiles.length - 1) return;
    setJoinFiles(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleRemoveJoinFile = (id: string) => {
    setJoinFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateFileRange = (id: string, range: string) => {
    setJoinFiles(prev => prev.map(f => (f.id === id ? { ...f, selectedRangeText: range } : f)));
  };

  const handleExecuteMerge = async (openInEditor: boolean = false) => {
    if (joinFiles.length < 2) {
      showToast(isZh ? '请至少添加 2 个 PDF 文件进行合并' : 'Please add at least 2 PDF files to merge');
      return;
    }

    try {
      setIsMerging(true);
      const mergedBytes = await mergePdfDocuments(joinFiles);
      const outName = `Merged_Document_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(mergedBytes, outName);
        onClose();
      } else {
        downloadPdfBytes(mergedBytes, outName);
        showToast(isZh ? '合并成功！已开始下载 PDF' : 'Merge successful! PDF downloaded.');
      }
    } catch (err: any) {
      console.error('Failed to merge PDFs:', err);
      showToast(isZh ? `合并失败: ${err.message || '未知错误'}` : `Merge failed: ${err.message || 'Error'}`);
    } finally {
      setIsMerging(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: PDF SPLITTER STATE
  // -------------------------------------------------------------
  const [splitFileBytes, setSplitFileBytes] = useState<ArrayBuffer | Uint8Array | null>(() => currentActivePdfBytes || null);
  const [splitFileName, setSplitFileName] = useState<string>(() => currentActivePdfName || 'document.pdf');
  const [splitTotalPages, setSplitTotalPages] = useState<number>(1);
  const [splitMode, setSplitMode] = useState<'selected' | 'range' | 'single' | 'chunk'>('selected');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set([0]));
  const [customRangeInput, setCustomRangeInput] = useState<string>('1-2');
  const [chunkSize, setChunkSize] = useState<number>(2);
  const [isSplitting, setIsSplitting] = useState<boolean>(false);
  const singlePdfInputRef = useRef<HTMLInputElement>(null);

  // Initialize page count when split source changes
  useEffect(() => {
    if (splitFileBytes) {
      getPdfPageCount(splitFileBytes).then(count => {
        setSplitTotalPages(count);
        setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i)));
        setCustomRangeInput(count > 1 ? `1-${Math.min(count, 3)}` : '1');
      });
    }
  }, [splitFileBytes]);

  const handleSplitFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast(isZh ? '请选择有效 .pdf 文件' : 'Please select a valid PDF file');
      return;
    }
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const count = await getPdfPageCount(buffer);
      setSplitFileBytes(buffer);
      setSplitFileName(file.name);
      setSplitTotalPages(count);
      setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i)));
      setCustomRangeInput(count > 1 ? `1-${Math.min(count, 3)}` : '1');
      showToast(isZh ? `已载入: ${file.name} (共 ${count} 页)` : `Loaded ${file.name} (${count} pages)`);
    } catch (err) {
      console.warn('Failed to load PDF for splitting:', err);
    }
    e.target.value = '';
  };

  const handleUseCurrentQuoteForSplit = async () => {
    if (!currentActivePdfBytes) {
      showToast(isZh ? '当前暂无可用的开单文档' : 'No active quote document available');
      return;
    }
    const count = await getPdfPageCount(currentActivePdfBytes);
    setSplitFileBytes(currentActivePdfBytes);
    setSplitFileName(currentActivePdfName || 'Halo_Document.pdf');
    setSplitTotalPages(count);
    setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i)));
    showToast(isZh ? `已载入当前文档 (${count} 页)` : `Loaded current document (${count} pages)`);
  };

  const togglePageSelection = (pageIdx: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageIdx)) {
        if (next.size > 1) next.delete(pageIdx);
      } else {
        next.add(pageIdx);
      }
      return next;
    });
  };

  const handleSelectAllPages = () => {
    setSelectedPages(new Set(Array.from({ length: splitTotalPages }, (_, i) => i)));
  };

  const handleSelectOddPages = () => {
    const odds = new Set<number>();
    for (let i = 0; i < splitTotalPages; i += 2) odds.add(i);
    setSelectedPages(odds);
  };

  const handleSelectEvenPages = () => {
    const evens = new Set<number>();
    for (let i = 1; i < splitTotalPages; i += 2) evens.add(i);
    if (evens.size > 0) setSelectedPages(evens);
  };

  const handleExecuteSplit = async (openInEditor: boolean = false) => {
    if (!splitFileBytes) {
      showToast(isZh ? '请先上传或载入要拆分的 PDF' : 'Please upload a PDF to split');
      return;
    }

    try {
      setIsSplitting(true);
      const baseName = splitFileName.replace(/\.pdf$/i, '');

      if (splitMode === 'selected') {
        const pagesArray = Array.from(selectedPages).sort((a, b) => a - b);
        if (pagesArray.length === 0) {
          showToast(isZh ? '请至少勾选一页' : 'Please select at least 1 page');
          return;
        }
        const splitBytes = await splitPdfDocument(splitFileBytes, pagesArray);
        const outName = `${baseName}_selected_${pagesArray.map(p => p + 1).join('-')}.pdf`;

        if (openInEditor && onOpenInEditor) {
          onOpenInEditor(splitBytes, outName);
          onClose();
        } else {
          downloadPdfBytes(splitBytes, outName);
          showToast(isZh ? `成功提取 ${pagesArray.length} 页！已开始下载` : `Extracted ${pagesArray.length} pages!`);
        }
      } else if (splitMode === 'range') {
        const pagesArray = parsePageRange(customRangeInput, splitTotalPages);
        if (pagesArray.length === 0) {
          showToast(isZh ? '输入的页码范围无效，例如: 1-3, 5' : 'Invalid page range. E.g. 1-3, 5');
          return;
        }
        const splitBytes = await splitPdfDocument(splitFileBytes, pagesArray);
        const outName = `${baseName}_pages_${customRangeInput.replace(/[^0-9-]/g, '_')}.pdf`;

        if (openInEditor && onOpenInEditor) {
          onOpenInEditor(splitBytes, outName);
          onClose();
        } else {
          downloadPdfBytes(splitBytes, outName);
          showToast(isZh ? `成功按范围提取 ${pagesArray.length} 页！` : `Extracted ${pagesArray.length} pages!`);
        }
      } else if (splitMode === 'single') {
        // Single page splitting: download all individual pages
        const singlePages = await splitPdfToPages(splitFileBytes);
        for (const item of singlePages) {
          downloadPdfBytes(item.bytes, `${baseName}_Page_${item.pageNumber}.pdf`);
          await new Promise(r => setTimeout(r, 200)); // small delay for browser downloads
        }
        showToast(isZh ? `已将 ${singlePages.length} 个页面分别导出下载！` : `Downloaded all ${singlePages.length} single pages!`);
      } else if (splitMode === 'chunk') {
        const chunks = await splitPdfByChunkSize(splitFileBytes, chunkSize);
        for (const chunk of chunks) {
          downloadPdfBytes(chunk.bytes, `${baseName}_${chunk.rangeText}.pdf`);
          await new Promise(r => setTimeout(r, 250));
        }
        showToast(isZh ? `已按每 ${chunkSize} 页一份成功导出 ${chunks.length} 份文件！` : `Exported ${chunks.length} chunks!`);
      }
    } catch (err: any) {
      console.error('Failed to split PDF:', err);
      showToast(isZh ? `拆分失败: ${err.message || '未知错误'}` : `Split failed: ${err.message || 'Error'}`);
    } finally {
      setIsSplitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="apple-liquid-glass relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-slate-100"
        >
          {/* macOS Style Window Header */}
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

            {/* Modal Title */}
            <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-white">
              <span className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                {activeTab === 'join' ? <Layers className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}
              </span>
              <span>
                {isZh ? 'Halo PDF 工具箱 — 合并与拆分' : 'Halo PDF Tools — Joiner & Splitter'}
              </span>
            </div>

            {/* Right Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Sub-Header (Joiner / Splitter Switcher) */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'join'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isZh ? 'PDF 合并 (Joiner)' : 'PDF Joiner (Merge)'}</span>
                {joinFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {joinFiles.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'split'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>{isZh ? 'PDF 拆分 (Splitter)' : 'PDF Splitter'}</span>
              </button>
            </div>

            {toastMsg && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 animate-pulse">
                {toastMsg}
              </span>
            )}
          </div>

          {/* Main Body */}
          <div className="flex-1 overflow-y-auto mac-scrollbar p-4 space-y-4">
            {/* ======================================================== */}
            {/* TAB 1: PDF JOINER (MERGE MULTIPLE PDFS)                   */}
            {/* ======================================================== */}
            {activeTab === 'join' && (
              <div className="space-y-4">
                {/* Upload & Source Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2">
                    <input
                      ref={multiFileInputRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      onChange={handleJoinFilesSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => multiFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isZh ? '选择并添加 PDF 文件...' : 'Add PDF Files...'}</span>
                    </button>

                    {currentActivePdfBytes && (
                      <button
                        type="button"
                        onClick={handleAddCurrentDocumentToJoin}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>{isZh ? '加入当前开单文档' : 'Add Current Quote'}</span>
                      </button>
                    )}
                  </div>

                  {joinFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setJoinFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isZh ? '清空列表' : 'Clear List'}</span>
                    </button>
                  )}
                </div>

                {/* Empty State */}
                {joinFiles.length === 0 && (
                  <div
                    onClick={() => multiFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors bg-slate-950/40"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <Layers className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-white">
                        {isZh ? '点击或拖拽上传多个 PDF 文件' : 'Click or Drag & Drop Multiple PDF Files'}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 max-w-md">
                        {isZh
                          ? '可一次性导入多个 PDF 文档，自定义各文件前后合并顺序以及提取页码范围，合并为一个完整的 PDF。'
                          : 'Import multiple PDFs, arrange order, optionally select page ranges, and merge them into a single PDF.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* File List */}
                {joinFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-semibold">
                      <span>
                        {isZh
                          ? `已载入 ${joinFiles.length} 个文件（按自上而下顺序合并）`
                          : `${joinFiles.length} files loaded (Merged in top-to-bottom sequence)`}
                      </span>
                      <span>
                        {isZh
                          ? `总计约 ${joinFiles.reduce((acc, f) => acc + f.pageCount, 0)} 页`
                          : `Total ~${joinFiles.reduce((acc, f) => acc + f.pageCount, 0)} pages`}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[48vh] overflow-y-auto mac-scrollbar pr-1">
                      {joinFiles.map((file, idx) => (
                        <div
                          key={`${file.id}-${idx}`}
                          className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
                        >
                          {/* Left: Sequence index & File Info */}
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 font-mono font-bold text-xs text-slate-300 flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-xs sm:text-sm text-white truncate max-w-[200px] sm:max-w-md">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                                <span className="text-cyan-400 font-bold">{file.pageCount} 页</span>
                                <span>•</span>
                                <span>{(file.size / 1024).toFixed(1)} KB</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Page Range & Reorder Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Page range input */}
                            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                              <span className="text-[10px] text-slate-400 uppercase font-mono">
                                {isZh ? '页码:' : 'Pages:'}
                              </span>
                              <input
                                type="text"
                                value={file.selectedRangeText || ''}
                                onChange={e => handleUpdateFileRange(file.id, e.target.value)}
                                placeholder={isZh ? `全部 1-${file.pageCount}` : `All 1-${file.pageCount}`}
                                className="w-24 bg-transparent text-xs text-white outline-none placeholder:text-slate-600 font-mono"
                                title="e.g. 1-3, 5"
                              />
                            </div>

                            {/* Up / Down buttons */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveFileUp(idx)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === joinFiles.length - 1}
                                onClick={() => handleMoveFileDown(idx)}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveJoinFile(file.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 cursor-pointer ml-1"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Merge Action Buttons */}
                {joinFiles.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-indigo-500/20">
                    <span className="text-xs text-slate-400">
                      {isZh
                        ? `准备合并 ${joinFiles.length} 个 PDF 文件`
                        : `Ready to join ${joinFiles.length} PDF files`}
                    </span>

                    <div className="flex items-center gap-2">
                      {onOpenInEditor && (
                        <button
                          type="button"
                          disabled={isMerging}
                          onClick={() => handleExecuteMerge(true)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <FileCheck className="w-4 h-4 text-indigo-400" />
                          <span>{isZh ? '合并并在编辑器打开' : 'Merge & Open in Editor'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isMerging}
                        onClick={() => handleExecuteMerge(false)}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                      >
                        {isMerging ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span>{isZh ? '立即合并并下载 PDF' : 'Merge & Download PDF'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: PDF SPLITTER (SPLIT / EXTRACT PAGES)              */}
            {/* ======================================================== */}
            {activeTab === 'split' && (
              <div className="space-y-4">
                {/* File Header Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <input
                      ref={singlePdfInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={handleSplitFileSelected}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => singlePdfInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{isZh ? '更换要拆分的 PDF...' : 'Choose PDF to Split...'}</span>
                    </button>

                    {currentActivePdfBytes && (
                      <button
                        type="button"
                        onClick={handleUseCurrentQuoteForSplit}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <FileText className="w-4 h-4 text-amber-400" />
                        <span>{isZh ? '载入当前开单文档' : 'Load Current Quote'}</span>
                      </button>
                    )}
                  </div>

                  {splitFileBytes && (
                    <div className="text-right">
                      <p className="font-semibold text-xs text-white truncate max-w-xs sm:max-w-sm">
                        {splitFileName}
                      </p>
                      <p className="text-[11px] text-cyan-400 font-mono font-bold">
                        {isZh ? `共 ${splitTotalPages} 页` : `${splitTotalPages} Total Pages`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Splitting Mode Options */}
                {splitFileBytes && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setSplitMode('selected')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          splitMode === 'selected'
                            ? 'bg-purple-600/20 border-purple-400 text-purple-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs block">
                          {isZh ? '1. 自选勾选提取' : '1. Select Pages'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {isZh ? '点击下方缩略网格选择' : 'Pick specific pages'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSplitMode('range')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          splitMode === 'range'
                            ? 'bg-purple-600/20 border-purple-400 text-purple-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs block">
                          {isZh ? '2. 指定页码范围' : '2. Page Range'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {isZh ? '输入 1-3, 5 等范围' : 'e.g. 1-3, 5'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSplitMode('single')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          splitMode === 'single'
                            ? 'bg-purple-600/20 border-purple-400 text-purple-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs block">
                          {isZh ? '3. 拆分成单页文件' : '3. Every Single Page'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {isZh ? '每页存为一个独立 PDF' : '1 PDF per page'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSplitMode('chunk')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          splitMode === 'chunk'
                            ? 'bg-purple-600/20 border-purple-400 text-purple-300 shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-xs block">
                          {isZh ? '4. 每 N 页切一份' : '4. Every N Pages'}
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          {isZh ? '按固定间隔分段' : 'Chunk by fixed count'}
                        </span>
                      </button>
                    </div>

                    {/* Mode Specific Controls */}
                    {splitMode === 'range' && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-bold text-slate-300">
                          {isZh ? '提取页码范围:' : 'Extract Page Range:'}
                        </span>
                        <input
                          type="text"
                          value={customRangeInput}
                          onChange={e => setCustomRangeInput(e.target.value)}
                          placeholder="例如: 1-3, 5, 7-10"
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs w-48 outline-none focus:border-purple-400"
                        />
                        <span className="text-[11px] text-slate-400">
                          {isZh
                            ? `支持单个页码与连字符范围 (1 至 ${splitTotalPages})`
                            : `Supports single pages & ranges (1 to ${splitTotalPages})`}
                        </span>
                      </div>
                    )}

                    {splitMode === 'chunk' && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300">
                          {isZh ? '每隔几页分割为一个新文件:' : 'Split every N pages:'}
                        </span>
                        <select
                          value={chunkSize}
                          onChange={e => setChunkSize(parseInt(e.target.value, 10))}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-xs outline-none focus:border-purple-400 cursor-pointer"
                        >
                          <option value={1}>1 {isZh ? '页' : 'page'}</option>
                          <option value={2}>2 {isZh ? '页' : 'pages'}</option>
                          <option value={3}>3 {isZh ? '页' : 'pages'}</option>
                          <option value={4}>4 {isZh ? '页' : 'pages'}</option>
                          <option value={5}>5 {isZh ? '页' : 'pages'}</option>
                          <option value={10}>10 {isZh ? '页' : 'pages'}</option>
                        </select>
                      </div>
                    )}

                    {/* Visual Page Grid (When in 'selected' mode) */}
                    {splitMode === 'selected' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                          <span className="font-semibold">
                            {isZh
                              ? `已勾选 ${selectedPages.size} / ${splitTotalPages} 页`
                              : `Selected ${selectedPages.size} / ${splitTotalPages} pages`}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleSelectAllPages}
                              className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                            >
                              {isZh ? '全选' : 'Select All'}
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={handleSelectOddPages}
                              className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                              {isZh ? '仅奇数页' : 'Odd Pages'}
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={handleSelectEvenPages}
                              className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer"
                            >
                              {isZh ? '仅偶数页' : 'Even Pages'}
                            </button>
                          </div>
                        </div>

                        {/* Page Thumbnails Matrix */}
                        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2.5 max-h-[42vh] overflow-y-auto mac-scrollbar p-2 rounded-xl bg-slate-950 border border-slate-800">
                          {Array.from({ length: splitTotalPages }).map((_, pageIdx) => {
                            const isChecked = selectedPages.has(pageIdx);
                            return (
                              <button
                                key={`split-page-${pageIdx}`}
                                type="button"
                                onClick={() => togglePageSelection(pageIdx)}
                                className={`relative p-2 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-purple-600/25 border-purple-400 text-white shadow-md'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 opacity-60'
                                }`}
                              >
                                <div className="w-9 h-12 rounded border border-slate-700 bg-white/5 flex items-center justify-center font-mono font-bold text-xs text-slate-300 relative">
                                  {pageIdx + 1}
                                  {isChecked && (
                                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow-xs">
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono">
                                  {isZh ? `第 ${pageIdx + 1} 页` : `P. ${pageIdx + 1}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Split Action Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-purple-500/20">
                      <span className="text-xs text-slate-400">
                        {splitMode === 'single'
                          ? isZh
                            ? `将导出 ${splitTotalPages} 个单页 PDF`
                            : `Will export ${splitTotalPages} single-page PDFs`
                          : splitMode === 'chunk'
                          ? isZh
                            ? `每 ${chunkSize} 页分割一份`
                            : `Split every ${chunkSize} pages`
                          : isZh
                          ? `已准备提取指定页面`
                          : `Ready to extract selected pages`}
                      </span>

                      <div className="flex items-center gap-2">
                        {onOpenInEditor && (splitMode === 'selected' || splitMode === 'range') && (
                          <button
                            type="button"
                            disabled={isSplitting}
                            onClick={() => handleExecuteSplit(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <FileCheck className="w-4 h-4 text-purple-400" />
                            <span>{isZh ? '拆分并在编辑器打开' : 'Split & Open in Editor'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isSplitting}
                          onClick={() => handleExecuteSplit(false)}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                        >
                          {isSplitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Scissors className="w-4 h-4" />
                          )}
                          <span>
                            {splitMode === 'single'
                              ? isZh
                                ? '开始全部拆分并下载'
                                : 'Download All Single Pages'
                              : isZh
                              ? '执行拆分并下载 PDF'
                              : 'Split & Download PDF'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
