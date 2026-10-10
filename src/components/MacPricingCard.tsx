import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Box,
  Zap,
  Image as ImageIcon,
  Printer,
  Scissors,
  Lightbulb,
  Layers,
  Edit2,
} from 'lucide-react';
import { playGlassTap } from '../utils/soundEffects';
import { Theme, ThemeType } from '../types';
import { getColumnTheme, ProductColumnKey } from '../utils/columnThemes';

interface MacPricingCardProps {
  title: string;
  subtitle?: string;
  price: number;
  rate?: number;
  rateUnit?: string;
  iconType: ProductColumnKey;
  iconBg?: string;
  isSelected?: boolean;
  onClick: () => void;
  onRateChange?: (newRate: number) => void;
  editTooltip?: string;
  isNightLit?: boolean;
  litColor?: 'warm' | 'neutral' | 'cool' | 'neon';
  theme?: ThemeType;
}

const MacPricingCardComponent: React.FC<MacPricingCardProps> = ({
  title,
  subtitle,
  price,
  rate,
  rateUnit = '/SQ FT',
  iconType,
  iconBg,
  isSelected = false,
  onClick,
  onRateChange,
  editTooltip = "Click to edit rate",
  isNightLit = false,
  litColor = 'warm',
  theme: activeTheme = Theme.DARK,
}) => {
  const [localRate, setLocalRate] = useState<string>(rate !== undefined ? rate.toString() : '');
  const [isClicked, setIsClicked] = useState<boolean>(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  // Column theme styling dynamically derived from the active theme
  const colTheme = getColumnTheme(activeTheme, iconType);
  const effectiveIconBg = iconBg || colTheme.iconBg;

  const isLit = isSelected || isClicked;

  const getLitAuraClasses = () => {
    if (!isNightLit) return '';
    switch (litColor) {
      case 'warm':
        return 'shadow-[0_0_36px_rgba(251,191,36,0.6)] border-amber-400 bg-amber-950/40 dark:bg-amber-950/60 ring-2 ring-amber-400/40';
      case 'neutral':
        return 'shadow-[0_0_36px_rgba(255,255,255,0.65)] border-white/90 bg-slate-900/60 dark:bg-black/60 ring-2 ring-white/50';
      case 'cool':
        return 'shadow-[0_0_38px_rgba(56,189,248,0.7)] border-cyan-400 bg-cyan-950/40 dark:bg-cyan-950/60 ring-2 ring-cyan-400/40';
      case 'neon':
        return 'shadow-[0_0_42px_rgba(236,72,153,0.7)] border-fuchsia-400 bg-fuchsia-950/40 dark:bg-fuchsia-950/60 ring-2 ring-fuchsia-400/40 animate-pulse';
      default:
        return 'shadow-[0_0_36px_rgba(251,191,36,0.6)] border-amber-400';
    }
  };

  const getLitBadge = () => {
    if (!isNightLit) return null;
    let label = '3000K WARM';
    let badgeClass = 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-[0_0_10px_rgba(251,191,36,0.8)]';
    if (litColor === 'neutral') {
      label = '4500K NATURAL';
      badgeClass = 'bg-white/20 text-white border-white/60 shadow-[0_0_10px_rgba(255,255,255,0.85)]';
    } else if (litColor === 'cool') {
      label = '6500K COOL';
      badgeClass = 'bg-cyan-400/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(56,189,248,0.85)]';
    } else if (litColor === 'neon') {
      label = 'RGB NEON';
      badgeClass = 'bg-fuchsia-400/20 text-fuchsia-300 border-fuchsia-400/50 shadow-[0_0_12px_rgba(236,72,153,0.9)] animate-pulse';
    }
    return (
      <span className={`text-[7.5px] font-mono font-black uppercase px-1.5 py-0.5 rounded-full border shrink-0 tracking-wider ${badgeClass}`}>
        ⚡ {label}
      </span>
    );
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Generate waterdrop ripple
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { id: `rip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, x, y };
      setRipples(prev => [...prev.slice(-3), newRipple]);
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id));
      }, 550);
    }

    playGlassTap();
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 600);
    onClick();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Subtle 3D tilt math: max 4 degrees
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = ((y - centerY) / centerY) * -4.5;
    const tiltY = ((x - centerX) / centerX) * 4.5;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (rate !== undefined) {
      setLocalRate(rate.toString());
    }
  }, [rate]);

  const handleRateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalRate(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && onRateChange) {
      onRateChange(parsed);
    }
  };

  const getIcon = () => {
    switch (iconType) {
      case 'lightbox': return <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'lightboxBacklit': return <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'backlit': return <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'trans': return <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'printed3d': return <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'vinylSticker': return <Scissors className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'ledStrip': return <Lightbulb className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      case 'acrylic': return <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
      default: return <Box className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />;
    }
  };

  const formattedPrice = Math.round(price).toLocaleString('en-US');

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isHovered
          ? `perspective(700px) rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateY(-2px)`
          : 'perspective(700px) rotateX(0deg) rotateY(0deg) translateY(0px)',
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.3s ease',
      }}
      className={`group relative rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 lg:p-4 cursor-pointer flex flex-col justify-between overflow-hidden min-h-[76px] sm:min-h-[96px] lg:min-h-[118px] gpu-layer active:scale-[0.98] transition-all duration-300 ${
        isNightLit
          ? `${getLitAuraClasses()} border-2 text-white`
          : isLit
          ? `${colTheme.selectedLightBg} ${colTheme.selectedDarkBg} border-2 ${colTheme.selectedLightBorder} ${colTheme.selectedDarkBorder} ${colTheme.selectedDarkShadow} glass-rainbow-rim ring-2 ring-current/20 shadow-lg`
          : `apple-card-glass border ${colTheme.border} ${colTheme.hoverBorder} ${colTheme.hoverBgDark} ${colTheme.hoverBgLight} shadow-sm`
      }`}
    >
      {/* Subtle Ambient Theme Column Glow */}
      {!isNightLit && (
        <div
          className={`pointer-events-none absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-15 dark:opacity-25 blur-2xl transition-all ${effectiveIconBg}`}
        />
      )}

      {/* Interactive Cursor Spotlight Sheen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-[inherit] z-0"
        style={{
          background: `radial-gradient(190px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.18), transparent 75%)`,
        }}
      />

      {/* Dynamic Waterdrop Ripple Clicks */}
      {ripples.map((r, idx) => (
        <span
          key={`ripple-${r.id}-${idx}`}
          className="liquid-ripple"
          style={{
            left: r.x,
            top: r.y,
            width: 70,
            height: 70,
            marginLeft: -35,
            marginTop: -35,
          }}
        />
      ))}

      {/* Top Row: Icon + Title + Lit Badge */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 min-w-0 relative z-10">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <div
            className={`w-6 h-6 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg ${effectiveIconBg} text-white flex items-center justify-center shadow-sm shrink-0 transition-all ${
              isNightLit
                ? 'scale-110 shadow-lg ring-2 ring-white/60 drop-shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-pulse'
                : isLit
                ? 'scale-105 shadow-md'
                : 'group-hover:scale-105'
            }`}
          >
            {getIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={`font-extrabold text-[11px] sm:text-xs lg:text-sm tracking-tight leading-snug truncate transition-colors ${
                isNightLit
                  ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                  : `${colTheme.selectedTitleText}`
              }`}
            >
              {title}
            </h4>
            {subtitle && (
              <span className={`block text-[8px] sm:text-[9px] font-bold tracking-wider uppercase truncate opacity-75 ${
                isNightLit ? 'text-white/80' : `${colTheme.selectedTitleText}`
              }`}>
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Top-Right Night Lit Simulation Pill */}
        {getLitBadge()}
      </div>

      {/* Bottom Row: Rate Badge & Total Price */}
      <div className={`mt-1.5 sm:mt-2 pt-1 sm:pt-1.5 flex items-center justify-between gap-1 flex-nowrap border-t border-black/10 dark:border-white/10 ${colTheme.border}`}>
        {/* Editable Rate Pill ($ 35 /SQ FT) */}
        {rate !== undefined ? (
          <div
            onClick={e => e.stopPropagation()}
            className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-md ${colTheme.badge} border shadow-xs shrink-0 transition-colors group/rate cursor-text`}
            title={editTooltip}
          >
            <span className="text-[8px] sm:text-[10px] font-bold opacity-80 select-none">$</span>
            {onRateChange ? (
              <input
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={localRate}
                onChange={handleRateInputChange}
                onFocus={e => e.target.select()}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                style={{
                  width: `${Math.max(2, (localRate || '').length) + 0.5}ch`,
                  minWidth: '18px',
                }}
                className="text-center text-[9px] sm:text-[11px] font-black text-current bg-transparent outline-none border-b border-transparent focus:border-current hover:border-current/40 transition-colors font-mono p-0"
                title={editTooltip}
              />
            ) : (
              <span className="text-[9px] sm:text-[11px] font-black text-current font-mono">{rate}</span>
            )}
            <span className="text-[7.5px] sm:text-[9px] font-bold opacity-85 tracking-tight uppercase select-none">{rateUnit}</span>
            <Edit2 className="w-2 h-2 opacity-75 group-hover/rate:opacity-100 transition-opacity hidden sm:inline shrink-0" />
          </div>
        ) : (
          <div />
        )}

        {/* Calculated Total */}
        <span
          className={`font-black font-mono tracking-tight transition-colors whitespace-nowrap shrink-0 text-right ${
            isNightLit
              ? 'text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]'
              : `${colTheme.selectedPriceText}`
          } ${
            formattedPrice.length > 7
              ? 'text-xs sm:text-sm lg:text-base'
              : formattedPrice.length > 5
              ? 'text-xs sm:text-base lg:text-lg'
              : 'text-xs sm:text-lg lg:text-xl'
          }`}
        >
          ${formattedPrice}
        </span>
      </div>
    </div>
  );
};

export const MacPricingCard = memo(MacPricingCardComponent);
