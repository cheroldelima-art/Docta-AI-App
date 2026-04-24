import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Lock, User, Activity, Stethoscope, Calendar, CreditCard, QrCode, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const shareId = searchParams.get('shareId');
  const ref = searchParams.get('ref');
  
  const [role, setRole] = useState<'PROFESSIONAL' | 'PATIENT'>((shareId || ref) ? 'PATIENT' : 'PROFESSIONAL');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    specialty: '',
    rpps_number: '',
    dob: '',
    gender: 'M'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [patientInfo, setPatientInfo] = useState<any>(null);
  const [isLoadingPatient, setIsLoadingPatient] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (shareId) {
      setRole('PATIENT');
      fetchPatientInfo(shareId);
    }
  }, [shareId]);

  const fetchPatientInfo = async (id: string) => {
    setIsLoadingPatient(true);
    try {
      const res = await fetch(`/api/auth/patient-check?shareId=${id}`);
      const data = await res.json();
      if (res.ok) {
        setPatientInfo(data);
        setFormData(prev => ({
          ...prev,
          full_name: `${data.first_name} ${data.last_name}`,
          dob: data.dob,
          gender: data.gender
        }));
      } else {
        toast.error('ID de partage invalide ou déjà utilisé');
        navigate('/register');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPatient(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.full_name.trim()) newErrors.full_name = 'Le nom complet est obligatoire';
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est obligatoire';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Format d\'email invalide';
    }
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est obligatoire';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Le mot de passe doit faire au moins 6 caractères';
    }

    if (role === 'PROFESSIONAL') {
      if (!formData.specialty.trim()) newErrors.specialty = 'La spécialité est obligatoire';
      if (!formData.rpps_number.trim()) {
        newErrors.rpps_number = 'Le numéro RPPS est obligatoire';
      } else if (!/^\d{11}$/.test(formData.rpps_number)) {
        newErrors.rpps_number = 'Le numéro RPPS doit contenir exactement 11 chiffres';
      }
    } else {
      if (!formData.dob) {
        newErrors.dob = 'La date de naissance est obligatoire';
      } else {
        const birthDate = new Date(formData.dob);
        if (isNaN(birthDate.getTime())) newErrors.dob = 'Date de naissance invalide';
        if (birthDate > new Date()) newErrors.dob = 'La date de naissance ne peut pas être dans le futur';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;
    
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role, shareId, ref }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      login(data.user);
      toast.success('Compte créé avec succès');
      if (data.user.role === 'PROFESSIONAL') {
        navigate('/pro/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
      toast.error('Erreur lors de l\'inscription', { description: err.message });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-200">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rejoindre Docta AI</h1>
          <p className="text-slate-500 mt-2">Créez votre compte sécurisé en quelques instants.</p>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-0">
          <CardHeader className="text-center pb-2">
            {!shareId && !ref ? (
              <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button 
                  onClick={() => setRole('PROFESSIONAL')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${role === 'PROFESSIONAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Professionnel
                </button>
                <button 
                  disabled
                  className="flex-1 py-2 text-sm font-medium rounded-lg text-slate-300 cursor-not-allowed"
                  title="L'inscription patient se fait via un praticien"
                >
                  Patient
                </button>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {shareId ? 'Dossier Identifié' : 'Invitation Praticien'}
                  </p>
                  <p className="text-sm text-blue-800 font-medium">
                    {shareId ? `ID : ${shareId}` : 'Inscription Patient'}
                  </p>
                </div>
              </div>
            )}
            <CardTitle>
              {shareId || ref ? 'Finaliser mon espace patient' : 'Inscription Praticien'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingPatient ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Vérification du dossier...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nom complet</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input 
                    required
                    value={formData.full_name} 
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className={cn("pl-10", errors.full_name && "border-red-500 focus:ring-red-500")}
                    placeholder={role === 'PROFESSIONAL' ? 'Dr. Jean Dupont' : 'Jean Dupont'}
                  />
                </div>
                {errors.full_name && <p className="text-[10px] text-red-500 font-medium">{errors.full_name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input 
                    required
                    type="email" 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className={cn("pl-10", errors.email && "border-red-500 focus:ring-red-500")}
                    placeholder="nom@exemple.fr"
                  />
                </div>
                {errors.email && <p className="text-[10px] text-red-500 font-medium">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input 
                    required
                    type="password" 
                    value={formData.password} 
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className={cn("pl-10", errors.password && "border-red-500 focus:ring-red-500")}
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <p className="text-[10px] text-red-500 font-medium">{errors.password}</p>}
              </div>

              {role === 'PROFESSIONAL' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Spécialité</label>
                      <div className="relative">
                        <Stethoscope className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input 
                          required
                          value={formData.specialty} 
                          onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                          className={cn("pl-10", errors.specialty && "border-red-500 focus:ring-red-500")}
                          placeholder="Généraliste"
                        />
                      </div>
                      {errors.specialty && <p className="text-[10px] text-red-500 font-medium">{errors.specialty}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">N° RPPS</label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input 
                          required
                          value={formData.rpps_number} 
                          onChange={(e) => setFormData({...formData, rpps_number: e.target.value})}
                          className={cn("pl-10", errors.rpps_number && "border-red-500 focus:ring-red-500")}
                          placeholder="12345678901"
                        />
                      </div>
                      {errors.rpps_number && <p className="text-[10px] text-red-500 font-medium">{errors.rpps_number}</p>}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Date de naissance</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <Input 
                          required
                          disabled={!!shareId}
                          type="date"
                          value={formData.dob} 
                          onChange={(e) => setFormData({...formData, dob: e.target.value})}
                          className={cn("pl-10 disabled:bg-slate-50 disabled:text-slate-500", errors.dob && "border-red-500 focus:ring-red-500")}
                        />
                      </div>
                      {errors.dob && <p className="text-[10px] text-red-500 font-medium">{errors.dob}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Genre</label>
                      <select 
                        disabled={!!shareId}
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                        value={formData.gender}
                        onChange={(e) => setFormData({...formData, gender: e.target.value})}
                      >
                        <option value="M">Homme</option>
                        <option value="F">Femme</option>
                        <option value="O">Autre</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" className="w-full h-11 text-base shadow-blue-200 mt-4">
                Créer mon compte
              </Button>
            </form>
            )}

            <div className="mt-6 pt-6 border-t border-slate-50 text-center">
              <p className="text-sm text-slate-500">
                Déjà un compte ?{' '}
                <Link to="/login" className="text-blue-600 font-medium hover:underline">
                  Se connecter
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-slate-400">Hébergement certifié HDS • Chiffrement AES-256</p>
          <p className="text-xs text-slate-400">© 2026 Docta AI. Tous droits réservés.</p>
        </div>
      </div>
    </div>
  );
}
