import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';
import { Section } from '../../../components/Section';
import { messages } from '../../../i18n/messages';
import { formatDate, formatMinutes } from '../../../lib/format';
import { RatingBadge } from '../../library/RatingBadge';
import { StatusChip } from '../../library/StatusChip';
import type { UserGameDetails } from '../../library/types';

const t = messages.detail.myGame;

/** Label/value pairs as an accessible description list. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <Box
      component="dl"
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
        },
        gap: 2,
        m: 0,
      }}
    >
      {items.map(([label, value]) => (
        <Box key={label}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" sx={{ m: 0 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Personal summary: derived status, dates and time (never edited directly). */
export function MyGameSection({ userGame }: { userGame: UserGameDetails }) {
  const { game } = userGame;
  const items: [string, ReactNode][] = [
    [t.platform, userGame.platform.name],
    [t.status, <StatusChip key="status" status={userGame.status} />],
    [t.rating, <RatingBadge key="rating" rating={userGame.rating} size="small" />],
    [t.startDate, formatDate(userGame.startDate)],
    [t.completionDate, formatDate(userGame.completionDate)],
    [t.totalTime, formatMinutes(userGame.totalMinutes)],
  ];
  if (!game.isManual) {
    items.push(
      [t.releaseDate, formatDate(game.releaseDate)],
      [t.developers, game.developers.join(', ') || messages.common.notSet],
      [t.publishers, game.publishers.join(', ') || messages.common.notSet],
    );
  }

  return (
    <Section id="mi-juego" title={messages.detail.sections.myGame}>
      <Facts items={items} />
    </Section>
  );
}
