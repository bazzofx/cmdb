import React, { useState } from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../../theme/ThemeContext.js';

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const active = THEME_OPTIONS.find(option => option.id === theme) ?? THEME_OPTIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/40 hover:bg-white/10 transition-all cursor-pointer text-xs font-medium text-slate-300"
        title="Change colour palette"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {active.motion ? (
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
        ) : (
          <Palette className="w-3.5 h-3.5 text-blue-400" />
        )}
        <span className="hidden lg:inline">{active.label}</span>
        <span className="flex items-center -space-x-1 lg:hidden">
          {active.swatches.map(color => (
            <span
              key={color}
              className="w-2.5 h-2.5 rounded-full border border-black/20"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            aria-label="Colour palettes"
            className="absolute right-0 top-full mt-2 w-72 z-50 rounded-xl border border-white/10 bg-[var(--surface-2)] shadow-2xl p-2"
          >
            <div className="px-2 py-1.5 border-b border-white/10 mb-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Colour palette
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                Applied instantly and remembered on this device.
              </div>
            </div>

            {THEME_OPTIONS.map(option => {
              const isActive = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    setTheme(option.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isActive ? 'bg-blue-600/15 text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="mt-0.5 flex items-center -space-x-1 shrink-0">
                    {option.swatches.map(color => (
                      <span
                        key={color}
                        className="w-3.5 h-3.5 rounded-full border border-black/25"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold">{option.label}</span>
                      {option.motion && <Sparkles className="w-3 h-3 text-cyan-300" />}
                    </span>
                    <span className="block text-[10px] leading-snug text-slate-400 mt-0.5">
                      {option.description}
                    </span>
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
