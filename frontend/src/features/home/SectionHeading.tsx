import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Right-aligned controls (e.g. rail arrows). */
  actions?: ReactNode;
}

/** Heading of a Home section: accent bar + eyebrow, title and optional subtitle. */
export function SectionHeading({ id, eyebrow, title, subtitle, actions }: SectionHeadingProps) {
  return (
    <Stack direction="row" sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Box
            aria-hidden
            sx={(theme) => ({
              width: 18,
              height: 3,
              borderRadius: 2,
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            })}
          />
          <Typography
            variant="overline"
            color="primary"
            sx={{ fontWeight: 700, letterSpacing: 1.5, lineHeight: 1.6 }}
          >
            {eyebrow}
          </Typography>
        </Stack>
        <Typography
          id={id}
          variant="h4"
          component="h2"
          sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '2rem' }, letterSpacing: -0.5 }}
        >
          {title}
        </Typography>
        {subtitle ? (
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions}
    </Stack>
  );
}
