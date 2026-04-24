import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Dialog, Input, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Bell, CheckCircle2, XCircle, Calendar, AlertCircle, QrCode as QrIcon, Printer, Trash2, Info, List } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { useAuth } from '@/context/AuthContext';

export default function AgendaPage({ initialView: propInitialView }: { initialView?: 'day' | 'week' | 'month' | 'availability' }) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialView = propInitialView || (searchParams.get('view') as any) || 'day';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'list' | 'availability'>(initialView);
  const [showNewEventDialog, setShowNewEventDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [availabilityWindows, setAvailabilityWindows] = useState<any[]>([]);
  const [showAvailabilityCalendar, setShowAvailabilityCalendar] = useState(false);
  const [newWindow, setNewWindow] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '15:00',
    max_appointments_per_day: 10,
    days_of_week: [] as number[]
  });
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [eventType, setEventType] = useState<'appointment' | 'unavailability'>('appointment');
  const [newEvent, setNewEvent] = useState({
    patientId: '',
    date: currentDate.toISOString().split('T')[0],
    end_date: currentDate.toISOString().split('T')[0],
    time: '09:00',
    type: 'Consultation',
    duration: '30min',
    reason: ''
  });
  const [events, setEvents] = useState<any[]>([]);
  const [unavailabilities, setUnavailabilities] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('Tous');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterStatus, setFilterStatus] = useState('Tous');
  const [showHistory, setShowHistory] = useState(false);
  const [cancelReasonDialog, setCancelReasonDialog] = useState<{ open: boolean, appointmentId: number | null }>({ open: false, appointmentId: null });
  const [cancelReason, setCancelReason] = useState('');
  const [appointmentColors, setAppointmentColors] = useState<Record<string, string>>({
    'Consultation': '#3b82f6',
    'Téléconsultation': '#8b5cf6',
    'Suivi': '#10b981',
    'Urgence': '#ef4444'
  });

  useEffect(() => {
    fetchPatients();
    fetchColors();
    fetchAvailabilityWindows();
  }, []);

  useEffect(() => {
    fetchAgendaDynamicData();
  }, [currentDate, viewMode, filterType, filterPatient, filterStatus]);

  const fetchAgendaDynamicData = async () => {
    // Optimization: combine these or use Promise.all
    await Promise.all([
      fetchAppointments(),
      fetchUnavailabilities()
    ]);
  };

  const fetchAvailabilityWindows = async () => {
    try {
      const res = await fetch('/api/pro/availability-windows');
      const data = await res.json();
      setAvailabilityWindows(data);
    } catch (error) {
      console.error('Error fetching availability windows:', error);
    }
  };

  const handleCreateAvailabilityWindow = async () => {
    try {
      const res = await fetch('/api/pro/availability-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWindow)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Plage de disponibilité créée');
        fetchAvailabilityWindows();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleDeleteAvailabilityWindow = async (id: number) => {
    try {
      const res = await fetch(`/api/pro/availability-windows/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Plage de disponibilité supprimée');
        fetchAvailabilityWindows();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen is often 'PrintScreen' or 'Snapshot'
      if (e.key === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault();
        setShowQrDialog(true);
      }
      // Add Ctrl+Q as a more reliable shortcut
      if (e.key === 'q' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowQrDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchColors = async () => {
    try {
      const res = await fetch('/api/pro/settings');
      const data = await res.json();
      if (data.appointment_colors) {
        setAppointmentColors(JSON.parse(data.appointment_colors));
      }
    } catch (error) {
      console.error('Error fetching colors:', error);
    }
  };

  const fetchPatients = () => {
    fetch('/api/patients')
      .then(res => res.json())
      .then(setPatients)
      .catch(console.error);
  };

  const fetchAppointments = () => {
    let url = '/api/pro/appointments?';
    
    if (viewMode === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0];
      url += `date=${dateStr}`;
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1)); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      
      url += `startDate=${startOfWeek.toISOString().split('T')[0]}&endDate=${endOfWeek.toISOString().split('T')[0]}`;
    } else if (viewMode === 'month') {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      url += `startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`;
    }

    if (filterType !== 'Tous') url += `&type=${filterType}`;
    if (filterPatient) url += `&patientId=${filterPatient}`;
    if (filterStatus !== 'Tous') url += `&status=${filterStatus}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const formattedEvents = data.map((apt: any) => {
          const date = new Date(apt.date);
          const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return {
            id: apt.id,
            date: apt.date.split('T')[0],
            time: time,
            patient: `${apt.first_name} ${apt.last_name}`,
            type: apt.type || 'Consultation',
            duration: '30min', 
            reminder_24h: apt.reminder_24h_sent,
            reminder_48h: apt.reminder_48h_sent,
            status: apt.status,
            cancellation_reason: apt.cancellation_reason,
            isUnavailability: false
          };
        });
        setEvents(formattedEvents);
      })
      .catch(console.error);
  };

  const fetchUnavailabilities = () => {
    let url = '/api/pro/unavailabilities?';
    
    if (viewMode === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0];
      url += `date=${dateStr}`;
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1)); // Monday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
      
      url += `startDate=${startOfWeek.toISOString().split('T')[0]}&endDate=${endOfWeek.toISOString().split('T')[0]}`;
    } else if (viewMode === 'month') {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      url += `startDate=${startOfMonth.toISOString().split('T')[0]}&endDate=${endOfMonth.toISOString().split('T')[0]}`;
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((u: any) => {
          const date = new Date(u.date);
          const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return {
            id: u.id,
            date: u.date.split('T')[0],
            time: time,
            reason: u.reason,
            isUnavailability: true
          };
        });
        setUnavailabilities(formatted);
      })
      .catch(console.error);
  };

  const handleCancelAppointment = async (id: number, reason?: string) => {
    try {
      const response = await fetch(`/api/pro/appointments/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Rendez-vous annulé');
        setCancelReasonDialog({ open: false, appointmentId: null });
        setCancelReason('');
        fetchAppointments();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleConfirmAppointment = async (id: number) => {
    try {
      const response = await fetch(`/api/pro/appointments/${id}/confirm`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Rendez-vous confirmé');
        fetchAppointments();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleCompleteAppointment = async (id: number) => {
    try {
      const response = await fetch(`/api/pro/appointments/${id}/complete`, {
        method: 'PUT',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Rendez-vous marqué comme terminé');
        fetchAppointments();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleDeleteUnavailability = async (id: number) => {
    try {
      const response = await fetch(`/api/pro/unavailabilities/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Plage horaire libérée');
        fetchUnavailabilities();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const nextPeriod = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day' || viewMode === 'list') {
      next.setDate(currentDate.getDate() + 1);
    } else if (viewMode === 'week') {
      next.setDate(currentDate.getDate() + 7);
    } else {
      next.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(next);
  };

  const prevPeriod = () => {
    const prev = new Date(currentDate);
    if (viewMode === 'day' || viewMode === 'list') {
      prev.setDate(currentDate.getDate() - 1);
    } else if (viewMode === 'week') {
      prev.setDate(currentDate.getDate() - 7);
    } else {
      prev.setMonth(currentDate.getMonth() - 1);
    }
    setCurrentDate(prev);
  };

  const handleCreateEvent = async () => {
    if (eventType === 'appointment') {
      if (!newEvent.patientId || !newEvent.time || !newEvent.date) {
        toast.error('Veuillez remplir tous les champs obligatoires');
        return;
      }

      const fullDateTime = `${newEvent.date}T${newEvent.time}:00`;

      try {
        const response = await fetch('/api/pro/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: newEvent.patientId,
            date: fullDateTime,
            type: newEvent.type,
            duration: newEvent.duration
          }),
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Rendez-vous créé avec succès');
          setShowNewEventDialog(false);
          fetchAppointments();
        } else {
          throw new Error(data.error);
        }
      } catch (error: any) {
        toast.error('Erreur', { description: error.message });
      }
    } else {
      if (!newEvent.time || !newEvent.date) {
        toast.error('Veuillez remplir la date et l\'heure');
        return;
      }

      const fullDateTime = `${newEvent.date}T${newEvent.time}:00`;
      const fullEndDateTime = newEvent.end_date ? `${newEvent.end_date}T${newEvent.time}:00` : null;

      try {
        const response = await fetch('/api/pro/unavailabilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: fullDateTime,
            end_date: fullEndDateTime,
            reason: newEvent.reason
          }),
        });

        const data = await response.json();
        if (data.success) {
          toast.success('Plage horaire marquée comme indisponible');
          setShowNewEventDialog(false);
          fetchUnavailabilities();
        } else {
          throw new Error(data.error);
        }
      } catch (error: any) {
        toast.error('Erreur', { description: error.message });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-100 animate-pulse">En attente</Badge>;
      case 'SCHEDULED':
        return <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Programmé</Badge>;
      case 'COMPLETED':
        return <Badge variant="success">Terminé</Badge>;
      case 'CANCELLED':
        return <Badge variant="error">Annulé</Badge>;
      default:
        return null;
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Padding for first week (Monday start)
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    for (let i = 0; i < startPadding; i++) {
      const d = new Date(year, month, 1 - (startPadding - i));
      days.push({ date: d, isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Padding for last week
    const endPadding = 42 - days.length;
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const MonthView = () => {
    const days = getDaysInMonth(currentDate);
    const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {weekDays.map(d => (
            <div key={d} className="p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-100 last:border-0">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
          {days.map((dayObj, i) => {
            const dateStr = dayObj.date.toISOString().split('T')[0];
            const dayEvents = events.filter(e => e.date === dateStr);
            const dayUnavailabilities = unavailabilities.filter(u => u.date === dateStr);
            const isToday = dayObj.date.toDateString() === new Date().toDateString();
            const isCurrentMonth = dayObj.isCurrentMonth;

            return (
              <div 
                key={i} 
                className={`min-h-[100px] p-2 border-r border-b border-slate-100 last:border-r-0 relative group hover:bg-slate-50/50 transition-colors ${!isCurrentMonth ? 'bg-slate-50/30' : ''} ${isToday ? 'bg-blue-50/20' : ''}`}
                onClick={() => {
                  setCurrentDate(dayObj.date);
                  setViewMode('day');
                }}
              >
                {/* Availability Indicator */}
                {(() => {
                  const hasAvailability = availabilityWindows.some(w => {
                    const start = new Date(w.start_date);
                    const end = new Date(w.end_date);
                    const days = w.days_of_week ? JSON.parse(w.days_of_week) : [0, 1, 2, 3, 4, 5, 6];
                    return dayObj.date >= start && dayObj.date <= end && days.includes(dayObj.date.getDay());
                  });
                  return hasAvailability && (
                    <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-500 rounded-full m-1 shadow-sm" title="Disponibilité configurée" />
                  );
                })()}

                <div className="flex justify-between items-start mb-1">
                  <span className={`text-xs font-bold ${isToday ? 'text-blue-600 bg-blue-100 w-7 h-7 flex items-center justify-center rounded-full' : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                    {dayObj.date.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[9px] min-w-[1.25rem] flex justify-center">
                      {dayEvents.length}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map(e => (
                    <div 
                      key={e.id} 
                      className="text-[8px] truncate px-1 py-0.5 rounded border-l-2 mb-0.5"
                      style={{ 
                        backgroundColor: `${appointmentColors[e.type] || '#3b82f6'}15`,
                        borderLeftColor: appointmentColors[e.type] || '#3b82f6',
                        color: appointmentColors[e.type] || '#3b82f6'
                      }}
                    >
                      {e.time} {e.patient}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[8px] text-slate-400 pl-1">+{dayEvents.length - 3} autres</p>
                  )}
                  {dayUnavailabilities.length > 0 && (
                    <div className="text-[8px] truncate px-1 py-0.5 rounded bg-slate-100 text-slate-500 border-l-2 border-slate-400">
                      Indisponible
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const registrationLink = `${window.location.origin}/register?ref=${user?.id}`;

  const handlePrintQr = () => {
    window.print();
  };

  const AvailabilityView = () => (
    <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              Gestion des Disponibilités
            </h2>
            <p className="text-slate-500 mt-2 max-w-md">Définissez vos plages horaires pour permettre aux patients de prendre rendez-vous en ligne.</p>
          </div>
          <div className="flex gap-3">
            <div className="bg-white p-1 rounded-xl border border-slate-100 shadow-sm flex">
              <Button 
                variant={!showAvailabilityCalendar ? "secondary" : "ghost"} 
                size="sm" 
                className="rounded-lg h-9"
                onClick={() => setShowAvailabilityCalendar(false)}
              >
                <List className="w-4 h-4 mr-2" />
                Liste
              </Button>
              <Button 
                variant={showAvailabilityCalendar ? "secondary" : "ghost"} 
                size="sm" 
                className="rounded-lg h-9"
                onClick={() => setShowAvailabilityCalendar(true)}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendrier
              </Button>
            </div>
            <Button onClick={() => setShowAvailabilityDialog(true)} icon={Plus} className="rounded-2xl shadow-xl shadow-blue-200 h-12 px-6">
              Nouvelle Plage Horaire
            </Button>
          </div>
        </div>

        {showAvailabilityCalendar ? (
          <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Aperçu des disponibilités</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="text-xs text-slate-500 font-medium">Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-slate-100 rounded-full" />
                  <span className="text-xs text-slate-500 font-medium">Fermé</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
                <div key={d} className="p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider border-r border-slate-100 last:border-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 grid-rows-6">
              {getDaysInMonth(currentDate).map((dayObj, i) => {
                const hasAvailability = availabilityWindows.some(w => {
                  const start = new Date(w.start_date);
                  const end = new Date(w.end_date);
                  const days = w.days_of_week ? JSON.parse(w.days_of_week) : [0, 1, 2, 3, 4, 5, 6];
                  return dayObj.date >= start && dayObj.date <= end && days.includes(dayObj.date.getDay());
                });
                const isToday = dayObj.date.toDateString() === new Date().toDateString();
                const isCurrentMonth = dayObj.isCurrentMonth;

                return (
                  <div 
                    key={i} 
                    className={cn(
                      "min-h-[80px] p-2 border-r border-b border-slate-100 last:border-r-0 relative transition-all",
                      !isCurrentMonth ? "bg-slate-50/30" : "bg-white",
                      hasAvailability && isCurrentMonth ? "bg-emerald-50/30" : ""
                    )}
                  >
                    <span className={cn(
                      "text-xs font-bold",
                      isToday ? "text-blue-600 bg-blue-100 w-7 h-7 flex items-center justify-center rounded-full" : 
                      isCurrentMonth ? "text-slate-700" : "text-slate-400"
                    )}>
                      {dayObj.date.getDate()}
                    </span>
                    {hasAvailability && isCurrentMonth && (
                      <div className="mt-2 space-y-1">
                        {availabilityWindows
                          .filter(w => {
                            const start = new Date(w.start_date);
                            const end = new Date(w.end_date);
                            const days = w.days_of_week ? JSON.parse(w.days_of_week) : [0, 1, 2, 3, 4, 5, 6];
                            return dayObj.date >= start && dayObj.date <= end && days.includes(dayObj.date.getDay());
                          })
                          .map(w => (
                            <div key={w.id} className="text-[8px] font-bold text-emerald-700 bg-emerald-100/50 px-1.5 py-0.5 rounded-md border border-emerald-200/50 truncate">
                              {w.start_time} - {w.end_time}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availabilityWindows.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-10 h-10 text-slate-200" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Aucune plage configurée</h3>
                  <p className="text-slate-500 mt-1">Commencez par ajouter vos premières disponibilités.</p>
                  <Button variant="outline" className="mt-6 rounded-xl" onClick={() => setShowAvailabilityDialog(true)}>
                    Ajouter une disponibilité
                  </Button>
                </div>
              ) : (
                availabilityWindows.map((window) => {
                  const now = new Date();
                  const startDate = new Date(window.start_date);
                  const endDate = new Date(window.end_date);
                  const isActive = now >= startDate && now <= endDate;
                  const days = window.days_of_week ? JSON.parse(window.days_of_week) : [0, 1, 2, 3, 4, 5, 6];

                  return (
                    <Card key={window.id} className="rounded-[2rem] border-slate-100 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden bg-white">
                      <div className={cn("absolute top-0 left-0 w-2 h-full transition-colors", isActive ? "bg-emerald-500" : "bg-slate-300")} />
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary" className={cn("font-bold text-[10px] uppercase tracking-wider", isActive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-600 border-slate-200")}>
                              {isActive ? 'Actif' : 'Planifié'}
                            </Badge>
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                              {window.max_appointments_per_day} RDV / Jour max
                            </span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0 rounded-full transition-colors"
                            onClick={() => handleDeleteAvailabilityWindow(window.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <CardTitle className="text-2xl font-black text-slate-900 mt-4 flex items-baseline gap-2">
                          {window.start_time}
                          <span className="text-slate-300 text-lg font-light">à</span>
                          {window.end_time}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <Calendar className="w-5 h-5 text-blue-500" />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Période de validité</span>
                            <span className="text-xs font-semibold text-slate-700">
                              {new Date(window.start_date).toLocaleDateString('fr-FR')} — {new Date(window.end_date).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Jours d'ouverture</span>
                          <div className="flex justify-between items-center px-1">
                            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((label, idx) => {
                              const isSelected = days.includes(idx);
                              return (
                                <div 
                                  key={idx}
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border",
                                    isSelected 
                                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200" 
                                      : "bg-white text-slate-300 border-slate-100"
                                  )}
                                >
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="relative flex flex-col md:flex-row gap-8 items-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 backdrop-blur-sm">
                  <Info className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h4 className="text-xl font-bold mb-2">Optimisez votre temps</h4>
                  <p className="text-blue-100 leading-relaxed">
                    Vos plages de disponibilité permettent aux patients de solliciter des rendez-vous. 
                    Les demandes sont classées par ordre d'arrivée. Vous recevez une notification pour chaque demande et pouvez 
                    la confirmer ou la refuser directement depuis votre agenda.
                  </p>
                </div>
                <div className="flex gap-4">
                  <Button variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50 rounded-xl" onClick={() => setShowQrDialog(true)}>
                    Partager mon QR Code
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const handleUpdateColors = async (newColors: Record<string, string>) => {
    try {
      const res = await fetch('/api/pro/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_colors: newColors })
      });
      const data = await res.json();
      if (data.success) {
        setAppointmentColors(newColors);
        toast.success('Couleurs mises à jour');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour des couleurs');
    }
  };

  return (
    <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
      {/* Printable Area (Hidden on screen) */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] p-12 text-center">
        <div className="max-w-md mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-slate-900">Docta AI</h1>
            <p className="text-xl text-slate-600">Cabinet Médical de {user?.name}</p>
          </div>
          
          <div className="flex justify-center p-8 bg-white border-4 border-slate-900 rounded-3xl">
            <QRCode value={registrationLink} size={350} />
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Scannez pour vous inscrire</h2>
            <p className="text-lg text-slate-500">
              Créez votre dossier médical numérique et restez connecté avec votre praticien.
            </p>
          </div>

          <div className="pt-12 border-t border-slate-200">
            <p className="text-sm text-slate-400 font-mono">{registrationLink}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="text-slate-500 text-sm">
            {currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Jour
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Sem.
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Mois
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Liste
            </button>
            <button 
              onClick={() => setViewMode('availability')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'availability' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              Disponibilités
            </button>
          </div>
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1">
            <button onClick={prevPeriod} className="p-2 hover:bg-slate-100 rounded-md"><ChevronLeft className="w-4 h-4" /></button>
            <div className="relative group flex items-center">
              <button onClick={() => setCurrentDate(new Date())} className="px-2 text-[10px] font-bold uppercase hover:bg-slate-100 rounded-md h-8">Auj.</button>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <div className="relative flex items-center">
                <Calendar className="w-3 h-3 text-slate-400 absolute left-2 pointer-events-none" />
                <input 
                  type="date" 
                  className="h-8 pl-7 pr-2 text-[10px] font-bold uppercase bg-transparent border-none focus:ring-0 cursor-pointer w-28"
                  value={currentDate.toISOString().split('T')[0]}
                  onChange={(e) => e.target.value && setCurrentDate(new Date(e.target.value))}
                />
              </div>
            </div>
            <button onClick={nextPeriod} className="p-2 hover:bg-slate-100 rounded-md"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              icon={Info} 
              onClick={() => setShowSettingsDialog(true)}
              className="rounded-xl h-9"
            >
              <span className="hidden sm:inline">Couleurs</span>
              <span className="sm:hidden">Coul.</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              icon={Clock} 
              onClick={() => setShowHistory(!showHistory)}
              className={cn("rounded-xl h-9", showHistory ? 'bg-slate-100' : '')}
            >
              <span className="hidden sm:inline">{showHistory ? 'Masquer Historique' : 'Voir Historique'}</span>
              <span className="sm:hidden">Hist.</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              icon={QrIcon} 
              onClick={() => setShowQrDialog(true)}
              className="rounded-xl h-9"
            >
              <span className="hidden sm:inline">Mon QR Code</span>
              <span className="sm:hidden">QR</span>
            </Button>
            <Button icon={Plus} size="sm" className="rounded-xl h-9" onClick={() => {
              setEventType('appointment');
              setShowNewEventDialog(true);
            }}>
              <span className="hidden sm:inline">Nouveau RDV</span>
              <span className="sm:hidden">RDV</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 print:hidden">
        <div className="flex-1 flex flex-wrap gap-4">
          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Statut</label>
            <select 
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="Tous">Tous les statuts</option>
              <option value="REQUESTED">En attente</option>
              <option value="SCHEDULED">Programmé</option>
              <option value="COMPLETED">Terminé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type de RDV</label>
            <select 
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option>Tous</option>
              <option>Consultation</option>
              <option>Suivi</option>
              <option>Urgence</option>
              <option>Téléconsultation</option>
            </select>
          </div>
          <div className="w-full sm:w-64">
            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Filtrer par Patient</label>
            <select 
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filterPatient}
              onChange={(e) => setFilterPatient(e.target.value)}
            >
              <option value="">Tous les patients</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {events.filter(e => e.status === 'REQUESTED').length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm uppercase tracking-wider">
            <Bell className="w-4 h-4 animate-bounce" />
            Demandes de rendez-vous en attente ({events.filter(e => e.status === 'REQUESTED').length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.filter(e => e.status === 'REQUESTED').map((event, index) => (
              <Card key={event.id} className="border-amber-100 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">
                  Rang #{index + 1}
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-slate-900">{event.patient}</p>
                      <p className="text-xs text-slate-500">{new Date(event.date).toLocaleDateString('fr-FR')} • {event.time}</p>
                    </div>
                    <Badge variant="warning" className="bg-amber-100 text-amber-700 border-none text-[10px]">Nouveau</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                      onClick={() => handleConfirmAppointment(event.id)}
                    >
                      Accepter
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-100 text-xs h-8"
                      onClick={() => setCancelReasonDialog({ open: true, appointmentId: event.id })}
                    >
                      Refuser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex gap-6 overflow-hidden print:hidden">
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {viewMode === 'day' ? (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 gap-4">
                {Array.from({ length: 11 }).map((_, i) => {
                  const hour = i + 8; // Start at 8:00
                  const timeString = `${hour.toString().padStart(2, '0')}:00`;
                  const filteredEvents = events.filter(e => e.time.startsWith(hour.toString().padStart(2, '0')));
                  const event = filterStatus !== 'Tous' 
                    ? filteredEvents.find(e => e.status === filterStatus)
                    : filteredEvents.find(e => e.status === 'SCHEDULED') || filteredEvents[0];
                  const unavailability = unavailabilities.find(u => u.time.startsWith(hour.toString().padStart(2, '0')));

                  return (
                    <div key={hour} className="flex gap-4 group min-h-[100px] relative">
                      {new Date().getHours() === hour && new Date().toDateString() === currentDate.toDateString() && (
                        <div 
                          className="absolute left-16 right-0 h-0.5 bg-red-400 z-20 pointer-events-none"
                          style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }}
                        >
                          <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-400 rounded-full border-2 border-white" />
                        </div>
                      )}
                      <div className="w-16 text-right text-sm text-slate-400 font-mono pt-2 border-r border-slate-100 pr-4">
                        {timeString}
                      </div>
                      <div className="flex-1 relative pt-2 pb-4 border-b border-slate-50 group-last:border-0">
                        {event ? (
                          <div 
                            className="absolute top-2 left-0 right-0 p-3 rounded-r-lg cursor-pointer transition-colors shadow-sm border-l-4"
                            style={{ 
                              backgroundColor: `${appointmentColors[event.type] || '#3b82f6'}15`,
                              borderLeftColor: appointmentColors[event.type] || '#3b82f6',
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold text-sm" style={{ color: appointmentColors[event.type] || '#3b82f6' }}>
                                    {event.patient}
                                  </p>
                                  {getStatusBadge(event.status)}
                                </div>
                                <p className="text-xs opacity-80 mb-2" style={{ color: appointmentColors[event.type] || '#3b82f6' }}>{event.type}</p>
                                
                                {event.status === 'CANCELLED' && event.cancellation_reason && (
                                  <div className="mb-2 p-2 bg-white/50 rounded-lg border border-red-200/30">
                                    <p className="text-[10px] text-red-600 italic">
                                      <span className="font-bold not-italic uppercase mr-1">Motif:</span>
                                      {event.cancellation_reason}
                                    </p>
                                  </div>
                                )}

                                <div className="flex gap-2 mt-1">
                                  <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${event.reminder_48h ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                    {event.reminder_48h ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    J-2
                                  </div>
                                  <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${event.reminder_24h ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                    {event.reminder_24h ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                    J-1
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center text-xs gap-1 opacity-70" style={{ color: appointmentColors[event.type] || '#3b82f6' }}>
                                  <Clock className="w-3 h-3" /> {event.duration}
                                </div>
                                {event.status === 'REQUESTED' && (
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="primary" 
                                      className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleConfirmAppointment(event.id);
                                      }}
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" /> Confirmer
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelReasonDialog({ open: true, appointmentId: event.id });
                                      }}
                                    >
                                      <XCircle className="w-3 h-3 mr-1" /> Refuser
                                    </Button>
                                  </div>
                                )}
                                {event.status === 'SCHEDULED' && (
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompleteAppointment(event.id);
                                      }}
                                    >
                                      <CheckCircle2 className="w-3 h-3 mr-1" /> Terminer
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="h-7 text-[10px] text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCancelReasonDialog({ open: true, appointmentId: event.id });
                                      }}
                                    >
                                      <XCircle className="w-3 h-3 mr-1" /> Annuler
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : unavailability ? (
                          <div className="absolute top-2 left-0 right-0 p-3 rounded-r-lg bg-slate-100 border-l-4 border-slate-400 shadow-sm">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-slate-500" />
                                <p className="text-sm font-semibold text-slate-700">{unavailability.reason || 'Indisponible'}</p>
                                <Badge variant="default">Indisponible</Badge>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-7 text-[10px] text-slate-500 hover:text-red-600"
                                onClick={() => handleDeleteUnavailability(unavailability.id)}
                              >
                                Libérer
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className="h-full w-full hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-100 border-dashed flex items-center justify-center opacity-0 group-hover:opacity-100"
                            onClick={() => {
                              setNewEvent({ ...newEvent, time: timeString });
                              setEventType('appointment');
                              setShowNewEventDialog(true);
                            }}
                          >
                            <Plus className="w-4 h-4 text-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex border-b border-slate-100 bg-slate-50/50">
                <div className="w-16 border-r border-slate-100"></div>
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = new Date(currentDate);
                  day.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1) + i);
                  const isToday = day.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} className={`flex-1 p-2 text-center border-r border-slate-100 last:border-0 ${isToday ? 'bg-blue-50/30' : ''}`}>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</p>
                      <p className={`text-sm font-bold ${isToday ? 'text-blue-600' : 'text-slate-700'}`}>{day.getDate()}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="flex min-h-full">
                  <div className="w-16 border-r border-slate-100 bg-slate-50/30">
                    {Array.from({ length: 11 }).map((_, i) => (
                      <div key={i} className="h-20 text-right pr-2 pt-2 text-[10px] text-slate-400 font-mono border-b border-slate-50">
                        {(i + 8).toString().padStart(2, '0')}:00
                      </div>
                    ))}
                  </div>
                  {Array.from({ length: 7 }).map((_, dayIdx) => {
                    const day = new Date(currentDate);
                    day.setDate(currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() === 0 ? -6 : 1) + dayIdx);
                    const dateStr = day.toISOString().split('T')[0];
                    
                    return (
                      <div key={dayIdx} className="flex-1 border-r border-slate-100 last:border-0 relative">
                        {Array.from({ length: 11 }).map((_, hourIdx) => {
                          const hour = hourIdx + 8;
                          const timeString = `${hour.toString().padStart(2, '0')}:00`;
                          const dayEvents = events.filter(e => e.date === dateStr && e.time.startsWith(hour.toString().padStart(2, '0')));
                          const event = filterStatus !== 'Tous' 
                            ? dayEvents.find(e => e.status === filterStatus)
                            : dayEvents.find(e => e.status === 'SCHEDULED') || dayEvents[0];
                          const unavailability = unavailabilities.find(u => u.date === dateStr && u.time.startsWith(hour.toString().padStart(2, '0')));

                          return (
                            <div 
                              key={hourIdx} 
                              className="h-20 border-b border-slate-50 group relative"
                              onClick={() => {
                                if (!event && !unavailability) {
                                  setNewEvent({ ...newEvent, date: dateStr, time: timeString });
                                  setEventType('appointment');
                                  setShowNewEventDialog(true);
                                }
                              }}
                            >
                              {event ? (
                                <div 
                                  className="absolute inset-1 p-2 rounded-lg border-l-4 overflow-hidden cursor-pointer hover:shadow-lg transition-all z-10 flex flex-col justify-between"
                                  style={{ 
                                    backgroundColor: `${appointmentColors[event.type] || '#3b82f6'}15`,
                                    borderLeftColor: appointmentColors[event.type] || '#3b82f6',
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <div className="flex flex-col gap-0.5">
                                    <p className="text-[10px] font-bold truncate leading-tight" style={{ color: appointmentColors[event.type] || '#3b82f6' }}>
                                      {event.patient}
                                    </p>
                                    <p className="text-[9px] font-medium opacity-80 truncate" style={{ color: appointmentColors[event.type] || '#3b82f6' }}>
                                      {event.time} • {event.type}
                                    </p>
                                  </div>
                                  <div className="flex justify-between items-center mt-1">
                                    <div className="flex gap-1">
                                      {event.status === 'COMPLETED' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                      {event.status === 'CANCELLED' && <XCircle className="w-3 h-3 text-red-500" />}
                                    </div>
                                    {event.status === 'SCHEDULED' && (
                                      <Badge variant="secondary" className="h-3 px-1 text-[7px] bg-white/50 border-none">Prévu</Badge>
                                    )}
                                  </div>
                                </div>
                              ) : unavailability ? (
                                <div className="absolute inset-1 p-2 rounded-lg bg-slate-100 border-l-4 border-slate-400 z-10 shadow-sm">
                                  <p className="text-[9px] font-bold text-slate-500 truncate">{unavailability.reason || 'Indisponible'}</p>
                                  <p className="text-[8px] text-slate-400">Bloqué</p>
                                </div>
                              ) : (
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-blue-50/30 flex items-center justify-center cursor-pointer">
                                  <Plus className="w-3 h-3 text-blue-300" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : viewMode === 'availability' ? (
            <AvailabilityView />
          ) : viewMode === 'list' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-800">Liste des rendez-vous - {currentDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</h3>
                <div className="flex gap-2">
                  {Object.entries(appointmentColors).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] text-slate-500 font-medium">{type}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {events.length === 0 ? (
                <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">Aucun rendez-vous pour cette journée.</p>
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => setShowNewEventDialog(true)}>
                    En programmer un
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {events.sort((a, b) => a.time.localeCompare(b.time)).map(event => (
                    <Card key={event.id} className="border-slate-100 hover:shadow-md transition-all">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-16 text-center border-r border-slate-100 pr-4">
                          <p className="text-sm font-black text-slate-900">{event.time}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{event.duration}</p>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-slate-900">{event.patient}</h4>
                            {getStatusBadge(event.status)}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: appointmentColors[event.type] }} />
                              <span className="text-xs text-slate-600">{event.type}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border", event.reminder_48h ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>J-2</span>
                              <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border", event.reminder_24h ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100")}>J-1</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {event.status === 'SCHEDULED' && (
                            <>
                              <Button size="sm" className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleCompleteAppointment(event.id)}>Terminer</Button>
                              <Button size="sm" variant="ghost" className="h-8 px-3 text-red-600" onClick={() => setCancelReasonDialog({ open: true, appointmentId: event.id })}>Annuler</Button>
                            </>
                          )}
                          {event.status === 'REQUESTED' && (
                            <>
                              <Button size="sm" className="h-8 px-3 bg-blue-600" onClick={() => handleConfirmAppointment(event.id)}>Confirmer</Button>
                              <Button size="sm" variant="ghost" className="h-8 px-3 text-amber-600" onClick={() => setCancelReasonDialog({ open: true, appointmentId: event.id })}>Réfuser</Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <MonthView />
          )}
        </div>

        {showHistory && (
          <div className="w-80 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Historique du jour
              </h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">Terminés & Annulés</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {events.filter(e => e.status !== 'SCHEDULED').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                    <Calendar className="w-6 h-6 text-slate-300" />
                  </div>
                  <p className="text-sm text-slate-400">Aucun rendez-vous terminé ou annulé pour cette journée.</p>
                </div>
              ) : (
                <>
                  {/* Section Terminés */}
                  {events.filter(e => e.status === 'COMPLETED').length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3" />
                        Terminés
                      </h4>
                      <div className="space-y-2">
                        {events.filter(e => e.status === 'COMPLETED').map(event => (
                          <div 
                            key={event.id}
                            className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">{event.patient}</p>
                                <p className="text-[10px] text-slate-500">{event.time} • {event.type}</p>
                              </div>
                              {getStatusBadge(event.status)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section Annulés */}
                  {events.filter(e => e.status === 'CANCELLED').length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-bold text-red-600 uppercase tracking-widest flex items-center gap-2">
                        <XCircle className="w-3 h-3" />
                        Annulés
                      </h4>
                      <div className="space-y-2">
                        {events.filter(e => e.status === 'CANCELLED').map(event => (
                          <div 
                            key={event.id}
                            className="p-3 rounded-xl border border-red-50 bg-white shadow-sm space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm text-slate-900">{event.patient}</p>
                                <p className="text-[10px] text-slate-500">{event.time} • {event.type}</p>
                              </div>
                              {getStatusBadge(event.status)}
                            </div>
                            {event.cancellation_reason && (
                              <div className="pt-2 border-t border-red-50">
                                <p className="text-[10px] text-red-600 italic">
                                  <span className="font-bold not-italic uppercase mr-1">Motif:</span>
                                  {event.cancellation_reason}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Availability Windows Dialog */}
      <Dialog 
        open={showAvailabilityDialog} 
        onClose={() => setShowAvailabilityDialog(false)}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Gérer mes plages de disponibilité</h2>
          </div>
          
          <p className="text-sm text-slate-500">
            Définissez des périodes où les patients peuvent prendre rendez-vous avec une limite quotidienne.
          </p>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Du</label>
              <Input 
                type="date" 
                value={newWindow.start_date}
                onChange={(e) => setNewWindow({ ...newWindow, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Au</label>
              <Input 
                type="date" 
                value={newWindow.end_date}
                onChange={(e) => setNewWindow({ ...newWindow, end_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">De</label>
              <Input 
                type="time" 
                value={newWindow.start_time}
                onChange={(e) => setNewWindow({ ...newWindow, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">À</label>
              <Input 
                type="time" 
                value={newWindow.end_time}
                onChange={(e) => setNewWindow({ ...newWindow, end_time: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Jours de la semaine</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 1, label: 'Lun' },
                  { id: 2, label: 'Mar' },
                  { id: 3, label: 'Mer' },
                  { id: 4, label: 'Jeu' },
                  { id: 5, label: 'Ven' },
                  { id: 6, label: 'Sam' },
                  { id: 0, label: 'Dim' }
                ].map(day => (
                  <button
                    key={day.id}
                    onClick={() => {
                      const current = newWindow.days_of_week;
                      if (current.includes(day.id)) {
                        setNewWindow({ ...newWindow, days_of_week: current.filter(d => d !== day.id) });
                      } else {
                        setNewWindow({ ...newWindow, days_of_week: [...current, day.id] });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      newWindow.days_of_week.includes(day.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 italic">Laissez vide pour tous les jours</p>
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Nombre max de RDV par jour</label>
              <Input 
                type="number" 
                value={newWindow.max_appointments_per_day}
                onChange={(e) => setNewWindow({ ...newWindow, max_appointments_per_day: parseInt(e.target.value) })}
              />
            </div>
            <Button className="col-span-2" onClick={handleCreateAvailabilityWindow}>Ajouter la plage</Button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Plages actives</h4>
            <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Période</th>
                    <th className="p-3 text-[10px] font-bold text-slate-500 uppercase">Horaires</th>
                    <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-center">RDV/J</th>
                    <th className="p-3 text-[10px] font-bold text-slate-500 uppercase text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {availabilityWindows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-sm text-slate-400 text-center italic">Aucune plage de disponibilité définie.</td>
                    </tr>
                  ) : (
                    availabilityWindows.map(window => (
                      <tr key={window.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3">
                          <p className="text-xs font-bold text-slate-900">
                            {new Date(window.start_date).toLocaleDateString('fr-FR')} - {new Date(window.end_date).toLocaleDateString('fr-FR')}
                          </p>
                          {window.days_of_week && JSON.parse(window.days_of_week).length > 0 && (
                            <p className="text-[10px] text-slate-500">
                              {JSON.parse(window.days_of_week).map((d: number) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]).join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-xs text-slate-600">
                          {window.start_time} - {window.end_time}
                        </td>
                        <td className="p-3 text-xs text-slate-600 text-center">
                          {window.max_appointments_per_day}
                        </td>
                        <td className="p-3 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:bg-red-50 h-7 px-2 text-[10px]"
                            onClick={() => handleDeleteAvailabilityWindow(window.id)}
                          >
                            Supprimer
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Settings Dialog for Colors */}
      <Dialog open={showSettingsDialog} onClose={() => setShowSettingsDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Personnaliser les couleurs</h2>
          </div>
          <p className="text-sm text-slate-500">
            Attribuez des couleurs spécifiques aux types de rendez-vous pour une meilleure lisibilité de votre agenda.
          </p>
          <div className="space-y-4">
            {Object.entries(appointmentColors).map(([type, color]) => (
              <div key={type} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-sm font-medium text-slate-700">{type}</span>
                <div className="flex items-center gap-3">
                  <input 
                    type="color" 
                    value={color}
                    onChange={(e) => handleUpdateColors({ ...appointmentColors, [type]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <div className="w-6 h-6 rounded-full border border-slate-200 shadow-sm" style={{ backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
          </div>
        </div>
      </Dialog>

      <Dialog open={showNewEventDialog} onClose={() => setShowNewEventDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {eventType === 'appointment' ? 'Nouveau Rendez-vous' : 'Marquer comme Indisponible'}
            </h2>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button 
                onClick={() => setEventType('appointment')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${eventType === 'appointment' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                RDV
              </button>
              <button 
                onClick={() => setEventType('unavailability')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${eventType === 'unavailability' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
              >
                Indisponible
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {eventType === 'appointment' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Patient</label>
                  <select 
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newEvent.patientId}
                    onChange={(e) => setNewEvent({...newEvent, patientId: e.target.value})}
                  >
                    <option value="">Sélectionner un patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date</label>
                    <Input 
                      type="date" 
                      value={newEvent.date} 
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Heure</label>
                    <Input 
                      type="time" 
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select 
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newEvent.type}
                    onChange={(e) => setNewEvent({...newEvent, type: e.target.value})}
                  >
                    <option>Consultation</option>
                    <option>Suivi</option>
                    <option>Urgence</option>
                    <option>Téléconsultation</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date de début</label>
                    <Input 
                      type="date" 
                      value={newEvent.date} 
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Date de fin (optionnel)</label>
                    <Input 
                      type="date" 
                      value={newEvent.end_date} 
                      onChange={(e) => setNewEvent({...newEvent, end_date: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Heure</label>
                  <Input 
                    type="time" 
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Motif (optionnel)</label>
                  <Input 
                    placeholder="Ex: Réunion, Déjeuner, Congés..." 
                    value={newEvent.reason}
                    onChange={(e) => setNewEvent({...newEvent, reason: e.target.value})}
                  />
                </div>
              </>
            )}
            
            <div className="pt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowNewEventDialog(false)}>Annuler</Button>
              <Button onClick={handleCreateEvent}>Confirmer</Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Cancellation Reason Dialog */}
      <Dialog open={cancelReasonDialog.open} onClose={() => setCancelReasonDialog({ open: false, appointmentId: null })}>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-600">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Annuler le rendez-vous</h2>
          </div>
          
          <p className="text-sm text-slate-500">
            Veuillez indiquer le motif de l'annulation pour ce rendez-vous.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Motif d'annulation</label>
            <textarea 
              className="w-full h-24 rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              placeholder="Ex: Patient malade, empêchement professionnel..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCancelReasonDialog({ open: false, appointmentId: null })}>
              Garder le RDV
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => cancelReasonDialog.appointmentId && handleCancelAppointment(cancelReasonDialog.appointmentId, cancelReason)}
            >
              Confirmer l'annulation
            </Button>
          </div>
        </div>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onClose={() => setShowQrDialog(false)}>
        <div className="p-8 text-center space-y-6 max-w-sm mx-auto">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <QrIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Votre QR Code Praticien</h2>
            <p className="text-sm text-slate-500 mt-1">
              Faites scanner ce code à vos patients pour les lier à votre cabinet.
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-slate-50 flex flex-col items-center space-y-4 shadow-inner">
            <QRCode 
              value={registrationLink}
              size={180}
              level="H"
            />
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lien d'inscription</p>
              <p className="text-[10px] font-mono text-blue-600 break-all">{registrationLink}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handlePrintQr} icon={Printer} className="w-full h-11 rounded-xl">
              Imprimer le QR Code
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
