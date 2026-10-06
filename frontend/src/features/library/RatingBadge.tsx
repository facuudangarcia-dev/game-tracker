import StarIcon from '@mui/icons-material/Star';
import Chip from '@mui/material/Chip';
import { messages } from '../../i18n/messages';

/** Personal rating (10-100), prominent; "Sin valorar" when null. */
export function RatingBadge({
  rating,
  size = 'medium',
}: {
  rating: number | null;
  size?: 'small' | 'medium';
}) {
  if (rating === null) {
    return <Chip size={size} variant="outlined" label={messages.detail.noRating} />;
  }
  return (
    <Chip
      size={size}
      color="warning"
      icon={<StarIcon />}
      label={messages.detail.ratingValue(rating)}
      sx={{ fontWeight: 700 }}
    />
  );
}
