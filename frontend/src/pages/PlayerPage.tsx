import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router';
import { type Choice, ChoiceChips } from '../components/ChoiceChips';
import { catalogGamePath } from '../features/catalog/queries';
import { formatMoney } from '../features/explore/format';
import { GameCover } from '../features/library/GameCover';
import { LibraryCard } from '../features/library/LibraryCard';
import { PlayerAvatar } from '../features/profile/PlayerAvatar';
import { ProfileHighlights } from '../features/profile/ProfileHighlights';
import { ActivityFeed } from '../features/social/ActivityFeed';
import { usePlayerLibrary, usePlayerProfile, usePlayerWishlist } from '../features/social/api';
import { playerGamePath } from '../features/social/paths';
import { UserActionsMenu } from '../features/social/UserActionsMenu';
import { messages } from '../i18n/messages';
import { ApiError } from '../lib/api/client';
import { formatDate } from '../lib/format';
import { ambientBackground, ink, panelSx } from '../theme/brand';
import { StatsSection } from './ProfilePage';

const t = messages.social.player;

type Tab = 'activity' | 'library' | 'wishlist';

function errorCode(error: unknown): string | null {
  if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null) {
    return (error.body as { code?: string }).code ?? null;
  }
  return null;
}

function Empty({ text }: { text: string }) {
  return <Typography color="text.secondary">{text}</Typography>;
}

function PlayerLibrary({ username }: { username: string }) {
  const library = usePlayerLibrary(username);
  if (library.isPending) {
    return <Skeleton variant="rounded" height={240} />;
  }
  if (library.isError || library.data.length === 0) {
    return <Empty text={t.emptyLibrary} />;
  }
  return (
    <Box
      component="ul"
      aria-label={t.tabs.library}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        // Small posters (the panel scrolls): a library of 100 games stays compact.
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(auto-fill, minmax(140px, 1fr))',
        },
        // The cards' hover lift stays inside the box.
        pt: 1,
      }}
    >
      {library.data.map((item) => (
        <Box component="li" key={item.id} sx={{ aspectRatio: '3 / 4.4' }}>
          <LibraryCard item={item} to={playerGamePath(username, item.id)} readOnly />
        </Box>
      ))}
    </Box>
  );
}

function PlayerWishlist({ username }: { username: string }) {
  const wishlist = usePlayerWishlist(username);
  if (wishlist.isPending) {
    return <Skeleton variant="rounded" height={200} />;
  }
  if (wishlist.isError || wishlist.data.items.length === 0) {
    return <Empty text={t.emptyWishlist} />;
  }
  return (
    <Box component="ul" aria-label={t.tabs.wishlist} sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {wishlist.data.items.map((item) => {
        const best = item.price?.best ?? null;
        return (
          <Box
            component="li"
            key={item.id}
            sx={(theme) => ({
              borderTop: `1px solid ${theme.palette.divider}`,
              '&:first-of-type': { borderTop: 'none' },
            })}
          >
            <Box
              component={RouterLink}
              to={catalogGamePath(item.game.provider, item.game.externalId)}
              sx={(theme) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                py: 1.25,
                color: 'inherit',
                textDecoration: 'none',
                borderRadius: 2,
                '&:hover': { bgcolor: alpha(ink(theme), 0.04) },
              })}
            >
              <GameCover src={item.game.coverUrl} name={item.game.name} width={44} />
              <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>
                {item.game.name}
              </Typography>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary" component="p">
                  {t.price}
                </Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {best ? formatMoney(best.price) : t.noPrice}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Another player's profile, read-only (decision #85): their card, stats,
 * highlights, activity, library and wishlist. Only friends who share their
 * profile get here; the own one shows how friends see it.
 */
export function PlayerPage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const profile = usePlayerProfile(username);
  const [tab, setTab] = useState<Tab>('activity');
  const tabs: Choice<Tab>[] = (['activity', 'library', 'wishlist'] as const).map((value) => ({
    value,
    label: t.tabs[value],
  }));

  const back = (
    <Button
      component={RouterLink}
      to="/friends"
      startIcon={<ArrowBackIcon />}
      sx={{ alignSelf: 'flex-start' }}
    >
      {t.back}
    </Button>
  );

  if (profile.isPending) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 4 }} />
        <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }
  if (profile.isError) {
    const isPrivate = errorCode(profile.error) === 'PROFILE_PRIVATE';
    return (
      <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto' }}>
        {back}
        <Alert
          severity={isPrivate ? 'info' : 'warning'}
          variant="outlined"
          icon={isPrivate ? <LockOutlinedIcon /> : undefined}
        >
          {isPrivate ? t.private : t.notFound}
        </Alert>
      </Stack>
    );
  }

  const { user, self, stats, highlights } = profile.data;
  return (
    <Stack spacing={3}>
      {back}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 4, md: 3 },
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' },
        }}
      >
        <Stack spacing={{ xs: 4, md: 5 }} sx={{ minWidth: 0 }}>
          <Box
            component="section"
            aria-labelledby="player-username"
            sx={(theme) => ({
              position: 'relative',
              borderRadius: { xs: 3, md: 4 },
              border: `1px solid ${alpha(ink(theme), 0.08)}`,
              background: ambientBackground(theme),
              px: 3,
              py: { xs: 3.5, md: 4 },
              textAlign: 'center',
            })}
          >
            {self ? null : (
              <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
                <UserActionsMenu
                  username={user.username}
                  friend
                  onRemoved={() => void navigate('/friends', { replace: true })}
                />
              </Box>
            )}
            <Stack spacing={1.25} sx={{ alignItems: 'center' }}>
              <PlayerAvatar avatar={user.avatar} username={user.username} size={120} />
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 800, letterSpacing: 2, lineHeight: 1.5 }}
              >
                {t.eyebrow}
              </Typography>
              <Typography
                id="player-username"
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 900,
                  letterSpacing: -1,
                  lineHeight: 1,
                  fontSize: { xs: '2rem', md: '2.6rem' },
                  overflowWrap: 'anywhere',
                }}
              >
                {user.username}
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ alignItems: 'center', color: 'text.secondary' }}
              >
                <CalendarMonthIcon sx={{ fontSize: 17 }} aria-hidden />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t.memberSince(formatDate(user.memberSince.slice(0, 10)))}
                </Typography>
              </Stack>
              {self ? (
                <Typography variant="caption" color="text.secondary">
                  {t.self}
                </Typography>
              ) : null}
            </Stack>
          </Box>

          <StatsSection stats={stats} emptyText={t.emptyStats} other={!self} />

          <Box component="section" aria-label={t.tabs[tab]}>
            <ChoiceChips
              id="player-tabs"
              label={t.eyebrow}
              value={tab}
              choices={tabs}
              onChange={setTab}
            />
            {/* Long libraries and activity scroll inside the panel, not the page. */}
            <Box
              sx={(theme) => ({
                ...panelSx(theme),
                p: { xs: 2, md: 2.5 },
                mt: 2,
                maxHeight: { xs: 560, md: 640 },
                overflowY: 'auto',
              })}
            >
              {tab === 'activity' ? (
                <ActivityFeed username={user.username} empty={<Empty text={t.emptyActivity} />} />
              ) : tab === 'library' ? (
                <PlayerLibrary username={user.username} />
              ) : (
                <PlayerWishlist username={user.username} />
              )}
            </Box>
          </Box>
        </Stack>
        <Box sx={{ minWidth: 0, position: { lg: 'sticky' }, top: { lg: 96 } }}>
          <ProfileHighlights
            highlights={highlights}
            gamePath={(userGameId) => playerGamePath(user.username, userGameId)}
          />
        </Box>
      </Box>
    </Stack>
  );
}
