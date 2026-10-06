import TextField from '@mui/material/TextField';
import { NOTE_MAX_LENGTH, noteError } from '../features/library/validation';
import { messages } from '../i18n/messages';

interface NoteFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** Plain-text note (no Markdown) with a character counter, max 5000. */
export function NoteField({ label, value, onChange }: NoteFieldProps) {
  const error = noteError(value);
  return (
    <TextField
      label={label}
      multiline
      minRows={3}
      maxRows={12}
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={Boolean(error)}
      helperText={error ?? messages.common.charCount(value.length, NOTE_MAX_LENGTH)}
    />
  );
}
