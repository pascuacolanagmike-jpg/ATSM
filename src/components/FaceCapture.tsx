import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, X, Loader2 } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface FaceCaptureProps {
  initialUrl?: string | null;
  onChange: (
    blob: Blob | null,
    previewUrl: string | null,
    landmarks: any | null
  ) => void;
}

// Global singletons so the model is only downloaded once per session
let faceLandmarker: FaceLandmarker | null = null;
let visionLoading: Promise<FaceLandmarker> | null = null;

async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarker) return faceLandmarker;
  if (!visionLoading) {
    visionLoading = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/models/face_landmarker.task',
        },
        runningMode: 'IMAGE',
        numFaces: 1,
      });
      return faceLandmarker;
    })();
  }
  return visionLoading;
}

export default function FaceCapture({ initialUrl, onChange }: FaceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  // Ensure the video element is ready before we attach the stream
  useEffect(() => {
    if (streaming && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [streaming]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const startCamera = useCallback(async () => {
    setError('');
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setStreaming(true); // This triggers the useEffect above
    } catch (e) {
      setError((e as Error)?.message ?? 'Cannot access camera');
    } finally {
      setStarting(false);
    }
  }, []);

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    setProcessing(true);

    // --- 1. Build a square, non‑mirrored canvas snapshot ---
    const size = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setProcessing(false);
      return;
    }

    // Because the preview is mirrored via CSS, we flip the canvas horizontally
    // so the saved image matches the *real* orientation of the student's face.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      512,
      512
    );

    // --- 2. Run MediaPipe on the *un‑mirrored* canvas ---
    const landmarker = await getFaceLandmarker();
    const result = landmarker.detect(canvas);

    let landmarks: any | null = null;
    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      // array of {x, y, z} for 478 points
      landmarks = result.faceLandmarks[0];
    } else {
      setError(
        'No face detected. Make sure the student is looking at the camera in good lighting.'
      );
      setProcessing(false);
      return;
    }

    // --- 3. Produce the final Blob and notify parent ---
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setProcessing(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        setPreview(url);
        onChange(blob, url, landmarks);
        stopCamera();
        setProcessing(false);
      },
      'image/jpeg',
      0.9
    );
  };

  const clear = () => {
    setPreview(null);
    onChange(null, null, null);
  };

  const retake = () => {
    clear();
    startCamera();
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5">
        Face Photo & Landmarks
      </label>

      <div className="relative aspect-square w-full max-w-[220px] mx-auto rounded-2xl overflow-hidden bg-gray-900 border border-gray-200">
        {preview ? (
          <>
            <img
              src={preview}
              alt="Captured face"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={retake}
              className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-white/95 hover:bg-white text-gray-800 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retake
            </button>
            <button
              type="button"
              onClick={clear}
              className="absolute top-2 right-2 p-1.5 bg-white/95 hover:bg-white rounded-lg"
            >
              <X className="w-3.5 h-3.5 text-gray-700" />
            </button>
          </>
        ) : streaming ? (
          <>
            {/* The CSS class "scale-x-[-1]" (Tailwind) mirrors the preview so it feels like a mirror.
                The actual canvas capture is un-mirrored in the code above. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <button
              type="button"
              onClick={capture}
              disabled={processing}
              className="absolute bottom-2 left-2 right-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" /> Capture
                </>
              )}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startCamera}
            disabled={starting}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            {starting ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Camera className="w-8 h-8" />
            )}
            <span className="text-xs font-medium">
              {starting ? 'Starting…' : 'Open Camera'}
            </span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-400 text-center mt-2 leading-tight">
        Look straight at the camera in good lighting.
      </p>
      {error && (
        <p className="text-[11px] text-red-500 text-center mt-1">{error}</p>
      )}
    </div>
  );
}