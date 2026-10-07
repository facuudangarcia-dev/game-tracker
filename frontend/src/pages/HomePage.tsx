import SearchIcon from '@mui/icons-material/Search';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { GLOBAL_SEARCH_INPUT_ID } from '../features/catalog/GlobalSearch';
import { messages } from '../i18n/messages';

const t = messages.home;

/** Focuses the global catalog search in the header. */
function focusGlobalSearch() {
  document.getElementById(GLOBAL_SEARCH_INPUT_ID)?.focus();
}

/**
 * Presentation and entry point of the app. Deliberately not a dashboard:
 * no statistics, recent games or rankings (V2/V3).
 */
export function HomePage() {
  return (
    <Stack spacing={4}>
      <Paper
        variant="outlined"
        sx={(theme) => ({
          p: { xs: 3, sm: 5, md: 7 },
          textAlign: { xs: 'left', sm: 'center' },
          background: `radial-gradient(ellipse at top, ${theme.palette.primary.dark}33, transparent 60%), ${theme.palette.background.paper}`,
        })}
      >
        <Stack
          spacing={2.5}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, maxWidth: 720, mx: 'auto' }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'primary.main' }}>
            <SportsEsportsIcon aria-hidden />
            <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 2 }}>
              {t.eyebrow}
            </Typography>
          </Stack>
          <Typography
            variant="h3"
            component="h1"
            sx={{ fontWeight: 800, fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' } }}
          >
            {t.title}
          </Typography>
          <Typography variant="h6" component="p" color="text.secondary" sx={{ fontWeight: 400 }}>
            {t.body}
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              variant="contained"
              size="large"
              startIcon={<SearchIcon />}
              onClick={focusGlobalSearch}
            >
              {t.explore}
            </Button>
            <Button variant="outlined" size="large" component={RouterLink} to="/games">
              {t.library}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {t.steps.map((step, index) => (
          <Grid key={step.title} size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                <Box
                  aria-hidden
                  sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.body}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}
