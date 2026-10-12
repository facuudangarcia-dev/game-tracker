import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useLocale } from '../../i18n/locale';
import { messages } from '../../i18n/messages';
import { countryOptions } from './countries';
import { FilterSelect } from './ExploreLayout';
import { useChangePriceCountry, usePriceCountry } from './priceCountry';

/**
 * Country whose prices are shown (decision #68). `shown` is the country of the
 * prices on screen, for when the user hasn't chosen one (the backend's default).
 */
export function PriceCountrySelect({ shown, minWidth }: { shown?: string; minWidth?: number }) {
  // Re-renders when the language changes: country names are in that language.
  useLocale();
  const country = usePriceCountry() ?? shown ?? '';
  const { change, failed } = useChangePriceCountry();
  const options = countryOptions();

  return (
    <Stack spacing={0.5}>
      <FilterSelect
        label={messages.deals.countryLabel}
        value={country}
        onChange={(value) => {
          if (value) {
            change(value);
          }
        }}
        options={country ? options : [['', messages.deals.countryNone], ...options]}
        minWidth={minWidth}
      />
      {failed ? (
        <Typography variant="caption" color="error" role="alert">
          {messages.deals.countrySaveError}
        </Typography>
      ) : null}
    </Stack>
  );
}
