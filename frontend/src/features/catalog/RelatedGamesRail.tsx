import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { posterLinkSx } from '../../theme/brand';
import { Rail } from '../home/GameRail';
import { GameCover } from '../library/GameCover';
import type { RelatedGame } from '../library/types';
import { catalogGamePath } from './queries';

const t = messages.catalog.related;

/** Similar games as a poster rail; each opens its own catalog page. */
export function RelatedGamesRail({ games }: { games: RelatedGame[] }) {
  return (
    <Rail
      id="catalog-related"
      eyebrow={t.eyebrow}
      title={t.title}
      subtitle={t.subtitle}
      columns={{ xs: 2.3, sm: 3.5, md: 6 }}
      loading={false}
      skeletonRatio="3 / 4"
    >
      {games.map((game) => (
        <Box component="li" key={game.externalId} sx={{ scrollSnapAlign: 'start', minWidth: 0 }}>
          <Box
            component={RouterLink}
            to={catalogGamePath(game.provider, game.externalId)}
            sx={(theme) => ({
              ...posterLinkSx,
              '&:hover .card-media, &:focus-visible .card-media': {
                transform: 'translateY(-6px)',
                boxShadow: `0 18px 40px -18px ${alpha(theme.palette.primary.main, 0.8)}, 0 0 0 1px ${alpha(theme.palette.primary.main, 0.6)}`,
              },
            })}
          >
            <Box className="card-media">
              <GameCover src={game.coverUrl} name={game.name} square />
            </Box>
            <Typography variant="subtitle2" noWrap sx={{ mt: 1.25, fontWeight: 700 }}>
              {game.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {formatYear(game.releaseDate) ?? messages.common.notSet}
            </Typography>
          </Box>
        </Box>
      ))}
    </Rail>
  );
}
