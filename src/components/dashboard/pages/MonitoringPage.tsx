import { useState, useEffect, useRef, useCallback } from 'react';
import { sendAttendanceSMS } from '@/lib/sms';
import { Square, Camera, CheckCircle2, Clock, UserCheck, AlertCircle, Sun, Moon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayDate, formatTime, isAM, statusForScan } from '@/lib/utils';
import type { Student, AttendanceRecord } from '@/types';

export default function MonitoringPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [scanState, setScanState] = useState<'idle' | 'matched'>('idle');
  const [matchedStudent, setMatchedStudent] = useState<Student | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [recentScans, setRecentScans] = useState<{ student: Student; status: string; time: string; confidence: number }[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveTime, setLiveTime] = useState(new Date());
  const studentsRef = useRef<Student[]>([]);

  useEffect(() => { studentsRef.current = students; }, [students]);

  useEffect(() => {
    loadStudents();
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => { clearInterval(timer); stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStudents = async () => {
    const { data } = await supabase.from('students').select('*').eq('status', 'active');
    if (data) setStudents(data);
  };

  const connectWebSocket = useCallback(() => {
    // ⚠️ NAKA-CONNECT NA ITO SA COLAB MO ⚠️
   const ws = new WebSocket('wss://petal-brittle-fretful.ngrok-free.dev/ws');
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Colab AI');
      setCameraError('');
    };

    ws.onmessage = (event) => {
      // 1. Check for JSON match event
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'attendance_matched') {
            const matched = studentsRef.current.find((s) => s.id === msg.studentId);
            if (matched) {
              setMatchedStudent(matched);
              setScanState('matched');
              setConfidence(Math.round(msg.confidence * 100));
              
              logAttendance(matched);
              
              setRecentScans((prev) => [{ student: matched, status: 'present', time: new Date().toISOString(), confidence: Math.round(msg.confidence * 100) }, ...prev].slice(0, 15));

              setTimeout(() => { setScanState('idle'); setMatchedStudent(null); }, 4000);
            }
          }
        } catch (e) {}
        return;
      }

      // 2. Draw the video frame
      if (event.data instanceof ArrayBuffer) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width; canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      }
    };

    ws.onclose = () => { 
      console.log('WebSocket disconnected. Reconnecting in 5s...');
      reconnectTimerRef.current = setTimeout(connectWebSocket, 5000); 
    };
  }, []);

  const startCamera = () => { setCameraError(''); setCameraActive(true); connectWebSocket(); };
  
  const stopCamera = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    setCameraActive(false); setScanState('idle');
  };

  const logAttendance = async (student: Student) => {
    const today = todayDate(); const now = new Date().toISOString(); const morning = isAM();
    const { data: existing } = await supabase.from('attendance_records').select('*').eq('student_id', student.id).eq('date', today).maybeSingle();

    let saved = false; let slotUsed: any = null;

    if (existing) {
      const record = existing as AttendanceRecord; const updates: Partial<AttendanceRecord> = {};
      if (morning && !record.time_in_am) { updates.time_in_am = now; updates.method = 'face'; updates.status = statusForScan(new Date(), 'AM'); slotUsed = 'time_in_am'; }
      else if (morning && record.time_in_am && !record.time_out_am) { updates.time_out_am = now; slotUsed = 'time_out_am'; }
      else if (!morning && !record.time_in_pm) { updates.time_in_pm = now; updates.method = 'face'; updates.status = statusForScan(new Date(), 'PM'); slotUsed = 'time_in_pm'; }
      else if (!morning && record.time_in_pm && !record.time_out_pm) { updates.time_out_pm = now; slotUsed = 'time_out_pm'; }

      if (slotUsed) { const { error } = await supabase.from('attendance_records').update(updates).eq('id', record.id); saved = !error; }
    } else {
      const newRecord: Record<string, string> = { student_id: student.id, date: today, method: 'face', status: statusForScan(new Date(), morning ? 'AM' : 'PM') };
      if (morning) { newRecord.time_in_am = now; slotUsed = 'time_in_am'; } else { newRecord.time_in_pm = now; slotUsed = 'time_in_pm'; }
      const { error } = await supabase.from('attendance_records').insert(newRecord); saved = !error;
    }
    if (saved && slotUsed) void sendAttendanceSMS(student.phone, student.full_name, slotUsed);
  };

  const currentPeriod = isAM(liveTime) ? 'AM' : 'PM';
  const PeriodIcon = currentPeriod === 'AM' ? Sun : Moon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Live Face Monitoring</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time face recognition (Colab Backend)</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${currentPeriod === 'AM' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}><PeriodIcon className="w-4 h-4" /> {currentPeriod} Session</div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold tabular-nums"><Clock className="w-4 h-4" />{liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="relative aspect-video bg-gray-900 overflow-hidden">
              {cameraActive ? (
                <>
                  <canvas ref={canvasRef} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-48 h-48">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                    </div>
                  </div>
                  {scanState === 'matched' && matchedStudent && (
                    <div className="absolute inset-0 bg-emerald-900/80 flex items-center justify-center animate-fade-in">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse"><CheckCircle2 className="w-12 h-12 text-white" /></div>
                        <p className="text-white font-bold text-xl">{matchedStudent.full_name}</p>
                        <p className="text-emerald-200 text-sm mt-1">{matchedStudent.student_number}</p>
                        <p className="text-emerald-300 text-xs mt-2">Confidence: {confidence}%</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" /><span className="text-white text-xs font-bold">LIVE</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Camera className="w-16 h-16 mb-4 opacity-50" /><p className="text-sm font-medium">Camera is off</p>
                </div>
              )}
            </div>
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!cameraActive ? (
                  <button onClick={startCamera} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg"><Camera className="w-4 h-4" /> Start Camera</button>
                ) : (
                  <button onClick={stopCamera} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg"><Square className="w-4 h-4" /> Stop</button>
                )}
              </div>
              {cameraActive && <div className="flex items-center gap-2 text-sm text-gray-500"><AlertCircle className="w-4 h-4" /> Connected to Colab</div>}
            </div>
            {cameraError && <div className="mx-5 mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{cameraError}</div>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4"><h4 className="font-bold text-gray-900 text-sm">Recent Scans</h4></div>
          {recentScans.length === 0 ? (
            <div className="py-12 text-center"><UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-xs text-gray-400">No scans yet</p></div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentScans.map((scan, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-800 truncate">{scan.student.full_name}</p><p className="text-xs text-gray-400">{formatTime(scan.time)}</p></div>
                  <div className="text-right"><span className="text-xs font-semibold text-emerald-600">{scan.confidence}%</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
