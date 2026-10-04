import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { messages } from '../i18n/messages';

/** Placeholder until the library is implemented in a later phase. */
export function HomePage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
        {messages.app.name}
      </Typography>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography color="text.secondary">{messages.app.homePlaceholder}</Typography>
      </Paper>
    </Stack>
  );
}
