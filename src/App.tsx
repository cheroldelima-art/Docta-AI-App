import * as React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import LoginPage from '@/pages/auth/Login';
import RegisterPage from '@/pages/auth/Register';
import ProLayout from '@/layouts/ProLayout';
import ProDashboard from '@/pages/pro/Dashboard';
import PatientRecord from '@/pages/pro/PatientRecord';
import AgendaPage from '@/pages/pro/Agenda';
import PatientsPage from '@/pages/pro/Patients';
import MessagesPage from '@/pages/pro/Messages';
import SettingsPage from '@/pages/pro/Settings';
import ProNotificationsPage from '@/pages/pro/Notifications';
import AmeliePage from '@/pages/pro/Amelie';
import AmelieHistoryPage from '@/pages/pro/AmelieHistory';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import PatientLayout from '@/layouts/PatientLayout';
import PatientDashboard from '@/pages/patient/Dashboard';
import PatientRecordsPage from '@/pages/patient/Records';
import PatientMessagesPage from '@/pages/patient/Messages';
import PatientSettingsPage from '@/pages/patient/Settings';
import PatientDoctorsPage from '@/pages/patient/Doctors';
import PatientNotificationsPage from '@/pages/patient/Notifications';
import PatientDocumentsPage from '@/pages/patient/Documents';

import { Toaster } from 'sonner';
import { SocketProvider } from '@/context/SocketContext';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Pro Routes */}
              <Route path="/pro" element={<ProLayout />}>
                <Route path="dashboard" element={<ProDashboard />} />
                <Route path="agenda" element={<AgendaPage />} />
                <Route path="patient/:id" element={<PatientRecord />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="notifications" element={<ProNotificationsPage />} />
                <Route path="amelie" element={<AmeliePage />} />
                <Route path="amelie/history" element={<AmelieHistoryPage />} />
              </Route>

              {/* Patient Routes */}
              <Route path="/patient" element={<PatientLayout />}>
                <Route path="dashboard" element={<PatientDashboard />} />
                <Route path="records" element={<PatientRecordsPage />} />
                <Route path="doctors" element={<PatientDoctorsPage />} />
                <Route path="messages" element={<PatientMessagesPage />} />
                <Route path="documents" element={<PatientDocumentsPage />} />
                <Route path="settings" element={<PatientSettingsPage />} />
                <Route path="notifications" element={<PatientNotificationsPage />} />
              </Route>

              {/* Redirects */}
              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
            <Toaster position="top-right" richColors />
          </SocketProvider>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
