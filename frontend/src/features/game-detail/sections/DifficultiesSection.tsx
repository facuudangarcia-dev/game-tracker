import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { type FormEvent, useState } from 'react';
import { Section } from '../../../components/Section';
import { VIOLET } from '../../../theme/brand';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { DifficultyBadge } from '../../library/DifficultyBadge';
import type { Difficulty, DifficultyKind, UserGameDetails } from '../../library/types';
import { DIFFICULTY_NAME_MAX_LENGTH } from '../../library/validation';
import { detailApi } from '../api';
import { DIFFICULTIES_SECTION_ID, type OnDetailAction } from '../detailActions';
import { useDifficultyMutation } from '../mutations';

const t = messages.detail.difficulties;

interface DifficultyListProps {
  userGameId: string;
  kind: DifficultyKind;
  title: string;
  difficulties: Difficulty[];
  onAction: OnDetailAction;
}

function DifficultyList({ userGameId, kind, title, difficulties, onAction }: DifficultyListProps) {
  const [name, setName] = useState('');
  const create = useDifficultyMutation(userGameId, (newName: string) =>
    detailApi.createDifficulty(userGameId, kind, newName),
  );
  const reorder = useDifficultyMutation(userGameId, (ids: string[]) =>
    detailApi.reorderDifficulties(userGameId, kind, ids),
  );
  const headingId = `difficulties-${kind.toLowerCase()}`;

  const add = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) {
      create.mutate(name.trim(), { onSuccess: () => setName('') });
    }
  };

  const move = (index: number, offset: -1 | 1) => {
    const ids = difficulties.map((d) => d.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    reorder.mutate(ids);
  };

  const error = create.error ?? reorder.error;

  return (
    <Box component="section" aria-labelledby={headingId}>
      <Typography id={headingId} variant="subtitle1" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {difficulties.length === 0 ? (
        <Typography color="text.secondary">{t.empty}</Typography>
      ) : (
        <List dense disablePadding>
          {difficulties.map((difficulty, index) => (
            <ListItem
              key={difficulty.id}
              divider
              disableGutters
              secondaryAction={
                <Stack direction="row">
                  <IconButton
                    size="small"
                    aria-label={t.moveUp(difficulty.name)}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t.moveDown(difficulty.name)}
                    disabled={index === difficulties.length - 1 || reorder.isPending}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={t.rename(difficulty.name)}
                    onClick={() => onAction({ type: 'renameDifficulty', difficulty })}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <Tooltip title={difficulty.inUse ? t.inUse : ''}>
                    <Box component="span">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={t.delete(difficulty.name)}
                        disabled={difficulty.inUse}
                        onClick={() => onAction({ type: 'deleteDifficulty', difficulty })}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                </Stack>
              }
              sx={{ pr: 18 }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <DifficultyBadge
                      name={difficulty.name}
                      level={index}
                      levels={difficulties.length}
                    />
                    {difficulty.inUse ? (
                      <Chip size="small" variant="outlined" label={t.inUseBadge} />
                    ) : null}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
      <Stack component="form" spacing={1} onSubmit={add} sx={{ mt: 2, alignItems: 'flex-end' }}>
        <TextField
          size="small"
          fullWidth
          label={t.newLabel}
          value={name}
          onChange={(e) => setName(e.target.value)}
          slotProps={{
            // The visible label is short; assistive tech gets which list it belongs to.
            htmlInput: { maxLength: DIFFICULTY_NAME_MAX_LENGTH, 'aria-label': t.newName(title) },
          }}
        />
        <Button
          type="submit"
          startIcon={<AddIcon />}
          disabled={!name.trim()}
          loading={create.isPending}
        >
          {t.add}
        </Button>
      </Stack>
      {error ? (
        <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
          {getApiErrorMessage(error, messages.library.serverErrors)}
        </Alert>
      ) : null}
    </Box>
  );
}

/** Two independent lists: playthrough difficulties and platinum difficulties. */
export function DifficultiesSection({
  userGame,
  onAction,
}: {
  userGame: UserGameDetails;
  onAction: OnDetailAction;
}) {
  const byKind = (kind: DifficultyKind) => userGame.difficulties.filter((d) => d.kind === kind);
  return (
    <Section
      id={DIFFICULTIES_SECTION_ID}
      title={messages.detail.sections.difficulties}
      icon={<TuneIcon />}
      accent={() => VIOLET}
    >
      <Grid container spacing={3}>
        <Grid size={12}>
          <DifficultyList
            userGameId={userGame.id}
            kind="PLAYTHROUGH"
            title={t.playthroughList}
            difficulties={byKind('PLAYTHROUGH')}
            onAction={onAction}
          />
        </Grid>
        <Grid size={12}>
          <DifficultyList
            userGameId={userGame.id}
            kind="PLATINUM"
            title={t.platinumList}
            difficulties={byKind('PLATINUM')}
            onAction={onAction}
          />
        </Grid>
      </Grid>
    </Section>
  );
}
