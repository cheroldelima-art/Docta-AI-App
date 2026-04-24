import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Dialog, Input, Badge, ConfirmDialog } from '@/components/ui';
import { FileText, Upload, Send, Trash2, Search, Filter, Eye, Download, User, Stethoscope, Clock, AlertCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function PatientDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newDoc, setNewDoc] = useState({
    title: '',
    type: 'BIOLOGY',
    doctorId: '',
    content: '',
    file_url: ''
  });

  useEffect(() => {
    fetchDocuments();
    fetchDoctors();
  }, []);

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/patient/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await fetch('/api/patient/doctors');
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Fichier trop volumineux', { description: 'La taille maximale est de 5 Mo.' });
      return;
    }

    setSelectedFile(file);
    setUploadProgress(0);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        setNewDoc(prev => ({ ...prev, file_url: response.url }));
        toast.success('Fichier prêt', { description: 'Le fichier a été téléversé avec succès.' });
      } else {
        const errorData = JSON.parse(xhr.responseText);
        toast.error('Échec du téléversement', { 
          description: `${errorData.error || 'Une erreur est survenue.'} Veuillez réessayer.` 
        });
        setSelectedFile(null);
        setUploadProgress(0);
      }
      setUploading(false);
    });

    xhr.addEventListener('error', () => {
      toast.error('Erreur réseau', { description: 'Impossible de contacter le serveur. Veuillez vérifier votre connexion et réessayer.' });
      setUploading(false);
      setSelectedFile(null);
      setUploadProgress(0);
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  const handleUpload = async () => {
    if (!newDoc.title || !newDoc.doctorId) {
      toast.error('Champs manquants', { description: 'Veuillez remplir le titre et choisir un praticien.' });
      return;
    }

    if (!newDoc.file_url && !newDoc.content) {
      toast.error('Document vide', { description: 'Veuillez téléverser un fichier ou ajouter un commentaire.' });
      return;
    }

    setUploading(true);
    try {
      const res = await fetch('/api/patient/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDoc)
      });

      if (res.ok) {
        toast.success('Succès', { description: 'Document envoyé au praticien.' });
        setShowUploadDialog(false);
        setNewDoc({ title: '', type: 'BIOLOGY', doctorId: '', content: '', file_url: '' });
        setSelectedFile(null);
        setUploadProgress(0);
        fetchDocuments();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de l\'enregistrement du document.');
      }
    } catch (error: any) {
      toast.error('Erreur', { 
        description: `${error.message}. Veuillez réessayer l'envoi.` 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/patient/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Document supprimé');
        fetchDocuments();
      }
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.doctor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDocTypeBadge = (type: string) => {
    switch (type) {
      case 'BIOLOGY': return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Biologie</Badge>;
      case 'IMAGING': return <Badge className="bg-purple-100 text-purple-700 border-purple-200">Imagerie</Badge>;
      case 'PRESCRIPTION': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ordonnance</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 border-slate-200">{type}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/patient/records">
            <Button variant="ghost" size="sm" className="rounded-full hover:bg-emerald-50 text-emerald-600 p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mes Documents Partagés</h1>
            <p className="text-slate-500 mt-1">Envoyez vos résultats d'examens à vos praticiens pour interprétation.</p>
          </div>
        </div>
        <Button onClick={() => setShowUploadDialog(true)} className="rounded-xl shadow-lg shadow-emerald-200 bg-emerald-600 hover:bg-emerald-700">
          <Upload className="w-4 h-4 mr-2" />
          Partager un document
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Rechercher par titre ou médecin..." 
            className="pl-10 rounded-xl border-slate-200 focus:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl border-slate-200">
            <Filter className="w-4 h-4 mr-2" />
            Filtrer
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-emerald-600 font-medium">Chargement de vos documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card className="border-dashed border-2 rounded-3xl">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Aucun document partagé</h3>
            <p className="text-slate-500 max-w-xs mt-2">
              Vous n'avez pas encore partagé de documents avec vos praticiens.
            </p>
            <Button variant="outline" className="mt-6 rounded-xl" onClick={() => setShowUploadDialog(true)}>
              Partager mon premier document
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} className="rounded-3xl border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
              <div className="h-2 bg-emerald-500" />
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  {getDocTypeBadge(doc.type)}
                </div>
                
                <h3 className="font-bold text-slate-900 text-lg mb-1 truncate">{doc.title}</h3>
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span className="truncate">Dr. {doc.doctor_name}</span>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.timestamp).toLocaleDateString()}
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold">
                      {doc.file_url ? 'Fichier joint' : 'Note texte'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button variant="ghost" size="sm" className="flex-1 rounded-lg hover:bg-slate-50 text-slate-600">
                      <Eye className="w-4 h-4 mr-2" />
                      Voir
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="rounded-lg text-red-500 hover:bg-red-50"
                      onClick={() => {
                        setDocToDelete(doc.id);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDocToDelete(null);
        }}
        onConfirm={() => {
          if (docToDelete) {
            handleDelete(docToDelete);
          }
        }}
        title="Supprimer le document"
        description="Voulez-vous vraiment supprimer ce document médical ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
      />

      <Dialog open={showUploadDialog} onClose={() => setShowUploadDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900">Partager un document</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Titre du document</label>
              <Input 
                placeholder="Ex: Résultats d'analyse sanguine" 
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Type</label>
                <select 
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newDoc.type}
                  onChange={(e) => setNewDoc({ ...newDoc, type: e.target.value })}
                >
                  <option value="BIOLOGY">Biologie</option>
                  <option value="IMAGING">Imagerie</option>
                  <option value="PRESCRIPTION">Ordonnance</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Praticien destinataire</label>
                <select 
                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newDoc.doctorId}
                  onChange={(e) => setNewDoc({ ...newDoc, doctorId: e.target.value })}
                >
                  <option value="">Choisir un médecin</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>Dr. {d.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Commentaire / Description</label>
              <textarea 
                className="w-full min-h-[100px] p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Ajoutez des précisions pour votre médecin..."
                value={newDoc.content}
                onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
              />
            </div>

            <div 
              className="p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center group hover:border-emerald-400 transition-colors cursor-pointer relative overflow-hidden"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <input 
                id="file-upload"
                type="file" 
                className="hidden" 
                accept=".pdf,image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
              
              {uploading ? (
                <div className="w-full space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto animate-pulse">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-slate-900">Téléversement en cours... {uploadProgress}%</p>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">Cliquez pour changer de fichier</p>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">Cliquez pour téléverser un fichier</p>
                  <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG (Max 5Mo)</p>
                </>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                En partageant ce document, vous autorisez le praticien sélectionné à consulter ces informations médicales.
              </p>
            </div>

            <Button 
              className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-100"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Envoi en cours...' : 'Envoyer le document'}
              <Send className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function XCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
