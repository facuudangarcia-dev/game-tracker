import GavelIcon from '@mui/icons-material/Gavel';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { hashKey, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { apiFetch } from '../../lib/api/client';
import { getApiErrorMessage } from '../../lib/api/errors';
import type { User } from '../auth/api';
import { currentUserQueryKey } from '../auth/queryKeys';
import { useLogout } from '../auth/useAuthMutations';

/**
 * Blocking notice when the Terms or the Privacy policy changed (decision #88):
 * the user accepts them to keep using the app, or logs out.
 */
export function LegalUpdateDialog() {
  const t = messages.social.legalUpdate;
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [checked, setChecked] = useState(false);
  const [showError, setShowError] = useState(false);
  const accept = useMutation({
    mutationFn: () =>
      apiFetch<User>('/auth/accept-legal', {
        method: 'POST',
        body: JSON.stringify({ acceptTerms: true, acceptPrivacy: true }),
      }),
    onSuccess: (user) => {
      queryClient.setQueryData<User | null>(currentUserQueryKey, user);
      // Requests made before accepting were refused: load everything again.
      const currentUserHash = hashKey(currentUserQueryKey);
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryHash !== currentUserHash,
      });
    },
  });

  return (
    <FormDialog
      open
      title={t.title}
      icon={<GavelIcon />}
      submitLabel={t.continue}
      pending={accept.isPending}
      error={
        showError && !checked
          ? t.required
          : accept.isError
            ? getApiErrorMessage(accept.error)
            : null
      }
      onSubmit={() => {
        setShowError(true);
        if (checked) {
          accept.mutate();
        }
      }}
      // Closing isn't an option: accept or log out.
      dismissible={false}
      onClose={() => setShowError(true)}
    >
      <Typography sx={{ lineHeight: 1.6 }}>{t.body}</Typography>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">
          {t.read}
        </Typography>
        <Link href="/terms" target="_blank" rel="noopener">
          {messages.legal.terms.title}
        </Link>
        <Link href="/privacy" target="_blank" rel="noopener">
          {messages.legal.privacy.title}
        </Link>
      </Stack>
      <FormControlLabel
        control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />}
        label={t.accept}
      />
      <Button
        color="inherit"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
        sx={{ alignSelf: 'flex-start' }}
      >
        {t.logout}
      </Button>
    </FormDialog>
  );
}
