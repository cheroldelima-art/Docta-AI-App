import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { Copy, QrCode, ChevronRight, Stethoscope, FileText, MessageSquare, User, Activity, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function PatientDashboard() {
  const [patientData, setPatientData] = useState<any>(null);
  const [recentRecords, setRecentRecords] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/patient/dashboard-data');
      if (!res.ok) {
        if (res.status === 404) throw new Error('PRO_PROFILE_ONLY');
        throw new Error('Erreur lors de la récupération des données.');
      }
      
      const data = await res.json();
      setPatientData(data.patient);
      setRecentRecords(data.recentRecords);
      setAppointments(data.upcomingAppointments);
      setVitals(data.latestVitals ? [data.latestVitals] : []);
      setMedications(data.medications);
    } catch (err: any) {
      if (err.message === 'PRO_PROFILE_ONLY') {
        setPatientData(null);
      } else {
        toast.error('Erreur', { description: err.message });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-emerald-600 font-medium animate-pulse">Chargement de votre espace...</p>
      </div>
    );
  }

  if (!patientData) {
    return (
      <div className="p-8 text-center max-w-md mx-auto">
        <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Stethoscope className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Interface Professionnelle</h2>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Vous êtes actuellement connecté avec un compte <strong>Praticien</strong>. 
          Pour consulter vos dossiers patients et gérer votre activité, veuillez utiliser l'interface dédiée aux professionnels.
        </p>
        <Button onClick={() => window.location.href = '/pro/dashboard'} className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 font-bold shadow-lg shadow-emerald-900/10 transition-all hover:scale-[1.02]">
          Accéder à mon Espace Pro
        </Button>
        <p className="mt-6 text-xs text-slate-400">
          Si vous êtes également un patient, assurez-vous d'utiliser le compte approprié ou contactez le support.
        </p>
      </div>
    );
  }

  const copyToClipboard = () => {
    if (patientData?.share_id) {
      navigator.clipboard.writeText(patientData.share_id);
      toast.success('ID copié dans le presse-papier');
    }
  };

  const getVitalStatus = (type: string, value: any, value2?: any) => {
    if (value === null || value === undefined || value === '') return null;
    const numValue = Number(value);
    
    if (type === 'bp') {
      const sys = numValue;
      const dia = Number(value2) || 0;
      if (sys >= 140 || dia >= 90) return { label: 'Élevée', color: 'text-red-600 bg-red-50 border-red-100' };
      if (sys >= 121 || dia >= 81) return { label: 'Limite', color: 'text-amber-600 bg-amber-50 border-amber-100' };
      if (sys < 90 || dia < 60) return { label: 'Basse', color: 'text-blue-600 bg-blue-50 border-blue-100' };
      return { label: 'Normale', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    }
    if (type === 'hr') {
      const val = numValue;
      if (val > 100) return { label: 'Élevé', color: 'text-red-600 bg-red-50 border-red-100' };
      if (val < 60) return { label: 'Bas', color: 'text-blue-600 bg-blue-50 border-blue-100' };
      return { label: 'Normal', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    }
    if (type === 'temp') {
      const val = numValue;
      if (val > 38) return { label: 'Fièvre', color: 'text-red-600 bg-red-50 border-red-100' };
      if (val > 37.2) return { label: 'Élevée', color: 'text-amber-600 bg-amber-50 border-amber-100' };
      if (val < 36) return { label: 'Basse', color: 'text-blue-600 bg-blue-50 border-blue-100' };
      return { label: 'Normale', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    }
    if (type === 'spo2') {
      const val = numValue;
      if (val < 92) return { label: 'Critique', color: 'text-red-600 bg-red-50 border-red-100' };
      if (val < 95) return { label: 'Faible', color: 'text-amber-600 bg-amber-50 border-amber-100' };
      return { label: 'Normal', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-2 sm:px-0">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            {patientData.photo_url ? (
              <img 
                src={patientData.photo_url} 
                alt={patientData.first_name} 
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-100 shadow-md"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-emerald-200">
                {patientData.first_name[0].toUpperCase()}{patientData.last_name[0].toUpperCase()}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Bonjour, {patientData.first_name} 👋</h1>
            <p className="text-slate-500 text-sm sm:text-base font-medium">Votre santé est notre priorité aujourd'hui.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            Patient Vérifié
          </Badge>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Docta ID & Vitals (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Docta ID Card - Prominent but not a link */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full -ml-32 -mb-32 blur-3xl" />
            
            <div className="relative flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="space-y-4 text-center md:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-white/5">
                  <QrCode className="w-3 h-3" />
                  Identifiant Unique Docta
                </div>
                <h2 className="text-3xl font-bold tracking-tight">Votre Docta ID</h2>
                <p className="text-slate-400 text-sm max-w-md leading-relaxed">
                  Partagez ce code avec vos professionnels de santé pour un accès sécurisé à votre historique médical complet.
                </p>
              </div>
              
              <div className="flex items-center gap-4 bg-white/5 p-6 rounded-[1.5rem] backdrop-blur-xl border border-white/10 shadow-2xl">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-black mb-2">Code de partage</p>
                  <p className="text-4xl font-mono font-bold tracking-[0.15em] text-emerald-400">
                    {patientData?.share_id || '---- ----'}
                  </p>
                </div>
                <div className="h-16 w-px bg-white/10 mx-2"></div>
                <Button 
                  onClick={copyToClipboard} 
                  variant="ghost" 
                  className="text-white hover:bg-white/10 h-14 w-14 rounded-2xl p-0 transition-transform active:scale-95"
                >
                  <Copy className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>

          {/* Vitals & Records Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vitals Card */}
            <Card className="rounded-[2rem] border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Activity className="w-7 h-7" />
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none">Dernière mesure</Badge>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Mes Constantes</h3>
                {vitals.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900">
                          {vitals[0].blood_pressure_sys}/{vitals[0].blood_pressure_dia}
                        </span>
                        <span className="text-slate-400 font-bold">mmHg</span>
                      </div>
                      {(() => {
                        const status = getVitalStatus('bp', vitals[0].blood_pressure_sys, vitals[0].blood_pressure_dia);
                        return status && (
                          <Badge className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase font-black border", status.color)}>
                            {status.label}
                          </Badge>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {vitals[0].heart_rate && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <Activity className="w-4 h-4 text-red-500" />
                            {(() => {
                              const status = getVitalStatus('hr', vitals[0].heart_rate);
                              return status && <span className={cn("text-[8px] font-black uppercase", status.color.split(' ')[0])}>{status.label}</span>;
                            })()}
                          </div>
                          <p className="text-lg font-bold text-slate-900">{vitals[0].heart_rate} <span className="text-[10px] text-slate-400 font-medium">bpm</span></p>
                          <p className="text-[10px] text-slate-500 font-medium">Pouls</p>
                        </div>
                      )}
                      {vitals[0].temperature && (
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="flex items-center justify-between mb-1">
                            <Stethoscope className="w-4 h-4 text-emerald-500" />
                            {(() => {
                              const status = getVitalStatus('temp', vitals[0].temperature);
                              return status && <span className={cn("text-[8px] font-black uppercase", status.color.split(' ')[0])}>{status.label}</span>;
                            })()}
                          </div>
                          <p className="text-lg font-bold text-slate-900">{vitals[0].temperature} <span className="text-[10px] text-slate-400 font-medium">°C</span></p>
                          <p className="text-[10px] text-slate-500 font-medium">Temp.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-sm text-slate-500 pt-2 border-t border-slate-50">
                      <Clock className="w-4 h-4 text-emerald-500" />
                      Mesuré le {new Date(vitals[0].timestamp).toLocaleDateString()}
                    </div>
                  </div>
                ) : (
                  <div className="py-4">
                    <p className="text-slate-400 italic text-sm">Aucune donnée enregistrée.</p>
                  </div>
                )}
                <Link to="/patient/records?tab=vitals" className="absolute inset-0 z-10" />
                <div className="mt-6 flex items-center text-emerald-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Voir l'historique complet <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>

            {/* Recent Documents Card */}
            <Card className="rounded-[2rem] border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <FileText className="w-7 h-7" />
                  </div>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none">Nouveau</Badge>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Derniers Documents</h3>
                <div className="space-y-3">
                  {recentRecords.length > 0 ? (
                    recentRecords.slice(0, 2).map((record) => (
                      <div key={record.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50/50 border border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-600 shadow-sm">
                          {record.type === 'PRESCRIPTION' ? <PillIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{record.title}</p>
                          <p className="text-[10px] text-slate-500">{new Date(record.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic text-sm">Aucun document récent.</p>
                  )}
                </div>
                <Link to="/patient/records" className="absolute inset-0 z-10" />
                <div className="mt-6 flex items-center text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Accéder à mon dossier <ChevronRight className="w-4 h-4 ml-1" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column: Appointments & Medications (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Next Appointment Card */}
          <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-2 border-none">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Rendez-vous
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {appointments.length > 0 ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white text-emerald-600 flex flex-col items-center justify-center shrink-0 shadow-sm border border-emerald-100">
                        <span className="text-[10px] font-black uppercase leading-none mb-1">{new Date(appointments[0].date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                        <span className="text-xl font-black leading-none">{new Date(appointments[0].date).getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">Dr. {appointments[0].doctor_name}</p>
                        <p className="text-xs text-slate-500 mb-2">{appointments[0].doctor_specialty}</p>
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            {new Date(appointments[0].date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs" asChild>
                    <Link to="/patient/doctors">Gérer mes rendez-vous</Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400 font-medium">Aucun rendez-vous</p>
                  <Link to="/patient/doctors" className="text-xs text-emerald-600 font-bold hover:underline mt-1 inline-block">Prendre RDV</Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Medications Card */}
          <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
            <CardHeader className="pb-2 border-none">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                <PillIcon className="w-5 h-5 text-emerald-600" />
                Médicaments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2">
              {(() => {
                const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });
                const todayFormatted = today.charAt(0).toUpperCase() + today.slice(1);
                const medsToday = medications.filter(med => {
                  if (!med.is_active) return false;
                  const days = med.reminder_days ? JSON.parse(med.reminder_days) : [];
                  return days.length === 0 || days.includes(todayFormatted);
                }).sort((a, b) => (a.reminder_time || '23:59').localeCompare(b.reminder_time || '23:59'));

                if (medsToday.length > 0) {
                  return (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {medsToday.slice(0, 3).map(med => (
                          <div key={med.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white text-emerald-600 flex items-center justify-center shadow-sm">
                                <PillIcon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">{med.drug_name}</p>
                                <p className="text-[10px] text-slate-500">{med.dosage}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-white text-emerald-600 border-emerald-100 text-[10px] font-bold">
                              {med.reminder_time || 'Daily'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                      <Button variant="outline" className="w-full rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs" asChild>
                        <Link to="/patient/records?tab=medications">Voir mon planning</Link>
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <PillIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Pas de traitement aujourd'hui</p>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Health Tips & Activity */}
          <div className="space-y-6">
            <Card className="rounded-[2rem] border-slate-100 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  Activités Récentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                {recentRecords.length > 0 ? (
                  <div className="space-y-3">
                    {recentRecords.map((record) => (
                      <div key={record.id} className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                          record.type === 'PRESCRIPTION' ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {record.type === 'PRESCRIPTION' ? <PillIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{record.title}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{new Date(record.timestamp).toLocaleDateString()}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-black border-slate-200 text-slate-400">
                          {record.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-sm text-slate-400 italic">Aucune activité récente.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-slate-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Conseils Santé
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-2 space-y-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <DropletsIcon className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Hydratation</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Boire 1.5L d'eau par jour aide à maintenir une bonne concentration et favorise l'élimination des toxines.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                      <MoonIcon className="w-4 h-4" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Sommeil</h4>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Essayez de maintenir des horaires de coucher réguliers pour améliorer la qualité de votre sommeil profond.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></svg>
  );
}

function DropletsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 16.3c2.2 0 4-1.8 4-4 0-3.3-4-8-4-8s-4 4.7-4 8c0 2.2 1.8 4 4 4Z"/><path d="M17 22c2.2 0 4-1.8 4-4 0-3.3-4-8-4-8s-4 4.7-4 8c0 2.2 1.8 4 4 4Z"/><path d="M15 8c1.1 0 2-.9 2-2 0-1.7-2-4-2-4s-2 2.3-2 4c0 1.1.9 2 2 2Z"/></svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
  );
}
