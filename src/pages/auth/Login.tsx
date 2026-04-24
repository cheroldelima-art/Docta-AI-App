import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button, Input, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { Lock, User, Activity } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('dr.house@docta.ai');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      login(data.user);
      if (data.user.role === 'PROFESSIONAL') {
        navigate('/pro/dashboard');
      } else {
        navigate('/patient/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 text-white mb-4 shadow-lg shadow-blue-200">
            <Activity className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Docta AI</h1>
          <p className="text-slate-500 mt-2">Votre santé, simplifiée et sécurisée.</p>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle>Connexion sécurisée</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email professionnel</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    placeholder="nom@hopital.fr"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                  <Input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center text-slate-600">
                  <input type="checkbox" className="mr-2 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                  Se souvenir de moi
                </label>
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">Mot de passe oublié ?</a>
              </div>

              <Button type="submit" className="w-full h-11 text-base shadow-blue-200">
                Se connecter
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-50 text-center">
              <p className="text-sm text-slate-500">
                Pas encore de compte ?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">
                  Créer un compte
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
