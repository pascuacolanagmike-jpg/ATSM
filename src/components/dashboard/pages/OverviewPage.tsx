import { useState, useEffect } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  ArrowRight,
  ScanFace,
  FileSpreadsheet,
  CalendarCheck,
  GraduationCap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayDate, formatTime, getStatusColor } from '@/lib/utils';
import type { Student, AttendanceWithStudent } from '@/types';
import type { View } from '@/types';

interface Props {
  onNavigate: (view: View) => void;
}

export default function OverviewPage({ onNavigate }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [todayRecords, setTodayRecords] = useState<AttendanceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const today = todayDate();
    const [studentsRes, attendanceRes] = await Promise.all([
      supabase.from('students').select('*').order('full_name'),
      supabase
        .from('attendance_records')
        .select('*, students:student_id(id, student_number, full_name, gender, section)')
        .eq('date', today)
        .order('created_at', { ascending: false }),
    ]);

    if (studentsRes.data) setStudents(studentsRes.data);
    if (attendanceRes.data) setTodayRecords(attendanceRes.data as unknown as AttendanceWithStudent[]);
    setLoading(false);
  };

  const totalStudents = students.length;
  const presentToday = todayRecords.filter((r) => r.status === 'present').length;
  const absentToday = todayRecords.filter((r) => r.status === 'absent').length;
  const lateToday = todayRecords.filter((r) => r.status === 'late').length;
  const notLogged = totalStudents - todayRecords.length;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  const quickActions = [
    { view: 'monitoring' as View, label: 'Start Live Monitoring', icon: ScanFace, color: 'bg-brand-600' },
    { view: 'excel' as View, label: 'Import Excel File', icon: FileSpreadsheet, color: 'bg-emerald-600' },
    { view: 'students' as View, label: 'Manage Students', icon: Users, color: 'bg-violet-600' },
    { view: 'records' as View, label: 'View Records', icon: CalendarCheck, color: 'bg-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/2" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome back, Admin</h2>
            <p className="mt-1 text-brand-100">
              Here's the attendance summary for today, {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Students"
          value={loading ? '...' : String(totalStudents)}
          color="brand"
        />
        <StatCard
          icon={CheckCircle2}
          label="Present Today"
          value={loading ? '...' : String(presentToday)}
          color="emerald"
        />
        <StatCard
          icon={XCircle}
          label="Absent Today"
          value={loading ? '...' : String(absentToday + notLogged)}
          color="red"
        />
        <StatCard
          icon={Clock}
          label="Late Today"
          value={loading ? '...' : String(lateToday)}
          color="amber"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="group p-5 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all text-left"
              >
                <div className={`w-11 h-11 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-800">{action.label}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400 group-hover:text-brand-600 transition-colors">
                  Open
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two-column area */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Attendance rate */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Attendance Rate</h3>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="flex items-center justify-center my-6">
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#0c8ee7"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(attendanceRate / 100) * 314} 314`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-gray-900">{attendanceRate}%</span>
                <span className="text-xs text-gray-400">Present</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Present</span>
              <span className="font-semibold text-emerald-600">{presentToday}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Late</span>
              <span className="font-semibold text-amber-600">{lateToday}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Absent / Not logged</span>
              <span className="font-semibold text-red-600">{absentToday + notLogged}</span>
            </div>
          </div>
        </div>

        {/* Today's activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900">Today's Activity</h3>
            <button
              onClick={() => onNavigate('records')}
              className="text-sm text-brand-600 font-medium hover:underline"
            >
              View All
            </button>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading...</div>
          ) : todayRecords.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No attendance logged yet today.</p>
              <button
                onClick={() => onNavigate('monitoring')}
                className="mt-4 px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 transition-colors"
              >
                Start Monitoring
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {todayRecords.slice(0, 10).map((record) => (
                <div key={record.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-brand-700">
                      {record.students?.full_name?.charAt(0) ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {record.students?.full_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {record.students?.student_number}
                    </p>
                  </div>
                  <div className="text-right text-xs space-y-0.5">
                    <p className="text-gray-500">
                      AM In: <span className="font-semibold text-gray-700">{formatTime(record.time_in_am)}</span>
                    </p>
                    <p className="text-gray-500">
                      PM In: <span className="font-semibold text-gray-700">{formatTime(record.time_in_pm)}</span>
                    </p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(record.status)}`}>
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  color: 'brand' | 'emerald' | 'red' | 'amber';
}) {
  const colorMap = {
    brand: { bg: 'bg-brand-50', text: 'text-brand-600' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    red: { bg: 'bg-red-50', text: 'text-red-600' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      <p className="text-2xl font-extrabold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}
