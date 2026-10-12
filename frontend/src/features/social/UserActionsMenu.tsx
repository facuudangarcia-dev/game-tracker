import BlockIcon from '@mui/icons-material/Block';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { useBlock, useUnfriend } from './api';
import { ReportDialog } from './ReportDialog';

type Pending = 'unfriend' | 'block' | 'report' | null;

/**
 * Actions on another user (decision #84): remove the friend, block and report
 * (decision #87). `onRemoved` runs after unfriending or blocking.
 */
export function UserActionsMenu({
  username,
  friend,
  onRemoved,
}: {
  username: string;
  friend: boolean;
  onRemoved?: () => void;
}) {
  const t = messages.social.friends;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const unfriend = useUnfriend();
  const block = useBlock();
  const choose = (action: Pending) => {
    setAnchor(null);
    setPending(action);
  };
  const done = () => {
    setPending(null);
    onRemoved?.();
  };

  return (
    <>
      <IconButton
        aria-label={t.options(username)}
        aria-haspopup="menu"
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {friend ? (
          <MenuItem onClick={() => choose('unfriend')}>
            <ListItemIcon>
              <PersonRemoveOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t.unfriend}</ListItemText>
          </MenuItem>
        ) : null}
        <MenuItem onClick={() => choose('block')}>
          <ListItemIcon>
            <BlockIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t.block}</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => choose('report')}>
          <ListItemIcon>
            <FlagOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t.report}</ListItemText>
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={pending === 'unfriend'}
        title={t.unfriendTitle(username)}
        body={t.unfriendBody}
        confirmLabel={t.unfriendConfirm}
        pending={unfriend.isPending}
        error={unfriend.isError ? getApiErrorMessage(unfriend.error, t.errors) : null}
        onConfirm={() => unfriend.mutate(username, { onSuccess: done })}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending === 'block'}
        title={t.blockTitle(username)}
        body={t.blockBody}
        confirmLabel={t.blockConfirm}
        pending={block.isPending}
        error={block.isError ? getApiErrorMessage(block.error, t.errors) : null}
        onConfirm={() => block.mutate(username, { onSuccess: done })}
        onClose={() => setPending(null)}
      />
      {pending === 'report' ? (
        <ReportDialog username={username} onClose={() => setPending(null)} />
      ) : null}
    </>
  );
}
