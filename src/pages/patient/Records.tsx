import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, Input } from '@/components/ui';
import { FileText, Download, Eye, Calendar, Clock, Pill, Activity, Microscope, FileSearch, FolderOpen, Search, MapPin, Stethoscope, ChevronRight, CheckCircle2, AlertCircle, ArrowUpDown, TrendingUp, TrendingDown, Minus, X, History as HistoryIcon, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function PatientRecordsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [filter, setFilter] = useState('Tout');
  const [activeTab, setActiveTab] = useState<'documents' | 'appointments' | 'vitals' | 'medications' | 'history'>((searchParams.get('tab') as any) || 'documents');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  const [vitalsSortConfig, setVitalsSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });
  
  // Appointment Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [availabilityWindows, setAvailabilityWindows] = useState<any[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingType, setBookingType] = useState('Consultation');

  // Vitals State
  const [isVitalsDialogOpen, setIsVitalsDialogOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    weight: '',
    height: '',
    blood_pressure_sys: '',
    blood_pressure_dia: '',
    heart_rate: '',
    temperature: '',
    oxygen_saturation: ''
  });

  // Medication State
  const [isMedicationDialogOpen, setIsMedicationDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<any>(null);
  const [editingMedication, setEditingMedication] = useState<any>(null);
  const [medForm, setMedForm] = useState({
    drug_name: '',
    dosage: '',
    instructions: '',
    reminder_times: [] as string[],
    reminder_days: [] as string[],
    frequency: 'Quotidien',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    is_active: true,
    notifications_enabled: true
  });
  const [newTime, setNewTime] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'documents' || tab === 'appointments' || tab === 'vitals' || tab === 'medications' || tab === 'history')) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'documents' | 'appointments' | 'vitals' | 'medications' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recordsRes, appointmentsRes, vitalsRes, medicationsRes, historyRes] = await Promise.all([
        fetch('/api/patient/records'),
        fetch('/api/patient/appointments'),
        fetch('/api/patient/vitals'),
        fetch('/api/patient/medications'),
        fetch('/api/patient/history')
      ]);
      
      if (recordsRes.ok) setRecords(await recordsRes.json());
      if (appointmentsRes.ok) setAppointments(await appointmentsRes.json());
      if (vitalsRes.ok) setVitals(await vitalsRes.json());
      if (medicationsRes.ok) setMedications(await medicationsRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
    } catch (err: any) {
      toast.error('Erreur de chargement', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor && isBookingOpen) {
      fetch(`/api/patient/doctors/${selectedDoctor.id}/availability-windows`)
        .then(res => res.json())
        .then(data => setAvailabilityWindows(data))
        .catch(err => console.error(err));
    }
  }, [selectedDoctor, isBookingOpen]);

  useEffect(() => {
    if (selectedDoctor && bookingDate) {
      fetch(`/api/patient/doctors/${selectedDoctor.id}/availability-status?date=${bookingDate}`)
        .then(res => res.json())
        .then(data => setAvailabilityStatus(data))
        .catch(err => console.error(err));
    } else {
      setAvailabilityStatus(null);
    }
  }, [selectedDoctor, bookingDate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/patient/practitioners?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (error) {
      toast.error('Erreur de recherche');
    } finally {
      setIsSearching(false);
    }
  };

  const handleBook = async () => {
    if (!bookingDate || !bookingTime) {
      toast.error('Veuillez choisir une date et une heure');
      return;
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          date: `${bookingDate}T${bookingTime}:00`,
          type: bookingType
        })
      });

      if (res.ok) {
        toast.success('Rendez-vous demandé', { description: 'Le praticien doit encore confirmer votre demande.' });
        setIsBookingOpen(false);
        setSelectedDoctor(null);
        setBookingDate('');
        setBookingTime('');
        fetchData();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la prise de rendez-vous');
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/patient/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vitalsForm)
      });

      if (res.ok) {
        toast.success('Mesures enregistrées');
        setIsVitalsDialogOpen(false);
        setVitalsForm({
          weight: '',
          height: '',
          blood_pressure_sys: '',
          blood_pressure_dia: '',
          heart_rate: '',
          temperature: '',
          oxygen_saturation: ''
        });
        fetchData();
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMedication ? `/api/patient/medications/${editingMedication.id}` : '/api/patient/medications';
      const method = editingMedication ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...medForm,
          reminder_time: JSON.stringify(medForm.reminder_times),
          reminder_days: medForm.reminder_days
        })
      });

      if (res.ok) {
        toast.success(editingMedication ? 'Médicament mis à jour' : 'Médicament ajouté');
        setIsMedicationDialogOpen(false);
        setEditingMedication(null);
        setMedForm({
          drug_name: '',
          dosage: '',
          instructions: '',
          reminder_times: [],
          reminder_days: [],
          frequency: 'Quotidien',
          start_date: new Date().toISOString().split('T')[0],
          end_date: '',
          is_active: true,
          notifications_enabled: true
        });
        fetchData();
        window.dispatchEvent(new CustomEvent('medicationsUpdated'));
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const handleDeleteMedication = async () => {
    if (!medicationToDelete) return;
    try {
      const res = await fetch(`/api/patient/medications/${medicationToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Médicament supprimé');
        setIsDeleteDialogOpen(false);
        setMedicationToDelete(null);
        fetchData();
        window.dispatchEvent(new CustomEvent('medicationsUpdated'));
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const toggleMedicationStatus = async (med: any) => {
    try {
      const res = await fetch(`/api/patient/medications/${med.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...med, is_active: !med.is_active })
      });
      if (res.ok) {
        fetchData();
        window.dispatchEvent(new CustomEvent('medicationsUpdated'));
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const filteredRecords = records.filter(rec => {
    if (filter === 'Tout') return true;
    if (filter === 'Ordonnances') return rec.type === 'PRESCRIPTION';
    if (filter === 'Analyses') return rec.type === 'BIOLOGY';
    if (filter === 'Comptes-rendus') return rec.type === 'CONSULTATION';
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'PRESCRIPTION': return <Pill className="w-5 h-5" />;
      case 'BIOLOGY': return <Microscope className="w-5 h-5" />;
      case 'CONSULTATION': return <Activity className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'PRESCRIPTION': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'BIOLOGY': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'CONSULTATION': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'PRESCRIPTION': return 'Ordonnance';
      case 'BIOLOGY': return 'Analyse';
      case 'CONSULTATION': return 'Compte-rendu';
      default: return type;
    }
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-600 font-medium animate-pulse">Chargement de vos documents...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mon Dossier Médical</h1>
          <p className="text-slate-500">Consultez et gérez l'ensemble de vos documents médicaux partagés.</p>
        </div>
        <Link to="/patient/documents">
          <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FolderOpen className="w-4 h-4 mr-2" />
            Mes Documents Partagés
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Summary Card */}
        <Card className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-none shadow-lg shadow-emerald-900/10 rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <CardContent className="p-8 relative">
            <h3 className="font-semibold text-emerald-50 mb-1 flex items-center gap-2">
              <FileSearch className="w-4 h-4" />
              Documents Partagés
            </h3>
            <p className="text-4xl font-bold mb-4">{records.length}</p>
            {records.length > 0 && (
              <p className="text-xs text-emerald-100 opacity-90">
                Dernière mise à jour le {new Date(records[0].timestamp).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tabs / Filters */}
        <Card className="md:col-span-2 rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="p-8 flex flex-col justify-center h-full">
            <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
              <button 
                onClick={() => handleTabChange('documents')}
                className={`text-lg font-bold transition-colors ${activeTab === 'documents' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Documents
              </button>
              <button 
                onClick={() => handleTabChange('appointments')}
                className={`text-lg font-bold transition-colors ${activeTab === 'appointments' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Rendez-vous
              </button>
              <button 
                onClick={() => handleTabChange('history')}
                className={`text-lg font-bold transition-colors ${activeTab === 'history' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Antécédents
              </button>
              <button 
                onClick={() => handleTabChange('vitals')}
                className={`text-lg font-bold transition-colors ${activeTab === 'vitals' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Constantes
              </button>
              <button 
                onClick={() => handleTabChange('medications')}
                className={`text-lg font-bold transition-colors ${activeTab === 'medications' ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Médicaments
              </button>
            </div>

            {activeTab === 'documents' ? (
              <div className="space-y-4">
                <span className="text-sm font-bold text-slate-900 block">Filtrer par catégorie</span>
                <div className="flex flex-wrap gap-2">
                  {['Tout', 'Ordonnances', 'Analyses', 'Comptes-rendus'].map((f) => (
                    <button 
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                        filter === f 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/10' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            ) : activeTab === 'appointments' ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Mes Rendez-vous</h4>
                  <p className="text-sm text-slate-500">Consultez vos rendez-vous à venir et passés.</p>
                </div>
                <Button 
                  onClick={() => setIsBookingOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Prendre RDV
                </Button>
              </div>
            ) : activeTab === 'history' ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Mon Historique Médical</h4>
                  <p className="text-sm text-slate-500">Antécédents, pathologies et chirurgies passées.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Lecture seule
                </div>
              </div>
            ) : activeTab === 'vitals' ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Mes Constantes</h4>
                  <p className="text-sm text-slate-500">Suivez l'évolution de vos indicateurs de santé.</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Rapport Complet
                  </Button>
                  <Button 
                    onClick={() => setIsVitalsDialogOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    Ajouter une mesure
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900">Mes Médicaments</h4>
                  <p className="text-sm text-slate-500">Gérez vos traitements et rappels.</p>
                </div>
                <Button 
                  onClick={() => {
                    setEditingMedication(null);
                    setMedForm({
                      drug_name: '',
                      dosage: '',
                      instructions: '',
                      reminder_times: [],
                      reminder_days: [],
                      frequency: 'Quotidien',
                      start_date: new Date().toISOString().split('T')[0],
                      end_date: '',
                      is_active: true,
                      notifications_enabled: true
                    });
                    setIsMedicationDialogOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                >
                  <Pill className="w-4 h-4 mr-2" />
                  Ajouter un médicament
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activeTab === 'documents' ? (
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
            <CardTitle className="text-lg font-bold">Historique des Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredRecords.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {filteredRecords.map((doc) => (
                  <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/80 transition-colors group gap-4">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${getBadgeColor(doc.type)}`}>
                        {getIcon(doc.type)}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg group-hover:text-emerald-700 transition-colors">{doc.title}</h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                            <Calendar className="w-4 h-4" /> {new Date(doc.timestamp).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-slate-400 flex items-center gap-1.5">
                            <Stethoscope className="w-4 h-4" /> Dr. {doc.author_name}
                          </p>
                          <Badge variant="default" className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5", getBadgeColor(doc.type))}>
                            {getTypeName(doc.type)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 sm:opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl hover:bg-emerald-50 hover:text-emerald-700"
                        onClick={() => setSelectedRecord(doc)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Voir
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl border-slate-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-500 font-medium">Aucun document trouvé dans cette catégorie.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === 'appointments' ? (
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
            <CardTitle className="text-lg font-bold">Mes Rendez-vous</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {appointments.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 hover:bg-slate-50/80 transition-colors group gap-4">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${
                        apt.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' :
                        apt.status === 'CANCELLED' ? 'bg-red-100 text-red-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-lg group-hover:text-emerald-700 transition-colors">
                          {apt.type} avec Dr. {apt.doctor_name}
                        </h4>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                          <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                            <Calendar className="w-4 h-4" /> {new Date(apt.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1.5 font-medium">
                            <Clock className="w-4 h-4" /> {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-slate-400 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4" /> {apt.location}
                          </p>
                          <Badge variant="default" className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5", 
                            apt.status === 'SCHEDULED' ? 'bg-emerald-100 text-emerald-700' :
                            apt.status === 'COMPLETED' ? 'bg-slate-100 text-slate-700' :
                            'bg-red-100 text-red-700'
                          )}>
                            {apt.status === 'SCHEDULED' ? 'Confirmé' :
                             apt.status === 'PENDING' ? 'En attente' :
                             apt.status === 'COMPLETED' ? 'Terminé' : 'Annulé'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-500 font-medium">Aucun rendez-vous prévu.</p>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => setIsBookingOpen(true)}>
                  Prendre mon premier rendez-vous
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === 'history' ? (
        <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-8 py-6">
            <CardTitle className="text-lg font-bold">Mon Historique Médical</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {history.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {history.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-slate-50/80 transition-colors group">
                    <div className="flex items-start gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                        item.type === 'PATHOLOGY' ? "bg-red-50 text-red-600" :
                        item.type === 'SURGERY' ? "bg-amber-50 text-amber-600" :
                        item.type === 'ALLERGY' ? "bg-purple-50 text-purple-600" : "bg-emerald-50 text-emerald-600"
                      )}>
                        {item.type === 'PATHOLOGY' ? <Activity className="w-6 h-6" /> :
                         item.type === 'SURGERY' ? <Stethoscope className="w-6 h-6" /> :
                         <FileText className="w-6 h-6" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-900 text-lg">{item.description}</h4>
                          <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-400">
                            {item.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-slate-400" /> {new Date(item.date).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-slate-500 flex items-center gap-1.5">
                            <User className="w-4 h-4 text-slate-400" /> Ajouté par Dr. {item.author_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HistoryIcon className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-500 font-medium">Aucun antécédent médical enregistré.</p>
                <p className="text-sm text-slate-400 mt-2">Seul votre praticien peut ajouter des éléments à votre historique.</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === 'vitals' ? (
        <div className="space-y-6">
          {/* Vitals Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-1">Tension Artérielle</p>
                <div className="flex items-baseline gap-1">
                  <h4 className="text-2xl font-bold text-slate-900">
                    {vitals[0]?.blood_pressure_sys || '--'}/{vitals[0]?.blood_pressure_dia || '--'}
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">mmHg</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Dernière mesure: {vitals[0] ? new Date(vitals[0].timestamp).toLocaleDateString() : 'N/A'}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-1">Pouls</p>
                <div className="flex items-baseline gap-1">
                  <h4 className="text-2xl font-bold text-slate-900">{vitals[0]?.heart_rate || '--'}</h4>
                  <span className="text-xs text-slate-400 font-medium">bpm</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Dernière mesure: {vitals[0] ? new Date(vitals[0].timestamp).toLocaleDateString() : 'N/A'}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-1">Poids</p>
                <div className="flex items-baseline gap-1">
                  <h4 className="text-2xl font-bold text-slate-900">{vitals[0]?.weight || '--'}</h4>
                  <span className="text-xs text-slate-400 font-medium">kg</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Dernière mesure: {vitals[0] ? new Date(vitals[0].timestamp).toLocaleDateString() : 'N/A'}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-slate-100 shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-slate-500 mb-1">Température</p>
                <div className="flex items-baseline gap-1">
                  <h4 className="text-2xl font-bold text-slate-900">{vitals[0]?.temperature || '--'}</h4>
                  <span className="text-xs text-slate-400 font-medium">°C</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Dernière mesure: {vitals[0] ? new Date(vitals[0].timestamp).toLocaleDateString() : 'N/A'}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-bold">Évolution du Poids</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...vitals].reverse().map(v => ({
                      date: new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                      poids: v.weight
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Line type="monotone" dataKey="poids" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-bold">Tension Artérielle</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...vitals].reverse().map(v => ({
                      date: new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                      tension_sys: v.blood_pressure_sys,
                      tension_dia: v.blood_pressure_dia
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Line name="Sys" type="monotone" dataKey="tension_sys" stroke="#3b82f6" strokeWidth={2} dot={{r: 3}} />
                      <Line name="Dia" type="monotone" dataKey="tension_dia" stroke="#60a5fa" strokeWidth={2} dot={{r: 3}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-bold">Fréquence Cardiaque</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...vitals].reverse().map(v => ({
                      date: new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                      pouls: v.heart_rate
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Line type="monotone" dataKey="pouls" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base font-bold">Température</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...vitals].reverse().map(v => ({
                      date: new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
                      temp: v.temperature
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Line type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-8 py-6 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold">Historique des Mesures</CardTitle>
              <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50 rounded-xl">
                <Download className="w-4 h-4 mr-2" />
                Exporter CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tension</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Pouls</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Poids</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Temp</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sat O2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {vitals.map((v, idx) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-4 text-sm font-medium text-slate-900">
                        {new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <Badge variant="outline" className="font-bold border-slate-200 rounded-lg px-2 py-0.5 whitespace-nowrap">
                          {v.blood_pressure_sys}/{v.blood_pressure_dia}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{v.heart_rate} bpm</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-bold">{v.weight} kg</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{v.temperature || '--'} °C</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {v.oxygen_saturation ? `${v.oxygen_saturation}%` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vitals.length === 0 && (
                <div className="py-12 text-center text-slate-400 italic">
                  Aucune donnée enregistrée.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Medications Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {medications.map((med) => (
              <Card key={med.id} className={cn("rounded-3xl border-slate-200 shadow-sm overflow-hidden transition-all", !med.is_active && "opacity-60 grayscale-[0.5]")}>
                <CardHeader className="p-6 pb-2 flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", med.is_active ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
                      <Pill className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-900">{med.drug_name}</CardTitle>
                      <p className="text-sm text-slate-500 font-medium">{med.dosage}</p>
                    </div>
                  </div>
                  <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", med.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>
                    {med.is_active ? 'Actif' : 'Suspendu'}
                  </Badge>
                </CardHeader>
                <CardContent className="p-6 pt-2 space-y-4">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-tight mb-1">Instructions</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{med.instructions || 'Aucune instruction spécifique'}</p>
                  </div>
                  
                  {med.reminder_time && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-2xl border border-blue-100">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-xs text-blue-400 font-bold uppercase tracking-tight">Rappels</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(() => {
                              try {
                                const times = JSON.parse(med.reminder_time);
                                return Array.isArray(times) ? times.map((t, i) => (
                                  <Badge key={i} variant="secondary" className="bg-blue-100 text-blue-700 border-none text-[10px] rounded-full px-2 py-0.5 whitespace-nowrap">{t}</Badge>
                                )) : <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none text-[10px] rounded-full px-2 py-0.5 whitespace-nowrap">{med.reminder_time}</Badge>;
                              } catch (e) {
                                return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-none text-[10px] rounded-full px-2 py-0.5 whitespace-nowrap">{med.reminder_time}</Badge>;
                              }
                            })()}
                          </div>
                        </div>
                      </div>
                      {med.reminder_days && (
                        <div className="flex flex-wrap gap-1 px-1">
                          {(() => {
                            try {
                              const days = JSON.parse(med.reminder_days);
                              return Array.isArray(days) ? days.map((d, i) => (
                                <span key={i} className="text-[10px] font-bold text-slate-400 uppercase">{d.substring(0, 3)}.</span>
                              )) : null;
                            } catch (e) { return null; }
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 rounded-xl border-slate-200 hover:bg-slate-50"
                      onClick={() => {
                        let times = [];
                        try {
                          const parsed = JSON.parse(med.reminder_time);
                          times = Array.isArray(parsed) ? parsed : [med.reminder_time];
                        } catch (e) {
                          times = med.reminder_time ? [med.reminder_time] : [];
                        }

                        setEditingMedication(med);
                        setMedForm({
                          drug_name: med.drug_name,
                          dosage: med.dosage,
                          instructions: med.instructions || '',
                          reminder_times: times,
                          reminder_days: med.reminder_days ? JSON.parse(med.reminder_days) : [],
                          frequency: med.frequency || 'Quotidien',
                          start_date: med.start_date || new Date().toISOString().split('T')[0],
                          end_date: med.end_date || '',
                          is_active: !!med.is_active,
                          notifications_enabled: !!med.notifications_enabled
                        });
                        setIsMedicationDialogOpen(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn("flex-1 rounded-xl", med.is_active ? "border-amber-200 text-amber-700 hover:bg-amber-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")}
                      onClick={() => toggleMedicationStatus(med)}
                    >
                      {med.is_active ? 'Suspendre' : 'Activer'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="rounded-xl border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200"
                      onClick={() => {
                        setMedicationToDelete(med);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {medications.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Pill className="w-10 h-10 text-slate-200" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Aucun médicament enregistré</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2">Ajoutez vos traitements en cours pour recevoir des rappels et assurer un meilleur suivi.</p>
                <Button 
                  className="mt-6 bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                  onClick={() => setIsMedicationDialogOpen(true)}
                >
                  Ajouter un médicament
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Medication Dialog */}
      <Dialog open={isMedicationDialogOpen} onClose={() => setIsMedicationDialogOpen(false)}>
        <div className="p-8 max-w-lg w-full space-y-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">
              {editingMedication ? 'Modifier le médicament' : 'Ajouter un médicament'}
            </h2>
          </div>

          <form onSubmit={handleSaveMedication} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Nom du médicament</label>
                <Input 
                  placeholder="ex: Paracétamol" 
                  className="rounded-xl"
                  value={medForm.drug_name}
                  onChange={e => setMedForm({...medForm, drug_name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Dosage</label>
                <Input 
                  placeholder="ex: 1000mg" 
                  className="rounded-xl"
                  value={medForm.dosage}
                  onChange={e => setMedForm({...medForm, dosage: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Fréquence</label>
              <select 
                className="w-full rounded-xl border-slate-200 p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                value={medForm.frequency}
                onChange={e => setMedForm({...medForm, frequency: e.target.value})}
                required
              >
                <option value="Quotidien">Quotidien</option>
                <option value="Hebdomadaire">Hebdomadaire</option>
                <option value="Mensuel">Mensuel</option>
                <option value="Si besoin">Si besoin</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Instructions / Posologie</label>
              <textarea 
                className="w-full rounded-xl border-slate-200 p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-h-[80px]"
                placeholder="ex: À prendre après le repas..."
                value={medForm.instructions}
                onChange={e => setMedForm({...medForm, instructions: e.target.value})}
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold text-slate-700">Heures des rappels</label>
              <div className="flex gap-2">
                <Input 
                  type="time" 
                  className="rounded-xl flex-1"
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl"
                  onClick={() => {
                    if (newTime && !medForm.reminder_times.includes(newTime)) {
                      setMedForm({...medForm, reminder_times: [...medForm.reminder_times, newTime].sort()});
                      setNewTime('');
                    }
                  }}
                >
                  Ajouter
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {medForm.reminder_times.map(t => (
                  <Badge key={t} variant="secondary" className="pl-3 pr-1 py-1 rounded-lg bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-2">
                    {t}
                    <button 
                      type="button" 
                      onClick={() => setMedForm({...medForm, reminder_times: medForm.reminder_times.filter(time => time !== t)})}
                      className="hover:text-emerald-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Jours de la semaine</label>
              <div className="flex flex-wrap gap-2">
                {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      const days = medForm.reminder_days.includes(day)
                        ? medForm.reminder_days.filter(d => d !== day)
                        : [...medForm.reminder_days, day];
                      setMedForm({...medForm, reminder_days: days});
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                      medForm.reminder_days.includes(day)
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                    )}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Date de début</label>
                <Input 
                  type="date" 
                  className="rounded-xl"
                  value={medForm.start_date}
                  onChange={e => setMedForm({...medForm, start_date: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Date de fin (optionnel)</label>
                <Input 
                  type="date" 
                  className="rounded-xl"
                  value={medForm.end_date}
                  onChange={e => setMedForm({...medForm, end_date: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="notif_enabled"
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={medForm.notifications_enabled}
                onChange={e => setMedForm({...medForm, notifications_enabled: e.target.checked})}
              />
              <label htmlFor="notif_enabled" className="text-sm font-medium text-slate-600 cursor-pointer">Activer les notifications</label>
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setIsMedicationDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold shadow-lg shadow-emerald-900/10">
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Vitals Dialog */}
      <Dialog open={isVitalsDialogOpen} onClose={() => setIsVitalsDialogOpen(false)}>
        <div className="p-8 max-w-lg w-full space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Ajouter une mesure</h2>
          </div>
          
          <form onSubmit={handleSaveVitals} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Poids (kg)</label>
                <Input 
                  type="number"
                  step="0.1"
                  placeholder="ex: 75.5"
                  value={vitalsForm.weight}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, weight: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Taille (cm)</label>
                <Input 
                  type="number"
                  placeholder="ex: 175"
                  value={vitalsForm.height}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, height: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tension Systolique</label>
                <Input 
                  type="number"
                  placeholder="ex: 120"
                  value={vitalsForm.blood_pressure_sys}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_sys: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tension Diastolique</label>
                <Input 
                  type="number"
                  placeholder="ex: 80"
                  value={vitalsForm.blood_pressure_dia}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, blood_pressure_dia: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Pouls (bpm)</label>
                <Input 
                  type="number"
                  placeholder="ex: 72"
                  value={vitalsForm.heart_rate}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, heart_rate: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Température (°C)</label>
                <Input 
                  type="number"
                  step="0.1"
                  placeholder="ex: 36.6"
                  value={vitalsForm.temperature}
                  onChange={(e) => setVitalsForm({ ...vitalsForm, temperature: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Saturation O2 (%)</label>
              <Input 
                type="number"
                placeholder="ex: 98"
                value={vitalsForm.oxygen_saturation}
                onChange={(e) => setVitalsForm({ ...vitalsForm, oxygen_saturation: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsVitalsDialogOpen(false)} className="flex-1 rounded-xl">
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold">
                Enregistrer
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onClose={() => setIsDeleteDialogOpen(false)}>
        <div className="p-8 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Confirmer la suppression</h2>
            <p className="text-slate-500 mt-2">
              Êtes-vous sûr de vouloir supprimer le médicament <span className="font-bold text-slate-900">"{medicationToDelete?.drug_name}"</span> ? 
              Cette action est irréversible.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl font-bold" onClick={handleDeleteMedication}>
              Supprimer
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecord} onClose={() => setSelectedRecord(null)}>
        {selectedRecord && (
          <div className="max-w-2xl w-full">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl">
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="default" className={`uppercase tracking-widest font-bold px-3 py-1 ${getBadgeColor(selectedRecord.type)}`}>
                  {getTypeName(selectedRecord.type)}
                </Badge>
                <span className="text-sm text-slate-500 font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(selectedRecord.timestamp).toLocaleDateString()}
                  <span className="text-slate-300">•</span>
                  <Clock className="w-4 h-4" />
                  {new Date(selectedRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">{selectedRecord.title}</h2>
              <div className="flex items-center gap-3 mt-4 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shadow-inner">
                  {selectedRecord.author_name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Dr. {selectedRecord.author_name}</p>
                  <p className="text-xs text-slate-500 font-medium">{selectedRecord.author_specialty}</p>
                </div>
              </div>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto bg-white">
              <div className="prose prose-slate max-w-none">
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-base">
                  {selectedRecord.content}
                </p>
              </div>

              {selectedRecord.type === 'PRESCRIPTION' && (
                <div className="mt-8 p-6 bg-blue-50/50 rounded-3xl border border-blue-100 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Pill className="w-24 h-24" />
                  </div>
                  <h4 className="text-blue-900 font-bold mb-4 flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    Détails de l'ordonnance
                  </h4>
                  <div className="space-y-3 text-sm text-blue-800 font-medium">
                    <p>• Document certifié conforme</p>
                    <p>• Valable en pharmacie sur présentation du Docta ID</p>
                    <p>• Signature électronique apposée</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30 rounded-b-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
              {selectedRecord.signature ? (
                <div className="flex items-center gap-3 text-xs text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 font-bold shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Signé électroniquement : {selectedRecord.signature}
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 px-4 py-2 rounded-full border border-amber-100 font-bold">
                  Document non signé
                </div>
              )}
              <div className="flex gap-2 w-full sm:w-auto">
                <Button className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 rounded-xl">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Appointment Booking Dialog */}
      <Dialog open={isBookingOpen} onClose={() => setIsBookingOpen(false)}>
        <div className="p-6 space-y-6 max-w-2xl w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Prendre un rendez-vous</h2>
          </div>

          {!selectedDoctor ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="Rechercher un praticien..." 
                    className="pl-10 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={isSearching}>
                  {isSearching ? '...' : 'Rechercher'}
                </Button>
              </form>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {searchResults.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        {doc.full_name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">Dr. {doc.full_name}</p>
                        <p className="text-xs text-slate-500">{doc.specialty}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setSelectedDoctor(doc)}>
                      Choisir
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="w-12 h-12 rounded-full bg-white text-emerald-700 flex items-center justify-center font-bold shadow-sm">
                  {selectedDoctor.full_name[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900">Dr. {selectedDoctor.full_name}</p>
                  <p className="text-sm text-slate-600">{selectedDoctor.specialty}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {selectedDoctor.address}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="ml-auto text-slate-400" onClick={() => setSelectedDoctor(null)}>Changer</Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Date du rendez-vous</label>
                  <Input 
                    type="date" 
                    className="rounded-xl" 
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Heure souhaitée</label>
                  <Input 
                    type="time" 
                    className="rounded-xl"
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                  />
                </div>
              </div>

              {availabilityStatus && (
                <div className={`p-4 rounded-2xl border ${availabilityStatus.available ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                  <p className="text-sm font-bold flex items-center gap-2">
                    {availabilityStatus.available ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Créneau disponible ({availabilityStatus.start_time} - {availabilityStatus.end_time})
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4" />
                        {availabilityStatus.error || 'Aucune disponibilité à cette date.'}
                      </>
                    )}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Type de consultation</label>
                <div className="flex gap-2">
                  {['Consultation', 'Suivi', 'Urgence'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setBookingType(t)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                        bookingType === t 
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 text-lg font-bold shadow-lg shadow-emerald-900/20"
                disabled={!availabilityStatus?.available}
                onClick={handleBook}
              >
                Confirmer la demande de RDV
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
