import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { messages } from '../../i18n/messages';
import { formatYear } from '../../lib/format';
import { glassSx, posterLinkSx } from '../../theme/brand';
import { useCurrentUser } from '../auth/useCurrentUser';
import { catalogGamePath } from '../catalog/queries';
import { platformsLabel } from '../home/homeFormat';
import { AddToLibraryDialog } from '../library/AddToLibraryDialog';
import { GameCover } from '../library/GameCover';
import type { UserGameDetails } from '../library/types';
import type { CatalogCard as CatalogCardData } from './types';
import { useLoginRedirect } from './useLoginRedirect';
import { WishlistButton } from './WishlistButton';

const t = messages.explore;

interface CatalogCardProps {
  game: CatalogCardData;
  /** Second line under the name; defaults to year and platforms. */
  meta?: string;
  /** Overlay at the bottom of the cover (e.g. a release date). */
  badge?: ReactNode;
}

/**
 * Poster of a catalog game: opens its catalog page; shows whether it's already
 * in the user's library; adds it to Mis juegos or the wishlist (decision #64).
 */
export function CatalogCard({ game, meta, badge }: CatalogCardProps) {
  const { data: user } = useCurrentUser();
  const loginRedirect = useLoginRedirect();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<UserGameDetails | null>(null);

  const inLibrary = game.libraryPlatformIds.length > 0;
  const canAdd = game.platforms.some((p) => !game.libraryPlatformIds.includes(p.id));
  const year = formatYear(game.releaseDate);
  const secondLine = meta ?? [year, platformsLabel(game, 2)].filter(Boolean).join(' · ');
  const addHint = !canAdd
    ? game.platforms.length === 0
      ? t.noPlatforms(game.name)
      : t.allAdded(game.name)
    : null;

  return (
    <Box
      component="article"
      aria-label={game.name}
      sx={{
        position: 'relative',
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 40%)',
              pointerEvents: 'none',
            }}
          />
          {inLibrary ? (
            <Stack
              direction="row"
              spacing={0.5}
              sx={(theme) => ({
                ...glassSx(theme, 0.65),
                borderColor: alpha(theme.palette.success.main, 0.5),
                position: 'absolute',
                top: 8,
                left: 8,
                alignItems: 'center',
                px: 0.75,
                py: 0.25,
                borderRadius: 99,
              })}
            >
              <CheckCircleIcon color="success" sx={{ fontSize: 14 }} aria-hidden />
              <Typography variant="caption" sx={{ fontWeight: 800, lineHeight: 1.6 }}>
                {t.inLibrary}
              </Typography>
            </Stack>
          ) : null}
          {badge ? <Box sx={{ position: 'absolute', left: 8, bottom: 8 }}>{badge}</Box> : null}
        </Box>
        <Typography variant="subtitle2" noWrap title={game.name} sx={{ mt: 1.25, fontWeight: 700 }}>
          {game.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="p">
          {secondLine || ' '}
        </Typography>
      </Box>

      {/* Outside the link: buttons can't be nested in an anchor. */}
      <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
        <WishlistButton game={game} wishlistItemId={game.wishlistItemId} variant="card" />
      </Box>
      <Box sx={{ mt: 'auto', pt: 1 }}>
        <Tooltip title={user ? (addHint ?? '') : messages.catalog.loginToAdd}>
          {/* Span: a disabled button still shows its tooltip. */}
          <Box component="span" sx={{ display: 'block' }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={inLibrary && !canAdd ? <CheckCircleIcon /> : <AddIcon />}
              disabled={Boolean(user) && !canAdd}
              aria-label={user && addHint ? addHint : t.addTo(game.name)}
              onClick={() => (user ? setAdding(true) : loginRedirect())}
              sx={{ fontWeight: 700, borderRadius: 99 }}
            >
              {inLibrary && !canAdd ? t.inLibrary : t.add}
            </Button>
          </Box>
        </Tooltip>
      </Box>

      {adding ? (
        <AddToLibraryDialog
          gameName={game.name}
          artworkUrl={game.artworkUrl}
          year={year}
          source={{ catalog: { provider: game.provider, externalId: game.externalId } }}
          platforms={game.platforms}
          takenPlatformIds={game.libraryPlatformIds}
          onClose={() => setAdding(false)}
          onAdded={(userGame) => {
            setAdding(false);
            setAdded(userGame);
            // Cards (and the catalog page) show where the game is now.
            void queryClient.invalidateQueries({ queryKey: ['catalog'] });
            void queryClient.invalidateQueries({ queryKey: ['deals', 'recommended'] });
          }}
        />
      ) : null}
      <Snackbar
        open={added !== null}
        autoHideDuration={6000}
        onClose={() => setAdded(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setAdded(null)}
          action={
            added ? (
              <Button color="inherit" size="small" component={RouterLink} to={`/games/${added.id}`}>
                {t.viewMyGame}
              </Button>
            ) : undefined
          }
        >
          {t.added(game.name)}
        </Alert>
      </Snackbar>
    </Box>
  );
}
