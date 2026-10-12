import Box from '@mui/material/Box';
import { alpha } from '@mui/material/styles';
import { messages } from '../../i18n/messages';
import { difficultyColor } from './difficultyColor';
import { ink } from '../../theme/brand';

/** Lists longer than this show a single dot instead of one segment per level. */
const MAX_SEGMENTS = 8;

/** Colored segments, one per level of the list, filled up to this one. */
export function DifficultyMeter({ level, levels }: { level: number; levels: number }) {
  if (levels > MAX_SEGMENTS) {
    const color = difficultyColor(level, levels);
    return (
      <Box
        aria-hidden
        sx={{
          width: 8,
          height: 8,
          flexShrink: 0,
          borderRadius: '50%',
          bgcolor: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    );
  }
  return (
    <Box aria-hidden sx={{ display: 'inline-flex', gap: '2px', flexShrink: 0 }}>
      {Array.from({ length: levels }, (_, index) => (
        <Box
          key={index}
          sx={(theme) => ({
            width: 4,
            height: 10,
            borderRadius: 0.5,
            bgcolor: index <= level ? difficultyColor(index, levels) : alpha(ink(theme), 0.14),
          })}
        />
      ))}
    </Box>
  );
}

/**
 * A difficulty with its color and meter. Screen readers get "Normal (3 de 5)".
 */
export function DifficultyBadge({
  name,
  level,
  levels,
  size = 'medium',
}: {
  name: string;
  level: number;
  levels: number;
  size?: 'small' | 'medium';
}) {
  const color = difficultyColor(level, levels);
  const label = messages.library.difficultyLevel(name, level + 1, levels);
  return (
    <Box
      component="span"
      role="img"
      aria-label={label}
      title={label}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: '100%',
        px: size === 'small' ? 0.75 : 1,
        py: size === 'small' ? 0.125 : 0.25,
        borderRadius: 99,
        border: `1px solid ${color}`,
        bgcolor: `color-mix(in srgb, ${color} 18%, transparent)`,
        typography: size === 'small' ? 'caption' : 'body2',
        fontWeight: 700,
        lineHeight: 1.5,
        verticalAlign: 'middle',
      }}
    >
      <DifficultyMeter level={level} levels={levels} />
      <Box
        component="span"
        aria-hidden
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {name}
      </Box>
    </Box>
  );
}
