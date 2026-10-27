import { WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import * as faceapi from '@vladmandic/face-api';
import canvas from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup canvas for face-api
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// ===== SUPABASE CREDENTIALS =====
// ⚠️ USE YOUR SERVICE ROLE KEY HERE, NOT THE ANON KEY ⚠️
// You can find this in Supabase -> Project Settings -> API -> Project API keys -> service_role
const supabaseUrl = 'https://vbpokajudpfjvvlykktj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZicG9rYWp1ZHBmanZ2bHlra3RqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDE4NjM3OCwiZXhwIjoyMTA1NzYyMzc4fQ.B30Fha5xl7Lhnj4w54h74btuT3-glmOOI80eEIN9YTM'; 
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const esp32Clients = new Set();
const frontendClients = new Set();

let faceMatcher = null;

// Load AI models and Student Faces on startup
async function initAI() {
  console.log("Loading Face-API models...");
  try {
    await faceapi.nets.tinyFaceDetector.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(__dirname, 'models'));
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(__dirname, 'models'));
    console.log("Models loaded successfully.");

    console.log("Fetching student faces from Supabase...");
    const { data: students, error } = await supabase.from('students').select('id, full_name, face_descriptor');
    
    if (error) {
      console.error("Supabase error:", error.message);
      return;
    }

    const validStudents = students.filter(s => s.face_descriptor && Array.isArray(s.face_descriptor));
    
    if (validStudents.length > 0) {
      const labeledFaceDescriptors = validStudents.map(student => {
        // face-api expects a Float32Array
        const desc = new Float32Array(student.face_descriptor);
        return new faceapi.LabeledFaceDescriptors(student.id, [desc]);
      });

      // 0.6 is the threshold. Lower = stricter matching.
      faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);
      console.log(`Loaded faces for ${labeledFaceDescriptors.length} students.`);
    } else {
      console.log("No students with face descriptors found in database.");
    }
  } catch (err) {
    console.error("Failed to initialize AI:", err);
  }
}

wss.on('connection', (ws, req) => {
  const url = req.url || '';
  const isEsp32 = url.startsWith('/esp32');

  if (isEsp32) {
    console.log('[ESP32] connected');
    esp32Clients.add(ws);

    ws.on('message', async (data, isBinary) => {
      if (!isBinary) return;

      // 1. Forward video to frontend immediately
      for (const client of frontendClients) {
        if (client.readyState === 1) client.send(data, { binary: true });
      }

      // 2. Run recognition only on some frames (to save CPU)
      // We don't want to run AI on every single frame at 10 FPS.
      if (Math.random() < 0.1 && faceMatcher) {
        try {
          const img = new Image();
          img.src = Buffer.from(data);
          
          const detections = await faceapi
            .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections.length > 0) {
            const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
            
            if (bestMatch.label !== 'unknown') {
              console.log(`[AI] Match found! Student ID: ${bestMatch.label} (Distance: ${bestMatch.distance.toFixed(2)})`);
              
              // Tell frontend a face matched!
              broadcastToFrontend({
                type: 'attendance_matched',
                studentId: bestMatch.label,
                confidence: 1 - bestMatch.distance
              });
              
              // Wait 5 seconds before recognizing again so we don't spam logs/UI
              await new Promise(r => setTimeout(r, 5000));
            }
          }
        } catch (err) {
          console.error("Recognition error:", err.message);
        }
      }
    });

    ws.on('close', () => {
      console.log('[ESP32] disconnected');
      esp32Clients.delete(ws);
    });
  } else {
    console.log('[Frontend] connected');
    frontendClients.add(ws);

    ws.on('close', () => {
      console.log('[Frontend] disconnected');
      frontendClients.delete(ws);
    });
  }
});

function broadcastToFrontend(message) {
  const str = JSON.stringify(message);
  for (const client of frontendClients) {
    if (client.readyState === 1) client.send(str);
  }
}

// Start server only after AI is initialized
initAI().then(() => {
  console.log(`WebSocket relay listening on port ${PORT}`);
});