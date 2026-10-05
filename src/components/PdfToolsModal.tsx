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
  EyeOff,
  Check,
  Copy,
  Lock,
  Unlock,
  Key,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  FileKey,
  Shield,
  RotateCw,
  Stamp,
  Image as ImageIcon,
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
  lockPdfDocument,
  unlockPdfDocument,
  checkPdfEncryption,
} from '../utils/pdfEditor';
import { useLanguage } from '../context/LanguageContext';
import { PdfOrganizeTab } from './pdf/PdfOrganizeTab';
import { PdfWatermarkTab } from './pdf/PdfWatermarkTab';
import { PdfImagesToPdfTab } from './pdf/PdfImagesToPdfTab';

export type PdfToolTab = 'join' | 'split' | 'organize' | 'watermark' | 'img2pdf' | 'lock' | 'unlock';

export interface PdfToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: PdfToolTab;
  currentActivePdfBytes?: ArrayBuffer | Uint8Array | null;
  currentActivePdfName?: string;
  onOpenInEditor?: (pdfBytes: ArrayBuffer | Uint8Array, fileName: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

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

  const [activeTab, setActiveTab] = useState<PdfToolTab>(initialTab);

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

  // -------------------------------------------------------------
  // TAB 3: LOCK PDF (ENCRYPT & PROTECT) STATE & HANDLERS
  // -------------------------------------------------------------
  const [lockFileBytes, setLockFileBytes] = useState<Uint8Array | ArrayBuffer | null>(null);
  const [lockFileName, setLockFileName] = useState<string>('');
  const [lockFileSize, setLockFileSize] = useState<number>(0);
  const [lockPageCount, setLockPageCount] = useState<number>(0);
  const [lockUserPassword, setLockUserPassword] = useState<string>('');
  const [lockConfirmPassword, setLockConfirmPassword] = useState<string>('');
  const [lockOwnerPassword, setLockOwnerPassword] = useState<string>('');
  const [showLockPassword, setShowLockPassword] = useState<boolean>(false);
  const [showAdvancedLock, setShowAdvancedLock] = useState<boolean>(false);
  const [allowPrinting, setAllowPrinting] = useState<boolean>(true);
  const [allowCopying, setAllowCopying] = useState<boolean>(false);
  const [allowModifying, setAllowModifying] = useState<boolean>(false);
  const [allowAnnotating, setAllowAnnotating] = useState<boolean>(true);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [lockedResultBytes, setLockedResultBytes] = useState<Uint8Array | null>(null);
  const [lockedResultName, setLockedResultName] = useState<string>('');
  const lockFileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectLockFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await readFileAsArrayBuffer(file);
      setLockFileBytes(buffer);
      setLockFileName(file.name);
      setLockFileSize(file.size);
      setLockedResultBytes(null);

      // Check pages and encryption
      const encCheck = await checkPdfEncryption(buffer);
      if (encCheck.isEncrypted) {
        showToast(isZh ? '注意：此 PDF 已存在密码保护，加锁将更新密码设置' : 'Notice: This PDF is already protected.');
      }
      const count = encCheck.pageCount || (await getPdfPageCount(buffer));
      setLockPageCount(count);
      showToast(isZh ? `已载入: ${file.name} (共 ${count} 页)` : `Loaded: ${file.name} (${count} pages)`);
    } catch (err: any) {
      showToast(isZh ? `读取文件失败: ${err.message}` : `Failed to read file: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleUseCurrentDocForLock = async () => {
    if (!currentActivePdfBytes) {
      showToast(isZh ? '当前暂无可用的开单文档' : 'No active document available');
      return;
    }
    try {
      setLockFileBytes(currentActivePdfBytes);
      setLockFileName(currentActivePdfName || 'Halo_Quotation.pdf');
      setLockFileSize(currentActivePdfBytes.byteLength);
      setLockedResultBytes(null);
      const count = await getPdfPageCount(currentActivePdfBytes);
      setLockPageCount(count);
      showToast(isZh ? `已载入当前文档 (${count} 页)` : `Loaded current document (${count} pages)`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleExecuteLock = async (openInEditor: boolean = false) => {
    if (!lockFileBytes) {
      showToast(isZh ? '请先上传要加密的 PDF 文件' : 'Please upload a PDF to lock');
      return;
    }
    if (!lockUserPassword.trim()) {
      showToast(isZh ? '请输入文档打开密码' : 'Please enter a user password');
      return;
    }
    if (lockUserPassword !== lockConfirmPassword) {
      showToast(isZh ? '两次输入的密码不一致，请核对' : 'Passwords do not match');
      return;
    }

    try {
      setIsLocking(true);
      const lockedBytes = await lockPdfDocument(lockFileBytes, {
        userPassword: lockUserPassword.trim(),
        ownerPassword: lockOwnerPassword.trim() || undefined,
        permissions: {
          printing: allowPrinting,
          copying: allowCopying,
          modifying: allowModifying,
          annotating: allowAnnotating,
        },
      });

      const baseName = lockFileName.replace(/\.pdf$/i, '');
      const outName = `${baseName}_locked.pdf`;
      setLockedResultBytes(lockedBytes);
      setLockedResultName(outName);

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(lockedBytes, outName);
        onClose();
      } else {
        downloadPdfBytes(lockedBytes, outName);
        showToast(isZh ? '🎉 PDF 加密加锁成功！已自动下载' : 'PDF locked successfully! Downloaded.');
      }
    } catch (err: any) {
      console.error('Failed to lock PDF:', err);
      showToast(isZh ? `加密失败: ${err.message || '未知错误'}` : `Lock failed: ${err.message}`);
    } finally {
      setIsLocking(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 4: UNLOCK PDF (DECRYPT & REMOVE PASSWORD) STATE & HANDLERS
  // -------------------------------------------------------------
  const [unlockFileBytes, setUnlockFileBytes] = useState<Uint8Array | ArrayBuffer | null>(null);
  const [unlockFileName, setUnlockFileName] = useState<string>('');
  const [unlockFileSize, setUnlockFileSize] = useState<number>(0);
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [showUnlockPassword, setShowUnlockPassword] = useState<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);
  const [isEncryptedStatus, setIsEncryptedStatus] = useState<boolean | null>(null);
  const [unlockError, setUnlockError] = useState<string>('');
  const [unlockedResultBytes, setUnlockedResultBytes] = useState<Uint8Array | null>(null);
  const [unlockedResultName, setUnlockedResultName] = useState<string>('');
  const [unlockedPageCount, setUnlockedPageCount] = useState<number>(0);
  const unlockFileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectUnlockFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await readFileAsArrayBuffer(file);
      setUnlockFileBytes(buffer);
      setUnlockFileName(file.name);
      setUnlockFileSize(file.size);
      setUnlockPassword('');
      setUnlockError('');
      setUnlockedResultBytes(null);

      const encCheck = await checkPdfEncryption(buffer);
      setIsEncryptedStatus(encCheck.isEncrypted);
      if (encCheck.isEncrypted) {
        showToast(isZh ? '🔒 已识别到加密锁，请输入密码解除保护' : 'Protected PDF detected. Enter password to unlock.');
      } else {
        showToast(isZh ? 'ℹ️ 该 PDF 未设置密码，可直接导出无锁副本' : 'This PDF does not require a password.');
      }
    } catch (err: any) {
      showToast(isZh ? `读取文件失败: ${err.message}` : `Failed to read file: ${err.message}`);
    }
    e.target.value = '';
  };

  const handleExecuteUnlock = async (openInEditor: boolean = false) => {
    if (!unlockFileBytes) {
      showToast(isZh ? '请先上传受保护的 PDF 文件' : 'Please upload a protected PDF');
      return;
    }
    if (isEncryptedStatus && !unlockPassword) {
      showToast(isZh ? '请输入该文档的解密密码' : 'Please enter the PDF password');
      return;
    }

    try {
      setIsUnlocking(true);
      setUnlockError('');

      const cleanBytes = await unlockPdfDocument(unlockFileBytes, unlockPassword);
      const count = await getPdfPageCount(cleanBytes);
      const baseName = unlockFileName.replace(/\.pdf$/i, '').replace(/_locked$/i, '');
      const outName = `${baseName}_unlocked.pdf`;

      setUnlockedResultBytes(cleanBytes);
      setUnlockedResultName(outName);
      setUnlockedPageCount(count);

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(cleanBytes, outName);
        onClose();
      } else {
        downloadPdfBytes(cleanBytes, outName);
        showToast(isZh ? '✨ PDF 密码保护已成功解除！已自动下载' : 'PDF unlocked successfully! Downloaded.');
      }
    } catch (err: any) {
      console.error('Failed to unlock PDF:', err);
      const msg = err.message || '';
      if (msg.toLowerCase().includes('password incorrect') || msg.toLowerCase().includes('incorrect')) {
        setUnlockError(isZh ? '❌ 密码不正确，请核对后重试' : '❌ Incorrect password. Please try again.');
      } else {
        setUnlockError(isZh ? `解密失败: ${msg}` : `Unlock failed: ${msg}`);
      }
    } finally {
      setIsUnlocking(false);
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
                {activeTab === 'join' ? (
                  <Layers className="w-4 h-4 text-blue-400" />
                ) : activeTab === 'split' ? (
                  <Scissors className="w-4 h-4 text-purple-400" />
                ) : activeTab === 'organize' ? (
                  <RotateCw className="w-4 h-4 text-indigo-400" />
                ) : activeTab === 'watermark' ? (
                  <Stamp className="w-4 h-4 text-pink-400" />
                ) : activeTab === 'img2pdf' ? (
                  <ImageIcon className="w-4 h-4 text-teal-400" />
                ) : activeTab === 'lock' ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-emerald-400" />
                )}
              </span>
              <span>
                {activeTab === 'join'
                  ? (isZh ? 'Halo PDF 工具箱 — 合并' : 'Halo PDF Tools — Joiner')
                  : activeTab === 'split'
                  ? (isZh ? 'Halo PDF 工具箱 — 拆分' : 'Halo PDF Tools — Splitter')
                  : activeTab === 'organize'
                  ? (isZh ? 'Halo PDF 工具箱 — 页面旋转与重排整理' : 'Halo PDF Tools — Rotate & Organize')
                  : activeTab === 'watermark'
                  ? (isZh ? 'Halo PDF 工具箱 — 添加防伪水印' : 'Halo PDF Tools — Add Watermark')
                  : activeTab === 'img2pdf'
                  ? (isZh ? 'Halo PDF 工具箱 — 多图转 PDF' : 'Halo PDF Tools — Images to PDF')
                  : activeTab === 'lock'
                  ? (isZh ? 'Halo PDF 工具箱 — 文档加密加锁' : 'Halo PDF Tools — Lock & Protect PDF')
                  : (isZh ? 'Halo PDF 工具箱 — 文档密码解除与去锁' : 'Halo PDF Tools — Unlock & Decrypt PDF')}
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

          {/* Navigation Sub-Header (Tabs Switcher) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto mac-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('join')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'join'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{isZh ? '合并' : 'Merge'}</span>
                {joinFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                    {joinFiles.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'split'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Scissors className="w-4 h-4" />
                <span>{isZh ? '拆分' : 'Split'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('organize')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'organize'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <RotateCw className="w-4 h-4 text-indigo-300" />
                <span>{isZh ? '旋转/整理' : 'Organize'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('watermark')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'watermark'
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Stamp className="w-4 h-4 text-pink-300" />
                <span>{isZh ? '加水印' : 'Watermark'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('img2pdf')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'img2pdf'
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-teal-300" />
                <span>{isZh ? '图片转PDF' : 'Images to PDF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('lock')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'lock'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Lock className="w-4 h-4 text-amber-300" />
                <span>{isZh ? '加密加锁' : 'Lock'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('unlock')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'unlock'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Unlock className="w-4 h-4 text-emerald-300" />
                <span>{isZh ? '解密去锁' : 'Unlock'}</span>
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

            {/* ======================================================== */}
            {/* TAB 3: LOCK PDF (ENCRYPT & SET PASSWORD)                  */}
            {/* ======================================================== */}
            {activeTab === 'lock' && (
              <div className="space-y-4">
                {/* File Upload / Source Bar */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {isZh ? '选择要加锁加密的 PDF' : 'Select PDF to Lock'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {isZh
                            ? '采用 AES-256 位高强度加密算法，防止未授权人员查阅或打印'
                            : 'AES-256 standard encryption protects against unauthorized viewing or printing'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={lockFileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleSelectLockFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => lockFileInputRef.current?.click()}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-400" />
                        <span>{lockFileBytes ? (isZh ? '更换文件' : 'Change File') : (isZh ? '上传本地 PDF' : 'Upload PDF')}</span>
                      </button>

                      {currentActivePdfBytes && (
                        <button
                          type="button"
                          onClick={handleUseCurrentDocForLock}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center gap-1.5 border border-amber-500/30 cursor-pointer transition-all"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isZh ? '使用当前开单文档' : 'Use Current Doc'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Loaded File Info Card */}
                  {lockFileBytes ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileKey className="w-6 h-6 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">
                            {lockFileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatFileSize(lockFileSize)}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-semibold">{lockPageCount} {isZh ? '页' : 'pages'}</span>
                          </div>
                        </div>
                      </div>

                      <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>{isZh ? '待加密' : 'Ready to Encrypt'}</span>
                      </span>
                    </div>
                  ) : (
                    <div
                      onClick={() => lockFileInputRef.current?.click()}
                      className="p-8 border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/80 group"
                    >
                      <Lock className="w-10 h-10 mx-auto text-slate-600 group-hover:text-amber-400 mb-2 transition-colors" />
                      <p className="text-xs font-bold text-slate-300">
                        {isZh ? '点击或将 PDF 文件拖放到此处' : 'Click or drag PDF here to lock'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isZh ? '支持任意大小的 PDF 招牌设计图、报价单、施工合同' : 'Supports all PDF signs, proposals, and contracts'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Password & Security Configuration */}
                {lockFileBytes && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-400" />
                      <span>{isZh ? '设置安全密码与权限' : 'Security Password & Permissions'}</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* User Open Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>{isZh ? '文档打开密码 (User Password) *' : 'Open Password (Required) *'}</span>
                          <span className="text-[10px] text-amber-400 font-normal">
                            {isZh ? '打开查看时必须输入' : 'Required to view'}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type={showLockPassword ? 'text' : 'password'}
                            value={lockUserPassword}
                            onChange={(e) => setLockUserPassword(e.target.value)}
                            placeholder={isZh ? '设置打开文档的密码' : 'Enter password'}
                            className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLockPassword(prev => !prev)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                          >
                            {showLockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirm Password */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                          <span>{isZh ? '确认打开密码 *' : 'Confirm Password *'}</span>
                          {lockConfirmPassword && (
                            <span className={`text-[10px] font-bold ${
                              lockUserPassword === lockConfirmPassword ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {lockUserPassword === lockConfirmPassword
                                ? (isZh ? '✓ 密码一致' : '✓ Match')
                                : (isZh ? '✕ 密码不一致' : '✕ Mismatch')}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <input
                            type={showLockPassword ? 'text' : 'password'}
                            value={lockConfirmPassword}
                            onChange={(e) => setLockConfirmPassword(e.target.value)}
                            placeholder={isZh ? '再次输入密码以防误输' : 'Re-enter password'}
                            className={`w-full pl-3 pr-10 py-2 rounded-xl bg-slate-900 border text-white placeholder-slate-500 text-xs focus:outline-none ${
                              lockConfirmPassword && lockUserPassword !== lockConfirmPassword
                                ? 'border-rose-500 focus:border-rose-500'
                                : 'border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Advanced Permissions Accordion Toggle */}
                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowAdvancedLock(prev => !prev)}
                        className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showAdvancedLock ? 'rotate-90' : ''}`} />
                        <span>{isZh ? '高级文档使用权限设置 (打印/复制/修改限制)' : 'Advanced Permissions (Print/Copy/Modify Restrictions)'}</span>
                      </button>

                      {showAdvancedLock && (
                        <div className="mt-3 p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3 animate-in fade-in duration-150">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                              <input
                                type="checkbox"
                                checked={allowPrinting}
                                onChange={(e) => setAllowPrinting(e.target.checked)}
                                className="rounded text-amber-500 focus:ring-0"
                              />
                              <span className="text-slate-200">{isZh ? '允许高清打印 (Allow Printing)' : 'Allow High-Res Printing'}</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                              <input
                                type="checkbox"
                                checked={allowCopying}
                                onChange={(e) => setAllowCopying(e.target.checked)}
                                className="rounded text-amber-500 focus:ring-0"
                              />
                              <span className="text-slate-200">{isZh ? '允许复制文字与图像 (Allow Copying)' : 'Allow Text/Image Copying'}</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                              <input
                                type="checkbox"
                                checked={allowAnnotating}
                                onChange={(e) => setAllowAnnotating(e.target.checked)}
                                className="rounded text-amber-500 focus:ring-0"
                              />
                              <span className="text-slate-200">{isZh ? '允许批注与盖章 (Allow Annotations)' : 'Allow Annotations & Stamps'}</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700">
                              <input
                                type="checkbox"
                                checked={allowModifying}
                                onChange={(e) => setAllowModifying(e.target.checked)}
                                className="rounded text-amber-500 focus:ring-0"
                              />
                              <span className="text-slate-200">{isZh ? '允许修改页面结构 (Allow Modifying)' : 'Allow Document Modification'}</span>
                            </label>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80">
                            <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                              {isZh ? '管理员/所有者权限密码 (Owner Password，选填)' : 'Master Owner Password (Optional)'}
                            </label>
                            <input
                              type="password"
                              value={lockOwnerPassword}
                              onChange={(e) => setLockOwnerPassword(e.target.value)}
                              placeholder={isZh ? '拥有此密码可不受上述权限限制' : 'Bypasses above permission restrictions'}
                              className="w-full pl-3 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 text-xs focus:outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Execution Bar */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs text-amber-400/90 font-mono">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>AES-256 {isZh ? '硬件级强加密标准' : 'Standard Strong Encryption'}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {onOpenInEditor && (
                          <button
                            type="button"
                            disabled={isLocking || !lockUserPassword || lockUserPassword !== lockConfirmPassword}
                            onClick={() => handleExecuteLock(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <FileCheck className="w-4 h-4 text-amber-400" />
                            <span>{isZh ? '加锁并在编辑器测试' : 'Lock & Test in Editor'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isLocking || !lockUserPassword || lockUserPassword !== lockConfirmPassword}
                          onClick={() => handleExecuteLock(false)}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-600/30 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                        >
                          {isLocking ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                          <span>{isZh ? '执行加密加锁并下载' : 'Lock & Download PDF'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Result Success Banner */}
                    {lockedResultBytes && (
                      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-amber-200">
                              {isZh ? '🎉 PDF 加密加锁成功！' : '🎉 PDF Successfully Locked!'}
                            </p>
                            <p className="text-[11px] text-amber-300/80">
                              {lockedResultName} ({formatFileSize(lockedResultBytes.byteLength)})
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => downloadPdfBytes(lockedResultBytes, lockedResultName)}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-amber-400 transition-colors shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isZh ? '再次下载' : 'Download Again'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 4: UNLOCK PDF (DECRYPT & REMOVE PASSWORD)             */}
            {/* ======================================================== */}
            {activeTab === 'unlock' && (
              <div className="space-y-4">
                {/* File Upload / Source Bar */}
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                        <Unlock className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {isZh ? '选择受密码保护的 PDF 文件' : 'Select Protected PDF to Unlock'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {isZh
                            ? '输入文档密码后彻底解除安全限制，生成永久免密的标准 PDF'
                            : 'Permanently removes password protection and permission restrictions'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={unlockFileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleSelectUnlockFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => unlockFileInputRef.current?.click()}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-all"
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{unlockFileBytes ? (isZh ? '更换文件' : 'Change File') : (isZh ? '上传受密 PDF' : 'Upload PDF')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Loaded File Info Card */}
                  {unlockFileBytes ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileKey className="w-6 h-6 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate max-w-sm sm:max-w-md">
                            {unlockFileName}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{formatFileSize(unlockFileSize)}</span>
                            {isEncryptedStatus !== null && (
                              <>
                                <span>•</span>
                                <span className={isEncryptedStatus ? 'text-amber-400 font-semibold' : 'text-slate-300'}>
                                  {isEncryptedStatus
                                    ? (isZh ? '🔒 密码保护中' : '🔒 Password Protected')
                                    : (isZh ? '✓ 未设置密码' : '✓ Unprotected')}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {isEncryptedStatus ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>{isZh ? '需要密码' : 'Password Required'}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{isZh ? '可直接去锁' : 'Ready to Decrypt'}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => unlockFileInputRef.current?.click()}
                      className="p-8 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/80 group"
                    >
                      <Unlock className="w-10 h-10 mx-auto text-slate-600 group-hover:text-emerald-400 mb-2 transition-colors" />
                      <p className="text-xs font-bold text-slate-300">
                        {isZh ? '点击或将加密受锁的 PDF 文件拖放到此处' : 'Click or drag protected PDF here to unlock'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {isZh ? '解除后将生成无密码副本，随时直接查看、打印、复制与编辑' : 'Decrypted copy will open freely without passwords on any device'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Password Input & Action Card */}
                {unlockFileBytes && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span>{isZh ? '输入文档密码以解除保护' : 'Enter Password to Decrypt'}</span>
                    </h4>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-300 block">
                        {isZh ? '文档密码 (Password) *' : 'PDF Password *'}
                      </label>
                      <div className="relative">
                        <input
                          type={showUnlockPassword ? 'text' : 'password'}
                          value={unlockPassword}
                          onChange={(e) => {
                            setUnlockPassword(e.target.value);
                            if (unlockError) setUnlockError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleExecuteUnlock(false);
                          }}
                          placeholder={isZh ? '输入该 PDF 当前的打开密码' : 'Enter current PDF password'}
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnlockPassword(prev => !prev)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                        >
                          {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      {unlockError && (
                        <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{unlockError}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Execution Bar */}
                    <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        {isZh ? '解锁后将永久移除密码保护' : 'Password restrictions will be permanently removed'}
                      </span>

                      <div className="flex items-center gap-2">
                        {onOpenInEditor && (
                          <button
                            type="button"
                            disabled={isUnlocking || (isEncryptedStatus && !unlockPassword)}
                            onClick={() => handleExecuteUnlock(true)}
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <FileCheck className="w-4 h-4 text-emerald-400" />
                            <span>{isZh ? '去锁并在编辑器打开' : 'Unlock & Open in Editor'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isUnlocking || (isEncryptedStatus && !unlockPassword)}
                          onClick={() => handleExecuteUnlock(false)}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
                        >
                          {isUnlocking ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Unlock className="w-4 h-4" />
                          )}
                          <span>{isZh ? '解除密码并下载无锁 PDF' : 'Unlock & Download PDF'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Result Success Banner */}
                    {unlockedResultBytes && (
                      <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-emerald-200">
                              {isZh ? '✨ PDF 密码保护已成功永久解除！' : '✨ Password Protection Successfully Removed!'}
                            </p>
                            <p className="text-[11px] text-emerald-300/80">
                              {unlockedResultName} ({unlockedPageCount} {isZh ? '页' : 'pages'}, {formatFileSize(unlockedResultBytes.byteLength)})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {onOpenInEditor && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenInEditor(unlockedResultBytes, unlockedResultName);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 flex items-center gap-1 cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{isZh ? '在编辑器打开' : 'Open in Editor'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => downloadPdfBytes(unlockedResultBytes, unlockedResultName)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-400 transition-colors shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{isZh ? '再次下载' : 'Download Again'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB: PDF ORGANIZE & ROTATE                               */}
            {/* ======================================================== */}
            {activeTab === 'organize' && (
              <PdfOrganizeTab
                currentActivePdfBytes={currentActivePdfBytes}
                currentActivePdfName={currentActivePdfName}
                onOpenInEditor={onOpenInEditor}
                onCloseModal={onClose}
                showToast={showToast}
              />
            )}

            {/* ======================================================== */}
            {/* TAB: PDF WATERMARK STAMP                                 */}
            {/* ======================================================== */}
            {activeTab === 'watermark' && (
              <PdfWatermarkTab
                currentActivePdfBytes={currentActivePdfBytes}
                currentActivePdfName={currentActivePdfName}
                onOpenInEditor={onOpenInEditor}
                onCloseModal={onClose}
                showToast={showToast}
              />
            )}

            {/* ======================================================== */}
            {/* TAB: IMAGES TO PDF CONVERTER                             */}
            {/* ======================================================== */}
            {activeTab === 'img2pdf' && (
              <PdfImagesToPdfTab
                onOpenInEditor={onOpenInEditor}
                onCloseModal={onClose}
                showToast={showToast}
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
