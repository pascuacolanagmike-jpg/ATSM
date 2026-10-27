import { useState, useEffect, useRef, useCallback } from 'react';
import { sendAttendanceSMS } from '@/lib/sms';
import { Square, Camera, CheckCircle2, Clock, UserCheck, AlertCircle, Sun, Moon, ScanFace } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { todayDate, formatTime, isAM, statusForScan } from '@/lib/utils';
import * as faceapi from '@vladmandic/face-api';
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

  // AI Refs
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const isScanningRef = useRef(false);
  const lastMatchTimeRef = useRef(0);
  const modelsLoadedRef = useRef(false);

  useEffect(() => {
    loadStudents();
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => {
      clearInterval(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 1. Load Students & Build Face Matcher
  const loadStudents = async () => {
    const { data } = await supabase.from('students').select('*').eq('status', 'active');
    if (data) {
      setStudents(data);
      
      const valid = data.filter(s => s.face_descriptor && Array.isArray(s.face_descriptor));
      if (valid.length > 0) {
        const labeled = valid.map(s => {
          const desc = new Float32Array(s.face_descriptor);
          return new faceapi.LabeledFaceDescriptors(s.id, [desc]);
        });
        // 0.5 threshold for strict matching
        faceMatcherRef.current = new faceapi.FaceMatcher(labeled, 0.5);
      }
    }
  };

  // 2. Load Models on Startup
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        modelsLoadedRef.current = true;
        console.log("Frontend AI Models Loaded");
      } catch (err) {
        console.error("Failed to load frontend AI models", err);
      }
    };
    loadModels();
  }, []);

  // 3. The Auto-Scan Loop (Every 1 second)
  useEffect(() => {
    if (!cameraActive || !modelsLoadedRef.current) return;

    const scanInterval = setInterval(async () => {
      const canvas = canvasRef.current;
      const matcher = faceMatcherRef.current;
      
      // Skip if no canvas, no matcher, already scanning, or cooldown is active
      if (!canvas || !matcher || isScanningRef.current) return;
      if (Date.now() - lastMatchTimeRef.current < 5000) return; // 5 sec cooldown

      isScanningRef.current = true;
      try {
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.6 });
        
        const detection = await faceapi
          .detectSingleFace(canvas, options)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const bestMatch = matcher.findBestMatch(detection.descriptor);
          
          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.5) {
            const student = students.find(s => s.id === bestMatch.label);
            if (student) {
              console.log(`[AI] Match found! ${student.full_name} (Distance: ${bestMatch.distance.toFixed(2)})`);
              
              lastMatchTimeRef.current = Date.now();
              triggerMatch(student, 1 - bestMatch.distance);
            }
          }
        }
      } catch (err) {
        console.error("AI Error:", err);
      } finally {
        isScanningRef.current = false;
      }
    }, 1000); // Runs once per second

    return () => clearInterval(scanInterval);
  }, [cameraActive, students]);

  // 4. WebSocket Connection (Video Stream Only)
  const connectWebSocket = useCallback(() => {
    const ws = new WebSocket('wss://atsm.onrender.com');
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setCameraError('');
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const blob = new Blob([event.data], { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
      }
    };

    ws.onclose = () => {
      reconnectTimerRef.current = setTimeout(connectWebSocket, 5000);
    };
  }, []);

  const startCamera = () => {
    setCameraError('');
    setCameraActive(true);
    connectWebSocket();
  };

  const stopCamera = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    setCameraActive(false);
    setScanState('idle');
  };

  // 5. Trigger UI and Save to DB
  const triggerMatch = (student: Student, conf: number) => {
    setMatchedStudent(student);
    setScanState('matched');
    setConfidence(Math.round(conf * 100));
    
    logAttendance(student);
    
    setRecentScans((prev) => [
      { student, status: 'present', time: new Date().toISOString(), confidence: Math.round(conf * 100) },
      ...prev,
    ].slice(0, 15));

    setTimeout(() => {
      setScanState('idle');
      setMatchedStudent(null);
    }, 4000);
  };

  const logAttendance = async (student: Student) => {
    const today = todayDate();
    const now = new Date().toISOString();
    const morning = isAM();

    const { data: existing } = await supabase.from('attendance_records').select('*').eq('student_id', student.id).eq('date', today).maybeSingle();

    let saved = false;
    let slotUsed: any = null;

    if (existing) {
      const record = existing as AttendanceRecord;
      const updates: Partial<AttendanceRecord> = {};

      if (morning && !record.time_in_am) {
        updates.time_in_am = now; updates.method = 'face'; updates.status = statusForScan(new Date(), 'AM'); slotUsed = 'time_in_am';
      } else if (morning && record.time_in_am && !record.time_out_am) {
        updates.time_out_am = now; slotUsed = 'time_out_am';
      } else if (!morning && !record.time_in_pm) {
        updates.time_in_pm = now; updates.method = 'face'; updates.status = statusForScan(new Date(), 'PM'); slotUsed = 'time_in_pm';
      } else if (!morning && record.time_in_pm && !record.time_out_pm) {
        updates.time_out_pm = now; slotUsed = 'time_out_pm';
      }

      if (slotUsed && Object.keys(updates).length > 0) {
        const { error } = await supabase.from('attendance_records').update(updates).eq('id', record.id);
        saved = !error;
      }
    } else {
      const newRecord: Record<string, string> = {
        student_id: student.id, date: today, method: 'face', status: statusForScan(new Date(), morning ? 'AM' : 'PM'),
      };
      if (morning) { newRecord.time_in_am = now; slotUsed = 'time_in_am'; }
      else { newRecord.time_in_pm = now; slotUsed = 'time_in_pm'; }
      const { error } = await supabase.from('attendance_records').insert(newRecord);
      saved = !error;
    }

    if (saved && slotUsed) {
      void sendAttendanceSMS(student.phone, student.full_name, slotUsed);
    }
  };

  const currentPeriod = isAM(liveTime) ? 'AM' : 'PM';
  const PeriodIcon = currentPeriod === 'AM' ? Sun : Moon;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Live Face Monitoring</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time face recognition for automated attendance logging</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${currentPeriod === 'AM' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'}`}>
            <PeriodIcon className="w-4 h-4" /> {currentPeriod} Session
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold tabular-nums">
            <Clock className="w-4 h-4" />
            {liveTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="relative aspect-video bg-gray-900 overflow-hidden">
              {cameraActive ? (
                <>
                  <canvas ref={canvasRef} className="w-full h-full object-cover" />
                  
                  {/* Scanning UI overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-48 h-48">
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                      <ScanFace className="w-8 h-8 text-brand-400/50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                  </div>

                  {scanState === 'matched' && matchedStudent && (
                    <div className="absolute inset-0 bg-emerald-900/80 flex items-center justify-center animate-fade-in">
                      <div className="text-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <CheckCircle2 className="w-12 h-12 text-white" />
                        </div>
                        <p className="text-white font-bold text-xl">{matchedStudent.full_name}</p>
                        <p className="text-emerald-200 text-sm mt-1">{matchedStudent.student_number}</p>
                        <p className="text-emerald-300 text-xs mt-2">Confidence: {confidence}%</p>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-full">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold">LIVE ESP32</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Camera className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-sm font-medium">ESP32 Camera is off</p>
                </div>
              )}
            </div>

            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {!cameraActive ? (
                  <button onClick={startCamera} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors">
                    <Camera className="w-4 h-4" /> Start Camera
                  </button>
                ) : (
                  <button onClick={stopCamera} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors">
                    <Square className="w-4 h-4" /> Stop
                  </button>
                )}
              </div>
              {cameraActive && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <AlertCircle className="w-4 h-4" /> Scanning locally...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-gray-900 text-sm">Recent Scans</h4>
          </div>
          {recentScans.length === 0 ? (
            <div className="py-12 text-center">
              <UserCheck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-gray-400">No scans yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {recentScans.map((scan, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{scan.student.full_name}</p>
                    <p className="text-xs text-gray-400">{formatTime(scan.time)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-emerald-600">{scan.confidence}%</span>
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