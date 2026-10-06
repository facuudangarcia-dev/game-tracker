import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatMinutes } from '../../lib/format';
import { GameCover } from './GameCover';
import { StatusChip } from './StatusChip';
import type { UserGameListItem } from './types';

export function LibraryCard({ item }: { item: UserGameListItem }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea
        component={RouterLink}
        to={`/games/${item.id}`}
        aria-label={messages.library.openGame(item.game.name)}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
        }}
      >
        <GameCover src={item.game.coverUrl} name={item.game.name} square />
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="subtitle2" component="h2" noWrap title={item.game.name}>
            {item.game.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" component="p">
            {item.platform.shortName}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatusChip status={item.status} />
            <Typography variant="caption" color="text.secondary">
              {formatMinutes(item.totalMinutes)}
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
