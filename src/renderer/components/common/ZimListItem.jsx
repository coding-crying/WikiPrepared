import React from 'react';
import {
  ListItem,
  ListItemButton,
  Checkbox,
  ListItemText,
  Chip,
  Box,
  Typography
} from '@mui/material';
import { Update as UpdateIcon } from '@mui/icons-material';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getScopeName } from '../../utils/constants';

/**
 * ZIM list item with checkbox selection
 */
export default function ZimListItem({ zim, isSelected, onToggle, showUpdate = false }) {
  const getScopeDisplay = (scope) => {
    return getScopeName(scope);
  };

  const getTopicDisplay = (topic) => {
    // Capitalize and format topic
    if (topic === 'all') return 'All Topics';
    return topic.charAt(0).toUpperCase() + topic.slice(1);
  };

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showUpdate && zim.hasUpdate && (
            <Chip
              icon={<UpdateIcon />}
              label="Update Available"
              color="primary"
              size="small"
            />
          )}
          <Chip
            label={formatBytes(zim.size)}
            size="small"
            sx={{ minWidth: 80, fontWeight: 600 }}
          />
        </Box>
      }
    >
      <ListItemButton onClick={onToggle} dense>
        <Checkbox
          edge="start"
          checked={isSelected}
          tabIndex={-1}
          disableRipple
        />
        <ListItemText
          primary={
            <Typography variant="body1" fontWeight={500}>
              {getTopicDisplay(zim.topic)} - {getScopeDisplay(zim.scope)}
            </Typography>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {formatDate(zim.date)}
              {zim.articleCount && ` • ${zim.articleCount.toLocaleString()} articles`}
            </Typography>
          }
        />
      </ListItemButton>
    </ListItem>
  );
}
