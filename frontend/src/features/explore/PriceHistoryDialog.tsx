import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import { DialogFooter, DialogHeader } from '../../components/DialogChrome';
import { messages } from '../../i18n/messages';
import { dialogPaperSx } from '../../theme/brand';
import { usePriceHistory } from './api';
import { formatMoney, formatShortDate } from './format';
import type { WishlistItem } from './types';

const t = messages.wishlist;

/**
 * Real price changes recorded by the source in the last year (newest first).
 * When the source has none, it says so: nothing is drawn or estimated.
 */
export function PriceHistoryDialog({ item, onClose }: { item: WishlistItem; onClose: () => void }) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'));
  const history = usePriceHistory(item.id);
  const points = [...(history.data?.points ?? [])].reverse();
  const lowest = points.reduce<number | null>(
    (min, point) => (min === null || point.price.amount < min ? point.price.amount : min),
    null,
  );

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="sm"
      aria-labelledby="price-history-title"
      slotProps={{ paper: { sx: (theme) => dialogPaperSx(theme, fullScreen) } }}
    >
      <DialogHeader
        titleId="price-history-title"
        title={t.history}
        eyebrow={item.game.name}
        icon={<ShowChartIcon />}
        onClose={onClose}
      />
      <Box sx={{ px: 3, py: 2.5 }}>
        {history.isPending ? (
          <Skeleton variant="rounded" height={160} />
        ) : history.isError || !history.data.available ? (
          <Alert severity="warning" variant="outlined">
            {messages.wishlist.pricesUnavailable}
          </Alert>
        ) : points.length === 0 ? (
          <Typography color="text.secondary">{t.historyEmpty}</Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t.historyNote}
            </Typography>
            <Box sx={{ maxHeight: 360, overflow: 'auto' }}>
              <Table size="small" aria-label={t.historyTitle(item.game.name)} stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>{t.historyColumns.date}</TableCell>
                    <TableCell>{t.historyColumns.shop}</TableCell>
                    <TableCell align="right">{t.historyColumns.price}</TableCell>
                    <TableCell align="right">{t.historyColumns.cut}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {points.map((point) => (
                    <TableRow key={`${point.timestamp}-${point.shop.id}`}>
                      <TableCell>{formatShortDate(point.timestamp)}</TableCell>
                      <TableCell>{point.shop.name}</TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontWeight: point.price.amount === lowest ? 900 : 500,
                          color: point.price.amount === lowest ? 'success.light' : undefined,
                        }}
                      >
                        {formatMoney(point.price)}
                      </TableCell>
                      <TableCell align="right">
                        {point.cut !== null && point.cut > 0 ? `−${point.cut}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </>
        )}
      </Box>
      <DialogFooter>
        <Button onClick={onClose}>{messages.common.close}</Button>
      </DialogFooter>
    </Dialog>
  );
}
