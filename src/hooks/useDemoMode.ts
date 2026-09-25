import { useState, useEffect, useCallback } from 'react';

const DEMO_MODE_KEY = 'dividendTracker_demoMode';

export const useDemoMode = () => {
  const [isDemoModeEnabled, setIsDemoModeEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(DEMO_MODE_KEY);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(DEMO_MODE_KEY, isDemoModeEnabled.toString());
  }, [isDemoModeEnabled]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoModeEnabled(prev => !prev);
  }, []);

  const enableDemoMode = useCallback(() => {
    setIsDemoModeEnabled(true);
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoModeEnabled(false);
  }, []);

  return {
    isDemoModeEnabled,
    toggleDemoMode,
    enableDemoMode,
    disableDemoMode
  };
};

// Standalone function to check demo mode without hook
export const getDemoModeEnabled = (): boolean => {
  const stored = localStorage.getItem(DEMO_MODE_KEY);
  return stored === 'true';
};
