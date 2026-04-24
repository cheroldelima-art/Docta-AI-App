import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Save, User, Bell, Shield, Phone, MapPin, Camera, Loader2, ArrowLeft } from 'lucide-react';

export default function PatientSettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    dob: user?.dob || '',
    gender: user?.gender || 'U'
  });

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
      // Revert state on error
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast.success('Profil mis à jour', { description: 'Vos informations ont été enregistrées.' });
      } else {
        throw new Error('Erreur lors de la mise à jour');
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="rounded-xl">
            <Link to="/patient/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Paramètres</h1>
            <p className="text-slate-500">Gérez votre profil et vos préférences.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <Card className="md:col-span-1 h-fit">
          <CardContent className="p-2">
            <nav className="space-y-1">
              {[
                { id: 'profile', label: 'Mon Profil', icon: User },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'security', label: 'Sécurité', icon: Shield },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-emerald-50 text-emerald-700'
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
                  <div 
                    className="relative group cursor-pointer"
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                  >
                    {user?.photo_url ? (
                      <img 
                        src={user.photo_url} 
                        alt={user.name} 
                        className="w-24 h-24 rounded-2xl object-cover border-4 border-emerald-50 shadow-md"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700 text-3xl font-bold">
                        {user?.name?.split(' ').map(n => n[0]).join('')}
                      </div>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={isUploading}
                      className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
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
                    <p className="text-sm text-slate-500 mb-4">Mettez à jour votre photo pour que vos médecins puissent vous reconnaître plus facilement.</p>
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
                        <label className="text-sm font-medium text-slate-700">Email</label>
                        <Input 
                          value={formData.email} 
                          disabled
                          className="bg-slate-50 text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Téléphone</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                          <Input 
                            className="pl-9"
                            value={formData.phone} 
                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Adresse</label>
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
                        <label className="text-sm font-medium text-slate-700">Date de naissance</label>
                        <Input 
                          type="date"
                          value={formData.dob} 
                          onChange={(e) => setFormData({...formData, dob: e.target.value})}
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Genre</label>
                        <select 
                          className="w-full h-10 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          value={formData.gender}
                          onChange={(e) => setFormData({...formData, gender: e.target.value})}
                        >
                          <option value="M">Masculin</option>
                          <option value="F">Féminin</option>
                          <option value="U">Autre / Non précisé</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end">
                  <Button type="submit" icon={Save} className="bg-emerald-600 hover:bg-emerald-700">Enregistrer les modifications</Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader>
                <CardTitle>Préférences de Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {[
                  { id: 'appointment_reminders', title: 'Rappels de rendez-vous', desc: 'Recevoir un rappel par SMS avant chaque rendez-vous.' },
                  { id: 'new_documents', title: 'Nouveaux documents', desc: 'Être notifié quand un médecin ajoute un document.' },
                  { id: 'new_messages', title: 'Messages', desc: 'Recevoir une alerte pour les nouveaux messages.' },
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
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
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
                  Pour modifier votre mot de passe, veuillez contacter le support.
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
