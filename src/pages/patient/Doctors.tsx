import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, Input } from '@/components/ui';
import { User, MapPin, Phone, Mail, Stethoscope, Calendar, Clock, ChevronRight, MessageSquare, Info, Search, Pill, ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function PatientDoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [availabilityWindows, setAvailabilityWindows] = useState<any[]>([]);
  const [availabilityStatus, setAvailabilityStatus] = useState<any>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingType, setBookingType] = useState('Consultation');
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/patient/doctors')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDoctors(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

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
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Erreur', { description: 'Impossible de rechercher des praticiens.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate || !bookingTime) {
      toast.error('Erreur', { description: 'Veuillez sélectionner une date et une heure.' });
      return;
    }

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctor_id: selectedDoctor.id,
          date: `${bookingDate}T${bookingTime}:00`,
          type: bookingType,
          notes: 'Rendez-vous pris via l\'espace patient.'
        })
      });

      if (res.ok) {
        toast.success('Succès', { description: 'Votre rendez-vous a été enregistré.' });
        setIsBookingOpen(false);
        setBookingDate('');
        setBookingTime('');
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la prise de rendez-vous');
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  if (loading) return (
    <div className="min-h-[400px] flex flex-col items-center justify-center space-y-4">
      <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-emerald-600 font-medium animate-pulse">Chargement de vos médecins...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="sm" asChild className="rounded-xl">
              <Link to="/patient/dashboard">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Link>
            </Button>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
              <Stethoscope className="w-3 h-3" />
              Équipe Médicale
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Mes Médecins</h1>
              <p className="text-slate-500 max-w-lg mt-1">
                Retrouvez ici tous les professionnels de santé qui assurent votre suivi et ont accès à votre dossier médical partagé.
              </p>
            </div>
            <Link to="/patient/records?tab=medications">
              <Button variant="outline" className="rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                <Pill className="w-4 h-4 mr-2" />
                Mes Médicaments
              </Button>
            </Link>
          </div>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher un nouveau praticien..." 
              className="pl-10 rounded-xl border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl" disabled={isSearching}>
            {isSearching ? '...' : 'Rechercher'}
          </Button>
        </form>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Résultats de la recherche</h2>
            <Button variant="ghost" size="sm" onClick={() => setSearchResults([])} className="text-slate-500">
              Effacer
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((doctor) => (
              <Card key={doctor.id} className="group relative overflow-hidden border-slate-200 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 rounded-3xl">
                <CardContent className="p-8">
                  <div className="flex flex-col items-center text-center space-y-4 mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-200 overflow-hidden">
                      {doctor.photo_url ? (
                        <img 
                          src={doctor.photo_url} 
                          alt={doctor.full_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        doctor.full_name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">{doctor.full_name}</h3>
                      <p className="text-blue-600 font-medium text-sm flex items-center justify-center gap-1.5 mt-1">
                        <Stethoscope className="w-3.5 h-3.5" />
                        {doctor.specialty || 'Médecin Généraliste'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 py-6 border-y border-slate-50">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <p className="text-sm text-slate-600">{doctor.address || 'Adresse non renseignée'}</p>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-6 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-11"
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setIsBookingOpen(true);
                    }}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Solliciter un RDV
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="h-px bg-slate-100 my-8" />

      {doctors.length === 0 ? (
        <Card className="border-dashed border-2 bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-900">Aucun médecin lié</p>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">
                Vous n'avez pas encore de professionnels de santé rattachés à votre compte.
              </p>
            </div>
            <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl">
              Rechercher un praticien
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="group relative overflow-hidden border-slate-200 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-900/5 transition-all duration-300 rounded-3xl">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Badge className="bg-emerald-100 text-emerald-700 border-none">Suivi actif</Badge>
              </div>
              
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center space-y-4 mb-8">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-emerald-200 overflow-hidden">
                      {doctor.photo_url ? (
                        <img 
                          src={doctor.photo_url} 
                          alt={doctor.full_name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        doctor.full_name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-lg border border-slate-100 flex items-center justify-center shadow-sm">
                      <CheckIcon className="text-emerald-600" />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{doctor.full_name}</h3>
                    <p className="text-emerald-600 font-medium text-sm flex items-center justify-center gap-1.5 mt-1">
                      <Stethoscope className="w-3.5 h-3.5" />
                      {doctor.specialty || 'Médecin Généraliste'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 py-6 border-y border-slate-50">
                  <div className="flex items-start gap-3 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:bg-emerald-50 group-hover/item:text-emerald-600 transition-colors">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-sm text-slate-600 leading-tight">
                      <p className="font-medium text-slate-900 mb-0.5">Cabinet médical</p>
                      <p className="text-xs">{doctor.address || 'Adresse non renseignée'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:bg-emerald-50 group-hover/item:text-emerald-600 transition-colors">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-sm text-slate-600">
                      <p className="font-medium text-slate-900 mb-0.5">Téléphone</p>
                      <p className="text-xs">{doctor.phone || 'Non renseigné'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 group/item">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:bg-emerald-50 group-hover/item:text-emerald-600 transition-colors">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="flex-1 text-sm text-slate-600 min-w-0">
                      <p className="font-medium text-slate-900 mb-0.5">Email</p>
                      <p className="text-xs truncate">{doctor.email}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <Button 
                    variant="outline" 
                    className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 hover:border-emerald-200 h-11"
                    onClick={() => navigate('/patient/messages')}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                  <Button 
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 h-11"
                    onClick={() => {
                      setSelectedDoctor(doctor);
                      setIsBookingOpen(true);
                    }}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Prendre RDV
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Dialog */}
      <Dialog open={isBookingOpen} onClose={() => setIsBookingOpen(false)}>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold overflow-hidden">
              {selectedDoctor?.photo_url ? (
                <img 
                  src={selectedDoctor.photo_url} 
                  alt={selectedDoctor.full_name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                selectedDoctor?.full_name.split(' ').map((n: string) => n[0]).join('')
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Prendre rendez-vous</h2>
              <p className="text-sm text-slate-500">avec {selectedDoctor?.full_name}</p>
            </div>
          </div>

          {availabilityWindows.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
                <Info className="w-3 h-3" />
                Plages de disponibilité du praticien
              </h3>
              <div className="overflow-hidden rounded-xl border border-blue-200 bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-blue-50/50">
                    <tr>
                      <th className="p-2 text-[10px] font-bold text-blue-600 uppercase">Période</th>
                      <th className="p-2 text-[10px] font-bold text-blue-600 uppercase">Jours</th>
                      <th className="p-2 text-[10px] font-bold text-blue-600 uppercase text-right">Horaires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {availabilityWindows.map((window: any) => (
                      <tr key={window.id} className="text-[10px] text-blue-800">
                        <td className="p-2 whitespace-nowrap">
                          {new Date(window.start_date).toLocaleDateString('fr-FR')} - {new Date(window.end_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="p-2">
                          {window.days_of_week && JSON.parse(window.days_of_week).length > 0 
                            ? JSON.parse(window.days_of_week).map((d: number) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d]).join(', ')
                            : 'Tous les jours'}
                        </td>
                        <td className="p-2 text-right font-bold">
                          {window.start_time} - {window.end_time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-blue-600 italic">
                * Les rendez-vous sont attribués par ordre de réservation dans la limite des places disponibles.
              </p>
            </div>
          )}

          <form onSubmit={handleBookAppointment} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="date" className="text-sm font-medium text-slate-700">Date</label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                  {availabilityStatus && (
                    <p className={`text-[10px] font-bold uppercase ${availabilityStatus.available ? 'text-emerald-600' : 'text-red-600'}`}>
                      {availabilityStatus.available 
                        ? `Disponible (${availabilityStatus.current}/${availabilityStatus.max} RDV)` 
                        : availabilityStatus.error || 'Indisponible'}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="time" className="text-sm font-medium text-slate-700">Heure</label>
                  <Input 
                    id="time" 
                    type="time" 
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    required
                    className="rounded-xl"
                  />
                  {availabilityStatus?.available && (
                    <p className="text-[10px] text-slate-500 italic">
                      Plage: {availabilityStatus.start_time} - {availabilityStatus.end_time}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Type de consultation</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Consultation', 'Téléconsultation', 'Suivi', 'Urgence'].map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant={bookingType === type ? 'primary' : 'outline'}
                      className={cn(
                        "rounded-xl text-xs h-10",
                        bookingType === type ? "bg-emerald-600 hover:bg-emerald-700" : "border-slate-200 text-slate-600"
                      )}
                      onClick={() => setBookingType(type)}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="ghost" className="flex-1 rounded-xl" onClick={() => setIsBookingOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-lg shadow-emerald-100">
                Confirmer le RDV
              </Button>
            </div>
          </form>
        </div>
      </Dialog>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <Check className={cn("w-4 h-4", className)} strokeWidth={3} />
  );
}
