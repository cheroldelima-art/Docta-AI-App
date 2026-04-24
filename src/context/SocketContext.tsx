import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';

interface SocketContextType {
  socket: WebSocket | null;
  lastMessage: any | null;
  totalUnreadCount: number;
  refreshUnreadCount: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any | null>(null);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/messages/unread-count');
      const data = await res.json();
      setTotalUnreadCount(data.count || 0);
    } catch (e) {
      console.error('Error fetching unread count:', e);
    }
  };

  const connect = () => {
    if (!user) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket Connected');
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'NEW_MESSAGE') {
          const msg = data.message;
          setLastMessage(data); // Store the whole event object for consistency

          // Update unread count if we are the receiver
          if (msg.receiver_id === user.id) {
            fetchUnreadCount();
          }

          // Show toast if not on messages page and we are the receiver
          if (msg.receiver_id === user.id && !location.pathname.includes('/messages')) {
            toast.info(`Nouveau message de ${msg.sender_name || 'un utilisateur'}`, {
              description: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
              action: {
                label: 'Voir',
                onClick: () => navigate(user.role === 'PROFESSIONAL' ? '/pro/messages' : '/patient/messages')
              }
            });
          }
        } else if (data.type === 'NEW_NOTIFICATION') {
          setLastMessage(data);
          // We can't easily refresh notifications from here without lifting state or using a custom event
          // But we can trigger a global window event that layouts listen to
          window.dispatchEvent(new CustomEvent('newNotification', { detail: data.notification }));
          
          toast.info(data.notification.title, {
            description: data.notification.message,
            duration: 5000,
          });
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket Disconnected. Retrying in 3s...');
      setSocket(null);
      if (user) {
        reconnectTimeout.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      ws.close();
    };

    setSocket(ws);
  };

  useEffect(() => {
    if (user) {
      connect();
      fetchUnreadCount();
    } else {
      if (socket) {
        socket.close();
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      setTotalUnreadCount(0);
    }

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    };
  }, [user]);

  // Refresh count when location changes (user might have read messages)
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [location.pathname]);

  return (
    <SocketContext.Provider value={{ socket, lastMessage, totalUnreadCount, refreshUnreadCount: fetchUnreadCount }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
