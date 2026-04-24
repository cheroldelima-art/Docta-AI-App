import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Dialog } from '@/components/ui';
import { Search, UserPlus, FileText, Calendar, Clock, ChevronRight, Sparkles, Save, Users, TrendingUp, FileClock, Settings2, Eye, EyeOff, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface WidgetConfig {
  id: string;
  visible: boolean;
  position: number;
}

export default function ProDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [showNewPatientDialog, setShowNewPatientDialog] = useState(false);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'M',
    email: '',
    metadata: {} as any
  });
  const [stats, setStats] = useState({
    todayAppointments: 0,
    totalPatients: 0,
    pendingActions: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/pro/dashboard-summary');
      const data = await res.json();
      
      if (data.dashboardSettings) {
        setWidgets(data.dashboardSettings.sort((a: any, b: any) => a.position - b.position));
      } else {
        setWidgets(defaultWidgets);
      }
      
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (e) {
      setWidgets(defaultWidgets);
    } finally {
      setIsLoading(false);
    }
  };

  const defaultWidgets: WidgetConfig[] = [
    { id: 'stats', visible: true, position: 0 },
    { id: 'agenda_cta', visible: true, position: 1 },
    { id: 'search', visible: true, position: 2 },
    { id: 'recent', visible: true, position: 3 },
    { id: 'documents', visible: true, position: 4 }
  ];

  const saveDashboardConfig = async () => {
    try {
      const res = await fetch('/api/pro/settings/dashboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: widgets }),
      });
      if (res.ok) {
        toast.success('Configuration enregistrée');
        setIsCustomizeMode(false);
      }
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  const toggleWidget = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const index = widgets.findIndex(w => w.id === id);
    if (direction === 'up' && index > 0) {
      const newWidgets = [...widgets];
      [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
      setWidgets(newWidgets.map((w, i) => ({ ...w, position: i })));
    } else if (direction === 'down' && index < widgets.length - 1) {
      const newWidgets = [...widgets];
      [newWidgets[index + 1], newWidgets[index]] = [newWidgets[index], newWidgets[index + 1]];
      setWidgets(newWidgets.map((w, i) => ({ ...w, position: i })));
    }
  };

  useEffect(() => {
    if (searchQuery.length > 2) {
      fetch(`/api/patients?q=${searchQuery}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setPatients(data);
          } else {
            setPatients([]);
          }
        })
        .catch(() => setPatients([]));
    } else {
      setPatients([]);
    }
  }, [searchQuery]);

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const patientAge = calculateAge(newPatient.dob);
  const isChild = patientAge < 12 && newPatient.dob !== '';
  const isAdolescent = patientAge >= 12 && patientAge < 18;
  const isAdult = patientAge >= 18;

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPatient),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Patient créé avec succès');
        setShowNewPatientDialog(false);
        navigate(`/pro/patient/${data.id}`);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accueil Praticien</h1>
          <p className="text-slate-500">Gérez vos patients et consultez les dossiers médicaux.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            icon={isCustomizeMode ? Save : Settings2} 
            onClick={isCustomizeMode ? saveDashboardConfig : () => setIsCustomizeMode(true)}
          >
            {isCustomizeMode ? 'Enregistrer' : 'Personnaliser'}
          </Button>
          <Button variant="secondary" icon={Calendar} onClick={() => navigate('/pro/agenda')}>Agenda</Button>
          <Button icon={UserPlus} onClick={() => setShowNewPatientDialog(true)}>Nouveau Patient</Button>
        </div>
      </div>

      {isCustomizeMode && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <Settings2 className="w-5 h-5" />
              Mode Personnalisation
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setIsCustomizeMode(false); fetchDashboardData(); }}>Annuler</Button>
              <Button size="sm" onClick={saveDashboardConfig}>Enregistrer la disposition</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-8">
        {widgets.map((widget) => {
          if (!widget.visible && !isCustomizeMode) return null;

          const widgetContent = (() => {
            switch (widget.id) {
              case 'stats':
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="hover:shadow-lg transition-all duration-200 border-slate-100">
                      <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-50/50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                          <Calendar className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Consultations du jour</p>
                          <h3 className="text-4xl font-light text-slate-900 mt-1">{stats.todayAppointments}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="success" className="min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 rounded-full text-[10px]">
                              +25%
                            </Badge>
                            <span className="text-xs text-slate-400">vs hier</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-all duration-200 border-slate-100">
                      <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 bg-emerald-50/50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                          <Users className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Patients actifs</p>
                          <h3 className="text-4xl font-light text-slate-900 mt-1">{stats.totalPatients.toLocaleString()}</h3>
                          <div className="flex items-center gap-2 mt-1">
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="hover:shadow-lg transition-all duration-200 border-slate-100">
                      <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 bg-amber-50/50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100">
                          <FileClock className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Actions requises</p>
                          <h3 className="text-4xl font-light text-slate-900 mt-1">{stats.pendingActions}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {stats.pendingActions > 0 ? (
                              <Badge variant="error" className="px-2 py-1 h-auto text-[10px] rounded-full">
                                Transferts en attente
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="px-2 py-1 h-auto text-[10px] rounded-full">
                                Tout est à jour
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              case 'agenda_cta':
                return (
                  <Card className="bg-white border-blue-100 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden" onClick={() => navigate('/pro/agenda')}>
                    <CardContent className="p-0 flex items-stretch h-32">
                      <div className="w-24 bg-blue-600 flex flex-col items-center justify-center text-white gap-1 group-hover:bg-blue-700 transition-colors">
                        <Calendar className="w-8 h-8" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Agenda</span>
                      </div>
                      <div className="flex-1 p-6 flex flex-col justify-center">
                        <h3 className="font-bold text-slate-900 text-lg">Agenda & Disponibilités</h3>
                        <p className="text-sm text-slate-500 mt-1">Gérez vos plages horaires et vos rendez-vous à venir.</p>
                        <div className="flex items-center gap-2 mt-3 text-blue-600 text-xs font-bold">
                          Accéder à l'agenda <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              case 'search':
                return (
                  <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-none shadow-lg shadow-blue-200">
                    <CardContent className="p-8">
                      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Search className="w-5 h-5 opacity-80" />
                        Rechercher un patient
                      </h2>
                      <div className="relative max-w-2xl">
                        <Input 
                          className="h-14 pl-6 pr-4 rounded-2xl bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:bg-white focus:text-slate-900 focus:placeholder:text-slate-400 transition-all"
                          placeholder="Nom, Prénom..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      {patients.length > 0 && (
                        <div className="mt-4 bg-white rounded-xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-2">
                          {patients.map(patient => (
                            <div 
                              key={patient.id}
                              onClick={() => navigate(`/pro/patient/${patient.id}`)}
                              className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden">
                                  {patient.photo_url ? (
                                    <img 
                                      src={patient.photo_url} 
                                      alt={`${patient.first_name} ${patient.last_name}`}
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <span>{patient.first_name[0].toUpperCase()}{patient.last_name[0].toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                                    {patient.first_name} {patient.last_name}
                                  </p>
                                  <p className="text-xs text-slate-500">Né(e) le {patient.dob}</p>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600" />
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              case 'recent':
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Consultations récentes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {[1, 2, 3].map((_, i) => (
                          <div key={i} className="flex items-start gap-3 pb-3 border-b border-slate-50 last:border-0 last:pb-0">
                            <div className="w-2 h-2 mt-2 rounded-full bg-emerald-400" />
                            <div>
                              <p className="text-sm font-medium text-slate-900">Mme. Martin Alice</p>
                              <p className="text-xs text-slate-500">Consultation générale • Il y a 2h</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              case 'documents':
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-500" />
                        Documents à signer
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center h-32 text-slate-400 text-sm">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                          <FileText className="w-5 h-5 opacity-50" />
                        </div>
                        Aucun document en attente
                      </div>
                    </CardContent>
                  </Card>
                );
              default:
                return null;
            }
          })();

          return (
            <div key={widget.id} className={cn("relative group", !widget.visible && "opacity-50 grayscale")}>
              {isCustomizeMode && (
                <div className="absolute -top-3 -right-3 z-10 flex gap-1">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 rounded-full shadow-lg p-0"
                    onClick={() => toggleWidget(widget.id)}
                  >
                    {widget.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <div className="flex flex-col gap-1">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 rounded-full shadow-lg p-0"
                      onClick={() => moveWidget(widget.id, 'up')}
                    >
                      <ChevronRight className="w-4 h-4 -rotate-90" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 rounded-full shadow-lg p-0"
                      onClick={() => moveWidget(widget.id, 'down')}
                    >
                      <ChevronRight className="w-4 h-4 rotate-90" />
                    </Button>
                  </div>
                </div>
              )}
              {widgetContent}
            </div>
          );
        })}
      </div>

      {/* New Patient Dialog */}
      <Dialog open={showNewPatientDialog} onClose={() => setShowNewPatientDialog(false)}>
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nouveau Patient</h2>
              <p className="text-sm text-slate-500">Créez un nouveau dossier patient.</p>
            </div>
          </div>

          <form onSubmit={handleCreatePatient} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Prénom</label>
                <Input 
                  required
                  placeholder="Ex: Jean"
                  value={newPatient.first_name}
                  onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase">Nom</label>
                <Input 
                  required
                  placeholder="Ex: Dupont"
                  value={newPatient.last_name}
                  onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Date de naissance</label>
              <Input 
                required
                type="date"
                value={newPatient.dob}
                onChange={(e) => setNewPatient({ ...newPatient, dob: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Sexe</label>
              <select 
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={newPatient.gender}
                onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
                <option value="O">Autre</option>
              </select>
            </div>

            {isChild && (
              <div className="space-y-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase">Informations Pédiatriques</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Nom du Parent/Tuteur</label>
                    <Input 
                      placeholder="Ex: Marie Dupont"
                      value={newPatient.metadata.parent_name || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, parent_name: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Téléphone Parent</label>
                    <Input 
                      placeholder="Ex: 06 00 00 00 00"
                      value={newPatient.metadata.parent_phone || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, parent_phone: e.target.value } })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase">Poids à la naissance (kg)</label>
                  <Input 
                    type="number"
                    step="0.1"
                    placeholder="Ex: 3.5"
                    value={newPatient.metadata.birth_weight || ''}
                    onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, birth_weight: e.target.value } })}
                  />
                </div>
              </div>
            )}

            {isAdolescent && (
              <div className="space-y-4 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold text-emerald-600 uppercase">Informations Adolescent</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Établissement Scolaire</label>
                    <Input 
                      placeholder="Ex: Lycée National"
                      value={newPatient.metadata.school || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, school: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Activités Sportives</label>
                    <Input 
                      placeholder="Ex: Football, Judo"
                      value={newPatient.metadata.sports || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, sports: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            )}

            {isAdult && (
              <div className="space-y-4 p-4 bg-amber-50/50 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold text-amber-600 uppercase">Informations Adulte</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Profession</label>
                    <Input 
                      placeholder="Ex: Enseignant"
                      value={newPatient.metadata.profession || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, profession: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Situation Familiale</label>
                    <select 
                      className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={newPatient.metadata.marital_status || ''}
                      onChange={(e) => setNewPatient({ ...newPatient, metadata: { ...newPatient.metadata, marital_status: e.target.value } })}
                    >
                      <option value="">Sélectionner...</option>
                      <option value="single">Célibataire</option>
                      <option value="married">Marié(e)</option>
                      <option value="divorced">Divorcé(e)</option>
                      <option value="widowed">Veuf/Veuve</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
              <Input 
                type="email"
                placeholder="patient@email.com"
                value={newPatient.email}
                onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
              />
            </div>

            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewPatientDialog(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1">
                Créer le dossier
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  );
}
