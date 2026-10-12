import { alpha, createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import { ink } from './brand';

const VIOLET = '#b48cff';

/** Brand colors per mode: the light ones are a bit deeper so they read on white. */
const PALETTES = {
  dark: {
    primary: { main: '#7c9cff' },
    secondary: { main: '#ffb74d' },
    background: { default: '#0f1115', paper: '#171a21' },
  },
  light: {
    primary: { main: '#4a6cf0' },
    secondary: { main: '#e8890c' },
    background: { default: '#f3f5fa', paper: '#ffffff' },
    text: { primary: '#14161c', secondary: '#555c6b' },
  },
} as const;

/**
 * Game Tracker's theme in light or dark mode (decision #83). Subtle borders and
 * surfaces use "ink" (white on dark, black on light) so both modes share the styles.
 */
export function createAppTheme(mode: PaletteMode): Theme {
  return createTheme({
    palette: { mode, ...PALETTES[mode] },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: ['Roboto', 'system-ui', '-apple-system', 'Segoe UI', 'Arial', 'sans-serif'].join(
        ',',
      ),
    },
    components: {
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: ({ theme }) => ({
            borderBottom: `1px solid ${theme.palette.divider}`,
            backdropFilter: 'blur(8px)',
          }),
        },
      },

      /*
       * Fields (text, number, date, select, textarea) share one language: a dark
       * surface integrated with the page, a fine border, a blue/violet focus ring
       * (no glow) and integrated error/disabled states.
       */
      MuiOutlinedInput: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 12,
            // A field at rest: a touch apart from the page, never a separate "box".
            backgroundColor: alpha(ink(theme), 0.035),
            transition: 'background-color .18s ease, box-shadow .18s ease',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(ink(theme), 0.1),
              borderWidth: 1,
              transition: 'border-color .18s ease',
              // Same weight as the floating label, so the notch fits it exactly.
              '& legend': { fontWeight: 600 },
            },
            '&:hover:not(.Mui-disabled):not(.Mui-focused) .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(VIOLET, 0.45),
            },
            '&:hover:not(.Mui-disabled):not(.Mui-focused)': {
              backgroundColor: alpha(ink(theme), 0.05),
            },
            '&.Mui-focused': {
              backgroundColor: alpha(theme.palette.primary.main, 0.06),
              // A crisp ring in the brand color instead of MUI's thick outline.
              boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.16)}`,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: theme.palette.primary.main,
              borderWidth: 1,
            },
            '&.Mui-error .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(theme.palette.error.main, 0.75),
            },
            '&.Mui-error.Mui-focused': {
              backgroundColor: alpha(theme.palette.error.main, 0.05),
              boxShadow: `0 0 0 3px ${alpha(theme.palette.error.main, 0.16)}`,
            },
            '&.Mui-disabled': {
              backgroundColor: alpha(ink(theme), 0.015),
            },
            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(ink(theme), 0.06),
              borderStyle: 'dashed',
            },
            '& .MuiInputAdornment-root': {
              color: theme.palette.text.secondary,
              transition: 'color .18s ease',
            },
            '&.Mui-focused .MuiInputAdornment-root': { color: theme.palette.primary.main },
            '&.Mui-focused .MuiNativeSelect-icon, &.Mui-focused .MuiSelect-icon': {
              color: theme.palette.primary.main,
            },
          }),
          input: ({ theme }) => ({
            '&::placeholder': {
              color: theme.palette.text.secondary,
              opacity: 0.65,
            },
            '&.Mui-disabled': { WebkitTextFillColor: theme.palette.text.disabled },
            // Browser autofill (login, register) keeps the dark field instead of a pale box.
            '&:-webkit-autofill': {
              WebkitBoxShadow: `0 0 0 100px ${theme.palette.background.paper} inset`,
              WebkitTextFillColor: theme.palette.text.primary,
              caretColor: theme.palette.text.primary,
              borderRadius: 'inherit',
            },
          }),
          multiline: { lineHeight: 1.6 },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: ({ theme }) => ({
            color: theme.palette.text.secondary,
            fontWeight: 600,
            '&.Mui-focused': { color: theme.palette.primary.light },
            '&.Mui-error': { color: theme.palette.error.light },
            '&.Mui-disabled': { color: theme.palette.text.disabled },
          }),
          asterisk: ({ theme }) => ({ color: theme.palette.secondary.main }),
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: ({ theme }) => ({
            marginLeft: 6,
            marginRight: 6,
            marginTop: 6,
            fontSize: '0.78rem',
            lineHeight: 1.45,
            color: theme.palette.text.secondary,
            '&.Mui-error': { color: theme.palette.error.light },
          }),
        },
      },
      // Selects (native and MUI) look exactly like text fields; only the chevron is added.
      MuiNativeSelect: {
        styleOverrides: {
          icon: ({ theme }) => ({ color: theme.palette.text.secondary, right: 10 }),
          select: ({ theme }) => ({
            '& option': { backgroundColor: theme.palette.background.paper },
          }),
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: ({ theme }) => ({ color: theme.palette.text.secondary, right: 10 }),
        },
      },
    },
  });
}

/** Dark theme: also used by surfaces that stay dark in both modes (over artwork). */
export const darkTheme = createAppTheme('dark');
export const lightTheme = createAppTheme('light');
