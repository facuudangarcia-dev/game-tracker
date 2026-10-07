import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import FlagIcon from '@mui/icons-material/Flag';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDate, formatMinutes } from '../../../lib/format';
import { gradientTextSx, statusColor } from '../../../theme/brand';
import { StatusChip } from '../../library/StatusChip';
import type { Playthrough, UserGameDetails } from '../../library/types';
import type { OnDetailAction } from '../detailActions';
import { Facts } from './MyGameSection';

const t = messages.detail.playthroughs;

function PlaythroughCard({
  playthrough,
  onAction,
}: {
  playthrough: Playthrough;
  onAction: OnDetailAction;
}) {
  const isFirst = playthrough.number === 1;
  const mode = playthrough.timeMode === 'MANUAL' ? t.modeManual : t.modeSessions;

  return (
    <Box
      component="article"
      aria-label={t.title(playthrough.number)}
      sx={(theme) => ({
        p: { xs: 2, md: 2.5 },
        pl: { xs: 2.5, md: 3 },
        borderRadius: 2.5,
        bgcolor: alpha(theme.palette.common.white, 0.025),
        border: `1px solid ${alpha(theme.palette.common.white, 0.07)}`,
        // The status color as an edge on the left.
        boxShadow: `inset 3px 0 0 ${statusColor(theme, playthrough.status)}`,
      })}
    >
      <Stack
        direction="row"
        spacing={1.25}
        sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Typography
          aria-hidden
          sx={(theme) => ({
            fontSize: '1.6rem',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: -1,
            ...gradientTextSx(theme),
          })}
        >
          #{playthrough.number}
        </Typography>
        <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 800 }}>
          {t.title(playthrough.number)}
          {playthrough.name ? ` — ${playthrough.name}` : ''}
        </Typography>
        <StatusChip status={playthrough.status} />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t.edit(playthrough.number)}>
          <IconButton
            aria-label={t.edit(playthrough.number)}
            onClick={() => onAction({ type: 'editPlaythrough', playthrough })}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isFirst ? t.firstNotDeletable : t.delete(playthrough.number)}>
          <Box component="span">
            <IconButton
              aria-label={t.delete(playthrough.number)}
              disabled={isFirst}
              color="error"
              onClick={() => onAction({ type: 'deletePlaythrough', playthrough })}
            >
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>
      <Facts
        items={[
          [t.difficulty, playthrough.difficulty?.name ?? t.noDifficulty],
          [t.startDate, formatDate(playthrough.startDate)],
          [t.completionDate, formatDate(playthrough.completionDate)],
          [`${t.time} (${mode})`, formatMinutes(playthrough.minutes)],
        ]}
      />
      {playthrough.notes ? (
        <Typography
          variant="body2"
          sx={(theme) => ({
            mt: 2,
            pl: 1.5,
            borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
            fontStyle: 'italic',
            color: 'text.secondary',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          })}
        >
          {playthrough.notes}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
        {playthrough.timeMode === 'MANUAL' ? (
          <Button
            size="small"
            startIcon={<TimerOutlinedIcon />}
            aria-label={t.editTime(playthrough.number)}
            onClick={() => onAction({ type: 'manualTime', playthrough })}
          >
            {messages.detail.time.manualTitle}
          </Button>
        ) : (
          <Button
            size="small"
            startIcon={<TimerOutlinedIcon />}
            onClick={() => onAction({ type: 'newSession', playthroughId: playthrough.id })}
          >
            {messages.detail.logSession}
          </Button>
        )}
        <Button
          size="small"
          startIcon={<SwapHorizIcon />}
          aria-label={t.changeMode(playthrough.number)}
          onClick={() => onAction({ type: 'timeMode', playthrough })}
        >
          {playthrough.timeMode === 'MANUAL'
            ? messages.detail.time.switchToSessions
            : messages.detail.time.switchToManual}
        </Button>
      </Stack>
    </Box>
  );
}

export function PlaythroughsSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  return (
    <Section
      id="partidas"
      title={messages.detail.sections.playthroughs}
      icon={<FlagIcon />}
      actions={
        <Button startIcon={<AddIcon />} onClick={() => onAction({ type: 'newPlaythrough' })}>
          {messages.detail.newPlaythrough}
        </Button>
      }
    >
      <Stack spacing={1.75}>
        {userGame.playthroughs.map((playthrough) => (
          <PlaythroughCard key={playthrough.id} playthrough={playthrough} onAction={onAction} />
        ))}
      </Stack>
    </Section>
  );
}
