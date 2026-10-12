import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventIcon from '@mui/icons-material/Event';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import StorefrontIcon from '@mui/icons-material/Storefront';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import type { AuthLocationState } from '../features/auth/authLocation';
import { GameSummary } from '../features/catalog/GameSummary';
import { MyGamePanel } from '../features/catalog/MyGamePanel';
import { useCatalogGame } from '../features/catalog/queries';
import { RelatedGamesRail } from '../features/catalog/RelatedGamesRail';
import { ScreenshotGallery } from '../features/catalog/ScreenshotGallery';
import { GamePricePanel } from '../features/explore/GamePricePanel';
import { WishlistButton } from '../features/explore/WishlistButton';
import { AddToLibraryDialog } from '../features/library/AddToLibraryDialog';
import { GameCover } from '../features/library/GameCover';
import type { CatalogGame } from '../features/library/types';
import { genreName } from '../i18n/genres';
import { messages } from '../i18n/messages';
import { ApiError } from '../lib/api/client';
import { getErrorCode } from '../lib/api/errors';
import { formatDate, formatYear } from '../lib/format';
import {
  ambientBackground,
  brandGradient,
  glassSx,
  ink,
  panelSx,
  reducedMotion,
} from '../theme/brand';

const t = messages.catalog;

function Tags({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <>{t.none}</>;
  }
  return (
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.25 }}>
      {items.map((item) => (
        <Box
          key={item}
          component="span"
          sx={(theme) => ({
            px: 1.1,
            py: 0.3,
            borderRadius: 99,
            typography: 'body2',
            fontWeight: 600,
            color: 'text.primary',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          })}
        >
          {item}
        </Box>
      ))}
    </Stack>
  );
}

/** A row of the game sheet: icon, label and value. */
function SheetRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <Box component="div" sx={{ display: 'flex', gap: 1.5, py: 1.5 }}>
      <Box sx={{ color: 'primary.main', pt: 0.25, display: 'flex' }} aria-hidden>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="dt"
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}
        >
          {label}
        </Typography>
        <Typography component="dd" sx={{ m: 0, fontWeight: 600 }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

/** Public page of a catalog game: "this game exists". Adding it is a separate, explicit step. */
export function CatalogGamePage() {
  const { provider = '', externalId = '' } = useParams();
  const query = useCatalogGame(provider, externalId);

  if (query.isPending) {
    return (
      <Stack spacing={3} aria-busy="true" aria-label={messages.app.loading}>
        <Skeleton variant="rounded" sx={{ height: { xs: 420, md: 460 }, borderRadius: 4 }} />
        <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (query.isError) {
    const code = getErrorCode(query.error);
    const notFound = query.error instanceof ApiError && query.error.status === 404;
    return (
      <Alert
        severity={notFound ? 'info' : 'error'}
        variant="outlined"
        action={
          notFound ? undefined : (
            <Button color="inherit" size="small" onClick={() => void query.refetch()}>
              {messages.errors.retry}
            </Button>
          )
        }
      >
        {notFound ? t.notFound : code === 'CATALOG_UNAVAILABLE' ? t.unavailable : t.loadError}
      </Alert>
    );
  }

  return <CatalogGameView game={query.data} />;
}

function CatalogGameView({ game }: { game: CatalogGame }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const [adding, setAdding] = useState(false);
  const [artworkLoaded, setArtworkLoaded] = useState(false);

  const takenPlatformIds = game.libraryEntries.map((entry) => entry.platform.id);
  const canAdd = game.platforms.some((p) => !takenPlatformIds.includes(p.id));
  const year = formatYear(game.releaseDate);
  const genres = game.genres.map(genreName);
  // Without artwork, the cover itself (blurred) becomes the backdrop.
  const backdrop = game.artworkUrl ?? game.coverUrl;

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      {/* Cinematic header: artwork backdrop, poster, title and the main action. */}
      <Box
        component="header"
        aria-labelledby="catalog-game-title"
        sx={(theme) => ({
          position: 'relative',
          isolation: 'isolate',
          overflow: 'hidden',
          borderRadius: { xs: 3, md: 4 },
          border: `1px solid ${alpha(ink(theme), 0.08)}`,
          background: ambientBackground(theme),
          minHeight: { md: 460 },
          display: 'flex',
          alignItems: 'flex-end',
          p: { xs: 2.5, sm: 4, md: 5 },
          pt: { xs: 16, sm: 20, md: 5 },
          boxShadow: `0 30px 80px -40px ${alpha(theme.palette.primary.main, 0.45)}`,
        })}
      >
        {backdrop ? (
          <Box
            component="img"
            src={backdrop}
            alt=""
            aria-hidden
            onLoad={() => setArtworkLoaded(true)}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: -2,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              opacity: artworkLoaded ? 1 : 0,
              transition: 'opacity .8s ease',
              // A cover stretched to a banner only works blurred.
              filter: game.artworkUrl ? 'none' : 'blur(28px) saturate(1.3)',
              transform: game.artworkUrl ? 'none' : 'scale(1.2)',
              [reducedMotion]: { transition: 'none' },
            }}
          />
        ) : null}
        <Box
          aria-hidden
          sx={(theme) => {
            const bg = theme.palette.background.default;
            return {
              position: 'absolute',
              inset: 0,
              zIndex: -1,
              background: {
                xs: `linear-gradient(0deg, ${bg} 35%, ${alpha(bg, 0.6)} 65%, ${alpha(bg, 0.1)} 100%)`,
                md: [
                  `linear-gradient(90deg, ${alpha(bg, 0.95)} 0%, ${alpha(bg, 0.75)} 45%, ${alpha(bg, 0.15)} 80%)`,
                  `linear-gradient(0deg, ${alpha(bg, 0.9)} 0%, transparent 50%)`,
                ].join(', '),
              },
            };
          }}
        />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 2.5, sm: 4 }}
          sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' }, width: '100%' }}
        >
          <Box
            sx={(theme) => ({
              flexShrink: 0,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: `0 30px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px ${alpha(ink(theme), 0.14)}`,
            })}
          >
            <GameCover
              src={game.coverUrl}
              name={game.name}
              width={{ xs: 132, sm: 180, md: 230 }}
              square
            />
          </Box>

          <Stack spacing={1.75} sx={{ minWidth: 0, flex: 1, alignItems: 'flex-start' }}>
            {genres.length > 0 ? (
              <Typography
                variant="overline"
                color="primary"
                sx={{ fontWeight: 800, letterSpacing: 1.8, lineHeight: 1.5 }}
              >
                {[year, ...genres.slice(0, 3)].filter(Boolean).join(' · ')}
              </Typography>
            ) : null}
            <Typography
              id="catalog-game-title"
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 900,
                letterSpacing: { xs: -0.5, md: -1.5 },
                lineHeight: 1.02,
                fontSize: { xs: '2rem', sm: '2.6rem', md: '3.4rem' },
                overflowWrap: 'anywhere',
                textWrap: 'balance',
              }}
            >
              {game.name}
              {year ? (
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.5em',
                    fontWeight: 500,
                    color: 'text.secondary',
                    letterSpacing: 0,
                  }}
                >
                  {` (${year})`}
                </Typography>
              ) : null}
            </Typography>
            {game.developers.length > 0 ? (
              <Typography color="text.secondary" sx={{ fontWeight: 500 }}>
                {t.by(game.developers.join(', '))}
              </Typography>
            ) : null}
            {game.platforms.length > 0 ? (
              <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                {game.platforms.map((platform) => (
                  <Box
                    key={platform.id}
                    component="span"
                    sx={(theme) => ({
                      ...glassSx(theme, 0.5),
                      px: 1,
                      py: 0.2,
                      borderRadius: 1,
                      typography: 'caption',
                      fontWeight: 700,
                    })}
                  >
                    {platform.shortName}
                  </Box>
                ))}
              </Stack>
            ) : null}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              useFlexGap
              sx={{
                pt: 1,
                alignItems: { xs: 'stretch', sm: 'center' },
                width: { xs: '100%', sm: 'auto' },
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                disabled={Boolean(user) && !canAdd}
                // Anonymous visitors log in first and come back to this page.
                onClick={() =>
                  user
                    ? setAdding(true)
                    : void navigate('/login', {
                        state: {
                          from: { pathname: location.pathname, search: location.search },
                        } satisfies AuthLocationState,
                      })
                }
                sx={(theme) => ({
                  px: 3.5,
                  fontWeight: 800,
                  color: theme.palette.common.white,
                  background: brandGradient(theme, 110),
                  boxShadow: `0 14px 30px -12px ${alpha(theme.palette.primary.main, 0.9)}`,
                  '&:hover': { background: brandGradient(theme, 110), filter: 'brightness(1.08)' },
                  '&.Mui-disabled': { background: alpha(ink(theme), 0.08) },
                })}
              >
                {t.addGame}
              </Button>
              <WishlistButton game={game} wishlistItemId={game.wishlistItemId} variant="header" />
              {!user ? (
                <Typography variant="body2" color="text.secondary">
                  {t.loginToAdd}
                </Typography>
              ) : game.platforms.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t.noPlatforms}
                </Typography>
              ) : !canAdd ? (
                <Typography variant="body2" color="text.secondary">
                  {t.allPlatformsAdded}
                </Typography>
              ) : null}
            </Stack>

            {game.libraryEntries.length > 0 ? (
              <Stack
                direction="row"
                spacing={0.75}
                sx={(theme) => ({
                  ...glassSx(theme, 0.6),
                  borderColor: alpha(theme.palette.success.main, 0.45),
                  alignItems: 'center',
                  borderRadius: 99,
                  px: 1.5,
                  py: 0.5,
                })}
              >
                <CheckCircleIcon color="success" sx={{ fontSize: 18 }} aria-hidden />
                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                  {t.inLibrary}
                </Typography>
              </Stack>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      {/* Body: summary, your game and screenshots on the left; the game sheet on the side. */}
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 3, md: 4 },
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={{ xs: 3, md: 4 }} sx={{ minWidth: 0 }}>
          <GameSummary summary={game.summary} />
          {game.libraryEntries.length > 0 ? <MyGamePanel entries={game.libraryEntries} /> : null}
          {game.screenshots.length > 0 ? (
            <ScreenshotGallery name={game.name} screenshots={game.screenshots} />
          ) : null}
        </Stack>

        <Stack spacing={{ xs: 3, md: 4 }} sx={{ minWidth: 0 }}>
          <Box
            component="section"
            aria-labelledby="catalog-information"
            sx={(theme) => ({
              ...panelSx(theme, theme.palette.secondary.main),
              p: { xs: 2.5, md: 3 },
            })}
          >
            <Typography
              id="catalog-information"
              variant="overline"
              component="h2"
              sx={{ fontWeight: 800, letterSpacing: 1.8, color: 'secondary.main' }}
            >
              {t.information}
            </Typography>
            <Box
              component="dl"
              sx={{ m: 0, '& > div + div': { borderTop: 1, borderColor: 'divider' } }}
            >
              <SheetRow icon={<EventIcon fontSize="small" />} label={t.releaseDate}>
                {formatDate(game.releaseDate)}
              </SheetRow>
              <SheetRow icon={<SportsEsportsIcon fontSize="small" />} label={t.platforms}>
                <Tags items={game.platforms.map((p) => p.name)} />
              </SheetRow>
              <SheetRow icon={<CategoryIcon fontSize="small" />} label={t.genres}>
                <Tags items={genres} />
              </SheetRow>
              <SheetRow icon={<BusinessIcon fontSize="small" />} label={t.developers}>
                {game.developers.join(', ') || t.none}
              </SheetRow>
              <SheetRow icon={<StorefrontIcon fontSize="small" />} label={t.publishers}>
                {game.publishers.join(', ') || t.none}
              </SheetRow>
            </Box>
          </Box>
          <GamePricePanel
            key={`${game.provider}/${game.externalId}`}
            provider={game.provider}
            externalId={game.externalId}
          />
        </Stack>
      </Box>

      {game.relatedGames.length > 0 ? <RelatedGamesRail games={game.relatedGames} /> : null}

      {adding ? (
        <AddToLibraryDialog
          gameName={game.name}
          artworkUrl={game.artworkUrl}
          year={year}
          source={
            game.gameId
              ? { gameId: game.gameId }
              : { catalog: { provider: game.provider, externalId: game.externalId } }
          }
          platforms={game.platforms}
          takenPlatformIds={takenPlatformIds}
          onClose={() => setAdding(false)}
          onAdded={(userGame) => {
            void queryClient.invalidateQueries({ queryKey: ['catalog', 'game'] });
            void navigate(`/games/${userGame.id}`);
          }}
        />
      ) : null}
    </Stack>
  );
}
