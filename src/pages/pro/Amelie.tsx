import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, Button, Input, Badge } from '@/components/ui';
import { Sparkles, Search, History, Trash2, Send, Bot, User, Loader2, Globe, AlertCircle, Activity, ChevronDown } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SearchHistory {
  id: string;
  query: string;
  timestamp: number;
}

export default function AmeliePage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(searchParams.get('patientId') || '');
  const [patientContext, setPatientContext] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientContext(selectedPatientId);
    } else {
      setPatientContext(null);
    }
  }, [selectedPatientId]);

  const fetchPatients = async () => {
    try {
      const res = await fetch('/api/patients');
      const data = await res.json();
      setPatients(data);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const fetchPatientContext = async (id: string) => {
    setIsLoadingContext(true);
    try {
      const res = await fetch(`/api/amelie/patient-context/${id}`);
      const data = await res.json();
      setPatientContext(data);
    } catch (error) {
      console.error('Error fetching patient context:', error);
    } finally {
      setIsLoadingContext(false);
    }
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem('amelie_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveToHistory = (q: string) => {
    const newEntry = {
      id: Date.now().toString(),
      query: q,
      timestamp: Date.now()
    };
    const updatedHistory = [newEntry, ...history.slice(0, 19)];
    setHistory(updatedHistory);
    localStorage.setItem('amelie_history', JSON.stringify(updatedHistory));
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = customQuery || query;
    if (!searchQuery.trim() || isSearching) return;

    const userMessage = { role: 'user', content: searchQuery };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsSearching(true);
    saveToHistory(searchQuery);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let systemInstruction = "Tu es Amelie AI, une assistante de recherche médicale avancée pour les praticiens au Gabon. Ton rôle est d'aider les médecins à trouver des informations scientifiques, des protocoles, des données épidémiologiques ou des informations générales sur la santé. Tu dois toujours citer tes sources si possible et rester prudente dans tes affirmations. Tu ne poses pas de diagnostic et ne remplaces pas le jugement clinique du médecin. Réponds de manière structurée et professionnelle.";
      
      if (patientContext) {
        const { patient, vitals, practitioner } = patientContext;
        const age = new Date().getFullYear() - new Date(patient.dob).getFullYear();
        
        systemInstruction += `\n\nCONTEXTE PATIENT ACTUEL :
        - Patient : ${patient.first_name} ${patient.last_name}
        - Âge : ${age} ans
        - Genre : ${patient.gender === 'M' ? 'Masculin' : 'Féminin'}
        - Spécialité du praticien : ${practitioner.specialty}
        
        DERNIÈRES CONSTANTES VITALES :
        ${vitals.map((v: any) => `- ${new Date(v.timestamp).toLocaleDateString()} : Poids ${v.weight}kg, TA ${v.blood_pressure_sys}/${v.blood_pressure_dia}, Pouls ${v.heart_rate}, Temp ${v.temperature}°C, SatO2 ${v.oxygen_saturation}%`).join('\n')}
        
        INSTRUCTIONS D'ANALYSE :
        Lorsqu'une question porte sur ce patient, analyse les tendances des constantes vitales. Identifie les anomalies ou les évolutions préoccupantes en fonction de l'âge du patient et de ta spécialité (${practitioner.specialty}). Propose des alertes si nécessaire, mais rappelle toujours que ton analyse est une assistance et non un diagnostic final.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: searchQuery,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }]
        }
      });

      const aiMessage = { 
        role: 'amelie', 
        content: response.text || "Désolée, je n'ai pas pu générer de réponse.",
        grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks
      };
      setMessages(prev => [...prev, aiMessage]);
      
      // Log interaction
      fetch('/api/amelie/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: searchQuery, 
          type: 'general_search',
          responseText: response.text || ''
        })
      }).catch(console.error);

    } catch (error: any) {
      toast.error("Erreur lors de la recherche", { description: error.message });
      setMessages(prev => [...prev, { role: 'amelie', content: "Une erreur est survenue lors de la recherche. Veuillez réessayer." }]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('amelie_history');
    toast.success("Historique effacé");
  };

  const handleAnalyzeVitals = () => {
    if (!patientContext) return;
    const prompt = `Analyse les constantes vitales de ce patient (${patientContext.patient.first_name} ${patientContext.patient.last_name}) et identifie les tendances ou alertes pertinentes compte tenu de son âge (${new Date().getFullYear() - new Date(patientContext.patient.dob).getFullYear()} ans) et de ma spécialité (${patientContext.practitioner.specialty}).`;
    handleSearch(undefined, prompt);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Sparkles className="w-6 h-6 text-purple-400" />
            </div>
            Espace Amelie AI
          </h1>
          <p className="text-slate-500 mt-1">Recherche médicale avancée et assistance scientifique</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Patient Selector */}
          <div className="relative group">
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all cursor-pointer shadow-sm"
            >
              <option value="">Sélectionner un patient...</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 h-9 px-3">
            <Globe className="w-3 h-3 mr-1" />
            Connecté au Web
          </Badge>
        </div>
      </div>

      {patientContext && (
        <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Analyse de dossier : {patientContext.patient.first_name} {patientContext.patient.last_name}</h3>
                <p className="text-xs text-slate-500">
                  {new Date().getFullYear() - new Date(patientContext.patient.dob).getFullYear()} ans • {patientContext.vitals.length} mesures enregistrées
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleAnalyzeVitals}
                disabled={isSearching || patientContext.vitals.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-lg shadow-purple-200"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analyser les constantes
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setSelectedPatientId('')}
                className="text-slate-400 hover:text-slate-600 rounded-xl"
              >
                Effacer le contexte
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: History */}
        <Card className="lg:col-span-1 p-4 flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Historique
            </h2>
            {history.length > 0 && (
              <button onClick={clearHistory} className="text-slate-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-400 italic">Aucun historique récent</p>
              </div>
            ) : (
              history.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSearch(undefined, item.query)}
                  className="w-full text-left p-3 rounded-xl border border-slate-100 hover:bg-slate-50 hover:border-blue-200 transition-all group"
                >
                  <p className="text-sm text-slate-700 line-clamp-2 group-hover:text-blue-700">{item.query}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link 
              to="/pro/amelie/history" 
              className="flex items-center justify-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
            >
              <History className="w-3 h-3" />
              Voir l'historique complet
            </Link>
          </div>
        </Card>

        {/* Main: Chat Area */}
        <Card className="lg:col-span-3 flex flex-col h-[600px] overflow-hidden border-slate-200 shadow-sm">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce">
                  <Bot className="w-10 h-10 text-slate-900" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Comment puis-je vous aider ?</h3>
                  <p className="text-slate-500 mt-2">
                    Posez-moi des questions sur des pathologies, des médicaments, des protocoles ou des recherches médicales mondiales.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 w-full">
                  {[
                    "Derniers protocoles pour le paludisme au Gabon",
                    "Interactions entre l'artémisine et les antirétroviraux",
                    "Prévalence du diabète de type 2 en Afrique Centrale",
                    "Nouveautés sur le traitement de la drépanocytose"
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleSearch(undefined, suggestion)}
                      className="text-sm p-3 rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-600 transition-all text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                    msg.role === 'user' ? "bg-blue-600 text-white" : "bg-slate-900 text-white"
                  )}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={cn(
                    "max-w-[85%] p-4 rounded-2xl shadow-sm",
                    msg.role === 'user' ? "bg-blue-600 text-white" : "bg-white border border-slate-100 text-slate-700"
                  )}>
                    <div className="prose prose-sm max-w-none prose-slate">
                      <div className={msg.role === 'user' ? 'text-white' : 'text-slate-700'}>
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    {msg.grounding && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sources & Références</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.grounding.map((chunk: any, cIdx: number) => (
                            chunk.web && (
                              <a 
                                key={cIdx} 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200 hover:bg-blue-50 hover:text-blue-600 transition-colors truncate max-w-[200px]"
                              >
                                {chunk.web.title || chunk.web.uri}
                              </a>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isSearching && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                  <span className="text-sm text-slate-500 italic">Amelie recherche et analyse...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-100">
            <form onSubmit={handleSearch} className="relative">
              <Input
                placeholder="Posez votre question à Amelie AI..."
                className="pr-12 py-6 rounded-2xl border-slate-200 focus:ring-purple-500 bg-slate-50/50"
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={isSearching}
              />
              <button
                type="submit"
                disabled={!query.trim() || isSearching}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <AlertCircle className="w-3 h-3" />
              <span>Amelie AI peut faire des erreurs. Vérifiez toujours les informations critiques.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
