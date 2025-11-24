import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';

/**
 * Step progress indicator for wizard flow
 */
export default function StepIndicator({ currentStep, steps }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;
        const isUpcoming = stepNum > currentStep;

        return (
          <React.Fragment key={step.id}>
            {/* Step circle */}
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isCompleted ? 'success.main' : isCurrent ? 'primary.main' : 'transparent',
                border: '2px solid',
                borderColor: isCompleted ? 'success.main' : isCurrent ? 'primary.main' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
                flexShrink: 0
              }}
            >
              {isCompleted ? (
                <CheckIcon sx={{ fontSize: 16, color: 'success.contrastText' }} />
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isCurrent ? 'primary.contrastText' : 'rgba(255,255,255,0.5)'
                  }}
                >
                  {stepNum}
                </Typography>
              )}
            </Box>

            {/* Step label (only show for current step on small screens) */}
            {isCurrent && (
              <Typography
                variant="caption"
                sx={{
                  color: 'text.primary',
                  fontWeight: 500,
                  display: { xs: 'block', sm: 'block' },
                  whiteSpace: 'nowrap'
                }}
              >
                {step.label}
              </Typography>
            )}

            {/* Connector line */}
            {index < steps.length - 1 && (
              <Box
                sx={{
                  flex: { xs: 0, sm: 1 },
                  height: 2,
                  minWidth: { xs: 8, sm: 20 },
                  maxWidth: 60,
                  bgcolor: isCompleted ? 'success.main' : 'rgba(255,255,255,0.2)',
                  transition: 'background-color 0.3s ease'
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
