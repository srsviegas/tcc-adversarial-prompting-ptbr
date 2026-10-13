import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  IconButton,
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faXmark,
  faArrowLeft,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { SideBySideInspectionCard } from './SideBySideInspectionCard';

export function InspectionDetailModal({
  open,
  onClose,
  currentRow,
  currentIndex,
  totalCount,
  onNavigate,
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        onNavigate && onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight') {
        onNavigate && onNavigate(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, onNavigate]);

  if (!currentRow) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
            Inspection Detail — Row {currentRow.id + 1} of {totalCount}
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
        <SideBySideInspectionCard row={currentRow} />
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex <= 0}
            startIcon={<FontAwesomeIcon icon={faArrowLeft} />}
          >
            Previous
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => onNavigate(currentIndex + 1)}
            disabled={currentIndex >= totalCount - 1}
            endIcon={<FontAwesomeIcon icon={faArrowRight} />}
          >
            Next
          </Button>
        </Stack>

        <Button variant="contained" size="small" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
