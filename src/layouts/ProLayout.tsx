import { Outlet, Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Activity, Users, MessageSquare, Settings, LogOut, LayoutDashboard, User, Bell, X, Menu, Calendar, Sparkles, Clock, History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';

import { useSocket } from '@/context/SocketContext';

export default function ProLayout() {
  const { user, logout, isLoading } = useAuth();
  const { totalUnreadCount } = useSocket();
  const location = useLocation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // Remove polling, replace with event listener from Socket
      const handleNewNotification = () => fetchNotifications();
      window.addEventListener('newNotification', handleNewNotification);

      return () => {
        window.removeEventListener('newNotification', handleNewNotification);
      };
    }
  }, [user]);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (mobileMenuOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const fetchNotifications = () => {
    fetch('/api/notifications')
      .then(res => res.json())
      .then(setNotifications)
      .catch(console.error);
  };

  const markAsRead = (id: number) => {
    fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
      .then(() => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      })
      .catch(console.error);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const isProfileComplete = user?.rpps_number && user?.specialty && user?.phone && user?.address;

  if (isLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 space-y-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 font-medium animate-pulse">Chargement de Docta AI...</p>
    </div>
  );
  if (!user || user.role !== 'PROFESSIONAL') return <Navigate to="/login" />;

  const navItems = [
    { icon: LayoutDashboard, label: 'Tableau de bord', path: '/pro/dashboard', roles: ['DOCTOR', 'NURSE', 'SECRETARY'] },
    { icon: Users, label: 'Mes Patients', path: '/pro/patients', roles: ['DOCTOR', 'NURSE'] },
    { icon: MessageSquare, label: 'Messagerie', path: '/pro/messages', roles: ['DOCTOR', 'NURSE', 'SECRETARY'] },
    { icon: Calendar, label: 'Agenda', path: '/pro/agenda', roles: ['DOCTOR', 'NURSE', 'SECRETARY'] },
    { icon: Settings, label: 'Paramètres', path: '/pro/settings', roles: ['DOCTOR', 'NURSE', 'SECRETARY'] },
  ].filter(item => !user.pro_role || item.roles.includes(user.pro_role));

  const SidebarContent = () => {
    return (
      <>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-lg tracking-tight">Docta AI</h1>
              <p className="text-xs text-slate-500 font-medium">PRO INTERFACE</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                location.pathname.startsWith(item.path)
                  ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname.startsWith(item.path) ? "text-blue-600" : "text-slate-400")} />
              <span>{item.label}</span>
              {item.path === '/pro/messages' && totalUnreadCount > 0 && (
                <span className="ml-auto bg-blue-600 text-white text-[10px] font-bold min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 rounded-full">
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </span>
              )}
            </Link>
          ))}
          
          {/* Notification Item */}
          <div className="relative mt-6" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              showNotifications && "bg-slate-50 text-slate-900"
            )}
          >
            <div className="relative">
              <Bell className="w-5 h-5 text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              )}
            </div>
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="ml-auto bg-red-100 text-red-600 text-[10px] font-bold min-w-[1.25rem] h-5 flex items-center justify-center px-1.5 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute left-0 top-full mt-2 w-full md:left-full md:top-0 md:ml-2 md:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 md:slide-in-from-left-2">
              <div className="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    Aucune notification
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id} 
                      className={cn(
                        "p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer",
                        !notif.is_read && "bg-blue-50/30"
                      )}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className={cn("text-sm font-medium", !notif.is_read ? "text-blue-700" : "text-slate-900")}>
                          {notif.title}
                        </p>
                        {!notif.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />}
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-slate-400 mt-2">
                        {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                <Link 
                  to="/pro/notifications" 
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  onClick={() => setShowNotifications(false)}
                >
                  Voir toutes les notifications
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-100 space-y-3">
        <Link to="/patient/dashboard">
          <Button variant="outline" className="w-full justify-start border-emerald-200 text-emerald-700 hover:bg-emerald-50 mb-2">
            <User className="w-4 h-4 mr-2" />
            Mon Espace Patient
          </Button>
        </Link>

        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          {user.photo_url ? (
            <img 
              src={user.photo_url} 
              alt={user.name} 
              className="w-8 h-8 rounded-full object-cover border border-slate-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
              {user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
            <p className="text-xs text-slate-500 truncate">{user.specialty}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Activity className="w-5 h-5" />
          </div>
          <span className="font-bold text-slate-900">Docta AI</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm">
          <div 
            ref={sidebarRef}
            className="bg-white h-full w-72 shadow-2xl flex flex-col animate-in slide-in-from-left duration-300"
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10 hidden md:flex flex-col">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-x-hidden">
        {!isProfileComplete && location.pathname !== '/pro/settings' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
              <Settings className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-900">Profil incomplet</h3>
              <p className="text-sm text-amber-700 mt-1">
                Pour accéder à toutes les fonctionnalités et permettre aux patients de vous trouver, veuillez compléter votre profil professionnel (RPPS, téléphone, adresse).
              </p>
            </div>
            <Link to="/pro/settings">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-transparent">
                Compléter
              </Button>
            </Link>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
