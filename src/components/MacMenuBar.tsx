import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ThemeType } from '../types';
import { GoogleIcon } from './GoogleIcon';
import { HaloLogo } from './HaloLogo';
import {
  Palette,
  Check,
  ChevronDown,
  Smartphone,
  Calculator,
  Globe,
  Sparkles,
  Volume2,
  VolumeX,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { isSoundEnabled, toggleSound, playSoftPop } from '../utils/soundEffects';
import { THEME_REGISTRY, ThemeMeta } from '../utils/themeIcons';

interface MacMenuBarProps {
  quoteCount?: number;
  onOpenQuoteList?: () => void;
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
  theme,
  setTheme,
  wallpaper,
  onNextWallpaper,
  user,
  onOpenAuth,
  onOpenMobileApp,
  onOpenMathCalc,
  onOpenAiModal,
}) => {
  const { language, toggleLanguage, t } = useLanguage();
  const [timeString, setTimeString] = useState('');
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const themeOptions: ThemeMeta[] = Object.values(THEME_REGISTRY);
  const currentThemeMeta = THEME_REGISTRY[theme] || themeOptions[0];

  useEffect(() => {
    if (!showThemeMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showThemeMenu]);

  const cycleTheme = () => {
    const list = themeOptions.map(o => o.id);
    const nextIdx = (list.indexOf(theme) + 1) % list.length;
    setTheme(list[nextIdx]);
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

  return (
    <div className="apple-menubar-glass fixed top-0 left-0 right-0 pt-[env(safe-area-inset-top,0px)] z-50 select-none">
      <div className="h-7 sm:h-8 flex items-center justify-between px-2 xs:px-3 text-[12px] sm:text-[13px] font-sans font-medium text-slate-800 dark:text-neutral-200">
        {/* Left System Menu */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1 cursor-pointer hover:opacity-85 transition-opacity px-0.5 py-0.5 rounded shrink-0">
            <HaloLogo className="w-3.5 h-3.5 sm:w-4 sm:h-4 shadow-sm" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white truncate text-[11px] xs:text-xs sm:text-[13px]">
            Halo Design Hub
          </span>
          <div className="hidden lg:flex items-center gap-2.5 text-slate-600 dark:text-neutral-300">
            <button
              onClick={onOpenMobileApp}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 font-medium text-[11px] sm:text-xs cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-500" />
              <span>{t.nav.installApp}</span>
            </button>
            {onOpenMathCalc && (
              <button
                onClick={onOpenMathCalc}
                className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors flex items-center gap-1 font-medium text-[11px] sm:text-xs cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.nav.calculatorBtn}</span>
              </button>
            )}
            {onOpenAiModal && (
              <button
                onClick={onOpenAiModal}
                className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-400 text-[11px] sm:text-xs cursor-pointer"
                title="Gemini AI Assistant & Multi-turn Chat"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500 animate-pulse" />
                <span>{language === 'zh' ? 'Gemini 智能助手' : 'Gemini AI'}</span>
              </button>
            )}
          </div>
        </div>

      {/* Right System Tray */}
      <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-2 text-slate-700 dark:text-neutral-300 shrink-0">
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
            className="flex items-center gap-1 px-1.5 xs:px-2 py-0.5 rounded-md sm:rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-[10px] xs:text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            title={`Wallpaper: ${wallpaper || 'Default'} (Click to switch)`}
          >
            <Sparkles className="w-3 h-3 xs:w-3.5 xs:h-3.5 text-cyan-500" />
            <span className="hidden xl:inline">{t.dock.wallpaper || (language === 'zh' ? '壁纸' : 'Wallpaper')}</span>
          </button>
        )}

        {/* Haptic Sound Effects Toggle */}
        <button
          onClick={() => {
            const next = toggleSound();
            setSoundOn(next);
          }}
          className={`flex items-center gap-1 px-1.5 xs:px-2 py-0.5 rounded-md sm:rounded-lg border text-[10px] xs:text-[11px] font-bold transition-all shadow-xs active:scale-95 cursor-pointer ${
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

        {/* Google Sign In / Account Pill */}
        <button
          onClick={onOpenAuth}
          className={`flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] xs:text-[11px] font-semibold transition-all border shadow-sm cursor-pointer ${
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

        {/* Quick Theme Switcher Pill with Popover */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => {
              playSoftPop();
              setShowThemeMenu(prev => !prev);
            }}
            className="flex items-center gap-1 px-1.5 xs:px-2 sm:px-2.5 py-0.5 rounded-md sm:rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 border border-slate-200 dark:border-white/10 text-[10px] xs:text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            title={`Theme: ${currentThemeMeta.enLabel || currentThemeMeta.label} (${themeOptions.length} themes)`}
          >
            {currentThemeMeta.icon}
            <span className="capitalize hidden sm:inline">{currentThemeMeta.enLabel || currentThemeMeta.label}</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* Theme Dropdown Popover */}
          {showThemeMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 rounded-xl bg-white/95 dark:bg-[#0a0f26]/95 backdrop-blur-xl border border-slate-200 dark:border-indigo-500/30 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-[75vh] overflow-y-auto mac-scrollbar">
              <div className="px-2.5 py-1.5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-[#0a0f26]/90 backdrop-blur-md z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-cyan-400 flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-cyan-500" />
                  Themes & Icons
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                  {themeOptions.length} Themes
                </span>
              </div>
              <div className="py-1 space-y-1">
                {themeOptions.map(opt => {
                  const isActive = opt.id === theme;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        playSoftPop();
                        setTheme(opt.id);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full flex flex-col p-2 rounded-lg text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-blue-500/10 dark:bg-cyan-500/15 border border-blue-500/30 dark:border-cyan-500/30 shadow-xs'
                          : 'hover:bg-slate-100 dark:hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${opt.colorDot} text-white shadow-xs`}>
                            {opt.icon}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                              {opt.enLabel || opt.label}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate font-normal">
                              {opt.enDescription || opt.description}
                            </p>
                          </div>
                        </div>
                        {isActive && (
                          <Check className="w-4 h-4 text-blue-500 dark:text-cyan-400 shrink-0 ml-1.5" />
                        )}
                      </div>

                      {/* Themed Icon Set Preview Badges */}
                      <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                        <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono font-semibold truncate">
                          ✦ {opt.iconSetEn || opt.iconSetName}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {opt.previewIcons.map((ic, i) => (
                            <span
                              key={`preview-ic-${opt.id}-${i}`}
                              className="w-5 h-5 rounded flex items-center justify-center bg-slate-200/60 dark:bg-white/10"
                            >
                              {ic}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
