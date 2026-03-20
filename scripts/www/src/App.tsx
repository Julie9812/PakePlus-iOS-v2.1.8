import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Menu, 
  X, 
  Inbox, 
  BookOpen, 
  ShieldCheck, 
  AlertTriangle, 
  Rocket, 
  Link as LinkIcon, 
  Calendar,
  MoreVertical,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Image as ImageIcon,
  Mic,
  Send,
  MessageSquare,
  Trash2,
  Folder as FolderIcon,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Tag,
  MoreHorizontal,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, addDays, isAfter } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Note, Experiment, View, Principle, Mistake, AIConfig, AIProvider, Folder } from './types';
import { processNote, generateImage, checkGhostReminder } from './services/ai';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const typeMap: Record<string, string> = {
  thought: '想法',
  reflection: '复盘',
  inspiration: '灵感',
  mistake: '避坑'
};

interface TagNode {
  name: string;
  fullPath: string;
  children: Record<string, TagNode>;
}

const TagTreeNodeComponent: React.FC<{ node: TagNode, level?: number, activeTag: string | null, setActiveTag: (tag: string | null) => void }> = ({ node, level = 0, activeTag, setActiveTag }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Object.keys(node.children).length > 0;
  
  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer hover:bg-zinc-100 transition-colors",
          activeTag === node.fullPath ? "bg-zinc-100 text-black font-medium" : "text-zinc-500"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (activeTag === node.fullPath) {
            setActiveTag(null);
          } else {
            setActiveTag(node.fullPath);
          }
        }}
      >
        {hasChildren ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 hover:bg-zinc-200 rounded"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <span className="text-sm truncate"># {node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div className="flex flex-col">
          {Object.values<TagNode>(node.children).map(child => (
            <TagTreeNodeComponent key={child.fullPath} node={child} level={level + 1} activeTag={activeTag} setActiveTag={setActiveTag} />
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  // --- State ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [moveNoteId, setMoveNoteId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('inbox');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState<string | null>(null);
  const [viewingExperimentId, setViewingExperimentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Capture State
  const [captureText, setCaptureText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [ghostReminder, setGhostReminder] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig>({ provider: 'gemini', apiKey: '' });
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isTagInputFocused, setIsTagInputFocused] = useState(false);
  const [editingExpDays, setEditingExpDays] = useState<string | null>(null);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [openLinkMenuId, setOpenLinkMenuId] = useState<string | null>(null);
  const [openNoteMenuId, setOpenNoteMenuId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // --- Persistence ---
  useEffect(() => {
    const savedNotes = localStorage.getItem('lifeos_notes');
    const savedExps = localStorage.getItem('lifeos_experiments');
    const savedPrinciples = localStorage.getItem('lifeos_principles');
    const savedMistakes = localStorage.getItem('lifeos_mistakes');
    const savedFolders = localStorage.getItem('lifeos_folders');
    
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    } else {
      // Welcome Note
      const welcomeNote: Note = {
        id: 'welcome',
        content: "欢迎来到 LifeOS (迭代人生)！🚀\n\n这是一个帮助你将‘道理’转化为‘算法’的系统。你可以：\n1. 随手记下灵感或复盘。\n2. 点击‘启动迭代实验’开启 14 天刻意练习。\n3. 在实验结束时，决定它是成为你的‘人生算法’还是‘避坑指南’。\n\n试试点击右下角的 + 号开始吧！",
        timestamp: Date.now(),
        tags: ['入门', 'LifeOS'],
        type: 'inspiration'
      };
      setNotes([welcomeNote]);
    }
    
    if (savedExps) setExperiments(JSON.parse(savedExps));
    if (savedPrinciples) setPrinciples(JSON.parse(savedPrinciples));
    if (savedMistakes) setMistakes(JSON.parse(savedMistakes));
    if (savedFolders) setFolders(JSON.parse(savedFolders));
    
    const savedConfig = localStorage.getItem('lifeos_ai_config');
    if (savedConfig) {
      try {
        setAiConfig(JSON.parse(savedConfig));
      } catch (e) {}
    } else {
      const savedKey = localStorage.getItem('lifeos_custom_key');
      if (savedKey) setAiConfig({ provider: 'gemini', apiKey: savedKey });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lifeos_notes', JSON.stringify(notes));
    localStorage.setItem('lifeos_experiments', JSON.stringify(experiments));
    localStorage.setItem('lifeos_principles', JSON.stringify(principles));
    localStorage.setItem('lifeos_mistakes', JSON.stringify(mistakes));
    localStorage.setItem('lifeos_folders', JSON.stringify(folders));
    localStorage.setItem('lifeos_ai_config', JSON.stringify(aiConfig));
  }, [notes, experiments, principles, mistakes, folders, aiConfig]);

  useEffect(() => {
    if (!captureText || captureText.length < 5 || mistakes.length === 0) {
      setGhostReminder(null);
      return;
    }

    const timer = setTimeout(async () => {
      const mistakeContents = mistakes.map(m => m.content);
      const reminder = await checkGhostReminder(captureText, mistakeContents, aiConfig);
      setGhostReminder(reminder);
    }, 1000);

    return () => clearTimeout(timer);
  }, [captureText, mistakes]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenLinkMenuId(null);
      setOpenNoteMenuId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCaptureOpen && textareaRef.current) {
      // Small delay to ensure the modal animation has started and element is focusable
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [isCaptureOpen]);

  // --- Actions ---
  const closeCaptureModal = () => {
    setIsCaptureOpen(false);
    setCaptureText('');
    setManualTags([]);
    setTagInput('');
    setGhostReminder(null);
    setIsAiEnabled(false);
    setEditingNoteId(null);
    setShowTagDropdown(false);
  };

  const handleCapture = async () => {
    if (!captureText.trim()) return;
    setIsProcessing(true);
    
    try {
      let finalTags = [...manualTags];
      let finalType = 'thought';
      let finalStar = undefined;

      // Only call AI if the user explicitly enabled the AI toggle
      if (isAiEnabled) {
        const processed = await processNote(captureText, aiConfig);
        finalTags = Array.from(new Set([...manualTags, ...(processed.tags || [])]));
        finalType = processed.type || 'thought';
        finalStar = processed.star || undefined;
      }

      if (editingNoteId) {
        setNotes(notes.map(n => n.id === editingNoteId ? {
          ...n,
          content: captureText,
          tags: finalTags,
          type: finalType as any,
          star: finalStar,
        } : n));
      } else {
        const newNote: Note = {
          id: crypto.randomUUID(),
          content: captureText,
          timestamp: Date.now(),
          tags: finalTags,
          type: finalType as any,
          star: finalStar,
        };
        
        setNotes([newNote, ...notes]);
      }
      closeCaptureModal();
    } catch (error) {
      console.error('Capture failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startExperiment = (note: Note) => {
    const newExp: Experiment = {
      id: crypto.randomUUID(),
      title: note.content.slice(0, 40) + (note.content.length > 40 ? '...' : ''),
      startDate: Date.now(),
      endDate: addDays(new Date(), 14).getTime(),
      status: 'active',
      linkedNoteIds: [note.id],
    };
    
    setExperiments([newExp, ...experiments]);
    setNotes(notes.map(n => n.id === note.id ? { ...n, linkedExperimentId: newExp.id } : n));
  };

  const linkNoteToExperiment = (noteId: string, expId: string) => {
    setNotes(notes.map(n => n.id === noteId ? { ...n, linkedExperimentId: expId } : n));
    setExperiments(experiments.map(e => e.id === expId ? { ...e, linkedNoteIds: [...e.linkedNoteIds, noteId] } : e));
  };

  const handleReview = (expId: string, decision: 'extend' | 'ascend' | 'archive') => {
    const exp = experiments.find(e => e.id === expId);
    if (!exp) return;

    if (decision === 'extend') {
      setExperiments(experiments.map(e => e.id === expId ? { 
        ...e, 
        endDate: addDays(new Date(e.endDate), 7).getTime(),
        status: 'active' 
      } : e));
    } else if (decision === 'ascend') {
      const newPrinciple: Principle = {
        id: crypto.randomUUID(),
        title: exp.title,
        content: notes.filter(n => exp.linkedNoteIds.includes(n.id)).map(n => n.content).join('\n\n'),
        category: exp.category || 'General',
        timestamp: Date.now(),
      };
      setPrinciples([newPrinciple, ...principles]);
      setExperiments(experiments.map(e => e.id === expId ? { ...e, status: 'ascended' } : e));
    } else if (decision === 'archive') {
      const newMistake: Mistake = {
        id: crypto.randomUUID(),
        title: exp.title,
        content: notes.filter(n => exp.linkedNoteIds.includes(n.id)).map(n => n.content).join('\n\n'),
        category: exp.category || 'General',
        timestamp: Date.now(),
      };
      setMistakes([newMistake, ...mistakes]);
      setExperiments(experiments.map(e => e.id === expId ? { ...e, status: 'archived' } : e));
    }
    
    setIsReviewOpen(null);
  };

  const handleGenerateImage = async () => {
    if (!captureText.trim()) return;
    setIsGeneratingImage(true);
    try {
      const url = await generateImage(captureText, aiConfig);
      if (url) {
        const newNote: Note = {
          id: crypto.randomUUID(),
          content: `Generated image for: ${captureText}`,
          timestamp: Date.now(),
          tags: Array.from(new Set([...manualTags, 'AI-Generated'])),
          type: 'inspiration',
          imageUrl: url
        };
        setNotes([newNote, ...notes]);
        closeCaptureModal();
      }
    } catch (error) {
      console.error('Image generation failed', error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCaptureText(prev => prev + transcript);
    };

    recognition.start();
  };

  // --- Derived Data ---
  const activeExperiments = useMemo(() => 
    experiments.filter(e => e.status === 'active'), 
  [experiments]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [notes]);

  const tagTree = useMemo<Record<string, TagNode>>(() => {
    const root: Record<string, TagNode> = {};
    allTags.forEach(tag => {
      const parts = tag.split('/');
      let currentLevel = root;
      let currentPath = '';
      parts.forEach((part) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!currentLevel[part]) {
          currentLevel[part] = {
            name: part,
            fullPath: currentPath,
            children: {}
          };
        }
        currentLevel = currentLevel[part].children;
      });
    });
    return root;
  }, [allTags]);

  const filteredNotes = useMemo(() => {
    let base = notes;
    if (activeView === 'methods') {
      base = base.filter(n => n.inMethodsLibrary && !n.linkedExperimentId);
    } else if (activeView === 'inbox') {
      base = base.filter(n => !n.inMethodsLibrary && !n.folderId);
    } else if (activeView === 'folder' && activeFolderId) {
      base = base.filter(n => n.folderId === activeFolderId);
    }

    if (activeTag) {
      base = base.filter(n => n.tags.some(t => t === activeTag || t.startsWith(`${activeTag}/`)));
    }

    if (searchQuery) {
      base = base.filter(n => n.content.toLowerCase().includes(searchQuery.toLowerCase()) || n.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
    }
    return base;
  }, [notes, searchQuery, activeView, activeFolderId, activeTag]);

  // --- Components ---
  const SidebarItem = ({ id, icon: Icon, label, count, isActive, onClick }: { id: View | string, icon: any, label: string, count?: number, isActive?: boolean, onClick?: () => void }) => (
    <button
      onClick={onClick || (() => { setActiveView(id as View); setIsSidebarOpen(false); })}
      className={cn(
        "flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200",
        (isActive ?? activeView === id) ? "bg-black text-white shadow-lg" : "hover:bg-black/5 text-zinc-600"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon size={20} />
        <span className="font-medium">{label}</span>
      </div>
      {count !== undefined && (
        <span className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          (isActive ?? activeView === id) ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
        )}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans text-zinc-900 selection:bg-black selection:text-white">
      {/* --- Sidebar Overlay --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* --- Sidebar --- */}
      <motion.aside
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -300 }}
        className="fixed top-0 left-0 bottom-0 w-[280px] bg-white border-r border-zinc-200 z-50 p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white font-bold">L</div>
            <h1 className="text-xl font-bold tracking-tight">LifeOS</h1>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar pb-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('bg-zinc-100');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('bg-zinc-100');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('bg-zinc-100');
              const noteId = e.dataTransfer.getData('text/plain');
              if (noteId) {
                setNotes(notes.map(n => n.id === noteId ? { ...n, folderId: undefined } : n));
              }
            }}
            className="rounded-xl transition-colors"
          >
            <SidebarItem id="inbox" icon={Inbox} label="思想流" count={notes.filter(n => !n.inMethodsLibrary && !n.folderId).length} />
          </div>
          <SidebarItem id="methods" icon={BookOpen} label="方法库" count={notes.filter(n => n.inMethodsLibrary && !n.linkedExperimentId).length} />
          
          <div className="pt-4 pb-2 px-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">我的文件夹</span>
            <button 
              onClick={() => setIsCreatingFolder(true)}
              className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-black transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          </div>
          
          {isCreatingFolder && (
            <div className="px-4 py-2">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => {
                  if (newFolderName.trim()) {
                    setFolders([...folders, { id: crypto.randomUUID(), name: newFolderName.trim() }]);
                  }
                  setNewFolderName('');
                  setIsCreatingFolder(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (newFolderName.trim()) {
                      setFolders([...folders, { id: crypto.randomUUID(), name: newFolderName.trim() }]);
                    }
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  } else if (e.key === 'Escape') {
                    setNewFolderName('');
                    setIsCreatingFolder(false);
                  }
                }}
                placeholder="新建文件夹..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          )}

          {folders.map(folder => (
            <div 
              key={folder.id} 
              className="group relative"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('bg-zinc-100');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('bg-zinc-100');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('bg-zinc-100');
                const noteId = e.dataTransfer.getData('text/plain');
                if (noteId) {
                  setNotes(notes.map(n => n.id === noteId ? { ...n, folderId: folder.id } : n));
                }
              }}
            >
              <SidebarItem 
                id="folder" 
                icon={FolderIcon} 
                label={folder.name} 
                count={notes.filter(n => n.folderId === folder.id).length}
                isActive={activeView === 'folder' && activeFolderId === folder.id}
                onClick={() => {
                  setActiveView('folder');
                  setActiveFolderId(folder.id);
                  setIsSidebarOpen(false);
                }}
              />
              <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingFolderId(folder.id);
                    setEditingFolderName(folder.name);
                  }}
                  className="p-1.5 hover:bg-zinc-200 rounded text-zinc-500"
                >
                  <Edit2 size={12} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingFolderId(folder.id);
                  }}
                  className="p-1.5 hover:bg-zinc-200 rounded text-red-500"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">标签树</div>
          <div className="px-2">
            {Object.values<TagNode>(tagTree).map(node => (
              <TagTreeNodeComponent key={node.fullPath} node={node} activeTag={activeTag} setActiveTag={setActiveTag} />
            ))}
            {Object.keys(tagTree).length === 0 && (
              <p className="text-xs text-zinc-400 px-2 py-1">暂无标签</p>
            )}
          </div>

          <div className="pt-4 pb-2 px-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">人生资产</div>
          <SidebarItem id="principles" icon={ShieldCheck} label="算法库" count={principles.length} />
          <SidebarItem id="mistakes" icon={AlertTriangle} label="错题本" count={mistakes.length} />
          <button
            onClick={() => { setActiveView('settings' as any); setIsSidebarOpen(false); }}
            className={cn(
              "flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-200 mt-4",
              activeView === ('settings' as any) ? "bg-black text-white shadow-lg" : "hover:bg-black/5 text-zinc-600"
            )}
          >
            <Sparkles size={20} />
            <span className="font-medium">AI 设置</span>
          </button>
        </nav>

        <div className="mt-auto pt-6 border-t border-zinc-100">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-100">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=LifeOS`} alt="Avatar" />
            </div>
            <div>
              <p className="text-sm font-bold">msoumaoro</p>
              <p className="text-[10px] text-zinc-500">免费版</p>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* --- Main Content --- */}
      <main className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 bg-[#F5F5F5]/80 backdrop-blur-md z-30 border-b border-zinc-200/50">
          <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 hover:bg-zinc-200 rounded-full transition-colors">
              <Menu size={24} />
            </button>
            <div className="flex-1 max-w-md mx-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input 
                type="text" 
                placeholder="搜索灵感、实验或算法..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-zinc-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
              />
            </div>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Active Experiments (Capsules) */}
        {activeExperiments.length > 0 && activeView === 'inbox' && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">进行中的迭代</h2>
              <span className="text-[10px] text-zinc-400">{activeExperiments.length} 个实验</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
              {activeExperiments.map(exp => {
                const totalDays = differenceInDays(exp.endDate, exp.startDate);
                const daysPassed = differenceInDays(Date.now(), exp.startDate);
                const progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));
                const isDue = isAfter(new Date(), new Date(exp.endDate));

                return (
                  <motion.div
                    key={exp.id}
                    layoutId={exp.id}
                    onClick={() => setViewingExperimentId(exp.id)}
                    className={cn(
                      "flex-shrink-0 w-64 p-4 rounded-2xl border transition-all cursor-pointer group",
                      isDue ? "bg-black text-white border-black shadow-xl" : "bg-white border-zinc-200 hover:border-zinc-400"
                    )}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className={cn("p-1.5 rounded-lg", isDue ? "bg-white/20" : "bg-zinc-100")}>
                        <Rocket size={14} className={isDue ? "text-white" : "text-zinc-600"} />
                      </div>
                      <div className="flex items-center gap-2">
                        {editingExpDays === exp.id ? (
                          <input
                            type="number"
                            autoFocus
                            className="w-12 text-[10px] font-bold text-center bg-white border border-zinc-300 rounded px-1 py-0.5 text-black"
                            defaultValue={totalDays}
                            onBlur={(e) => {
                              const newDays = parseInt(e.target.value);
                              if (!isNaN(newDays) && newDays > 0) {
                                setExperiments(experiments.map(ex => ex.id === exp.id ? { ...ex, endDate: addDays(new Date(ex.startDate), newDays).getTime() } : ex));
                              }
                              setEditingExpDays(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            onClick={(e) => {
                              if (!isDue) {
                                e.stopPropagation();
                                setEditingExpDays(exp.id);
                              }
                            }}
                            className={cn("text-[10px] font-bold cursor-pointer hover:underline", isDue ? "text-emerald-400" : "text-zinc-400")}
                            title="点击修改天数"
                          >
                            {isDue ? "待复盘" : `D-${Math.max(0, totalDays - daysPassed)}`}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteExpId(exp.id);
                          }}
                          className={cn(
                            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md",
                            isDue ? "hover:bg-white/20 text-white/70 hover:text-white" : "hover:bg-zinc-100 text-zinc-400 hover:text-red-500"
                          )}
                          title="删除实验"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-bold mb-3 line-clamp-1">{exp.title}</h3>
                    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={cn("h-full", isDue ? "bg-emerald-400" : "bg-black")}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Content Feed */}
        <div className="space-y-6">
          {(activeView === 'inbox' || activeView === 'methods' || activeView === 'folder') && (
            <>
              {activeView === 'methods' && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">方法库</h2>
                  <p className="text-zinc-500 text-sm">收集来、尚未开始练习的好方法</p>
                </div>
              )}
              {activeView === 'folder' && activeFolderId && (
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">{folders.find(f => f.id === activeFolderId)?.name || '未知文件夹'}</h2>
                  <p className="text-zinc-500 text-sm">文件夹中的笔记</p>
                </div>
              )}
              {activeTag && (
                <div className="mb-6 flex items-center gap-2">
                  <span className="text-sm text-zinc-500">当前标签:</span>
                  <span className="px-3 py-1 bg-black text-white rounded-lg text-sm font-medium flex items-center gap-2">
                    #{activeTag}
                    <button onClick={() => setActiveTag(null)} className="hover:text-zinc-300">
                      <X size={14} />
                    </button>
                  </span>
                </div>
              )}
              {filteredNotes.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4 text-zinc-400">
                    <Inbox size={32} />
                  </div>
                  <p className="text-zinc-500 font-medium">暂时没有记录，开始捕捉你的第一个灵感吧</p>
                </div>
              ) : (
                filteredNotes.map((note, idx) => (
                  <motion.div
                    key={note.id}
                    draggable
                    onDragStart={(e: any) => {
                      e.dataTransfer.setData('text/plain', note.id);
                    }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm hover:shadow-md transition-all group cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400">{format(note.timestamp, 'HH:mm · MMM d')}</span>
                        {note.type && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                            {typeMap[note.type] || note.type}
                          </span>
                        )}
                      </div>
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => setOpenNoteMenuId(openNoteMenuId === note.id ? null : note.id)}
                          className={cn("p-1 transition-opacity", openNoteMenuId === note.id ? "opacity-100 text-zinc-600" : "text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100")}
                        >
                          <MoreVertical size={16} />
                        </button>
                        <AnimatePresence>
                          {openNoteMenuId === note.id && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute top-[100%] right-0 mt-1 w-32 z-20 bg-white rounded-xl shadow-lg border border-zinc-100 overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  setNotes(notes.map(n => n.id === note.id ? { ...n, inMethodsLibrary: !n.inMethodsLibrary } : n));
                                  setOpenNoteMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                              >
                                {note.inMethodsLibrary ? '移出方法库' : '移动至方法库'}
                              </button>
                              <button
                                onClick={() => {
                                  setMoveNoteId(note.id);
                                  setOpenNoteMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                              >
                                移动至文件夹...
                              </button>
                              <button
                                onClick={() => {
                                  setEditingNoteId(note.id);
                                  setCaptureText(note.content);
                                  setManualTags(note.tags);
                                  setIsCaptureOpen(true);
                                  setOpenNoteMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  setNotes(notes.filter(n => n.id !== note.id));
                                  setOpenNoteMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                              >
                                删除
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    
                    {note.imageUrl && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-zinc-100">
                        <img src={note.imageUrl} alt="Note" className="w-full aspect-square object-cover" referrerPolicy="no-referrer" />
                      </div>
                    )}
                    
                    <p className="text-zinc-800 leading-relaxed whitespace-pre-wrap mb-4">{note.content}</p>
                    
                    {note.star && (
                      <div className="mb-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100 text-xs text-zinc-600 leading-relaxed italic">
                        <div className="font-bold text-zinc-400 mb-1 uppercase tracking-widest">STAR 复盘</div>
                        {note.star}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mb-6">
                      {note.tags.map(tag => (
                        <span 
                          key={tag} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTag(activeTag === tag ? null : tag);
                          }}
                          className={cn(
                            "text-[11px] cursor-pointer transition-colors px-2 py-1 rounded-md",
                            activeTag === tag ? "bg-black text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
                      {note.linkedExperimentId ? (
                        <div 
                          onClick={() => setViewingExperimentId(note.linkedExperimentId)}
                          className="flex items-center gap-2 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full cursor-pointer hover:bg-emerald-100 transition-colors"
                        >
                          <LinkIcon size={12} />
                          <span>已链接至：{experiments.find(e => e.id === note.linkedExperimentId)?.title || '未知实验'}</span>
                        </div>
                      ) : (
                        <button 
                          onClick={() => startExperiment(note)}
                          className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 hover:text-black transition-colors"
                        >
                          <Rocket size={12} />
                          <span>启动迭代实验</span>
                        </button>
                      )}
                      
                      <div className="flex items-center gap-4">
                        {activeExperiments.length > 0 && !note.linkedExperimentId && (
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => setOpenLinkMenuId(openLinkMenuId === note.id ? null : note.id)}
                              className={cn("transition-colors", openLinkMenuId === note.id ? "text-black" : "text-zinc-400 hover:text-black")}
                            >
                              <LinkIcon size={16} />
                            </button>
                            <AnimatePresence>
                              {openLinkMenuId === note.id && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute bottom-[100%] right-0 pb-2 w-48 z-20"
                                >
                                  <div className="bg-white rounded-xl shadow-xl border border-zinc-200 p-2">
                                    <p className="text-[10px] font-bold text-zinc-400 px-2 py-1 uppercase">链接至实验</p>
                                    {activeExperiments.map(exp => (
                                      <button 
                                        key={exp.id}
                                        onClick={() => {
                                          linkNoteToExperiment(note.id, exp.id);
                                          setOpenLinkMenuId(null);
                                        }}
                                        className="w-full text-left text-xs px-2 py-2 hover:bg-zinc-50 rounded-lg transition-colors truncate"
                                      >
                                        {exp.title}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <button className="text-zinc-400 hover:text-black transition-colors">
                          <CheckCircle2 size={16} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </>
          )}

          {activeView === 'principles' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">人生算法库</h2>
              {principles.map(p => (
                <div key={p.id} className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="text-emerald-500" size={20} />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{p.category}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-4">{p.title}</h3>
                  <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">{p.content}</p>
                </div>
              ))}
            </div>
          )}

          {activeView === 'mistakes' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-6">避坑指南</h2>
              {mistakes.map(m => (
                <div key={m.id} className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="text-amber-500" size={20} />
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{m.category}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-4">{m.title}</h3>
                  <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}

          {(activeView as any) === 'settings' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold mb-6">AI 设置</h2>
              <div className="bg-white rounded-3xl p-8 border border-zinc-200 shadow-sm">
                <h3 className="text-lg font-bold mb-4">自定义密钥</h3>
                <p className="text-zinc-500 text-sm mb-6">
                  选择您偏好的 AI 模型供应商。支持 OpenAI、Anthropic 以及兼容 OpenAI 格式的国内大模型（如 DeepSeek、Kimi、通义千问等）。
                </p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">供应商</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['gemini', 'openai', 'anthropic', 'custom'] as AIProvider[]).map(p => (
                        <button
                          key={p}
                          onClick={() => setAiConfig({ ...aiConfig, provider: p, baseUrl: p === 'custom' ? 'https://api.deepseek.com/v1' : '', model: p === 'custom' ? 'deepseek-chat' : '' })}
                          className={cn(
                            "py-2 px-3 rounded-xl border text-sm font-medium transition-all capitalize",
                            aiConfig.provider === p ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-zinc-700 mb-2">API 密钥</label>
                    <input 
                      type="password"
                      placeholder={`请输入您的 ${aiConfig.provider} API 密钥...`}
                      value={aiConfig.apiKey}
                      onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                    />
                  </div>

                  {(aiConfig.provider === 'openai' || aiConfig.provider === 'custom') && (
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2">接口地址</label>
                      <input 
                        type="text"
                        placeholder="https://api.openai.com/v1"
                        value={aiConfig.baseUrl || ''}
                        onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      />
                      {aiConfig.provider === 'custom' && (
                        <p className="text-[10px] text-zinc-400 mt-1">
                          提示: DeepSeek (https://api.deepseek.com/v1), Kimi (https://api.moonshot.cn/v1)
                        </p>
                      )}
                    </div>
                  )}

                  {aiConfig.provider !== 'gemini' && (
                    <div>
                      <label className="block text-sm font-bold text-zinc-700 mb-2">模型名称</label>
                      <input 
                        type="text"
                        placeholder={aiConfig.provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4o'}
                        value={aiConfig.model || ''}
                        onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all"
                      />
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-zinc-400 mt-6">
                  您的配置将仅存储在本地浏览器中，不会上传到我们的服务器。
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* --- FAB --- */}
      <button 
        onClick={() => setIsCaptureOpen(true)}
        className="fixed bottom-8 right-8 w-16 h-16 bg-black text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 group"
      >
        <Plus size={32} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* --- Capture Modal --- */}
      <AnimatePresence>
        {isCaptureOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCaptureModal}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-4"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-xl rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div 
                className="p-8 overflow-y-auto no-scrollbar cursor-text"
                onClick={() => textareaRef.current?.focus()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold cursor-default" onClick={(e) => e.stopPropagation()}>
                    {editingNoteId ? '编辑灵感' : '捕捉灵感'}
                  </h3>
                  <button onClick={(e) => { e.stopPropagation(); closeCaptureModal(); }} className="p-2 hover:bg-zinc-100 rounded-full cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={captureText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCaptureText(value);
                      
                      const cursorPosition = e.target.selectionStart;
                      const textBeforeCursor = value.slice(0, cursorPosition);
                      const match = textBeforeCursor.match(/#([^\s#]*)$/);
                      
                      if (match) {
                        setShowTagDropdown(true);
                        setTagSearchQuery(match[1]);
                      } else {
                        setShowTagDropdown(false);
                      }
                    }}
                    placeholder="在这里记录你的复盘、灵感或吐槽..."
                    className="w-full h-48 text-xl bg-transparent border-none focus:ring-0 resize-none placeholder:text-zinc-300 relative z-10 outline-none"
                  />
                  
                  <AnimatePresence>
                    {showTagDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden z-50 max-h-48 overflow-y-auto"
                      >
                        {allTags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase())).length > 0 ? (
                          allTags.filter(t => t.toLowerCase().includes(tagSearchQuery.toLowerCase())).map(tag => (
                            <button
                              key={tag}
                              onClick={() => {
                                const cursorPosition = textareaRef.current?.selectionStart || 0;
                                const textBeforeCursor = captureText.slice(0, cursorPosition);
                                const textAfterCursor = captureText.slice(cursorPosition);
                                const match = textBeforeCursor.match(/#([^\s#]*)$/);
                                
                                if (match) {
                                  const newTextBefore = textBeforeCursor.slice(0, match.index) + `#${tag} `;
                                  setCaptureText(newTextBefore + textAfterCursor);
                                  
                                  // Also add to manual tags if not present
                                  if (!manualTags.includes(tag)) {
                                    setManualTags([...manualTags, tag]);
                                  }
                                }
                                setShowTagDropdown(false);
                                textareaRef.current?.focus();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                            >
                              <span className="text-zinc-400">#</span>
                              <div className="flex items-center">
                                {tag.split('/').map((part, i, arr) => (
                                  <React.Fragment key={i}>
                                    <span className={i === arr.length - 1 ? 'font-medium text-black' : 'text-zinc-400'}>{part}</span>
                                    {i < arr.length - 1 && <span className="text-zinc-300 mx-0.5">/</span>}
                                  </React.Fragment>
                                ))}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-zinc-400">
                            按回车或空格创建新标签 "{tagSearchQuery}"
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6" onClick={(e) => e.stopPropagation()}>
                  {manualTags.map(tag => (
                    <span key={tag} className="px-3 py-1.5 bg-zinc-100 text-zinc-600 rounded-lg text-xs font-medium flex items-center gap-1">
                      #{tag}
                      <button onClick={() => setManualTags(manualTags.filter(t => t !== tag))} className="hover:text-red-500 transition-colors ml-1">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <div className="relative flex-shrink-0">
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (tagInput.trim() && !manualTags.includes(tagInput.trim())) {
                          setManualTags([...manualTags, tagInput.trim()]);
                        }
                        setTagInput('');
                      }}
                    >
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onFocus={() => setIsTagInputFocused(true)}
                        onBlur={() => setTimeout(() => setIsTagInputFocused(false), 200)}
                        placeholder="添加标签 (回车)"
                        enterKeyHint="done"
                        className="bg-transparent border-none text-sm focus:ring-0 w-32 placeholder:text-zinc-400 px-1"
                      />
                    </form>
                    <AnimatePresence>
                      {isTagInputFocused && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-zinc-100 overflow-hidden z-50 max-h-48 overflow-y-auto"
                        >
                          {allTags.filter(t => !manualTags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())).length > 0 ? (
                            allTags.filter(t => !manualTags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())).map(tag => (
                              <button
                                key={tag}
                                onClick={() => {
                                  if (!manualTags.includes(tag)) {
                                    setManualTags([...manualTags, tag]);
                                  }
                                  setTagInput('');
                                  setIsTagInputFocused(false);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-colors"
                              >
                                <span className="text-zinc-400">#</span>
                                <div className="flex items-center">
                                  {tag.split('/').map((part, i, arr) => (
                                    <React.Fragment key={i}>
                                      <span className={i === arr.length - 1 ? 'font-medium text-black' : 'text-zinc-400'}>{part}</span>
                                      {i < arr.length - 1 && <span className="text-zinc-300 mx-0.5">/</span>}
                                    </React.Fragment>
                                  ))}
                                </div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-zinc-400">
                              {tagInput.trim() ? `按回车创建新标签 "${tagInput}"` : '输入标签名称...'}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <AnimatePresence>
                  {ghostReminder && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3"
                    >
                      <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                      <p className="text-xs text-amber-800 font-medium leading-relaxed">
                        {ghostReminder}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-100">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsAiEnabled(!isAiEnabled)}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        isAiEnabled ? "bg-emerald-50 text-emerald-500" : "hover:bg-zinc-100 text-zinc-400 hover:text-emerald-500"
                      )}
                      title="开启 AI 自动打标签与 STAR 复盘"
                    >
                      <Sparkles size={20} />
                    </button>
                    <button 
                      onClick={handleGenerateImage}
                      disabled={isGeneratingImage || !captureText}
                      className="p-3 hover:bg-zinc-100 rounded-2xl text-zinc-400 hover:text-black transition-all disabled:opacity-50"
                    >
                      {isGeneratingImage ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <ImageIcon size={20} />}
                    </button>
                    <button 
                      onClick={toggleRecording}
                      className={cn(
                        "p-3 rounded-2xl transition-all",
                        isRecording ? "bg-red-50 text-red-500 animate-pulse" : "hover:bg-zinc-100 text-zinc-400 hover:text-black"
                      )}
                    >
                      <Mic size={20} />
                    </button>
                  </div>
                  
                  <button 
                    onClick={handleCapture}
                    disabled={isProcessing || !captureText.trim()}
                    className="bg-black text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-800 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send size={18} />
                        <span>{editingNoteId ? '保存' : '发送'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Viewing Experiment Modal --- */}
      <AnimatePresence>
        {viewingExperimentId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[60] flex items-center justify-center p-4 sm:p-6"
            onClick={() => setViewingExperimentId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {(() => {
                const exp = experiments.find(e => e.id === viewingExperimentId);
                if (!exp) return null;
                const linkedNotes = notes.filter(n => exp.linkedNoteIds.includes(n.id)).sort((a, b) => b.timestamp - a.timestamp);
                const isDue = isAfter(new Date(), new Date(exp.endDate));
                const totalDays = differenceInDays(exp.endDate, exp.startDate);
                const daysPassed = differenceInDays(Date.now(), exp.startDate);
                const progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

                return (
                  <>
                    <div className="p-6 sm:p-8 border-b border-zinc-100 flex-shrink-0 relative">
                      <button 
                        onClick={() => setViewingExperimentId(null)}
                        className="absolute top-6 right-6 p-2 bg-zinc-100 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors"
                      >
                        <X size={20} />
                      </button>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={cn("p-2 rounded-xl", isDue ? "bg-black text-white" : "bg-zinc-100 text-zinc-600")}>
                          <Rocket size={20} />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{exp.title}</h2>
                          <p className="text-xs text-zinc-500">
                            {format(exp.startDate, 'yyyy.MM.dd')} - {format(exp.endDate, 'yyyy.MM.dd')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">假设 (Hypothesis)</p>
                          <p className="text-sm text-zinc-700">{exp.hypothesis}</p>
                        </div>
                        <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">指标 (Metrics)</p>
                          <p className="text-sm text-zinc-700">{exp.metrics}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs font-bold mb-2">
                        <span className="text-zinc-400">进度</span>
                        <span className={isDue ? "text-emerald-500" : "text-zinc-900"}>
                          {isDue ? "已结束" : `第 ${Math.max(1, daysPassed)} 天 / 共 ${totalDays} 天`}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          className={cn("h-full", isDue ? "bg-emerald-400" : "bg-black")}
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-zinc-50/50">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <MessageSquare size={14} />
                        过程追踪 ({linkedNotes.length})
                      </h3>
                      
                      {linkedNotes.length === 0 ? (
                        <div className="text-center py-10 text-zinc-400">
                          <p className="text-sm">暂无追踪记录</p>
                          <p className="text-xs mt-1">在主页记录感悟并链接至此实验</p>
                        </div>
                      ) : (
                        <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[15px] before:w-px before:bg-zinc-200">
                          {linkedNotes.map((note, index) => (
                            <div key={note.id} className="relative pl-10">
                              <div className="absolute left-0 top-1 w-8 h-8 bg-white border-2 border-zinc-200 rounded-full flex items-center justify-center z-10">
                                <span className="text-[10px] font-bold text-zinc-400">{linkedNotes.length - index}</span>
                              </div>
                              <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{typeMap[note.type] || note.type}</span>
                                  <span className="text-[10px] text-zinc-400">{format(note.timestamp, 'MM-dd HH:mm')}</span>
                                </div>
                                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{note.content}</p>
                                {note.star && (
                                  <div className="mt-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs text-zinc-600 italic">
                                    <span className="font-bold text-zinc-400 block mb-1 text-[10px] uppercase">STAR</span>
                                    {note.star}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {isDue && (
                      <div className="p-6 border-t border-zinc-100 bg-white flex-shrink-0">
                        <button
                          onClick={() => {
                            setViewingExperimentId(null);
                            setIsReviewOpen(exp.id);
                          }}
                          className="w-full py-4 bg-black text-white rounded-2xl font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={20} />
                          进行复盘 (Review)
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Review Modal --- */}
      <AnimatePresence>
        {isReviewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[70] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl p-10"
            >
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles size={40} />
                </div>
                <h2 className="text-3xl font-bold mb-2">14 天实验结束</h2>
                <p className="text-zinc-500">是时候为这次迭代做一个终局抉择了</p>
              </div>

              <div className="mb-10">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">实验回顾</h3>
                <div className="bg-zinc-50 rounded-3xl p-6 border border-zinc-100">
                  <p className="font-bold mb-4">{experiments.find(e => e.id === isReviewOpen)?.title}</p>
                  <div className="space-y-3">
                    {notes.filter(n => experiments.find(e => e.id === isReviewOpen)?.linkedNoteIds.includes(n.id)).map(n => (
                      <div key={n.id} className="flex gap-3 text-sm text-zinc-600">
                        <div className="w-1 h-1 rounded-full bg-zinc-300 mt-2 shrink-0" />
                        <p className="line-clamp-2">{n.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button 
                  onClick={() => handleReview(isReviewOpen, 'extend')}
                  className="p-6 rounded-3xl border border-zinc-200 hover:border-black hover:bg-zinc-50 transition-all text-center group"
                >
                  <Calendar className="mx-auto mb-3 text-zinc-400 group-hover:text-black" />
                  <p className="font-bold text-sm mb-1">延期</p>
                  <p className="text-[10px] text-zinc-400">再练 7 天</p>
                </button>
                <button 
                  onClick={() => handleReview(isReviewOpen, 'ascend')}
                  className="p-6 rounded-3xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all text-center group"
                >
                  <ShieldCheck className="mx-auto mb-3 text-emerald-600" />
                  <p className="font-bold text-sm text-emerald-700 mb-1">升华</p>
                  <p className="text-[10px] text-emerald-600/60">存入算法库</p>
                </button>
                <button 
                  onClick={() => handleReview(isReviewOpen, 'archive')}
                  className="p-6 rounded-3xl border border-zinc-200 hover:border-amber-200 hover:bg-amber-50 transition-all text-center group"
                >
                  <AlertTriangle className="mx-auto mb-3 text-zinc-400 group-hover:text-amber-600" />
                  <p className="font-bold text-sm mb-1">归档</p>
                  <p className="text-[10px] text-zinc-400">存入错题本</p>
                </button>
              </div>

              <button 
                onClick={() => setIsReviewOpen(null)}
                className="w-full mt-8 py-4 text-zinc-400 hover:text-zinc-600 font-medium transition-colors"
              >
                稍后再说
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Folder Modals */}
      <AnimatePresence>
        {editingFolderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setEditingFolderId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-lg font-bold mb-4">重命名文件夹</h3>
              <input
                type="text"
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                placeholder="文件夹名称"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 transition-all mb-6"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingFolderName.trim()) {
                    setFolders(folders.map(f => f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f));
                    setEditingFolderId(null);
                  }
                }}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingFolderId(null)}
                  className="flex-1 py-2 rounded-xl font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    if (editingFolderName.trim()) {
                      setFolders(folders.map(f => f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f));
                      setEditingFolderId(null);
                    }
                  }}
                  disabled={!editingFolderName.trim()}
                  className="flex-1 py-2 rounded-xl font-bold bg-black text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {deletingFolderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setDeletingFolderId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-lg font-bold mb-2">删除文件夹</h3>
              <p className="text-zinc-500 text-sm mb-6">确定要删除该文件夹吗？其中的笔记将移至思想流，不会被删除。</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingFolderId(null)}
                  className="flex-1 py-2 rounded-xl font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setFolders(folders.filter(f => f.id !== deletingFolderId));
                    setNotes(notes.map(n => n.folderId === deletingFolderId ? { ...n, folderId: undefined } : n));
                    if (activeFolderId === deletingFolderId) {
                      setActiveView('inbox');
                      setActiveFolderId(null);
                    }
                    setDeletingFolderId(null);
                  }}
                  className="flex-1 py-2 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {moveNoteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setMoveNoteId(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-lg font-bold mb-4">移动至文件夹</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar mb-6">
                <button
                  onClick={() => {
                    setNotes(notes.map(n => n.id === moveNoteId ? { ...n, folderId: undefined } : n));
                    setMoveNoteId(null);
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-zinc-50 transition-colors flex items-center gap-3"
                >
                  <Inbox size={18} className="text-zinc-400" />
                  <span className="text-sm font-medium">思想流 (收件箱)</span>
                </button>
                {folders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setNotes(notes.map(n => n.id === moveNoteId ? { ...n, folderId: folder.id } : n));
                      setMoveNoteId(null);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-zinc-50 transition-colors flex items-center gap-3"
                  >
                    <FolderIcon size={18} className="text-zinc-400" />
                    <span className="text-sm font-medium">{folder.name}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveNoteId(null)}
                className="w-full py-2 rounded-xl font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDeleteExpId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
            >
              <h3 className="text-lg font-bold mb-2">删除迭代实验</h3>
              <p className="text-zinc-500 text-sm mb-6">
                确定要删除这个迭代实验吗？删除后，关联的思想流卡片将被解除关联，但不会被删除。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDeleteExpId(null)}
                  className="flex-1 py-2 rounded-xl font-bold bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setExperiments(experiments.filter(e => e.id !== confirmDeleteExpId));
                    setNotes(notes.map(n => n.linkedExperimentId === confirmDeleteExpId ? { ...n, linkedExperimentId: undefined } : n));
                    setConfirmDeleteExpId(null);
                    if (viewingExperimentId === confirmDeleteExpId) {
                      setViewingExperimentId(null);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
