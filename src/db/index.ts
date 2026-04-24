import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database('docta.db');

export function initDb() {
    // Users (Professionals and Patients)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('PROFESSIONAL', 'PATIENT', 'ADMIN')) NOT NULL,
        pro_role TEXT CHECK(pro_role IN ('DOCTOR', 'NURSE', 'SECRETARY', NULL)), -- Sub-role for professionals
        full_name TEXT NOT NULL,
        specialty TEXT, -- For professionals
        rpps_number TEXT, -- For professionals
        bio TEXT, -- Professional biography
        education TEXT, -- JSON string of education history
        experience TEXT, -- JSON string of work experience
        phone TEXT,
        address TEXT,
        photo_url TEXT, -- Profile picture URL
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

  // Patients (Linked to User if they have an account, or standalone)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob DATE NOT NULL,
      gender TEXT,
      email TEXT,
      metadata TEXT, -- JSON string for age-specific info (parent_name, school, profession, etc.)
      share_id TEXT UNIQUE, -- Unique ID for sharing with doctors
      photo_url TEXT, -- Profile picture URL
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure all patients have a share_id
  const patientsWithoutId = db.prepare('SELECT id FROM patients WHERE share_id IS NULL').all();
  if (patientsWithoutId.length > 0) {
    const generateDoctaID = () => {
      const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
      const numbers = '23456789';
      let result = '';
      for (let i = 0; i < 4; i++) result += letters.charAt(Math.floor(Math.random() * letters.length));
      result += '-';
      for (let i = 0; i < 4; i++) result += numbers.charAt(Math.floor(Math.random() * numbers.length));
      return result;
    };
    const updateStmt = db.prepare('UPDATE patients SET share_id = ? WHERE id = ?');
    patientsWithoutId.forEach((p: any) => {
      updateStmt.run(generateDoctaID(), p.id);
    });
  }

  // Doctor-Patient Relationships
  db.exec(`
    CREATE TABLE IF NOT EXISTS doctor_patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES users(id),
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(doctor_id, patient_id)
    );
  `);

  // Medical Records (Fiches-Consultation)
  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL, -- CONSULTATION, BIOLOGY, IMAGING, PRESCRIPTION
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      file_url TEXT, -- URL to uploaded document (PDF, Image)
      structured_data JSON, -- Vitals, diagnosis codes, etc.
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      signature TEXT -- Mock signature for immutability
    );
  `);

  // Access Logs (Audit)
  db.exec(`
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // AI Logs (Amelie AI)
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      patient_id INTEGER REFERENCES patients(id),
      prompt_hash TEXT NOT NULL,
      request_type TEXT NOT NULL,
      query TEXT,
      response_summary TEXT,
      full_response TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add query and full_response to ai_logs if they don't exist
  try {
    db.exec('ALTER TABLE ai_logs ADD COLUMN query TEXT;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE ai_logs ADD COLUMN full_response TEXT;');
  } catch (e) {}

  // Notifications
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Transfers (Patient Record Transfers)
  db.exec(`
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      receiver_id INTEGER NOT NULL REFERENCES users(id),
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      status TEXT CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Appointments
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      doctor_id INTEGER NOT NULL REFERENCES users(id),
      date DATETIME NOT NULL,
      type TEXT DEFAULT 'Consultation',
      status TEXT CHECK(status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')) DEFAULT 'SCHEDULED',
      notes TEXT,
      cancellation_reason TEXT,
      duration TEXT DEFAULT '30min',
      reminder_24h_sent BOOLEAN DEFAULT 0,
      reminder_48h_sent BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Unavailabilities
  db.exec(`
    CREATE TABLE IF NOT EXISTS unavailabilities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES users(id),
      date DATETIME NOT NULL,
      end_date DATETIME, -- For continuous unavailabilities
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add end_date to unavailabilities if it doesn't exist
  try {
    db.exec('ALTER TABLE unavailabilities ADD COLUMN end_date DATETIME;');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE appointments ADD COLUMN duration TEXT DEFAULT \'30min\';');
  } catch (e) {}

  // Availability Windows (Campaigns)
  db.exec(`
    CREATE TABLE IF NOT EXISTS availability_windows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL REFERENCES users(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      start_time TEXT NOT NULL, -- HH:MM
      end_time TEXT NOT NULL,   -- HH:MM
      max_appointments_per_day INTEGER NOT NULL,
      days_of_week TEXT,        -- JSON array of days [0,1,2,3,4,5,6] (0=Sunday)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Vital Signs
  db.exec(`
    CREATE TABLE IF NOT EXISTS vital_signs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      weight REAL, -- kg
      height REAL, -- cm
      blood_pressure_sys INTEGER, -- mmHg
      blood_pressure_dia INTEGER, -- mmHg
      heart_rate INTEGER, -- bpm
      temperature REAL, -- °C
      oxygen_saturation INTEGER, -- %
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Medication Reminders
  db.exec(`
    CREATE TABLE IF NOT EXISTS medication_reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      drug_name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      reminder_time TEXT, -- HH:MM
      reminder_days TEXT, -- JSON array of days (e.g., ["Lundi", "Mercredi"])
      start_date DATE NOT NULL,
      end_date DATE,
      is_active BOOLEAN DEFAULT 1,
      notifications_enabled BOOLEAN DEFAULT 1,
      last_reminder_sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add reminder_time and reminder_days if they don't exist
  try {
    db.exec('ALTER TABLE medication_reminders ADD COLUMN reminder_time TEXT;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE medication_reminders ADD COLUMN reminder_days TEXT;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE medication_reminders ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1;');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE medication_reminders ADD COLUMN last_reminder_sent_at DATETIME;');
  } catch (e) {}

  // Patient History (Pathologies, Surgeries, Treatments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT CHECK(type IN ('PATHOLOGY', 'SURGERY', 'TREATMENT')) NOT NULL,
      description TEXT NOT NULL,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Notification Preferences
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      appointment_reminders BOOLEAN DEFAULT 1,
      new_documents BOOLEAN DEFAULT 1,
      new_messages BOOLEAN DEFAULT 1,
      UNIQUE(user_id)
    );
  `);

  // Professional Settings (Colors, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS pro_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      appointment_colors TEXT, -- JSON string
      dashboard_config TEXT, -- JSON string for widgets layout
      UNIQUE(user_id)
    );
  `);

  // Seed Data if empty
  const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  const patientCount = db.prepare('SELECT count(*) as count FROM patients').get() as { count: number };

  if (userCount.count === 0 || patientCount.count === 0) {
    console.log('Seeding database...');
    // Clear existing data to avoid conflicts if partial data exists
    db.exec('DELETE FROM users; DELETE FROM patients; DELETE FROM doctor_patients; DELETE FROM medical_records; DELETE FROM appointments; DELETE FROM notifications; DELETE FROM transfers;');
    
    const hashedPassword = bcrypt.hashSync('password123', 10);
    
    // Dr. House
    db.prepare(`
      INSERT INTO users (email, password, role, pro_role, full_name, specialty, rpps_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('dr.house@docta.ai', hashedPassword, 'PROFESSIONAL', 'DOCTOR', 'Dr. Gregory House', 'Diagnostician', '10000000001');

    // Nurse Jackie
    db.prepare(`
      INSERT INTO users (email, password, role, pro_role, full_name, specialty)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('nurse.jackie@docta.ai', hashedPassword, 'PROFESSIONAL', 'NURSE', 'Jackie Peyton', 'Emergency Nurse');

    // Secretary Pam
    db.prepare(`
      INSERT INTO users (email, password, role, pro_role, full_name)
      VALUES (?, ?, ?, ?, ?)
    `).run('pam.beesly@docta.ai', hashedPassword, 'PROFESSIONAL', 'SECRETARY', 'Pam Beesly');

    // Patient John Doe
    const patientUser = db.prepare(`
      INSERT INTO users (email, password, role, full_name)
      VALUES (?, ?, ?, ?)
    `).run('john.doe@gmail.com', hashedPassword, 'PATIENT', 'John Doe');

    // Link Patient Profile
    // Use readable Docta ID: 4 letters - 4 numbers (e.g., ABCD-1234)
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
    db.prepare(`
      INSERT INTO patients (user_id, first_name, last_name, dob, gender, share_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(patientUser.lastInsertRowid, 'John', 'Doe', '1980-01-01', 'M', shareId);

    // Link Patient to Doctor
    const patientId = db.prepare('SELECT id FROM patients WHERE user_id = ?').get(patientUser.lastInsertRowid) as { id: number };
    const doctorId = 1;

    db.prepare(`
      INSERT INTO doctor_patients (doctor_id, patient_id)
      VALUES (?, ?)
    `).run(doctorId, patientId.id);

    // Add some medical records

    db.prepare(`
      INSERT INTO medical_records (patient_id, author_id, type, title, content, timestamp, signature)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-10 days'), ?)
    `).run(patientId.id, doctorId, 'CONSULTATION', 'Première consultation', 'Patient présente une toux persistante. Auscultation normale. Prescription de sirop.', 'Signé par Dr. House');
    
    db.prepare(`
      INSERT INTO medical_records (patient_id, author_id, type, title, content, timestamp, signature)
      VALUES (?, ?, ?, ?, ?, datetime('now', '-2 days'), ?)
    `).run(patientId.id, doctorId, 'BIOLOGY', 'Analyse sanguine', 'Hémogramme normal. CRP légèrement élevée (12 mg/L).', 'Signé par Laboratoire Central');

    // Seed Appointments
    db.prepare(`
      INSERT INTO appointments (patient_id, doctor_id, date, status, notes)
      VALUES (?, ?, datetime('now', '+2 days', 'start of day', '+10 hours'), 'SCHEDULED', 'Suivi traitement')
    `).run(patientId.id, doctorId);

    db.prepare(`
      INSERT INTO appointments (patient_id, doctor_id, date, status, notes)
      VALUES (?, ?, datetime('now', '-1 month', 'start of day', '+14 hours'), 'COMPLETED', 'Première visite')
    `).run(patientId.id, doctorId);

    // Seed Vital Signs
    const vitals = [
      { weight: 80, bp_sys: 120, bp_dia: 80, hr: 70, temp: 36.6, o2: 98, days: -30 },
      { weight: 79, bp_sys: 125, bp_dia: 82, hr: 72, temp: 36.8, o2: 97, days: -15 },
      { weight: 78.5, bp_sys: 118, bp_dia: 78, hr: 68, temp: 36.5, o2: 99, days: -2 }
    ];

    vitals.forEach(v => {
      db.prepare(`
        INSERT INTO vital_signs (patient_id, author_id, weight, blood_pressure_sys, blood_pressure_dia, heart_rate, temperature, oxygen_saturation, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
      `).run(patientId.id, doctorId, v.weight, v.bp_sys, v.bp_dia, v.hr, v.temp, v.o2, `${v.days} days`);
    });

    // Seed Dashboard Config
    const defaultConfig = JSON.stringify([
      { id: 'stats', visible: true, position: 0 },
      { id: 'appointments', visible: true, position: 1 },
      { id: 'messages', visible: true, position: 2 },
      { id: 'patients', visible: true, position: 3 }
    ]);
    db.prepare('INSERT INTO pro_settings (user_id, dashboard_config) VALUES (?, ?)').run(doctorId, defaultConfig);

    // Seed Notifications
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '-1 hour'))
    `).run(patientUser.lastInsertRowid, 'Nouveau résultat', 'Analyse sanguine disponible pour John Doe', 0);

    db.prepare(`
      INSERT INTO notifications (user_id, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, datetime('now', '-3 hours'))
    `).run(patientUser.lastInsertRowid, 'Rappel RDV', 'Consultation avec Mme Martin demain à 9h00', 0);

    // Seed Messages
    db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at)
      VALUES (?, ?, ?, datetime('now', '-1 hour'))
    `).run(patientUser.lastInsertRowid, doctorId, 'Bonjour Docteur, j\'ai une question sur mon traitement.');

    db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at)
      VALUES (?, ?, ?, datetime('now', '-45 minutes'))
    `).run(doctorId, patientUser.lastInsertRowid, 'Bonjour John, je vous écoute.');

    db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at)
      VALUES (?, ?, ?, datetime('now', '-30 minutes'))
    `).run(patientUser.lastInsertRowid, doctorId, 'Est-ce que je dois le prendre le matin ou le soir ?');

    db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, content, created_at)
      VALUES (?, ?, ?, datetime('now', '-15 minutes'))
    `).run(doctorId, patientUser.lastInsertRowid, 'Le matin de préférence, avec le petit-déjeuner.');
  }
}

export default db;
