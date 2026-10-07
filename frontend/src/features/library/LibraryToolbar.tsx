import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import SearchIcon from '@mui/icons-material/Search';
import { useEffect, useState } from 'react';
import { messages } from '../../i18n/messages';
import { genreName } from '../../i18n/genres';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import {
  defaultOrder,
  DEFAULT_SORT,
  hasActiveFilters,
  SORT_FIELDS,
  STATUSES,
} from './libraryFilters';
import { useGenres, usePlatforms } from './queries';
import type { LibraryFilters, LibrarySortField } from './types';

const t = messages.library.filters;

interface LibraryToolbarProps {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
}

/** Search, filters (status, platform, platinum, genre) and sort of the library. */
export function LibraryToolbar({ filters, onChange }: LibraryToolbarProps) {
  const platforms = usePlatforms();
  const genres = useGenres();
  const [search, setSearch] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if ((debouncedSearch.trim() || undefined) !== filters.search) {
      onChange({ ...filters, search: debouncedSearch.trim() || undefined });
    }
    // Only react to the debounced text, not to other filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const sort = filters.sort ?? DEFAULT_SORT;
  const order = filters.order ?? defaultOrder(sort);
  const set = (changes: LibraryFilters) => onChange({ ...filters, ...changes });
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
      label={label}
      value={value ?? ''}
      onChange={(e) => onSelect(e.target.value)}
      slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
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
      spacing={2}
      onSubmit={(e) => e.preventDefault()}
    >
      <TextField
        type="search"
        size="small"
        label={t.search}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />
      <Grid container spacing={1.5} sx={{ alignItems: 'center' }}>
        <Grid size={{ xs: 6, md: 2.4 }}>
          {select(
            t.status,
            filters.status,
            (v) => set({ status: (v || undefined) as LibraryFilters['status'] }),
            STATUSES.map((s) => [s, messages.status[s]]),
            t.all,
          )}
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          {select(
            t.platform,
            filters.platformId,
            (v) => set({ platformId: v || undefined }),
            (platforms.data ?? []).map((p) => [p.id, p.name]),
            t.allFeminine,
          )}
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          {select(
            t.platinum,
            filters.platinum,
            (v) => set({ platinum: (v || undefined) as LibraryFilters['platinum'] }),
            [
              ['true', t.withPlatinum],
              ['false', t.withoutPlatinum],
            ],
            t.all,
          )}
        </Grid>
        <Grid size={{ xs: 6, md: 2.4 }}>
          {select(
            t.genre,
            filters.genreId,
            (v) => set({ genreId: v || undefined }),
            (genres.data ?? []).map((g) => [g.id, genreName(g)]),
            t.all,
          )}
        </Grid>
        <Grid size={{ xs: 12, md: 2.4 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <TextField
              select
              fullWidth
              size="small"
              label={t.sort}
              value={sort}
              onChange={(e) => {
                const next = e.target.value as LibrarySortField;
                set({ sort: next, order: defaultOrder(next) });
              }}
              slotProps={{ select: { native: true } }}
            >
              {SORT_FIELDS.map((field) => (
                <option key={field} value={field}>
                  {messages.library.sortFields[field]}
                </option>
              ))}
            </TextField>
            <Tooltip title={order === 'asc' ? t.ascending : t.descending}>
              <IconButton
                aria-label={t.toggleOrder(order === 'asc' ? t.ascending : t.descending)}
                onClick={() => set({ sort, order: order === 'asc' ? 'desc' : 'asc' })}
              >
                {order === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Grid>
      </Grid>
      {hasActiveFilters(filters) ? (
        <Button
          size="small"
          sx={{ alignSelf: 'flex-start' }}
          onClick={() => {
            setSearch('');
            onChange({ sort: filters.sort, order: filters.order });
          }}
        >
          {t.clear}
        </Button>
      ) : null}
    </Stack>
  );
}
