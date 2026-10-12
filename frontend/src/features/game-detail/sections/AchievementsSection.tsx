import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditIcon from '@mui/icons-material/Edit';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { type Choice, ChoiceChips } from '../../../components/ChoiceChips';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { FormDialog } from '../../../components/FormDialog';
import { useLocale } from '../../../i18n/locale';
import { messages } from '../../../i18n/messages';
import { getApiErrorMessage } from '../../../lib/api/errors';
import { formatDate } from '../../../lib/format';
import { ink, VIOLET } from '../../../theme/brand';
import type { Achievement, UserGameDetails } from '../../library/types';
import { type AchievementInput, detailApi } from '../api';
import { useGameMutation } from '../mutations';
import { Section } from '../../../components/Section';

const t = messages.detail.achievements;
/** Long lists (Steam games have dozens) show this many until expanded. */
const COLLAPSED_COUNT = 12;
const NAME_MAX_LENGTH = 200;
const DESCRIPTION_MAX_LENGTH = 1000;

type Filter = 'all' | 'pending' | 'achieved';

/** Steam's texts in the interface language (Spanish when the game has it). */
function texts(achievement: Achievement, locale: string) {
  const spanish = locale === 'es';
  return {
    name: (spanish && achievement.nameEs) || achievement.name,
    description: (spanish && achievement.descriptionEs) || achievement.description,
  };
}

function AchievementIcon({ achievement }: { achievement: Achievement }) {
  const src = achievement.achieved ? achievement.iconUrl : achievement.iconLockedUrl;
  if (src) {
    return (
      <Box
        component="img"
        src={src}
        alt=""
        loading="lazy"
        sx={{ width: 44, height: 44, borderRadius: 1.5, flexShrink: 0, objectFit: 'cover' }}
      />
    );
  }
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 1.5,
        display: 'grid',
        placeItems: 'center',
        color: achievement.achieved ? VIOLET : 'text.disabled',
        bgcolor: alpha(achievement.achieved ? VIOLET : ink(theme), 0.08),
      })}
    >
      <MilitaryTechIcon />
    </Box>
  );
}

/** Add or edit one of the user's own achievements. */
function AchievementDialog({
  userGame,
  achievement,
  onClose,
}: {
  userGame: UserGameDetails;
  achievement: Achievement | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(achievement?.name ?? '');
  const [description, setDescription] = useState(achievement?.description ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const mutation = useGameMutation(userGame.id, (input: AchievementInput) =>
    achievement
      ? detailApi.updateAchievement(userGame.id, achievement.id, input)
      : detailApi.createAchievement(userGame.id, {
          name: input.name!,
          description: input.description,
        }),
  );
  const nameError = name.trim() ? undefined : messages.validation.required;

  return (
    <FormDialog
      open
      icon={<MilitaryTechIcon />}
      eyebrow={userGame.game.name}
      title={achievement ? t.editTitle : t.createTitle}
      onClose={onClose}
      onSubmit={() => {
        setShowErrors(true);
        if (nameError) {
          return;
        }
        mutation.mutate(
          { name: name.trim(), description: description.trim() || null },
          { onSuccess: onClose },
        );
      }}
      pending={mutation.isPending}
      error={
        mutation.isError ? getApiErrorMessage(mutation.error, messages.library.serverErrors) : null
      }
    >
      <TextField
        label={t.name}
        required
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={showErrors && Boolean(nameError)}
        helperText={showErrors ? nameError : undefined}
        slotProps={{ htmlInput: { maxLength: NAME_MAX_LENGTH } }}
      />
      <TextField
        label={t.description}
        multiline
        minRows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        slotProps={{ htmlInput: { maxLength: DESCRIPTION_MAX_LENGTH } }}
      />
    </FormDialog>
  );
}

function AchievementRow({
  userGame,
  achievement,
  onEdit,
  onDelete,
}: {
  userGame: UserGameDetails;
  achievement: Achievement;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const locale = useLocale();
  const [revealed, setRevealed] = useState(false);
  const toggle = useGameMutation(userGame.id, (achieved: boolean) =>
    detailApi.updateAchievement(userGame.id, achievement.id, { achieved }),
  );
  const { name, description } = texts(achievement, locale);
  const secret = achievement.hidden && !achievement.achieved && !revealed;
  const manual = achievement.source === 'MANUAL';

  return (
    <Box
      component="li"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1.25,
        borderTop: `1px solid ${theme.palette.divider}`,
        opacity: achievement.achieved ? 1 : 0.85,
      })}
    >
      <AchievementIcon achievement={achievement} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{name}</Typography>
        {secret ? (
          <Typography variant="body2" color="text.secondary">
            {t.hidden} ·{' '}
            <Link component="button" type="button" onClick={() => setRevealed(true)}>
              {t.reveal}
            </Link>
          </Typography>
        ) : description ? (
          <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {description}
          </Typography>
        ) : null}
        {achievement.achieved && achievement.achievedAt ? (
          <Typography variant="caption" sx={{ color: VIOLET, fontWeight: 700 }}>
            {t.achievedOn(formatDate(achievement.achievedAt.slice(0, 10)))}
          </Typography>
        ) : null}
      </Box>
      {manual ? (
        <Stack direction="row">
          <IconButton size="small" aria-label={t.edit(name)} onClick={onEdit}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" aria-label={t.delete(name)} onClick={onDelete}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ) : null}
      <Checkbox
        checked={achievement.achieved}
        disabled={toggle.isPending}
        onChange={(e) => toggle.mutate(e.target.checked)}
        slotProps={{ input: { 'aria-label': name } }}
        sx={{ color: alpha(VIOLET, 0.7), '&.Mui-checked': { color: VIOLET } }}
      />
    </Box>
  );
}

/**
 * Achievements of the game (decision #78): Steam's (synced, in the interface
 * language) and the user's own. Every one can be checked; the user's own can
 * also be edited and deleted.
 */
export function AchievementsSection({ userGame }: { userGame: UserGameDetails }) {
  const list = userGame.achievementList;
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Achievement | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Achievement | null>(null);
  const remove = useGameMutation(userGame.id, (achievementId: string) =>
    detailApi.deleteAchievement(userGame.id, achievementId),
  );

  const achieved = list.filter((a) => a.achieved).length;
  const percent = list.length ? Math.round((achieved / list.length) * 100) : 0;
  const filtered = list.filter(
    (a) => filter === 'all' || (filter === 'achieved' ? a.achieved : !a.achieved),
  );
  const shown = expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT);
  const fromSteam = list.some((a) => a.source === 'STEAM');
  const filterChoices: Choice<Filter>[] = (['all', 'pending', 'achieved'] as const).map(
    (value) => ({ value, label: t.filters[value] }),
  );

  return (
    <Section
      id="logros"
      title={t.title}
      icon={<MilitaryTechIcon />}
      accent={() => VIOLET}
      actions={
        <Button startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          {t.add}
        </Button>
      }
    >
      {list.length === 0 ? (
        <Typography color="text.secondary">{t.empty}</Typography>
      ) : (
        <Stack spacing={2}>
          <Box>
            <Stack
              direction="row"
              sx={{
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 1,
                flexWrap: 'wrap',
              }}
            >
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900 }}>
                {t.progress(achieved, list.length)}
              </Typography>
              <Typography variant="body2" sx={{ color: VIOLET, fontWeight: 700 }}>
                {t.percent(percent)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percent}
              aria-label={t.percent(percent)}
              sx={{
                mt: 1,
                height: 8,
                borderRadius: 99,
                '& .MuiLinearProgress-bar': { bgcolor: VIOLET },
              }}
            />
            {fromSteam ? (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>
                {t.steamSource}
              </Typography>
            ) : null}
          </Box>
          <ChoiceChips
            id="achievements-filter"
            label={t.filter}
            value={filter}
            choices={filterChoices}
            onChange={(value) => {
              setFilter(value);
              setExpanded(false);
            }}
          />
          {filtered.length === 0 ? (
            <Typography color="text.secondary">{t.noneInFilter}</Typography>
          ) : (
            <Box component="ul" aria-label={t.title} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {shown.map((achievement) => (
                <AchievementRow
                  key={achievement.id}
                  userGame={userGame}
                  achievement={achievement}
                  onEdit={() => setEditing(achievement)}
                  onDelete={() => setDeleting(achievement)}
                />
              ))}
            </Box>
          )}
          {filtered.length > COLLAPSED_COUNT ? (
            <Button onClick={() => setExpanded((value) => !value)} sx={{ alignSelf: 'center' }}>
              {expanded ? t.showLess : t.showAll(filtered.length)}
            </Button>
          ) : null}
        </Stack>
      )}

      {editing ? (
        <AchievementDialog
          userGame={userGame}
          achievement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        eyebrow={userGame.game.name}
        title={t.deleteTitle}
        body={t.deleteBody}
        pending={remove.isPending}
        error={
          remove.isError ? getApiErrorMessage(remove.error, messages.library.serverErrors) : null
        }
        onConfirm={() => remove.mutate(deleting!.id, { onSuccess: () => setDeleting(null) })}
        onClose={() => setDeleting(null)}
      />
    </Section>
  );
}
