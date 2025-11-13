import React, { useEffect } from 'react';
import useStore from '../store';

/**
 * Notifications Component
 *
 * Toast-style notifications for app events
 */
function Notifications() {
  const { notifications, removeNotification } = useStore();

  return (
    <div style={styles.container}>
      {notifications.map((notification) => (
        <Notification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

function Notification({ notification, onClose }) {
  const { type, message, details, duration = 5000 } = notification;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#4caf50', icon: '✓' };
      case 'error':
        return { backgroundColor: '#f44336', icon: '✕' };
      case 'warning':
        return { backgroundColor: '#ff9800', icon: '⚠' };
      case 'info':
      default:
        return { backgroundColor: '#2196f3', icon: 'ℹ' };
    }
  };

  const typeStyles = getTypeStyles();

  return (
    <div
      style={{
        ...styles.notification,
        backgroundColor: typeStyles.backgroundColor,
      }}
    >
      <div style={styles.icon}>{typeStyles.icon}</div>
      <div style={styles.content}>
        <div style={styles.message}>{message}</div>
        {details && <div style={styles.details}>{details}</div>}
      </div>
      <button style={styles.closeButton} onClick={onClose}>
        ×
      </button>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: '80px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '400px',
  },
  notification: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    borderRadius: '8px',
    color: 'white',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    animation: 'slideIn 0.3s ease-out',
  },
  icon: {
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  message: {
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
  },
  details: {
    fontSize: '12px',
    opacity: 0.9,
    wordBreak: 'break-word',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '24px',
    height: '24px',
    flexShrink: 0,
    opacity: 0.8,
  },
};

export default Notifications;
