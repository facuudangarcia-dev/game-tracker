import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import SearchIcon from '@mui/icons-material/Search';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { type ReactNode, useDeferredValue, useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { SectionHeading } from '../features/home/SectionHeading';
import { PlayerAvatar } from '../features/profile/PlayerAvatar';
import {
  type Friend,
  type PublicUser,
  type Relation,
  useAcceptRequest,
  useBlocks,
  useFriends,
  useRemoveRequest,
  useSendRequest,
  useUnblock,
  useUserSearch,
} from '../features/social/api';
import { playerPath } from '../features/social/paths';
import { UserActionsMenu } from '../features/social/UserActionsMenu';
import { messages } from '../i18n/messages';
import { getApiErrorMessage } from '../lib/api/errors';
import { formatDate } from '../lib/format';
import { panelSx } from '../theme/brand';

const t = messages.social.friends;

/** One user: avatar, username (linking to the profile when visible) and actions. */
function UserRow({
  user,
  detail,
  linked,
  children,
}: {
  user: PublicUser;
  detail?: string;
  linked?: boolean;
  children?: ReactNode;
}) {
  return (
    <Box
      component="li"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        borderTop: `1px solid ${theme.palette.divider}`,
        '&:first-of-type': { borderTop: 'none' },
      })}
    >
      <PlayerAvatar avatar={user.avatar} username={user.username} size={44} decorative />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {linked ? (
          <Link
            component={RouterLink}
            to={playerPath(user.username)}
            sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}
            underline="hover"
            color="inherit"
          >
            {user.username}
          </Link>
        ) : (
          <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere' }}>
            {user.username}
          </Typography>
        )}
        {detail ? (
          <Typography variant="caption" color="text.secondary" component="p">
            {detail}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexShrink: 0 }}>
        {children}
      </Stack>
    </Box>
  );
}

function Panel({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={(theme) => ({ ...panelSx(theme), p: { xs: 2, md: 2.5 } })}
    >
      <Typography id={id} variant="h6" component="h2" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

/** What can be done with a search result, depending on how we relate. */
function RelationActions({ username, relation }: { username: string; relation: Relation }) {
  const send = useSendRequest();
  const accept = useAcceptRequest();
  const remove = useRemoveRequest();
  const error = [send, accept, remove].find((m) => m.isError)?.error;
  const pending = send.isPending || accept.isPending || remove.isPending;

  return (
    <Stack spacing={0.5} sx={{ alignItems: 'flex-end' }}>
      {relation === 'FRIEND' ? (
        <Button component={RouterLink} to={playerPath(username)} size="small">
          {t.viewProfile}
        </Button>
      ) : relation === 'REQUEST_SENT' ? (
        <Button
          size="small"
          color="inherit"
          loading={pending}
          onClick={() => remove.mutate(username)}
        >
          {t.cancelRequest}
        </Button>
      ) : relation === 'REQUEST_RECEIVED' ? (
        <Button
          size="small"
          variant="contained"
          loading={pending}
          onClick={() => accept.mutate(username)}
        >
          {t.accept}
        </Button>
      ) : (
        <Button
          size="small"
          variant="outlined"
          startIcon={<PersonAddAlt1Icon />}
          loading={pending}
          onClick={() => send.mutate(username)}
        >
          {t.add}
        </Button>
      )}
      {relation === 'REQUEST_SENT' ? (
        <Typography variant="caption" color="text.secondary">
          {t.requestSent}
        </Typography>
      ) : null}
      {error ? (
        <Typography variant="caption" color="error">
          {getApiErrorMessage(error, t.errors)}
        </Typography>
      ) : null}
    </Stack>
  );
}

function SearchPanel() {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query.trim());
  const results = useUserSearch(deferred);
  const searching = deferred.length >= 3;

  return (
    <Panel id="friends-search" title={t.searchLabel}>
      <TextField
        fullWidth
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchHint}
        slotProps={{
          htmlInput: { 'aria-label': t.searchLabel, maxLength: 30 },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: results.isFetching ? (
              <InputAdornment position="end">
                <CircularProgress size={18} />
              </InputAdornment>
            ) : null,
          },
        }}
      />
      {searching && results.data ? (
        results.data.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {t.noResults}
          </Typography>
        ) : (
          <Box
            component="ul"
            aria-label={t.searchLabel}
            sx={{ listStyle: 'none', m: 0, p: 0, mt: 1 }}
          >
            {results.data.map((user) => (
              <UserRow key={user.username} user={user} linked={user.relation === 'FRIEND'}>
                <RelationActions username={user.username} relation={user.relation} />
              </UserRow>
            ))}
          </Box>
        )
      ) : null}
    </Panel>
  );
}

function RequestList({ incoming, outgoing }: { incoming: Friend[]; outgoing: Friend[] }) {
  const accept = useAcceptRequest();
  const remove = useRemoveRequest();
  return (
    <>
      {incoming.length ? (
        <Panel id="friends-incoming" title={t.incomingTitle}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {incoming.map((user) => (
              <UserRow
                key={user.username}
                user={user}
                detail={t.received(formatDate(user.since.slice(0, 10)))}
              >
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => accept.mutate(user.username)}
                  disabled={accept.isPending}
                >
                  {t.accept}
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => remove.mutate(user.username)}
                  disabled={remove.isPending}
                >
                  {t.decline}
                </Button>
              </UserRow>
            ))}
          </Box>
        </Panel>
      ) : null}
      {outgoing.length ? (
        <Panel id="friends-outgoing" title={t.outgoingTitle}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {outgoing.map((user) => (
              <UserRow
                key={user.username}
                user={user}
                detail={t.requested(formatDate(user.since.slice(0, 10)))}
              >
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => remove.mutate(user.username)}
                  disabled={remove.isPending}
                >
                  {t.cancelRequest}
                </Button>
              </UserRow>
            ))}
          </Box>
        </Panel>
      ) : null}
    </>
  );
}

function BlockedPanel() {
  const blocks = useBlocks();
  const unblock = useUnblock();
  if (!blocks.data?.length) {
    return null;
  }
  return (
    <Panel id="friends-blocked" title={t.blockedTitle}>
      <Typography variant="body2" color="text.secondary">
        {t.blockedHelp}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, mt: 1 }}>
        {blocks.data.map((user) => (
          <UserRow key={user.username} user={user}>
            <Button
              size="small"
              color="inherit"
              onClick={() => unblock.mutate(user.username)}
              disabled={unblock.isPending}
            >
              {t.unblock}
            </Button>
          </UserRow>
        ))}
      </Box>
    </Panel>
  );
}

/** Friends (decision #84): search players, requests, friends and blocked users. */
export function FriendsPage() {
  const friends = useFriends();

  return (
    <Stack spacing={3} sx={{ maxWidth: 820, mx: 'auto' }}>
      <SectionHeading
        id="friends-title"
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
      />
      <SearchPanel />
      {friends.isPending ? (
        <Skeleton variant="rounded" height={160} sx={{ borderRadius: 3 }} />
      ) : friends.isError ? (
        <Alert severity="error" variant="outlined">
          {getApiErrorMessage(friends.error)}
        </Alert>
      ) : (
        <>
          <RequestList incoming={friends.data.incoming} outgoing={friends.data.outgoing} />
          <Panel id="friends-list" title={`${t.friendsTitle} (${friends.data.friends.length})`}>
            {friends.data.friends.length === 0 ? (
              <Typography color="text.secondary">{t.empty}</Typography>
            ) : (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {friends.data.friends.map((user) => (
                  <UserRow
                    key={user.username}
                    user={user}
                    linked
                    detail={t.since(formatDate(user.since.slice(0, 10)))}
                  >
                    <Button component={RouterLink} to={playerPath(user.username)} size="small">
                      {t.viewProfile}
                    </Button>
                    <UserActionsMenu username={user.username} friend />
                  </UserRow>
                ))}
              </Box>
            )}
          </Panel>
        </>
      )}
      <BlockedPanel />
    </Stack>
  );
}
