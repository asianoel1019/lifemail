import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Inbox, Send, Star, Trash2, Mail, Plus, 
  Search, Settings, HelpCircle, Grid, 
  Menu, Users, Shield, LayoutDashboard,
  ChevronRight, ArrowLeft, RefreshCw, LogOut,
  Palette, Lock, Eye, EyeOff, Edit2, Paperclip, Download,
  Reply, ReplyAll, Forward, Loader2, Image
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api';

const ThemeContext = createContext();

export default function App() {
  const [view, setView] = useState('inbox');
  const [composeData, setComposeData] = useState(null);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'serious');
  const [unreadCount, setUnreadCount] = useState(0);
  const [folders, setFolders] = useState([]);
  const [storage, setStorage] = useState({ used: 0, quota: 10 });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchEmails();
      fetchFolders();
      fetchStorage();
    }
  }, [user, view]);

  const fetchStorage = async () => {
    if (!user) return;
    try {
      const res = await axios.post(`${API_BASE}/user/storage`, { email: user.email });
      setStorage(res.data);
    } catch (err) { console.error('Fetch Storage Error:', err); }
  };

  const setThemeAndSync = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (user) {
      axios.post(`${API_BASE}/user/theme`, { email: user.email, theme: newTheme }).catch(console.error);
    }
  };

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const fetchEmails = async () => {
    if (!user || ['admin', 'system_config', 'security', 'settings', 'compose', 'read'].includes(view)) return;
    setLoading(true);
    try {
      const folderParam = view === 'sent' ? 'Sent' : view === 'trash' ? 'Trash' : (view === 'inbox' || view === 'starred') ? 'INBOX' : view;
      const res = await axios.post(`${API_BASE}/mail/list`, {
        email: user.email,
        password: localStorage.getItem('userPass'),
        folder: folderParam,
        starredOnly: view === 'starred'
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setEmails(data);
      setError(null);
      if (view === 'inbox') {
        setUnreadCount(data.filter(e => !e.seen).length);
      }
    } catch (err) {
      console.error('Fetch Emails Error:', err);
      setError('Connection to mail server lost or credentials invalid.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    if (!user) return;
    try {
      const res = await axios.post(`${API_BASE}/mail/folders`, {
        email: user.email, password: localStorage.getItem('userPass')
      });
      setFolders(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) { 
      console.error('Fetch Folders Error:', err);
      setError('Failed to sync folders.');
    }
  };

  const createFolder = async () => {
    const name = prompt('Enter new folder name:');
    if (!name) return;
    try {
      await axios.post(`${API_BASE}/mail/folders/create`, {
        email: user.email, password: localStorage.getItem('userPass'), folderName: name
      });
      fetchFolders();
    } catch (err) { alert('Failed to create folder: ' + err.message); }
  };

  const moveEmail = async (uid, sourceFolder, targetFolder) => {
    try {
      await axios.post(`${API_BASE}/mail/move`, {
        email: user.email, password: localStorage.getItem('userPass'),
        uid, sourceFolder, targetFolder
      });
      fetchEmails();
      fetchFolders();
    } catch (err) { alert('Failed to move email: ' + err.message); }
  };

  const handleLogin = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      setUser(res.data);
      if (res.data.theme) setTheme(res.data.theme);
      localStorage.setItem('user', JSON.stringify(res.data));
      localStorage.setItem('userPass', password);
    } catch (err) {
      alert('Login failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  if (!user) {
    return (
      <ThemeContext.Provider value={{ theme, setTheme: setThemeAndSync }}>
        <LoginView onLogin={handleLogin} theme={theme} setTheme={setTheme} />
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeAndSync }}>
      <div className="h-screen flex overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">
        {/* Sidebar */}
        <aside className="w-64 border-r border-[var(--border)] flex flex-col bg-[var(--bg-sidebar)] backdrop-blur-md shrink-0">
          <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--primary)] rounded-[var(--radius)] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Mail className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">LifeMail</span>
          </div>

          <div className="px-4 mb-6">
            <button 
              onClick={() => { setComposeData(null); setView('compose'); }}
              className="w-full flex items-center justify-center gap-2 bg-[var(--primary)] hover:opacity-90 py-3 rounded-[var(--radius)] font-bold text-white shadow-lg transition-all active:scale-95 group"
            >
              <Plus className="w-5 h-5 transition-transform group-hover:rotate-90" />
              Compose
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
            <NavItem icon={<Inbox />} label="Inbox" active={view === 'inbox'} onClick={() => setView('inbox')} count={unreadCount} onDrop={(uid, src) => moveEmail(uid, src, 'INBOX')} />
            <NavItem 
              icon={<Star />} 
              label="Starred" 
              active={view === 'starred'} 
              onClick={() => setView('starred')} 
              onDrop={async (uid, src) => {
                await axios.post(`${API_BASE}/mail/toggle-star`, { email: user.email, password: localStorage.getItem('userPass'), uid, starred: true, folder: src });
                fetchEmails();
              }} 
            />
            <NavItem icon={<Send />} label="Sent" active={view === 'sent'} onClick={() => setView('sent')} onDrop={(uid, src) => moveEmail(uid, src, 'Sent')} />
            <NavItem icon={<Trash2 />} label="Trash" active={view === 'trash'} onClick={() => setView('trash')} onDrop={(uid, src) => moveEmail(uid, src, 'Trash')} />
            
            <div className="pt-6 pb-2 px-2 flex items-center justify-between group">
              <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">My Folders</span>
              <button onClick={createFolder} className="p-1 hover:bg-[var(--bg-surface)] rounded-md text-[var(--text-muted)] hover:text-[var(--primary)] transition-all">
                <Plus size={14} />
              </button>
            </div>
            
            {folders.filter(f => !['INBOX', 'Sent', 'Trash', 'Drafts', 'Junk', 'Starred'].includes(f.name)).map(f => (
              <NavItem 
                key={f.path} 
                icon={<Grid />} 
                label={f.name} 
                active={view === f.name} 
                onClick={() => setView(f.name)} 
                onDrop={(uid, src) => moveEmail(uid, src, f.name)}
              />
            ))}

            {user.role === 'admin' && (
              <>
                <div className="py-4"></div>
                <div className="px-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest mb-2">Management</div>
                <NavItem icon={<Users />} label="Accounts" active={view === 'admin'} onClick={() => setView('admin')} />
                <NavItem icon={<Settings />} label="System Setting" active={view === 'system_config'} onClick={() => setView('system_config')} />
                <NavItem icon={<Shield />} label="Security" active={view === 'security'} onClick={() => setView('security')} />
              </>
            )}
          </nav>

          <UserProfile user={user} logout={logout} setView={setView} />
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-[var(--border)] flex items-center justify-between px-6 bg-[var(--bg-sidebar)]/50 backdrop-blur-sm shrink-0">
            <div className="flex-1 max-w-2xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                type="text" 
                placeholder="Search..."
                className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius)] pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
              />
            </div>
            <div className="flex items-center gap-4 text-[var(--text-muted)]">
              <button onClick={fetchEmails} className="hover:text-[var(--text-main)] transition-colors"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
              <div className="w-[1px] h-4 bg-[var(--border)]"></div>
              <button onClick={() => setView('settings')} className="hover:text-[var(--text-main)] transition-colors"><Settings size={20} /></button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--bg-main)]">
            {error && (
              <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-bold flex items-center gap-3">
                <Shield size={18} /> {error}
                <button onClick={() => { fetchEmails(); fetchFolders(); }} className="ml-auto underline">Retry</button>
              </div>
            )}
            <AnimatePresence mode="wait">
              {!['admin', 'system_config', 'security', 'settings', 'compose', 'read'].includes(view) && (
                <motion.div 
                  key={view} 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, y: -10 }} 
                  className="divide-y divide-[var(--border)]"
                >
                  {emails.length === 0 ? (
                    <EmptyState label={loading ? "Synchronizing..." : `No messages in ${view}`} />
                  ) : (
                    emails.map(email => (
                      <EmailRow 
                        key={email.uid} 
                        email={email} 
                        currentFolder={view === 'sent' ? 'Sent' : view === 'trash' ? 'Trash' : (view === 'inbox' || view === 'starred') ? 'INBOX' : view}
                        onClick={() => { 
                          const sourceFolder = email.folder || (view === 'sent' ? 'Sent' : view === 'trash' ? 'Trash' : (view === 'inbox' || view === 'starred') ? 'INBOX' : view);
                          setSelectedEmail({ ...email, folder: sourceFolder }); 
                          setView('read'); 
                        }}
                        onDelete={async (e) => {
                          e.stopPropagation();
                          const currentFolder = email.folder || (view === 'sent' ? 'Sent' : view === 'trash' ? 'Trash' : (view === 'inbox' || view === 'starred') ? 'INBOX' : view);
                          await axios.post(`${API_BASE}/mail/delete`, { email: user.email, password: localStorage.getItem('userPass'), uid: email.uid, folder: currentFolder });
                          fetchEmails();
                        }}
                        onStar={async (e) => {
                          e.stopPropagation();
                          const currentFolder = email.folder || (view === 'sent' ? 'Sent' : view === 'trash' ? 'Trash' : (view === 'inbox' || view === 'starred') ? 'INBOX' : view);
                          await axios.post(`${API_BASE}/mail/toggle-star`, { email: user.email, password: localStorage.getItem('userPass'), uid: email.uid, starred: !email.starred, folder: currentFolder });
                          fetchEmails();
                        }}
                      />
                    ))
                  )}
                </motion.div>
              )}

              {view === 'admin' && (
                <motion.div key="admin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <AdminPanel />
                </motion.div>
              )}
              {view === 'system_config' && (
                <motion.div key="sys" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SystemConfigPanel />
                </motion.div>
              )}
              {view === 'security' && (
                <motion.div key="sec" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <SecurityPanel />
                </motion.div>
              )}
              {view === 'settings' && (
                <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full">
                  <SettingsView user={user} setUser={setUser} theme={theme} setTheme={setThemeAndSync} storage={storage} />
                </motion.div>
              )}
              {view === 'compose' && (
                <motion.div key="compose" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="h-full">
                  <ComposeView user={user} onCancel={() => setView('inbox')} onSent={fetchEmails} initialData={composeData} />
                </motion.div>
              )}
              {view === 'read' && (
                <motion.div key={`read-${selectedEmail?.uid}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="h-full">
                  <ReadView email={selectedEmail} user={user} onBack={() => setView('inbox')} onDelete={async () => {
                    if (!window.confirm('Delete this message?')) return;
                    await axios.post(`${API_BASE}/mail/delete`, { email: user.email, password: localStorage.getItem('userPass'), uid: selectedEmail.uid, folder: selectedEmail.folder });
                    setView('inbox');
                    fetchEmails();
                  }} onAction={(type, data) => {
                    setComposeData(data);
                    setView('compose');
                  }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

function NavItem({ icon, label, active, onClick, count, onDrop }) {
  const [isOver, setIsOver] = useState(false);

  return (
    <button 
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData('email'));
          onDrop(data.uid, data.folder, label);
        } catch (err) { console.error('Drop error:', err); }
      }}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-[var(--radius)] transition-all duration-200 group ${
        active 
          ? 'bg-[var(--primary)] text-white font-bold shadow-md' 
          : isOver ? 'bg-[var(--primary)]/20 text-[var(--primary)] scale-105' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-main)]'
      }`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon, { size: 18 })}
        <span className="text-sm tracking-wide">{label}</span>
      </div>
      {count > 0 && (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${active ? 'bg-white text-[var(--primary)]' : 'bg-[var(--primary)] text-white'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function UserProfile({ user, logout, setView }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-4 border-t border-[var(--border)] relative bg-[var(--bg-sidebar)]">
      <button 
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-[var(--radius)] hover:bg-[var(--bg-surface)] transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 overflow-hidden text-left">
          <p className="text-xs font-bold truncate">{user.email}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase font-black">{user.role}</p>
        </div>
        <Settings className="w-4 h-4 text-[var(--text-muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-4 right-4 mb-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-2xl p-2 z-50 backdrop-blur-xl"
          >
            <button onClick={() => { setView('settings'); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-main)] rounded-lg transition-colors font-bold">
              <Palette size={14} /> Appearance
            </button>
            <button onClick={() => { setView('security'); setOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-main)] rounded-lg transition-colors font-bold">
              <Lock size={14} /> Security
            </button>
            <div className="h-[1px] bg-[var(--border)] my-1"></div>
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors font-bold">
              <LogOut size={14} /> Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmailRow({ email, onClick, onDelete, onStar, currentFolder }) {
  return (
    <div 
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('email', JSON.stringify({ uid: email.uid, folder: currentFolder }));
      }}
      onClick={onClick}
      className={`flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-surface)] cursor-pointer transition-colors group border-l-4 ${email.seen ? 'border-transparent' : 'border-[var(--primary)]'}`}
    >
      <div className={`w-10 h-10 rounded-[var(--radius)] flex items-center justify-center font-bold transition-colors ${email.seen ? 'bg-[var(--bg-input)] text-[var(--text-muted)]' : 'bg-[var(--primary)] text-white shadow-md'}`}>
        {email.from ? email.from.charAt(0).toUpperCase() : '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between mb-1">
          <h4 className={`text-sm truncate pr-4 ${email.seen ? 'font-medium' : 'font-black'}`}>{email.from}</h4>
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{email.date ? new Date(email.date).toLocaleDateString() : ''}</span>
        </div>
        <p className={`text-xs truncate mb-0.5 ${email.seen ? 'text-[var(--text-muted)]' : 'text-[var(--text-main)] font-bold'}`}>{email.subject || '(No Subject)'}</p>
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onStar(e); }}
          className={`p-2 hover:bg-[var(--bg-main)] rounded-lg transition-colors ${email.starred ? 'text-yellow-500' : 'text-[var(--text-muted)]'}`}
        >
          <Star size={14} fill={email.starred ? 'currentColor' : 'none'} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(e); }} className="p-2 hover:bg-[var(--bg-main)] rounded-lg text-red-500 transition-colors"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function ReadView({ email, user, onBack, onDelete, onAction }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.post(`${API_BASE}/mail/fetch`, {
          email: user.email, password: localStorage.getItem('userPass'), uid: email.uid, folder: email.folder || 'INBOX'
        });
        setData(res.data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [email.uid]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[var(--bg-main)]">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
    </div>
  );

  const handleReply = (all = false) => {
    const quote = `\n\n--- Original Message ---\nFrom: ${email.from}\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${data?.text || ''}`;
    onAction('reply', {
      to: email.from,
      subject: `Re: ${email.subject}`,
      body: quote
    });
  };

  const handleForward = () => {
    const quote = `\n\n--- Forwarded Message ---\nFrom: ${email.from}\nDate: ${new Date(email.date).toLocaleString()}\nSubject: ${email.subject}\n\n${data?.text || ''}`;
    onAction('forward', {
      subject: `Fwd: ${email.subject}`,
      body: quote
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-main)] overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--bg-sidebar)]/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--bg-surface)] transition-all"><ArrowLeft size={20} /></button>
          <div className="w-px h-6 bg-[var(--border)] mx-2" />
          <button onClick={() => handleReply(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-sm font-bold transition-all">
            <Reply size={16} /> Reply
          </button>
          <button onClick={() => handleReply(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-sm font-bold transition-all">
            <ReplyAll size={16} /> Reply All
          </button>
          <button onClick={handleForward} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-surface)] text-sm font-bold transition-all">
            <Forward size={16} /> Forward
          </button>
        </div>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-all">
          <Trash2 size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="max-w-4xl mx-auto bg-[var(--bg-surface)] rounded-[var(--radius)] p-8 border border-[var(--border)] shadow-2xl min-h-[500px]">
          <h1 className="text-3xl font-bold mb-8 text-[var(--text-main)]">{email.subject || '(No Subject)'}</h1>
          
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-[var(--border)]">
            <div className="w-12 h-12 rounded-[var(--radius)] bg-[var(--primary)] flex items-center justify-center text-white text-xl font-black shadow-md">
              {email.from ? email.from[0].toUpperCase() : '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-lg text-[var(--text-main)] truncate pr-4">{email.from}</span>
                <span className="text-xs text-[var(--text-muted)] font-bold shrink-0">{new Date(email.date).toLocaleString()}</span>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-black uppercase tracking-widest">to me</span>
            </div>
          </div>

          <div className="text-[var(--text-main)] leading-relaxed mb-12">
            {data?.html ? <div dangerouslySetInnerHTML={{ __html: data.html }} /> : <div className="whitespace-pre-wrap">{data?.text}</div>}
          </div>

          {data?.attachments?.length > 0 && (
            <div className="mt-12 pt-8 border-t border-[var(--border)]">
              <h3 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-6 flex items-center gap-2">
                <Paperclip size={14} /> Attachments ({data.attachments.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {data.attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl group hover:border-[var(--primary)] transition-all">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-main)] flex items-center justify-center text-[var(--primary)] shadow-sm">
                        <Paperclip size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <div className="text-sm font-bold truncate">{att.filename}</div>
                        <div className="text-[10px] font-black text-[var(--text-muted)] uppercase">{(att.size / 1024).toFixed(1)} KB</div>
                      </div>
                    </div>
                    <a 
                      href={`${API_BASE}/mail/attachment?email=${user.email}&password=${localStorage.getItem('userPass')}&uid=${email.uid}&folder=${email.folder || 'INBOX'}&filename=${encodeURIComponent(att.filename)}`}
                      className="p-2 rounded-lg bg-[var(--bg-main)] hover:bg-[var(--primary)] hover:text-white transition-all text-[var(--text-muted)]"
                      download
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function SettingsView({ user, setUser, theme, setTheme, storage }) {
  const [signature, setSignature] = useState(user.signature || '');
  const [saving, setSaving] = useState(false);

  const saveSignature = async () => {
    setSaving(true);
    try {
      await axios.post(`${API_BASE}/user/signature`, { email: user.email, signature });
      const newUser = { ...user, signature };
      setUser(newUser);
      localStorage.setItem('user', JSON.stringify(newUser));
      alert('Signature saved successfully!');
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const usedGB = (storage.used / (1024 * 1024 * 1024)).toFixed(2);
  const percent = Math.min(100, Math.round((storage.used / (storage.quota * 1024 * 1024 * 1024)) * 100));

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto space-y-8">
      <h2 className="text-3xl font-black mb-4">Account Settings</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius)] border border-[var(--border)] shadow-xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
               <Edit2 className="text-[var(--primary)]" size={20} /> Personal Signature
            </h3>
            <div className="space-y-4">
              <textarea 
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder="Best Regards,&#10;Your Name"
                className="w-full bg-[var(--bg-input)] p-5 border border-[var(--border)] rounded-2xl h-40 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none font-medium transition-all"
              />
              <button 
                onClick={saveSignature}
                disabled={saving}
                className="bg-[var(--primary)] text-white font-black px-8 py-3 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield size={18} />} Save Signature
              </button>
            </div>
          </section>

          <section className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius)] border border-[var(--border)] shadow-xl">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className="text-[var(--primary)]" /> Appearance</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <ThemeCard label="Serious" id="serious" active={theme === 'serious'} onClick={() => setTheme('serious')} color="#3b82f6" />
              <ThemeCard label="Cartoon" id="cartoon" active={theme === 'cartoon'} onClick={() => setTheme('cartoon')} color="#ff85a1" />
              <ThemeCard label="Forest" id="forest" active={theme === 'forest'} onClick={() => setTheme('forest')} color="#2d6a4f" />
              <ThemeCard label="Minimalist" id="minimalist" active={theme === 'minimalist'} onClick={() => setTheme('minimalist')} color="#000000" />
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius)] border border-[var(--border)] shadow-xl">
             <h3 className="font-bold mb-4">Storage Usage</h3>
             <div className="h-2 bg-[var(--bg-input)] rounded-full overflow-hidden mb-2">
                <div className="h-full bg-[var(--primary)] transition-all duration-1000" style={{ width: `${percent}%` }} />
             </div>
             <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{usedGB} GB of {storage.quota} GB Used</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ThemeCard({ label, active, onClick, color }) {
  return (
    <button 
      onClick={onClick}
      className={`p-4 rounded-[var(--radius)] border-2 transition-all flex flex-col items-center gap-3 ${active ? 'border-[var(--primary)] bg-[var(--bg-main)]' : 'border-[var(--border)] hover:border-[var(--text-muted)]'}`}
    >
      <div className="w-10 h-10 rounded-full shadow-inner" style={{ backgroundColor: color }}></div>
      <span className="text-xs font-bold">{label}</span>
    </button>
  );
}

function SystemConfigPanel() {
  const [config, setConfig] = useState({ defaultDomain: '' });
  const [totalStorage, setTotalStorage] = useState(0);

  useEffect(() => { 
    fetchConfig();
    fetchTotalStorage();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/config`, { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } });
      setConfig(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchTotalStorage = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/storage`, { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } });
      setTotalStorage(res.data.totalUsed);
    } catch (err) { console.error(err); }
  };

  const updateConfig = async () => {
    try {
      await axios.patch(`${API_BASE}/admin/config`, config, { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } });
      alert('System configuration updated!');
    } catch (err) { alert('Failed to update config'); }
  };

  const totalGB = (totalStorage / (1024 * 1024 * 1024)).toFixed(2);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[var(--bg-surface)] p-10 rounded-[var(--radius)] border border-[var(--border)] shadow-2xl">
          <h3 className="text-xl font-black mb-4 flex items-center gap-2">
             <LayoutDashboard className="text-[var(--primary)]" /> System Storage
          </h3>
          <p className="text-4xl font-black text-[var(--primary)] mb-2">{totalGB} GB</p>
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Total mail data usage across all accounts</p>
        </div>
        
        <div className="bg-[var(--bg-surface)] p-10 rounded-[var(--radius)] border border-[var(--border)] shadow-2xl flex flex-col justify-center">
           <h3 className="text-sm font-bold mb-2">Mail Server Status</h3>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
             <span className="font-bold text-green-500">Operational</span>
           </div>
        </div>
      </div>

      <div className="bg-[var(--bg-surface)] p-10 rounded-[var(--radius)] border border-[var(--border)] shadow-2xl">
        <h3 className="text-xl font-black mb-8 flex items-center gap-2">
          <Settings className="text-[var(--primary)]" /> Global Mail Settings
        </h3>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Default Mail Domain</label>
            <input 
              className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-5 py-4 font-bold text-lg focus:ring-2 focus:ring-[var(--primary)] outline-none"
              value={config.defaultDomain}
              onChange={e => setConfig({ ...config, defaultDomain: e.target.value })}
              placeholder="e.g. asianoel.space"
            />
          </div>
          <div className="pt-4">
            <button 
              onClick={updateConfig}
              className="w-full bg-[var(--primary)] text-white font-black py-4 rounded-xl shadow-xl transition-all active:scale-95 text-lg"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [newQuota, setNewQuota] = useState(10);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/users`, { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } });
      setUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const addUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/admin/users`, { email: newEmail, password: newPass, role: newRole, quota: newQuota }, { headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } });
      setNewEmail(''); setNewPass(''); setNewQuota(10); fetchUsers();
    } catch (err) { alert(err.message); }
  };

  const deleteUser = async (email) => {
    if (!window.confirm(`Are you sure you want to delete ${email}?`)) return;
    try {
      await axios.delete(`${API_BASE}/admin/users`, { 
        data: { email },
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } 
      });
      fetchUsers();
    } catch (err) { alert(err.message); }
  };

  const updateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_BASE}/admin/users`, editingUser, { 
        headers: { Authorization: `Bearer ${JSON.parse(localStorage.getItem('user')).token}` } 
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black">Account Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[var(--bg-surface)] rounded-[var(--radius)] border border-[var(--border)] overflow-hidden shadow-xl">
          <div className="px-8 py-6 border-b border-[var(--border)] flex justify-between items-center">
            <h3 className="font-bold">Active Users</h3>
          </div>
          <div className="divide-y divide-[var(--border)] overflow-y-auto max-h-[600px] custom-scrollbar">
            {users.map(u => (
              <div key={u.email} className="px-8 py-5 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--primary)] font-bold shadow-inner">{u.email.charAt(0).toUpperCase()}</div>
                  <div>
                    <p className="font-bold text-sm">{u.email}</p>
                    <div className="flex gap-2">
                      <span className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">{u.role}</span>
                      <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">{u.quota || 10}GB QUOTA</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setEditingUser({ email: u.email, role: u.role, quota: u.quota || 10, password: '' })} className="p-2 hover:bg-[var(--bg-main)] rounded-lg text-[var(--primary)] transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => deleteUser(u.email)} className="p-2 hover:bg-[var(--bg-main)] rounded-lg text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="space-y-8">
          <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius)] border border-[var(--border)] shadow-xl">
            <h3 className="font-bold mb-6">{editingUser ? 'Edit Account' : 'Create Account'}</h3>
            {editingUser ? (
              <form onSubmit={updateUser} className="space-y-4">
                <p className="text-xs font-bold text-[var(--text-muted)] truncate">{editingUser.email}</p>
                <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none" type="password" placeholder="New Password (optional)" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                <select className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-bold" value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Quota (GB)</label>
                  <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-bold" type="number" value={editingUser.quota} onChange={e => setEditingUser({...editingUser, quota: e.target.value})} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-[var(--primary)] text-white font-bold py-3 rounded-xl shadow-lg active:scale-95 transition-all">Save</button>
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-[var(--bg-input)] font-bold py-3 rounded-xl border border-[var(--border)]">Cancel</button>
                </div>
              </form>
            ) : (
              <form onSubmit={addUser} className="space-y-4">
                <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none" placeholder="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none" type="password" placeholder="Password" value={newPass} onChange={e => setNewPass(e.target.value)} required />
                <select className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-bold" value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Quota (GB)</label>
                  <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary)] outline-none font-bold" type="number" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
                </div>
                <button className="w-full bg-[var(--primary)] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all">Provision Account</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityPanel() {
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const user = JSON.parse(localStorage.getItem('user'));

  const changePassword = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/user/password`, { email: user.email, oldPassword: oldPass, newPassword: newPass });
      alert('Password changed successfully! Please login again.');
      localStorage.clear(); window.location.reload();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-8">
      <h1 className="text-3xl font-black">Security Settings</h1>
      <div className="bg-[var(--bg-surface)] p-8 rounded-[var(--radius)] border border-[var(--border)] shadow-xl">
        <h3 className="font-bold mb-6 flex items-center gap-2"><Lock className="text-red-500" /> Change Password</h3>
        <form onSubmit={changePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Current Password</label>
            <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none" type="password" placeholder="••••••••" value={oldPass} onChange={e => setOldPass(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">New Password</label>
            <input className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 outline-none" type="password" placeholder="••••••••" value={newPass} onChange={e => setNewPass(e.target.value)} required />
          </div>
          <button className="w-full bg-red-500 text-white font-black py-4 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95 mt-4">Update Security Credentials</button>
        </form>
      </div>
    </div>
  );
}

function LoginView({ onLogin, theme, setTheme }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] flex flex-col items-center justify-center p-4 transition-colors duration-500">
      <div className="absolute top-8 right-8 flex gap-2 z-10">
        {['serious', 'cartoon', 'forest', 'minimalist'].map(t => (
          <button 
            key={t}
            onClick={() => setTheme(t)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${theme === t ? 'border-[var(--primary)] scale-110' : 'border-[var(--border)] opacity-50 hover:opacity-100'}`}
            style={{ backgroundColor: t === 'serious' ? '#3b82f6' : t === 'cartoon' ? '#ff85a1' : t === 'forest' ? '#2d6a4f' : '#000000' }}
          />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-surface)] p-10 rounded-[var(--radius)] border border-[var(--border)] w-full max-w-md shadow-2xl backdrop-blur-xl relative z-0">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-[var(--primary)] rounded-[var(--radius)] flex items-center justify-center shadow-2xl shadow-blue-500/40">
            <Mail className="text-white w-10 h-10" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-[var(--text-main)] text-center mb-2 tracking-tight">LifeMail</h2>
        <p className="text-[var(--text-muted)] text-center mb-10 font-medium">Elevate your communication experience</p>
        
        <form onSubmit={(e) => { e.preventDefault(); onLogin(email, pass); }} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Account Identifier</label>
            <input type="text" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all font-medium" placeholder="you@asianoel.space" required />
          </div>
          <div className="space-y-2 relative">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Secure Passkey</label>
            <input type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius)] px-5 py-4 text-[var(--text-main)] focus:ring-2 focus:ring-[var(--primary)] outline-none transition-all font-medium" placeholder="••••••••" required />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-[38px] text-[var(--text-muted)] hover:text-[var(--text-main)]">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <button className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-black py-4 rounded-[var(--radius)] shadow-xl transition-all active:scale-95 text-lg mt-4 shadow-blue-500/20">Authenticate</button>
        </form>
      </motion.div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-[var(--text-muted)]">
      <div className="w-20 h-20 bg-[var(--bg-surface)] rounded-full flex items-center justify-center mb-4 border border-[var(--border)] animate-pulse">
        <Mail size={40} className="opacity-50" />
      </div>
      <p className="text-lg font-bold">{label}</p>
    </div>
  );
}

function ComposeView({ user, onCancel, onSent, initialData }) {
  const [to, setTo] = useState(initialData?.to || '');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(initialData?.body || `\n\n${user.signature || ''}`);
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = React.useRef();

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('email', user.email);
      formData.append('password', localStorage.getItem('userPass'));
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('body', body);
      attachments.forEach(file => formData.append('attachments', file));

      await axios.post(`${API_BASE}/mail/send`, formData);
      onSent();
      onCancel();
    } catch (err) {
      alert('Send failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type });
        setAttachments(prev => [...prev, file]);
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="p-8 max-w-4xl mx-auto">
      <div className="bg-[var(--bg-surface)] rounded-[var(--radius)] p-8 border border-[var(--border)] shadow-2xl">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-[var(--border)]">
          <h2 className="text-2xl font-black">New Message</h2>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--bg-main)] transition-all font-bold">Cancel</button>
            <button 
              onClick={handleSend} 
              disabled={sending}
              className="px-6 py-2 rounded-xl bg-[var(--primary)] text-white font-black hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Recipient</label>
            <input 
              type="text" placeholder="to@example.com" value={to} onChange={e => setTo(e.target.value)}
              className="w-full bg-[var(--bg-input)] p-4 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Subject Matter</label>
            <input 
              type="text" placeholder="What's this about?" value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full bg-[var(--bg-input)] p-4 border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all font-bold"
            />
          </div>
          
          <div className="relative space-y-1">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Message Content</label>
            <textarea 
              placeholder="Write your message..." value={body} onChange={e => setBody(e.target.value)}
              onPaste={handlePaste}
              className="w-full bg-[var(--bg-input)] p-4 border border-[var(--border)] rounded-2xl h-64 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none custom-scrollbar font-medium"
            />
            <div className="absolute bottom-4 right-4 text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-[var(--bg-main)] px-2 py-1 rounded-md opacity-50 border border-[var(--border)]">
              Paste images to attach
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-4">
              {attachments.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-[var(--bg-main)] px-3 py-1.5 rounded-lg text-sm border border-[var(--border)] font-bold shadow-sm">
                  <Paperclip className="w-3 h-3 text-[var(--primary)]" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="text-red-500 hover:scale-125 transition-transform ml-1">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 pt-4">
            <input type="file" multiple ref={fileInputRef} className="hidden" onChange={e => setAttachments([...attachments, ...Array.from(e.target.files)])} />
            <button 
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 text-xs font-black text-[var(--text-muted)] hover:text-[var(--primary)] transition-all uppercase tracking-widest"
            >
              <Paperclip className="w-4 h-4" /> Add Attachment
            </button>
            <div className="text-[10px] text-[var(--primary)] font-black uppercase tracking-widest ml-auto opacity-70">
              Signature Included
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
