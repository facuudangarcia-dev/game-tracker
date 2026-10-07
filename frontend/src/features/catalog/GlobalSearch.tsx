import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import Paper, { type PaperProps } from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createContext, useContext, useState } from 'react';
import { useNavigate } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { GameCover } from '../library/GameCover';
import { SEARCH_MIN_LENGTH } from '../library/queries';
import type { CatalogSearchResult } from '../library/types';
import { catalogGamePath, useGlobalCatalogSearch } from './queries';

const t = messages.globalSearch;
export const GLOBAL_SEARCH_INPUT_ID = 'global-search';
const MAX_PLATFORMS_SHOWN = 4;

/** Warning shown above the results (catalog unavailable), if any. */
const ResultsWarningContext = createContext<string | null>(null);

function ResultsPaper(props: PaperProps) {
  const warning = useContext(ResultsWarningContext);
  return (
    <Paper {...props}>
      {warning ? (
        <Alert severity="warning" variant="outlined" sx={{ m: 1 }}>
          {warning}
        </Alert>
      ) : null}
      {props.children}
    </Paper>
  );
}

function platformsLabel(result: CatalogSearchResult): string {
  const names = result.platforms.map((p) => p.shortName);
  return names.length > MAX_PLATFORMS_SHOWN
    ? `${names.slice(0, MAX_PLATFORMS_SHOWN).join(' · ')} · +${names.length - MAX_PLATFORMS_SHOWN}`
    : names.join(' · ');
}

/**
 * Header search over the game catalog (not the personal library). Selecting a
 * result opens the game's public catalog page.
 */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input, 300);
  const search = useGlobalCatalogSearch(query);

  const noOptionsText = !search.enabled
    ? t.hint(SEARCH_MIN_LENGTH)
    : search.isError
      ? t.error
      : !search.catalogAvailable
        ? t.catalogUnavailable
        : t.noResults;

  // Only local results are shown when the external catalog is unavailable.
  const warning =
    search.enabled && !search.catalogAvailable && search.results.length > 0
      ? t.catalogUnavailable
      : null;

  return (
    <ResultsWarningContext.Provider value={warning}>
      <Autocomplete<CatalogSearchResult>
        id={GLOBAL_SEARCH_INPUT_ID}
        size="small"
        fullWidth
        value={null}
        inputValue={input}
        onInputChange={(_event, value, reason) => {
          if (reason !== 'reset') {
            setInput(value);
          }
        }}
        options={search.enabled ? search.results : []}
        // Results are already filtered by the server.
        filterOptions={(options) => options}
        getOptionLabel={(option) => option.name}
        getOptionKey={(option) => `${option.provider}:${option.externalId}`}
        isOptionEqualToValue={(a, b) => a.externalId === b.externalId && a.provider === b.provider}
        loading={search.enabled && search.isFetching}
        loadingText={t.loading}
        noOptionsText={noOptionsText}
        onChange={(_event, option) => {
          if (option?.provider && option.externalId) {
            setInput('');
            void navigate(catalogGamePath(option.provider, option.externalId));
          }
        }}
        blurOnSelect
        slots={{ paper: ResultsPaper }}
        renderOption={({ key, ...props }, option) => {
          const year = formatYear(option.releaseDate);
          const platforms = platformsLabel(option);
          return (
            <Box component="li" key={key} {...props} sx={{ gap: 1.5 }}>
              <GameCover src={option.coverUrl} name={option.name} width={32} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {option.name}
                  {year ? (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {` (${year})`}
                    </Typography>
                  ) : null}
                </Typography>
                {platforms ? (
                  <Typography variant="caption" color="text.secondary" noWrap component="p">
                    {platforms}
                  </Typography>
                ) : null}
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={t.placeholder}
            slotProps={{
              ...params.slotProps,
              htmlInput: { ...params.slotProps.htmlInput, 'aria-label': t.label },
              input: {
                ...params.slotProps.input,
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        )}
      />
    </ResultsWarningContext.Provider>
  );
}
