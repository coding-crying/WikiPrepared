import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { Update as UpdateIcon, Add as AddIcon } from '@mui/icons-material';
import { useAppFlowStore } from '../stores/appFlowStore';
import AppLayout from '../components/layout/AppLayout';
import { USER_INTENTS, ROUTES } from '../utils/constants';

/**
 * Step 1: Initial choice screen
 * User chooses between updating existing stick or creating new one
 */
export default function InitialChoiceScreen() {
  const navigate = useNavigate();
  const setUserIntent = useAppFlowStore(state => state.setUserIntent);

  const handleChoice = (intent) => {
    setUserIntent(intent);
    navigate(ROUTES.DRIVE_SELECTION);
  };

  const choices = [
    {
      intent: USER_INTENTS.UPDATE,
      icon: UpdateIcon,
      title: 'Update Existing Stick',
      description: 'Update ZIM files and readers on an existing Wikipedia USB stick',
      color: 'primary.main'
    },
    {
      intent: USER_INTENTS.CREATE_NEW,
      icon: AddIcon,
      title: 'Create New Stick',
      description: 'Set up a fresh Wikipedia USB stick from scratch',
      color: 'success.main'
    }
  ];

  return (
    <AppLayout
      title="WikiPrepared"
      subtitle="Create Your Offline Wikipedia USB Stick"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 600,
          mx: 'auto',
          flex: 1,
          justifyContent: 'center'
        }}
      >
        {choices.map(({ intent, icon: Icon, title, description, color }) => (
          <Card
            key={intent}
            sx={{
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: 6
              }
            }}
            onClick={() => handleChoice(intent)}
          >
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Icon sx={{ fontSize: 64, color, mb: 2 }} />
              <Typography variant="h5" gutterBottom fontWeight={600}>
                {title}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </AppLayout>
  );
}
