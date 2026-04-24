import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Dialog, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Popover } from '@/components/ui';
import { Search, User, FileText, ChevronRight, Plus, Link as LinkIcon, UserPlus, ArrowRightLeft, Check, X, Calendar, Clock, Pill, Info, Activity, Copy, QrCode as QrIcon, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import QRCode from 'react-qr-code';

const calculateAge = (dob: string) => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const PreviewContent = ({ data, loading }: { data: any, loading: boolean }) => {
  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return <p className="text-xs text-slate-400 italic py-4 text-center">Aucune donnée disponible.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold overflow-hidden shrink-0">
          {data.patient.photo_url ? (
            <img src={data.patient.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <>{data.patient.first_name[0]}{data.patient.last_name[0]}</>
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 truncate">{data.patient.first_name} {data.patient.last_name}</p>
          <p className="text-[10px] text-slate-500">{calculateAge(data.patient.dob)} ans • {data.patient.gender === 'M' ? 'Homme' : 'Femme'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dernière Consultation</p>
            {data.lastRecord ? (
              <p className="text-xs text-slate-700 truncate">{data.lastRecord.title}</p>
            ) : (
              <p className="text-xs text-slate-400 italic">Aucune donnée</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Prochain RDV</p>
            {data.nextAppointment ? (
              <p className="text-xs text-blue-700 font-medium">
                {new Date(data.nextAppointment.date).toLocaleDateString()} à {new Date(data.nextAppointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">Aucun rendez-vous</p>
            )}
          </div>
        </div>

        {data.latestVitals ? (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Constantes Récentes
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center">
                <p className="text-[9px] text-slate-400 uppercase">Poids</p>
                <p className="text-xs font-bold text-slate-700">{data.latestVitals.weight}kg</p>
              </div>
              <div className="text-center border-x border-slate-200">
                <p className="text-[9px] text-slate-400 uppercase">Tension</p>
                <p className="text-xs font-bold text-slate-700">{data.latestVitals.blood_pressure_sys}/{data.latestVitals.blood_pressure_dia}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] text-slate-400 uppercase">Pouls</p>
                <p className="text-xs font-bold text-slate-700">{data.latestVitals.heart_rate}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 italic text-xs px-2">
            <Activity className="w-3.5 h-3.5" /> Aucune constante enregistrée
          </div>
        )}
      </div>
      
      <div className="pt-2 flex justify-center">
        <p className="text-[9px] text-slate-400 italic">Cliquez sur la ligne pour le dossier complet</p>
      </div>
    </div>
  );
};

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<{ incoming: any[], outgoing: any[] }>({ incoming: [], outgoing: [] });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('create');
  const [pageTab, setPageTab] = useState('list'); // 'list' or 'transfers'
  
  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Success state for new patient
  const [createdPatient, setCreatedPatient] = useState<any>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [qrPatient, setQrPatient] = useState<any>(null);
  
  // Hover state
  const [hoverData, setHoverData] = useState<Record<number, any>>({});
  const [isHoverLoading, setIsHoverLoading] = useState<Record<number, boolean>>({});

  // Form states
  const [shareId, setShareId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newPatient, setNewPatient] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'M',
    email: '',
    metadata: {} as any
  });

  useEffect(() => {
    fetchPatients();
    fetchTransfers();
  }, []);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!newPatient.first_name.trim()) newErrors.first_name = 'Le prénom est obligatoire';
    if (!newPatient.last_name.trim()) newErrors.last_name = 'Le nom est obligatoire';
    if (!newPatient.dob) {
      newErrors.dob = 'La date de naissance est obligatoire';
    } else {
      const birthDate = new Date(newPatient.dob);
      if (isNaN(birthDate.getTime())) newErrors.dob = 'Date de naissance invalide';
      if (birthDate > new Date()) newErrors.dob = 'La date de naissance ne peut pas être dans le futur';
    }
    if (newPatient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newPatient.email)) {
      newErrors.email = 'Format d\'email invalide';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchPatients = () => {
    fetch('/api/patients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPatients(data);
      })
      .catch(console.error);
  };

  const patientAge = calculateAge(newPatient.dob);
  const isChild = patientAge < 12 && newPatient.dob !== '';
  const isAdolescent = patientAge >= 12 && patientAge < 18;
  const isAdult = patientAge >= 18;

  const fetchTransfers = () => {
    fetch('/api/transfers')
      .then(res => res.json())
      .then(setTransfers)
      .catch(console.error);
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPatient),
      });
      const data = await res.json();
      if (data.success) {
        setCreatedPatient({ ...newPatient, share_id: data.shareId });
        setShowAddDialog(false);
        setShowSuccessDialog(true);
        fetchPatients();
        setNewPatient({ first_name: '', last_name: '', dob: '', gender: 'M', email: '', metadata: {} as any });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/pro/patients/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Patient ajouté à votre liste');
        setShowAddDialog(false);
        fetchPatients();
        setShareId('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleTransferAction = async (id: number, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`/api/transfers/${id}/${action}`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        toast.success(action === 'accept' ? 'Transfert accepté' : 'Transfert refusé');
        fetchTransfers();
        if (action === 'accept') fetchPatients();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const handleOpenPreview = async (patientId: number) => {
    setIsLoadingPreview(true);
    setShowPreview(true);
    setPreviewData(null); // Reset previous data
    try {
      const res = await fetch(`/api/patients/${patientId}/summary`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreviewData(data);
    } catch (error: any) {
      toast.error('Erreur', { description: 'Impossible de charger l\'aperçu.' });
      setShowPreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleHover = async (patientId: number, open: boolean) => {
    if (open && !hoverData[patientId] && !isHoverLoading[patientId]) {
      setIsHoverLoading(prev => ({ ...prev, [patientId]: true }));
      try {
        const res = await fetch(`/api/patients/${patientId}/summary`);
        const data = await res.json();
        setHoverData(prev => ({ ...prev, [patientId]: data }));
      } catch (error) {
        console.error('Hover fetch error:', error);
      } finally {
        setIsHoverLoading(prev => ({ ...prev, [patientId]: false }));
      }
    }
  };

  const filteredPatients = patients.filter(p => 
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.share_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintQr = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Printable Area (Hidden on screen) */}
      <div className="hidden print:block print:fixed print:inset-0 print:bg-white print:z-[9999] p-12 text-center">
        <div className="max-w-md mx-auto space-y-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-slate-900">Docta AI</h1>
            <p className="text-xl text-slate-600">Inscription Patient</p>
          </div>
          
          <div className="flex justify-center p-8 bg-white border-4 border-slate-900 rounded-3xl">
            <QRCode 
              value={`${window.location.origin}/register?shareId=${qrPatient?.share_id || createdPatient?.share_id}`} 
              size={350} 
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-900">Scannez pour vous inscrire</h2>
            <p className="text-lg text-slate-500">
              Patient : {qrPatient?.first_name || createdPatient?.first_name} {qrPatient?.last_name || createdPatient?.last_name}
            </p>
            <p className="text-sm text-slate-400 font-mono">Docta ID: {qrPatient?.share_id || createdPatient?.share_id}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mes Patients</h1>
          <p className="text-slate-500">Gérez vos dossiers patients et accédez à leur historique.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={pageTab === 'transfers' ? 'primary' : 'secondary'} 
            onClick={() => setPageTab('transfers')}
            className="relative"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Transferts
            {transfers.incoming.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" />
            )}
          </Button>
          <Button icon={Plus} onClick={() => setShowAddDialog(true)}>Ajouter un Patient</Button>
        </div>
      </div>

      {pageTab === 'list' && (
        <div className="relative w-full max-w-md animate-in fade-in slide-in-from-top-2 z-10 print:hidden">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
          <Input 
            placeholder="Rechercher par nom, prénom ou Docta ID..." 
            className="pl-11 h-12 bg-white shadow-sm rounded-2xl border-slate-200 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {pageTab === 'list' ? (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Liste des Patients ({filteredPatients.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-3 font-medium">Patient</th>
                    <th className="px-6 py-3 font-medium">Né(e) le</th>
                    <th className="px-6 py-3 font-medium">Docta ID</th>
                    <th className="px-6 py-3 font-medium">Statut</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((patient) => (
                    <tr 
                      key={patient.id} 
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => handleOpenPreview(patient.id)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        <Popover 
                          onOpenChange={(open) => handleHover(patient.id, open)}
                          content={<PreviewContent data={hoverData[patient.id]} loading={isHoverLoading[patient.id]} />}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs overflow-hidden">
                              {patient.photo_url ? (
                                <img src={patient.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <>{patient.first_name[0]}{patient.last_name[0]}</>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span>{patient.first_name} {patient.last_name}</span>
                              <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                <Info className="w-2.5 h-2.5" /> Survolez pour l'aperçu
                              </span>
                            </div>
                          </div>
                        </Popover>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{new Date(patient.dob).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-slate-500 font-mono font-bold text-blue-600">{patient.share_id}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          Actif
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {!patient.user_id && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-blue-600 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setQrPatient(patient);
                                setShowQrDialog(true);
                              }}
                              title="Générer QR Code d'inscription"
                            >
                              <QrIcon className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-slate-400 group-hover:text-blue-600">
                            Détails <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredPatients.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                Aucun patient trouvé.
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Incoming Transfers */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                Demandes Reçues
                {transfers.incoming.filter(t => t.status === 'PENDING').length > 0 && (
                  <Badge variant="warning" className="ml-2">{transfers.incoming.filter(t => t.status === 'PENDING').length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transfers.incoming.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">Aucune demande reçue.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transfers.incoming.map((t) => (
                    <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">Patient : {t.patient_first_name} {t.patient_last_name}</p>
                        <p className="text-sm text-slate-500">De : Dr. {t.sender_name}</p>
                        <p className="text-xs text-slate-400 mt-1">Reçu le {new Date(t.created_at).toLocaleDateString()}</p>
                      </div>
                      {t.status === 'PENDING' ? (
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" onClick={() => handleTransferAction(t.id, 'reject')} icon={X}>Refuser</Button>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleTransferAction(t.id, 'accept')} icon={Check}>Accepter</Button>
                        </div>
                      ) : (
                        <Badge variant={t.status === 'ACCEPTED' ? 'success' : 'error'}>
                          {t.status === 'ACCEPTED' ? 'Accepté' : 'Refusé'}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outgoing Transfers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-slate-500">Demandes Envoyées</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {transfers.outgoing.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">Aucune demande envoyée.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {transfers.outgoing.map((t) => (
                    <div key={t.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-slate-900">Patient : {t.patient_first_name} {t.patient_last_name}</p>
                        <p className="text-sm text-slate-500">Pour : Dr. {t.receiver_name}</p>
                      </div>
                      <Badge variant={t.status === 'PENDING' ? 'warning' : t.status === 'ACCEPTED' ? 'success' : 'error'}>
                        {t.status === 'PENDING' ? 'En attente' : t.status === 'ACCEPTED' ? 'Accepté' : 'Refusé'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="col-span-1 lg:col-span-2 flex justify-end">
             <Button variant="ghost" onClick={() => setPageTab('list')}>Retour à la liste</Button>
          </div>
        </div>
      )}

      {/* Add Patient Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ajouter un Patient</h2>
          </div>
          
          <div className="flex space-x-2 border-b border-slate-200 mb-4">
            <button
              className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'create' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('create')}
            >
              <UserPlus className="w-4 h-4 inline-block mr-2" />
              Nouveau Dossier
            </button>
            <button
              className={`pb-2 px-4 text-sm font-medium transition-colors ${activeTab === 'link' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              onClick={() => setActiveTab('link')}
            >
              <LinkIcon className="w-4 h-4 inline-block mr-2" />
              Lier par ID
            </button>
          </div>

          {activeTab === 'create' ? (
            <form onSubmit={handleCreatePatient} className="space-y-4 animate-in fade-in slide-in-from-left-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Prénom</label>
                  <Input 
                    required 
                    value={newPatient.first_name} 
                    onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} 
                    className={errors.first_name ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {errors.first_name && <p className="text-[10px] text-red-500 font-medium">{errors.first_name}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Nom</label>
                  <Input 
                    required 
                    value={newPatient.last_name} 
                    onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} 
                    className={errors.last_name ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {errors.last_name && <p className="text-[10px] text-red-500 font-medium">{errors.last_name}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Date de naissance</label>
                  <Input 
                    type="date" 
                    required 
                    value={newPatient.dob} 
                    onChange={e => setNewPatient({...newPatient, dob: e.target.value})} 
                    className={errors.dob ? "border-red-500 focus:ring-red-500" : ""}
                  />
                  {errors.dob && <p className="text-[10px] text-red-500 font-medium">{errors.dob}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Genre</label>
                  <select 
                    className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={newPatient.gender}
                    onChange={e => setNewPatient({...newPatient, gender: e.target.value})}
                  >
                    <option value="M">Homme</option>
                    <option value="F">Femme</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email (Optionnel)</label>
                <Input 
                  type="email" 
                  value={newPatient.email} 
                  onChange={e => setNewPatient({...newPatient, email: e.target.value})} 
                  placeholder="patient@exemple.fr"
                  className={errors.email ? "border-red-500 focus:ring-red-500" : ""}
                />
                {errors.email && <p className="text-[10px] text-red-500 font-medium">{errors.email}</p>}
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
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)}>Annuler</Button>
                <Button type="submit">Créer le dossier</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLinkPatient} className="space-y-4 animate-in fade-in slide-in-from-right-2">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm">
                Demandez au patient son <strong>Docta ID</strong> (disponible dans son espace patient) pour accéder à son dossier existant.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Docta ID (Code de partage)</label>
                <Input 
                  required 
                  placeholder="Ex: A1B2C3D4" 
                  value={shareId} 
                  onChange={e => setShareId(e.target.value.toUpperCase())}
                  className="font-mono uppercase tracking-widest text-center text-lg h-14"
                  maxLength={8}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setShowAddDialog(false)}>Annuler</Button>
                <Button type="submit" icon={LinkIcon}>Lier le dossier</Button>
              </div>
            </form>
          )}
        </div>
      </Dialog>

      {/* Success Dialog for New Patient */}
      <Dialog open={showSuccessDialog} onClose={() => setShowSuccessDialog(false)}>
        <div className="p-8 text-center space-y-6 max-w-md mx-auto">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Dossier Créé !</h2>
            <p className="text-sm text-slate-500 mt-1">
              Le dossier de <strong>{createdPatient?.first_name} {createdPatient?.last_name}</strong> est prêt.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Docta ID</p>
              <p className="text-2xl font-mono font-bold text-emerald-600 tracking-widest">
                {createdPatient?.share_id}
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-emerald-600 hover:bg-emerald-50 h-8"
                onClick={() => {
                  navigator.clipboard.writeText(createdPatient?.share_id);
                  toast.success('ID copié');
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-2" />
                Copier
              </Button>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">QR Code d'inscription</p>
              <div className="p-2 bg-white border border-slate-100 rounded-xl">
                <QRCode 
                  value={`${window.location.origin}/register?shareId=${createdPatient?.share_id}`}
                  size={120}
                  level="H"
                />
              </div>
              <p className="text-[10px] text-slate-400 italic">Le patient peut scanner ce code pour créer son compte.</p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-[10px] text-left leading-relaxed">
            <p className="flex gap-2">
              <Info className="w-4 h-4 shrink-0" />
              Transmettez ce code ou faites scanner le QR code au patient. Il pourra ainsi finaliser la création de son compte et accéder à son historique.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handlePrintQr} icon={Printer} className="w-full h-11 rounded-xl">
              Imprimer le QR Code
            </Button>
            <Button onClick={() => setShowSuccessDialog(false)} variant="ghost" className="w-full h-11 rounded-xl">
              Terminer
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
            <h2 className="text-xl font-bold text-slate-900">QR Code d'inscription</h2>
            <p className="text-sm text-slate-500 mt-1">
              Patient : <strong>{qrPatient?.first_name} {qrPatient?.last_name}</strong>
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border-2 border-slate-50 flex flex-col items-center space-y-4 shadow-inner">
            <QRCode 
              value={`${window.location.origin}/register?shareId=${qrPatient?.share_id}`}
              size={180}
              level="H"
            />
            <div className="text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Docta ID</p>
              <p className="text-xl font-mono font-bold text-blue-600 tracking-widest">{qrPatient?.share_id}</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Faites scanner ce code au patient pour qu'il puisse créer son compte personnel et accéder à son dossier.
          </p>

          <div className="flex flex-col gap-2">
            <Button onClick={handlePrintQr} icon={Printer} className="w-full h-11 rounded-xl">
              Imprimer le QR Code
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Patient Preview Dialog */}
      <Dialog open={showPreview} onClose={() => setShowPreview(false)}>
        <div className="p-6 space-y-6">
          {isLoadingPreview ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Chargement de l'aperçu...</p>
            </div>
          ) : previewData && (
            <>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
                  {previewData.patient.photo_url ? (
                    <img src={previewData.patient.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>{previewData.patient.first_name[0]}{previewData.patient.last_name[0]}</>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {previewData.patient.first_name} {previewData.patient.last_name}
                  </h2>
                  <div className="flex gap-3 text-sm text-slate-500 mt-1">
                    <span>{previewData.patient.gender === 'M' ? 'Homme' : 'Femme'}</span>
                    <span>•</span>
                    <span>{calculateAge(previewData.patient.dob)} ans</span>
                    <span>•</span>
                    <span>Né(e) le {new Date(previewData.patient.dob).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-3">
                    <FileText className="w-3 h-3" />
                    Dernière Consultation
                  </div>
                  {previewData.lastRecord ? (
                    <div>
                      <p className="font-semibold text-slate-900 text-xs line-clamp-1">{previewData.lastRecord.title}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Le {new Date(previewData.lastRecord.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Aucun historique.</p>
                  )}
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-2 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                    <Calendar className="w-3 h-3" />
                    Prochain RDV
                  </div>
                  {previewData.nextAppointment ? (
                    <div>
                      <p className="font-semibold text-blue-900 text-xs">
                        {new Date(previewData.nextAppointment.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[10px] text-blue-700 mt-1 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(previewData.nextAppointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-blue-400 italic">Aucun RDV.</p>
                  )}
                </div>

                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                    <Pill className="w-3 h-3" />
                    Dernières Ordonnances
                  </div>
                  {previewData.lastPrescriptions && previewData.lastPrescriptions.length > 0 ? (
                    <div className="space-y-2">
                      {previewData.lastPrescriptions.map((p: any) => (
                        <div key={p.id}>
                          <p className="font-semibold text-emerald-900 text-[10px] line-clamp-1">{p.title}</p>
                          <p className="text-[9px] text-emerald-700">
                            Le {new Date(p.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-emerald-400 italic">Aucune ordonnance.</p>
                  )}
                </div>
              </div>

              {previewData.vitalSigns && previewData.vitalSigns.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <Activity className="w-3 h-3" />
                      Tendances des Signes Vitaux
                    </div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-[10px] text-slate-500">Poids (kg)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-[10px] text-slate-500">Tension Sys.</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={previewData.vitalSigns}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="timestamp" 
                          tickFormatter={(val) => new Date(val).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          tick={{ fontSize: 10 }}
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          labelFormatter={(label) => new Date(label).toLocaleString()}
                          contentStyle={{ fontSize: '12px', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="weight" 
                          name="Poids"
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          dot={{ r: 4 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="blood_pressure_sys" 
                          name="Tension Sys."
                          stroke="#ef4444" 
                          strokeWidth={2} 
                          dot={{ r: 4 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between text-sm py-2 border-b border-slate-100">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-900">{previewData.patient.email || 'Non renseigné'}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Link to={`/pro/patient/${previewData.patient.id}`} className="flex-1">
                  <Button className="w-full">Ouvrir le Dossier Complet</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </div>
  );
}
