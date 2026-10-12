import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LogoutIcon from '@mui/icons-material/Logout';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import StarIcon from '@mui/icons-material/Star';
import VideogameAssetIcon from '@mui/icons-material/VideogameAsset';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha, type Theme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { useLogout } from '../features/auth/useAuthMutations';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { SectionHeading } from '../features/home/SectionHeading';
import { type PlayerStats, usePlayerStats } from '../features/profile/api';
import { PriceCountrySelect } from '../features/explore/PriceCountrySelect';
import { AvatarDialog } from '../features/profile/AvatarDialog';
import { DeleteAccountDialog } from '../features/profile/DeleteAccountDialog';
import { playerPath } from '../features/social/paths';
import { VisibilitySetting } from '../features/social/VisibilitySetting';
import { PlayerAvatar } from '../features/profile/PlayerAvatar';
import { ProfileHighlights } from '../features/profile/ProfileHighlights';
import { intlLocale } from '../i18n/locale';
import { messages } from '../i18n/messages';
import { formatDate } from '../lib/format';
import {
  ambientBackground,
  brandGradient,
  gradientTextSx,
  ink,
  panelSx,
  statusColor,
  VIOLET,
} from '../theme/brand';

const t = messages.profile;
const s = messages.profile.stats;

type Accent = (theme: Theme) => string;

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  accent?: Accent;
  footer?: ReactNode;
  sx?: object;
}

/** One statistic: icon badge, big number, label (and an optional footer). */
function StatTile({ label, value, icon, accent, footer, sx }: StatTileProps) {
  return (
    <Box
      component="li"
      sx={(theme) => {
        const color = accent?.(theme) ?? theme.palette.primary.main;
        return {
          ...panelSx(theme, color),
          p: { xs: 2.25, md: 2.75 },
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          minWidth: 0,
          ...sx,
        };
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => {
          const color = accent?.(theme) ?? theme.palette.primary.main;
          return {
            width: 38,
            height: 38,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color,
            bgcolor: alpha(color, 0.14),
            boxShadow: `0 0 18px -6px ${alpha(color, 0.9)}`,
          };
        }}
      >
        {icon}
      </Box>
      <Typography
        component="p"
        sx={{
          fontSize: { xs: '1.9rem', md: '2.3rem' },
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: -1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {footer}
    </Box>
  );
}

/** Completed / in progress / played / pending as one segmented bar with its legend. */
function LibraryBreakdown({
  stats,
  progressTitle = s.progressTitle,
}: {
  stats: PlayerStats;
  progressTitle?: string;
}) {
  const segments = [
    { key: 'COMPLETED' as const, label: s.completed, value: stats.completed },
    { key: 'IN_PROGRESS' as const, label: s.inProgress, value: stats.inProgress },
    { key: 'PLAYED' as const, label: s.played, value: stats.played },
    { key: 'PENDING' as const, label: s.pending, value: stats.pending },
  ];
  const total = stats.totalGames;
  const completionRate = total > 0 ? Math.round((stats.completed / total) * 100) : 0;

  return (
    <Box
      component="li"
      sx={(theme) => ({
        ...panelSx(theme),
        p: { xs: 2.25, md: 2.75 },
        gridColumn: { xs: 'span 2', md: 'span 12' },
      })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ justifyContent: 'space-between', alignItems: { sm: 'baseline' }, gap: 0.5, mb: 2 }}
      >
        <Typography variant="h6" component="h3" sx={{ fontWeight: 800 }}>
          {progressTitle}
        </Typography>
        <Typography sx={(theme) => ({ fontWeight: 800, ...gradientTextSx(theme) })}>
          {s.completionRate(completionRate)}
        </Typography>
      </Stack>
      <Box
        aria-hidden
        sx={(theme) => ({
          display: 'flex',
          height: 14,
          borderRadius: 99,
          overflow: 'hidden',
          bgcolor: alpha(ink(theme), 0.06),
          gap: '3px',
        })}
      >
        {total > 0
          ? segments
              .filter((segment) => segment.value > 0)
              .map((segment) => (
                <Box
                  key={segment.key}
                  sx={(theme) => ({
                    flex: segment.value,
                    bgcolor: statusColor(theme, segment.key),
                    boxShadow: `0 0 12px ${alpha(statusColor(theme, segment.key), 0.6)}`,
                  })}
                />
              ))
          : null}
      </Box>
      <Box
        component="dl"
        sx={{
          m: 0,
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {segments.map((segment) => (
          <Box key={segment.key}>
            <Stack component="dt" direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box
                aria-hidden
                sx={(theme) => ({
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: statusColor(theme, segment.key),
                })}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                {segment.label}
              </Typography>
            </Stack>
            <Typography component="dd" sx={{ m: 0, mt: 0.25, fontSize: '1.6rem', fontWeight: 900 }}>
              {segment.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function RatingRing({ value }: { value: number | null }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={74}
        thickness={4}
        sx={(theme) => ({ color: alpha(ink(theme), 0.08), position: 'absolute' })}
      />
      <CircularProgress
        variant="determinate"
        value={value ?? 0}
        size={74}
        thickness={4}
        color="secondary"
      />
      <Typography
        component="span"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 900,
          fontSize: '1.3rem',
        }}
      >
        {value ?? '–'}
      </Typography>
    </Box>
  );
}

/**
 * The player's statistics: the current user's, or another player's already
 * loaded `stats` (a friend's profile, decision #85).
 */
export function StatsSection({
  stats: given,
  emptyText = s.empty,
  other = false,
}: {
  stats?: PlayerStats;
  emptyText?: string;
  /** Another player's stats: "su" instead of "tu". */
  other?: boolean;
}) {
  const stats = usePlayerStats(given === undefined);

  let content: ReactNode;
  if (!given && stats.isPending) {
    content = (
      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 3 }} />
        ))}
      </Box>
    );
  } else if (!given && stats.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void stats.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {s.loadError}
      </Alert>
    );
  } else {
    const data = given ?? stats.data!;
    const hours = Math.floor(data.totalMinutes / 60);
    content = (
      <Stack spacing={2}>
        {data.totalGames === 0 ? (
          <Alert severity="info" variant="outlined">
            {emptyText}
          </Alert>
        ) : null}
        <Box
          component="ul"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: 2,
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(12, minmax(0, 1fr))',
            },
          }}
        >
          {/* Hours: the headline number. */}
          <Box
            component="li"
            sx={(theme) => ({
              ...panelSx(theme, VIOLET),
              gridColumn: { xs: 'span 2', md: 'span 4' },
              gridRow: { md: 'span 2' },
              p: { xs: 2.5, md: 3.5 },
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 2,
              minHeight: { md: 300 },
            })}
          >
            <ScheduleIcon
              aria-hidden
              sx={(theme) => ({
                position: 'absolute',
                right: -30,
                top: -30,
                fontSize: 200,
                color: alpha(VIOLET, 0.08),
                filter: `drop-shadow(0 0 30px ${alpha(theme.palette.primary.main, 0.2)})`,
              })}
            />
            <Typography
              variant="overline"
              sx={{ color: VIOLET, fontWeight: 800, letterSpacing: 1.6 }}
            >
              {s.hoursPlayed}
            </Typography>
            <Box>
              <Typography
                component="p"
                sx={(theme) => ({
                  fontSize: { xs: '3.6rem', md: '5rem' },
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: -3,
                  fontVariantNumeric: 'tabular-nums',
                  ...gradientTextSx(theme),
                })}
              >
                {hours.toLocaleString(intlLocale())}
                <Box component="span" sx={{ fontSize: '0.4em', letterSpacing: 0, ml: 1 }}>
                  {s.hoursUnit}
                </Box>
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, fontWeight: 600 }}>
                {data.playthroughs} · {s.playthroughs}
              </Typography>
            </Box>
          </Box>

          <StatTile
            label={s.totalGames}
            value={data.totalGames}
            icon={<SportsEsportsIcon />}
            sx={{ gridColumn: { md: 'span 4' } }}
          />
          <StatTile
            label={s.platinums}
            value={data.platinums}
            icon={<EmojiEventsIcon />}
            accent={(theme) => theme.palette.secondary.main}
            sx={{ gridColumn: { md: 'span 4' } }}
          />
          <Box
            component="li"
            sx={(theme) => ({
              ...panelSx(theme, theme.palette.secondary.main),
              gridColumn: { xs: 'span 2', md: 'span 4' },
              p: { xs: 2.25, md: 2.75 },
              display: 'flex',
              alignItems: 'center',
              gap: 2.25,
            })}
          >
            <RatingRing value={data.averageRating} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>{s.averageRating}</Typography>
              <Stack
                direction="row"
                spacing={0.5}
                sx={{ alignItems: 'center', color: 'text.secondary' }}
              >
                <StarIcon sx={{ fontSize: 16, color: 'secondary.main' }} aria-hidden />
                <Typography variant="body2">
                  {data.rated > 0 ? s.rated(data.rated) : s.noRatings}
                </Typography>
              </Stack>
            </Box>
          </Box>
          <StatTile
            label={s.topPlatform}
            value={data.topPlatform?.shortName ?? messages.common.notSet}
            icon={<VideogameAssetIcon />}
            accent={(theme) => theme.palette.info.main}
            footer={
              data.topPlatform ? (
                <Typography variant="caption" color="text.secondary">
                  {s.gamesOn(data.topPlatform.games)}
                </Typography>
              ) : null
            }
            sx={{ gridColumn: { xs: 'span 2', md: 'span 4' } }}
          />

          <LibraryBreakdown
            stats={data}
            progressTitle={other ? s.progressTitleOther : s.progressTitle}
          />
        </Box>
      </Stack>
    );
  }

  return (
    <Box component="section" aria-labelledby="profile-stats">
      <SectionHeading
        id="profile-stats"
        eyebrow={other ? s.eyebrowOther : s.eyebrow}
        title={s.title}
      />
      <Box sx={{ mt: 2.5 }}>{content}</Box>
    </Box>
  );
}

/** "Player card": avatar, username and the player's statistics (real data). */
export function ProfilePage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  if (!user) {
    return null;
  }

  return (
    // Player card on the left; favorites and standout games in a column on the right.
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 4, md: 3 },
        alignItems: 'start',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(0, 1fr) 340px',
        },
      }}
    >
      <Stack spacing={{ xs: 4, md: 5 }} sx={{ minWidth: 0 }}>
        <Box
          component="section"
          aria-labelledby="profile-username"
          sx={(theme) => ({
            position: 'relative',
            overflow: 'hidden',
            borderRadius: { xs: 3, md: 4 },
            border: `1px solid ${alpha(ink(theme), 0.08)}`,
            background: ambientBackground(theme),
            px: 3,
            pt: { xs: 4, md: 5 },
            pb: { xs: 3.5, md: 4.5 },
            textAlign: 'center',
          })}
        >
          <Stack spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box sx={{ position: 'relative' }}>
              {/* Gradient ring with a soft glow around the picture. */}
              <Box
                sx={(theme) => ({
                  p: '5px',
                  borderRadius: '50%',
                  background: `conic-gradient(from 210deg, ${theme.palette.primary.main}, ${VIOLET}, ${theme.palette.secondary.main}, ${theme.palette.primary.main})`,
                  boxShadow: `0 0 50px -6px ${alpha(theme.palette.primary.main, 0.7)}`,
                })}
              >
                <Box sx={{ p: '4px', borderRadius: '50%', bgcolor: 'background.default' }}>
                  <PlayerAvatar avatar={user.avatar} username={user.username} size={148} />
                </Box>
              </Box>
              <Tooltip title={t.editAvatar}>
                <IconButton
                  aria-label={t.editAvatar}
                  onClick={() => setEditingAvatar(true)}
                  sx={(theme) => ({
                    position: 'absolute',
                    right: 6,
                    bottom: 6,
                    color: theme.palette.common.white,
                    background: brandGradient(theme, 135),
                    border: `3px solid ${theme.palette.background.default}`,
                    '&:hover': { background: brandGradient(theme, 135), filter: 'brightness(1.1)' },
                  })}
                >
                  <PhotoCameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 2, lineHeight: 1.5, pt: 1 }}
            >
              {t.eyebrow}
            </Typography>
            <Typography
              id="profile-username"
              variant="h3"
              component="h1"
              sx={{
                fontWeight: 900,
                letterSpacing: -1,
                lineHeight: 1,
                fontSize: { xs: '2.2rem', md: '3rem' },
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
                {t.memberSince} {formatDate(user.createdAt.slice(0, 10))}
              </Typography>
            </Stack>
          </Stack>
        </Box>

        <StatsSection />

        <Box
          component="section"
          aria-labelledby="profile-account"
          sx={(theme) => ({
            ...panelSx(theme),
            p: { xs: 2.5, md: 3 },
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          })}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id="profile-account"
              variant="overline"
              component="h2"
              sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: 1.6 }}
            >
              {t.account}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.email}
            </Typography>
            <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{user.email}</Typography>
            <Stack spacing={0.75} sx={{ mt: 2.5, alignItems: 'flex-start' }}>
              <PriceCountrySelect minWidth={240} />
              <Typography variant="caption" color="text.secondary">
                {t.countryHelp}
              </Typography>
            </Stack>
            <Box sx={{ mt: 2.5 }}>
              <VisibilitySetting value={user.profileVisibility} />
              <Button
                component={RouterLink}
                to={playerPath(user.username)}
                size="small"
                sx={{ mt: 1, px: 0 }}
              >
                {t.viewAsFriends}
              </Button>
            </Box>
          </Box>
          <Stack
            spacing={1}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, alignItems: { sm: 'flex-end' } }}
          >
            <Button
              variant="outlined"
              color="error"
              startIcon={<LogoutIcon />}
              loading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {t.logout}
            </Button>
            <Button size="small" color="error" onClick={() => setDeletingAccount(true)}>
              {t.deleteAccount.open}
            </Button>
          </Stack>
        </Box>

        {editingAvatar ? (
          <AvatarDialog user={user} onClose={() => setEditingAvatar(false)} />
        ) : null}
        {deletingAccount ? <DeleteAccountDialog onClose={() => setDeletingAccount(false)} /> : null}
      </Stack>
      <Box sx={{ minWidth: 0, position: { lg: 'sticky' }, top: { lg: 96 } }}>
        <ProfileHighlights />
      </Box>
    </Box>
  );
}
