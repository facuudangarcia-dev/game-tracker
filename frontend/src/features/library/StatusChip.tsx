import Chip, { type ChipProps } from '@mui/material/Chip';
import { messages } from '../../i18n/messages';
import type { PlayStatus } from './types';

const STATUS_COLORS: Record<PlayStatus, ChipProps['color']> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
};

export function StatusChip({
  status,
  size = 'small',
}: {
  status: PlayStatus;
  size?: ChipProps['size'];
}) {
  return <Chip size={size} color={STATUS_COLORS[status]} label={messages.status[status]} />;
}
