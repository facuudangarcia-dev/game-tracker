import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { type ProfileVisibility, useSetVisibility } from './api';

const OPTIONS: ProfileVisibility[] = ['FRIENDS', 'PRIVATE'];

/** Who sees the user's profile and activity (decision #84): friends or nobody. */
export function VisibilitySetting({ value }: { value: ProfileVisibility }) {
  const t = messages.social.visibility;
  const set = useSetVisibility();
  return (
    <Stack spacing={0.75} sx={{ alignItems: 'flex-start' }}>
      <TextField
        select
        label={t.label}
        value={value}
        onChange={(e) => set.mutate(e.target.value as ProfileVisibility)}
        disabled={set.isPending}
        sx={{ minWidth: 240 }}
      >
        {OPTIONS.map((option) => (
          <MenuItem key={option} value={option}>
            {t.options[option]}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="caption" color={set.isError ? 'error' : 'text.secondary'}>
        {set.isError ? getApiErrorMessage(set.error) : t.help}
      </Typography>
    </Stack>
  );
}
