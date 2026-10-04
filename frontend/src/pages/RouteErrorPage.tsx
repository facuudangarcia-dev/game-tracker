import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { messages } from '../i18n/messages';

/** Fallback for unexpected errors thrown while rendering a route. */
export function RouteErrorPage() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined;

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Alert severity="error" variant="outlined">
        {messages.errors.unexpected}
        {detail ? ` (${detail})` : ''}
      </Alert>
    </Container>
  );
}
