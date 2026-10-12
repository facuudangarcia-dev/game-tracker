import Chip, { type ChipProps } from '@mui/material/Chip';
import { messages } from '../../i18n/messages';
import { VIOLET } from '../../theme/brand';
import type { PlayStatus } from './types';

const STATUS_COLORS: Record<PlayStatus, ChipProps['color']> = {
  PENDING: 'default',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  // No palette color of its own: painted with the brand violet below.
  PLAYED: 'default',
};

export function StatusChip({
  status,
  size = 'small',
}: {
  status: PlayStatus;
  size?: ChipProps['size'];
}) {
  return (
    <Chip
      size={size}
      color={STATUS_COLORS[status]}
      label={messages.status[status]}
      sx={status === 'PLAYED' ? { bgcolor: VIOLET, color: '#1a1029' } : undefined}
    />
  );
}
