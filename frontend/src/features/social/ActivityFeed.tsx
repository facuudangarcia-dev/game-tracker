import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatRelative } from '../explore/format';
import { catalogGamePath } from '../catalog/queries';
import { GameCover } from '../library/GameCover';
import { PlayerAvatar } from '../profile/PlayerAvatar';
import { type ActivityItem, useActivity } from './api';
import { playerGamePath, playerPath } from './paths';

const t = messages.social.activity;

/** The verb of an event ("completó", "desbloqueó 3 logros en"...). */
function verb(item: ActivityItem): string {
  const events = t.events;
  switch (item.type) {
    case 'STATUS_CHANGED':
      return item.data.status === 'COMPLETED'
        ? events.STATUS_COMPLETED
        : item.data.status === 'PLAYED'
          ? events.STATUS_PLAYED
          : events.STATUS_IN_PROGRESS;
    case 'ACHIEVEMENTS':
      return events.ACHIEVEMENTS(item.data.count ?? 1);
    case 'STEAM_IMPORT':
      return events.STEAM_IMPORT(item.data.count ?? 1);
    default:
      return events[item.type];
  }
}

/** Where the event's game opens: the owner's game, else its catalog page. */
function gameLink(item: ActivityItem): string | null {
  const game = item.game;
  if (!game) {
    return null;
  }
  if (game.userGameId) {
    return item.self
      ? `/games/${game.userGameId}`
      : playerGamePath(item.user.username, game.userGameId);
  }
  return game.provider && game.externalId ? catalogGamePath(game.provider, game.externalId) : null;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const profile = item.self ? '/profile' : playerPath(item.user.username);
  const link = gameLink(item);
  const gameName: ReactNode = item.game ? (
    link ? (
      <Link component={RouterLink} to={link} sx={{ fontWeight: 800 }} underline="hover">
        {item.game.name}
      </Link>
    ) : (
      <Box component="strong">{item.game.name}</Box>
    )
  ) : null;

  return (
    <Box
      component="li"
      sx={(theme) => ({
        display: 'flex',
        gap: 1.5,
        alignItems: 'center',
        py: 1.5,
        borderTop: `1px solid ${theme.palette.divider}`,
        '&:first-of-type': { borderTop: 'none' },
      })}
    >
      <Box component={RouterLink} to={profile} sx={{ flexShrink: 0, lineHeight: 0 }}>
        <PlayerAvatar avatar={item.user.avatar} username={item.user.username} size={40} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ overflowWrap: 'anywhere', lineHeight: 1.45 }}>
          <Link
            component={RouterLink}
            to={profile}
            color="inherit"
            underline="hover"
            sx={{ fontWeight: 800 }}
          >
            {item.user.username}
          </Link>
          {item.self ? (
            <Chip label={t.you} size="small" sx={{ ml: 0.75, height: 20, fontWeight: 700 }} />
          ) : null}{' '}
          {verb(item)} {gameName}
          {item.type === 'RATED' && item.data.rating !== undefined
            ? ` ${t.ratedWith(item.data.rating)}`
            : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatRelative(item.createdAt)}
        </Typography>
      </Box>
      {item.game ? (
        <Box sx={{ flexShrink: 0 }}>
          <GameCover src={item.game.coverUrl} name={item.game.name} width={40} />
        </Box>
      ) : (
        <CloudDownloadOutlinedIcon color="disabled" sx={{ flexShrink: 0 }} aria-hidden />
      )}
    </Box>
  );
}

/**
 * Activity list (decision #86): the feed (own and friends') or one player's,
 * newest first, with "load more".
 */
export function ActivityFeed({ username, empty }: { username?: string; empty: ReactNode }) {
  const activity = useActivity(username);

  if (activity.isPending) {
    return (
      <Stack spacing={1.5}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }
  if (activity.isError) {
    return (
      <Alert severity="error" variant="outlined">
        {t.loadError}
      </Alert>
    );
  }
  const items = activity.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return <>{empty}</>;
  }
  return (
    <Stack spacing={1}>
      <Box component="ul" aria-label={t.title} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </Box>
      {activity.hasNextPage ? (
        <Button
          onClick={() => void activity.fetchNextPage()}
          loading={activity.isFetchingNextPage}
          sx={{ alignSelf: 'center' }}
        >
          {t.loadMore}
        </Button>
      ) : null}
    </Stack>
  );
}
