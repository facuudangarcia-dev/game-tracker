import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import { alpha } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { messages } from '../../i18n/messages';
import { apiFetch } from '../../lib/api/client';
import { getApiErrorMessage } from '../../lib/api/errors';
import { FAVORITE_COLOR, glassSx } from '../../theme/brand';
import { profileKeys } from '../profile/api';
import { libraryKeys } from './queries';
import type { UserGameDetails } from './types';

const t = messages.favorites;

interface FavoriteButtonProps {
  userGameId: string;
  /** Name shown in the accessible label ("Mark X as favorite"). */
  name: string;
  favorite: boolean;
  /** `card`: round glass button over a cover. `header`: outlined button with text. */
  variant: 'card' | 'header';
}

/**
 * Marks or unmarks a library game as a favorite (at most 5, decision #63). The
 * library, the game page and the profile are refreshed with the result.
 */
export function FavoriteButton({ userGameId, name, favorite, variant }: FavoriteButtonProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (value: boolean) =>
      apiFetch<UserGameDetails>(`/library/${userGameId}`, {
        method: 'PATCH',
        body: JSON.stringify({ favorite: value }),
      }),
    onSuccess: (details) => {
      queryClient.setQueryData(libraryKeys.detail(userGameId), details);
      void queryClient.invalidateQueries({ queryKey: libraryKeys.list() });
      void queryClient.invalidateQueries({ queryKey: profileKeys.highlights });
    },
    onError: (e) => setError(getApiErrorMessage(e, t.serverErrors)),
  });

  const label = favorite ? t.remove(name) : t.add(name);
  const toggle = () => mutation.mutate(!favorite);
  const Icon = favorite ? FavoriteIcon : FavoriteBorderIcon;

  return (
    <>
      {variant === 'card' ? (
        <Tooltip title={favorite ? t.removeShort : t.addShort}>
          <IconButton
            size="small"
            aria-label={label}
            aria-pressed={favorite}
            disabled={mutation.isPending}
            onClick={toggle}
            sx={(theme) => ({
              ...glassSx(theme, 0.6),
              width: 30,
              height: 30,
              color: favorite ? FAVORITE_COLOR : theme.palette.common.white,
              '&:hover': { ...glassSx(theme, 0.8), color: FAVORITE_COLOR },
              ...(favorite ? { boxShadow: `0 0 12px ${alpha(FAVORITE_COLOR, 0.7)}` } : {}),
            })}
          >
            <Icon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      ) : (
        <Button
          variant="outlined"
          aria-label={label}
          aria-pressed={favorite}
          loading={mutation.isPending}
          startIcon={<Icon />}
          onClick={toggle}
          sx={(theme) => ({
            bgcolor: alpha(theme.palette.background.default, 0.45),
            backdropFilter: 'blur(6px)',
            ...(favorite
              ? {
                  color: FAVORITE_COLOR,
                  borderColor: alpha(FAVORITE_COLOR, 0.6),
                  '&:hover': {
                    borderColor: FAVORITE_COLOR,
                    bgcolor: alpha(FAVORITE_COLOR, 0.1),
                  },
                }
              : {}),
          })}
        >
          {favorite ? t.removeShort : t.addShort}
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
