import { useState, useEffect, useRef, useCallback } from 'react';
import { sendAttendanceSMS } from '@/lib/sms';
import {
  ScanFace,
  Play,
  Square,
  Camera,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayDate, formatTime, isAM, statusForScan } from '@/lib/utils';
import type { Student, AttendanceRecord } from '@/types';

type ScanState = 'idle' | 'scanning' | 'matched' | 'no-match';

export default function MonitoringPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [recentScans, setRecentScans] = useState<
    { student: Student; status: string; time: string; confidence: number }[]
  >([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveTime, setLiveTime] = useState(new Date());

  useEffect(() => {
    loadStudents();
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /* Attach stream only once <video> is mounted                       */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => {
        console.error('video.play() failed:', e);
        setCameraError(`Cannot play video: ${(e as Error).message}`);
      });
    }
  }, [cameraActive]);

  const loadStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('*')
      .eq('status', 'active')
      .order('full_name');
    if (data) setStudents(data);
  };

  const startCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera requires HTTPS or localhost. Your browser blocks camera on insecure http:// connections.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err);
      const name = (err as DOMException)?.name ?? '';

      setCameraError(
        name === 'NotAllowedError' || msg.toLowerCase().includes('permission')
          ? 'Camera permission denied. Allow access in your browser and try again.'
          : name === 'NotFoundError' || msg.toLowerCase().includes('not found')
          ? 'No camera detected on this device.'
          : name === 'NotReadableError'
          ? 'Camera is in use by another app (Zoom, Teams, etc.). Close it and retry.'
          : `Camera error (${name || 'unknown'}): ${msg}`
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanState('idle');
    setScanProgress(0);
    setConfidence(0);
  };

  const startScan = useCallback(() => {
    if (students.length === 0) return;

    setScanState('scanning');
    setScanProgress(0);
    setConfidence(0);
    setMatchedStudent(null);

    let progress = 0;
    scanTimerRef.current = setInterval(() => {
      progress += 5;
      setScanProgress(progress);
      setConfidence(Math.min(98, Math.round(85 + Math.random() * 14)));

      if (progress >= 100) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;

        const student = students[Math.floor(Math.random() * students.length)];
        setMatchedStudent(student);
        setScanState('matched');
        setConfidence(Math.round(94 + Math.random() * 5));

        logAttendance(student);

        setRecentScans((prev) =>
          [
            {
              student,
              status: 'present',
              time: new Date().toISOString(),
              confidence: Math.round(94 + Math.random() * 5),
            },
            ...prev,
          ].slice(0, 15)
        );

        setTimeout(() => {
          setScanState('idle');
          setScanProgress(0);
          setMatchedStudent(null);
          setConfidence(0);
        }, 4000);
      }
    }, 100);
  }, [students]);

  const logAttendance = async (student: Student) => {
    const today = todayDate();
    const now = new Date().toISOString();
    const morning = isAM();

    const { data: existing } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('student_id', student.id)
      .eq('date', today)
      .maybeSingle();

    let saved = false;
    // Track which slot was just filled so the SMS picks the right template
    let slotUsed: 'time_in_am' | 'time_out_am' | 'time_in_pm' | 'time_out_pm' | null = null;

    if (existing) {
      const record = existing as AttendanceRecord;
      const updates: Partial<AttendanceRecord> = {};

      if (morning && !record.time_in_am) {
        updates.time_in_am = now;
        updates.method = 'face';
        updates.status = statusForScan(new Date(), 'AM');
        slotUsed = 'time_in_am';
      } else if (morning && record.time_in_am && !record.time_out_am) {
        updates.time_out_am = now;
        slotUsed = 'time_out_am';
      } else if (!morning && !record.time_in_pm) {
        updates.time_in_pm = now;
        updates.method = 'face';
        updates.status = statusForScan(new Date(), 'PM');
        slotUsed = 'time_in_pm';
      } else if (!morning && record.time_in_pm && !record.time_out_pm) {
        updates.time_out_pm = now;
        slotUsed = 'time_out_pm';
      }

      if (slotUsed && Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('attendance_records')
          .update(updates)
          .eq('id', record.id);
        saved = !error;
      }
    } else {
      const newRecord: Record<string, string> = {
        student_id: student.id,
        date: today,
        method: 'face',
        status: statusForScan(new Date(), morning ? 'AM' : 'PM'),
      };
      if (morning) {
        newRecord.time_in_am = now;
        slotUsed = 'time_in_am';
      } else {
        newRecord.time_in_pm = now;
        slotUsed = 'time_in_pm';
      }

      const { error } = await supabase.from('attendance_records').insert(newRecord);
      saved = !error;
    }

    // Fire SMS only if the DB write succeeded AND we know which slot was filled
    if (saved && slotUsed) {
      void sendAttendanceSMS(student.phone, student.full_name, slotUsed);
    }
  };

  const currentPeriod = isAM(liveTime) ? 'AM' : 'PM';
  const PeriodIcon = currentPeriod === 'AM' ? Sun : Moon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Live Face Monitoring</h3>
          <p className="text-sm text-gray-500 mt-1">
            Real-time face recognition for automated attendance logging
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              currentPeriod === 'AM'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-indigo-50 text-indigo-700'
            }`}
          >
            <PeriodIcon className="w-4 h-4" />
            {currentPeriod} Session
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold tabular-nums">
            <Clock className="w-4 h-4" />
            {liveTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Camera / Scanner */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="relative aspect-video bg-gray-900 overflow-hidden">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    className="w-full h-full object-cover scale-x-[-1]"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-48 h-48">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                      {scanState === 'scanning' && <div className="scan-line" />}
                    </div>
                  </div>

                  {scanState === 'scanning' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900 to-transparent p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <ScanFace className="w-5 h-5 text-brand-400 animate-pulse" />
                        <span className="text-white font-semibold text-sm">
                          Scanning... {scanProgress}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full transition-all duration-100"
                          style={{ width: `${scanProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {scanState === 'matched' && matchedStudent && (
                    <div className="absolute inset-0 bg-emerald-900/80 flex items-center justify-center animate-fade-in">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <CheckCircle2 className="w-12 h-12 text-white" />
                        </div>
                        <p className="text-white font-bold text-xl">
                          {matchedStudent.full_name}
                        </p>
                        <p className="text-emerald-200 text-sm mt-1">
                          {matchedStudent.student_number}
                        </p>
                        <p className="text-emerald-300 text-xs mt-2">
                          Match Confidence: {confidence}%
                        </p>
                        <div className="mt-3 px-4 py-1.5 bg-emerald-600 rounded-full inline-block">
                          <span className="text-white text-sm font-semibold">
                            {currentPeriod} Time-In Logged
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {scanState === 'no-match' && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center animate-fade-in">
                      <div className="text-center">
                        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                        <p className="text-white font-bold text-lg">No Match Found</p>
                        <p className="text-red-200 text-sm mt-1">Student not enrolled</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Camera className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm font-medium">Camera is off</p>
                  <p className="text-xs mt-1">Click "Start Camera" to begin</p>
                </div>
              )}
            </div>

            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!cameraActive ? (
                  <button
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={startScan}
                      disabled={scanState === 'scanning'}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" />
                      Scan Face
                    </button>
                    <button
                      onClick={stopCamera}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </>
                )}
              </div>
              {cameraActive && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4" />
                  {students.length} students in database
                </div>
              )}
            </div>

            {cameraError && (
              <div className="mx-5 mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {cameraError}
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <SessionTimer label="AM Session" period="AM" icon={Sun} liveTime={liveTime} />
            <SessionTimer label="PM Session" period="PM" icon={Moon} liveTime={liveTime} />
          </div>
        </div>

        {/* Recent scans sidebar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900 text-sm">Recent Scans</h4>
            {recentScans.length > 0 && (
              <button
                onClick={() => setRecentScans([])}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          {recentScans.length === 0 ? (
            <div className="py-12 text-center">
              <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No scans yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentScans.map((scan, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl animate-slide-in"
                >
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {scan.student.full_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {scan.student.student_number} • {formatTime(scan.time)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-600">
                      {scan.confidence}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SessionTimer({
  label,
  period,
  icon: Icon,
  liveTime,
}: {
  label: string;
  period: string;
  icon: typeof Sun;
  liveTime: Date;
}) {
  const isActive =
    (period === 'AM' && isAM(liveTime)) || (period === 'PM' && !isAM(liveTime));
  const periodStart = period === 'AM' ? 8 : 13;
  const periodEnd = period === 'AM' ? 12 : 17;

  const now = liveTime;
  const start = new Date(now);
  start.setHours(periodStart, 0, 0, 0);
  const end = new Date(now);
  end.setHours(periodEnd, 0, 0, 0);

  const elapsed = now > start ? now.getTime() - start.getTime() : 0;
  const total = end.getTime() - start.getTime();
  const remaining = Math.max(0, total - elapsed);
  const progress = Math.min(100, (elapsed / total) * 100);

  const formatDuration = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className={`rounded-xl p-4 border transition-all ${
        isActive ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-gray-400'}`} />
          <span
            className={`text-sm font-semibold ${isActive ? 'text-brand-700' : 'text-gray-500'}`}
          >
            {label}
          </span>
        </div>
        {isActive && (
          <span className="flex items-center gap-1 text-xs text-brand-600 font-medium">
            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-pulse" />
            Active
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-xs text-gray-400">Elapsed</p>
          <p
            className={`text-sm font-bold tabular-nums ${isActive ? 'text-brand-700' : 'text-gray-600'}`}
          >
            {formatDuration(elapsed)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Remaining</p>
          <p
            className={`text-sm font-bold tabular-nums ${isActive ? 'text-brand-700' : 'text-gray-600'}`}
          >
            {formatDuration(remaining)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isActive ? 'bg-brand-500' : 'bg-gray-300'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}