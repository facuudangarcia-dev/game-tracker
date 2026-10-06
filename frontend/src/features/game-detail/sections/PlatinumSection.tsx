import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
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
      actions={
        <Button startIcon={<EditIcon />} onClick={() => onAction({ type: 'platinum' })}>
          {t.edit}
        </Button>
      }
    >
      <Stack spacing={2}>
        <div>
          {platinum.achieved ? (
            <Chip icon={<EmojiEventsIcon />} color="secondary" label={t.achieved} />
          ) : (
            <Chip variant="outlined" label={t.notAchieved} />
          )}
        </div>
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
