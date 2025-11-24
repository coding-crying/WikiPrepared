import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffffff',
      light: '#ffffff',
      dark: '#b0b0b0',
      contrastText: '#1a1a1a'
    },
    secondary: {
      main: '#808080',
      light: '#a0a0a0',
      dark: '#606060'
    },
    success: {
      main: '#4ade80',
      light: '#6ee7a0',
      dark: '#22c55e'
    },
    warning: {
      main: '#fbbf24',
      light: '#fcd34d',
      dark: '#f59e0b'
    },
    error: {
      main: '#f87171',
      light: '#fca5a5',
      dark: '#ef4444'
    },
    info: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#3b82f6'
    },
    background: {
      default: '#000000',
      paper: '#1a1a1a'
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
      disabled: 'rgba(255, 255, 255, 0.4)'
    },
    divider: 'rgba(255, 255, 255, 0.12)'
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(','),
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      lineHeight: 1.3
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 600,
      lineHeight: 1.4
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.4
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.5
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.6
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43
    },
    button: {
      textTransform: 'none',
      fontWeight: 500
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '12px 28px',
          fontSize: '1rem'
        },
        sizeLarge: {
          padding: '16px 36px',
          fontSize: '1.1rem'
        },
        sizeSmall: {
          padding: '8px 18px',
          fontSize: '0.875rem'
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        },
        containedPrimary: {
          backgroundColor: '#ffffff',
          color: '#1a1a1a',
          '&:hover': {
            backgroundColor: '#e0e0e0'
          }
        },
        outlined: {
          borderColor: 'rgba(255, 255, 255, 0.3)',
          '&:hover': {
            borderColor: 'rgba(255, 255, 255, 0.6)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)'
          }
        }
      },
      defaultProps: {
        disableElevation: true
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#2d2d2d',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease-in-out'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundImage: 'none'
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        },
        elevation2: {
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        },
        elevation3: {
          boxShadow: '0 6px 12px rgba(0,0,0,0.4)'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.4)'
            }
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500
        }
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 8,
          backgroundColor: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }
      }
    }
  }
});

export default theme;
