import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import { useEffect, useState } from 'react';
import { messages } from '../../i18n/messages';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import type { LibraryFilters } from './types';

interface LibrarySearchProps {
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
}

/**
 * Large search field of the library; the text reaches the URL after a short pause.
 * Re-mount it (with a new key) to empty the field, e.g. when filters are cleared.
 */
export function LibrarySearch({ filters, onChange }: LibrarySearchProps) {
  const [search, setSearch] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    if ((debouncedSearch.trim() || undefined) !== filters.search) {
      onChange({ ...filters, search: debouncedSearch.trim() || undefined });
    }
    // Only react to the debounced text, not to other filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  return (
    <TextField
      type="search"
      fullWidth
      placeholder={messages.library.filters.search}
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      slotProps={{
        htmlInput: { 'aria-label': messages.library.filters.search },
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="primary" />
            </InputAdornment>
          ),
          sx: (theme) => ({
            borderRadius: 99,
            height: 52,
            fontSize: '1.05rem',
            // Border, hover and focus come from the theme; this one is just bigger.
            bgcolor: alpha(theme.palette.background.default, 0.6),
            backdropFilter: 'blur(10px)',
          }),
        },
      }}
    />
  );
}
