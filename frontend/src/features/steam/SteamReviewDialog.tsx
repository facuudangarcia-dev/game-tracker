import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { formatMinutes } from '../../lib/format';
import { type SteamPendingGame, useConfirmSteamGames, usePendingSteamGames } from './api';

const t = messages.library.steam.review;

function Cover({ game }: { game: SteamPendingGame }) {
  const [failed, setFailed] = useState(false);
  const box = { width: 44, height: 59, flexShrink: 0, borderRadius: 1 };
  if (!game.coverUrl || failed) {
    return (
      <Box
        aria-hidden
        sx={{ ...box, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}
      >
        <SportsEsportsIcon fontSize="small" color="disabled" />
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={game.coverUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      sx={{ ...box, objectFit: 'cover' }}
    />
  );
}

/**
 * The Steam games a sync found (decision #80): every one starts selected and
 * the user unchecks the ones not to add. The ones left out become removed
 * games, restorable from the Steam panel.
 */
export function SteamReviewDialog({ onClose }: { onClose: () => void }) {
  const pending = usePendingSteamGames(true);
  const confirm = useConfirmSteamGames();
  // Every game starts selected: the user unchecks the ones not to add.
  const [unselected, setUnselected] = useState<ReadonlySet<number>>(new Set());
  const games = pending.data ?? [];
  const selected = games.filter((game) => !unselected.has(game.appId));
  const toggle = (appId: number) =>
    setUnselected((current) => {
      const next = new Set(current);
      if (!next.delete(appId)) {
        next.add(appId);
      }
      return next;
    });
  const error = pending.isError
    ? getApiErrorMessage(pending.error)
    : confirm.isError
      ? getApiErrorMessage(confirm.error, t.errors)
      : null;

  return (
    <FormDialog
      open
      title={t.title}
      icon={<SportsEsportsIcon />}
      submitLabel={selected.length ? t.add(selected.length) : t.addNone}
      pending={!pending.data || confirm.isPending}
      error={error}
      onSubmit={() =>
        confirm.mutate(
          selected.map((game) => game.appId),
          { onSuccess: onClose },
        )
      }
      onClose={onClose}
    >
      {!pending.data ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}>
          <CircularProgress aria-label={t.loading} />
        </Box>
      ) : (
        <>
          <Typography color="text.secondary">{t.intro(games.length)}</Typography>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t.selected(selected.length, games.length)}
            </Typography>
            <Button
              size="small"
              onClick={() =>
                setUnselected(
                  unselected.size === 0 ? new Set(games.map((game) => game.appId)) : new Set(),
                )
              }
            >
              {unselected.size === 0 ? t.selectNone : t.selectAll}
            </Button>
          </Stack>
          <Box
            component="ul"
            aria-label={t.listLabel}
            sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: { sm: 420 }, overflowY: 'auto' }}
          >
            {games.map((game) => (
              <Box
                component="li"
                key={game.appId}
                sx={(theme) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1,
                  borderTop: `1px solid ${theme.palette.divider}`,
                })}
              >
                <Checkbox
                  checked={!unselected.has(game.appId)}
                  onChange={() => toggle(game.appId)}
                  slotProps={{ input: { 'aria-label': game.name } }}
                  sx={{ ml: -1 }}
                />
                <Cover game={game} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {game.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatMinutes(game.minutes)}
                  </Typography>
                  {game.inLibrary ? (
                    <Typography variant="caption" color="info.main" component="p">
                      {t.inLibrary}
                    </Typography>
                  ) : null}
                  {game.manual ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="p"
                      sx={{ fontStyle: 'italic' }}
                    >
                      {t.manual}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t.leftOut}
          </Typography>
        </>
      )}
    </FormDialog>
  );
}
