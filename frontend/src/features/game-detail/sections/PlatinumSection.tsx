import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDate, formatMinutes } from '../../../lib/format';
import type { UserGameDetails } from '../../library/types';
import type { OnDetailAction } from '../detailActions';
import { Facts } from './MyGameSection';

const t = messages.detail.platinum;

export function PlatinumSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const { platinum } = userGame;
  return (
    <Section
      id="platino"
      title={messages.detail.sections.platinum}
      icon={<EmojiEventsIcon />}
      accent={(theme) => theme.palette.secondary.main}
      actions={
        <Button startIcon={<EditIcon />} onClick={() => onAction({ type: 'platinum' })}>
          {t.edit}
        </Button>
      }
    >
      <Stack spacing={2.25}>
        <Stack direction="row" spacing={1.75} sx={{ alignItems: 'center' }}>
          <Box
            aria-hidden
            sx={(theme) => ({
              width: 56,
              height: 56,
              flexShrink: 0,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: platinum.achieved
                ? `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.35)}, transparent 70%)`
                : alpha(theme.palette.common.white, 0.04),
            })}
          >
            <EmojiEventsIcon
              sx={(theme) => ({
                fontSize: 34,
                color: platinum.achieved ? 'secondary.main' : 'text.disabled',
                filter: platinum.achieved
                  ? `drop-shadow(0 0 10px ${alpha(theme.palette.secondary.main, 0.8)})`
                  : 'none',
              })}
            />
          </Box>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.1rem',
              color: platinum.achieved ? 'secondary.main' : 'text.secondary',
            }}
          >
            {platinum.achieved ? t.achieved : t.notAchieved}
          </Typography>
        </Stack>
        {platinum.achieved ? (
          <Facts
            items={[
              [t.date, formatDate(platinum.date)],
              [
                t.time,
                platinum.timeMinutes === null
                  ? messages.common.notSet
                  : formatMinutes(platinum.timeMinutes),
              ],
              [t.difficulty, platinum.difficulty?.name ?? t.noDifficulty],
            ]}
          />
        ) : null}
      </Stack>
    </Section>
  );
}
