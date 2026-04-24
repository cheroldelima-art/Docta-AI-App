import * as React from 'react';
import { useState, useEffect } from 'react';
import { Card, Button, Badge, Input } from '@/components/ui';
import { Sparkles, History as HistoryIcon, Search, Calendar, User, ArrowUpDown, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AiLog {
  id: number;
  user_id: number;
  patient_id: number | null;
  patient_name: string | null;
  request_type: string;
  query: string;
  response_summary: string;
  full_response: string;
  timestamp: string;
}

export default function AmelieHistoryPage() {
  const [logs, setLogs] = useState<AiLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/amelie/history');
      const data = await res.json();
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        setLogs([]);
      }
    } catch (error) {
      toast.error("Erreur lors de la récupération de l'historique");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs
    .filter(log => 
      (log.query || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.request_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
              <HistoryIcon className="w-6 h-6 text-purple-400" />
            </div>
            Historique Amelie AI
          </h1>
          <p className="text-slate-500 mt-1">Consultez vos interactions passées avec l'assistante</p>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Rechercher dans l'historique..." 
              className="pl-10"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortOrder === 'desc' ? 'Plus récent' : 'Plus ancien'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-50 rounded w-1/2" />
              </Card>
            ))
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
              <HistoryIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500">Aucune interaction trouvée</p>
            </div>
          ) : (
            filteredLogs.map(log => (
              <Card 
                key={log.id} 
                className={cn(
                  "p-4 cursor-pointer transition-all hover:shadow-md border-l-4",
                  selectedLog?.id === log.id ? "border-l-purple-600 bg-purple-50/30" : "border-l-transparent hover:border-l-slate-300"
                )}
                onClick={() => setSelectedLog(log)}
              >
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {log.request_type.replace('patient_analysis_', '').replace('_', ' ')}
                  </Badge>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900 line-clamp-2 mb-1">{log.query}</p>
                {log.patient_name && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Patient: {log.patient_name}
                  </p>
                )}
              </Card>
            ))
          )}
        </div>

        <div className="lg:col-span-7">
          {selectedLog ? (
            <Card className="h-full flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">Détails de l'interaction</h3>
                    <p className="text-xs text-slate-500">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                  </div>
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">Amelie AI</Badge>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Question / Requête</p>
                  <p className="text-sm text-slate-700">{selectedLog.query}</p>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-white custom-scrollbar">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Réponse d'Amelie</p>
                <div className="prose prose-slate prose-sm max-w-none">
                  <ReactMarkdown>
                    {selectedLog.full_response || selectedLog.response_summary}
                  </ReactMarkdown>
                </div>
              </div>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <Sparkles className="w-12 h-12 text-slate-200 mb-4" />
              <h3 className="text-lg font-medium text-slate-400">Sélectionnez une interaction pour voir les détails</h3>
              <p className="text-sm text-slate-400 mt-2">L'historique complet de vos recherches et analyses est conservé ici.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
