import BookmarkAddIcon from '@mui/icons-material/BookmarkAddOutlined';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { glassSx } from '../../theme/brand';
import { useCurrentUser } from '../auth/useCurrentUser';
import { useAddToWishlist, useRemoveFromWishlist } from './api';
import { useLoginRedirect } from './useLoginRedirect';

const t = messages.explore;

interface WishlistButtonProps {
  game: { provider: string; externalId: string; name: string };
  /** The user's wishlist entry of the game, if any. */
  wishlistItemId: string | null;
  /** `card`: round glass button over a cover. `header`: outlined button with text. */
  variant: 'card' | 'header';
}

/**
 * Adds or removes a catalog game from the wishlist (decision #66). Anonymous
 * visitors are sent to log in first.
 */
export function WishlistButton({ game, wishlistItemId, variant }: WishlistButtonProps) {
  const { data: user } = useCurrentUser();
  const loginRedirect = useLoginRedirect();
  const add = useAddToWishlist();
  const remove = useRemoveFromWishlist();
  const [error, setError] = useState<string | null>(null);

  const saved = wishlistItemId !== null;
  const pending = add.isPending || remove.isPending;
  const label = saved ? t.wishlistRemove(game.name) : t.wishlistAdd(game.name);
  const onError = (e: unknown) => setError(getApiErrorMessage(e, t.serverErrors));
  const toggle = () => {
    if (!user) {
      loginRedirect();
    } else if (wishlistItemId) {
      remove.mutate(wishlistItemId, { onError });
    } else {
      add.mutate(game, { onError });
    }
  };
  const Icon = saved ? BookmarkAddedIcon : BookmarkAddIcon;

  return (
    <>
      {variant === 'card' ? (
        <Tooltip title={saved ? t.wishlistRemoveShort : t.wishlistAddShort}>
          <IconButton
            size="small"
            aria-label={label}
            aria-pressed={saved}
            disabled={pending}
            onClick={toggle}
            sx={(theme) => ({
              ...glassSx(theme, 0.6),
              width: 30,
              height: 30,
              color: saved ? theme.palette.secondary.main : theme.palette.common.white,
              '&:hover': { ...glassSx(theme, 0.8), color: theme.palette.secondary.main },
              ...(saved
                ? { boxShadow: `0 0 12px ${alpha(theme.palette.secondary.main, 0.6)}` }
                : {}),
            })}
          >
            <Icon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          size="large"
          aria-label={label}
          aria-pressed={saved}
          loading={pending}
          startIcon={<Icon />}
          onClick={toggle}
          sx={(theme) => ({
            bgcolor: alpha(theme.palette.background.default, 0.45),
            backdropFilter: 'blur(6px)',
            ...(saved
              ? {
                  color: theme.palette.secondary.main,
                  borderColor: alpha(theme.palette.secondary.main, 0.6),
                }
              : {}),
          })}
        >
          {saved ? t.wishlistRemoveShort : t.wishlistAddShort}
        </Button>
      )}
      <Snackbar
        open={error !== null}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" variant="filled" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
