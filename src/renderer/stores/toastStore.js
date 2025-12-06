import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Toast notification store
 * Manages global toast/snackbar notifications
 */
export const useToastStore = create(
  devtools(
    (set) => ({
      toasts: [],

      /**
       * Show a toast notification
       * @param {string} message - Toast message
       * @param {string} severity - 'success' | 'error' | 'warning' | 'info'
       * @param {number} duration - Auto-hide duration in ms (default 6000)
       */
      showToast: (message, severity = 'info', duration = 6000) => {
        const id = Date.now() + Math.random();
        set((state) => ({
          toasts: [...state.toasts, { id, message, severity, duration, open: true }]
        }));
      },

      /**
       * Hide a specific toast
       * @param {number} id - Toast ID
       */
      hideToast: (id) => {
        set((state) => ({
          toasts: state.toasts.map((toast) =>
            toast.id === id ? { ...toast, open: false } : toast
          )
        }));
      },

      /**
       * Remove a toast from the array (after exit animation)
       * @param {number} id - Toast ID
       */
      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((toast) => toast.id !== id)
        }));
      },

      // Convenience methods
      success: (message, duration) => {
        set((state) => {
          state.showToast(message, 'success', duration);
          return state;
        });
      },

      error: (message, duration) => {
        set((state) => {
          state.showToast(message, 'error', duration);
          return state;
        });
      },

      warning: (message, duration) => {
        set((state) => {
          state.showToast(message, 'warning', duration);
          return state;
        });
      },

      info: (message, duration) => {
        set((state) => {
          state.showToast(message, 'info', duration);
          return state;
        });
      }
    }),
    { name: 'ToastStore' }
  )
);
