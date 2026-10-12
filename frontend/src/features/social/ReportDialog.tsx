import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import Alert from '@mui/material/Alert';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { FormDialog } from '../../components/FormDialog';
import { messages } from '../../i18n/messages';
import { getApiErrorMessage } from '../../lib/api/errors';
import { type ReportReason, useReport } from './api';

const REASONS: ReportReason[] = ['AVATAR', 'USERNAME', 'OTHER'];
const DETAILS_MAX_LENGTH = 500;

/** Reports a user's avatar or username to the administrator (decision #87). */
export function ReportDialog({ username, onClose }: { username: string; onClose: () => void }) {
  const t = messages.social.report;
  const report = useReport();
  const [reason, setReason] = useState<ReportReason>('AVATAR');
  const [details, setDetails] = useState('');

  return (
    <FormDialog
      open
      title={t.title(username)}
      icon={<FlagOutlinedIcon />}
      submitLabel={report.isSuccess ? messages.common.close : t.submit}
      submitColor={report.isSuccess ? 'primary' : 'error'}
      pending={report.isPending}
      error={report.isError ? getApiErrorMessage(report.error, t.errors) : null}
      onClose={onClose}
      onSubmit={() =>
        report.isSuccess
          ? onClose()
          : report.mutate({ username, reason, details: details.trim() || null })
      }
    >
      {report.isSuccess ? (
        <Alert severity="success" variant="outlined">
          {t.sent}
        </Alert>
      ) : (
        <>
          <Typography color="text.secondary">{t.body}</Typography>
          <RadioGroup
            aria-label={t.reason}
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
          >
            {REASONS.map((value) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio />}
                label={t.reasons[value]}
              />
            ))}
          </RadioGroup>
          <TextField
            label={t.details}
            multiline
            minRows={2}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            slotProps={{ htmlInput: { maxLength: DETAILS_MAX_LENGTH } }}
          />
        </>
      )}
    </FormDialog>
  );
}
