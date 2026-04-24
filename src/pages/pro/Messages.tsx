import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '@/components/ui';
import { Search, Send, User, MoreVertical, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/context/SocketContext';

interface Conversation {
  id: number;
  full_name: string;
  role: string;
  specialty?: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  is_read: number;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [myId, setMyId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { lastMessage } = useSocket();

  useEffect(() => {
    fetchMyId();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (lastMessage && lastMessage.type === 'NEW_MESSAGE') {
      const newMessage = lastMessage.message;
      
      // If message is for/from selected conversation, add to messages
      if (selectedConversation && (newMessage.sender_id === selectedConversation.id || newMessage.receiver_id === selectedConversation.id)) {
        setMessages(prev => {
          // Avoid duplicates if we just sent the message
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        
        // If we are the receiver, mark as read on server
        if (newMessage.receiver_id === myId) {
          fetch(`/api/messages/${newMessage.sender_id}`); // This marks as read
        }
      }

      // Update conversations list
      fetchConversations();
    }
  }, [lastMessage, selectedConversation, myId]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMyId = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.user) setMyId(data.user.id);
    } catch (error) {
      console.error('Error fetching my ID:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages/conversations');
      const data = await res.json();
      setConversations(data);
      setIsLoading(false);
    } catch (error) {
      toast.error('Erreur lors du chargement des conversations');
      setIsLoading(false);
    }
  };

  const fetchMessages = async (otherUserId: number) => {
    try {
      const res = await fetch(`/api/messages/${otherUserId}`);
      const data = await res.json();
      setMessages(data);
      
      // Update unread count locally
      setConversations(prev => prev.map(c => 
        c.id === otherUserId ? { ...c, unread_count: 0 } : c
      ));
    } catch (error) {
      toast.error('Erreur lors du chargement des messages');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedConversation) return;

    const content = messageInput;
    setMessageInput('');

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: selectedConversation.id,
          content
        })
      });

      if (!res.ok) throw new Error('Failed to send');
      
      const newMessage = await res.json();
      setMessages(prev => [...prev, newMessage]);
      fetchConversations();
    } catch (error) {
      toast.error('Erreur lors de l\'envoi du message');
      setMessageInput(content); // Restore input on error
    }
  };

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const filteredAndSortedConversations = useMemo(() => {
    return conversations
      .filter(conv => conv.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'date') {
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        } else {
          return a.full_name.localeCompare(b.full_name);
        }
      });
  }, [conversations, searchQuery, sortBy]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col md:flex-row gap-6">
      {/* Conversations List */}
      <Card className={`w-full md:w-1/3 flex flex-col h-full ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
        <CardHeader className="border-b border-slate-100 p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Rechercher..." 
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Trier par :</span>
            <div className="flex gap-2">
              <button 
                onClick={() => setSortBy('date')}
                className={`px-2 py-1 rounded-md transition-colors ${sortBy === 'date' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Date
              </button>
              <button 
                onClick={() => setSortBy('name')}
                className={`px-2 py-1 rounded-md transition-colors ${sortBy === 'name' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                Nom
              </button>
            </div>
          </div>
        </CardHeader>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Chargement...</div>
          ) : filteredAndSortedConversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Aucune conversation</div>
          ) : (
            filteredAndSortedConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className={`font-medium ${selectedConversation?.id === conv.id ? 'text-blue-700' : 'text-slate-900'}`}>
                    {conv.full_name}
                  </h3>
                  <span className="text-xs text-slate-400">{formatTime(conv.last_message_at)}</span>
                </div>
                <p className="text-sm text-slate-500 truncate">{conv.last_message}</p>
                {conv.unread_count > 0 && (
                  <div className="mt-2 flex justify-end">
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {conv.unread_count}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Chat Area */}
      <Card className={`flex-1 flex flex-col h-full ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="md:hidden mr-1" 
                  icon={ArrowLeft} 
                  onClick={() => setShowMobileChat(false)}
                />
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {selectedConversation.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{selectedConversation.full_name}</h3>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span> En ligne
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" icon={MoreVertical} />
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${
                    msg.sender_id === myId 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 text-right ${msg.sender_id === myId ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <form 
                className="flex gap-2"
                onSubmit={handleSendMessage}
              >
                <Input 
                  placeholder="Écrivez votre message..." 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" icon={Send}>Envoyer</Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-slate-300" />
            </div>
            <p>Sélectionnez une conversation pour commencer</p>
          </div>
        )}
      </Card>
    </div>
  );
}
