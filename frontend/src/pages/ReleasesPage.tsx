import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventIcon from '@mui/icons-material/Event';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode, useState } from 'react';
import { useSearchParams } from 'react-router';
import { type Choice, ChoiceChips } from '../components/ChoiceChips';
import { useReleases, useUndatedGames } from '../features/explore/api';
import { CatalogCard } from '../features/explore/CatalogCard';
import { ExploreHeader, FilterSelect, StatePanel } from '../features/explore/ExploreLayout';
import { POSTER_GRID_SX } from '../features/explore/styles';
import { estimatedDateLabel } from '../features/explore/format';
import { MONTH_PATTERN, releaseRange, type View, VIEWS } from '../features/explore/releaseRange';
import type { Release } from '../features/explore/types';
import { CalendarBadge } from '../features/home/CalendarBadge';
import { calendarParts } from '../features/home/homeFormat';
import { SectionHeading } from '../features/home/SectionHeading';
import { useGenres, usePlatforms } from '../features/library/queries';
import { genreName } from '../i18n/genres';
import { dateFormat } from '../i18n/locale';
import { messages } from '../i18n/messages';
import { panelSx } from '../theme/brand';

const t = messages.releases;
/** Cards shown per date before "show more" (estimated periods can have hundreds). */
const GROUP_LIMIT = 12;
/** Smaller posters than the catalog grid: a date can have many games. */
const COMPACT_GRID_SX = {
  display: 'grid',
  gap: { xs: 1.5, sm: 2 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(auto-fill, minmax(140px, 1fr))',
  },
} as const;
function shiftMonth(month: string, delta: number): string {
  const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

interface ReleaseGroup {
  key: string;
  /** Confirmed day (badge) or the label of an estimated period. */
  date: string | null;
  label: string;
  releases: Release[];
}

/** Confirmed releases by day; estimated ones by their period, after the confirmed ones of the same date. */
function groupReleases(releases: Release[]): ReleaseGroup[] {
  const groups = new Map<string, ReleaseGroup>();
  for (const release of releases) {
    const confirmed = release.precision === 'day';
    const label = confirmed
      ? calendarParts(release.date).long
      : estimatedDateLabel(release.date, release.precision);
    const key = confirmed ? release.date : `${release.precision}:${label}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, date: confirmed ? release.date : null, label, releases: [] };
      groups.set(key, group);
    }
    group.releases.push(release);
  }
  return [...groups.values()];
}

/** One date (or estimated period): the most anticipated first, the rest on demand. */
function ReleaseGroupSection({ group }: { group: ReleaseGroup }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? group.releases : group.releases.slice(0, GROUP_LIMIT);
  const hidden = group.releases.length - visible.length;
  return (
    <Box
      component="section"
      aria-label={group.label}
      sx={(theme) => ({
        // Calendar layout on wide screens: the date on the left, its games on the right.
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '200px minmax(0, 1fr)' },
        pt: 3,
        borderTop: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Stack
        direction={{ xs: 'row', md: 'column' }}
        spacing={1.5}
        sx={{
          alignItems: { xs: 'center', md: 'flex-start' },
          alignSelf: 'start',
          position: { md: 'sticky' },
          top: { md: 96 },
        }}
      >
        {group.date ? (
          <CalendarBadge date={group.date} decorative />
        ) : (
          <Box
            aria-hidden
            sx={(theme) => ({
              width: 52,
              height: 52,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              color: 'secondary.main',
              border: `1px dashed ${alpha(theme.palette.secondary.main, 0.6)}`,
            })}
          >
            <EventRepeatIcon />
          </Box>
        )}
        <Box>
          <Typography
            component="h3"
            sx={{ fontWeight: 800, lineHeight: 1.25, fontSize: { xs: '1.1rem', md: '1rem' } }}
          >
            {group.label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[group.date ? t.confirmed : t.estimated, t.count(group.releases.length)].join(' · ')}
          </Typography>
        </Box>
      </Stack>
      <Box sx={{ minWidth: 0 }}>
        <Box component="ul" sx={{ ...COMPACT_GRID_SX, listStyle: 'none', m: 0, p: 0 }}>
          {visible.map((release) => (
            <Box component="li" key={release.externalId} sx={{ minWidth: 0 }}>
              <CatalogCard
                game={release}
                meta={(release.releasePlatforms.length > 0
                  ? release.releasePlatforms
                  : release.platforms
                )
                  .map((p) => p.shortName)
                  .join(' · ')}
              />
            </Box>
          ))}
        </Box>
        {hidden > 0 ? (
          <Box sx={{ mt: 2 }}>
            <Button onClick={() => setExpanded(true)} sx={{ borderRadius: 99 }}>
              {t.showMore(hidden)}
            </Button>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function formatDay(iso: string): string {
  return dateFormat({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

/**
 * Release calendar (decision #65): views of the coming days, a month or the next
 * months, navigable; confirmed and estimated dates told apart; games without a
 * date in their own section. Reuses the Home's calendar badge.
 */
export function ReleasesPage() {
  const [params, setParams] = useSearchParams();
  const viewParam = params.get('view') as View | null;
  const view: View = viewParam && VIEWS.includes(viewParam) ? viewParam : 'week';
  const offset = Number.parseInt(params.get('offset') ?? '0', 10) || 0;
  const month = params.get('month');
  const platform = params.get('platform') ?? undefined;
  const genre = params.get('genre') ?? undefined;
  const { from, to } = releaseRange(view, offset, month);
  const currentMonth = from.slice(0, 7);

  const releases = useReleases(from, to, platform, genre);
  const undated = useUndatedGames(platform, genre);
  const platforms = usePlatforms();
  const genres = useGenres();

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
    }
    setParams(next, { replace: true });
  };
  const move = (delta: number) =>
    view === 'month'
      ? update({ month: shiftMonth(currentMonth, delta) })
      : update({ offset: offset + delta === 0 ? null : String(offset + delta) });

  const viewChoices: Choice<View>[] = VIEWS.map((value) => ({ value, label: t.views[value] }));
  const list = releases.data?.releases ?? [];
  const groups = groupReleases(list);

  let content: ReactNode;
  if (releases.isPending) {
    content = (
      <Box sx={POSTER_GRID_SX} aria-busy="true" aria-label={messages.app.loading}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} variant="rounded" sx={{ aspectRatio: '3 / 4', height: 'auto' }} />
        ))}
      </Box>
    );
  } else if (releases.isError) {
    content = (
      <Alert
        severity="error"
        variant="outlined"
        action={
          <Button color="inherit" size="small" onClick={() => void releases.refetch()}>
            {messages.errors.retry}
          </Button>
        }
      >
        {messages.explore.loadError}
      </Alert>
    );
  } else if (!releases.data.catalogAvailable) {
    content = <StatePanel body={messages.explore.catalogUnavailable} />;
  } else if (groups.length === 0) {
    content = <StatePanel body={t.empty} icon={<EventIcon />} />;
  } else {
    content = (
      <Stack spacing={3}>
        {groups.map((group) => (
          <ReleaseGroupSection key={group.key} group={group} />
        ))}
      </Stack>
    );
  }

  const undatedGames = undated.data?.games ?? [];

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      <ExploreHeader
        id="releases-title"
        eyebrow={t.eyebrow}
        title={t.title}
        accent={t.titleAccent}
        body={t.body}
        icon={<EventIcon />}
      />

      <Box
        component="form"
        role="search"
        aria-label={t.title}
        onSubmit={(e) => e.preventDefault()}
        sx={(theme) => ({ ...panelSx(theme), p: { xs: 2, md: 2.5 } })}
      >
        <Stack spacing={2}>
          <ChoiceChips
            id="releases-view"
            label={t.view}
            value={view}
            choices={viewChoices}
            onChange={(value) =>
              update({ view: value === 'week' ? null : value, offset: null, month: null })
            }
          />
          <Stack
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}
          >
            {view === 'month' ? (
              <TextField
                type="month"
                size="small"
                label={t.month}
                value={currentMonth}
                onChange={(e) =>
                  MONTH_PATTERN.test(e.target.value) ? update({ month: e.target.value }) : undefined
                }
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 170 }}
              />
            ) : null}
            <FilterSelect
              label={messages.explore.platform}
              value={platform ?? ''}
              onChange={(value) => update({ platform: value })}
              options={[
                ['', messages.explore.allPlatforms],
                ...(platforms.data ?? []).map((p): [string, string] => [p.slug, p.name]),
              ]}
            />
            <FilterSelect
              label={messages.explore.genre}
              value={genre ?? ''}
              onChange={(value) => update({ genre: value })}
              options={[
                ['', messages.explore.allGenres],
                ...(genres.data ?? [])
                  .map((g): [string, string] => [g.slug, genreName(g)])
                  .sort((a, b) => a[1].localeCompare(b[1])),
              ]}
            />
          </Stack>
        </Stack>
      </Box>

      <Box component="section" aria-labelledby="releases-range">
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}
        >
          <IconButton
            aria-label={t.previous}
            onClick={() => move(-1)}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Stack sx={{ alignItems: 'center', minWidth: 0 }}>
            <Typography
              id="releases-range"
              component="h2"
              variant="h5"
              aria-live="polite"
              sx={{ fontWeight: 800, textAlign: 'center' }}
            >
              {t.range(formatDay(from), formatDay(to))}
            </Typography>
            {offset !== 0 || month ? (
              <Button size="small" onClick={() => update({ offset: null, month: null })}>
                {t.today}
              </Button>
            ) : null}
          </Stack>
          <IconButton
            aria-label={t.next}
            onClick={() => move(1)}
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>
        {releases.isFetching && !releases.isPending ? (
          <LinearProgress sx={{ mb: 2, borderRadius: 1 }} aria-label={messages.app.loading} />
        ) : null}
        {content}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 3 }}>
          {t.source}
        </Typography>
      </Box>

      <Box component="section" aria-labelledby="releases-undated">
        <SectionHeading
          id="releases-undated"
          eyebrow={t.undated.eyebrow}
          title={t.undated.title}
          subtitle={t.undated.subtitle}
        />
        <Box sx={{ mt: 2.5 }}>
          {undated.isPending ? (
            <Skeleton variant="rounded" height={220} />
          ) : undated.isError || !undated.data.catalogAvailable ? (
            <StatePanel body={messages.explore.catalogUnavailable} />
          ) : undatedGames.length === 0 ? (
            <StatePanel body={t.undated.empty} />
          ) : (
            <Box component="ul" sx={{ ...POSTER_GRID_SX, listStyle: 'none', m: 0, p: 0 }}>
              {undatedGames.map((game) => (
                <Box component="li" key={game.externalId} sx={{ minWidth: 0 }}>
                  <CatalogCard game={game} />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Stack>
  );
}
