import React from 'react';
import {
  Type,
  Image as ImageIcon,
  Link2,
  Minus,
  Square,
  CheckSquare,
  Eraser,
  PenTool,
  MessageSquare,
  Highlighter,
  Strikethrough,
  Underline,
  Stamp,
  ArrowUp,
  ArrowDown,
  RotateCw,
  RotateCcw,
  Trash2,
  FilePlus2,
  Sliders,
  Upload,
  RefreshCw,
  FileText,
  ShieldAlert,
  X,
  Check,
  Layers,
  Scissors,
  Split,
  Plus,
} from 'lucide-react';

export type PdfescapeTab = 'insert' | 'annotate' | 'page' | 'merge_split' | 'document' | 'upload';

interface PdfescapeToolPanelProps {
  activeTab: PdfescapeTab;
  onChangeTab: (tab: PdfescapeTab) => void;
  activeTool: string;
  onSelectTool: (tool: string) => void;
  isZh: boolean;
  activeSource: string;
  // Image upload trigger
  onTriggerImageUpload: () => void;
  // Page actions
  currentPageIndex: number;
  totalPages: number;
  onRotateClockwise: () => void;
  onRotateCounterClockwise: () => void;
  onDeleteCurrentPage: () => void;
  onAddBlankPage: () => void;
  onMovePageUp: () => void;
  onMovePageDown: () => void;
  // File actions
  onUploadPdf: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCreateBlankA4: () => void;
  onSelectCurrentQuote: () => void;
  // PDF Joiner and Splitter
  onOpenPdfJoiner?: () => void;
  onOpenPdfSplitter?: () => void;
  // Image converter
  onOpenImageConverter?: () => void;
}

export const PdfescapeToolPanel: React.FC<PdfescapeToolPanelProps> = ({
  activeTab,
  onChangeTab,
  activeTool,
  onSelectTool,
  isZh,
  activeSource,
  onTriggerImageUpload,
  currentPageIndex,
  totalPages,
  onRotateClockwise,
  onRotateCounterClockwise,
  onDeleteCurrentPage,
  onAddBlankPage,
  onMovePageUp,
  onMovePageDown,
  onUploadPdf,
  onCreateBlankA4,
  onSelectCurrentQuote,
  onOpenPdfJoiner,
  onOpenPdfSplitter,
  onOpenImageConverter,
}) => {
  const tabs: { id: PdfescapeTab; labelZh: string; labelEn: string }[] = [
    { id: 'insert', labelZh: '插入 (Insert)', labelEn: 'Insert' },
    { id: 'annotate', labelZh: '标注 (Annotate)', labelEn: 'Annotate' },
    { id: 'page', labelZh: '页面 (Page)', labelEn: 'Page' },
    { id: 'merge_split', labelZh: '合并/拆分', labelEn: 'Merge & Split' },
    { id: 'document', labelZh: '单据明细', labelEn: 'Quote Form' },
    { id: 'upload', labelZh: '文件源', labelEn: 'Files' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border-r border-slate-700/80 w-full select-none">
      {/* Top Tab Bar (PDFescape Style: Insert | Annotate | Page | Document | Upload) */}
      <div className="flex border-b border-slate-700 bg-slate-950 overflow-x-auto mac-scrollbar">
        {tabs.map((tab, idx) => (
          <button
            key={`pdfescape-tab-${tab.id}-${idx}`}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`flex-1 py-2 px-2.5 text-center font-bold text-xs whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
              activeTab === tab.id
                ? 'border-cyan-400 text-cyan-300 bg-slate-900'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            {isZh ? tab.labelZh : tab.labelEn}
          </button>
        ))}
      </div>

      {/* Tab Content Body */}
      <div className="p-3 overflow-y-auto mac-scrollbar flex-1 space-y-3">
        {/* 1. INSERT TAB (PDFescape primary tools) */}
        {activeTab === 'insert' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isZh ? 'PDFescape 常用插入工具' : 'PDFescape Insert Tools'}
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Text Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('text')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'text'
                    ? 'bg-blue-600/20 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <Type className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-xs">{isZh ? '文字 (Text)' : 'Text'}</span>
              </button>

              {/* Whiteout Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('whiteout')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'whiteout'
                    ? 'bg-amber-600/20 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <Eraser className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-xs">{isZh ? '涂白 (Whiteout)' : 'Whiteout'}</span>
              </button>

              {/* Image Tool */}
              <button
                type="button"
                onClick={onTriggerImageUpload}
                className="p-2.5 rounded-xl border bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <ImageIcon className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-xs">{isZh ? '图片 (Image)' : 'Image'}</span>
              </button>

              {/* Freehand Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('freehand')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'freehand'
                    ? 'bg-emerald-600/20 border-emerald-400 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <PenTool className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-xs">{isZh ? '手写画笔 (Freehand)' : 'Freehand'}</span>
              </button>

              {/* Checkmark Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('checkmark')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'checkmark'
                    ? 'bg-green-600/20 border-green-400 text-green-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <CheckSquare className="w-5 h-5 text-green-400" />
                <span className="font-bold text-xs">{isZh ? '打勾标记 (Checkmark)' : 'Checkmark'}</span>
              </button>

              {/* Line Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('line')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'line'
                    ? 'bg-blue-600/20 border-blue-400 text-blue-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <Minus className="w-5 h-5 text-blue-400" />
                <span className="font-bold text-xs">{isZh ? '线条 (Line)' : 'Line'}</span>
              </button>

              {/* Rectangle Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('rectangle')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'rectangle'
                    ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <Square className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-xs">{isZh ? '矩形框 (Rectangle)' : 'Rectangle'}</span>
              </button>

              {/* Link Tool */}
              <button
                type="button"
                onClick={() => onSelectTool('link')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'link'
                    ? 'bg-cyan-600/20 border-cyan-400 text-cyan-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                }`}
              >
                <Link2 className="w-5 h-5 text-cyan-400" />
                <span className="font-bold text-xs">{isZh ? '超链接 (Link)' : 'Link'}</span>
              </button>
            </div>

            {/* Quick Helper Banner */}
            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-[11px] text-cyan-300 leading-relaxed">
              💡 {isZh ? '点击【文字】后，直接点击画面上任何文字即可修改！或按住鼠标拖拽拉出涂白框。' : 'Select Text, then click any text on the PDF to edit it directly! Or drag to whiteout.'}
            </div>
          </div>
        )}

        {/* 2. ANNOTATE TAB (Sticky notes, highlights, stamps) */}
        {activeTab === 'annotate' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isZh ? 'PDFescape 批注工具' : 'PDFescape Annotations'}
            </span>

            <div className="grid grid-cols-2 gap-2">
              {/* Highlight */}
              <button
                type="button"
                onClick={() => onSelectTool('highlight')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'highlight'
                    ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Highlighter className="w-5 h-5 text-yellow-400" />
                <span className="font-bold text-xs">{isZh ? '荧光高亮 (Highlight)' : 'Highlight'}</span>
              </button>

              {/* Stamp */}
              <button
                type="button"
                onClick={() => onSelectTool('stamp')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'stamp'
                    ? 'bg-purple-600/20 border-purple-400 text-purple-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Stamp className="w-5 h-5 text-purple-400" />
                <span className="font-bold text-xs">{isZh ? '官方印章 (Stamp)' : 'Stamp'}</span>
              </button>

              {/* Sticky Note */}
              <button
                type="button"
                onClick={() => onSelectTool('sticky')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'sticky'
                    ? 'bg-amber-600/20 border-amber-400 text-amber-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-xs">{isZh ? '便签便笺 (Sticky)' : 'Sticky Note'}</span>
              </button>

              {/* Signature Pad */}
              <button
                type="button"
                onClick={() => onSelectTool('signature')}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  activeTool === 'signature'
                    ? 'bg-emerald-600/20 border-emerald-400 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <PenTool className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-xs">{isZh ? '手写签名 (Sign)' : 'Signature'}</span>
              </button>
            </div>
          </div>
        )}

        {/* PAGE TAB (Rotate, Delete, Add page, Move page) */}
        {activeTab === 'page' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isZh ? 'PDFescape 页面管理' : 'PDFescape Page Tools'}
            </span>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs">
              <span className="text-slate-300">
                {isZh ? '当前选中第' : 'Current Page:'}{' '}
                <strong className="text-cyan-400 font-mono text-sm">{currentPageIndex + 1}</strong> / {totalPages}{' '}
                {isZh ? '页' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onRotateClockwise}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <RotateCw className="w-4 h-4 text-cyan-400" />
                <span>{isZh ? '顺时针 90°' : 'Rotate CW'}</span>
              </button>

              <button
                type="button"
                onClick={onRotateCounterClockwise}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <RotateCcw className="w-4 h-4 text-cyan-400" />
                <span>{isZh ? '逆时针 90°' : 'Rotate CCW'}</span>
              </button>

              <button
                type="button"
                onClick={onMovePageUp}
                disabled={currentPageIndex === 0}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <ArrowUp className="w-4 h-4 text-blue-400" />
                <span>{isZh ? '上移一页' : 'Move Up'}</span>
              </button>

              <button
                type="button"
                onClick={onMovePageDown}
                disabled={currentPageIndex >= totalPages - 1}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <ArrowDown className="w-4 h-4 text-blue-400" />
                <span>{isZh ? '下移一页' : 'Move Down'}</span>
              </button>

              <button
                type="button"
                onClick={onAddBlankPage}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <FilePlus2 className="w-4 h-4 text-emerald-400" />
                <span>{isZh ? '追加空白页' : 'Add Blank Page'}</span>
              </button>

              <button
                type="button"
                onClick={onDeleteCurrentPage}
                disabled={totalPages <= 1}
                className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-40 border border-red-500/30 text-red-400 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isZh ? '删除本页' : 'Delete Page'}</span>
              </button>
            </div>

            {/* Quick Access to Merge & Split Tools */}
            <div className="pt-2 border-t border-slate-700/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                {isZh ? 'PDF 合并与拆分工具' : 'PDF Joiner & Splitter'}
              </span>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenPdfJoiner}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 hover:from-blue-900/50 hover:to-indigo-900/50 border border-blue-500/30 text-blue-300 flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span>{isZh ? '合并多个 PDF' : 'Merge PDFs'}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPdfSplitter}
                  className="p-2.5 rounded-xl bg-gradient-to-r from-purple-900/30 to-pink-900/30 hover:from-purple-900/50 hover:to-pink-900/50 border border-purple-500/30 text-purple-300 flex flex-col items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <Scissors className="w-4 h-4 text-purple-400" />
                  <span>{isZh ? '拆分提取页面' : 'Split PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. MERGE & SPLIT TAB */}
        {activeTab === 'merge_split' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isZh ? 'PDF 合并与拆分 (Joiner & Splitter)' : 'PDF Joiner & Splitter Studio'}
            </span>

            {/* Merge PDFs Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-950/60 to-indigo-950/60 border border-blue-500/30 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">
                    {isZh ? 'PDF 合并器 (PDF Joiner)' : 'PDF Joiner (Merge)'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isZh ? '将多个 PDF 文件按序拼合成一个' : 'Combine multiple PDFs in sequence'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenPdfJoiner}
                className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isZh ? '打开 PDF 合并工具箱...' : 'Open PDF Joiner Studio...'}</span>
              </button>
            </div>

            {/* Split PDF Card */}
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-950/60 to-pink-950/60 border border-purple-500/30 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">
                    {isZh ? 'PDF 拆分器 (PDF Splitter)' : 'PDF Splitter'}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {isZh ? '提取指定页码、每页拆分或固定页数分割' : 'Extract pages, single pages, or chunks'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenPdfSplitter}
                className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{isZh ? '打开 PDF 拆分工具箱...' : 'Open PDF Splitter Studio...'}</span>
              </button>
            </div>

            {/* Image Converter Card */}
            {onOpenImageConverter && (
              <div className="p-3 rounded-2xl bg-gradient-to-br from-teal-950/60 to-emerald-950/60 border border-teal-500/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white">
                      {isZh ? '图片格式转换器 (Image Converter)' : 'Image Converter'}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {isZh ? 'PNG ⇄ JPG ⇄ WEBP ⇄ PDF ⇄ ICO ⇄ SVG 互转' : 'Convert PNG, JPG, WEBP, PDF, ICO, SVG'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenImageConverter}
                  className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>{isZh ? '打开图片格式转换工作台...' : 'Open Image Converter...'}</span>
                </button>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/80 text-[11px] text-slate-400 leading-relaxed">
              💡 {isZh
                ? '提示：支持将外部导入的多个 PDF 以及当前开单的报价单自由拼接合并，或从长文档中单独提取任一部分。'
                : 'Tip: You can merge multiple external PDFs with your current quotation, or extract specific pages.'}
            </div>
          </div>
        )}

        {/* 4. FILES TAB (Upload PDF, Blank A4, Switch back to quote) */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              {isZh ? 'PDF 文件源管理' : 'Document Source'}
            </span>

            {/* Upload PDF Box */}
            <label className="p-4 rounded-2xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center">
              <Upload className="w-6 h-6 text-cyan-400" />
              <div className="font-bold text-xs text-white">
                {isZh ? '上传外部 PDF 文件' : 'Upload External PDF'}
              </div>
              <div className="text-[10px] text-slate-400">
                {isZh ? '选择本地 .pdf 文件直接载入编辑' : 'Load any PDF file into editor'}
              </div>
              <input type="file" accept="application/pdf" onChange={onUploadPdf} className="hidden" />
            </label>

            {/* Create Blank A4 */}
            <button
              type="button"
              onClick={onCreateBlankA4}
              className="w-full p-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <FilePlus2 className="w-4 h-4 text-emerald-400" />
              <span>{isZh ? '创建空白 A4 纸张画布' : 'Create Blank A4 Canvas'}</span>
            </button>

            {/* Switch back to current quotation */}
            {activeSource !== 'currentQuote' && (
              <button
                type="button"
                onClick={onSelectCurrentQuote}
                className="w-full p-3 rounded-xl border border-blue-500/30 bg-blue-600/20 hover:bg-blue-600/30 text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-cyan-400" />
                <span>{isZh ? '切回开单报价单' : 'Switch Back to Quote Sheet'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
