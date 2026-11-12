import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeName =
  | 'default'
  | 'onyx'
  | 'x3000'
  | 'midnight'
  | 'morning'
  | 'coffee'
  | 'cyber';

export interface ThemeOption {
  id: ThemeName;
  label: string;
  description: string;
  /** Three representative colours shown in the palette picker. */
  swatches: [string, string, string];
  /** Cyber enables the particle atmosphere and motion layer. */
  motion?: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'The original navy, blue and cyan SOC scheme.',
    swatches: ['#070B14', '#2563EB', '#06B6D4'],
  },
  {
    id: 'onyx',
    label: 'Onyx',
    description: 'Brushed tungsten, graphite and layered metallic greys.',
    swatches: ['#08090B', '#9AA7B4', '#D9E0E7'],
  },
  {
    id: 'x3000',
    label: 'X3000',
    description: 'Titanium black, light grey and shock pink.',
    swatches: ['#08090A', '#C0C6CC', '#FF2D95'],
  },
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Midnight black with neon green.',
    swatches: ['#020604', '#15803D', '#39FF14'],
  },
  {
    id: 'morning',
    label: 'Morning',
    description: 'Paper white, beige, dark grey, orange and blue.',
    swatches: ['#F6F1E7', '#2F6F9F', '#D97706'],
  },
  {
    id: 'coffee',
    label: 'Coffee',
    description: 'Dark brown, soft pastel yellow and cream.',
    swatches: ['#1A120C', '#8A5A3B', '#E8C77A'],
  },
  {
    id: 'cyber',
    label: 'Cyber',
    description: 'Neon violet and cyan with particles and motion.',
    swatches: ['#05010D', '#7C3AED', '#22D3EE'],
    motion: true,
  },
];

export const THEME_STORAGE_KEY = 'csm-theme';
export const DEFAULT_THEME: ThemeName = 'cyber';

export const isThemeName = (value: string | null | undefined): value is ThemeName =>
  Boolean(value && THEME_OPTIONS.some(option => option.id === value));

const normalizeStoredTheme = (value: string | null): ThemeName => {
  if (value === 'steel') return 'onyx';
  return isThemeName(value) ? value : DEFAULT_THEME;
};

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return normalizeStoredTheme(stored);
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable in private or locked-down contexts.
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => setThemeState(next), []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
};
