import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cookieParser from 'cookie-parser';
import { initDb } from './src/db/index.ts';
import db from './src/db/index.ts';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-docta-ai-2026';

const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed') as any, false);
    }
  }
});

// Initialize DB
initDb();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static('uploads'));

  // --- API ROUTES ---

  // Messaging: Get Conversations
  app.get('/api/messages/conversations', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      
      // Get unique users the current user has messaged with
      const conversations = db.prepare(`
        SELECT 
          u.id, 
          u.full_name, 
          u.role,
          u.specialty,
          (SELECT content FROM messages 
           WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
           ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT created_at FROM messages 
           WHERE (sender_id = u.id AND receiver_id = ?) OR (sender_id = ? AND receiver_id = u.id)
           ORDER BY created_at DESC LIMIT 1) as last_message_at,
          (SELECT COUNT(*) FROM messages 
           WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
        FROM users u
        WHERE u.id IN (
          SELECT DISTINCT sender_id FROM messages WHERE receiver_id = ?
          UNION
          SELECT DISTINCT receiver_id FROM messages WHERE sender_id = ?
        )
        ORDER BY last_message_at DESC
      `).all(user.id, user.id, user.id, user.id, user.id, user.id, user.id);

      res.json(conversations);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Messaging: Get total unread count
  app.get('/api/messages/unread-count', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const result = db.prepare(`
        SELECT COUNT(*) as count 
        FROM messages 
        WHERE receiver_id = ? AND is_read = 0
      `).get(user.id) as { count: number };
      
      res.json({ count: result.count });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Messaging: Get Messages with a specific user
  app.get('/api/messages/:otherUserId', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const otherUserId = req.params.otherUserId;

      // Mark messages as read
      db.prepare('UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ?').run(otherUserId, user.id);

      const messages = db.prepare(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
      `).all(user.id, otherUserId, otherUserId, user.id);

      res.json(messages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Messaging: Send Message
  app.post('/api/messages', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { receiver_id, content } = req.body;

      if (!receiver_id || !content) {
        return res.status(400).json({ error: 'Missing receiver_id or content' });
      }

      const result = db.prepare(`
        INSERT INTO messages (sender_id, receiver_id, content)
        VALUES (?, ?, ?)
      `).run(user.id, receiver_id, content);

      // Notify receiver
      notifyUser(receiver_id, 'Nouveau message', `Vous avez reçu un nouveau message de ${user.name}.`);

      const newMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);

      // Notify via WebSocket if connected
      broadcastMessage(newMessage);

      res.json(newMessage);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
    
    res.cookie('token', token, { 
      httpOnly: true, 
      secure: true, // Required for SameSite=None
      sameSite: 'none' // Required for cross-origin iframe
    });

    res.json({ user: { id: user.id, email: user.email, role: user.role, name: user.full_name, specialty: user.specialty, photo_url: user.photo_url } });
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { email, password, role, full_name, dob, gender, specialty, rpps_number, shareId } = req.body;

    if (!email || !password || !role || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Restrict Patient registration
    if (role === 'PATIENT') {
      if (!shareId && !req.body.ref) {
        return res.status(400).json({ error: 'Un identifiant Docta ID ou une invitation est requis pour l\'inscription patient.' });
      }
      
      if (shareId) {
        const patient = db.prepare('SELECT id, user_id FROM patients WHERE share_id = ?').get(shareId) as any;
        if (!patient) {
          return res.status(404).json({ error: 'Docta ID invalide.' });
        }
        if (patient.user_id) {
          return res.status(400).json({ error: 'Ce dossier est déjà lié à un compte utilisateur.' });
        }
      }
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email déjà utilisé.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
      const result = db.prepare(`
        INSERT INTO users (email, password, role, full_name, specialty, rpps_number)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(email, hashedPassword, role, full_name, specialty, rpps_number);

      const userId = result.lastInsertRowid;

      if (role === 'PATIENT') {
        if (shareId) {
          // Link existing patient record to new user
          db.prepare('UPDATE patients SET user_id = ? WHERE share_id = ?').run(userId, shareId);
        } else if (req.body.ref) {
          // Create new patient record and link to doctor
          const generateDoctaID = () => {
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            const numbers = '23456789';
            let resId = '';
            for (let i = 0; i < 4; i++) resId += letters.charAt(Math.floor(Math.random() * letters.length));
            resId += '-';
            for (let i = 0; i < 4; i++) resId += numbers.charAt(Math.floor(Math.random() * numbers.length));
            return resId;
          };

          const newShareId = generateDoctaID();
          const names = full_name.split(' ');
          const firstName = names[0];
          const lastName = names.slice(1).join(' ') || 'Patient';

          const patientResult = db.prepare(`
            INSERT INTO patients (user_id, first_name, last_name, dob, gender, email, share_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(userId, firstName, lastName, dob || '1900-01-01', gender || 'O', email, newShareId);

          const patientId = patientResult.lastInsertRowid;
          
          // Link to doctor
          db.prepare(`
            INSERT INTO doctor_patients (doctor_id, patient_id)
            VALUES (?, ?)
          `).run(req.body.ref, patientId);
        }
      }

      const token = jwt.sign({ id: userId, role, name: full_name }, JWT_SECRET, { expiresIn: '8h' });
      
      res.cookie('token', token, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none' 
      });

      res.json({ user: { id: userId, email, role, name: full_name, specialty, photo_url: null } });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Auth: Check Patient by Share ID (for registration)
  app.get('/api/auth/patient-check', (req, res) => {
    const { shareId } = req.query;
    if (!shareId) return res.status(400).json({ error: 'Missing shareId' });

    const patient = db.prepare('SELECT first_name, last_name, dob, gender, user_id FROM patients WHERE share_id = ?').get(shareId) as any;
    
    if (!patient) {
      return res.status(404).json({ error: 'Patient introuvable' });
    }
    
    if (patient.user_id) {
      return res.status(400).json({ error: 'Dossier déjà lié' });
    }

    res.json(patient);
  });

  // Auth: Logout
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
  });

  // Auth: Me
  app.get('/api/auth/me', authenticate, (req, res) => {
    try {
      const decoded = (req as any).user;
      let user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id) as any;
      
      if (!user) return res.status(401).json({ error: 'User not found' });

      // If patient, join with patients table for dob, gender, etc.
      if (user.role === 'PATIENT') {
        const patientInfo = db.prepare('SELECT dob, gender, metadata, share_id FROM patients WHERE user_id = ?').get(user.id) as any;
        if (patientInfo) {
          user = { ...user, ...patientInfo };
        }
      }

      res.json({ 
        user: { 
          id: user.id, 
          email: user.email, 
          role: user.role, 
          pro_role: user.pro_role,
          name: user.full_name, 
          specialty: user.specialty,
          rpps_number: user.rpps_number,
          bio: user.bio,
          education: user.education,
          experience: user.experience,
          phone: user.phone,
          address: user.address,
          photo_url: user.photo_url,
          dob: user.dob,
          gender: user.gender,
          metadata: user.metadata,
          share_id: user.share_id
        } 
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Update Profile
  app.put('/api/pro/profile', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { full_name, specialty, rpps_number, bio, education, experience, phone, address } = req.body;

      // Security check: ensure the user is updating their own profile
      db.prepare(`
        UPDATE users 
        SET full_name = ?, specialty = ?, rpps_number = ?, bio = ?, education = ?, experience = ?, phone = ?, address = ?
        WHERE id = ?
      `).run(full_name, specialty, rpps_number, bio, JSON.stringify(education), JSON.stringify(experience), phone, address, user.id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Update Profile
  app.put('/api/patient/profile', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { full_name, phone, address, dob, gender } = req.body;

      // Update users table
      db.prepare(`
        UPDATE users 
        SET full_name = ?, phone = ?, address = ?
        WHERE id = ?
      `).run(full_name, phone, address, user.id);

      // Update patients table
      const names = full_name.split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || '';

      db.prepare(`
        UPDATE patients 
        SET first_name = ?, last_name = ?, dob = ?, gender = ?
        WHERE user_id = ?
      `).run(firstName, lastName, dob || '1900-01-01', gender || 'U', user.id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Patient
  app.post('/api/patients', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { first_name, last_name, dob, gender, email, metadata } = req.body;
      
      // Generate readable Docta ID: 4 letters - 4 numbers (e.g., ABCD-1234)
      const generateDoctaID = () => {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const numbers = '23456789';
        let result = '';
        for (let i = 0; i < 4; i++) result += letters.charAt(Math.floor(Math.random() * letters.length));
        result += '-';
        for (let i = 0; i < 4; i++) result += numbers.charAt(Math.floor(Math.random() * numbers.length));
        return result;
      };
      const shareId = generateDoctaID();

      const result = db.prepare(`
        INSERT INTO patients (user_id, first_name, last_name, dob, gender, email, metadata, share_id)
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(first_name, last_name, dob, gender, email, metadata ? JSON.stringify(metadata) : null, shareId);
      
      // Automatically link to the creator
      db.prepare(`
        INSERT INTO doctor_patients (doctor_id, patient_id)
        VALUES (?, ?)
      `).run(user.id, result.lastInsertRowid);

      res.json({ success: true, id: result.lastInsertRowid, shareId });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // --- AMELIE AI REMINDER SCHEDULER ---
  // Runs every minute to check for upcoming appointments
  setInterval(() => {
    try {
      const now = new Date();
      
      // 1. Check for 48h reminders (between 47h and 49h from now)
      const start48h = new Date(now.getTime() + 47 * 60 * 60 * 1000).toISOString();
      const end48h = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString();
      
      const appointments48h = db.prepare(`
        SELECT a.id, a.date, a.type, p.first_name, p.last_name, p.user_id as patient_user_id, d.full_name as doctor_name, d.id as doctor_user_id
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.date BETWEEN ? AND ?
        AND a.status = 'SCHEDULED'
        AND a.reminder_48h_sent = 0
      `).all(start48h, end48h) as any[];

      for (const apt of appointments48h) {
        const dateObj = new Date(apt.date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
        const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        const patientMessage = `Bonjour ${apt.first_name}, c'est Amelie AI. N'oubliez pas votre rendez-vous de ${apt.type || 'consultation'} avec Dr. ${apt.doctor_name} prévu le ${dateStr} à ${timeStr}. À bientôt !`;
        const doctorMessage = `Rappel J-2 : Vous avez rendez-vous avec ${apt.first_name} ${apt.last_name} (${apt.type || 'Consultation'}) le ${dateStr} à ${timeStr}.`;
        
        // Notify Patient
        if (apt.patient_user_id) {
          db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(apt.patient_user_id, 'Rappel RDV (J-2)', patientMessage);
        }
        
        // Notify Doctor
        db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(apt.doctor_user_id, 'Rappel RDV Patient (J-2)', doctorMessage);

        // Mark as sent
        db.prepare('UPDATE appointments SET reminder_48h_sent = 1 WHERE id = ?').run(apt.id);
      }

      // 2. Check for 24h reminders (between 23h and 25h from now)
      const start24h = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
      const end24h = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

      const appointments24h = db.prepare(`
        SELECT a.id, a.date, a.type, p.first_name, p.last_name, p.user_id as patient_user_id, d.full_name as doctor_name, d.id as doctor_user_id
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.date BETWEEN ? AND ?
        AND a.status = 'SCHEDULED'
        AND a.reminder_24h_sent = 0
      `).all(start24h, end24h) as any[];

      for (const apt of appointments24h) {
        const dateObj = new Date(apt.date);
        const timeStr = dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        const patientMessage = `Bonjour ${apt.first_name}, c'est Amelie AI. Votre rendez-vous de ${apt.type || 'consultation'} avec Dr. ${apt.doctor_name} est demain à ${timeStr}. N'oubliez pas vos documents médicaux !`;
        const doctorMessage = `Rappel J-1 : Demain à ${timeStr}, vous recevez ${apt.first_name} ${apt.last_name} pour une ${apt.type || 'Consultation'}.`;
        
        // Notify Patient
        if (apt.patient_user_id) {
          db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(apt.patient_user_id, 'Rappel RDV (Demain)', patientMessage);
        }

        // Notify Doctor
        db.prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)').run(apt.doctor_user_id, 'Rappel RDV Patient (Demain)', doctorMessage);

        // Mark as sent
        db.prepare('UPDATE appointments SET reminder_24h_sent = 1 WHERE id = ?').run(apt.id);
      }

    } catch (e) {
      console.error('Error in reminder scheduler:', e);
    }
  }, 60 * 1000); // Check every minute

  // Pro: Link Patient by Share ID
  app.post('/api/pro/patients/link', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { shareId } = req.body;

      const patient = db.prepare('SELECT id FROM patients WHERE share_id = ?').get(shareId) as { id: number };
      
      if (!patient) {
        return res.status(404).json({ error: 'Patient introuvable avec cet ID.' });
      }

      // Check if already linked
      const existingLink = db.prepare('SELECT id FROM doctor_patients WHERE doctor_id = ? AND patient_id = ?').get(user.id, patient.id);
      if (existingLink) {
        return res.status(400).json({ error: 'Ce patient est déjà dans votre liste.' });
      }

      db.prepare(`
        INSERT INTO doctor_patients (doctor_id, patient_id)
        VALUES (?, ?)
      `).run(user.id, patient.id);

      res.json({ success: true, patientId: patient.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Search Practitioners
  app.get('/api/patient/practitioners', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { q } = req.query;

      if (!q) return res.json([]);

      const practitioners = db.prepare(`
        SELECT id, full_name, specialty, rpps_number, email, photo_url, address, phone
        FROM users 
        WHERE role = 'PROFESSIONAL' 
        AND (full_name LIKE ? OR specialty LIKE ? OR rpps_number LIKE ?)
        LIMIT 10
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);

      res.json(practitioners);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Create Appointment Request
  app.post('/api/appointments', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { doctor_id, date, type, notes } = req.body;

      if (!doctor_id || !date || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Find patient record for this user
      const patient = db.prepare('SELECT id, first_name, last_name FROM patients WHERE user_id = ?').get(user.id) as any;
      if (!patient) {
        return res.status(404).json({ error: 'Patient record not found' });
      }

      // 0. Check if doctor has marked this day as unavailable in their agenda
      const dateOnly = new Date(date).toISOString().split('T')[0];
      const isUnavailable = db.prepare(`
        SELECT COUNT(*) as count FROM unavailabilities 
        WHERE doctor_id = ? 
        AND (
          date(date) = date(?) 
          OR (end_date IS NOT NULL AND date(?) BETWEEN date(date) AND date(end_date))
        )
      `).get(doctor_id, dateOnly, dateOnly) as { count: number };

      if (isUnavailable.count > 0) {
        return res.status(400).json({ error: 'Le praticien est indisponible à cette date.' });
      }

      // 1. Check if date is within any availability window
      const window = db.prepare(`
        SELECT * FROM availability_windows 
        WHERE doctor_id = ? 
        AND ? BETWEEN start_date AND end_date
      `).all(doctor_id, dateOnly) as any[];

      const activeWindow = window.find(w => {
        if (!w.days_of_week) return true;
        const days = JSON.parse(w.days_of_week);
        const dayOfWeek = new Date(date).getDay();
        return days.includes(dayOfWeek);
      });

      if (activeWindow) {
        // Count existing appointments for that day
        const count = db.prepare(`
          SELECT COUNT(*) as count 
          FROM appointments 
          WHERE doctor_id = ? 
          AND date(date) = date(?)
          AND status != 'CANCELLED'
        `).get(doctor_id, dateOnly) as { count: number };

        if (count.count >= activeWindow.max_appointments_per_day) {
          return res.status(400).json({ error: 'Limite de rendez-vous atteinte pour cette journée.' });
        }
      }

      db.prepare(`
        INSERT INTO appointments (patient_id, doctor_id, date, type, notes, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(patient.id, doctor_id, date, type, notes || null, 'REQUESTED');

      // Create notification for the doctor
      db.prepare(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `).run(doctor_id, 'Nouvelle demande de RDV', `Le patient ${patient.first_name} ${patient.last_name} a sollicité un rendez-vous pour le ${new Date(date).toLocaleDateString('fr-FR')} à ${new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Search Practitioners
  app.get('/api/pro/practitioners', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { q } = req.query;

      if (!q) return res.json([]);

      const practitioners = db.prepare(`
        SELECT id, full_name, specialty, rpps_number, email 
        FROM users 
        WHERE role = 'PROFESSIONAL' 
        AND id != ? 
        AND (full_name LIKE ? OR specialty LIKE ? OR rpps_number LIKE ?)
        LIMIT 10
      `).all(user.id, `%${q}%`, `%${q}%`, `%${q}%`);

      res.json(practitioners);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Transfer Request
  app.post('/api/transfers', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { receiverId, patientId } = req.body;

      // Check if already transferred
      const existing = db.prepare('SELECT id FROM transfers WHERE sender_id = ? AND receiver_id = ? AND patient_id = ? AND status = "PENDING"').get(user.id, receiverId, patientId);
      if (existing) return res.status(400).json({ error: 'Transfert déjà en attente.' });

      db.prepare(`
        INSERT INTO transfers (sender_id, receiver_id, patient_id)
        VALUES (?, ?, ?)
      `).run(user.id, receiverId, patientId);

      // Notify receiver
      const senderName = user.full_name;
      const patient = db.prepare('SELECT first_name, last_name FROM patients WHERE id = ?').get(patientId) as any;
      db.prepare(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `).run(receiverId, 'Nouveau transfert de dossier', `Dr. ${senderName} souhaite vous transférer le dossier de ${patient.first_name} ${patient.last_name}.`);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: List Transfers (Incoming & Outgoing)
  app.get('/api/transfers', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const incoming = db.prepare(`
        SELECT t.*, u.full_name as sender_name, p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM transfers t
        JOIN users u ON t.sender_id = u.id
        JOIN patients p ON t.patient_id = p.id
        WHERE t.receiver_id = ?
        ORDER BY 
          CASE WHEN t.status = 'PENDING' THEN 0 ELSE 1 END,
          t.created_at DESC
      `).all(user.id);

      const outgoing = db.prepare(`
        SELECT t.*, u.full_name as receiver_name, p.first_name as patient_first_name, p.last_name as patient_last_name
        FROM transfers t
        JOIN users u ON t.receiver_id = u.id
        JOIN patients p ON t.patient_id = p.id
        WHERE t.sender_id = ?
        ORDER BY t.created_at DESC
      `).all(user.id);

      res.json({ incoming, outgoing });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Accept Transfer
  app.put('/api/transfers/:id/accept', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const transferId = req.params.id;

      const transfer = db.prepare('SELECT * FROM transfers WHERE id = ? AND receiver_id = ? AND status = "PENDING"').get(transferId, user.id) as any;
      if (!transfer) return res.status(404).json({ error: 'Transfert introuvable ou déjà traité.' });

      // Link patient to doctor
      db.prepare(`
        INSERT OR IGNORE INTO doctor_patients (doctor_id, patient_id)
        VALUES (?, ?)
      `).run(user.id, transfer.patient_id);

      // Update transfer status
      db.prepare('UPDATE transfers SET status = "ACCEPTED" WHERE id = ?').run(transferId);

      // Notify sender
      db.prepare(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `).run(transfer.sender_id, 'Transfert accepté', `Dr. ${user.full_name} a accepté le transfert du dossier.`);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Reject Transfer
  app.put('/api/transfers/:id/reject', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const transferId = req.params.id;

      const transfer = db.prepare('SELECT * FROM transfers WHERE id = ? AND receiver_id = ? AND status = "PENDING"').get(transferId, user.id) as any;
      if (!transfer) return res.status(404).json({ error: 'Transfert introuvable.' });

      db.prepare('UPDATE transfers SET status = "REJECTED" WHERE id = ?').run(transferId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patients: List (Search) - Scoped to Doctor
  app.get('/api/patients', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const { q } = req.query;
      let query = `
        SELECT p.* 
        FROM patients p
        JOIN doctor_patients dp ON p.id = dp.patient_id
        WHERE dp.doctor_id = ?
      `;
      const params = [user.id];

      if (q) {
        query += ' AND (p.first_name LIKE ? OR p.last_name LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }

      const patients = db.prepare(query).all(...params);
      res.json(patients);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Profile (including Share ID)
  app.get('/api/patient/me', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(user.id);
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      res.json(patient);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Doctors
  app.get('/api/patient/doctors', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const doctors = db.prepare(`
        SELECT u.id, u.full_name, u.specialty, u.rpps_number, u.email, u.phone, u.address, u.photo_url
        FROM users u
        JOIN doctor_patients dp ON u.id = dp.doctor_id
        WHERE dp.patient_id = ?
      `).all(patient.id);

      res.json(doctors);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Records
  app.get('/api/patient/records', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const records = db.prepare(`
        SELECT mr.*, u.full_name as author_name, u.specialty as author_specialty 
        FROM medical_records mr 
        JOIN users u ON mr.author_id = u.id 
        WHERE mr.patient_id = ? 
        ORDER BY mr.timestamp DESC
      `).all(patient.id);

      res.json(records);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get Medication Reminders
  app.get('/api/patient/medications', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const medications = db.prepare(`
        SELECT * FROM medication_reminders 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(user.id);
      res.json(medications);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get History
  app.get('/api/patients/:id/history', authenticate, (req, res) => {
    try {
      const history = db.prepare(`
        SELECT ph.*, u.full_name as author_name
        FROM patient_history ph
        JOIN users u ON ph.author_id = u.id
        WHERE ph.patient_id = ?
        ORDER BY ph.date DESC
      `).all(req.params.id);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get History
  app.get('/api/patient/history', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const history = db.prepare(`
        SELECT ph.*, u.full_name as author_name
        FROM patient_history ph
        JOIN users u ON ph.author_id = u.id
        WHERE ph.patient_id = ?
        ORDER BY ph.date DESC
      `).all(patient.id);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient History: Add Entry
  app.post('/api/patients/:id/history', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { type, description, date } = req.body;

      if (!type || !description || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = db.prepare(`
        INSERT INTO patient_history (patient_id, author_id, type, description, date)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, user.id, type, description, date);

      const newHistory = db.prepare('SELECT * FROM patient_history WHERE id = ?').get(result.lastInsertRowid);
      res.json(newHistory);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Create Medication Reminder
  app.post('/api/patient/medications', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { patient_user_id, drug_name, dosage, frequency, reminder_time, reminder_days, start_date, end_date, notifications_enabled } = req.body;
      
      // If pro, they can set for a patient. If patient, they can only set for themselves.
      const targetUserId = (user.role === 'PROFESSIONAL' && patient_user_id) ? patient_user_id : user.id;

      if (!drug_name || !dosage || !frequency || !start_date) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = db.prepare(`
        INSERT INTO medication_reminders (user_id, drug_name, dosage, frequency, reminder_time, reminder_days, start_date, end_date, notifications_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(targetUserId, drug_name, dosage, frequency, reminder_time || null, reminder_days ? JSON.stringify(reminder_days) : null, start_date, end_date || null, notifications_enabled !== undefined ? (notifications_enabled ? 1 : 0) : 1);

      const newMedication = db.prepare('SELECT * FROM medication_reminders WHERE id = ?').get(result.lastInsertRowid);
      res.json(newMedication);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Update Medication Reminder
  app.put('/api/patient/medications/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { drug_name, dosage, frequency, reminder_time, reminder_days, start_date, end_date, is_active, notifications_enabled } = req.body;

      // Check ownership or if pro
      const existing = db.prepare('SELECT * FROM medication_reminders WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Medication reminder not found' });
      
      if (user.role !== 'PROFESSIONAL' && existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.prepare(`
        UPDATE medication_reminders 
        SET drug_name = ?, dosage = ?, frequency = ?, reminder_time = ?, reminder_days = ?, start_date = ?, end_date = ?, is_active = ?, notifications_enabled = ?
        WHERE id = ?
      `).run(
        drug_name || existing.drug_name, 
        dosage || existing.dosage, 
        frequency || existing.frequency, 
        reminder_time !== undefined ? reminder_time : existing.reminder_time,
        reminder_days !== undefined ? JSON.stringify(reminder_days) : existing.reminder_days,
        start_date || existing.start_date, 
        end_date !== undefined ? end_date : existing.end_date, 
        is_active === undefined ? existing.is_active : (is_active ? 1 : 0), 
        notifications_enabled === undefined ? existing.notifications_enabled : (notifications_enabled ? 1 : 0),
        id
      );

      const updatedMedication = db.prepare('SELECT * FROM medication_reminders WHERE id = ?').get(id);
      res.json(updatedMedication);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient History: Delete Entry
  app.delete('/api/patients/:patientId/history/:id', authenticate, (req, res) => {
    try {
      const { id } = req.params;
      db.prepare('DELETE FROM patient_history WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Delete Medication Reminder
  app.delete('/api/patient/medications/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      // Check ownership or if pro
      const existing = db.prepare('SELECT * FROM medication_reminders WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Medication reminder not found' });
      
      if (user.role !== 'PROFESSIONAL' && existing.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.prepare('DELETE FROM medication_reminders WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get My Appointments
  app.get('/api/pro/appointments', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const { date, startDate, endDate, type, patientId, status } = req.query;
      let query = `
        SELECT a.*, p.first_name, p.last_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        WHERE a.doctor_id = ?
      `;
      const params: any[] = [user.id];

      if (date) {
        query += ' AND date(a.date) = date(?)';
        params.push(date as string);
      } else if (startDate && endDate) {
        query += ' AND date(a.date) BETWEEN date(?) AND date(?)';
        params.push(startDate as string, endDate as string);
      }
      if (type && type !== 'Tous') {
        query += ' AND a.type = ?';
        params.push(type as string);
      }
      if (patientId) {
        query += ' AND a.patient_id = ?';
        params.push(patientId as string);
      }
      if (status && status !== 'Tous') {
      query += ' AND a.status = ?';
      params.push(status as string);
    }

    query += ' ORDER BY a.date ASC';

    const appointments = db.prepare(query).all(...params);
    res.json(appointments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Confirm Appointment
  app.put('/api/pro/appointments/:id/confirm', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?')
        .run('SCHEDULED', req.params.id, user.id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Appointment not found or unauthorized' });
      }

      // Get appointment info to notify patient
      const apt = db.prepare(`
        SELECT a.*, p.user_id as patient_user_id, u.full_name as doctor_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u ON a.doctor_id = u.id
        WHERE a.id = ?
      `).get(req.params.id) as any;

      if (apt && apt.patient_user_id) {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message)
          VALUES (?, ?, ?)
        `).run(apt.patient_user_id, 'RDV Confirmé', `Votre rendez-vous avec le Dr. ${apt.doctor_name} le ${new Date(apt.date).toLocaleDateString('fr-FR')} a été confirmé.`);
      }

      // Link patient to doctor if not already linked
      db.prepare(`
        INSERT OR IGNORE INTO doctor_patients (doctor_id, patient_id)
        VALUES (?, ?)
      `).run(user.id, apt.patient_id);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Cancel Appointment
  app.put('/api/pro/appointments/:id/cancel', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { reason } = req.body;

      const result = db.prepare('UPDATE appointments SET status = ?, cancellation_reason = ? WHERE id = ? AND doctor_id = ?')
        .run('CANCELLED', reason || null, req.params.id, user.id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Appointment not found or unauthorized' });
      }

      // Notify patient
      const apt = db.prepare(`
        SELECT a.*, p.user_id as patient_user_id, u.full_name as doctor_name
        FROM appointments a
        JOIN patients p ON a.patient_id = p.id
        JOIN users u ON a.doctor_id = u.id
        WHERE a.id = ?
      `).get(req.params.id) as any;

      if (apt && apt.patient_user_id) {
        notifyUser(apt.patient_user_id, 'RDV Annulé/Refusé', `Votre rendez-vous avec le Dr. ${apt.doctor_name} le ${new Date(apt.date).toLocaleDateString('fr-FR')} a été annulé ou refusé.`);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Complete Appointment
  app.put('/api/pro/appointments/:id/complete', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?')
        .run('COMPLETED', req.params.id, user.id);
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Appointment not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Settings
  app.get('/api/pro/settings', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const settings = db.prepare('SELECT * FROM pro_settings WHERE user_id = ?').get(user.id) as any;
      
      if (!settings) {
        return res.json({
          appointment_colors: JSON.stringify({
            'Consultation': '#3b82f6',
            'Téléconsultation': '#8b5cf6',
            'Suivi': '#10b981',
            'Urgence': '#ef4444'
          }),
          dashboard_config: '[]'
        });
      }
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Update Dashboard Config
  app.put('/api/pro/settings/dashboard', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { config } = req.body;

      db.prepare(`
        INSERT INTO pro_settings (user_id, dashboard_config)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET dashboard_config = excluded.dashboard_config
      `).run(user.id, JSON.stringify(config));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Appointment
  app.post('/api/pro/appointments', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { patientId, date, type, notes, duration } = req.body;

      if (!patientId || !date || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Check for unavailabilities
      const isUnavailable = db.prepare(`
        SELECT COUNT(*) as count FROM unavailabilities 
        WHERE doctor_id = ? AND (
          (date(date) = date(?)) OR
          (? BETWEEN date(date) AND date(end_date))
        )
      `).get(user.id, date, date) as { count: number };

      if (isUnavailable.count > 0) {
        return res.status(400).json({ error: 'Vous avez marqué cette période comme indisponible.' });
      }

      db.prepare(`
        INSERT INTO appointments (patient_id, doctor_id, date, type, notes, duration)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(patientId, user.id, date, type, notes || null, duration || '30min');

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Availability Window
  app.post('/api/pro/availability-windows', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { start_date, end_date, start_time, end_time, max_appointments_per_day, days_of_week } = req.body;

      if (!start_date || !end_date || !start_time || !end_time || !max_appointments_per_day) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      db.prepare(`
        INSERT INTO availability_windows (doctor_id, start_date, end_date, start_time, end_time, max_appointments_per_day, days_of_week)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(user.id, start_date, end_date, start_time, end_time, max_appointments_per_day, days_of_week ? JSON.stringify(days_of_week) : null);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Availability Windows
  app.get('/api/pro/availability-windows', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const windows = db.prepare('SELECT * FROM availability_windows WHERE doctor_id = ? ORDER BY start_date ASC').all(user.id);
      res.json(windows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Delete Availability Window
  app.delete('/api/pro/availability-windows/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      db.prepare('DELETE FROM availability_windows WHERE id = ? AND doctor_id = ?').run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get Doctor's Availability Windows (Publicly available to patients)
  app.get('/api/patient/doctors/:id/availability-windows', (req, res) => {
    const doctorId = req.params.id;
    try {
      const windows = db.prepare('SELECT * FROM availability_windows WHERE doctor_id = ? AND end_date >= date("now") ORDER BY start_date ASC').all(doctorId);
      res.json(windows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get Doctor's Availability Status
  app.get('/api/patient/doctors/:id/availability-status', (req, res) => {
    const doctorId = req.params.id;
    const { date } = req.query; // YYYY-MM-DD

    if (!date) return res.status(400).json({ error: 'Missing date' });

    try {
      // 0. Check if doctor has marked this day as unavailable
      const isUnavailable = db.prepare(`
        SELECT COUNT(*) as count FROM unavailabilities 
        WHERE doctor_id = ? AND date(date) = date(?)
      `).get(doctorId, date) as { count: number };

      if (isUnavailable.count > 0) {
        return res.json({ available: false, error: 'Le praticien est indisponible à cette date.' });
      }

      // 1. Check if date is within any availability window
      const windows = db.prepare(`
        SELECT * FROM availability_windows 
        WHERE doctor_id = ? 
        AND ? BETWEEN start_date AND end_date
      `).all(doctorId, date) as any[];

      const activeWindow = windows.find(w => {
        if (!w.days_of_week) return true;
        const days = JSON.parse(w.days_of_week);
        const dayOfWeek = new Date(date as string).getDay();
        return days.includes(dayOfWeek);
      });

      if (!activeWindow) {
        return res.json({ available: false, reason: 'No availability window' });
      }

      // 2. Count existing appointments for that day
      const count = db.prepare(`
        SELECT COUNT(*) as count 
        FROM appointments 
        WHERE doctor_id = ? 
        AND date(date) = date(?)
        AND status != 'CANCELLED'
      `).get(doctorId, date) as { count: number };

      res.json({ 
        available: count.count < activeWindow.max_appointments_per_day,
        max: activeWindow.max_appointments_per_day,
        current: count.count,
        start_time: activeWindow.start_time,
        end_time: activeWindow.end_time
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Unavailabilities
  app.get('/api/pro/unavailabilities', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { date, startDate, endDate } = req.query;

      let query = 'SELECT * FROM unavailabilities WHERE doctor_id = ?';
      const params: any[] = [user.id];

      if (date) {
        query += ' AND date(date) = date(?)';
        params.push(date);
      } else if (startDate && endDate) {
        query += ' AND date(date) BETWEEN date(?) AND date(?)';
        params.push(startDate, endDate);
      }

      const unavailabilities = db.prepare(query).all(...params);
      res.json(unavailabilities);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Unavailability
  app.post('/api/pro/unavailabilities', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { date, end_date, reason } = req.body;

      if (!date) return res.status(400).json({ error: 'Date is required' });

      db.prepare('INSERT INTO unavailabilities (doctor_id, date, end_date, reason) VALUES (?, ?, ?, ?)')
        .run(user.id, date, end_date || null, reason || 'Indisponible');
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Delete Unavailability
  app.delete('/api/pro/unavailabilities/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      db.prepare('DELETE FROM unavailabilities WHERE id = ? AND doctor_id = ?')
        .run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Appointments
  app.get('/api/patient/appointments', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const appointments = db.prepare(`
        SELECT a.*, u.full_name as doctor_name, u.specialty as doctor_specialty, u.address as location
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        WHERE a.patient_id = ?
        ORDER BY a.date DESC
      `).all(patient.id);

      res.json(appointments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patients: Get One + Records (with pagination)
  app.get('/api/patients/:id', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const authorId = req.query.authorId as string;

      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id) as any;
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      let query = `
        SELECT 
          mr.id, 
          mr.patient_id, 
          mr.author_id, 
          mr.type, 
          mr.title, 
          mr.content, 
          mr.timestamp, 
          mr.file_url, 
          mr.signature, 
          mr.structured_data,
          u.full_name as author_name, 
          u.specialty as author_specialty,
          'RECORD' as source,
          NULL as status,
          NULL as type_detail
        FROM medical_records mr 
        JOIN users u ON mr.author_id = u.id 
        WHERE mr.patient_id = ? 
      `;
      const params: any[] = [req.params.id];

      if (authorId) {
        query += ` AND mr.author_id = ? `;
        params.push(authorId);
      }

      query += `
        UNION ALL
        
        SELECT 
          a.id, 
          a.patient_id, 
          a.doctor_id as author_id, 
          'APPOINTMENT' as type, 
          'Rendez-vous' as title, 
          a.notes as content, 
          a.date as timestamp, 
          NULL as file_url, 
          NULL as signature, 
          NULL as structured_data,
          u.full_name as author_name, 
          u.specialty as author_specialty,
          'APPOINTMENT' as source,
          a.status,
          a.type as type_detail
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        WHERE a.patient_id = ?
      `;
      params.push(req.params.id);

      if (authorId) {
        query += ` AND a.doctor_id = ? `;
        params.push(authorId);
      }

      query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ? `;
      params.push(limit, offset);

      const records = db.prepare(query).all(...params) as any[];

      // Parse structured_data for each record
      const parsedRecords = records.map(r => ({
        ...r,
        structured_data: r.structured_data ? JSON.parse(r.structured_data) : {}
      }));

      let countQuery = `
        SELECT (
          SELECT COUNT(*) FROM medical_records WHERE patient_id = ? ${authorId ? 'AND author_id = ?' : ''}
        ) + (
          SELECT COUNT(*) FROM appointments WHERE patient_id = ? ${authorId ? 'AND doctor_id = ?' : ''}
        ) as count
      `;
      const countParams: any[] = [req.params.id];
      if (authorId) countParams.push(authorId);
      countParams.push(req.params.id);
      if (authorId) countParams.push(authorId);

      const total = db.prepare(countQuery).get(...countParams) as { count: number };

      res.json({ patient, records: parsedRecords, total: total.count });
    } catch (e: any) {
      console.error('Error fetching patient records:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Patients: Get Summary (for preview)
  app.get('/api/patients/:id/summary', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const patientId = req.params.id;

      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as any;
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const lastRecordRaw = db.prepare(`
        SELECT mr.*, u.full_name as author_name 
        FROM medical_records mr 
        JOIN users u ON mr.author_id = u.id 
        WHERE mr.patient_id = ? 
        ORDER BY mr.timestamp DESC 
        LIMIT 1
      `).get(patientId) as any;

      const lastRecord = lastRecordRaw ? {
        ...lastRecordRaw,
        structured_data: lastRecordRaw.structured_data ? JSON.parse(lastRecordRaw.structured_data) : {}
      } : null;

      const nextAppointment = db.prepare(`
        SELECT * FROM appointments 
        WHERE patient_id = ? AND date >= datetime('now') 
        ORDER BY date ASC 
        LIMIT 1
      `).get(patientId);

      const lastPrescriptionsRaw = db.prepare(`
        SELECT * FROM medical_records 
        WHERE patient_id = ? AND type = 'PRESCRIPTION' 
        ORDER BY timestamp DESC 
        LIMIT 3
      `).all(patientId) as any[];

      const lastPrescriptions = lastPrescriptionsRaw.map(p => ({
        ...p,
        structured_data: p.structured_data ? JSON.parse(p.structured_data) : {}
      }));

      const latestVitals = db.prepare(`
        SELECT * FROM vital_signs 
        WHERE patient_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 1
      `).get(patientId);

      const vitalSigns = db.prepare(`
        SELECT * FROM vital_signs 
        WHERE patient_id = ? 
        ORDER BY timestamp ASC 
        LIMIT 10
      `).all(patientId);

      res.json({ patient, lastRecord, nextAppointment, lastPrescriptions, vitalSigns, latestVitals });
    } catch (e: any) {
      console.error('Error fetching patient summary:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Amelie AI: Get Patient Context for Analysis
  app.get('/api/amelie/patient-context/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const patientId = req.params.id;

      const patient = db.prepare('SELECT id, first_name, last_name, dob, gender FROM patients WHERE id = ?').get(patientId) as any;
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      const vitals = db.prepare(`
        SELECT * FROM vital_signs 
        WHERE patient_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 20
      `).all(patientId);

      res.json({
        patient,
        vitals,
        practitioner: {
          full_name: user.full_name,
          specialty: user.specialty
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Appointments for a specific patient
  app.get('/api/patients/:id/appointments', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') {
        return res.status(403).json({ error: 'Access denied' });
      }

      const appointments = db.prepare(`
        SELECT a.*, u.full_name as doctor_name, u.specialty as doctor_specialty 
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        WHERE a.patient_id = ?
        ORDER BY a.date DESC
      `).all(req.params.id);

      res.json(appointments);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Create Medical Record
  app.post('/api/patients/:id/records', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') {
        return res.status(403).json({ error: 'Seuls les praticiens peuvent créer des documents médicaux.' });
      }
      
      const patientId = req.params.id;
      const { type, title, content, structured_data, signature, file_url } = req.body;

      if (!type || !title || !content) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      db.prepare(`
        INSERT INTO medical_records (patient_id, author_id, type, title, content, file_url, structured_data, signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, user.id, type, title, content, file_url || null, JSON.stringify(structured_data || {}), signature || null);

      // Notify patient
      const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(patientId) as { user_id: number };
      if (patient && patient.user_id) {
        db.prepare(`
          INSERT INTO notifications (user_id, title, message)
          VALUES (?, ?, ?)
        `).run(patient.user_id, 'Nouveau document médical', `Un nouveau document "${title}" a été ajouté à votre dossier par le Dr. ${user.full_name}.`);
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Documents (Shared by patient)
  app.get('/api/patient/documents', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const patientDocs = db.prepare(`
        SELECT mr.*, u.full_name as doctor_name
        FROM medical_records mr
        LEFT JOIN users u ON CAST(json_extract(mr.structured_data, '$.receiver_id') AS INTEGER) = u.id
        WHERE mr.patient_id = ? AND mr.author_id = ?
        ORDER BY mr.timestamp DESC
      `).all(patient.id, user.id);

      res.json(patientDocs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Share Document with Doctor
  app.post('/api/patient/documents', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { title, type, doctorId, content, file_url } = req.body;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const structuredData = JSON.stringify({ receiver_id: doctorId });
      db.prepare(`
        INSERT INTO medical_records (patient_id, author_id, type, title, content, file_url, structured_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(patient.id, user.id, type, title, content, file_url || null, structuredData);

      // Notify doctor
      db.prepare(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `).run(doctorId, 'Nouveau document partagé', `Le patient ${user.full_name} a partagé un document : ${title}`);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Delete shared document
  app.delete('/api/patient/documents/:id', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const doc = db.prepare('SELECT author_id FROM medical_records WHERE id = ?').get(req.params.id) as any;
      if (!doc) return res.status(404).json({ error: 'Document not found' });
      if (doc.author_id !== user.id) return res.status(403).json({ error: 'Forbidden' });

      db.prepare('DELETE FROM medical_records WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Update Medical Record
  app.put('/api/patients/:id/records/:recordId', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { recordId } = req.params;
      const { title, content, structured_data, file_url, signature } = req.body;

      // Check ownership
      const record = db.prepare('SELECT author_id FROM medical_records WHERE id = ?').get(recordId) as any;
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.author_id !== user.id) return res.status(403).json({ error: 'Forbidden: You can only edit your own records' });

      db.prepare(`
        UPDATE medical_records 
        SET title = ?, content = ?, structured_data = ?, file_url = ?, signature = ?
        WHERE id = ?
      `).run(title, content, JSON.stringify(structured_data || {}), file_url || null, signature || null, recordId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Delete Medical Record
  app.delete('/api/patients/:id/records/:recordId', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { recordId } = req.params;

      // Check ownership
      const record = db.prepare('SELECT author_id FROM medical_records WHERE id = ?').get(recordId) as any;
      if (!record) return res.status(404).json({ error: 'Record not found' });
      if (record.author_id !== user.id) return res.status(403).json({ error: 'Forbidden: You can only delete your own records' });

      db.prepare('DELETE FROM medical_records WHERE id = ?').run(recordId);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // File Upload Endpoint
  app.post('/api/upload', authenticate, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const url = `/uploads/${req.file.filename}`;
      res.json({ url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update Patient Photo
  app.put('/api/patients/:id/photo', authenticate, (req, res) => {
    try {
      const { photo_url } = req.body;
      const patientId = req.params.id;

      db.prepare('UPDATE patients SET photo_url = ? WHERE id = ?').run(photo_url, patientId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update User Profile Photo
  app.put('/api/profile/photo', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { photo_url } = req.body;

      db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').run(photo_url, user.id);
      
      // Also update patient profile if it exists
      if (user.role === 'PATIENT') {
        db.prepare('UPDATE patients SET photo_url = ? WHERE user_id = ?').run(photo_url, user.id);
      }
      
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Get Notification Preferences
  app.get('/api/notification-preferences', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      let prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(user.id) as any;
      
      if (!prefs) {
        // Create default preferences if they don't exist
        db.prepare('INSERT INTO notification_preferences (user_id) VALUES (?)').run(user.id);
        prefs = db.prepare('SELECT * FROM notification_preferences WHERE user_id = ?').get(user.id);
      }
      
      res.json(prefs);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update Notification Preferences
  app.put('/api/notification-preferences', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { appointment_reminders, new_documents, new_messages } = req.body;

      db.prepare(`
        INSERT INTO notification_preferences (user_id, appointment_reminders, new_documents, new_messages)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          appointment_reminders = excluded.appointment_reminders,
          new_documents = excluded.new_documents,
          new_messages = excluded.new_messages
      `).run(user.id, appointment_reminders ? 1 : 0, new_documents ? 1 : 0, new_messages ? 1 : 0);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Amelie AI Logging Service
  app.post('/api/amelie/log', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { patientId, responseText, type, query } = req.body;

      // Log the interaction
      db.prepare(`
        INSERT INTO ai_logs (user_id, patient_id, prompt_hash, request_type, query, response_summary, full_response)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id, 
        patientId || null, 
        'hash_placeholder', 
        type || 'ANALYSIS', 
        query || null,
        (responseText || '').substring(0, 100),
        responseText || null
      );

      res.json({ success: true });
    } catch (error) {
      console.error('AI Log Error:', error);
      res.status(500).json({ error: 'Failed to log AI interaction' });
    }
  });

  app.get('/api/amelie/history', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const logs = db.prepare(`
        SELECT 
          ai_logs.*, 
          patients.first_name || ' ' || patients.last_name as patient_name 
        FROM ai_logs 
        LEFT JOIN patients ON ai_logs.patient_id = patients.id
        WHERE ai_logs.user_id = ? 
        ORDER BY timestamp DESC
      `).all(user.id);
      res.json(logs);
    } catch (error) {
      console.error('Fetch AI History Error:', error);
      res.status(500).json({ error: 'Failed to fetch AI history' });
    }
  });

  // Pro: Update Settings
  app.post('/api/pro/settings', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const { appointment_colors } = req.body;

      db.prepare(`
        INSERT INTO pro_settings (user_id, appointment_colors)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET appointment_colors = excluded.appointment_colors
      `).run(user.id, JSON.stringify(appointment_colors));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- OPTIMIZED ENDPOINTS ---
  app.get('/api/patients/:id/full-summary', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') return res.status(403).json({ error: 'Forbidden' });

      const patientId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      // 1. Patient details
      const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(patientId) as any;
      if (!patient) return res.status(404).json({ error: 'Patient not found' });

      // 2. Records
      const records = db.prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(patientId, limit, offset);
      const totalRecords = db.prepare('SELECT COUNT(*) as count FROM medical_records WHERE patient_id = ?').get(patientId) as { count: number };

      // 3. Vitals
      const vitals = db.prepare('SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 50').all(patientId);

      // 4. Medications (if user linked)
      let medications: any[] = [];
      if (patient.user_id) {
        medications = db.prepare('SELECT * FROM medication_reminders WHERE user_id = ? ORDER BY created_at DESC').all(patient.user_id);
      }

      // 5. History
      const history = db.prepare('SELECT * FROM patient_history WHERE patient_id = ? ORDER BY date DESC').all(patientId);

      // 6. Appointments
      const appointments = db.prepare(`
        SELECT a.*, u.full_name as doctor_name 
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        WHERE a.patient_id = ?
        ORDER BY a.date DESC
      `).all(patientId);

      res.json({
        patient,
        records,
        totalRecords: totalRecords.count,
        vitalsHistory: vitals,
        medications,
        history,
        appointments
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/pro/dashboard-summary', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') return res.status(403).json({ error: 'Forbidden' });

      const patients = db.prepare('SELECT * FROM patients WHERE doctor_id = ? OR id IN (SELECT patient_id FROM medical_records WHERE author_id = ?)').all(user.id, user.id);
      const transfers = db.prepare(`
        SELECT pt.*, p.first_name, p.last_name, u.full_name as requester_name 
        FROM patient_transfers pt
        JOIN patients p ON pt.patient_id = p.id
        JOIN users u ON pt.requester_id = u.id
        WHERE pt.target_doctor_id = ? AND pt.status = 'PENDING'
      `).all(user.id);
      
      const settings = db.prepare('SELECT * FROM pro_dashboard_settings WHERE user_id = ?').get(user.id);

      // Add real-time stats
      const today = new Date().toISOString().split('T')[0];
      const todayApts = db.prepare('SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND date(date) = date(?)').get(user.id, today) as { count: number };
      const totalPatients = db.prepare('SELECT COUNT(*) as count FROM patients WHERE doctor_id = ?').get(user.id) as { count: number };
      const pendingTransfersCount = transfers.length;

      res.json({
        patients,
        pendingTransfers: transfers,
        dashboardSettings: settings ? JSON.parse(settings.settings_json) : null,
        stats: {
          todayAppointments: todayApts.count,
          totalPatients: totalPatients.count,
          pendingActions: pendingTransfersCount
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/patient/dashboard-data', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      
      const patient = db.prepare('SELECT * FROM patients WHERE user_id = ?').get(user.id) as any;
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      // Parallelize DB queries for speed
      const records = db.prepare('SELECT * FROM medical_records WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 3').all(patient.id);
      const appointments = db.prepare(`
        SELECT a.*, u.full_name as doctor_name 
        FROM appointments a
        JOIN users u ON a.doctor_id = u.id
        WHERE a.patient_id = ? AND a.date >= date('now') 
        ORDER BY a.date ASC LIMIT 2
      `).all(patient.id);
      const vitals = db.prepare('SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY timestamp DESC LIMIT 1').all(patient.id);
      const medications = db.prepare('SELECT * FROM medication_reminders WHERE user_id = ? ORDER BY created_at DESC').all(user.id);

      res.json({
        patient,
        recentRecords: records,
        upcomingAppointments: appointments,
        latestVitals: vitals[0] || null,
        medications
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Notifications: List
  app.get('/api/notifications', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(user.id);
      res.json(notifications);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Notifications: Mark as Read
  app.put('/api/notifications/:id/read', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, user.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Save Vital Signs
  app.post('/api/patients/:id/vitals', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      const patientId = req.params.id;
      const { weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation } = req.body;

      db.prepare(`
        INSERT INTO vital_signs (patient_id, author_id, weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, user.id, weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Patient Vitals
  app.get('/api/patients/:id/vitals', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') return res.status(403).json({ error: 'Forbidden' });

      const patientId = req.params.id;

      const vitals = db.prepare(`
        SELECT * FROM vital_signs 
        WHERE patient_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 50
      `).all(patientId);

      res.json(vitals);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Pro: Get Patient Medications
  app.get('/api/patients/:id/medications', authenticate, (req, res) => {
    try {
      const user = (req as any).user;
      if (user.role !== 'PROFESSIONAL') return res.status(403).json({ error: 'Forbidden' });

      const patientId = req.params.id;
      const patient = db.prepare('SELECT user_id FROM patients WHERE id = ?').get(patientId) as { user_id: number | null };
      
      if (!patient || !patient.user_id) {
        return res.json([]); // No user linked, so no medications
      }

      const medications = db.prepare(`
        SELECT * FROM medication_reminders 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `).all(patient.user_id);
      
      res.json(medications);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Get My Vitals
  app.get('/api/patient/vitals', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const vitals = db.prepare(`
        SELECT * FROM vital_signs 
        WHERE patient_id = ? 
        ORDER BY timestamp DESC 
        LIMIT 20
      `).all(patient.id);

      res.json(vitals);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Patient: Save My Vitals
  app.post('/api/patient/vitals', authenticate, (req, res) => {
    try {
      const user = (req as any).user;

      const patient = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as { id: number };
      if (!patient) return res.status(404).json({ error: 'Patient profile not found' });

      const { weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation } = req.body;

      db.prepare(`
        INSERT INTO vital_signs (patient_id, author_id, weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patient.id, user.id, weight, height, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation);

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer });

  const clients = new Map<number, WebSocket>();

  wss.on('connection', (ws, req) => {
    const cookies = req.headers.cookie;
    if (!cookies) {
      ws.close();
      return;
    }

    const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('token='));
    if (!tokenCookie) {
      ws.close();
      return;
    }

    const token = tokenCookie.split('=')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      clients.set(decoded.id, ws);

      ws.on('close', () => {
        clients.delete(decoded.id);
      });
    } catch (e) {
      ws.close();
    }
  });

  function notifyUser(userId: number, title: string, message: string) {
    try {
      const result = db.prepare(`
        INSERT INTO notifications (user_id, title, message)
        VALUES (?, ?, ?)
      `).run(userId, title, message);

      const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);
      
      const ws = clients.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'NEW_NOTIFICATION', notification }));
      }
      return notification;
    } catch (e) {
      console.error('Error sending notification:', e);
      return null;
    }
  }

  function broadcastMessage(message: any) {
    const receiverWs = clients.get(message.receiver_id);
    if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
      receiverWs.send(JSON.stringify({ type: 'NEW_MESSAGE', message }));
    }
    
    // Also send back to sender for confirmation if they have multiple tabs open
    const senderWs = clients.get(message.sender_id);
    if (senderWs && senderWs.readyState === WebSocket.OPEN) {
      senderWs.send(JSON.stringify({ type: 'NEW_MESSAGE', message }));
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Appointment Reminders Logic
    function checkAppointmentReminders() {
      try {
        const now = new Date();
        
        // 48h reminders
        const target48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const target48hStr = target48h.toISOString().split('T')[0];
        
        const apts48h = db.prepare(`
          SELECT a.*, u.full_name as doctor_name, p.first_name as patient_first, p.last_name as patient_last
          FROM appointments a
          JOIN users u ON a.doctor_id = u.id
          JOIN patients p ON a.patient_id = p.id
          WHERE date(a.date) = date(?) AND a.status = 'SCHEDULED' AND a.reminder_48h_sent = 0
        `).all(target48hStr) as any[];

        apts48h.forEach(apt => {
          notifyUser(apt.doctor_id, 'Rappel RDV (J-2)', `Rappel : Vous avez un rendez-vous avec ${apt.patient_first} ${apt.patient_last} dans 48h (${new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`);
          db.prepare('UPDATE appointments SET reminder_48h_sent = 1 WHERE id = ?').run(apt.id);
        });

        // 24h reminders
        const target24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const target24hStr = target24h.toISOString().split('T')[0];
        
        const apts24h = db.prepare(`
          SELECT a.*, u.full_name as doctor_name, p.first_name as patient_first, p.last_name as patient_last
          FROM appointments a
          JOIN users u ON a.doctor_id = u.id
          JOIN patients p ON a.patient_id = p.id
          WHERE date(a.date) = date(?) AND a.status = 'SCHEDULED' AND a.reminder_24h_sent = 0
        `).all(target24hStr) as any[];

        apts24h.forEach(apt => {
          notifyUser(apt.doctor_id, 'Rappel RDV (J-1)', `Rappel : Vous avez un rendez-vous avec ${apt.patient_first} ${apt.patient_last} demain à ${new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
          db.prepare('UPDATE appointments SET reminder_24h_sent = 1 WHERE id = ?').run(apt.id);
        });
      } catch (error) {
        console.error('Error in checkAppointmentReminders:', error);
      }
    }

    function checkMedicationReminders() {
      try {
        const now = new Date();
        // Capitalize first letter to match frontend (Lundi, etc)
        const dayStr = now.toLocaleDateString('fr-FR', { weekday: 'long' });
        const currentDay = dayStr.charAt(0).toUpperCase() + dayStr.slice(1);
        
        // Manual time formatting to avoid non-breaking spaces or different separators
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${hours}:${minutes}`;
        
        const activeReminders = db.prepare(`
          SELECT * FROM medication_reminders 
          WHERE is_active = 1 
          AND notifications_enabled = 1 
          AND reminder_time = ?
          AND (last_reminder_sent_at IS NULL OR date(last_reminder_sent_at) != date('now'))
        `).all(currentTime) as any[];

        activeReminders.forEach(reminder => {
          const days = JSON.parse(reminder.reminder_days || '[]');
          if (days.length === 0 || days.includes(currentDay)) {
            notifyUser(reminder.user_id, 'Rappel Médicament', `C'est l'heure de prendre votre ${reminder.drug_name} (${reminder.dosage}). Posologie : ${reminder.frequency}`);
            db.prepare('UPDATE medication_reminders SET last_reminder_sent_at = CURRENT_TIMESTAMP WHERE id = ?').run(reminder.id);
          }
        });
      } catch (error) {
        console.error('Error in checkMedicationReminders:', error);
      }
    }

    // Run every minute for medication reminders (to match HH:MM)
    setInterval(checkMedicationReminders, 60 * 1000);
    // Run every hour for appointment reminders
    setInterval(checkAppointmentReminders, 60 * 60 * 1000);
    
    // Initial runs
    checkMedicationReminders();
    checkAppointmentReminders();
  });
}

startServer();
