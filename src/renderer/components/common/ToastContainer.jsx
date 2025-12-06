import React from 'react';
import { Snackbar, Alert } from '@mui/material';
import { useToastStore } from '../../stores/toastStore';

/**
 * Global toast notification container
 * Displays toasts from the toast store
 */
export default function ToastContainer() {
  const { toasts, hideToast, removeToast } = useToastStore();

  const handleClose = (id) => (event, reason) => {
    if (reason === 'clickaway') return;
    hideToast(id);
  };

  const handleExited = (id) => {
    removeToast(id);
  };

  return (
    <>
      {toasts.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open={toast.open}
          autoHideDuration={toast.duration}
          onClose={handleClose(toast.id)}
          TransitionProps={{
            onExited: () => handleExited(toast.id)
          }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            // Stack multiple toasts
            bottom: `${24 + index * 70}px !important`
          }}
        >
          <Alert
            onClose={handleClose(toast.id)}
            severity={toast.severity}
            variant="filled"
            elevation={6}
            sx={{
              minWidth: 300,
              maxWidth: 500,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
