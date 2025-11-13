import React from 'react';
import { NavLink } from 'react-router-dom';
import useStore from '../store';

/**
 * Navigation Component
 *
 * Top navigation bar with tabs for different views
 */
function Navigation() {
  const { appVersion } = useStore();

  const tabs = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/zim-browser', label: 'ZIM Browser', icon: '📚' },
    { path: '/downloads', label: 'Downloads', icon: '⬇️' },
    { path: '/flash-usb', label: 'Flash USB', icon: '💾' },
    { path: '/updates', label: 'Updates', icon: '🔄' },
    { path: '/kiwix-reader', label: 'Kiwix Reader', icon: '📖' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <h1 style={styles.title}>Kiwix USB Updater</h1>
        <span style={styles.version}>v{appVersion}</span>
      </div>
      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            style={({ isActive }) => ({
              ...styles.tab,
              ...(isActive ? styles.tabActive : {}),
            })}
          >
            <span style={styles.icon}>{tab.icon}</span>
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    backgroundColor: '#2196f3',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
  },
  version: {
    fontSize: '12px',
    opacity: 0.7,
    padding: '4px 8px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
  },
  tabs: {
    display: 'flex',
    padding: '0 16px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: '500',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s ease',
    opacity: 0.8,
  },
  tabActive: {
    borderBottomColor: 'white',
    opacity: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  icon: {
    fontSize: '16px',
  },
};

export default Navigation;
