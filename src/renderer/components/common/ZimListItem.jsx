import React from 'react';
import { Card, CardActionArea, Box, Typography, Chip } from '@mui/material';
import { 
  CheckCircle as CheckIcon, 
  Update as UpdateIcon, 
  MenuBook as BookIcon, 
  Verified as VerifiedIcon, 
  HelpOutline as UnknownIcon,
  ThumbUp as RecommendedIcon 
} from '@mui/icons-material';
import { formatBytes, formatDate } from '../../utils/formatters';
import { getScopeName } from '../../utils/constants';

/**
 * ZIM card item with selection state
 */
export default function ZimListItem({ zim, isSelected, onToggle, showUpdate = false, isRecommended = false, sx = {} }) {
  const getScopeDisplay = (scope) => {
    return getScopeName(scope);
  };

  const getTopicDisplay = (topic) => {
    if (!topic) return 'Wikipedia';
    if (topic === 'all') return 'All Topics';
    return topic.charAt(0).toUpperCase() + topic.slice(1);
  };

  return (
    <Card
      sx={{
        bgcolor: isSelected ? 'rgba(76, 175, 80, 0.1)' : (isRecommended ? 'rgba(33, 150, 243, 0.05)' : 'background.paper'),
        border: '2px solid',
        borderColor: isSelected 
          ? 'success.main' 
          : (isRecommended ? 'primary.main' : 'divider'),
        transition: 'all 0.2s ease',
        position: 'relative',
        '&:hover': {
          borderColor: isSelected 
            ? 'success.main' 
            : (isRecommended ? 'primary.main' : 'rgba(255, 255, 255, 0.3)'),
          transform: 'translateY(-1px)'
        },
        ...sx
      }}
    >
      <CardActionArea onClick={onToggle} sx={{ p: 1.5, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, height: '100%' }}>
          {/* Icon / Selection indicator */}
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: isSelected 
                ? 'success.main' 
                : (isRecommended ? 'primary.main' : 'action.hover'),
              flexShrink: 0
            }}
          >
            {isSelected ? (
              <CheckIcon sx={{ fontSize: 20, color: 'white' }} />
            ) : isRecommended ? (
              <RecommendedIcon sx={{ fontSize: 20, color: 'white' }} />
            ) : (
              <BookIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            )}
          </Box>

          {/* Content */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography 
              variant={isRecommended ? "subtitle1" : "body2"} 
              fontWeight={600} 
              noWrap={!isRecommended}
              sx={isRecommended ? { lineHeight: 1.2, mb: 0.5 } : {}}
            >
              {zim.valid !== false && zim.topic
                ? `${getTopicDisplay(zim.topic)} - ${getScopeDisplay(zim.scope)}`
                : zim.filename?.replace(/\.zim$/i, '') || 'ZIM File'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {zim.date ? formatDate(zim.date) : (zim.modified ? new Date(zim.modified).toLocaleDateString() : '')}
              {zim.articleCount && ` · ${zim.articleCount.toLocaleString()} articles`}
              {zim.language && ` · ${zim.language.toUpperCase()}`}
            </Typography>
          </Box>

          {/* Size and update badge */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
            {isRecommended && (
              <Chip
                label="Recommended"
                color="primary"
                size="small"
                sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700 }}
              />
            )}
            <Chip
              label={formatBytes(zim.size)}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: isSelected ? 'success.dark' : 'action.hover'
              }}
            />
            {showUpdate && zim.hasUpdate && (
              <Chip
                icon={<UpdateIcon sx={{ fontSize: '14px !important' }} />}
                label="Update Available"
                color="warning"
                size="small"
                sx={{ height: 22, fontSize: '0.65rem' }}
              />
            )}
            {showUpdate && zim.isUpToDate === true && (
              <Chip
                icon={<VerifiedIcon sx={{ fontSize: '14px !important' }} />}
                label="Up to Date"
                color="success"
                size="small"
                sx={{ height: 22, fontSize: '0.65rem' }}
              />
            )}
            {showUpdate && zim.isUpToDate === null && zim.valid !== false && (
              <Chip
                icon={<UnknownIcon sx={{ fontSize: '14px !important' }} />}
                label="Not in Catalog"
                size="small"
                sx={{ height: 22, fontSize: '0.65rem', bgcolor: 'action.hover' }}
              />
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}
