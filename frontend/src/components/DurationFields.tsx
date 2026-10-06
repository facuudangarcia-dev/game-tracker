import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { messages } from '../i18n/messages';
import type { DurationValue } from './duration';

interface DurationFieldsProps {
  label: string;
  value: DurationValue;
  onChange: (value: DurationValue) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
}

/** Hours + minutes inputs; the value is always stored as integer minutes. */
export function DurationFields({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled,
}: DurationFieldsProps) {
  const t = messages.detail.time;
  return (
    <Stack component="fieldset" spacing={1} sx={{ border: 0, p: 0, m: 0 }} disabled={disabled}>
      <Typography component="legend" variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Stack direction="row" spacing={2}>
        <TextField
          label={t.hours}
          type="number"
          value={value.hours}
          onChange={(e) => onChange({ ...value, hours: e.target.value })}
          error={Boolean(error)}
          disabled={disabled}
          slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
          sx={{ flex: 1 }}
        />
        <TextField
          label={t.minutes}
          type="number"
          value={value.minutes}
          onChange={(e) => onChange({ ...value, minutes: e.target.value })}
          error={Boolean(error)}
          disabled={disabled}
          slotProps={{ htmlInput: { min: 0, max: 59, step: 1, inputMode: 'numeric' } }}
          sx={{ flex: 1 }}
        />
      </Stack>
      {error || helperText ? (
        <FormHelperText error={Boolean(error)}>{error ?? helperText}</FormHelperText>
      ) : null}
    </Stack>
  );
}
