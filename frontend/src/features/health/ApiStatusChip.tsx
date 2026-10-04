import Chip from '@mui/material/Chip';
import { messages } from '../../i18n/messages';
import { useApiHealth } from './useApiHealth';

const t = messages.apiStatus;

export function ApiStatusChip() {
  const { isPending, isError } = useApiHealth();

  if (isPending) {
    return <Chip size="small" variant="outlined" label={t.checking} />;
  }
  if (isError) {
    return <Chip size="small" color="error" variant="outlined" label={t.down} />;
  }
  return <Chip size="small" color="success" variant="outlined" label={t.up} />;
}
