import React, { useState } from 'react';
import { HaloLogo } from './HaloLogo';
import { useLanguage } from '../context/LanguageContext';
import { playHoverTick, playSoftPop } from '../utils/soundEffects';
import { Theme, ThemeType } from '../types';
import { getThemeIconsConfig } from '../utils/themeIcons';

export interface MacDockProps {
  quoteCount: number;
  onOpenQuoteList: () => void;
  onOpenShapeModal?: () => void;
  onOpenDailySchedule?: () => void;
  onOpenPdfEditor?: () => void;
  onOpenPdfTools?: (tab?: 'join' | 'split' | 'organize' | 'watermark' | 'img2pdf' | 'lock' | 'unlock') => void;
  onOpenImageConverter?: () => void;
  shapeType?: 'horizontal' | 'vertical' | 'square' | 'invalid';
  shapeLabel?: string;
  theme?: ThemeType;
  setTheme?: any;
  wallpaper?: any;
  setWallpaper?: any;
  user?: any;
  onOpenAuth?: any;
  onOpenMobileApp?: any;
  onOpenMathCalc?: any;
}

export const MacDock: React.FC<MacDockProps> = ({
  quoteCount,
  onOpenQuoteList,
  onOpenShapeModal,
  onOpenDailySchedule,
  onOpenPdfEditor,
  onOpenPdfTools,
  onOpenImageConverter,
  shapeType = 'horizontal',
  shapeLabel = 'Horizontal',
  theme = Theme.DARK,
}) => {
  const { language, t } = useLanguage();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const themedIcons = getThemeIconsConfig(theme, shapeType);

  const dockItems = [
    {
      id: 'quotes',
      title: `${t.dock.quotes} (${quoteCount})`,
      tooltip: `${t.dock.quotes} - ${themedIcons.quotes.themeBadgeText}`,
      icon: themedIcons.quotes.icon,
      gradient: themedIcons.quotes.gradient,
      shadow: themedIcons.quotes.shadow,
      borderStyle: themedIcons.quotes.borderStyle,
      glowAura: themedIcons.quotes.glowAura,
      subLabel: themedIcons.quotes.themeBadgeText,
      badge: quoteCount > 0 ? quoteCount : undefined,
      onClick: onOpenQuoteList,
      hasDot: quoteCount > 0,
    },
    ...(onOpenDailySchedule
      ? [
          {
            id: 'schedule',
            title: t.dock.schedule,
            tooltip: t.dailySchedule.title,
            icon: themedIcons.schedule.icon,
            gradient: themedIcons.schedule.gradient,
            shadow: themedIcons.schedule.shadow,
            borderStyle: themedIcons.schedule.borderStyle,
            glowAura: themedIcons.schedule.glowAura,
            subLabel: themedIcons.schedule.themeBadgeText,
            onClick: onOpenDailySchedule,
            hasDot: false,
          },
        ]
      : []),
    ...(onOpenPdfEditor
      ? [
          {
            id: 'pdf-editor',
            title: t.dock.pdfEditor || 'Edit PDF',
            tooltip: t.nav.pdfEditor || 'Edit PDF',
            icon: themedIcons['pdf-editor'].icon,
            gradient: themedIcons['pdf-editor'].gradient,
            shadow: themedIcons['pdf-editor'].shadow,
            borderStyle: themedIcons['pdf-editor'].borderStyle,
            glowAura: themedIcons['pdf-editor'].glowAura,
            subLabel: themedIcons['pdf-editor'].themeBadgeText,
            onClick: onOpenPdfEditor,
            hasDot: false,
          },
        ]
      : []),
    ...(onOpenPdfTools
      ? [
          {
            id: 'pdf-tools',
            title: t.dock.pdfTools || (language === 'zh' ? 'PDF 工具' : 'PDF Tools'),
            tooltip: language === 'zh' ? 'PDF 工具箱 (合并/拆分/旋转整理/水印/多图转PDF/加解密)' : 'PDF Tools (Merge/Split/Organize/Watermark/Images/Lock)',
            icon: themedIcons['pdf-tools'].icon,
            gradient: themedIcons['pdf-tools'].gradient,
            shadow: themedIcons['pdf-tools'].shadow,
            borderStyle: themedIcons['pdf-tools'].borderStyle,
            glowAura: themedIcons['pdf-tools'].glowAura,
            subLabel: themedIcons['pdf-tools'].themeBadgeText,
            onClick: () => onOpenPdfTools('join'),
            hasDot: false,
          },
        ]
      : []),
    ...(onOpenImageConverter
      ? [
          {
            id: 'converter',
            title: t.dock.imageConverter || (language === 'zh' ? '图片转换' : 'Converter'),
            tooltip: language === 'zh' ? '图片格式转换工作台' : 'Image File Converter',
            icon: themedIcons.converter.icon,
            gradient: themedIcons.converter.gradient,
            shadow: themedIcons.converter.shadow,
            borderStyle: themedIcons.converter.borderStyle,
            glowAura: themedIcons.converter.glowAura,
            subLabel: themedIcons.converter.themeBadgeText,
            onClick: onOpenImageConverter,
            hasDot: false,
          },
        ]
      : []),
    ...(onOpenShapeModal
      ? [
          {
            id: 'shape',
            title: t.dock.shape,
            tooltip: `${t.dock.shape} (${shapeLabel})`,
            icon: themedIcons.shape.icon,
            subLabel: themedIcons.shape.themeBadgeText,
            gradient: themedIcons.shape.gradient,
            shadow: themedIcons.shape.shadow,
            borderStyle: themedIcons.shape.borderStyle,
            glowAura: themedIcons.shape.glowAura,
            onClick: onOpenShapeModal,
            hasDot: false,
          },
        ]
      : []),
  ];

  const getItemTransform = (index: number) => {
    if (hoveredIdx === null) return { transform: 'scale(1) translateY(0px)', transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' };
    const dist = Math.abs(hoveredIdx - index);
    if (dist === 0) {
      return { transform: 'scale(1.24) translateY(-8px)', transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' };
    }
    if (dist === 1) {
      return { transform: 'scale(1.12) translateY(-4px)', transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)' };
    }
    return { transform: 'scale(1) translateY(0px)', transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' };
  };

  return (
    <div className="fixed inset-x-0 bottom-safe z-40 pointer-events-none flex justify-center items-end pb-1.5 sm:pb-3 px-2 sm:px-4">
      <div className="apple-dock-reflection-wrapper relative pointer-events-auto flex flex-col items-center">
        <div
          onMouseLeave={() => setHoveredIdx(null)}
          className="apple-dock-glass glass-rainbow-rim flex items-center gap-1.5 sm:gap-3 px-3 sm:px-5 py-1.5 sm:py-2 rounded-2xl sm:rounded-[24px] max-w-[96vw] relative shadow-2xl"
        >
          {dockItems.map((item, idx) => {
            const trans = getItemTransform(idx);
            const isHovered = hoveredIdx === idx;
            return (
              <button
                key={`dock-item-${item.id}-${idx}`}
                onClick={() => {
                  playSoftPop();
                  item.onClick();
                }}
                onMouseEnter={() => {
                  if (hoveredIdx !== idx) playHoverTick();
                  setHoveredIdx(idx);
                }}
                style={trans}
                className="group relative flex flex-col items-center p-1 sm:p-1.5 cursor-pointer origin-bottom select-none active:scale-95 transition-transform"
                title={item.tooltip}
              >
                {/* Dynamic Aura Glow on Hover */}
                {isHovered && (
                  <div
                    className={`absolute -inset-1 rounded-2xl bg-gradient-to-tr ${item.glowAura || item.gradient} opacity-50 blur-md pointer-events-none animate-pulse`}
                  />
                )}

                <div
                  className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr ${item.gradient} flex items-center justify-center text-white shadow-md ${item.shadow} ${item.borderStyle || 'border border-white/40'} relative overflow-hidden transition-all group-hover:shadow-xl group-hover:brightness-105`}
                >
                  {/* Subtle glass reflection highlight */}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/10 pointer-events-none" />

                  {item.icon}

                  {item.subLabel && (
                    <span className="absolute bottom-0.5 text-[7px] font-bold uppercase tracking-tighter opacity-80 hidden sm:block">
                      {item.subLabel}
                    </span>
                  )}

                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-1 px-1 sm:px-1.5 py-0.2 min-w-[15px] sm:min-w-[18px] h-[15px] sm:h-[18px] bg-red-500 text-white font-bold text-[9px] sm:text-[10px] rounded-full flex items-center justify-center border-1.5 sm:border-2 border-white shadow-md animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </div>

                <span className="text-[10px] text-slate-800 dark:text-white font-semibold mt-1 hidden sm:block truncate max-w-[70px] drop-shadow-xs">
                  {item.title}
                </span>

                {/* Active app running dot indicator */}
                {item.hasDot ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] mt-0.5" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Glossy Dock Floor Reflection */}
        <div className="apple-dock-reflection flex items-center justify-center gap-1.5 sm:gap-3 px-3 sm:px-5 pointer-events-none">
          {dockItems.map((item, idx) => (
            <div
              key={`dock-refl-${item.id}-${idx}`}
              className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr ${item.gradient} opacity-30`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
