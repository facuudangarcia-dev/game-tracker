import LinkOffIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { ApiError } from '../../lib/api/client';
import { getApiErrorMessage } from '../../lib/api/errors';
import { formatDateTime } from '../../lib/dates';
import { panelSx } from '../../theme/brand';
import { SteamReviewDialog } from './SteamReviewDialog';
import {
  STEAM_LINK_URL,
  useRestoreSteamGame,
  useSteamStatus,
  useSteamSync,
  useUnlinkSteam,
} from './api';

const t = messages.library.steam;
const STEAM_BLUE = '#66c0f4';

/** Unlinking: the user chooses to keep or delete the games Steam added. */
function UnlinkDialog({ importedGames, onClose }: { importedGames: number; onClose: () => void }) {
  const unlink = useUnlinkSteam();
  const [choice, setChoice] = useState<'keep' | 'delete'>('keep');
  const options = [
    { value: 'keep', label: t.unlinkKeep, description: t.unlinkKeepBody },
    {
      value: 'delete',
      label: t.unlinkDelete(importedGames),
      description: t.unlinkDeleteBody,
    },
  ] as const;

  return (
    <FormDialog
      open
      title={t.unlinkTitle}
      icon={<LinkOffIcon />}
      submitLabel={t.unlink}
      submitColor="error"
      pending={unlink.isPending}
      error={unlink.isError ? getApiErrorMessage(unlink.error) : null}
      onSubmit={() => unlink.mutate(choice === 'delete', { onSuccess: onClose })}
      onClose={onClose}
    >
      <RadioGroup
        aria-label={t.unlinkChoice}
        value={choice}
        onChange={(e) => setChoice(e.target.value as 'keep' | 'delete')}
        sx={{ gap: 1 }}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio color={option.value === 'delete' ? 'error' : 'primary'} />}
            sx={(theme) => ({
              m: 0,
              p: 1.5,
              pl: 0.5,
              alignItems: 'flex-start',
              borderRadius: 2,
              border: `1px solid ${
                choice === option.value
                  ? option.value === 'delete'
                    ? theme.palette.error.main
                    : theme.palette.primary.main
                  : theme.palette.divider
              }`,
            })}
            label={
              <Box sx={{ pt: 0.75 }}>
                <Typography sx={{ fontWeight: 700 }}>{option.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {option.description}
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </FormDialog>
  );
}

/** Steam's wordmark color dot, as the panel's badge. */
function SteamBadge() {
  return (
    <Box
      aria-hidden
      sx={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 900,
        fontSize: '0.8rem',
        letterSpacing: 0.5,
        color: '#c7d5e0',
        background: 'linear-gradient(135deg, #171a21 0%, #1b2838 60%, #2a475e 100%)',
        boxShadow: `0 0 0 1px ${alpha(STEAM_BLUE, 0.4)}, 0 0 18px ${alpha(STEAM_BLUE, 0.25)}`,
      }}
    >
      S
    </Box>
  );
}

/**
 * Steam on "Mis juegos" (decisions #78 and #80): link the account, follow the
 * sync, review the games found and sync again. Opening the page triggers an automatic sync (the backend only
 * runs it if the last one is 6+ hours old).
 */
export function SteamPanel() {
  const status = useSteamStatus();
  const sync = useSteamSync();
  const restore = useRestoreSteamGame();
  const [params, setParams] = useSearchParams();
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  // The review dialog opens by itself when a sync finds games; once closed, it
  // stays closed during this visit (the panel offers to open it again).
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const autoSynced = useRef(false);

  const data = status.data;
  const account = data?.account ?? null;
  const linked = account !== null;
  const pendingGames = account && !account.syncing ? account.pendingGames : 0;
  const showReview = pendingGames > 0 && (reviewOpen || !reviewDismissed);

  useEffect(() => {
    if (linked && !autoSynced.current) {
      autoSynced.current = true;
      sync.mutate(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, [linked]);

  // Result of Steam's login, sent back in the URL by the backend.
  const result = params.get('steam');
  const reason = params.get('reason');
  const dismissResult = () => {
    const next = new URLSearchParams(params);
    next.delete('steam');
    next.delete('reason');
    setParams(next, { replace: true });
  };
  // "Looking for your games" lasts until the search ends with nothing to review
  // (no games found, or an error shown by the panel) or the review dialog closes.
  const searchEnded =
    account !== null &&
    !account.syncing &&
    account.pendingGames === 0 &&
    (account.lastSyncedAt !== null || account.syncError !== null);
  useEffect(() => {
    if (result === 'linked' && searchEnded) {
      dismissResult();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the search ends
  }, [result, searchEnded]);
  const resultAlert =
    result === 'linked' ? (
      <Alert severity="success" variant="outlined" onClose={dismissResult}>
        {t.linkedNotice}
      </Alert>
    ) : result === 'error' ? (
      <Alert severity="error" variant="outlined" onClose={dismissResult}>
        {(reason && t.linkErrors[reason]) || t.linkErrorFallback}
      </Alert>
    ) : null;

  if (!data?.configured) {
    return resultAlert;
  }

  const cooldown =
    sync.isError &&
    sync.variables === false &&
    sync.error instanceof ApiError &&
    sync.error.status === 429;

  return (
    <Stack spacing={1.5}>
      {resultAlert}
      <Box
        component="section"
        aria-label="Steam"
        sx={(theme) => ({ ...panelSx(theme, STEAM_BLUE), p: { xs: 2, md: 2.5 } })}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            <SteamBadge />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }}>
                {account
                  ? account.personaName
                    ? t.linkedAs(account.personaName)
                    : t.linked
                  : t.linkTitle}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {!account
                  ? t.linkBody
                  : account.syncing
                    ? t.syncing(account.progress.done, account.progress.total)
                    : account.lastSyncedAt
                      ? t.lastSync(formatDateTime(account.lastSyncedAt))
                      : t.neverSynced}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            {account ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<SyncIcon />}
                  loading={account.syncing || (sync.isPending && sync.variables === false)}
                  onClick={() => sync.mutate(false)}
                  sx={{ borderRadius: 99, whiteSpace: 'nowrap' }}
                >
                  {t.syncNow}
                </Button>
                <Button
                  color="inherit"
                  startIcon={<LinkOffIcon />}
                  onClick={() => setConfirmUnlink(true)}
                >
                  {t.unlink}
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                href={STEAM_LINK_URL}
                sx={{
                  borderRadius: 99,
                  fontWeight: 800,
                  color: '#0b141d',
                  bgcolor: STEAM_BLUE,
                  '&:hover': { bgcolor: '#8fd3ff' },
                }}
              >
                {t.link}
              </Button>
            )}
          </Stack>
        </Stack>

        {pendingGames > 0 ? (
          <Alert
            severity="info"
            variant="outlined"
            sx={{ mt: 2, alignItems: 'center' }}
            action={
              <Button color="inherit" size="small" onClick={() => setReviewOpen(true)}>
                {t.review.open}
              </Button>
            }
          >
            {t.review.waiting(pendingGames)}
          </Alert>
        ) : null}

        {account?.syncing ? (
          <LinearProgress
            variant={account.progress.total > 0 ? 'determinate' : 'indeterminate'}
            value={
              account.progress.total > 0
                ? (account.progress.done / account.progress.total) * 100
                : undefined
            }
            aria-label={t.syncing(account.progress.done, account.progress.total)}
            sx={{ mt: 2, borderRadius: 99 }}
          />
        ) : null}
        {account?.syncError ? (
          <Alert severity="warning" variant="outlined" sx={{ mt: 2 }}>
            {t.syncErrors[account.syncError] ?? t.syncErrors.STEAM_UNAVAILABLE}
          </Alert>
        ) : null}
        {cooldown ? (
          <Typography variant="body2" color="warning.main" role="status" sx={{ mt: 1.5 }}>
            {t.cooldown}
          </Typography>
        ) : null}

        {data.excluded.length > 0 ? (
          <Box component="details" sx={{ mt: 2 }}>
            <Typography
              component="summary"
              variant="body2"
              sx={{ cursor: 'pointer', fontWeight: 700 }}
            >
              {t.excluded(data.excluded.length)}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {t.excludedHelp}
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 1, p: 0 }}>
              {data.excluded.map((game) => (
                <Box
                  component="li"
                  key={game.appId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.5,
                  }}
                >
                  <Typography variant="body2">{game.name}</Typography>
                  <Button
                    size="small"
                    aria-label={t.restore(game.name)}
                    loading={restore.isPending && restore.variables === game.appId}
                    onClick={() => restore.mutate(game.appId)}
                  >
                    {t.restoreLabel}
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        {account ? (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
            {t.attribution}{' '}
            <Link href="https://steamcommunity.com" target="_blank" rel="noopener noreferrer">
              Steam
            </Link>
          </Typography>
        ) : null}
      </Box>

      {showReview ? (
        <SteamReviewDialog
          onClose={() => {
            setReviewOpen(false);
            setReviewDismissed(true);
            if (result === 'linked') {
              dismissResult();
            }
          }}
        />
      ) : null}
      {confirmUnlink && account ? (
        <UnlinkDialog
          importedGames={account.importedGames}
          onClose={() => setConfirmUnlink(false)}
        />
      ) : null}
    </Stack>
  );
}
