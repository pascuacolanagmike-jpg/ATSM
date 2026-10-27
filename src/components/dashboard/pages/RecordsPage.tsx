import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  Download,
  Sun,
  Moon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatTime, calculateDuration, getStatusColor, todayDate } from '@/lib/utils';
import type { AttendanceWithStudent } from '@/types';
import * as XLSX from 'xlsx';

export default function RecordsPage() {
  const [records, setRecords] = useState<AttendanceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(todayDate());

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*, students:student_id(id, student_number, full_name, gender, section)')
      .eq('date', selectedDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading records:', error);
    }
    if (data) setRecords(data as unknown as AttendanceWithStudent[]);
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const filtered = records.filter((r) => {
    const name = r.students?.full_name?.toLowerCase() ?? '';
    const number = r.students?.student_number?.toLowerCase() ?? '';
    const matchesSearch = name.includes(search.toLowerCase()) || number.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const present = records.filter((r) => r.status === 'present').length;
  const late = records.filter((r) => r.status === 'late').length;
  const absent = records.filter((r) => r.status === 'absent').length;

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const exportExcel = () => {
    const exportData = filtered.map((r) => ({
      'Student Number': r.students?.student_number ?? '',
      'Full Name': r.students?.full_name ?? '',
      'Gender': r.students?.gender ?? '',
      'Section': r.students?.section ?? '',
      'Date': r.date,
      'Time In AM': formatTime(r.time_in_am),
      'Time Out AM': formatTime(r.time_out_am),
      'Time In PM': formatTime(r.time_in_pm),
      'Time Out PM': formatTime(r.time_out_pm),
      'AM Duration': calculateDuration(r.time_in_am, r.time_out_am),
      'PM Duration': calculateDuration(r.time_in_pm, r.time_out_pm),
      'Status': r.status,
      'Method': r.method,
      'Remarks': r.remarks ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Attendance ${selectedDate}`);
    XLSX.writeFile(wb, `ICT12_Attendance_${selectedDate}.xlsx`);
  };

  const isToday = selectedDate === todayDate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Attendance Records</h3>
          <p className="text-sm text-gray-500 mt-1">
            View and manage daily attendance with AM/PM time tracking
          </p>
        </div>
        <button
          onClick={exportExcel}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export to Excel
        </button>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4">
        <button
          onClick={() => shiftDate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <CalendarCheck className="w-5 h-5 text-brand-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {isToday && (
            <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full">
              Today
            </span>
          )}
        </div>
        <button
          onClick={() => shiftDate(1)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-brand-600" />
            </div>
            <span className="text-xs text-gray-500">Total Logged</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900 mt-2">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">Present</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2">{present}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">Late</span>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">{late}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-xs text-gray-500">Absent</span>
          </div>
          <p className="text-2xl font-extrabold text-red-600 mt-2">{absent}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search student name or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['all', 'present', 'late', 'absent', 'excused'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Records table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading records...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No attendance records for {selectedDate}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <Sun className="w-4 h-4 inline mb-0.5 text-amber-500" /> In
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <Sun className="w-4 h-4 inline mb-0.5 text-amber-500" /> Out
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <Moon className="w-4 h-4 inline mb-0.5 text-indigo-500" /> In
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">
                    <Moon className="w-4 h-4 inline mb-0.5 text-indigo-500" /> Out
                  </th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">AM Hours</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">PM Hours</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-brand-700">
                            {record.students?.full_name?.charAt(0) ?? '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{record.students?.full_name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400 font-mono">{record.students?.student_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-700 tabular-nums">
                      {formatTime(record.time_in_am)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-700 tabular-nums">
                      {formatTime(record.time_out_am)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-700 tabular-nums">
                      {formatTime(record.time_in_pm)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-700 tabular-nums">
                      {formatTime(record.time_out_pm)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-500 tabular-nums">
                      {calculateDuration(record.time_in_am, record.time_out_am)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm text-gray-500 tabular-nums">
                      {calculateDuration(record.time_in_pm, record.time_out_pm)}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 text-gray-500 capitalize">
                        {record.method}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
