import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../i18n/messages';

const t = messages.errors;

export function NotFoundPage() {
  return (
    <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {t.notFoundTitle}
      </Typography>
      <Typography color="text.secondary">{t.notFoundBody}</Typography>
      <Button component={RouterLink} to="/" variant="contained">
        {t.backHome}
      </Button>
    </Stack>
  );
}
