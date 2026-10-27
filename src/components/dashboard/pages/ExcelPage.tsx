import { useState, useCallback } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  FileUp,
  X,
  Table,
  ArrowRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { todayDate } from '@/lib/utils';

interface ParsedRow {
  student_number: string;
  full_name: string;
  gender?: string;
  section?: string;
  email?: string;
  phone?: string;
  date?: string;
  time_in_am?: string;
  time_out_am?: string;
  time_in_pm?: string;
  time_out_pm?: string;
  status?: string;
}

export default function ExcelPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ students: number; attendance: number } | null>(null);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setError('');
    setParsedData([]);
    setImportResult(null);
    setSheetNames([]);

    try {
      const buffer = await f.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      setSheetNames(workbook.SheetNames);

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      setActiveSheet(workbook.SheetNames[0]);
      const rows = parseSheet(firstSheet);
      setParsedData(rows);
    } catch {
      setError('Failed to read the Excel file. Please ensure it is a valid .xlsx or .csv file.');
    }
  }, []);

  const parseSheet = (sheet: XLSX.WorkSheet): ParsedRow[] => {
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return json.map((row) => {
      const keys = Object.keys(row);
      const get = (patterns: string[]): string => {
        for (const k of keys) {
          for (const p of patterns) {
            if (k.toLowerCase().includes(p.toLowerCase())) {
              return String(row[k] ?? '').trim();
            }
          }
        }
        return '';
      };

      return {
        student_number: get(['student number', 'student_number', 'id', 'lrn', 'number']),
        full_name: get(['full name', 'full_name', 'name', 'student name']),
        gender: get(['gender', 'sex']) || 'Male',
        section: get(['section', 'class', 'grade']) || 'ICT12',
        email: get(['email', 'e-mail']),
        phone: get(['phone', 'mobile', 'contact', 'number']),
        date: get(['date', 'attendance date']),
        time_in_am: get(['time in am', 'time_in_am', 'am in', 'morning in']),
        time_out_am: get(['time out am', 'time_out_am', 'am out', 'morning out']),
        time_in_pm: get(['time in pm', 'time_in_pm', 'pm in', 'afternoon in']),
        time_out_pm: get(['time out pm', 'time_out_pm', 'pm out', 'afternoon out']),
        status: get(['status', 'attendance status']) || 'present',
      };
    }).filter((r) => r.student_number || r.full_name);
  };

  const handleSheetChange = (sheetName: string, f: File) => {
    setActiveSheet(sheetName);
    f.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rows = parseSheet(workbook.Sheets[sheetName]);
      setParsedData(rows);
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setImporting(true);
    setError('');

    try {
      let studentsAdded = 0;
      let attendanceAdded = 0;

      for (const row of parsedData) {
        if (!row.student_number || !row.full_name) continue;

        // Upsert student
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('student_number', row.student_number)
          .maybeSingle();

        let studentId = existing?.id;

        if (!studentId) {
          const { data: newStudent, error: insertErr } = await supabase
            .from('students')
            .insert({
              student_number: row.student_number,
              full_name: row.full_name,
              gender: row.gender || 'Male',
              section: row.section || 'ICT12',
              email: row.email || null,
              phone: row.phone || null,
              status: 'active',
            })
            .select('id')
            .single();

          if (insertErr) continue;
          studentId = newStudent?.id;
          studentsAdded++;
        }

        if (!studentId) continue;

        // Check if attendance data exists
        const hasAttendance = row.date || row.time_in_am || row.time_out_am || row.time_in_pm || row.time_out_pm;
        if (hasAttendance) {
          const dateStr = row.date || todayDate();

          const parseTime = (timeStr: string, baseDate: string): string | null => {
            if (!timeStr) return null;
            try {
              const d = new Date(`${baseDate}T${timeStr}`);
              if (isNaN(d.getTime())) return null;
              return d.toISOString();
            } catch {
              return null;
            }
          };

          const { data: existingAtt } = await supabase
            .from('attendance_records')
            .select('id')
            .eq('student_id', studentId)
            .eq('date', dateStr)
            .maybeSingle();

          if (!existingAtt) {
            const { error: attErr } = await supabase
              .from('attendance_records')
              .insert({
                student_id: studentId,
                date: dateStr,
                time_in_am: parseTime(row.time_in_am || '', dateStr),
                time_out_am: parseTime(row.time_out_am || '', dateStr),
                time_in_pm: parseTime(row.time_in_pm || '', dateStr),
                time_out_pm: parseTime(row.time_out_pm || '', dateStr),
                status: row.status || 'present',
                method: 'excel',
              });

            if (!attErr) attendanceAdded++;
          }
        }
      }

      setImportResult({ students: studentsAdded, attendance: attendanceAdded });
    } catch {
      setError('An error occurred during import. Please try again.');
    }

    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Student Number': '2026-001',
        'Full Name': 'Juan Dela Cruz',
        'Gender': 'Male',
        'Section': 'ICT12',
        'Email': 'juan@school.edu',
        'Phone': '+63 912 345 6789',
        'Date': todayDate(),
        'Time In AM': '08:00',
        'Time Out AM': '12:00',
        'Time In PM': '13:00',
        'Time Out PM': '17:00',
        'Status': 'present',
      },
      {
        'Student Number': '2026-002',
        'Full Name': 'Maria Santos',
        'Gender': 'Female',
        'Section': 'ICT12',
        'Email': 'maria@school.edu',
        'Phone': '+63 917 123 4567',
        'Date': todayDate(),
        'Time In AM': '08:05',
        'Time Out AM': '12:00',
        'Time In PM': '13:02',
        'Time Out PM': '17:00',
        'Status': 'late',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Template');
    XLSX.writeFile(wb, 'ICT12_Attendance_Template.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Excel Import</h3>
          <p className="text-sm text-gray-500 mt-1">
            Upload an Excel file to import students and attendance records
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>
      </div>

      {/* Upload zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <FileUp className="w-8 h-8 text-brand-600" />
          </div>
          <p className="text-base font-semibold text-gray-800">Drop your Excel file here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse — supports .xlsx and .csv</p>
          <label className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl cursor-pointer transition-colors shadow-md shadow-brand-600/20">
            <Upload className="w-4 h-4" />
            Browse Files
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </div>
      )}

      {/* File preview */}
      {file && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB • {parsedData.length} rows detected
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setParsedData([]);
                  setSheetNames([]);
                  setImportResult(null);
                }}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sheet tabs */}
            {sheetNames.length > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                <Table className="w-4 h-4 text-gray-400" />
                {sheetNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSheetChange(name, file)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      activeSheet === name
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Import result */}
          {importResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4 animate-slide-up">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Import Complete</p>
                <p className="text-sm text-emerald-600 mt-1">
                  {importResult.students} new students added, {importResult.attendance} attendance records imported.
                </p>
              </div>
            </div>
          )}

          {/* Preview table */}
          {parsedData.length > 0 && !importResult && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h4 className="font-bold text-gray-900 text-sm">Data Preview ({parsedData.length} rows)</h4>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {importing ? 'Importing...' : 'Import to System'}
                  {!importing && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="sticky top-0">
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Student #', 'Full Name', 'Gender', 'Section', 'Date', 'AM In', 'AM Out', 'PM In', 'PM Out', 'Status'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {parsedData.slice(0, 50).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-gray-700 font-mono">{row.student_number || '--'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">{row.full_name || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.gender || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.section || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.date || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.time_in_am || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.time_out_am || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.time_in_pm || '--'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{row.time_out_pm || '--'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600">
                            {row.status || '--'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 50 && (
                <div className="px-5 py-3 text-xs text-gray-400 text-center border-t border-gray-100">
                  Showing first 50 of {parsedData.length} rows
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
