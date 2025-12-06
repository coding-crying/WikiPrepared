import React from 'react';
import { Box, Button, Tooltip } from '@mui/material';
import { ArrowBack, ArrowForward } from '@mui/icons-material';

/**
 * Reusable navigation buttons for bottom of screens
 * Supports optional center content (like a storage bar) and tooltips for disabled states
 */
export default function NavigationButtons({
  onBack,
  onNext,
  backLabel = 'Back',
  nextLabel = 'Continue',
  backDisabled = false,
  nextDisabled = false,
  backDisabledTooltip = '',
  nextDisabledTooltip = '',
  showBack = true,
  showNext = true,
  nextVariant = 'contained',
  nextColor = 'primary',
  centerContent = null
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mt: 'auto',
        pt: 3,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      {showBack ? (
        <Tooltip
          title={backDisabled && backDisabledTooltip ? backDisabledTooltip : ''}
          arrow
          placement="top"
        >
          <span> {/* Wrapper needed for tooltip on disabled button */}
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={onBack}
              disabled={backDisabled}
              sx={{ flexShrink: 0 }}
            >
              {backLabel}
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Box sx={{ width: 100 }} /> /* Spacer */
      )}

      {/* Center content slot */}
      {centerContent}

      {showNext ? (
        <Tooltip
          title={nextDisabled && nextDisabledTooltip ? nextDisabledTooltip : ''}
          arrow
          placement="top"
        >
          <span> {/* Wrapper needed for tooltip on disabled button */}
            <Button
              variant={nextVariant}
              color={nextColor}
              endIcon={<ArrowForward />}
              onClick={onNext}
              disabled={nextDisabled}
              sx={{ flexShrink: 0 }}
            >
              {nextLabel}
            </Button>
          </span>
        </Tooltip>
      ) : (
        <Box sx={{ width: 100 }} /> /* Spacer */
      )}
    </Box>
  );
}
