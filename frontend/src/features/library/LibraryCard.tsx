import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatMinutes } from '../../lib/format';
import { GameCover } from './GameCover';
import { RatingBadge } from './RatingBadge';
import { StatusChip } from './StatusChip';
import type { UserGameListItem } from './types';

/** Visual card of a library game: cover, name, platform, status, hours, rating, platinum. */
export function LibraryCard({ item }: { item: UserGameListItem }) {
  return (
    <Card
      variant="outlined"
      component="article"
      aria-label={item.game.name}
      sx={{ height: '100%' }}
    >
      <CardActionArea
        component={RouterLink}
        to={`/games/${item.id}`}
        aria-label={messages.library.openGame(`${item.game.name} (${item.platform.shortName})`)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <Box sx={{ position: 'relative' }}>
          <GameCover src={item.game.coverUrl} name={item.game.name} square />
          {item.platinumAchieved ? (
            <Box
              role="img"
              aria-label={messages.library.platinumBadge}
              title={messages.library.platinumBadge}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'secondary.main',
                color: 'secondary.contrastText',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 2,
              }}
            >
              <EmojiEventsIcon fontSize="small" />
            </Box>
          ) : null}
        </Box>
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle2" component="h2" noWrap title={item.game.name}>
            {item.game.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {item.platform.shortName}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}
          >
            <StatusChip status={item.status} />
            <Typography variant="caption" color="text.secondary">
              {formatMinutes(item.totalMinutes)}
            </Typography>
          </Stack>
          <Box sx={{ mt: 1 }}>
            <RatingBadge rating={item.rating} size="small" />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
