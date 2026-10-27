import { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  ScanFace,
  FileSpreadsheet,
  CalendarCheck,
  Home,
  Menu,
  X,
  Clock,
} from 'lucide-react';
import type { View } from '@/types';
import OverviewPage from '@/components/dashboard/pages/OverviewPage';
import StudentsPage from '@/components/dashboard/pages/StudentsPage';
import MonitoringPage from '@/components/dashboard/pages/MonitoringPage';
import ExcelPage from '@/components/dashboard/pages/ExcelPage';
import RecordsPage from '@/components/dashboard/pages/RecordsPage';

interface Props {
  view: View;
  onNavigate: (view: View) => void;
}

const navItems: { view: View; label: string; icon: typeof LayoutDashboard }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'students', label: 'Student List', icon: Users },
  { view: 'monitoring', label: 'Live Monitoring', icon: ScanFace },
  { view: 'excel', label: 'Excel Import', icon: FileSpreadsheet },
  { view: 'records', label: 'Attendance Records', icon: CalendarCheck },
];

export default function Dashboard({ view, onNavigate }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNavigate = useCallback((v: View) => {
    onNavigate(v);
    setSidebarOpen(false);
  }, [onNavigate]);

  const activeLabel = navItems.find((n) => n.view === view)?.label ?? 'Dashboard';

  const renderPage = () => {
    switch (view) {
      case 'students':
        return <StudentsPage />;
      case 'monitoring':
        return <MonitoringPage />;
      case 'excel':
        return <ExcelPage />;
      case 'records':
        return <RecordsPage />;
      default:
        return <OverviewPage onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-100">
          <button onClick={() => onNavigate('landing')} className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div className="text-left">
              <h1 className="font-bold text-gray-900 text-sm leading-tight">ICT12</h1>
              <p className="text-xs text-gray-500 leading-tight">Attendance & SMS</p>
            </div>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">
            Main Menu
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.view;
            return (
              <button
                key={item.view}
                onClick={() => handleNavigate(item.view)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={() => onNavigate('landing')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Home className="w-5 h-5 text-gray-400" />
            Back to Home
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{activeLabel}</h2>
                <p className="text-xs text-gray-500">
                  {currentTime.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl">
                <Clock className="w-4 h-4 text-brand-600" />
                <span className="text-sm font-semibold text-gray-700 tabular-nums">
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  })}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                <span className="text-sm font-bold text-brand-700">A</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 animate-fade-in">{renderPage()}</main>
      </div>
    </div>
  );
}
