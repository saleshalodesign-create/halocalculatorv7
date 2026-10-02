import React, { useState, useEffect } from 'react';
import { UserProfile, Theme, ThemeType } from '../types';
import { GoogleIcon } from './GoogleIcon';
import { HaloLogo } from './HaloLogo';
import { Moon, Sun, Smartphone, Calculator, RectangleHorizontal, RectangleVertical, Square, Globe, FileSpreadsheet, Sparkles, FileCheck, Layers, Image as ImageIcon, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { isSoundEnabled, toggleSound, playSoftPop } from '../utils/soundEffects';

interface MacMenuBarProps {
  quoteCount: number;
  onOpenQuoteList: () => void;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  wallpaper?: string;
  onNextWallpaper?: () => void;
  user: UserProfile | null;
  onOpenAuth: () => void;
  onOpenMobileApp: () => void;
  onOpenMathCalc?: () => void;
  onOpenShapeModal?: () => void;
  onOpenDailySchedule?: () => void;
  onOpenPdfEditor?: () => void;
  onOpenPdfTools?: (tab?: 'join' | 'split') => void;
  onOpenImageConverter?: () => void;
  onOpenAiModal?: () => void;
  shapeType?: 'horizontal' | 'vertical' | 'square' | 'invalid';
  shapeLabel?: string;
}

export const MacMenuBar: React.FC<MacMenuBarProps> = ({
  quoteCount,
  onOpenQuoteList,
  theme,
  setTheme,
  wallpaper,
  onNextWallpaper,
  user,
  onOpenAuth,
  onOpenMobileApp,
  onOpenMathCalc,
  onOpenShapeModal,
  onOpenDailySchedule,
  onOpenPdfEditor,
  onOpenPdfTools,
  onOpenImageConverter,
  onOpenAiModal,
  shapeType = 'horizontal',
  shapeLabel = 'Horizontal',
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const [timeString, setTimeString] = useState('');
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const cycleTheme = () => {
    if (theme === Theme.DARK) {
      setTheme(Theme.LIGHT);
    } else {
      setTheme(Theme.DARK);
    }
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [language]);

  const displayShapeLabel = () => {
    if (language === 'zh') {
      if (shapeType === 'horizontal') return t.shapes.horizontal;
      if (shapeType === 'vertical') return t.shapes.vertical;
      if (shapeType === 'square') return t.shapes.square;
      return t.shapes.custom;
    }
    return shapeLabel;
  };

  return (
    <div className="apple-menubar-glass fixed top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] z-50 select-none">
      <div className="h-7 sm:h-8 flex items-center justify-between px-2 xs:px-3 text-[12px] sm:text-[13px] font-sans font-medium text-slate-800 dark:text-neutral-200">
        {/* Left System Menu */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-1 cursor-pointer hover:opacity-85 transition-opacity px-0.5 py-0.5 rounded shrink-0">
            <HaloLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4 shadow-sm" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white truncate text-[11px] xs:text-xs sm:text-[13px]">
            Halo Design Hub
          </span>
          <div className="hidden md:flex items-center gap-3 text-slate-600 dark:text-neutral-300">
            <button
              onClick={onOpenQuoteList}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {t.nav.quoteSheet} ({quoteCount})
            </button>
            <button
              onClick={onOpenMobileApp}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 font-semibold"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
              {t.nav.installApp}
            </button>
            {onOpenMathCalc && (
              <button
                onClick={onOpenMathCalc}
                className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1 font-medium"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-500" />
                {t.nav.calculatorBtn}
              </button>
            )}
            {onOpenShapeModal && (
              <button
                onClick={onOpenShapeModal}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 font-medium"
                title={t.shapes.title}
              >
                {shapeType === 'horizontal' ? (
                  <RectangleHorizontal className="w-3.5 h-3.5 text-blue-500" />
                ) : shapeType === 'vertical' ? (
                  <RectangleVertical className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{t.nav.shapeLabel} ({displayShapeLabel()})</span>
              </button>
            )}
            {onOpenDailySchedule && (
              <button
                onClick={onOpenDailySchedule}
                className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 font-medium"
                title={t.dailySchedule.title}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t.nav.schedule}</span>
              </button>
            )}
            {onOpenPdfEditor && (
              <button
                onClick={onOpenPdfEditor}
                className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1 font-medium"
                title="Halo PDF Editor"
              >
                <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                <span>{t.nav.pdfEditor || 'Edit PDF'}</span>
              </button>
            )}
            {onOpenPdfTools && (
              <button
                onClick={() => onOpenPdfTools('join')}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 font-medium"
                title={language === 'zh' ? 'PDF 合并与拆分工具箱' : 'PDF Joiner & Splitter'}
              >
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                <span>{language === 'zh' ? '合并/拆分' : 'Merge/Split'}</span>
              </button>
            )}
            {onOpenImageConverter && (
              <button
                onClick={onOpenImageConverter}
                className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1 font-medium"
                title={language === 'zh' ? '图片格式转换工作台' : 'Image File Converter'}
              >
                <ImageIcon className="w-3.5 h-3.5 text-cyan-500" />
                <span>{t.nav.imageConverter || (language === 'zh' ? '图片转换' : 'Converter')}</span>
              </button>
            )}
            {onOpenAiModal && (
              <button
                onClick={onOpenAiModal}
                className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400"
                title="Gemini AI Assistant & Multi-turn Chat"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                <span>{language === 'zh' ? 'Gemini 智能助手' : 'Gemini AI'}</span>
              </button>
            )}
          </div>
        </div>

      {/* Right System Tray */}
      <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-2.5 text-slate-700 dark:text-neutral-300 shrink-0">
        {/* Language Switcher Pill Button (中 / EN) */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-[10px] xs:text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
          title={t.nav.switchLanguage}
        >
          <Globe className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          <span>{language === 'zh' ? '中文' : 'EN'}</span>
        </button>

        {/* Wallpaper Switcher Pill Button */}
        {onNextWallpaper && (
          <button
            onClick={() => {
              playSoftPop();
              onNextWallpaper();
            }}
            className="flex items-center gap-1 px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-[10px] xs:text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title={`Wallpaper: ${wallpaper || 'Default'} (Click to switch)`}
          >
            <Sparkles className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-cyan-500" />
            <span className="hidden lg:inline">{t.dock.wallpaper || (language === 'zh' ? '壁纸' : 'Wallpaper')}</span>
          </button>
        )}

        {/* Haptic Sound Effects Toggle */}
        <button
          onClick={() => {
            const next = toggleSound();
            setSoundOn(next);
          }}
          className={`flex items-center gap-1 px-1.5 xs:px-2 sm:px-2 py-0.5 rounded-md sm:rounded-lg border text-[10px] xs:text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
            soundOn
              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-neutral-500 border-slate-200 dark:border-white/10 opacity-70'
          }`}
          title={soundOn ? (language === 'zh' ? '触感音效: 已开启 (点击静音)' : 'Sound Effects: On (Click to mute)') : (language === 'zh' ? '触感音效: 已静音 (点击开启)' : 'Sound Effects: Muted (Click to enable)')}
        >
          {soundOn ? <Volume2 className="w-3 h-3 text-emerald-500" /> : <VolumeX className="w-3 h-3 text-slate-400" />}
          <span className="hidden xl:inline">{soundOn ? (language === 'zh' ? '音效' : 'Sound') : (language === 'zh' ? '静音' : 'Mute')}</span>
        </button>

        {/* Calculator Button (Quick access icon for mobile screens) */}
        {onOpenMathCalc && (
          <button
            onClick={onOpenMathCalc}
            className="md:hidden flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
            title={t.nav.calculatorBtn}
          >
            <Calculator className="w-3 h-3 text-amber-500" />
          </button>
        )}

        {/* Quote item pill */}
        {quoteCount > 0 && (
          <button
            onClick={onOpenQuoteList}
            className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 text-[11px] font-bold hover:bg-blue-500/25 transition-colors border border-blue-500/20"
          >
            <span>{quoteCount} {t.nav.itemsCount}</span>
          </button>
        )}

        {/* Google Sign In / Account Pill */}
        <button
          onClick={onOpenAuth}
          className={`flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] xs:text-[11px] font-semibold transition-all border shadow-sm ${
            user
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              : 'bg-white dark:bg-neutral-800 text-slate-800 dark:text-neutral-200 border-slate-200 dark:border-white/10 hover:border-blue-500/50'
          }`}
          title={user ? `Signed in as ${user.email}` : t.nav.signInGoogle}
        >
          <GoogleIcon className="w-3 h-3" />
          <span className="hidden sm:inline font-bold truncate max-w-[130px]">
            {user ? user.displayName : t.nav.signInGoogle}
          </span>
          {user && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
        </button>

        {/* Quick Theme Switcher Pill */}
        <button
          onClick={cycleTheme}
          className="flex items-center gap-1 px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-[10px] xs:text-[11px] font-bold transition-all shadow-sm active:scale-95"
          title={`Theme: ${theme.toUpperCase()} (Click to toggle)`}
        >
          {theme === Theme.DARK ? (
            <Moon className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-indigo-400" />
          ) : (
            <Sun className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-amber-500" />
          )}
          <span className="capitalize hidden sm:inline">{theme === Theme.DARK ? t.nav.dark : t.nav.light}</span>
        </button>

        {/* WiFi & Battery icon */}
        <div className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-neutral-300">
          <svg className="w-3.5 h-3.5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <span className="text-[11px] font-mono hidden md:inline">100%</span>
          <div className="w-5 h-2.5 border border-current rounded-[3px] p-[1px] flex items-center">
            <div className="w-full h-full bg-current rounded-[1px]"></div>
          </div>
        </div>

        {/* Clock */}
        <span className="text-[11px] xs:text-[12px] font-medium tracking-tight whitespace-nowrap">
          {timeString || (language === 'zh' ? 'Halo 招牌中心' : 'Halo Hub')}
        </span>
      </div>
    </div>
  </div>
  );
};
