/** Responsive poster grid, same rhythm as "Mis juegos". */
export const POSTER_GRID_SX = {
  display: 'grid',
  gap: { xs: 1.5, sm: 2 },
  gridTemplateColumns: {
    xs: 'repeat(2, minmax(0, 1fr))',
    sm: 'repeat(auto-fill, minmax(165px, 1fr))',
  },
} as const;
