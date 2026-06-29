import { createContext, useContext } from 'react';

// Brand tokens (port từ replit_generate/App.js)
export type Theme = {
  bg: string;
  white: string;
  ochre: string;
  muted: string;
  border: string;
};

export const DARK_THEME: Theme = {
  bg: '#0A0A0F',
  white: '#F5ECD7',
  ochre: '#C4873A',
  muted: 'rgba(245,236,215,0.4)',
  border: 'rgba(245,236,215,0.15)',
};

export const LIGHT_THEME: Theme = {
  bg: '#E8E2DA',
  white: '#1C1712',
  ochre: '#C4873A',
  muted: 'rgba(28,23,18,0.5)',
  border: 'rgba(28,23,18,0.18)',
};

// Font families. RN CLI: tên = PostScript name của .otf đã link (assets/fonts +
// `npx react-native-asset`). Nếu render sai tên, kiểm tra lại tên font thực tế trên máy.
export const F = {
  headline: 'SangBleuSunrise-Regular', // headlines, số lớn
  medium: 'SangBleuSunrise-Medium', // subheadings
  body: 'SuisseIntl-Regular', // body, labels, buttons
} as const;

export const ThemeToggleContext = createContext<() => void>(() => {});
export const ThemeContext = createContext<Theme>(DARK_THEME);

export const useTheme = (): Theme => useContext(ThemeContext);
export const useToggleTheme = (): (() => void) => useContext(ThemeToggleContext);
