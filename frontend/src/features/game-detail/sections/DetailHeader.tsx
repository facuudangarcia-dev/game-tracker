import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { messages } from '../../../i18n/messages';
import { formatMinutes, formatYear } from '../../../lib/format';
import { GameCover } from '../../library/GameCover';
import { RatingBadge } from '../../library/RatingBadge';
import { StatusChip } from '../../library/StatusChip';
import type { UserGameDetails } from '../../library/types';
import { DIFFICULTIES_SECTION_ID, type OnDetailAction } from '../detailActions';

const t = messages.detail;

export function DetailHeader({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const { game } = userGame;
  const canLogSession = userGame.playthroughs.some((p) => p.timeMode === 'SESSIONS');
  const subtitle = [formatYear(game.releaseDate), game.developers.join(', ')]
    .filter(Boolean)
    .join(' · ');

  return (
    <Stack
      component="header"
      aria-labelledby="game-title"
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
    >
      <GameCover src={game.coverUrl} name={game.name} width={{ xs: 160, md: 200 }} />
      <Stack spacing={1.5} sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          id="game-title"
          variant="h4"
          component="h1"
          sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {game.name}
        </Typography>
        {subtitle ? <Typography color="text.secondary">{subtitle}</Typography> : null}
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Chip label={userGame.platform.name} variant="outlined" />
          <StatusChip status={userGame.status} size="medium" />
          <Chip
            icon={<TimerOutlinedIcon />}
            label={`${t.totalTime}: ${formatMinutes(userGame.totalMinutes)}`}
            variant="outlined"
          />
          <RatingBadge rating={userGame.rating} />
          {userGame.platinum.achieved ? (
            <Chip
              icon={<EmojiEventsIcon />}
              color="secondary"
              label={messages.library.platinumBadge}
            />
          ) : null}
          {game.isManual ? <Chip size="small" variant="outlined" label={t.manualGame} /> : null}
        </Stack>
        {game.genres.length > 0 ? (
          <Typography variant="body2" color="text.secondary">
            {game.genres.map((g) => g.name).join(' · ')}
          </Typography>
        ) : null}
        {game.summary ? (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {game.summary}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', pt: 1 }}>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => onAction({ type: 'editGame' })}
          >
            {t.editGame}
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => onAction({ type: 'newPlaythrough' })}
          >
            {t.newPlaythrough}
          </Button>
          <Tooltip title={canLogSession ? '' : t.logSessionDisabled}>
            <Box component="span">
              <Button
                variant="outlined"
                startIcon={<TimerOutlinedIcon />}
                disabled={!canLogSession}
                onClick={() => onAction({ type: 'newSession' })}
              >
                {t.logSession}
              </Button>
            </Box>
          </Tooltip>
          <Button variant="outlined" startIcon={<TuneIcon />} href={`#${DIFFICULTIES_SECTION_ID}`}>
            {t.manageDifficulties}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => onAction({ type: 'deleteGame' })}
          >
            {t.deleteGame}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
