import Alert from '@mui/material/Alert';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { messages } from '../i18n/messages';

/**
 * Version of the legal documents shown here. Must match the version the backend
 * stores on acceptance (TERMS_VERSION / PRIVACY_VERSION in auth.constants.ts).
 */
const LEGAL_VERSION = '2026-10-06';

const t = messages.legal;

/** Public page with the Terms of use or the Privacy policy (provisional texts). */
export function LegalPage({ document }: { document: 'terms' | 'privacy' }) {
  const content = t[document];

  return (
    <Stack spacing={3} sx={{ maxWidth: 760 }}>
      <div>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {content.title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t.version(LEGAL_VERSION)}
        </Typography>
      </div>
      <Alert severity="warning" variant="outlined">
        {t.draftNotice}
      </Alert>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          {content.sections.map((section) => (
            <div key={section.title}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                {section.title}
              </Typography>
              <Typography color="text.secondary">{section.body}</Typography>
            </div>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
