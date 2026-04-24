import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { Save, User, Briefcase, GraduationCap, Phone, MapPin, Bell, Shield, QrCode, Calendar, Camera, Loader2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [appointmentColors, setAppointmentColors] = useState<Record<string, string>>({
    'Consultation': '#3b82f6',
    'Téléconsultation': '#8b5cf6',
    'Suivi': '#10b981',
    'Urgence': '#ef4444'
  });
  const [formData, setFormData] = useState({
    full_name: '',
    specialty: '',
    rpps_number: '',
    bio: '',
    education: '',
    experience: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.name || '',
        specialty: user.specialty || '',
        rpps_number: user.rpps_number || '',
        bio: user.bio || '',
        education: user.education ? JSON.parse(user.education) : '',
        experience: user.experience ? JSON.parse(user.experience) : '',
        phone: user.phone || '',
        address: user.address || ''
      });
      fetchColors();
    }
  }, [user]);

  const [notificationPrefs, setNotificationPrefs] = useState({
    appointment_reminders: true,
    new_documents: true,
    new_messages: true
  });

  useEffect(() => {
    if (activeTab === 'notifications') {
      fetch('/api/notification-preferences')
        .then(res => res.json())
        .then(data => {
          if (data) {
            setNotificationPrefs({
              appointment_reminders: !!data.appointment_reminders,
              new_documents: !!data.new_documents,
              new_messages: !!data.new_messages
            });
          }
        })
        .catch(console.error);
    }
  }, [activeTab]);

  const handleToggleNotification = async (key: keyof typeof notificationPrefs) => {
    const newPrefs = { ...notificationPrefs, [key]: !notificationPrefs[key] };
    setNotificationPrefs(newPrefs);
    
    try {
      const res = await fetch('/api/notification-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPrefs),
      });
      if (!res.ok) throw new Error('Erreur lors de la mise à jour des préférences');
      toast.success('Préférences mises à jour');
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
      setNotificationPrefs(notificationPrefs);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Erreur', { description: 'Veuillez sélectionner une image.' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) throw new Error('Erreur lors de l\'envoi de l\'image');
      const { url } = await uploadRes.json();

      const updateRes = await fetch('/api/profile/photo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: url }),
      });

      if (!updateRes.ok) throw new Error('Erreur lors de la mise à jour du profil');
      
      toast.success('Photo mise à jour', { description: 'Votre photo de profil a été enregistrée.' });
      // Reload to update context
      window.location.reload();
    } catch (err: any) {
      toast.error('Erreur', { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

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

  const handleColorChange = (type: string, color: string) => {
    setAppointmentColors(prev => ({ ...prev, [type]: color }));
  };

  const saveColors = async () => {
    try {
      const res = await fetch('/api/pro/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointment_colors: appointmentColors }),
      });
      if (res.ok) {
        toast.success('Couleurs mises à jour', { description: 'Vos préférences d\'agenda ont été enregistrées.' });
      } else {
        throw new Error('Erreur lors de la sauvegarde');
      }
    } catch (error) {
      toast.error('Erreur', { description: 'Impossible de sauvegarder les couleurs.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/pro/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Profil mis à jour', { description: 'Vos informations ont été enregistrées.' });
        // Reload to refresh the AuthContext and sidebar warnings
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error('Erreur lors de la mise à jour');
      }
    } catch (error) {
      toast.error('Erreur', { description: 'Impossible de mettre à jour le profil.' });
    }
  };

  const registrationLink = `${window.location.origin}/register?ref=${user?.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
          <p className="text-slate-500">Gérez votre profil professionnel et vos préférences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 print:hidden">
        {/* Settings Navigation */}
        <Card className="md:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {[
                { id: 'profile', label: 'Profil Public', icon: User },
                { id: 'qr', label: 'Mon QR Code', icon: QrCode },
                { id: 'agenda', label: 'Agenda', icon: Calendar },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'security', label: 'Sécurité', icon: Shield },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </CardContent>
        </Card>

        {/* Content Area */}
        <div className="md:col-span-3 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Photo de Profil</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center sm:flex-row sm:items-center gap-6">
                  <div className="relative group">
                    {user?.photo_url ? (
                      <img 
                        src={user.photo_url} 
                        alt={user.name} 
                        className="w-24 h-24 rounded-2xl object-cover border-4 border-blue-50 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-3xl font-bold">
                        {user?.name?.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="absolute -bottom-2 -right-2 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="font-bold text-slate-900">{user?.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">Mettez à jour votre photo professionnelle pour inspirer confiance à vos patients.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      Changer la photo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Informations Personnelles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Nom complet</label>
                        <Input 
                          value={formData.full_name} 
                          onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Spécialité</label>
                        <Input 
                          value={formData.specialty} 
                          onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Numéro RPPS</label>
                        <Input 
                          value={formData.rpps_number} 
                          onChange={(e) => setFormData({...formData, rpps_number: e.target.value})}
                          placeholder="11 chiffres"
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Téléphone Pro</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input 
                            className="pl-9"
                            value={formData.phone} 
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Adresse du cabinet</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          className="pl-9"
                          value={formData.address} 
                          onChange={(e) => setFormData({...formData, address: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Biographie</label>
                      <textarea 
                        className="w-full min-h-[100px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Présentez votre parcours..."
                        value={formData.bio}
                        onChange={(e) => setFormData({...formData, bio: e.target.value})}
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Parcours & Formation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" /> Formation (Diplômes)
                      </label>
                      <textarea 
                        className="w-full min-h-[80px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Doctorat en Médecine - Université Paris Descartes (2015)"
                        value={formData.education}
                        onChange={(e) => setFormData({...formData, education: e.target.value})}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Briefcase className="w-4 h-4" /> Expérience
                      </label>
                      <textarea 
                        className="w-full min-h-[80px] rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ex: Praticien Hospitalier - CHU Nantes (2016-2020)"
                        value={formData.experience}
                        onChange={(e) => setFormData({...formData, experience: e.target.value})}
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" icon={Save}>Enregistrer les modifications</Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'qr' && (
            <Card>
              <CardHeader>
                <CardTitle>Votre QR Code Praticien</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-6 py-8">
                <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100">
                  <QRCode value={registrationLink} size={200} />
                </div>
                <div className="text-center max-w-md space-y-2">
                  <p className="font-medium text-slate-900">Scannez pour vous inscrire</p>
                  <p className="text-sm text-slate-500">
                    Invitez vos patients à scanner ce code pour créer leur compte Docta AI directement lié à votre cabinet.
                  </p>
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 break-all text-xs font-mono text-slate-600">
                    {registrationLink}
                  </div>
                </div>
                <Button variant="outline" onClick={handlePrint}>Imprimer le QR Code</Button>
              </CardContent>
            </Card>
          )}

          {activeTab === 'agenda' && (
            <Card>
              <CardHeader>
                <CardTitle>Personnalisation de l'Agenda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-slate-500">Définissez les couleurs pour chaque type de rendez-vous dans votre agenda.</p>
                <div className="space-y-4">
                  {Object.entries(appointmentColors).map(([type, color]) => (
                    <div key={type} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-medium text-slate-900">{type}</span>
                      </div>
                      <input 
                        type="color" 
                        value={color} 
                        onChange={(e) => handleColorChange(type, e.target.value)}
                        className="w-10 h-10 rounded-lg cursor-pointer border-2 border-white shadow-sm"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-4">
                  <Button onClick={saveColors} icon={Save}>Enregistrer les couleurs</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Préférences de Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: 'appointment_reminders', title: 'Rappels de rendez-vous', desc: 'Recevoir un récapitulatif quotidien de l\'agenda.' },
                  { id: 'new_documents', title: 'Nouveaux documents', desc: 'Être notifié quand un laboratoire transmet des résultats.' },
                  { id: 'new_messages', title: 'Messages patients', desc: 'Être notifié des nouveaux messages reçus.' },
                ].map((setting) => (
                  <div key={setting.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium text-slate-900">{setting.title}</p>
                      <p className="text-sm text-slate-500">{setting.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={notificationPrefs[setting.id as keyof typeof notificationPrefs]} 
                        onChange={() => handleToggleNotification(setting.id as keyof typeof notificationPrefs)}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader>
                <CardTitle>Sécurité du Compte</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm">
                  Pour modifier votre mot de passe ou activer l'authentification à deux facteurs (2FA), veuillez contacter le support technique.
                </div>
                <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50">
                  Déconnexion de toutes les sessions
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
