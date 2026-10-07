import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { messages } from '../../i18n/messages';
import { SectionHeading } from './SectionHeading';

const t = messages.home;

/** The three steps, as a path joined by a line (horizontal on desktop). */
export function HomeSteps() {
  return (
    <Box component="section" aria-labelledby="home-steps">
      <SectionHeading id="home-steps" eyebrow={t.stepsEyebrow} title={t.stepsTitle} />
      <Box
        component="ol"
        sx={(theme) => ({
          listStyle: 'none',
          m: 0,
          mt: 3,
          p: 0,
          position: 'relative',
          display: 'grid',
          gap: { xs: 3, md: 4 },
          gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
          // The line joining the numbers.
          '&::before': {
            content: '""',
            position: 'absolute',
            background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${alpha(theme.palette.secondary.main, 0.2)})`,
            top: { xs: 0, md: 34 },
            bottom: { xs: 0, md: 'auto' },
            left: { xs: 27, md: 0 },
            right: { xs: 'auto', md: 0 },
            width: { xs: 2, md: 'auto' },
            height: { xs: 'auto', md: 2 },
            opacity: 0.5,
          },
        })}
      >
        {t.steps.map((step, index) => (
          <Box
            component="li"
            key={step.title}
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: { xs: 'row', md: 'column' },
              gap: { xs: 2, md: 2.5 },
              alignItems: 'flex-start',
            }}
          >
            <Box
              aria-hidden
              sx={(theme) => ({
                flexShrink: 0,
                width: { xs: 56, md: 68 },
                height: { xs: 56, md: 68 },
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'background.default',
                border: `2px solid ${alpha(theme.palette.primary.main, 0.6)}`,
                boxShadow: `0 0 0 6px ${theme.palette.background.default}, 0 0 28px ${alpha(theme.palette.primary.main, 0.35)}`,
                fontWeight: 900,
                fontSize: { xs: '1.2rem', md: '1.45rem' },
                fontVariantNumeric: 'tabular-nums',
                color: 'primary.main',
              })}
            >
              {String(index + 1).padStart(2, '0')}
            </Box>
            <Box sx={{ pt: { xs: 0.5, md: 0 } }}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 800 }}>
                {step.title}
              </Typography>
              <Typography color="text.secondary">{step.body}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
