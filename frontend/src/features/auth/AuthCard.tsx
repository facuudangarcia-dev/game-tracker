import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { FormEvent, ReactNode } from 'react';

interface AuthCardProps {
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}

/** Centered card with a form, shared by login, register and email verification. */
export function AuthCard({ title, onSubmit, children }: AuthCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ maxWidth: 420, mx: 'auto', mt: { xs: 2, md: 6 }, p: { xs: 3, sm: 4 } }}
    >
      <Stack component="form" spacing={2.5} noValidate onSubmit={onSubmit}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {children}
      </Stack>
    </Paper>
  );
}
