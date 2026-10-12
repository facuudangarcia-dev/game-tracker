import Check from '@mui/icons-material/Check';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { alpha } from '@mui/material/styles';
import { useState } from 'react';
import { setLocale, useLocale } from '../../i18n/locale';
import { type Locale, LOCALES, messages } from '../../i18n/messages';
import { ink } from '../../theme/brand';

/** Language names are shown in their own language, whatever the current one is. */
const LANGUAGE_NAMES: Record<Locale, string> = { es: 'Español', en: 'English' };

/**
 * Flags as inline SVG: emoji flags don't render on Windows (they show "ES"/"US").
 * Spain for Spanish and the United States for English.
 */
function Flag({ locale, size = 22 }: { locale: Locale; size?: number }) {
  const common = {
    width: size,
    height: Math.round((size * 2) / 3),
    viewBox: '0 0 30 20',
    'aria-hidden': true,
    style: { display: 'block', borderRadius: 3, boxShadow: '0 0 0 1px rgba(255,255,255,0.18)' },
  } as const;

  if (locale === 'es') {
    return (
      <svg {...common}>
        {/* Red, yellow (double height), red; simplified without the coat of arms. */}
        <rect width="30" height="20" fill="#aa151b" />
        <rect y="5" width="30" height="10" fill="#f1bf00" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((stripe) => (
        <rect key={stripe} y={(stripe * 20) / 13} width="30" height={20 / 13} fill="#b22234" />
      ))}
      <rect width="13" height={(7 * 20) / 13} fill="#3c3b6e" />
    </svg>
  );
}

/** Compact header control: the current language's flag; click to switch language. */
export function LanguageSelector() {
  const locale = useLocale();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        aria-label={messages.locale.current(LANGUAGE_NAMES[locale])}
        aria-haspopup="menu"
        aria-expanded={anchor ? 'true' : undefined}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={(theme) => ({
          // A small pill integrated in the header, like the nav items.
          px: { xs: 0.9, sm: 1.25 },
          py: 0.9,
          borderRadius: 99,
          border: `1px solid ${alpha(ink(theme), 0.1)}`,
          bgcolor: alpha(ink(theme), 0.03),
          '&:hover': {
            borderColor: alpha(theme.palette.primary.main, 0.5),
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        })}
      >
        <Flag locale={locale} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {LOCALES.map((option) => (
          <MenuItem
            key={option}
            lang={option}
            selected={option === locale}
            onClick={() => {
              setAnchor(null);
              setLocale(option);
            }}
          >
            <ListItemIcon>
              <Flag locale={option} size={20} />
            </ListItemIcon>
            <ListItemText>{LANGUAGE_NAMES[option]}</ListItemText>
            {option === locale ? (
              <Check fontSize="small" sx={{ ml: 2, color: 'primary.main' }} aria-hidden />
            ) : null}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
