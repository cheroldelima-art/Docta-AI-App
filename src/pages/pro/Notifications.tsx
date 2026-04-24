import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { Bell, Check, Clock, Trash2, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function ProNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = () => {
    setLoading(true);
    fetch('/api/notifications')
      .then(res => res.json())
      .then(data => {
        setNotifications(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  const markAsRead = (id: number) => {
    fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
      .then(() => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
        toast.success('Notification marquée comme lue');
      })
      .catch(console.error);
  };

  const filteredNotifications = notifications.filter(notif => {
    if (filter === 'unread') return !notif.is_read;
    if (filter === 'read') return notif.is_read;
    return true;
  });

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Bell className="w-6 h-6 text-blue-600" />
          Centre de Notifications
        </h1>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Toutes
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'unread' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Non lues
          </button>
          <button
            onClick={() => setFilter('read')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${filter === 'read' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Lues
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>
                {filter === 'unread' 
                  ? "Vous n'avez aucune notification non lue." 
                  : filter === 'read'
                  ? "Vous n'avez aucune notification lue."
                  : "Vous n'avez aucune notification pour le moment."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notif) => (
            <Card key={notif.id} className={`transition-all ${!notif.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/10' : 'opacity-75'}`}>
              <CardContent className="p-4 flex gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-semibold ${!notif.is_read ? 'text-slate-900' : 'text-slate-700'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 mt-1 text-sm">{notif.message}</p>
                  
                  {!notif.is_read && (
                    <div className="mt-3 flex justify-end">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8"
                        onClick={() => markAsRead(notif.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Marquer comme lu
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
