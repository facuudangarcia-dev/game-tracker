import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface SectionProps {
  id: string;
  title: string;
  /** Actions shown next to the heading. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A titled section of a page (landmark with its own heading). */
export function Section({ id, title, actions, children }: SectionProps) {
  const headingId = `${id}-title`;
  return (
    <Paper
      component="section"
      id={id}
      aria-labelledby={headingId}
      variant="outlined"
      sx={{ p: { xs: 2, md: 3 }, scrollMarginTop: 80 }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap' }}
      >
        <Typography id={headingId} variant="h6" component="h2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {actions ? (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {actions}
          </Stack>
        ) : null}
      </Stack>
      {children}
    </Paper>
  );
}
