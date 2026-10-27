import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import * as faceapi from '@vladmandic/face-api';
import canvas from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const supabaseUrl = 'https://vbpokajudpfjvvlykktj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicG9rYWp1ZHBmanZ2bHlra3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE4NjM3OCwiZXhwIjoyMTA1NzYyMzc4fQ.B30Fha5xl7Lhnj4w54h74btuT3-glmOOI80eEIN9YTM'; // ⚠️ Use your actual key here
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const esp32Clients = new Set();
const frontendClients = new Set();

let faceMatcher = null;
let isProcessing = false;
let lastScanTime = 0;

async function initAI() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'models'));
    
    const { data: students } = await supabase.from('students').select('id, face_descriptor');
    const valid = students?.filter(s => s.face_descriptor && Array.isArray(s.face_descriptor)) || [];
    
    if (valid.length > 0) {
      const labeled = valid.map(s => new faceapi.LabeledFaceDescriptors(s.id, [new Float32Array(s.face_descriptor)]));
      faceMatcher = new faceapi.FaceMatcher(labeled, 0.5);
      console.log(`AI Ready. Loaded ${valid.length} faces.`);
    }
  } catch (err) {
    console.error("AI Init Failed:", err);
  }
}

wss.on('connection', (ws, req) => {
  const isEsp32 = (req.url || '').startsWith('/esp32');

  if (isEsp32) {
    ws.on('message', async (data, isBinary) => {
      if (!isBinary) return;

      // 1. Forward video to browser
      for (const client of frontendClients) {
        if (client.readyState === 1) client.send(data, { binary: true });
      }

      // 2. Run AI every 3 seconds (Throttled for Render Free Tier)
      const now = Date.now();
      if (isProcessing || !faceMatcher || now - lastScanTime < 3000) return;
      
      isProcessing = true;
      lastScanTime = now;

      try {
        const img = new Image();
        img.src = Buffer.from(data);
        
        // Faster detection: smaller input size, strict 0.6 threshold
        const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.6 });
        const detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor();

        if (detection) {
          const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
          if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.5) {
            console.log(`[AI] Match: ${bestMatch.label} (Dist: ${bestMatch.distance.toFixed(2)})`);
            broadcast({ type: 'attendance_matched', studentId: bestMatch.label, confidence: 1 - bestMatch.distance });
            
            // Cooldown 5s to prevent double logging
            await new Promise(r => setTimeout(r, 5000)); 
          }
        }
      } catch (err) {} finally {
        isProcessing = false;
      }
    });
  } else {
    frontendClients.add(ws);
    ws.on('close', () => frontendClients.delete(ws));
  }
});

function broadcast(msg) {
  const str = JSON.stringify(msg);
  for (const client of frontendClients) {
    if (client.readyState === 1) client.send(str);
  }
}

initAI().then(() => console.log(`Listening on ${PORT}`));