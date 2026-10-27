import { useState, useEffect, useCallback } from 'react';
import type { View } from '@/types';
import LandingPage from '@/components/LandingPage';
import Dashboard from '@/components/dashboard/Dashboard';

export default function App() {
  const [view, setView] = useState<View>('landing');

  const navigate = useCallback((v: View) => {
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'dashboard' || hash === 'students' || hash === 'monitoring' || hash === 'excel' || hash === 'records') {
        setView(hash as View);
      } else {
        setView('landing');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (view === 'landing') {
    return <LandingPage onNavigate={navigate} />;
  }

  return <Dashboard view={view} onNavigate={navigate} />;
}
