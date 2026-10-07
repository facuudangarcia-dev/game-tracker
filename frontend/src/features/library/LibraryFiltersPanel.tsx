import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import { alpha, type Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { genreName } from '../../i18n/genres';
import { messages } from '../../i18n/messages';
import { statusColor } from '../../theme/brand';
import {
  defaultOrder,
  DEFAULT_SORT,
  hasActiveFilters,
  SORT_FIELDS,
  STATUSES,
} from './libraryFilters';
import { useGenres, usePlatforms } from './queries';
import type { LibraryFilters, LibrarySortField, PlayStatus } from './types';

const t = messages.library.filters;

function Group({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <Box>
      <Typography
        id={id}
        variant="overline"
        sx={{
          display: 'block',
          color: 'text.secondary',
          fontWeight: 700,
          letterSpacing: 1.2,
          mb: 0.75,
        }}
      >
        {label}
      </Typography>
      {children}
    </Box>
  );
}

interface OptionProps {
  checked: boolean;
  onSelect: () => void;
  label: string;
  /** Leading marker (status dot, trophy...). */
  marker?: ReactNode;
}

/** One choice of a single-select group, styled as a list row (role="radio"). */
function Option({ checked, onSelect, label, marker }: OptionProps) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      sx={(theme) => ({
        width: '100%',
        justifyContent: 'flex-start',
        gap: 1.25,
        px: 1.25,
        py: 0.9,
        borderRadius: 2,
        typography: 'body2',
        color: checked ? 'text.primary' : 'text.secondary',
        fontWeight: checked ? 700 : 400,
        bgcolor: checked ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
        boxShadow: checked ? `inset 3px 0 0 ${theme.palette.primary.main}` : 'none',
        transition: 'background-color .15s ease, color .15s ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, checked ? 0.18 : 0.07) },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}` },
      })}
    >
      {marker}
      {label}
    </ButtonBase>
  );
}

function Dot({ color }: { color: (theme: Theme) => string }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 9,
        height: 9,
        borderRadius: '50%',
        flexShrink: 0,
        bgcolor: color(theme),
        boxShadow: `0 0 8px ${alpha(color(theme), 0.7)}`,
      })}
    />
  );
}

interface LibraryFiltersPanelProps {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  onClear: () => void;
}

/** Side column of the library: status, platinum, platform, genre and sort. */
export function LibraryFiltersPanel({ filters, onChange, onClear }: LibraryFiltersPanelProps) {
  const platforms = usePlatforms();
  const genres = useGenres();
  const sort = filters.sort ?? DEFAULT_SORT;
  const order = filters.order ?? defaultOrder(sort);
  const set = (changes: LibraryFilters) => onChange({ ...filters, ...changes });

  const statusOptions: [PlayStatus | undefined, string][] = [
    [undefined, t.all],
    ...STATUSES.map((s): [PlayStatus, string] => [s, messages.status[s]]),
  ];
  const platinumOptions: [LibraryFilters['platinum'], string][] = [
    [undefined, t.all],
    ['true', t.withPlatinum],
    ['false', t.withoutPlatinum],
  ];

  const select = (
    label: string,
    value: string | undefined,
    onSelect: (v: string) => void,
    options: [string, string][],
    allLabel: string,
  ) => (
    <TextField
      select
      fullWidth
      size="small"
      value={value ?? ''}
      onChange={(e) => onSelect(e.target.value)}
      slotProps={{ select: { native: true }, htmlInput: { 'aria-label': label } }}
    >
      <option value="">{allLabel}</option>
      {options.map(([optionValue, optionLabel]) => (
        <option key={optionValue} value={optionValue}>
          {optionLabel}
        </option>
      ))}
    </TextField>
  );

  return (
    <Stack
      component="form"
      role="search"
      aria-label={t.label}
      spacing={3}
      onSubmit={(e) => e.preventDefault()}
    >
      <Group label={t.status} id="filter-status">
        <Stack role="radiogroup" aria-labelledby="filter-status" spacing={0.25}>
          {statusOptions.map(([status, label]) => (
            <Option
              key={label}
              label={label}
              checked={filters.status === status}
              onSelect={() => set({ status })}
              marker={
                status ? (
                  <Dot color={(theme) => statusColor(theme, status)} />
                ) : (
                  <Dot color={(theme) => theme.palette.primary.main} />
                )
              }
            />
          ))}
        </Stack>
      </Group>

      <Group label={t.platinum} id="filter-platinum">
        <Stack role="radiogroup" aria-labelledby="filter-platinum" spacing={0.25}>
          {platinumOptions.map(([value, label]) => (
            <Option
              key={label}
              label={label}
              checked={filters.platinum === value}
              onSelect={() => set({ platinum: value })}
              marker={
                <EmojiEventsIcon
                  aria-hidden
                  sx={{
                    fontSize: 16,
                    color: value === 'false' ? 'text.disabled' : 'secondary.main',
                    opacity: value === undefined ? 0.5 : 1,
                  }}
                />
              }
            />
          ))}
        </Stack>
      </Group>

      <Group label={t.platform} id="filter-platform">
        {select(
          t.platform,
          filters.platformId,
          (v) => set({ platformId: v || undefined }),
          (platforms.data ?? []).map((p) => [p.id, p.name]),
          t.allFeminine,
        )}
      </Group>

      <Group label={t.genre} id="filter-genre">
        {select(
          t.genre,
          filters.genreId,
          (v) => set({ genreId: v || undefined }),
          (genres.data ?? []).map((g) => [g.id, genreName(g)]),
          t.all,
        )}
      </Group>

      <Group label={t.sort} id="filter-sort">
        <Stack spacing={1}>
          <TextField
            select
            fullWidth
            size="small"
            value={sort}
            onChange={(e) => {
              const next = e.target.value as LibrarySortField;
              set({ sort: next, order: defaultOrder(next) });
            }}
            slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t.sort } }}
          >
            {SORT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {messages.library.sortFields[field]}
              </option>
            ))}
          </TextField>
          <Button
            size="small"
            color="inherit"
            aria-label={t.toggleOrder(order === 'asc' ? t.ascending : t.descending)}
            startIcon={order === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
            onClick={() => set({ sort, order: order === 'asc' ? 'desc' : 'asc' })}
            sx={{ justifyContent: 'flex-start', color: 'text.secondary', px: 1.25 }}
          >
            {order === 'asc' ? t.ascending : t.descending}
          </Button>
        </Stack>
      </Group>

      {hasActiveFilters(filters) ? (
        <Button variant="outlined" onClick={onClear}>
          {t.clear}
        </Button>
      ) : null}
    </Stack>
  );
}
