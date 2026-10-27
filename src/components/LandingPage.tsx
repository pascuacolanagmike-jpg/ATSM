import { useState, useEffect } from 'react';
import {
  GraduationCap,
  ScanFace,
  FileSpreadsheet,
  Clock,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  Users,
  Calendar,
  Menu,
  X,
} from 'lucide-react';
import type { View } from '@/types';

interface Props {
  onNavigate: (view: View) => void;
}

export default function LandingPage({ onNavigate }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    {
      icon: ScanFace,
      title: 'Live Face Matching',
      description: 'Real-time face recognition for automated attendance marking with instant identity verification.',
    },
    {
      icon: Clock,
      title: 'AM / PM Time Tracking',
      description: 'Precise time-in and time-out logging for both morning and afternoon sessions with live timer.',
    },
    {
      icon: FileSpreadsheet,
      title: 'Excel Import',
      description: 'Upload class lists in Excel format. The system reads tables and auto-formats attendance records.',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Comprehensive overview of attendance rates, late arrivals, and absences at a glance.',
    },
    {
      icon: Users,
      title: 'Student Management',
      description: 'Full student directory with profiles, photos, and attendance history per student.',
    },
    {
      icon: ShieldCheck,
      title: 'Secure & Reliable',
      description: 'Cloud-backed database ensures attendance records are always safe and accessible.',
    },
  ];

  const stats = [
    { value: '99.8%', label: 'Recognition Accuracy' },
    { value: '4', label: 'Daily Time Logs' },
    { value: '24/7', label: 'Cloud Access' },
    { value: '100+', label: 'Students Supported' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`font-bold text-lg leading-tight ${scrolled ? 'text-gray-900' : 'text-gray-900'}`}>
                ICT12
              </h1>
              <p className={`text-xs ${scrolled ? 'text-gray-500' : 'text-gray-600'}`}>
                Attendance Monitoring & SMS
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              How It Works
            </a>
            <a href="#stats" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Statistics
            </a>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-all shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/30"
            >
              Launch Dashboard
            </button>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">
            <a href="#features" className="block text-sm font-medium text-gray-600 hover:text-brand-600">
              Features
            </a>
            <a href="#how-it-works" className="block text-sm font-medium text-gray-600 hover:text-brand-600">
              How It Works
            </a>
            <a href="#stats" className="block text-sm font-medium text-gray-600 hover:text-brand-600">
              Statistics
            </a>
            <button
              onClick={() => onNavigate('dashboard')}
              className="w-full px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-lg"
            >
              Launch Dashboard
            </button>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-gray-50" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-brand-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-50 border border-brand-200 rounded-full text-brand-700 text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
              Next-Generation Attendance System
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
              ICT12 — Advance
              <span className="block text-brand-600">Attendance Monitoring</span>
              and SMS System
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
              A professional attendance management platform featuring live face recognition,
              AM/PM time tracking, Excel import, and real-time monitoring — built for the
              modern classroom.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => onNavigate('dashboard')}
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/25 hover:shadow-xl hover:shadow-brand-600/30 hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl transition-all hover:-translate-y-0.5"
              >
                Explore Features
              </a>
            </div>

            <div className="mt-10 flex items-center gap-6">
              {['Face Recognition', 'Excel Import', 'AM/PM Timer'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-500">
                  <CheckCircle2 className="w-4 h-4 text-brand-500" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative animate-fade-in">
            <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 overflow-hidden">
              {/* Mock dashboard preview */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Present', value: '42', color: 'bg-emerald-50 text-emerald-700' },
                  { label: 'Absent', value: '3', color: 'bg-red-50 text-red-700' },
                  { label: 'Late', value: '5', color: 'bg-amber-50 text-amber-700' },
                ].map((s) => (
                  <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs font-medium mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Live Monitoring</span>
                  <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Scanning
                  </span>
                </div>
                <div className="space-y-2">
                  {['Cruz, Maria', 'Reyes, Juan', 'Santos, Ana'].map((name, i) => (
                    <div key={name} className="flex items-center gap-3 bg-white rounded-lg p-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                        <ScanFace className="w-4 h-4 text-brand-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{name}</p>
                        <p className="text-xs text-gray-400">Match: 9{8 - i}%</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl" />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="py-16 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-extrabold text-white">{stat.value}</p>
                <p className="text-sm text-gray-400 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              Everything You Need to Track Attendance
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              A complete suite of tools designed for efficient and accurate attendance management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group p-6 bg-white border border-gray-100 rounded-2xl hover:border-brand-200 hover:shadow-xl hover:shadow-brand-50 transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-50 group-hover:bg-brand-600 flex items-center justify-center transition-colors duration-300">
                    <Icon className="w-6 h-6 text-brand-600 group-hover:text-white transition-colors duration-300" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-500">
              Three simple steps from enrollment to attendance tracking.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                step: '01',
                title: 'Enroll Students',
                description: 'Add students individually or import an entire class list via Excel upload.',
              },
              {
                icon: ScanFace,
                step: '02',
                title: 'Face Recognition',
                description: 'Live camera scans match student faces in real-time and log time-in or time-out.',
              },
              {
                icon: Calendar,
                step: '03',
                title: 'Track & Report',
                description: 'View comprehensive attendance records with AM/PM timing and export-ready reports.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative">
                  <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/20">
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      <span className="text-4xl font-extrabold text-gray-100">{item.step}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                    <p className="mt-3 text-sm text-gray-500 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-12 text-center overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">
                Ready to Modernize Attendance?
              </h2>
              <p className="mt-4 text-lg text-brand-100 max-w-xl mx-auto">
                Launch the dashboard and start tracking student attendance with face recognition today.
              </p>
              <button
                onClick={() => onNavigate('dashboard')}
                className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-brand-700 font-bold rounded-xl transition-all shadow-lg hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm text-gray-400">
                ICT12 — Advance Attendance Monitoring and SMS System
              </span>
            </div>
            <p className="text-sm text-gray-500">
              &copy; 2026 ICT12. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
