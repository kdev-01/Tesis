import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import { nanoid } from 'nanoid';

const ToastContext = createContext();

const initialState = [];

const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD':
      return [...state, action.payload];
    case 'REMOVE':
      return state.filter((toast) => toast.id !== action.payload);
    case 'CLEAR':
      return [];
    default:
      return state;
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, dispatch] = useReducer(reducer, initialState);

  const addToast = useCallback((toast) => {
    const id = toast.id ?? nanoid();
    dispatch({ type: 'ADD', payload: { ...toast, id } });
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    dispatch({ type: 'REMOVE', payload: id });
  }, []);

  const clearToasts = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const value = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      clearToasts,
    }),
    [toasts, addToast, removeToast, clearToasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export const useToastContext = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastContext debe usarse dentro de ToastProvider');
  }
  return context;
};
