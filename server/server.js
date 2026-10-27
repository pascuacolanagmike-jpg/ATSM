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
const supabaseUrl = 'https://vbpokajudpfjvvlykktj.supabase.co';
const supabaseKey = 'YOUR_SERVICE_ROLE_KEY'; // ⚠️ ROTATE AND REPLACE THIS
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

const esp32Clients = new Set();
const frontendClients = new Set();

let faceMatcher = null;
let isProcessingFrame = false; // Prevents CPU overload

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
        const desc = new Float32Array(student.face_descriptor);
        return new faceapi.LabeledFaceDescriptors(student.id, [desc]);
      });

      // STRICTER MATCHING: 0.5 threshold
      faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5);
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

      // 2. Run AI (Throttled)
      if (isProcessingFrame || !faceMatcher) return;

      if (Math.random() < 0.1) { // ~10% of frames
        isProcessingFrame = true;
        try {
          const img = new Image();
          img.src = Buffer.from(data);
          
          // STRICTER DETECTOR: 0.7 confidence
          const options = new faceapi.TinyFaceDetectorOptions({ 
            inputSize: 320, 
            scoreThreshold: 0.7 
          });
          
          const detections = await faceapi
            .detectAllFaces(img, options)
            .withFaceLandmarks()
            .withFaceDescriptors();

          if (detections.length > 0) {
            // Ignore faces that are too small (likely noise)
            const box = detections[0].detection.box;
            if (box.width > 60 && box.height > 60) {
              
              const bestMatch = faceMatcher.findBestMatch(detections[0].descriptor);
              
              // Must be a known student AND distance must be < 0.5
              if (bestMatch.label !== 'unknown' && bestMatch.distance < 0.5) {
                console.log(`[AI] Match found! Student ID: ${bestMatch.label} (Distance: ${bestMatch.distance.toFixed(2)})`);
                
                broadcastToFrontend({
                  type: 'attendance_matched',
                  studentId: bestMatch.label,
                  confidence: 1 - bestMatch.distance
                });
                
                await new Promise(r => setTimeout(r, 5000)); // Cooldown
              }
            }
          }
        } catch (err) {
          console.error("Recognition error:", err.message);
        } finally {
          isProcessingFrame = false;
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

initAI().then(() => {
  console.log(`WebSocket relay listening on port ${PORT}`);
});