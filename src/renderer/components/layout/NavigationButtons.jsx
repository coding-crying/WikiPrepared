import React from 'react';
import { Box, Button } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';

/**
 * Reusable navigation buttons for bottom of screens
 */
export default function NavigationButtons({
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Continue',
  backDisabled = false,
  nextDisabled = false,
  showBack = true,
  showNext = true,
  nextVariant = 'contained',
  nextColor = 'primary'
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 'auto',
        pt: 4,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      {showBack ? (
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={onBack}
          disabled={backDisabled}
        >
          {backLabel}
        </Button>
      ) : (
        <div /> /* Spacer */
      )}

      {showNext && (
        <Button
          variant={nextVariant}
          color={nextColor}
          endIcon={<ArrowForward />}
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel}
        </Button>
      )}
    </Box>
  );
}
