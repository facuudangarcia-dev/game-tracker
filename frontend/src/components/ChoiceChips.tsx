import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Leading marker (status dot, icon...). */
  marker?: ReactNode;
}

interface ChoiceChipsProps<T extends string> {
  id: string;
  label: string;
  value: T;
  choices: Choice<T>[];
  onChange: (value: T) => void;
  /** Equal-width tiles in a row (few options) instead of wrapping pills. */
  fill?: boolean;
}

/**
 * Single choice among a few options as selectable pills (a radio group). More
 * visual than a select when every option fits on screen.
 */
export function ChoiceChips<T extends string>({
  id,
  label,
  value,
  choices,
  onChange,
  fill = false,
}: ChoiceChipsProps<T>) {
  return (
    <Box>
      <Typography
        id={id}
        variant="overline"
        sx={{
          display: 'block',
          color: 'text.secondary',
          fontWeight: 700,
          letterSpacing: 1.2,
          mb: 0.75,
        }}
      >
        {label}
      </Typography>
      <Box
        role="radiogroup"
        aria-labelledby={id}
        sx={{
          // Equal tiles only where they fit; on phones they wrap at their natural width.
          display: { xs: 'flex', sm: fill ? 'grid' : 'flex' },
          gridTemplateColumns: fill ? `repeat(${choices.length}, minmax(0, 1fr))` : undefined,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        {choices.map((choice) => {
          const checked = choice.value === value;
          return (
            <ButtonBase
              key={choice.value}
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(choice.value)}
              sx={(theme) => ({
                gap: 0.75,
                px: 1.75,
                py: 1,
                minHeight: 40,
                whiteSpace: 'nowrap',
                borderRadius: 99,
                typography: 'body2',
                fontWeight: checked ? 700 : 500,
                color: checked ? 'text.primary' : 'text.secondary',
                border: `1px solid ${checked ? theme.palette.primary.main : alpha(theme.palette.common.white, 0.12)}`,
                bgcolor: checked
                  ? alpha(theme.palette.primary.main, 0.18)
                  : alpha(theme.palette.common.white, 0.02),
                boxShadow: checked
                  ? `0 0 18px -6px ${alpha(theme.palette.primary.main, 0.8)}`
                  : 'none',
                transition: 'all .15s ease',
                '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.7) },
                '&.Mui-focusVisible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              })}
            >
              {choice.marker}
              {choice.label}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
