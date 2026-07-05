import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Send, ArrowLeft, User as UserIcon, MessageSquare } from 'lucide-react';
import { MessagesApi } from '../api/messages.api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

export const MessagesPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const currentUserId = user?.id;

  const queryUserId = searchParams.get('userId');
  const queryUserName = searchParams.get('userName');
  const queryUserRole = searchParams.get('userRole');

  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [inputContent, setInputContent] = React.useState('');
  
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Sync selected user with query param
  React.useEffect(() => {
    if (queryUserId) {
      setSelectedUserId(queryUserId);
    }
  }, [queryUserId]);

  // Fetch active conversations list
  const { data: conversations = [], refetch: refetchConversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: MessagesApi.getConversationsList,
    refetchInterval: 6000, // Auto-refresh list every 6 seconds
  });

  // Fetch conversation messages thread
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['conversation', selectedUserId],
    queryFn: () => MessagesApi.getConversation(selectedUserId || ''),
    enabled: !!selectedUserId,
    refetchInterval: 3000, // Poll active chat thread messages every 3 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { toUserId: string; content: string }) =>
      MessagesApi.sendMessage(data.toUserId, data.content),
    onSuccess: () => {
      refetchMessages();
      refetchConversations();
    },
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Scroll to latest message anchor
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUserId]);

  // Derived list including deep-linked user if not already in history
  const filteredConversations = React.useMemo(() => {
    let list = [...conversations];

    if (queryUserId && !list.some((c) => c.userId === queryUserId)) {
      list.unshift({
        userId: queryUserId,
        name: queryUserName || 'New User',
        role: queryUserRole || 'USER',
        lastMessage: null,
        unreadCount: 0,
      });
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.role.toLowerCase().includes(query) ||
          (c.lastMessage?.content || '').toLowerCase().includes(query)
      );
    }

    return list;
  }, [conversations, queryUserId, queryUserName, queryUserRole, searchQuery]);

  // Find currently active conversation details
  const activeConversation = React.useMemo(() => {
    return filteredConversations.find((c) => c.userId === selectedUserId);
  }, [filteredConversations, selectedUserId]);

  const handleConversationSelect = (userId: string) => {
    setSelectedUserId(userId);
    // Sync to URL search query
    const target = conversations.find((c) => c.userId === userId);
    if (target) {
      setSearchParams({
        userId: target.userId,
        userName: target.name,
        userRole: target.role,
      });
    } else {
      setSearchParams({ userId });
    }
  };

  const handleBackToList = () => {
    setSelectedUserId(null);
    setSearchParams({});
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputContent.trim() || !selectedUserId) return;

    sendMessageMutation.mutate({
      toUserId: selectedUserId,
      content: inputContent.trim(),
    });
    setInputContent('');
  };

  // Avatar initials utility helper
  const getInitials = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Formats last message preview time
  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Formats system timeline markers
  const formatMessageDateGroup = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role.toUpperCase()) {
      case 'FARMER':
        return <Badge variant="success" label="Farmer" className="bg-[#EAF4EE] text-[#2D6A4F] font-bold text-[10px] scale-95 origin-left" />;
      case 'BUYER':
        return <Badge variant="primary" label="Buyer" className="bg-[#EFF6FF] text-[#1D4ED8] font-bold text-[10px] scale-95 origin-left" />;
      case 'TRANSPORT':
      case 'TRANSPORTER':
      case 'TRANSPORT_PROVIDER':
        return <Badge variant="warning" label="Carrier" className="bg-[#FEF9EC] text-[#C8960C] font-bold text-[10px] scale-95 origin-left" />;
      default:
        return <Badge variant="neutral" label="User" className="text-[10px] scale-95 origin-left" />;
    }
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden flex h-[calc(100vh-140px)] min-h-[480px] shadow-sm">
      
      {/* LEFT PANEL - Conversations List */}
      <div className={`w-full md:w-[320px] shrink-0 border-r border-[#E5E7EB] flex flex-col bg-white ${
        selectedUserId ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7EB] space-y-3.5 bg-white shrink-0">
          <h1 className="text-xl font-bold text-[#111827] tracking-tight font-display">
            Messages
          </h1>
          {/* Search bar */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E5E7EB] focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F] rounded-lg pl-9 pr-4 py-2 text-xs text-text-primary outline-none transition-all placeholder-[#9CA3AF] font-medium"
            />
          </div>
        </div>

        {/* Conversations scroll area */}
        <div className="flex-grow overflow-y-auto divide-y divide-[#F3F4F6] bg-white">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs font-semibold text-[#9CA3AF] flex flex-col items-center justify-center space-y-2">
              <MessageSquare size={24} className="opacity-55" />
              <span>No conversations found.</span>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isActive = c.userId === selectedUserId;
              return (
                <div
                  key={c.userId}
                  onClick={() => handleConversationSelect(c.userId)}
                  className={`p-3.5 flex items-center gap-3 transition-colors cursor-pointer select-none relative ${
                    isActive
                      ? 'bg-[#EAF4EE]/40 border-l-[3.5px] border-l-[#2D6A4F]'
                      : 'hover:bg-[#F9FAFB]'
                  }`}
                >
                  {/* Green avatar initials */}
                  <div className="w-10 h-10 rounded-full bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center text-sm font-extrabold shrink-0 border border-[#2D6A4F]/10">
                    {getInitials(c.name)}
                  </div>
                  
                  {/* Info details */}
                  <div className="flex-grow min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-xs font-bold text-[#111827] truncate leading-tight">
                          {c.name}
                        </span>
                        {getRoleLabel(c.role)}
                      </div>
                      {c.lastMessage && (
                        <span className="text-[10px] font-semibold text-[#9CA3AF] shrink-0">
                          {formatTime(c.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[12px] truncate max-w-full ${
                        c.unreadCount > 0 ? 'font-bold text-[#111827]' : 'text-[#6B7280]'
                      }`}>
                        {c.lastMessage ? c.lastMessage.content : 'No messages yet'}
                      </p>
                      
                      {c.unreadCount > 0 && (
                        <span className="w-[18px] h-[18px] bg-[#DC2626] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT PANEL - Thread & Messages */}
      <div className={`flex-grow flex flex-col min-w-0 bg-white ${
        selectedUserId ? 'flex' : 'hidden md:flex'
      }`}>
        {selectedUserId && activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile back trigger */}
                <button
                  onClick={handleBackToList}
                  className="p-1.5 rounded-lg hover:bg-gray-150 transition-colors md:hidden text-text-secondary cursor-pointer"
                >
                  <ArrowLeft size={18} />
                </button>

                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center text-xs font-extrabold border border-[#2D6A4F]/10 shrink-0">
                  {getInitials(activeConversation.name)}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#111827] truncate leading-tight">
                    {activeConversation.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getRoleLabel(activeConversation.role)}
                  </div>
                </div>
              </div>

              {/* Tertiary header option link */}
              <button
                onClick={() => toast.success('User profiles coming in next release!')}
                className="text-[12px] font-bold text-[#2D6A4F] hover:text-[#1B4332] transition-colors flex items-center gap-1"
              >
                <UserIcon size={12} />
                View Profile
              </button>
            </div>

            {/* Message Feed list */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-white">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] text-xs font-semibold space-y-1 py-12">
                  <span className="text-3xl">👋</span>
                  <span>Say hello to start the conversation!</span>
                </div>
              ) : (
                messages.map((m, index) => {
                  const isSent = m.fromUserId === currentUserId;
                  
                  // Show date separator if message date differs from previous message
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const showDateGroup = !prevMsg || 
                    new Date(prevMsg.createdAt).toDateString() !== new Date(m.createdAt).toDateString();

                  return (
                    <React.Fragment key={m.id}>
                      {showDateGroup && (
                        <div className="flex justify-center my-3 select-none">
                          <span className="px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-[10px] font-extrabold text-[#9CA3AF] tracking-wider uppercase">
                            {formatMessageDateGroup(m.createdAt)}
                          </span>
                        </div>
                      )}

                      <div className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                        <div className="max-w-[70%] space-y-1">
                          {/* Chat bubble bubble */}
                          <div
                            className={`px-3.5 py-2.5 text-xs shadow-sm leading-relaxed ${
                              isSent
                                ? 'bg-[#2D6A4F] text-white rounded-t-xl rounded-l-xl rounded-br-sm'
                                : 'bg-[#F3F4F6] text-[#111827] rounded-t-xl rounded-r-xl rounded-bl-sm'
                            }`}
                          >
                            {m.content}
                          </div>
                          {/* Relative micro time */}
                          <span className={`text-[10px] font-semibold text-[#9CA3AF] block ${
                            isSent ? 'text-right' : 'text-left'
                          }`}>
                            {formatTime(m.createdAt)}
                          </span>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="p-3 border-t border-[#E5E7EB] bg-white flex gap-2 shrink-0">
              <input
                type="text"
                value={inputContent}
                onChange={(e) => setInputContent(e.target.value)}
                placeholder="Type your message here..."
                disabled={sendMessageMutation.isPending}
                className="flex-grow bg-white border border-[#E5E7EB] focus:border-[#2D6A4F] focus:ring-1 focus:ring-[#2D6A4F] rounded-lg px-4 py-2 text-xs text-text-primary outline-none transition-all placeholder-[#9CA3AF]"
              />
              <button
                type="submit"
                disabled={!inputContent.trim() || sendMessageMutation.isPending}
                className="w-10 h-10 bg-[#2D6A4F] hover:bg-[#1B4332] disabled:opacity-50 text-white rounded-lg flex items-center justify-center shrink-0 cursor-pointer shadow-sm transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF] text-xs font-semibold space-y-3 p-12 bg-white">
            <div className="w-14 h-14 bg-gray-50 border border-gray-150 rounded-full flex items-center justify-center">
              <MessageSquare size={26} className="text-[#6B7280]" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-text-primary">Your Messages Inbox</h3>
              <p className="max-w-[280px] text-text-secondary leading-normal">
                Select an active conversation from the list to view chat logs and send direct replies.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
export default MessagesPage;
