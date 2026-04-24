import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Dialog, Input, ConfirmDialog } from '@/components/ui';
import { FileText, Activity, AlertCircle, Sparkles, Stethoscope, Pill, ChevronDown, User, Calendar, Clock, ArrowRightLeft, Search, PenTool, Camera, Upload, Download, ArrowUpDown, Shield, Plus, Edit2, Trash2, ArrowLeft, History as HistoryIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from "@google/genai";
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

export default function PatientRecord() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingVitals, setIsLoadingVitals] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [activeTab, setActiveTab] = useState('timeline');
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // New Record state
  const [showNewRecordDialog, setShowNewRecordDialog] = useState(false);
  const [newRecord, setNewRecord] = useState({
    type: 'CONSULTATION',
    title: '',
    content: '',
    signature: '',
    file_url: ''
  });
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMyNotesOnly, setIsMyNotesOnly] = useState(false);
  
  // Edit Record state
  const [showEditRecordDialog, setShowEditRecordDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAmelieOpen, setIsAmelieOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<any[]>([]);
  const [userPrompt, setUserPrompt] = useState('');
  const [vitalsTimeRange, setVitalsTimeRange] = useState<'7d' | '1m' | '3m' | 'all'>('1m');
  const [showOnlyAppointments, setShowOnlyAppointments] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (aiMessages.length > 0) {
      scrollToBottom();
    }
  }, [aiMessages]);
  
  const patientMetadata = useMemo(() => {
    if (!patient?.metadata) return {};
    try {
      return typeof patient.metadata === 'string' ? JSON.parse(patient.metadata) : patient.metadata;
    } catch (e) {
      return {};
    }
  }, [patient?.metadata]);

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

  const patientAge = calculateAge(patient?.dob);
  const isChild = patientAge < 12;
  const isAdolescent = patientAge >= 12 && patientAge < 18;
  const isAdult = patientAge >= 18;

  const filteredRecords = useMemo(() => {
    let result = records;
    if (isMyNotesOnly && user) {
      result = result.filter(r => r.author_id === user.id);
    }
    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    return result.filter(r => 
      r.title.toLowerCase().includes(q) || 
      r.content.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    );
  }, [records, searchQuery, isMyNotesOnly, user]);
  
  // Vitals state
  const [showVitalsDialog, setShowVitalsDialog] = useState(false);
  const [vitals, setVitals] = useState({
    weight: '',
    height: '',
    blood_pressure_sys: '',
    blood_pressure_dia: '',
    heart_rate: '',
    temperature: '',
    oxygen_saturation: ''
  });
  const [isSubmittingVitals, setIsSubmittingVitals] = useState(false);
  const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);
  const [vitalsSortConfig, setVitalsSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'timestamp', direction: 'desc' });

  // Medications state
  const [medications, setMedications] = useState<any[]>([]);
  const [isLoadingMedications, setIsLoadingMedications] = useState(false);
  const [showMedicationDialog, setShowMedicationDialog] = useState(false);
  const [editingMedication, setEditingMedication] = useState<any>(null);
  const [medicationForm, setMedicationForm] = useState({
    drug_name: '',
    dosage: '',
    frequency: '',
    reminder_time: '',
    reminder_days: [] as string[],
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });
  const [showMedicationDeleteConfirm, setShowMedicationDeleteConfirm] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<number | null>(null);

  // Patient History state
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyForm, setHistoryForm] = useState({
    type: 'PATHOLOGY' as 'PATHOLOGY' | 'SURGERY' | 'TREATMENT',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedPatientHistory = useMemo(() => {
    return [...patientHistory].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return historySortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [patientHistory, historySortOrder]);

  const sortedVitalsHistory = useMemo(() => {
    let sortableItems = [...vitalsHistory];
    if (vitalsSortConfig.key) {
      sortableItems.sort((a, b) => {
        if (a[vitalsSortConfig.key] < b[vitalsSortConfig.key]) {
          return vitalsSortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[vitalsSortConfig.key] > b[vitalsSortConfig.key]) {
          return vitalsSortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [vitalsHistory, vitalsSortConfig]);

  const requestVitalsSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (vitalsSortConfig.key === key && vitalsSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setVitalsSortConfig({ key, direction });
  };

  const exportVitalsToCSV = () => {
    if (vitalsHistory.length === 0) return;

    const headers = ['Date', 'Poids', 'Taille', 'Tension Systolique', 'Tension Diastolique', 'Pouls', 'Température', 'Saturation O2'];
    const csvContent = [
      headers.join(','),
      ...vitalsHistory.map(v => [
        new Date(v.timestamp).toLocaleString(),
        v.weight || '',
        v.height || '',
        v.blood_pressure_sys || '',
        v.blood_pressure_dia || '',
        v.heart_rate || '',
        v.temperature || '',
        v.oxygen_saturation || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `constantes_${patient?.name || 'patient'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export réussi');
  };
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  const chartData = useMemo(() => {
    let filteredVitals = [...vitalsHistory].reverse();
    
    if (vitalsTimeRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      if (vitalsTimeRange === '7d') cutoff.setDate(now.getDate() - 7);
      else if (vitalsTimeRange === '1m') cutoff.setMonth(now.getMonth() - 1);
      else if (vitalsTimeRange === '3m') cutoff.setMonth(now.getMonth() - 3);
      
      filteredVitals = filteredVitals.filter(v => new Date(v.timestamp) >= cutoff);
    }

    return filteredVitals.map(v => ({
      date: new Date(v.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      poids: v.weight,
      tension_sys: v.blood_pressure_sys,
      tension_dia: v.blood_pressure_dia,
      pouls: v.heart_rate,
      temperature: v.temperature,
      o2: v.oxygen_saturation,
    }));
  }, [vitalsHistory, vitalsTimeRange]);

  // Transfer state
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [practitionerSearch, setPractitionerSearch] = useState('');
  const [practitioners, setPractitioners] = useState<any[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<any>(null);
  const [isConfirmingTransfer, setIsConfirmingTransfer] = useState(false);
  const [showTransferConfirmDialog, setShowTransferConfirmDialog] = useState(false);

  const fetchVitalsHistory = async () => {
    try {
      const res = await fetch(`/api/patients/${id}/vitals`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setVitalsHistory(data);
      }
    } catch (error) {
      console.error('Error fetching vitals:', error);
    }
  };

  const fetchMedications = async () => {
    setIsLoadingMedications(true);
    try {
      const res = await fetch(`/api/patients/${id}/medications`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setMedications(data);
      }
    } catch (error) {
      console.error('Error fetching medications:', error);
    } finally {
      setIsLoadingMedications(false);
    }
  };

  const fetchAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      const res = await fetch(`/api/patients/${id}/appointments`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAppointments(data);
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  useEffect(() => {
    fetchPatientFullData();
  }, [id]);

  const fetchPatientFullData = async () => {
    setIsLoading(true);
    setIsLoadingHistory(true);
    setIsLoadingVitals(true);
    setIsLoadingMedications(true);
    setIsLoadingAppointments(true);

    try {
      const res = await fetch(`/api/patients/${id}/full-summary?limit=10&offset=0`);
      const data = await res.json();
      
      if (data.error) {
        toast.error('Erreur de chargement', { description: data.error });
        return;
      }

      setPatient(data.patient);
      setRecords(data.records || []);
      setTotalRecords(data.totalRecords || 0);
      setVitalsHistory(data.vitalsHistory || []);
      setMedications(data.medications || []);
      setPatientHistory(data.history || []);
      setAppointments(data.appointments || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Erreur', { description: 'Impossible de charger le dossier complet.' });
    } finally {
      setIsLoading(false);
      setIsLoadingHistory(false);
      setIsLoadingVitals(false);
      setIsLoadingMedications(false);
      setIsLoadingAppointments(false);
    }
  };

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/patients/${id}/history`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setPatientHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historyForm.description || !historyForm.date) {
      toast.error('Erreur', { description: 'Veuillez remplir tous les champs.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/patients/${id}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyForm),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success('Antécédent ajouté');
        setShowHistoryDialog(false);
        setHistoryForm({
          type: 'PATHOLOGY',
          description: '',
          date: new Date().toISOString().split('T')[0]
        });
        fetchHistory();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMoreRecords = async () => {
    if (records.length >= totalRecords || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/patients/${id}?limit=10&offset=${records.length}`);
      const data = await res.json();
      if (data.records) {
        setRecords(prev => [...prev, ...data.records]);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erreur de chargement', { description: 'Impossible de charger plus de documents.' });
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (showTransferDialog && practitionerSearch.length > 2) {
      const timeoutId = setTimeout(() => {
        fetch(`/api/pro/practitioners?q=${practitionerSearch}`)
          .then(res => res.json())
          .then(setPractitioners)
          .catch(console.error);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setPractitioners([]);
    }
  }, [practitionerSearch, showTransferDialog]);

  const handleTransfer = async () => {
    if (!selectedPractitioner) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selectedPractitioner.id, patientId: id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Demande de transfert envoyée');
        setShowTransferConfirmDialog(false);
        setShowTransferDialog(false);
        setSelectedPractitioner(null);
        setPractitionerSearch('');
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.title || !newRecord.content) {
      toast.error('Erreur', { description: 'Le titre et le contenu sont obligatoires.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = newRecord.file_url;
      
      if (recordFile) {
        const formData = new FormData();
        formData.append('file', recordFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error);
        fileUrl = uploadData.url;
      }

      const res = await fetch(`/api/patients/${id}/records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRecord, file_url: fileUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Document créé avec succès');
        setShowNewRecordDialog(false);
        setNewRecord({ type: 'CONSULTATION', title: '', content: '', signature: '', file_url: '' });
        setRecordFile(null);
        // Refresh records
        const refreshRes = await fetch(`/api/patients/${id}`);
        const refreshData = await refreshRes.json();
        setRecords(refreshData.records || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord.title || !editingRecord.content) {
      toast.error('Erreur', { description: 'Le titre et le contenu sont obligatoires.' });
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl = editingRecord.file_url;
      
      if (recordFile) {
        const formData = new FormData();
        formData.append('file', recordFile);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.error) throw new Error(uploadData.error);
        fileUrl = uploadData.url;
      }

      const res = await fetch(`/api/patients/${id}/records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingRecord, file_url: fileUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Document mis à jour');
        setShowEditRecordDialog(false);
        setEditingRecord(null);
        setRecordFile(null);
        // Refresh records
        const refreshRes = await fetch(`/api/patients/${id}`);
        const refreshData = await refreshRes.json();
        setRecords(refreshData.records || []);
        if (selectedRecord?.id === editingRecord.id) {
          setSelectedRecord(refreshData.records.find((r: any) => r.id === editingRecord.id));
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async (recordId: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce document ? Cette action est irréversible.')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/patients/${id}/records/${recordId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Document supprimé');
        setSelectedRecord(null);
        // Refresh records
        const refreshRes = await fetch(`/api/patients/${id}`);
        const refreshData = await refreshRes.json();
        setRecords(refreshData.records || []);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingVitals(true);
    try {
      const res = await fetch(`/api/patients/${id}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: parseFloat(vitals.weight) || null,
          height: parseFloat(vitals.height) || null,
          blood_pressure_sys: parseInt(vitals.blood_pressure_sys) || null,
          blood_pressure_dia: parseInt(vitals.blood_pressure_dia) || null,
          heart_rate: parseInt(vitals.heart_rate) || null,
          temperature: parseFloat(vitals.temperature) || null,
          oxygen_saturation: parseInt(vitals.oxygen_saturation) || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Constantes enregistrées');
        setShowVitalsDialog(false);
        setVitals({
          weight: '',
          height: '',
          blood_pressure_sys: '',
          blood_pressure_dia: '',
          heart_rate: '',
          temperature: '',
          oxygen_saturation: ''
        });
        fetchVitalsHistory();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmittingVitals(false);
    }
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicationForm.drug_name || !medicationForm.dosage || !medicationForm.frequency) {
      toast.error('Erreur', { description: 'Veuillez remplir tous les champs obligatoires.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingMedication 
        ? `/api/patient/medications/${editingMedication.id}` 
        : '/api/patient/medications';
      
      const method = editingMedication ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...medicationForm,
          patient_user_id: patient.user_id
        }),
      });
      
      const data = await res.json();
      if (res.ok) {
        toast.success(editingMedication ? 'Médicament mis à jour' : 'Médicament prescrit');
        setShowMedicationDialog(false);
        setEditingMedication(null);
        setMedicationForm({
          drug_name: '',
          dosage: '',
          frequency: '',
          reminder_time: '',
          reminder_days: [],
          start_date: new Date().toISOString().split('T')[0],
          end_date: ''
        });
        fetchMedications();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMedication = async () => {
    if (!medicationToDelete) return;
    
    try {
      const res = await fetch(`/api/patient/medications/${medicationToDelete}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Médicament supprimé');
        fetchMedications();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setShowMedicationDeleteConfirm(false);
      setMedicationToDelete(null);
    }
  };

  const toggleMedicationStatus = async (med: any) => {
    try {
      const res = await fetch(`/api/patient/medications/${med.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...med,
          is_active: !med.is_active,
          patient_user_id: patient.user_id
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(med.is_active ? 'Médicament désactivé' : 'Médicament activé');
        fetchMedications();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    }
  };

  const runAmelieAnalysis = async (promptType: string, customPrompt?: string) => {
    setIsAnalyzing(true);
    setAiError('');
    
    let prompt = customPrompt || '';
    if (!customPrompt) {
      if (promptType === 'summary') {
        prompt = "Fais un résumé synthétique et structuré du dossier de ce patient. Concentre-toi spécifiquement sur : 1. Les antécédents médicaux, 2. Les pathologies chroniques, 3. Les chirurgies passées, 4. Les allergies connues. Utilise des listes à puces pour la clarté.";
      } else if (promptType === 'coherence') {
        prompt = "Recherche des incohérences dans les données du patient. Analyse spécifiquement : 1. Les dosages médicamenteux inhabituels ou hors normes, 2. Les contre-indications potentielles entre les traitements actuels et les pathologies ou allergies du patient. Signale toute anomalie détectée avec prudence.";
      } else if (promptType === 'interactions') {
        prompt = "Recherche spécifiquement des interactions médicamenteuses dangereuses ou des contre-indications entre les médicaments actuels et les antécédents/allergies du patient.";
      } else if (promptType === 'vitals') {
        prompt = "Analyse les constantes vitales de ce patient et identifie les tendances ou alertes pertinentes compte tenu de son âge et de ma spécialité. Signale toute évolution préoccupante (poids, tension, pouls, etc.).";
      }
    }
    
    if (customPrompt) {
      setAiMessages(prev => [...prev, { role: 'user', text: customPrompt }]);
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const systemInstruction = `
        Tu es Amelie AI, une assistante médicale experte intégrée au logiciel Docta AI au Gabon. 
        Ton rôle est d'aider le praticien à analyser le dossier patient. 
        
        RÈGLES CRITIQUES:
        1. Tu ne prends JAMAIS de décision médicale. Utilise des formulations prudentes comme "Il pourrait être utile de vérifier...", "L'historique suggère...", "Attention à une possible interaction...".
        2. Tu as un accès en lecture seule. Tu ne peux pas modifier le dossier.
        3. Base tes analyses sur les données fournies dans le contexte.
        4. Tiens compte de l'épidémiologie locale au Gabon (paludisme, drépanocytose, VIH, etc.) si pertinent.
        5. Sois concise, professionnelle et structurée (utilise le Markdown).
        6. Ne mentionne pas que tu es une IA sauf si on te le demande.
        7. Si des données sont manquantes pour une analyse complète, signale-le poliment.
        8. INTERDIT : "Prescrivez", "Vous devez", "Diagnostic confirmé".

        CONTEXTE PATIENT :
        Nom : ${patient.first_name} ${patient.last_name}
        Sexe : ${patient.gender === 'M' ? 'Masculin' : 'Féminin'}
        Âge : ${patientAge} ans
        Allergies : ${patient.allergies || 'Aucune connue'}
        Antécédents (Pathologies, Chirurgies, Traitements passés) : ${JSON.stringify(patientHistory)}
        Spécialité du praticien : ${user?.specialty || 'Généraliste'}
        
        DOSSIER MÉDICAL (Extraits récents) :
        ${JSON.stringify(records.slice(0, 20))}
        
        MÉDICAMENTS ACTUELS :
        ${JSON.stringify(medications.filter((m: any) => m.is_active))}

        CONSTANTES VITALES :
        ${JSON.stringify(vitalsHistory.slice(0, 10))}

        INSTRUCTIONS SPÉCIFIQUES POUR LES INTERACTIONS :
        Si l'utilisateur demande une analyse des interactions, recherche spécifiquement :
        - Les interactions entre les médicaments actuels.
        - Les contre-indications entre les médicaments et les pathologies/antécédents du patient.
        - Les risques liés aux allergies connues (${patient.allergies || 'Aucune connue'}).
        - Les effets secondaires potentiels notables pour ce profil de patient.

        INSTRUCTIONS D'ANALYSE GÉNÉRALE :
        Lorsqu'une question porte sur les constantes vitales, analyse les tendances. Identifie les anomalies ou les évolutions préoccupantes en fonction de l'âge du patient (${patientAge} ans) et de ta spécialité (${user?.specialty || 'Généraliste'}). Propose des alertes si nécessaire.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...aiMessages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          })),
          { role: 'user', parts: [{ text: prompt }] }
        ],
        config: {
          systemInstruction,
        }
      });

      const responseText = response.text || "Désolée, je n'ai pas pu générer de réponse.";

      if (customPrompt) {
        setAiMessages(prev => [...prev, { role: 'model', text: responseText }]);
      } else {
        setAiAnalysis(responseText);
      }
      
      // Log AI usage
      try {
        await fetch('/api/amelie/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patient_id: id,
            prompt_hash: promptType,
            request_type: promptType,
            query: prompt,
            response_summary: responseText.substring(0, 200),
            full_response: responseText
          })
        });
      } catch (logError) {
        console.warn('Failed to log AI interaction:', logError);
      }

      toast.success('Réponse reçue', { description: 'Amelie AI a traité votre demande.' });
    } catch (error: any) {
      console.error('AI Error:', error);
      setAiError(error.message || "Désolée, je rencontre une difficulté technique. Veuillez réessayer.");
      toast.error('Erreur IA', { description: error.message || 'Impossible de générer la réponse.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendAiMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim() || isAnalyzing) return;
    const prompt = userPrompt.trim();
    setUserPrompt('');
    runAmelieAnalysis('custom', prompt);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.error) throw new Error(uploadData.error);

      const updateRes = await fetch(`/api/patients/${id}/photo`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_url: uploadData.url }),
      });
      const updateData = await updateRes.json();
      if (updateData.success) {
        setPatient({ ...patient, photo_url: uploadData.url });
        toast.success('Photo mise à jour');
      }
    } catch (error: any) {
      toast.error('Erreur', { description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  if (!patient) return <div className="p-8 text-center">Chargement du dossier...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
      {/* Top Patient Name Banner */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 -mx-6 -mt-6 mb-2 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-full hover:bg-slate-100 text-slate-500 p-2"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
            {patient.first_name[0]}{patient.last_name[0]}
          </div>
          <h2 className="text-lg font-bold text-slate-800">Dossier de : {patient.first_name} {patient.last_name}</h2>
          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Docta ID:</span>
            <span className="text-sm font-mono font-bold text-blue-700">{patient.share_id}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50"
            onClick={() => navigate(`/pro/amelie?patientId=${id}`)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Ouvrir Amelie (Plein écran)
          </Button>
          <span className="text-xs text-slate-400 italic">Dernière mise à jour : {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden relative">
        {/* Left Column: Patient Info & Timeline (8 cols) */}
        <div className={`lg:col-span-8 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar ${isAmelieOpen ? 'hidden lg:flex' : 'flex'}`}>
        {/* Patient Header Card */}
        <Card className="border-l-4 border-l-blue-600">
          <CardContent className="p-6 flex justify-between items-start">
            <div className="flex gap-4">
              <div className="relative group">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-600 overflow-hidden border-2 border-white shadow-sm">
                  {patient.photo_url ? (
                    <img src={patient.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <>{patient.first_name[0]}{patient.last_name[0]}</>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Camera className="w-3 h-3" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handlePhotoUpload} 
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{patient.first_name} {patient.last_name}</h1>
                <div className="flex gap-3 text-sm text-slate-500 mt-1">
                  <span className="flex items-center gap-1"><User className="w-4 h-4" /> {patient.gender === 'M' ? 'Homme' : 'Femme'}</span>
                  <span>•</span>
                  <span>Né(e) le {patient.dob} ({patientAge} ans)</span>
                </div>
                
                {/* Age Specific Metadata Display */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isChild && (
                    <>
                      {patientMetadata.parent_name && (
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">Parent/Tuteur</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.parent_name}</span>
                        </div>
                      )}
                      {patientMetadata.parent_phone && (
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">Téléphone Parent</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.parent_phone}</span>
                        </div>
                      )}
                      {patientMetadata.birth_weight && (
                        <div className="bg-blue-50/50 p-2 rounded-lg border border-blue-100 flex flex-col">
                          <span className="text-[10px] font-bold text-blue-400 uppercase">Poids Naissance</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.birth_weight} kg</span>
                        </div>
                      )}
                    </>
                  )}

                  {isAdolescent && (
                    <>
                      {patientMetadata.school && (
                        <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Établissement</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.school}</span>
                        </div>
                      )}
                      {patientMetadata.sports && (
                        <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">Sports/Loisirs</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.sports}</span>
                        </div>
                      )}
                    </>
                  )}

                  {isAdult && (
                    <>
                      {patientMetadata.profession && (
                        <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100 flex flex-col">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">Profession</span>
                          <span className="text-sm font-medium text-slate-700">{patientMetadata.profession}</span>
                        </div>
                      )}
                      {patientMetadata.marital_status && (
                        <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100 flex flex-col">
                          <span className="text-[10px] font-bold text-amber-400 uppercase">Situation Familiale</span>
                          <span className="text-sm font-medium text-slate-700">
                            {patientMetadata.marital_status === 'single' ? 'Célibataire' : 
                             patientMetadata.marital_status === 'married' ? 'Marié(e)' :
                             patientMetadata.marital_status === 'divorced' ? 'Divorcé(e)' :
                             patientMetadata.marital_status === 'widowed' ? 'Veuf/Veuve' : patientMetadata.marital_status}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <Badge variant="warning">Allergie Pénicilline</Badge>
                  <Badge variant="default">Diabète Type 2</Badge>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" icon={ArrowRightLeft} onClick={() => setShowTransferDialog(true)}>Transférer</Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Modifier profil', { description: 'Fonctionnalité à venir.' })}>Modifier profil</Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Quick Vitals Summary */}
        {vitalsHistory.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tension</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].blood_pressure_sys}/{vitalsHistory[0].blood_pressure_dia}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">mmHg</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pouls</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].heart_rate}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">bpm</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Temp.</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].temperature}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">°C</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sat. O2</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].oxygen_saturation}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">%</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Poids</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].weight}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">kg</span>
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-100 shadow-sm">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Taille</span>
                <p className="text-lg font-bold text-slate-900 mt-1">
                  {vitalsHistory[0].height}
                  <span className="text-[10px] font-normal text-slate-500 ml-1">cm</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs & Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-4 border-b border-slate-200">
            <button 
              className={`px-6 py-3 text-base font-bold border-b-4 transition-all ${activeTab === 'timeline' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('timeline')}
            >
              Parcours de soins
            </button>
            <button 
              className={`px-6 py-3 text-base font-bold border-b-4 transition-all flex items-center gap-2 ${activeTab === 'history' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('history')}
            >
              <FileText className="w-5 h-5" />
              Antécédents
            </button>
            <button 
              className={`px-6 py-3 text-base font-bold border-b-4 transition-all flex items-center gap-2 ${activeTab === 'appointments' ? 'border-indigo-500 text-indigo-500 bg-indigo-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('appointments')}
            >
              <Calendar className="w-5 h-5" />
              Rendez-vous
            </button>
            <button 
              className={`px-6 py-3 text-base font-bold border-b-4 transition-all flex items-center gap-2 ${activeTab === 'vitals' ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('vitals')}
            >
              <Activity className="w-5 h-5" />
              Constantes Vitales
            </button>
            <button 
              className={`px-6 py-3 text-base font-bold border-b-4 transition-all flex items-center gap-2 ${activeTab === 'medications' ? 'border-amber-600 text-amber-600 bg-amber-50/30' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              onClick={() => setActiveTab('medications')}
            >
              <Pill className="w-5 h-5" />
              Médications
            </button>
          </div>

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {/* Recent Vitals Summary Section */}
              {vitalsHistory.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-500" />
                      Dernières Constantes (5 dernières prises)
                    </h3>
                    <Button variant="link" size="sm" onClick={() => setActiveTab('vitals')}>Voir tout l'historique</Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {vitalsHistory.slice(0, 5).map((v, idx) => (
                      <div key={v.id} className={cn("p-3 rounded-xl border border-slate-50", idx === 0 ? "bg-emerald-50/30 border-emerald-100" : "bg-slate-50/30")}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                          {new Date(v.timestamp).toLocaleDateString()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Poids:</span>
                            <span className="font-bold text-slate-900">{v.weight || '-'} kg</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Tension:</span>
                            <span className="font-bold text-slate-900">{v.blood_pressure_sys && v.blood_pressure_dia ? `${v.blood_pressure_sys}/${v.blood_pressure_dia}` : '-'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Pouls:</span>
                            <span className="font-bold text-slate-900">{v.heart_rate || '-'} bpm</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                  <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">Parcours de soins ({totalRecords})</h2>
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Rechercher un document..." 
                      className="pl-9 h-9 text-xs bg-slate-50 border-slate-200"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button 
                    variant={showOnlyAppointments ? "secondary" : "outline"} 
                    size="sm" 
                    className="h-9 text-xs font-semibold"
                    onClick={() => setShowOnlyAppointments(!showOnlyAppointments)}
                  >
                    {showOnlyAppointments ? 'Tous les documents' : 'Historique RDV'}
                  </Button>
                  <Button 
                    variant={isMyNotesOnly ? "primary" : "outline"} 
                    size="sm" 
                    className="h-9 text-xs font-semibold"
                    onClick={() => setIsMyNotesOnly(!isMyNotesOnly)}
                  >
                    {isMyNotesOnly ? 'Toutes les notes' : 'Mes notes uniquement'}
                  </Button>
                  <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
                  <Button 
                    size="sm" 
                    variant="primary" 
                    icon={Activity} 
                    onClick={() => setShowVitalsDialog(true)}
                    className="h-9 text-xs font-semibold shadow-sm"
                  >
                    Nouvelle Constante
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    icon={Pill} 
                    onClick={() => {
                      setNewRecord({ ...newRecord, type: 'PRESCRIPTION', title: 'Ordonnance' });
                      setShowNewRecordDialog(true);
                    }}
                    className="h-9 text-xs font-semibold shadow-sm"
                  >
                    Prescription
                  </Button>
                  <Button 
                    size="sm" 
                    icon={FileText} 
                    onClick={() => {
                      setNewRecord({ ...newRecord, type: 'CONSULTATION', title: 'Note de consultation' });
                      setShowNewRecordDialog(true);
                    }}
                    className="h-9 text-xs font-semibold shadow-sm bg-indigo-600 hover:bg-indigo-700"
                  >
                    Nouvelle Consultation
                  </Button>
                </div>
              </div>

              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-8">
                {filteredRecords
                  .filter(r => !showOnlyAppointments || r.type === 'APPOINTMENT')
                  .map((record) => (
                  <div key={`${record.source}-${record.id}`} className="relative pl-8">
                    {/* Timeline Dot */}
                    <div className={cn(
                      "absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2",
                      record.type === 'APPOINTMENT' ? "border-amber-500" : "border-blue-500"
                    )} />
                    
                    <Card 
                      className={cn(
                        "hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99] transition-transform overflow-hidden border-slate-200",
                        record.type === 'APPOINTMENT' && "border-l-4 border-l-amber-500"
                      )}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <CardHeader className="py-3 bg-slate-50/50 flex flex-row items-center justify-between border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            record.type === 'CONSULTATION' ? 'default' :
                            record.type === 'PRESCRIPTION' ? 'secondary' :
                            record.type === 'APPOINTMENT' ? 'warning' :
                            'outline'
                          } className="uppercase text-[10px] tracking-wider">
                            {record.type === 'APPOINTMENT' ? 'Rendez-vous' : record.type}
                          </Badge>
                          <span className="text-sm text-slate-500">{new Date(record.timestamp).toLocaleDateString()}</span>
                          {record.file_url && <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-600 border-blue-100">DOC</Badge>}
                          {record.type === 'APPOINTMENT' && record.status && (
                            <Badge variant={
                              record.status === 'COMPLETED' ? 'success' :
                              record.status === 'CANCELLED' ? 'error' :
                              'default'
                            } className="text-[10px]">
                              {record.status === 'COMPLETED' ? 'Terminé' :
                               record.status === 'CANCELLED' ? 'Annulé' : 'Confirmé'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-400">Dr. {record.author_name}</span>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <h3 className="font-semibold text-slate-900 mb-2">{record.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap line-clamp-3">{record.content || 'Aucune note.'}</p>
                        {record.signature && (
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                              <Shield className="w-3 h-3" />
                              Signé numériquement
                            </div>
                            <span className="text-[10px] font-serif italic text-slate-400">{record.signature}</span>
                          </div>
                        )}
                        {record.type === 'APPOINTMENT' && (
                          <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {record.author_name}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>

              {records.length < totalRecords && (
                <div className="flex justify-center pb-8">
                  <Button 
                    variant="secondary" 
                    onClick={loadMoreRecords} 
                    disabled={isLoadingMore}
                    className="w-full max-w-xs"
                  >
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                        Chargement...
                      </div>
                    ) : (
                      'Charger plus de documents'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-8">
              {/* Actual Medical History (Antécédents Médicaux) */}
              <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <HistoryIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Antécédents Médicaux</h3>
                      <p className="text-sm text-slate-500">Pathologies, chirurgies et traitements de long terme.</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="primary" 
                    icon={Plus}
                    onClick={() => setShowHistoryDialog(true)}
                  >
                    Ajouter un antécédent
                  </Button>
                </div>

                <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Auteur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingHistory ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : sortedPatientHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic text-sm">
                            Aucun antécédent médical enregistré.
                          </td>
                        </tr>
                      ) : (
                        sortedPatientHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-white transition-colors">
                            <td className="px-4 py-3">
                              <Badge variant={
                                h.type === 'PATHOLOGY' ? 'error' : 
                                h.type === 'SURGERY' ? 'warning' : 'secondary'
                              } className="text-[10px] font-bold">
                                {h.type === 'PATHOLOGY' ? 'Pathologie' : 
                                 h.type === 'SURGERY' ? 'Chirurgie' : 'Traitement'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900 font-medium">{h.description}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">
                              {new Date(h.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-400 font-medium">Dr. {h.author_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Categorized Records Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                {/* Consultations Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900">Consultations</h3>
                  </div>
                  <div className="space-y-3">
                    {records.filter(r => r.type === 'CONSULTATION').length > 0 ? (
                      records.filter(r => r.type === 'CONSULTATION').map(record => (
                        <Card 
                          key={record.id} 
                          className="hover:shadow-md transition-all cursor-pointer border-slate-200 group"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(record.timestamp).toLocaleDateString()}</span>
                              {record.signature && <Shield className="w-3 h-3 text-emerald-500" />}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-900 mb-1 truncate group-hover:text-blue-600">{record.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{record.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 italic">Aucune consultation</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Prescriptions Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <Pill className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900">Ordonnances</h3>
                  </div>
                  <div className="space-y-3">
                    {records.filter(r => r.type === 'PRESCRIPTION').length > 0 ? (
                      records.filter(r => r.type === 'PRESCRIPTION').map(record => (
                        <Card 
                          key={record.id} 
                          className="hover:shadow-md transition-all cursor-pointer border-slate-200 group"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(record.timestamp).toLocaleDateString()}</span>
                              {record.signature && <Shield className="w-3 h-3 text-emerald-500" />}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-900 mb-1 truncate group-hover:text-emerald-600">{record.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{record.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 italic">Aucune ordonnance</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Lab Results Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Activity className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-slate-900">Analyses & Imagerie</h3>
                  </div>
                  <div className="space-y-3">
                    {records.filter(r => ['BIOLOGY', 'IMAGING'].includes(r.type)).length > 0 ? (
                      records.filter(r => ['BIOLOGY', 'IMAGING'].includes(r.type)).map(record => (
                        <Card 
                          key={record.id} 
                          className="hover:shadow-md transition-all cursor-pointer border-slate-200 group"
                          onClick={() => setSelectedRecord(record)}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(record.timestamp).toLocaleDateString()}</span>
                              {record.signature && <Shield className="w-3 h-3 text-emerald-500" />}
                            </div>
                            <h4 className="font-semibold text-sm text-slate-900 mb-1 truncate group-hover:text-amber-600">{record.title}</h4>
                            <p className="text-xs text-slate-500 line-clamp-2">{record.content}</p>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 italic">Aucun document</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'medications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Médicaments & Traitements</h2>
                <Button 
                  size="sm" 
                  variant="primary" 
                  icon={Plus} 
                  onClick={() => {
                    setEditingMedication(null);
                    setMedicationForm({
                      drug_name: '',
                      dosage: '',
                      frequency: '',
                      reminder_time: '',
                      reminder_days: [],
                      start_date: new Date().toISOString().split('T')[0],
                      end_date: ''
                    });
                    setShowMedicationDialog(true);
                  }}
                >
                  Prescrire un médicament
                </Button>
              </div>

              {isLoadingMedications ? (
                <div className="flex justify-center p-12">
                  <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : medications.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50">
                  <CardContent className="p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Pill className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Aucun traitement en cours</h3>
                    <p className="text-slate-500 text-sm max-w-xs mt-1">
                      Ce patient n'a pas encore de médicaments ou de rappels configurés.
                    </p>
                    <Button variant="outline" className="mt-6" onClick={() => setShowMedicationDialog(true)}>
                      Ajouter le premier médicament
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medications.map((med) => (
                    <Card key={med.id} className={cn("border-slate-200 transition-all hover:shadow-md", !med.is_active && "opacity-60")}>
                      <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                              <Pill className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900">{med.drug_name}</h3>
                              <p className="text-sm text-slate-500">{med.dosage}</p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setEditingMedication(med);
                                setMedicationForm({
                                  drug_name: med.drug_name,
                                  dosage: med.dosage,
                                  frequency: med.frequency,
                                  reminder_time: med.reminder_time || '',
                                  reminder_days: med.reminder_days ? JSON.parse(med.reminder_days) : [],
                                  start_date: med.start_date,
                                  end_date: med.end_date || ''
                                });
                                setShowMedicationDialog(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-red-500 hover:text-red-600 hover:bg-red-50" 
                              onClick={() => {
                                setMedicationToDelete(med.id);
                                setShowMedicationDeleteConfirm(true);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>
                              {med.reminder_time ? `À ${med.reminder_time}` : med.frequency}
                              {med.reminder_days && JSON.parse(med.reminder_days).length > 0 && ` • ${JSON.parse(med.reminder_days).join(', ')}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>Du {new Date(med.start_date).toLocaleDateString()} {med.end_date ? `au ${new Date(med.end_date).toLocaleDateString()}` : '(Continu)'}</span>
                          </div>
                        </div>

                        <div className="mt-6 flex items-center justify-between">
                          <Badge variant={med.is_active ? 'success' : 'secondary'}>
                            {med.is_active ? 'Actif' : 'Désactivé'}
                          </Badge>
                          <Button variant="outline" size="sm" onClick={() => toggleMedicationStatus(med)}>
                            {med.is_active ? 'Désactiver' : 'Activer'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Rendez-vous du patient</h2>
              </div>
              
              {isLoadingAppointments ? (
                <div className="flex justify-center p-12">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : appointments.length === 0 ? (
                <Card className="border-dashed border-2 bg-slate-50/50">
                  <CardContent className="p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                      <Calendar className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Aucun rendez-vous</h3>
                    <p className="text-slate-500 text-sm max-w-xs mt-1">
                      Ce patient n'a pas encore pris de rendez-vous avec vous ou d'autres praticiens du réseau.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {appointments.map((apt: any) => (
                    <Card key={apt.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold",
                             apt.status === 'CANCELLED' ? "bg-red-50 text-red-600" : 
                             apt.status === 'COMPLETED' ? "bg-slate-50 text-slate-600" : "bg-indigo-50 text-indigo-600"
                          )}>
                            <span className="text-[10px] uppercase">{new Date(apt.date).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                            <span className="text-xl">{new Date(apt.date).getDate()}</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">{apt.type}</h4>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Stethoscope className="w-3.5 h-3.5" />
                                Dr. {apt.doctor_name}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={
                          apt.status === 'SCHEDULED' ? 'success' :
                          apt.status === 'PENDING' ? 'warning' :
                          apt.status === 'COMPLETED' ? 'secondary' : 'error'
                        }>
                          {apt.status === 'SCHEDULED' ? 'Prévu' :
                           apt.status === 'PENDING' ? 'En attente' :
                           apt.status === 'COMPLETED' ? 'Terminé' : 'Annulé'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'vitals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Historique des Constantes</h2>
                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    {[
                      { id: '7d', label: '7j' },
                      { id: '1m', label: '1m' },
                      { id: '3m', label: '3m' },
                      { id: 'all', label: 'Tout' }
                    ].map((range) => (
                      <button
                        key={range.id}
                        onClick={() => setVitalsTimeRange(range.id as any)}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold rounded-md transition-all",
                          vitalsTimeRange === range.id 
                            ? "bg-white text-blue-600 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      icon={Download} 
                      onClick={exportVitalsToCSV}
                      disabled={vitalsHistory.length === 0}
                    >
                      Exporter CSV
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      icon={Activity} 
                      onClick={() => setShowVitalsDialog(true)}
                    >
                      Nouvelle prise
                    </Button>
                  </div>
                </div>
              </div>

              {vitalsHistory.length > 1 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Poids, Tension & Pouls
                      </h3>
                    </div>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                          <Line type="monotone" dataKey="poids" name="Poids (kg)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="tension_sys" name="Systolique" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="tension_dia" name="Diastolique" stroke="#60a5fa" strokeWidth={3} dot={{ r: 4, fill: '#60a5fa', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="pouls" name="Pouls (bpm)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-amber-500" />
                        Température & Saturation
                      </h3>
                    </div>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                          <Line type="monotone" dataKey="temperature" name="Temp. (°C)" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="o2" name="Sat. O2 (%)" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('timestamp')}
                      >
                        <div className="flex items-center gap-1">
                          Date
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('weight')}
                      >
                        <div className="flex items-center gap-1">
                          Poids
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('height')}
                      >
                        <div className="flex items-center gap-1">
                          Taille
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('blood_pressure_sys')}
                      >
                        <div className="flex items-center gap-1">
                          Tension
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('heart_rate')}
                      >
                        <div className="flex items-center gap-1">
                          Pouls
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('temperature')}
                      >
                        <div className="flex items-center gap-1">
                          Temp.
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                      <th 
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 transition-colors"
                        onClick={() => requestVitalsSort('oxygen_saturation')}
                      >
                        <div className="flex items-center gap-1">
                          Sat. O2
                          <ArrowUpDown className="w-3 h-3" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVitalsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500 italic">
                          Aucune constante enregistrée.
                        </td>
                      </tr>
                    ) : (
                      sortedVitalsHistory.map((v) => (
                        <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {new Date(v.timestamp).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{v.weight ? `${v.weight} kg` : '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.height ? `${v.height} cm` : '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            {v.blood_pressure_sys && v.blood_pressure_dia ? `${v.blood_pressure_sys}/${v.blood_pressure_dia}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.heart_rate ? `${v.heart_rate} bpm` : '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.temperature ? `${v.temperature} °C` : '-'}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{v.oxygen_saturation ? `${v.oxygen_saturation} %` : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Antécédents Médicaux Section */}
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <HistoryIcon className="w-5 h-5 text-indigo-500" />
                    Antécédents Médicaux
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    icon={Plus}
                    onClick={() => setShowHistoryDialog(true)}
                  >
                    Ajouter un antécédent
                  </Button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Description</th>
                        <th 
                          className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-1"
                          onClick={() => setHistorySortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        >
                          Date
                          <ArrowUpDown className="w-3 h-3" />
                        </th>
                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Auteur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingHistory ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                          </td>
                        </tr>
                      ) : sortedPatientHistory.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">
                            Aucun antécédent médical enregistré.
                          </td>
                        </tr>
                      ) : (
                        sortedPatientHistory.map((h) => (
                          <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={
                                h.type === 'PATHOLOGY' ? 'error' : 
                                h.type === 'SURGERY' ? 'warning' : 'secondary'
                              }>
                                {h.type === 'PATHOLOGY' ? 'Pathologie' : 
                                 h.type === 'SURGERY' ? 'Chirurgie' : 'Traitement'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-900 font-medium">{h.description}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {new Date(h.date).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500">{h.author_name}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Amelie AI Assistant (4 cols) */}
      <div className={`lg:col-span-4 flex-col h-full overflow-hidden absolute lg:relative inset-0 lg:inset-auto z-20 lg:z-0 bg-white lg:bg-transparent ${isAmelieOpen ? 'flex' : 'hidden lg:flex'}`}>
        <Card className="flex-1 flex flex-col bg-slate-900 text-white border-slate-800 shadow-2xl overflow-hidden rounded-none lg:rounded-3xl">
          <CardHeader className="border-slate-800 bg-slate-950/50 flex flex-row items-center justify-between py-4">
            <CardTitle className="flex items-center gap-2 text-white">
              <Sparkles className="w-5 h-5 text-purple-400" />
              Amelie AI
              <Badge variant="default" className="ml-auto bg-purple-500/20 text-purple-300 border-purple-500/30 text-[10px]">ASSISTANT</Badge>
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setIsAmelieOpen(false)}
            >
              Fermer
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {!aiAnalysis && !isAnalyzing && aiMessages.length === 0 && (
              <div className="text-center py-8 opacity-60">
                <div className="w-12 h-12 rounded-full bg-white/10 mx-auto mb-4 flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-sm">Je suis prête à analyser ce dossier.</p>
                <p className="text-xs mt-2">Sélectionnez une action ou posez-moi une question.</p>
              </div>
            )}

            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-purple-600 text-white rounded-tr-none' 
                    : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                }`}>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            ))}

            {isAnalyzing && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-purple-300 animate-pulse">Amélie réfléchit...</p>
              </div>
            )}

            {aiError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-medium">Erreur d'analyse</p>
                  <p className="text-xs opacity-80 mt-1">{aiError}</p>
                </div>
              </div>
            )}

            {aiAnalysis && (
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2">
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>
                    {aiAnalysis}
                  </ReactMarkdown>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-slate-500 flex justify-between">
                  <span>Analyse ponctuelle</span>
                  <button onClick={() => setAiAnalysis('')} className="hover:text-white underline">Effacer</button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </CardContent>

          <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] h-8"
                onClick={() => runAmelieAnalysis('summary')}
                disabled={isAnalyzing}
              >
                Résumé
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] h-8"
                onClick={() => runAmelieAnalysis('coherence')}
                disabled={isAnalyzing}
              >
                Incohérences
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] h-8"
                onClick={() => runAmelieAnalysis('interactions')}
                disabled={isAnalyzing}
              >
                Interactions
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white text-[10px] h-8"
                onClick={() => runAmelieAnalysis('vitals')}
                disabled={isAnalyzing || vitalsHistory.length === 0}
              >
                Constantes
              </Button>
            </div>

            <form onSubmit={handleSendAiMessage} className="relative">
              <Input 
                placeholder="Posez une question à Amélie..." 
                className="bg-slate-800 border-slate-700 text-white pr-10 h-10 text-xs rounded-xl focus:ring-purple-500"
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                disabled={isAnalyzing}
              />
              <button 
                type="submit"
                disabled={!userPrompt.trim() || isAnalyzing}
                className="absolute right-2 top-2 p-1 text-purple-400 hover:text-purple-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenTool className="w-4 h-4" />
              </button>
            </form>
          </div>
        </Card>
      </div>
    </div>

      {/* Record Detail Dialog */}
      <Dialog open={!!selectedRecord} onClose={() => setSelectedRecord(null)}>
        {selectedRecord && (
          <div>
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant={
                  selectedRecord.type === 'CONSULTATION' ? 'default' :
                  selectedRecord.type === 'PRESCRIPTION' ? 'secondary' :
                  selectedRecord.type === 'APPOINTMENT' ? 'warning' :
                  'outline'
                } className="uppercase tracking-wider">
                  {selectedRecord.type === 'APPOINTMENT' ? 'Rendez-vous' : selectedRecord.type}
                </Badge>
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(selectedRecord.timestamp).toLocaleDateString()}
                  <span className="mx-1">•</span>
                  <Clock className="w-3 h-3" />
                  {new Date(selectedRecord.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {selectedRecord.type === 'APPOINTMENT' && selectedRecord.status && (
                  <Badge variant={
                    selectedRecord.status === 'COMPLETED' ? 'success' :
                    selectedRecord.status === 'CANCELLED' ? 'error' :
                    'default'
                  } className="ml-auto">
                    {selectedRecord.status === 'COMPLETED' ? 'Terminé' :
                     selectedRecord.status === 'CANCELLED' ? 'Annulé' : 'Confirmé'}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900">{selectedRecord.title}</h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                  {selectedRecord.author_name.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <span>Dr. {selectedRecord.author_name}</span>
                <span className="text-slate-400">({selectedRecord.author_specialty})</span>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {selectedRecord.type === 'APPOINTMENT' && (
                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Motif du rendez-vous</p>
                    <p className="text-sm font-semibold text-slate-700">{selectedRecord.type_detail || 'Consultation standard'}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Statut</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {selectedRecord.status === 'COMPLETED' ? 'Terminé' :
                       selectedRecord.status === 'CANCELLED' ? 'Annulé' : 'Programmé'}
                    </p>
                  </div>
                </div>
              )}

              <div className="prose prose-slate max-w-none">
                <h4 className="text-sm font-bold text-slate-900 mb-2">{selectedRecord.type === 'APPOINTMENT' ? 'Notes du rendez-vous' : 'Contenu'}</h4>
                <p className="whitespace-pre-wrap text-slate-700 leading-relaxed">{selectedRecord.content || 'Aucun contenu supplémentaire.'}</p>
              </div>

              {selectedRecord.file_url && (
                <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">Document joint</p>
                      <p className="text-xs text-blue-600">Format PDF ou Image</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={() => window.open(selectedRecord.file_url, '_blank')}
                  >
                    Ouvrir / Télécharger
                  </Button>
                </div>
              )}

              {/* Structured Data Section */}
              {selectedRecord.structured_data && Object.keys(selectedRecord.structured_data).length > 0 && (
                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    Données structurées
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(selectedRecord.structured_data).map(([key, value]) => (
                      <div key={key} className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                        <p className="text-sm font-semibold text-slate-700">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/30 rounded-b-2xl flex justify-between items-center">
              {selectedRecord.signature ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-medium">
                  <Shield className="w-4 h-4" />
                  Signé numériquement : <span className="font-serif italic ml-1">{selectedRecord.signature}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Non signé
                  </div>
                  {user && selectedRecord.author_id === user.id && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs text-blue-600 hover:bg-blue-50 h-7 px-2"
                      onClick={() => {
                        setEditingRecord({ ...selectedRecord });
                        setShowEditRecordDialog(true);
                      }}
                    >
                      Signer maintenant
                    </Button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                {user && selectedRecord.author_id === user.id && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8"
                      onClick={() => {
                        setEditingRecord({ ...selectedRecord });
                        setShowEditRecordDialog(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setRecordToDelete(selectedRecord.id);
                        setShowDeleteConfirm(true);
                      }}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Suppression...' : 'Supprimer'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onClose={() => {
        setShowTransferDialog(false);
        setSelectedPractitioner(null);
        setPractitionerSearch('');
      }}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Transférer le dossier</h2>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Recherchez un confrère pour lui envoyer une demande de transfert du dossier de <strong>{patient.first_name} {patient.last_name}</strong>.
            </p>
            
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Nom, spécialité ou RPPS..." 
                className="pl-9"
                value={practitionerSearch}
                onChange={e => setPractitionerSearch(e.target.value)}
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2">
              {practitioners.length === 0 ? (
                <div className="text-center py-4 text-sm text-slate-400">
                  {practitionerSearch.length > 2 ? 'Aucun praticien trouvé' : 'Commencez à taper pour rechercher...'}
                </div>
              ) : (
                practitioners.map(p => (
                  <div 
                    key={p.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${selectedPractitioner?.id === p.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'}`}
                    onClick={() => setSelectedPractitioner(p)}
                  >
                    <div>
                      <p className="font-medium text-slate-900">{p.full_name}</p>
                      <p className="text-xs text-slate-500">{p.specialty} • RPPS: {p.rpps_number}</p>
                    </div>
                    {selectedPractitioner?.id === p.id && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowTransferDialog(false)}>Annuler</Button>
              <Button 
                onClick={() => setShowTransferConfirmDialog(true)} 
                disabled={!selectedPractitioner}
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Transfer Confirmation Dialog */}
      <ConfirmDialog
        open={showTransferConfirmDialog}
        onClose={() => setShowTransferConfirmDialog(false)}
        onConfirm={handleTransfer}
        title="Confirmer le transfert"
        description={`Êtes-vous sûr de vouloir transférer le dossier de ${patient.first_name} ${patient.last_name} au Dr. ${selectedPractitioner?.full_name} ? Ce praticien aura accès à l'intégralité de l'historique médical.`}
        confirmText="Confirmer le transfert"
        cancelText="Annuler"
        variant="primary"
      />

      {/* Confirmation Dialog for Record Deletion */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setRecordToDelete(null);
        }}
        onConfirm={() => {
          if (recordToDelete) {
            handleDeleteRecord(recordToDelete);
          }
        }}
        title="Supprimer l'enregistrement"
        description="Êtes-vous sûr de vouloir supprimer cet enregistrement médical ? Cette action est irréversible."
        confirmText="Supprimer"
        cancelText="Annuler"
      />

      {/* Vitals Dialog */}
      <Dialog open={showVitalsDialog} onClose={() => setShowVitalsDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Nouvelles Constantes</h2>
          </div>

          <form onSubmit={handleSaveVitals} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Poids (kg)</label>
                <Input 
                  type="number" 
                  step="0.1"
                  placeholder="Ex: 75.5" 
                  value={vitals.weight}
                  onChange={e => setVitals({ ...vitals, weight: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Taille (cm)</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 180" 
                  value={vitals.height}
                  onChange={e => setVitals({ ...vitals, height: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tension Systolique</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 120" 
                  value={vitals.blood_pressure_sys}
                  onChange={e => setVitals({ ...vitals, blood_pressure_sys: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Tension Diastolique</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 80" 
                  value={vitals.blood_pressure_dia}
                  onChange={e => setVitals({ ...vitals, blood_pressure_dia: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Fréquence Cardiaque</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 72" 
                  value={vitals.heart_rate}
                  onChange={e => setVitals({ ...vitals, heart_rate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Température (°C)</label>
                <Input 
                  type="number" 
                  step="0.1"
                  placeholder="Ex: 36.6" 
                  value={vitals.temperature}
                  onChange={e => setVitals({ ...vitals, temperature: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Saturation O2 (%)</label>
                <Input 
                  type="number" 
                  placeholder="Ex: 98" 
                  value={vitals.oxygen_saturation}
                  onChange={e => setVitals({ ...vitals, oxygen_saturation: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" type="button" onClick={() => setShowVitalsDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmittingVitals}>
                {isSubmittingVitals ? 'Enregistrement...' : 'Enregistrer les constantes'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* New Record Dialog */}
      <Dialog open={showNewRecordDialog} onClose={() => setShowNewRecordDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {newRecord.type === 'PRESCRIPTION' ? 'Nouvelle Ordonnance' : 'Nouveau Compte-rendu'}
            </h2>
          </div>

          <form onSubmit={handleCreateRecord} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Titre du document</label>
              <Input 
                required
                placeholder="Ex: Consultation de suivi, Ordonnance antibiotiques..." 
                value={newRecord.title}
                onChange={e => setNewRecord({ ...newRecord, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Contenu</label>
              <textarea 
                required
                className="w-full min-h-[150px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                placeholder="Saisissez le contenu médical ici..."
                value={newRecord.content}
                onChange={e => setNewRecord({ ...newRecord, content: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Document joint (Optionnel)</label>
              <div 
                className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
                onClick={() => document.getElementById('record-file-upload')?.click()}
              >
                <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  {recordFile ? recordFile.name : 'Cliquez pour ajouter un PDF ou une image'}
                </p>
                <input 
                  id="record-file-upload"
                  type="file" 
                  className="hidden" 
                  accept="image/*,application/pdf"
                  onChange={e => setRecordFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-blue-600" />
                  Signature électronique
                </label>
                {user && (
                  <button 
                    type="button"
                    onClick={() => setNewRecord({ ...newRecord, signature: `Dr. ${user.name}` })}
                    className="text-[10px] text-blue-600 hover:underline font-bold uppercase tracking-tight"
                  >
                    Signer avec mon nom
                  </button>
                )}
              </div>
              <div className="relative">
                <Input 
                  placeholder="Tapez votre nom pour signer..." 
                  className="pl-9 font-serif italic text-slate-800 bg-white border-blue-200 focus:ring-blue-500"
                  value={newRecord.signature}
                  onChange={e => setNewRecord({ ...newRecord, signature: e.target.value })}
                />
                <div className="absolute left-3 top-2.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div className="absolute right-3 top-2.5">
                  <Badge variant="success" className="text-[9px] bg-emerald-500 text-white border-none px-1.5 h-4">SÉCURISÉ</Badge>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">En signant ce document, vous engagez votre responsabilité professionnelle sur l'exactitude des informations saisies.</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" type="button" onClick={() => setShowNewRecordDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                {isSubmitting ? 'Enregistrement...' : 'Enregistrer et Signer'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={showEditRecordDialog} onClose={() => setShowEditRecordDialog(false)}>
        {editingRecord && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Modifier le document</h2>
            </div>

            <form onSubmit={handleUpdateRecord} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Titre du document</label>
                <Input 
                  required
                  placeholder="Ex: Consultation de suivi..." 
                  value={editingRecord.title}
                  onChange={e => setEditingRecord({ ...editingRecord, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Contenu</label>
                <textarea 
                  required
                  className="w-full min-h-[150px] p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  placeholder="Saisissez le contenu médical ici..."
                  value={editingRecord.content}
                  onChange={e => setEditingRecord({ ...editingRecord, content: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Document joint (Optionnel)</label>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:border-blue-400 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('edit-file-upload')?.click()}
                >
                  <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">
                    {recordFile ? recordFile.name : (editingRecord.file_url ? 'Document déjà présent (cliquez pour remplacer)' : 'Cliquez pour ajouter un PDF ou une image')}
                  </p>
                  <input 
                    id="edit-file-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*,application/pdf"
                    onChange={e => setRecordFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

            <div className="space-y-4">
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <PenTool className="w-4 h-4 text-blue-600" />
                    Signature électronique
                  </label>
                  {user && (
                    <button 
                      type="button"
                      onClick={() => setEditingRecord({ ...editingRecord, signature: `Dr. ${user.name}` })}
                      className="text-[10px] text-blue-600 hover:underline font-bold uppercase tracking-tight"
                    >
                      Signer avec mon nom
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input 
                    placeholder="Tapez votre nom pour signer..." 
                    className="pl-9 font-serif italic text-slate-800 bg-white border-blue-200 focus:ring-blue-500"
                    value={editingRecord.signature || ''}
                    onChange={e => setEditingRecord({ ...editingRecord, signature: e.target.value })}
                  />
                  <div className="absolute left-3 top-2.5">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="absolute right-3 top-2.5">
                    <Badge variant="success" className="text-[9px] bg-emerald-500 text-white border-none px-1.5 h-4">SÉCURISÉ</Badge>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">En signant ce document, vous engagez votre responsabilité professionnelle sur l'exactitude des informations saisies.</p>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" type="button" onClick={() => setShowEditRecordDialog(false)}>Annuler</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                  {isSubmitting ? 'Mise à jour...' : 'Enregistrer et Signer'}
                </Button>
              </div>
            </div>
            </form>
          </div>
        )}
      </Dialog>
      {/* Mobile Amelie Toggle */}
      <button 
        onClick={() => setIsAmelieOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center z-30 hover:scale-110 transition-transform"
      >
        <Sparkles className="w-6 h-6 text-purple-400" />
      </button>

      {/* Medication Dialog */}
      <Dialog open={showMedicationDialog} onClose={() => setShowMedicationDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">
              {editingMedication ? 'Modifier la prescription' : 'Prescrire un médicament'}
            </h2>
          </div>

          <form onSubmit={handleSaveMedication} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nom du médicament *</label>
              <Input 
                placeholder="Ex: Amoxicilline" 
                value={medicationForm.drug_name}
                onChange={e => setMedicationForm({ ...medicationForm, drug_name: e.target.value })}
                required
              />
            </div>
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center gap-2 text-blue-700">
                <AlertCircle className="w-4 h-4" />
                <p className="text-[10px] font-bold uppercase tracking-wider">Rappels & Notifications</p>
              </div>
              <p className="text-xs text-slate-600">
                Configurez les rappels pour que le patient reçoive des notifications push sur son application mobile <strong>Docta Patient</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Heure de rappel</label>
                  <Input 
                    type="time"
                    value={medicationForm.reminder_time}
                    onChange={e => setMedicationForm({ ...medicationForm, reminder_time: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Posologie</label>
                  <Input 
                    placeholder="Ex: 1 comprimé" 
                    value={medicationForm.dosage}
                    onChange={e => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Jours de prise</label>
                <div className="flex flex-wrap gap-2">
                  {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setMedicationForm(prev => ({
                          ...prev,
                          reminder_days: prev.reminder_days.includes(day)
                            ? prev.reminder_days.filter(d => d !== day)
                            : [...prev.reminder_days, day]
                        }));
                      }}
                      className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-medium transition-all border",
                        medicationForm.reminder_days.includes(day)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                      )}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Fréquence / Instructions additionnelles *</label>
              <Input 
                placeholder="Ex: Après le repas" 
                value={medicationForm.frequency}
                onChange={e => setMedicationForm({ ...medicationForm, frequency: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Date de début *</label>
                <Input 
                  type="date" 
                  value={medicationForm.start_date}
                  onChange={e => setMedicationForm({ ...medicationForm, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Date de fin (optionnel)</label>
                <Input 
                  type="date" 
                  value={medicationForm.end_date}
                  onChange={e => setMedicationForm({ ...medicationForm, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" type="button" onClick={() => setShowMedicationDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : (editingMedication ? 'Mettre à jour' : 'Prescrire')}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onClose={() => setShowHistoryDialog(false)}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Ajouter un antécédent médical</h2>
          </div>

          <form onSubmit={handleSaveHistory} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Type d'antécédent</label>
              <div className="flex gap-2">
                {[
                  { id: 'PATHOLOGY', label: 'Pathologie' },
                  { id: 'SURGERY', label: 'Chirurgie' },
                  { id: 'TREATMENT', label: 'Traitement passé' }
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setHistoryForm({ ...historyForm, type: type.id as any })}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all",
                      historyForm.type === type.id 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md" 
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Description / Diagnostic *</label>
              <Input 
                placeholder="Ex: Appendicectomie, Diabète Type 2..." 
                value={historyForm.description}
                onChange={e => setHistoryForm({ ...historyForm, description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Date de l'événement *</label>
              <Input 
                type="date" 
                value={historyForm.date}
                onChange={e => setHistoryForm({ ...historyForm, date: e.target.value })}
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" type="button" onClick={() => setShowHistoryDialog(false)}>Annuler</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enregistrement...' : 'Ajouter au dossier'}
              </Button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Medication Delete Confirmation */}
      <ConfirmDialog
        open={showMedicationDeleteConfirm}
        onClose={() => {
          setShowMedicationDeleteConfirm(false);
          setMedicationToDelete(null);
        }}
        onConfirm={handleDeleteMedication}
        title="Supprimer la prescription"
        description="Êtes-vous sûr de vouloir supprimer ce médicament ? Le patient ne recevra plus de rappels pour celui-ci."
        confirmText="Supprimer"
        cancelText="Annuler"
      />
    </div>
  );
}
