import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { SectionHeading } from '../features/home/SectionHeading';
import { ActivityFeed } from '../features/social/ActivityFeed';
import { messages } from '../i18n/messages';
import { panelSx } from '../theme/brand';

const t = messages.social.activity;

/** Activity (decision #86): what the user and their friends did lately. */
export function ActivityPage() {
  return (
    <Stack spacing={3} sx={{ maxWidth: 820, mx: 'auto' }}>
      <SectionHeading
        id="activity-title"
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Button component={RouterLink} to="/friends" variant="outlined">
            {t.findFriends}
          </Button>
        }
      />
      <Box sx={(theme) => ({ ...panelSx(theme), p: { xs: 2, md: 2.5 } })}>
        <ActivityFeed empty={<Typography color="text.secondary">{t.empty}</Typography>} />
      </Box>
    </Stack>
  );
}
