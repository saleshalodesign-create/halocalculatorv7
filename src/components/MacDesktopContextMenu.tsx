import React, { useEffect, useRef } from 'react';
import {
  Image as ImageIcon,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Globe,
  FileCheck,
  Layers,
  FileSpreadsheet,
  Calculator,
  PlusCircle,
  ClipboardList,
  Sparkles,
  Maximize2,
  Minimize2,
  Lightbulb,
} from 'lucide-react';
import { playSoftPop } from '../utils/soundEffects';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  shortcut?: string;
  dividerAbove?: boolean;
  highlight?: boolean;
}

interface MacDesktopContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
}

export const MacDesktopContextMenu: React.FC<MacDesktopContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  items,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Position adjustments to prevent overflowing screen boundaries
  const menuWidth = 240;
  const menuHeight = items.length * 32 + 30;
  const posX = Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12));
  const posY = Math.max(38, Math.min(y, window.innerHeight - menuHeight - 65));

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      style={{ left: posX, top: posY }}
      className="fixed z-50 w-60 py-1.5 rounded-xl bg-slate-900/85 dark:bg-[#0a0f24]/90 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_16px_36px_rgba(0,0,0,0.55)] select-none text-[12px] font-sans animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/40 overflow-hidden"
    >
      {items.map((item, idx) => (
        <React.Fragment key={`ctx-item-${item.id}-${idx}`}>
          {item.dividerAbove && (
            <div className="my-1 border-t border-slate-700/60 dark:border-white/10" />
          )}
          <button
            type="button"
            onClick={() => {
              playSoftPop();
              item.onClick();
              onClose();
            }}
            className={`w-full px-2.5 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer rounded-lg mx-auto ${
              item.highlight
                ? 'text-cyan-300 hover:bg-cyan-500/20 font-bold'
                : 'text-slate-200 hover:bg-blue-600 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-80">
                {item.icon}
              </span>
              <span className="truncate">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] opacity-60 font-mono tracking-tighter shrink-0 pl-2">
                {item.shortcut}
              </span>
            )}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
