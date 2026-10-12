import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { messages } from '../i18n/messages';

/**
 * Version of the legal documents shown here. Must match the version the backend
 * stores on acceptance (TERMS_VERSION / PRIVACY_VERSION in auth.constants.ts).
 */
const LEGAL_VERSION = '2026-10-11';

/** Contact address of both documents (VITE_CONTACT_EMAIL): required before publishing. */
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL?.trim() || null;

const t = messages.legal;

/** Public page with the Terms of use or the Privacy policy (decision #82). */
export function LegalPage({ document }: { document: 'terms' | 'privacy' }) {
  const content = t[document];
  const sections = CONTACT_EMAIL
    ? [...content.sections, { title: t.contactTitle, body: t.contactBody }]
    : content.sections;

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
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2.5}>
          {sections.map((section) => (
            <div key={section.title}>
              <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                {section.title}
              </Typography>
              <Typography color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                {section.body}
              </Typography>
              {section.title === t.contactTitle && CONTACT_EMAIL ? (
                <Link href={`mailto:${CONTACT_EMAIL}`} sx={{ fontWeight: 700 }}>
                  {CONTACT_EMAIL}
                </Link>
              ) : null}
            </div>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}
