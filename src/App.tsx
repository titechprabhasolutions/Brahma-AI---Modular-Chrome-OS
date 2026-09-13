/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  BookOpen, 
  Gamepad2, 
  Code2, 
  Mic, 
  MicOff,
  LayoutGrid, 
  Youtube, 
  Github, 
  Mail, 
  MessageSquare, 
  StickyNote, 
  ChevronRight,
  ExternalLink,
  Terminal,
  Cpu,
  Zap,
  Plus,
  Trash2,
  X,
  Shield,
  Newspaper,
  PanelLeft,
  PanelRight,
  Send,
  Bot,
  Globe,
  Code,
  Layers,
  Monitor,
  Settings,
  PlusCircle,
  Search as SearchIcon,
  Boxes,
  Folder,
  Volume2,
  VolumeX,
  Sparkles,
  Battery,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import Markdown from 'react-markdown';
import { AppMode, Shortcut, AIResponse, Note, ChatSession, ChatFolder, ChatMessage } from './types';
import { AnalogClock } from './components/AnalogClock';

const GENAI_MODEL = "gemini-2.5-pro";
const FALLBACK_MODEL = "gemini-2.5-flash";
const MODE_THEMES: Record<AppMode, { primary: string; secondary: string; accent: string }> = {
  [AppMode.STUDY]: { primary: '#09111f', secondary: '#1b3f6b', accent: '#59d7ff' },
  [AppMode.GAMING]: { primary: '#120714', secondary: '#4a1238', accent: '#ff4fd8' },
  [AppMode.DEVELOPER]: { primary: '#071317', secondary: '#0f4b54', accent: '#2ef2d0' },
};
type ModeAction = { label: string; action: () => void };
type OnboardingStage = 'boot' | 'welcome' | 'mode' | 'tour' | 'activate' | 'first-action' | 'complete';
type HintTarget = 'search' | 'floating' | 'actions' | null;
type NewsItem = {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description?: string;
};
const MODE_BEHAVIORS: Record<AppMode, { suggestions: string[]; quickActions: (trigger: (key: string) => void) => ModeAction[]; hosts: string[]; distractions?: string[]; workHosts?: string[] }> = {
  [AppMode.STUDY]: {
    suggestions: [
      "Want a summary of this page?",
      "Turn this into 5 flashcards?",
      "Explain it like I'm 12?",
      "Create a quick quiz from this section?"
    ],
    quickActions: (t) => [
      { label: "TL;DR", action: () => t('Summarize') },
      { label: "Flashcards", action: () => t('Flashcards') },
      { label: "Explain simply", action: () => t('ExplainSimple') },
      { label: "Make quiz", action: () => t('Quiz') },
      { label: "Summarize URL", action: () => t('SummarizeURL') },
    ],
    hosts: ["medium.com", "wikipedia.org", "towardsdatascience.com", "docs.google.com", "notion.so"],
    distractions: ["youtube.com", "instagram.com", "tiktok.com", "facebook.com", "netflix.com", "reddit.com"]
  },
  [AppMode.GAMING]: {
    suggestions: [
      "Need best settings for this game?",
      "Want pro tips for this boss?",
      "Show latest patch notes?"
    ],
    quickActions: (t) => [
      { label: "Strategy tips", action: () => t('Strategy') },
      { label: "Best loadout", action: () => t('Strategy') },
      { label: "Patch summary", action: () => t('Summarize') },
    ],
    hosts: ["twitch.tv", "ign.com", "gamespot.com", "steamcommunity.com", "fextralife.com", "youtube.com/gaming"],
    workHosts: ["github.com", "stackoverflow.com", "notion.so", "docs.google.com"]
  },
  [AppMode.DEVELOPER]: {
    suggestions: [
      "Explain this error?",
      "Optimize this snippet?",
      "Convert this code to another language?"
    ],
    quickActions: (t) => [
      { label: "Fix error", action: () => t('Debug') },
      { label: "Optimize code", action: () => t('Debug') },
      { label: "API test", action: () => t('APITest') },
      { label: "Summarize URL", action: () => t('SummarizeURL') },
    ],
    hosts: ["github.com", "stackoverflow.com", "npmjs.com", "dev.to", "docs.python.org", "developer.mozilla.org"]
  }
};

// Browser Control Function Declarations
const browserTools: FunctionDeclaration[] = [
  {
    name: "switchMode",
    parameters: {
      type: Type.OBJECT,
      properties: {
        mode: {
          type: Type.STRING,
          description: "The mode to switch to: STUDY, GAMING, or DEVELOPER",
        }
      },
      required: ["mode"]
    },
    description: "Switch the browser environment mode"
  },
  {
    name: "openShortcut",
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Name of the shortcut to open (e.g., YouTube, GitHub)"
        }
      },
      required: ["name"]
    },
    description: "Open a predefined website shortcut"
  },
  {
    name: "searchWeb",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query to look up on the web"
        }
      },
      required: ["query"]
    },
    description: "Search the web for information using Google Search"
  },
  {
    name: "executeAutomation",
    parameters: {
      type: Type.OBJECT,
      properties: {
        task: {
          type: Type.STRING,
          description: "The automation task to perform (e.g., 'Login to Teams', 'Submit Assignment')"
        },
        steps: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of steps to execute"
        }
      },
      required: ["task", "steps"]
    },
    description: "Execute a complex browser automation sequence"
  },
  {
    name: "summarizePage",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "Optional URL of the page to summarize when the user explicitly gives one"
        },
        content: {
          type: Type.STRING,
          description: "Raw page text or pasted content to summarize when no URL is available"
        }
      }
    },
    description: "Summarize a web page from either its URL or provided page text"
  },
  {
    name: "getWeather",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "The city or location to get weather for (e.g., 'New York', 'London')"
        }
      },
      required: ["location"]
    },
    description: "Get current weather information for a specific location"
  },
  {
    name: "openNewTab",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The URL to open in a new tab"
        }
      },
      required: ["url"]
    },
    description: "Open a new browser tab with the specified URL"
  },
  {
    name: "closeCurrentTab",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Close the current active browser tab"
  },
  {
    name: "navigateTo",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The URL to navigate to in the current tab"
        }
      },
      required: ["url"]
    },
    description: "Navigate the current tab to a new URL"
  },
  {
    name: "goBack",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Go back to the previous page in the current tab"
  },
  {
    name: "goForward",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    },
    description: "Go forward to the next page in the current tab"
  }
];


const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: '1', name: 'Chrome', url: 'https://google.com', icon: 'LayoutGrid', color: '#4285F4', favicon: 'https://www.google.com/s2/favicons?domain=google.com&sz=256' },
  { id: '2', name: 'YouTube', url: 'https://youtube.com', icon: 'Youtube', color: '#FF0000', favicon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=256' },
  { id: '3', name: 'Discord', url: 'https://discord.com', icon: 'MessageSquare', color: '#5865F2', favicon: 'https://www.google.com/s2/favicons?domain=discord.com&sz=256' },
  { id: '4', name: 'Gmail', url: 'https://gmail.com', icon: 'Mail', color: '#EA4335', favicon: 'https://www.google.com/s2/favicons?domain=gmail.com&sz=256' },
  { id: '5', name: 'GitHub', url: 'https://github.com', icon: 'Github', color: '#ffffff', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=256' },
];

const MODE_COPY: Record<AppMode, { label: string; blurb: string }> = {
  [AppMode.STUDY]: {
    label: 'Deep Focus',
    blurb: 'Organize research, notes, and summaries without losing momentum.',
  },
  [AppMode.GAMING]: {
    label: 'Play Command',
    blurb: 'Pull guides, patch notes, and gaming shortcuts into one launch surface.',
  },
  [AppMode.DEVELOPER]: {
    label: 'Build Console',
    blurb: 'Keep your tools, code prompts, and debugging flow in a sharper workspace.',
  },
};
const BOOT_LINES = [
  'Initializing Brahma OS...',
  'Loading AI modules...',
  'Connecting systems...',
  'System Ready.',
];
const CONTEXT_HINTS = [
  { match: 'youtube.com', text: 'Want a summary of this video?', action: 'Summarize' },
  { match: 'github.com', text: 'Explain this repo?', action: 'Debug' },
  { match: 'medium.com', text: 'Create notes from this?', action: 'Summarize' },
  { match: 'wikipedia.org', text: 'Turn this into study notes?', action: 'Flashcards' },
];

const decodeHtml = (value?: string | null) => {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.documentElement.textContent || '').trim();
};

const formatNewsDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const parseNewsRss = (xmlText: string): NewsItem[] => {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  return Array.from(xml.querySelectorAll('item')).slice(0, 8).map((item) => ({
    title: decodeHtml(item.querySelector('title')?.textContent) || 'Untitled',
    link: item.querySelector('link')?.textContent?.trim() || '#',
    source: decodeHtml(item.querySelector('source')?.textContent) || 'Google News',
    pubDate: formatNewsDate(item.querySelector('pubDate')?.textContent),
    description: decodeHtml(item.querySelector('description')?.textContent),
  }));
};

const getStoredMode = (): AppMode => {
  try {
    const savedMode = localStorage.getItem('brahma-mode') as AppMode | null;
    if (savedMode && Object.values(AppMode).includes(savedMode)) return savedMode;
  } catch {}
  return AppMode.STUDY;
};

const getStoredAutoMode = (): boolean => {
  try {
    const saved = localStorage.getItem('brahma-auto-mode');
    return saved === null ? true : saved === 'true';
  } catch {}
  return true;
};

const getStoredThemeForMode = (mode: AppMode) => {
  try {
    const saved = localStorage.getItem(`brahma-theme-colors-${mode}`);
    if (saved) return JSON.parse(saved);
  } catch {}
  return MODE_THEMES[mode];
};

const getOnboardingDone = () => {
  try {
    return localStorage.getItem('onboarding_done') === 'true' || localStorage.getItem('onboarding_done') === '1';
  } catch {}
  return false;
};

const SHOW_SHIELD = false; // hide Shield UI when OS-only is desired

export default function App() {
const [mode, setMode] = useState<AppMode>(() => getStoredMode());
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [newSourceTitle, setNewSourceTitle] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceContent, setNewSourceContent] = useState('');
  const [archiveStatusMessage, setArchiveStatusMessage] = useState<string | null>(null);
  const [isCapturingSource, setIsCapturingSource] = useState(false);
  const [isCapturingSelection, setIsCapturingSelection] = useState(false);
  const [apiStatus, setApiStatus] = useState<'ready' | 'missing'>('missing');
  const [apiMessage, setApiMessage] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [showApiPrompt, setShowApiPrompt] = useState<boolean>(false);
  const [aiHealth, setAiHealth] = useState<'checking' | 'online' | 'error'>('checking');
  const [aiHealthMessage, setAiHealthMessage] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [folders, setFolders] = useState<ChatFolder[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachments, setChatAttachments] = useState<{ name: string; mime: string; data: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sequentialMode, setSequentialMode] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [isChatNavCollapsed, setIsChatNavCollapsed] = useState(true);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [isChatListening, setIsChatListening] = useState(false);
  const [showSettingsPage, setShowSettingsPage] = useState(false);
  const [autoMode, setAutoMode] = useState<boolean>(() => getStoredAutoMode());
  const [smartTips, setSmartTips] = useState<string[]>([]);
  const [focusAlert, setFocusAlert] = useState<string | null>(null);
  const [isFocusBlur, setIsFocusBlur] = useState(false);
  const [taskQueue, setTaskQueue] = useState<string[]>([]);
  const [isExecutingQueue, setIsExecutingQueue] = useState(false);
  const [userMemory, setUserMemory] = useState<string>('');
  const [vpnEnabled, setVpnEnabled] = useState(false);
  const [showNews, setShowNews] = useState(false);
  const [newsWorld, setNewsWorld] = useState<NewsItem[]>([]);
  const [newsIndia, setNewsIndia] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [shieldStatus, setShieldStatus] = useState<'OFF'|'CONNECTING'|'ACTIVE'>('OFF');
  const [shieldProxy, setShieldProxy] = useState<string>('none');
  const [showVpnModal, setShowVpnModal] = useState(false);
  const [shieldLocation, setShieldLocation] = useState<string>('Unknown');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => !getOnboardingDone());
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>(() => getOnboardingDone() ? 'complete' : 'boot');
  const [bootVisibleLines, setBootVisibleLines] = useState(0);
  const [tourStep, setTourStep] = useState(0);
  const [tourTypedText, setTourTypedText] = useState('');
  const [pendingModeSelection, setPendingModeSelection] = useState<AppMode>(() => getStoredMode());
  const [contextHint, setContextHint] = useState<{ text: string; action: string } | null>(null);
  const [modeReady, setModeReady] = useState(false);
  const sendShield = async (payload: any) => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      setShieldStatus('OFF');
      setShieldProxy('extension-required');
      return { ok: false, error: 'Not running as extension' };
    }
    try {
      return await chrome.runtime.sendMessage(payload);
    } catch (e) {
      console.warn('Shield message failed', e);
      return { ok: false, error: String(e) };
    }
  };
  const refreshShield = async () => {
    const res = await sendShield({ type: 'get-state' });
    if (res && res.state) {
      setShieldStatus(res.state.status);
      const proxy = res.proxies?.[res.state.currentIndex];
      setShieldProxy(proxy ? proxy.host : 'none');
    } else {
      setShieldStatus('OFF');
      setShieldProxy('none');
    }
  };


  // Check if running in sidebar mode
  const isSidebarMode = new URLSearchParams(window.location.search).get('sidebar') === 'true';

  // Shortcuts State - Load from localStorage or use defaults
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    try {
      const saved = localStorage.getItem('brahma-shortcuts');
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
    } catch (e) {
      return DEFAULT_SHORTCUTS;
    }
  });
  const [showAddShortcut, setShowAddShortcut] = useState(false);
  const [newShortcutName, setNewShortcutName] = useState('');
  const [newShortcutUrl, setNewShortcutUrl] = useState('');

  // Sidebar Toggles
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false); // Never open automatically
  const [currentSidebarTab, setCurrentSidebarTab] = useState<'main' | 'accessibility'>('main');

  // Theme and Background Customization
  const [customBackground, setCustomBackground] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState(() => getStoredThemeForMode(getStoredMode()));
  // Voice Recognition
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatSpeechRef = useRef<any>(null);
  const searchSurfaceRef = useRef<HTMLDivElement | null>(null);
  const quickActionStripRef = useRef<HTMLDivElement | null>(null);

  // System Monitoring States
  const [currentTime, setCurrentTime] = useState<string>('');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<number | null>(null);
  const [weather, setWeather] = useState<{ temp: number; description: string } | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const applyMode = (m: AppMode) => {
    setMode(m);
    const palette = getStoredThemeForMode(m);
    setThemeColors(palette);
    try { localStorage.setItem('brahma-mode', m); } catch {}
    try { chrome.storage?.local?.set?.({ 'brahma-mode': m }); } catch {}
    const tips = MODE_BEHAVIORS[m]?.suggestions || [];
    setSmartTips(tips.slice(0, 3));
    // notify shield background
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'set-mode', mode: m }).catch(() => {});
    }
  };

  const enqueueTasks = (steps: string[]) => {
    if (steps.length === 0) return;
    setTaskQueue(steps);
    runTaskQueue(steps);
  };

  const runTaskQueue = async (queue: string[]) => {
    if (queue.length === 0) {
      setTaskQueue([]);
      setIsExecutingQueue(false);
      return;
    }
    setIsExecutingQueue(true);
    const [current, ...rest] = queue;
    const lower = current.toLowerCase().trim();

    const openMatch = lower.match(/open\s+(.+)/) || lower.match(/launch\s+(.+)/);
    if (openMatch) {
      const name = openMatch[1].trim();
      const shortcut = resolveShortcut(name);
      if (shortcut) {
        appendMessages([{ role: 'model', content: `Opening ${shortcut.name}...` }]);
        openUrl(shortcut.url);
      } else {
        appendMessages([{ role: 'model', content: `I couldn't find "${name}" in shortcuts. Add it first.` }]);
      }
    } else if (lower.startsWith('summarize')) {
      triggerTool('Summarize');
    } else if (lower.startsWith('flashcard') || lower.includes('flashcard')) {
      triggerTool('Flashcards');
    } else if (lower.includes('debug') || lower.includes('fix')) {
      triggerTool('Debug');
    } else {
      appendMessages([{ role: 'model', content: `Queued step: ${current}` }]);
    }

    setTimeout(() => runTaskQueue(rest), 700);
  };

  // auto-detect context from hostname and switch mode when enabled
  useEffect(() => {
    if (!modeReady) return;
    let lastHost = window.location.hostname;
    const detect = () => {
      const host = window.location.hostname;

      // auto mode switch
      if (autoMode) {
        const match = (Object.keys(MODE_BEHAVIORS) as AppMode[]).find(m => MODE_BEHAVIORS[m].hosts.some(h => host.includes(h)));
        if (match && match !== mode) {
          applyMode(match);
        }
      }

      if (host === lastHost) return;
      lastHost = host;

      // focus rules per mode
      const behavior = MODE_BEHAVIORS[mode];
      if (mode === AppMode.STUDY && behavior.distractions?.some(h => host.includes(h))) {
        setFocusAlert("Focus Shield: distracting site detected. Switch to a study-friendly resource?");
        setIsFocusBlur(true);
      } else if (mode === AppMode.GAMING && behavior.workHosts?.some(h => host.includes(h))) {
        setFocusAlert("Gaming Mode: work site detected. Want to switch to Dev mode?");
        setIsFocusBlur(false);
      } else {
        setFocusAlert(null);
        setIsFocusBlur(false);
      }
    };
    const id = window.setInterval(detect, 2000);
    detect();
    return () => clearInterval(id);
  }, [autoMode, mode, modeReady]);

  // poll shield state
  useEffect(() => {
    refreshShield();
    const id = setInterval(refreshShield, 4000);
    return () => clearInterval(id);
  }, []);

  // fetch location when shield active
  useEffect(() => {
    if (shieldStatus !== 'ACTIVE') return;
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        if (d && d.city) setShieldLocation(`${d.city}, ${d.country_name || d.country || ''}`);
        else setShieldLocation('Updated');
      })
      .catch(() => setShieldLocation('Unknown'));
  }, [shieldStatus]);

  useEffect(() => {
    if (!showNews) return;
    const fetchNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const [worldRes, indiaRes] = await Promise.all([
          fetch('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en', { cache: 'no-store' }),
          fetch('https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en', { cache: 'no-store' }),
        ]);

        if (!worldRes.ok || !indiaRes.ok) {
          throw new Error('News feeds unavailable');
        }

        const [worldXml, indiaXml] = await Promise.all([worldRes.text(), indiaRes.text()]);
        const worldItems = parseNewsRss(worldXml);
        const indiaItems = parseNewsRss(indiaXml);

        if (!worldItems.length && !indiaItems.length) {
          throw new Error('No news items found');
        }

        setNewsWorld(worldItems);
        setNewsIndia(indiaItems);
      } catch (err: any) {
        setNewsError('Could not load news right now. Please try again in a moment.');
      } finally {
        setNewsLoading(false);
      }
    };
    fetchNews();
  }, [showNews]);

  // Persist notes and background so UX survives reloads
  useEffect(() => {
    try {
      const savedNotes = localStorage.getItem('brahma-notes');
      if (savedNotes) setNotes(JSON.parse(savedNotes));
    } catch {}
  }, []);

  useEffect(() => {
    applyMode(getStoredMode());
    setAutoMode(getStoredAutoMode());
    setModeReady(true);
    try {
      const savedKey = localStorage.getItem('brahma-user-api-key');
      if (savedKey) {
        setUserApiKey(savedKey);
        setShowApiPrompt(false);
      } else {
        setUserApiKey('');
        setShowApiPrompt(true);
      }
    } catch {}

    try {
      const savedMem = localStorage.getItem('brahma-user-memory');
      if (savedMem) setUserMemory(savedMem);
    } catch {}

    try {
      const savedVpn = localStorage.getItem('brahma-vpn');
      if (savedVpn) setVpnEnabled(savedVpn === 'true');
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('brahma-chat-sessions');
      const savedFolders = localStorage.getItem('brahma-chat-folders');
      const savedActive = localStorage.getItem('brahma-active-chat');
      if (savedFolders) setFolders(JSON.parse(savedFolders));

      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as ChatSession[];
        if (parsed.length === 0) {
          const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
          setChatSessions([seed]);
          setActiveSessionId(seed.id);
        } else {
          setChatSessions(parsed);
          setActiveSessionId(savedActive || parsed[0].id);
        }
      } else {
        const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
        setChatSessions([seed]);
        setActiveSessionId(seed.id);
      }
    } catch {
      const seed: ChatSession = { id: Date.now().toString(), title: 'Chat 1', messages: [], createdAt: Date.now() };
      setChatSessions([seed]);
      setActiveSessionId(seed.id);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-chat-sessions', JSON.stringify(chatSessions));
      if (activeSessionId) localStorage.setItem('brahma-active-chat', activeSessionId);
      localStorage.setItem('brahma-chat-folders', JSON.stringify(folders));
    } catch {}
  }, [chatSessions, activeSessionId, folders]);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-notes', JSON.stringify(notes));
    } catch {}
  }, [notes]);

  useEffect(() => {
    try {
      const savedBg = localStorage.getItem('brahma-wallpaper');
      if (savedBg) setCustomBackground(savedBg);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (customBackground) {
        localStorage.setItem('brahma-wallpaper', customBackground);
      } else {
        localStorage.removeItem('brahma-wallpaper');
      }
    } catch {}
  }, [customBackground]);

  // Save shortcuts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('brahma-shortcuts', JSON.stringify(shortcuts));
  }, [shortcuts]);

  // persist theme colors
  useEffect(() => {
    try {
      localStorage.setItem(`brahma-theme-colors-${mode}`, JSON.stringify(themeColors));
    } catch {}
  }, [mode, themeColors]);

  // persist auto-mode flag
  useEffect(() => {
    try { localStorage.setItem('brahma-auto-mode', String(autoMode)); } catch {}
    try { chrome.storage?.local?.set?.({ 'brahma-auto-mode': autoMode }); } catch {}
  }, [autoMode]);

  // persist user memory
  useEffect(() => {
    try { localStorage.setItem('brahma-user-memory', userMemory); } catch {}
  }, [userMemory]);

  useEffect(() => {
    try {
      localStorage.setItem('brahma-vpn', String(vpnEnabled));
    } catch {}
  }, [vpnEnabled]);

  // Clock Effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Battery Status Effect
  useEffect(() => {
    const getBatteryStatus = async () => {
      try {
        const battery = await (navigator as any).getBattery?.() || (navigator as any).battery;
        if (battery) {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener?.('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        }
      } catch (e) {
        console.log('Battery API not available');
      }
    };
    getBatteryStatus();
  }, []);

  // Memory Usage Effect
  useEffect(() => {
    const getMemoryUsage = () => {
      try {
        if ((performance as any).memory) {
          const used = (performance as any).memory.usedJSHeapSize;
          const limit = (performance as any).memory.jsHeapSizeLimit;
          const percentage = Math.round((used / limit) * 100);
          setMemoryUsage(percentage);
        }
      } catch (e) {
        console.log('Memory API not available');
      }
    };
    getMemoryUsage();
    const interval = setInterval(getMemoryUsage, 5000);
    return () => clearInterval(interval);
  }, []);

  // Geolocation and Weather Effect
  useEffect(() => {
    const getLocationAndWeather = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            setLocation({ lat: latitude, lng: longitude });

            try {
              const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
              );
              const data = await response.json();
              if (data.current) {
                const weatherDescriptions: { [key: number]: string } = {
                  0: 'Clear',
                  1: 'Cloudy',
                  2: 'Overcast',
                  3: 'Overcast',
                  45: 'Foggy',
                  48: 'Foggy',
                  51: 'Light Drizzle',
                  53: 'Moderate Drizzle',
                  55: 'Heavy Drizzle',
                  61: 'Slight Rain',
                  63: 'Moderate Rain',
                  65: 'Heavy Rain',
                  71: 'Slight Snow',
                  73: 'Moderate Snow',
                  75: 'Heavy Snow',
                  80: 'Rain Showers',
                  81: 'Rain Showers',
                  82: 'Heavy Rain Showers',
                  85: 'Snow Showers',
                  86: 'Heavy Snow Showers',
                  95: 'Thunderstorm',
                  96: 'Thunderstorm with Hail',
                  99: 'Thunderstorm with Hail',
                };
                setWeather({
                  temp: Math.round(data.current.temperature_2m),
                  description: weatherDescriptions[data.current.weather_code] || 'Unknown'
                });
              }
            } catch (error) {
              console.log('Weather API error:', error);
            }
          },
          (error) => {
            console.log('Geolocation error:', error);
          }
        );
      }
    };
    getLocationAndWeather();
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setQuery(transcript);
        setIsListening(false);
        handleSearch(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      // chat speech recognition instance
      chatSpeechRef.current = new SpeechRecognition();
      chatSpeechRef.current.continuous = false;
      chatSpeechRef.current.interimResults = false;
      chatSpeechRef.current.lang = 'en-US';
      chatSpeechRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsChatListening(false);
      };
      chatSpeechRef.current.onerror = () => setIsChatListening(false);
      chatSpeechRef.current.onend = () => setIsChatListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Automation Log
  const [automationLogs, setAutomationLogs] = useState<{ id: string, text: string, status: 'pending' | 'success' | 'error' }[]>([]);

  const aiRef = useRef<GoogleGenAI | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const resolveShortcut = (nameRaw: string) => {
    const name = nameRaw.toLowerCase();
    const aliasMap: Record<string, string> = {
      yt: 'youtube',
      youtube: 'youtube',
      discord: 'discord',
      dc: 'discord',
      mail: 'gmail',
      gmail: 'gmail',
      gh: 'github',
      github: 'github'
    };
    const normalized = aliasMap[name] || name;
    return shortcuts.find(s => {
      const n = s.name.toLowerCase();
      return n === normalized || n.includes(normalized) || normalized.includes(n);
    });
  };

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || null;
  const activeMessages: ChatMessage[] = activeSession?.messages || [];

  const setChatMessages = (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    if (!activeSession) return;
    setChatSessions(prev =>
      prev.map(s => {
        if (s.id !== activeSession.id) return s;
        const nextMessages = typeof updater === 'function' ? (updater as any)(s.messages) : updater;
        return { ...s, messages: nextMessages };
      })
    );
  };

  const appendMessages = (msgs: ChatMessage[]) => {
    if (!activeSession) {
      // Auto-bootstrap a session if something wiped it out.
      const seed: ChatSession = { id: Date.now().toString(), title: `Chat ${chatSessions.length + 1 || 1}`, messages: [], createdAt: Date.now() };
      setChatSessions(prev => [...prev, seed]);
      setActiveSessionId(seed.id);
      return;
    }
    setChatSessions(prev =>
      prev.map(s => s.id === activeSession.id ? { ...s, messages: [...s.messages, ...msgs] } : s)
    );
  };

  useEffect(() => {
    if (!activeSessionId && chatSessions.length > 0) {
      setActiveSessionId(chatSessions[0].id);
    }
  }, [chatSessions, activeSessionId]);

  const deleteSession = (id: string) => {
    setChatSessions(prev => prev.filter(s => s.id !== id));
    if (activeSessionId === id) {
      const remaining = chatSessions.filter(s => s.id !== id);
      setActiveSessionId(remaining[0]?.id ?? null);
    }
  };

  const moveSessionToFolder = (sessionId: string, folderId: string | null) => {
    setChatSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId: folderId || undefined } : s));
  };

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSession: ChatSession = { id, title: `Chat ${chatSessions.length + 1}`, messages: [], createdAt: Date.now() };
    setChatSessions(prev => [...prev, newSession]);
    setActiveSessionId(id);
  };

  const createNewFolder = () => {
    const name = prompt('Folder name?');
    if (!name || !name.trim()) return;
    const folder: ChatFolder = { id: Date.now().toString(), name: name.trim() };
    setFolders(prev => [...prev, folder]);
  };

  const speakText = (text: string) => {
    if (!speakEnabled || typeof window === 'undefined' || !(window as any).speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    (window as any).speechSynthesis.cancel();
    (window as any).speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const sc = chatScrollRef.current;
    if (sc) {
      sc.scrollTo({ top: sc.scrollHeight, behavior: 'smooth' });
    }
  }, [activeSessionId, chatSessions, isChatLoading]);

  useEffect(() => {
    const key = localStorage.getItem('brahma-user-api-key') || userApiKey;
    if (key) {
      aiRef.current = new GoogleGenAI({ apiKey: key });
      setApiStatus('ready');
      setApiMessage(null);
      setAiHealth('online');
      setAiHealthMessage(null);
    } else {
      setApiStatus('missing');
      setApiMessage('Enter your Gemini API key to start.');
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      setShowApiPrompt(true);
    }

    // Chrome Extension Message Listener
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (request: any) => {
        if (request.action === 'BRAHMA_SUMMARIZE') {
          handleAgentChat(undefined, `Summarize this page content: ${request.text}`);
        } else if (request.action === 'BRAHMA_EXPLAIN') {
          handleAgentChat(undefined, `Explain this selected text: ${request.text}`);
        } else if (request.action === 'BRAHMA_OPTIMIZE') {
          handleAgentChat(undefined, `Rewrite and improve this text clearly: ${request.text}`);
        } else if (request.action === 'BRAHMA_TRANSLATE') {
          handleAgentChat(undefined, `Translate this text and preserve its meaning: ${request.text}`);
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, [userApiKey]);



  const openUrl = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const pingModel = async () => {
    if (!aiRef.current) return;
    try {
      setAiHealth('checking');
      await aiRef.current.models.generateContent({
        model: GENAI_MODEL,
        contents: 'health check',
        config: { maxOutputTokens: 1 }
      });
      setAiHealth('online');
      setAiHealthMessage(null);
    } catch (err: any) {
      setAiHealth('error');
      setAiHealthMessage(parseGenAiError(err).message);
    }
  };

  const buildContext = () => {
    const stats = [`Mode: ${mode}`];
    if (currentTime) stats.push(`Local time: ${currentTime}`);
    if (weather) stats.push(`Weather: ${weather.temp}°C ${weather.description}`);
    if (batteryLevel !== null) stats.push(`Battery: ${batteryLevel}%`);
    if (memoryUsage !== null) stats.push(`Memory usage: ${memoryUsage}%`);
    const shortcutsList = shortcuts.slice(0, 6).map(s => s.name).join(', ') || 'none';
    const noteList = notes.slice(0, 3).map(n => n.title || 'Untitled').join(' | ') || 'none';
    const mem = userMemory ? `User memory: ${userMemory}` : 'User memory: none yet.';
    return `Environment -> ${stats.join(' | ')}. Shortcuts: ${shortcutsList}. Notes: ${noteList}. ${mem}`;
  };

  const buildInstruction = () => {
    const base = {
      [AppMode.STUDY]: "Be a practical learning coach. Default to concise replies (<=80 words) unless the user explicitly asks for more. Offer 1-2 key points and 1 actionable next step.",
      [AppMode.GAMING]: "Be an esports analyst. Keep it concise (<=80 words). Give the single best strategy or weakness and a short execution plan.",
      [AppMode.DEVELOPER]: "Be a senior engineer. Keep answers short (<=80 words) unless asked to elaborate. Provide direct fixes or code snippets with minimal filler."
    }[mode];

    return `${base}
Guidelines: 
- Stay under ~80 words unless the user says 'long' or 'detailed'.
- Answer directly; avoid greeting-only replies.
- Use bullets only when they add clarity.
- If user just greets, give a friendly 1-liner plus a quick question to move forward.
- If uncertain, state assumptions briefly.`;
  };

  const parseGenAiError = (err: any): { message: string; quota: boolean } => {
    const msg = err?.message || '';
    if (msg.toLowerCase().includes('resource_exhausted') || msg.toLowerCase().includes('quota')) {
      return { message: 'Gemini quota exceeded for this API key. Add billing or wait for reset.', quota: true };
    }
    return { message: msg || 'Connection failed.', quota: false };
  };

  const handleSearch = async (customQuery?: string) => {
    const finalQuery = customQuery || query;
    if (!finalQuery.trim()) return;

    // If it's a normal search (not starting with / or specifically for Brahma)
    // and it doesn't look like a question, we can offer Google search.
    // But the user said "like a normal searchbar", so let's make it a Google search by default
    // and use the Sparkles button for Brahma.
    
    const isBrahmaQuery = finalQuery.startsWith('/') || finalQuery.toLowerCase().includes('brahma');
    
    if (!isBrahmaQuery && !customQuery) {
      window.open(`https://www.google.com/search?q=${encodeURIComponent(finalQuery)}`, '_blank');
      return;
    }

    if (!aiRef.current) {
      setAiResponse({
        content: apiMessage || "Gemini API key is missing. Add VITE_GEMINI_API_KEY in your .env and reload.",
        type: 'general'
      });
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      return;
    }

    setIsLoading(true);
    setAiResponse(null);
    try {
      const context = buildContext();
      const systemInstruction = buildInstruction();

      const runModel = async (model: string) => {
        return aiRef.current!.models.generateContent({
          model,
          contents: [
            ...chatAttachments.map(a => ({
              inlineData: { mimeType: a.mime, data: a.data }
            })),
            finalQuery
          ],
          config: { 
            systemInstruction: `${systemInstruction}
Context: ${context}
Keep the answer tight and natural; only add structure if user asks.`,
            temperature: 0.4,
            maxOutputTokens: 256
          }
        });
      };

      let response;
      try {
        response = await runModel(GENAI_MODEL);
      } catch (err: any) {
        const parsed = parseGenAiError(err);
        if (parsed.quota) {
          response = await runModel(FALLBACK_MODEL);
        } else {
          throw err;
        }
      }

      setAiResponse({
        content: response.text || "No response generated.",
        type: mode === AppMode.STUDY ? 'summary' : mode === AppMode.GAMING ? 'strategy' : 'code'
      });
      setAiHealth('online');
      setAiHealthMessage(null);
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiHealth('error');
      const parsed = parseGenAiError(error);
      setAiHealthMessage(parsed.message);
      if (parsed.quota) setShowApiPrompt(true);
      setAiResponse({ content: parsed.message || "Error connecting to Brahma Core. Please check your connection.", type: 'general' });
    } finally {
      setIsLoading(false);
    }
  };

  const addNote = () => {
    if (!newNoteTitle.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      title: newNoteTitle,
      content: aiResponse?.content || '',
      timestamp: Date.now(),
      kind: 'note',
      useForAgent: true,
    };
    setNotes([note, ...notes]);
    setNewNoteTitle('');
    setShowNotes(true);
  };

  const addArchiveSource = () => {
    const title = newSourceTitle.trim();
    const rawUrl = newSourceUrl.trim();
    const content = newSourceContent.trim();
    if (!title || (!rawUrl && !content)) return;

    let sourceUrl = rawUrl;
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      sourceUrl = `https://${sourceUrl}`;
    }

    const source: Note = {
      id: `${Date.now()}-source`,
      title,
      content,
      sourceUrl,
      timestamp: Date.now(),
      kind: 'source',
      useForAgent: true,
    };

    setNotes([source, ...notes]);
    setNewSourceTitle('');
    setNewSourceUrl('');
    setNewSourceContent('');
    setArchiveStatusMessage(`Saved "${title}" to Neural Archive.`);
  };

  const saveCurrentPageAsSource = async () => {
    setArchiveStatusMessage(null);
    setIsCapturingSource(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.scripting?.executeScript) {
        throw new Error('This feature works only inside the extension.');
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const normalTabs = tabs
        .filter((tab) => tab.id && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url))
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      const candidate = normalTabs.find((tab) => tab.active) || normalTabs[0];
      if (!candidate?.id || !candidate.url) {
        throw new Error('Open a normal website tab first, then try again.');
      }

      const injected = await chrome.scripting.executeScript({
        target: { tabId: candidate.id },
        func: () => {
          const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
          const root = document.querySelector('main, article, [role="main"]') || document.body;
          const text = clean((root as HTMLElement)?.innerText || document.body?.innerText || '');
          return {
            title: document.title || window.location.hostname,
            url: window.location.href,
            content: text.slice(0, 12000),
          };
        },
      });

      const payload = injected?.[0]?.result as { title?: string; url?: string; content?: string } | undefined;
      if (!payload?.title || !payload?.url) {
        throw new Error('Could not read the current page.');
      }

      const source: Note = {
        id: `${Date.now()}-page-source`,
        title: payload.title,
        sourceUrl: payload.url,
        content: payload.content || '',
        timestamp: Date.now(),
        kind: 'source',
        useForAgent: true,
      };

      setNotes((prev) => [source, ...prev]);
      setArchiveStatusMessage(`Saved current page: ${payload.title}`);
    } catch (error: any) {
      setArchiveStatusMessage(error?.message || 'Could not save the current page.');
    } finally {
      setIsCapturingSource(false);
    }
  };

  const saveSelectedTextAsSource = async () => {
    setArchiveStatusMessage(null);
    setIsCapturingSelection(true);
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.scripting?.executeScript) {
        throw new Error('This feature works only inside the extension.');
      }

      const tabs = await chrome.tabs.query({ currentWindow: true });
      const normalTabs = tabs
        .filter((tab) => tab.id && typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url))
        .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

      const candidate = normalTabs.find((tab) => tab.active) || normalTabs[0];
      if (!candidate?.id || !candidate.url) {
        throw new Error('Open a normal website tab first, then select some text.');
      }

      const injected = await chrome.scripting.executeScript({
        target: { tabId: candidate.id },
        func: () => {
          const clean = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();
          const selection = clean(window.getSelection?.()?.toString() || '');
          return {
            title: document.title || window.location.hostname,
            url: window.location.href,
            selection: selection.slice(0, 12000),
          };
        },
      });

      const payload = injected?.[0]?.result as { title?: string; url?: string; selection?: string } | undefined;
      if (!payload?.selection) {
        throw new Error('No text is selected on the page right now.');
      }

      const source: Note = {
        id: `${Date.now()}-selection-source`,
        title: `Selection from ${payload.title || 'page'}`,
        sourceUrl: payload.url,
        content: payload.selection,
        timestamp: Date.now(),
        kind: 'source',
        useForAgent: true,
      };

      setNotes((prev) => [source, ...prev]);
      setArchiveStatusMessage(`Saved selected text from ${payload.title || 'page'}`);
    } catch (error: any) {
      setArchiveStatusMessage(error?.message || 'Could not save selected text.');
    } finally {
      setIsCapturingSelection(false);
    }
  };

  const deleteNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  const toggleNoteForAgent = (id: string) => {
    setNotes(notes.map((n) => n.id === id ? { ...n, useForAgent: !(n.useForAgent !== false) } : n));
  };



  const addShortcut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShortcutName.trim() || !newShortcutUrl.trim()) return;
    
    let url = newShortcutUrl.trim();
    if (!url.startsWith('http')) url = `https://${url}`;

    // Extract domain for favicon
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;

    const newS: Shortcut = {
      id: Date.now().toString(),
      name: newShortcutName,
      url: url,
      icon: 'ExternalLink',
      color: '#ffffff',
      favicon: faviconUrl
    };

    setShortcuts([...shortcuts, newS]);
    setNewShortcutName('');
    setNewShortcutUrl('');
    setShowAddShortcut(false);
  };

  const deleteShortcut = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShortcuts(shortcuts.filter(s => s.id !== id));
  };

  const handleShortcutClick = (s: Shortcut) => {
    // Proactive Suggestion Logic
    if (s.name.toLowerCase() === 'github' && mode !== AppMode.DEVELOPER) {
      appendMessages([{ 
        role: 'model', 
        content: `I noticed you opened GitHub. Would you like me to switch the system to **Developer Mode** for optimized performance?` 
      }]);
      setIsRightSidebarOpen(true);
    } else if (s.name.toLowerCase() === 'youtube' && mode !== AppMode.GAMING) {
      appendMessages([{ 
        role: 'model', 
        content: `Accessing YouTube. Should I initialize **Gaming/Media Mode** to prioritize bandwidth?` 
      }]);
      setIsRightSidebarOpen(true);
    }
  };

  const triggerTool = (tool: string) => {
    let q = "";
    if (tool === 'Summarize') q = "Please summarize the current topic in detail.";
    if (tool === 'Flashcards') q = "Generate 5 flashcards for the current topic.";
    if (tool === 'ExplainSimple') q = "Explain the selected content like I'm 12, in 5 bullet points.";
    if (tool === 'Quiz') q = "Create a 5 question quiz on the current topic.";
    if (tool === 'Strategy') q = "What is the best strategy for this game/boss?";
    if (tool === 'Debug') q = "Analyze this code for bugs and suggest fixes.";
    if (tool === 'APITest') q = "Provide a quick REST call example (curl) for the current API endpoint.";
    if (tool === 'SummarizeURL') q = "Please summarize the content of a web page. I will provide the URL.";
    
    if (q) {
      handleAgentChat(undefined, q);
    }
  };

  const handleAgentChat = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    const inputToUse = overrideInput || chatInput;
    if (!inputToUse.trim()) return;
    if (!aiRef.current) {
      appendMessages([{ role: 'model', content: apiMessage || "Gemini API key is missing. Add VITE_GEMINI_API_KEY in your .env and reload." }]);
      setAiHealth('error');
      setAiHealthMessage('Missing API key.');
      return;
    }

    // memory commands
    if (inputToUse.startsWith('/remember ')) {
      const note = inputToUse.replace('/remember ', '').trim();
      if (note) {
        setUserMemory(prev => (prev ? `${prev} | ${note}` : note));
        appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Saved to memory.' }]);
      }
      if (!overrideInput) setChatInput('');
      return;
    }
    if (inputToUse === '/memclear') {
      setUserMemory('');
      appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Memory cleared.' }]);
      if (!overrideInput) setChatInput('');
      return;
    }

    // If multi-step command with "then", enqueue tasks and short-circuit
    if (inputToUse.toLowerCase().includes(' then ')) {
      const steps = inputToUse.split(/then/ig).map(s => s.trim()).filter(Boolean);
      enqueueTasks(steps);
      appendMessages([{ role: 'user', content: inputToUse }, { role: 'model', content: 'Queued tasks: ' + steps.join(' → ') }]);
      if (!overrideInput) setChatInput('');
      return;
    }

    const userMsg = inputToUse;
    if (!overrideInput) setChatInput('');
    const newUserMsg: ChatMessage = { role: 'user', content: userMsg };
    appendMessages([newUserMsg]);
    setIsChatLoading(true);
    setIsRightSidebarOpen(true);

    try {
      const context = buildContext();
      const persona = buildInstruction();
      const buildChat = (model: string) => aiRef.current!.chats.create({
        model,
        config: {
          systemInstruction: `You are BRAHMA, an ultra-intelligent AI browser agent with Opera GX vibes. ${persona}
You can perform browser tasks:
- Real-time weather
- Open/close/navigate tabs
- Switch modes (Study, Gaming, Developer)
- Open shortcuts & search web
- Execute automation sequences
- Summarize web pages
When a user asks for weather, use getWeather. For navigation use openNewTab, navigateTo, goBack, goForward, closeCurrentTab. Always log actions to Automation Log. Only use summarizePage when you need structured summarization and you already have either a URL or page text. If the user already pasted page text or the current context contains page content, summarize that directly instead of asking for a URL.

Current context: ${context}
${sequentialMode ? `Sequential mode is ON: 
- First produce a numbered plan (max 6 concise steps).
- Then execute steps one by one using available tools; log each step and progress.
- Keep overall text <=80 words per turn; focus on progress updates.` : ''}
Respond concisely (<=80 words by default). Avoid filler greetings; answer the user's intent directly. Use bullets only when they add clarity. If user greets, reply with one friendly line and a follow-up question.`,
          temperature: 0.35,
          maxOutputTokens: 256,
          tools: [
            { functionDeclarations: browserTools }
          ]
        },
        history: activeMessages.map(m => ({ role: m.role, parts: [{ text: m.content }] }))
      });

      let chat = buildChat(GENAI_MODEL);
      let result;

      const runWithAttachments = async (model: string) => {
        const contents: any[] = [
          ...chatAttachments.map(a => ({ inlineData: { mimeType: a.mime, data: a.data } })),
          { text: userMsg }
        ];
        const resp = await aiRef.current!.models.generateContent({
          model,
          contents
        });
        return resp;
      };

      try {
        if (chatAttachments.length > 0) {
          result = await runWithAttachments(GENAI_MODEL);
        } else {
          result = await chat.sendMessage({ message: userMsg });
        }
      } catch (err: any) {
        const parsed = parseGenAiError(err);
        if (parsed.quota) {
          if (chatAttachments.length > 0) {
            result = await runWithAttachments(FALLBACK_MODEL);
          } else {
            chat = buildChat(FALLBACK_MODEL);
            result = await chat.sendMessage({ message: userMsg });
          }
        } else {
          throw err;
        }
      }
      
      // Handle Function Calls
      if (result.functionCalls) {
        for (const call of result.functionCalls) {
          const logId = Date.now().toString() + Math.random();
          
          if (call.name === 'switchMode') {
            const newMode = (call.args as any).mode as AppMode;
            applyMode(newMode);
                  setAutomationLogs(prev => [{ id: logId, text: `Switching environment to ${newMode}...`, status: 'success' }, ...prev]);
                  appendMessages([{ role: 'model', content: `Environment reconfigured to ${newMode} mode.` }]);
          } 
          else if (call.name === 'openShortcut') {
            const name = (call.args as any).name;
            const shortcut = shortcuts.find(s => s.name.toLowerCase() === name.toLowerCase());
            if (shortcut) {
              openUrl(shortcut.url);
              setAutomationLogs(prev => [{ id: logId, text: `Navigating to ${shortcut.name}...`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Neural link established with ${shortcut.name}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Shortcut "${name}" not found in neural database. Use the 'Add' button to initialize it.` }]);
            }
          }
          else if (call.name === 'searchWeb') {
            const sQuery = (call.args as any).query;
            setAutomationLogs(prev => [{ id: logId, text: `Searching web for: ${sQuery}...`, status: 'pending' }, ...prev]);
            
            const searchResult = await aiRef.current.models.generateContent({
              model: GENAI_MODEL,
              contents: `Search the web for: ${sQuery} and provide a summary of how to access it or what it is.`
            });
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: searchResult.text || `Search completed for ${sQuery}.` }]);
          }
          else if (call.name === 'executeAutomation') {
            const { task, steps } = call.args as any;
            setAutomationLogs(prev => [{ id: logId, text: `Executing Automation: ${task}`, status: 'pending' }, ...prev]);
            
            // Simulate steps
            for (const step of steps) {
              await new Promise(r => setTimeout(r, 800));
              setAutomationLogs(prev => [{ id: Math.random().toString(), text: `> ${step}`, status: 'success' }, ...prev]);
            }
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: `Task "${task}" has been processed through the automation engine.` }]);
          }
          else if (call.name === 'summarizePage') {
            const url = ((call.args as any).url || '').trim();
            const content = ((call.args as any).content || '').trim();
            const sourceLabel = url || (content ? 'provided page content' : 'current context');
            setAutomationLogs(prev => [{ id: logId, text: `Summarizing ${sourceLabel}...`, status: 'pending' }, ...prev]);
            
            const summaryResult = await aiRef.current.models.generateContent({
              model: GENAI_MODEL,
              contents: url
                ? `Summarize the content of this page: ${url}`
                : `Summarize this page content clearly and concisely:\n\n${content || context}`
            });
            
            setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
            appendMessages([{ role: 'model', content: summaryResult.text || `Summary completed for ${sourceLabel}.` }]);
          }
          else if (call.name === 'getWeather') {
            const location = (call.args as any).location;
            setAutomationLogs(prev => [{ id: logId, text: `Fetching weather for ${location}...`, status: 'pending' }, ...prev]);
            
            try {
              // First, geocode the location to get lat/lng
              const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
              const geoData = await geoResponse.json();
              
              if (geoData.results && geoData.results[0]) {
                const { latitude, longitude, name } = geoData.results[0];
                
                const weatherResponse = await fetch(
                  `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=celsius`
                );
                const weatherData = await weatherResponse.json();
                
                if (weatherData.current) {
                  const weatherDescriptions: { [key: number]: string } = {
                    0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
                    45: 'Fog', 48: 'Depositing rime fog',
                    51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
                    61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
                    71: 'Slight snow fall', 73: 'Moderate snow fall', 75: 'Heavy snow fall',
                    80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
                    85: 'Slight snow showers', 86: 'Heavy snow showers',
                    95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
                  };
                  
                  const temp = Math.round(weatherData.current.temperature_2m);
                  const desc = weatherDescriptions[weatherData.current.weather_code] || 'Unknown';
                  
                  setAutomationLogs(prev => prev.map(l => l.id === logId ? { ...l, status: 'success' } : l));
                  appendMessages([{ role: 'model', content: `Weather in ${name}: ${temp}°C, ${desc}.` }]);
                } else {
                  appendMessages([{ role: 'model', content: `Unable to fetch weather data for ${location}.` }]);
                }
              } else {
                appendMessages([{ role: 'model', content: `Location "${location}" not found.` }]);
              }
            } catch (error) {
              console.error('Weather fetch error:', error);
              appendMessages([{ role: 'model', content: `Error fetching weather for ${location}.` }]);
            }
          }
          else if (call.name === 'openNewTab') {
            const url = (call.args as any).url;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url });
              setAutomationLogs(prev => [{ id: logId, text: `Opening new tab: ${url}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `New tab opened with ${url}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot open new tab in this environment.` }]);
            }
          }
          else if (call.name === 'closeCurrentTab') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs[0] && tabs[0].id) {
                chrome.tabs.remove(tabs[0].id);
                setAutomationLogs(prev => [{ id: logId, text: `Closing current tab`, status: 'success' }, ...prev]);
                  appendMessages([{ role: 'model', content: `Current tab closed.` }]);
              }
            });
          } else {
              appendMessages([{ role: 'model', content: `Cannot close tab in this environment.` }]);
            }
          }
          else if (call.name === 'navigateTo') {
            const url = (call.args as any).url;
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.update) {
              chrome.tabs.update({ url });
              setAutomationLogs(prev => [{ id: logId, text: `Navigating to ${url}`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Navigating to ${url}.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot navigate in this environment.` }]);
            }
          }
          else if (call.name === 'goBack') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.goBack) {
              chrome.tabs.goBack();
              setAutomationLogs(prev => [{ id: logId, text: `Going back`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Went back to previous page.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot go back in this environment.` }]);
            }
          }
          else if (call.name === 'goForward') {
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.goForward) {
              chrome.tabs.goForward();
              setAutomationLogs(prev => [{ id: logId, text: `Going forward`, status: 'success' }, ...prev]);
              appendMessages([{ role: 'model', content: `Went forward to next page.` }]);
            } else {
              appendMessages([{ role: 'model', content: `Cannot go forward in this environment.` }]);
            }
          }
        }
      } else {
        const contentText = result.text || "I'm standing by for your next command.";
        const botMsg: ChatMessage = { role: 'model', content: contentText };
        appendMessages([botMsg]);
        speakText(contentText);
      }
      setAiHealth('online');
      setAiHealthMessage(null);
    } catch (error: any) {
      console.error("Agent Error:", error);
      setAiHealth('error');
      const friendly = parseGenAiError(error);
      setAiHealthMessage(friendly.message);
      if (friendly.quota) setShowApiPrompt(true);
      const botMsg: ChatMessage = { role: 'model', content: friendly.message || "Error communicating with Brahma Agent Core." };
      appendMessages([{ role: 'user', content: userMsg }, botMsg]);
    } finally {
      setIsChatLoading(false);
      setChatAttachments([]);
    }
  };

  const getThemeClass = () => {
    switch (mode) {
      case AppMode.STUDY: return 'theme-study';
      case AppMode.GAMING: return 'theme-gaming';
      case AppMode.DEVELOPER: return 'theme-developer';
      default: return 'theme-study';
    }
  };

  // apply theme colors to document root (fallback) and tie jarvis accent to mode palette
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brahma-primary', themeColors.primary);
    root.style.setProperty('--brahma-secondary', themeColors.secondary);
    root.style.setProperty('--brahma-accent', themeColors.accent);
    root.style.setProperty('--jarvis-accent', themeColors.accent);
    root.style.setProperty('--jarvis-secondary', themeColors.secondary);
  }, [themeColors]);

  useEffect(() => {
    if (!showOnboarding || onboardingStage !== 'boot') return;
    setBootVisibleLines(0);
    let index = 0;
    const timers: number[] = [];
    const tick = () => {
      index += 1;
      setBootVisibleLines(index);
      if (index < BOOT_LINES.length) {
        timers.push(window.setTimeout(tick, 520));
      } else {
        timers.push(window.setTimeout(() => setOnboardingStage('welcome'), 900));
      }
    };
    timers.push(window.setTimeout(tick, 260));
    return () => timers.forEach(window.clearTimeout);
  }, [showOnboarding, onboardingStage]);

  useEffect(() => {
    if (!showOnboarding || onboardingStage !== 'tour') return;
    const typed = 'Summarize this page';
    setTourStep(0);
    setTourTypedText('');
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setTourStep(0);
      let idx = 0;
      const typeNext = () => {
        idx += 1;
        setTourTypedText(typed.slice(0, idx));
        if (idx < typed.length) timers.push(window.setTimeout(typeNext, 45));
      };
      typeNext();
    }, 250));
    timers.push(window.setTimeout(() => setTourStep(1), 2200));
    timers.push(window.setTimeout(() => setTourStep(2), 3900));
    timers.push(window.setTimeout(() => setOnboardingStage('activate'), 5600));
    return () => timers.forEach(window.clearTimeout);
  }, [showOnboarding, onboardingStage]);

  useEffect(() => {
    if (showOnboarding) {
      setContextHint(null);
      return;
    }
    const updateHint = () => {
      const host = window.location.hostname;
      const found = CONTEXT_HINTS.find(h => host.includes(h.match));
      setContextHint(found ? { text: found.text, action: found.action } : null);
    };
    updateHint();
    const id = window.setInterval(updateHint, 3000);
    return () => clearInterval(id);
  }, [showOnboarding]);

  const completeOnboarding = () => {
    setShowOnboarding(false);
    setOnboardingStage('complete');
    try {
      localStorage.setItem('onboarding_done', 'true');
      localStorage.setItem('brahma-onboarding-done', '1');
    } catch {}
  };

  // Suppress noisy fetch/network errors so they don't surface a runtime overlay
  useEffect(() => {
    const swallow = (ev: any) => {
      const msg = String(ev?.reason?.message || ev?.message || '');
      if (msg.includes('Failed to fetch')) {
        ev.preventDefault?.();
      }
    };
    window.addEventListener('unhandledrejection', swallow);
    window.addEventListener('error', swallow);
    return () => {
      window.removeEventListener('unhandledrejection', swallow);
      window.removeEventListener('error', swallow);
    };
  }, []);

  // compute inline style overrides (applied to our top-level container)
  const themeStyle: React.CSSProperties = {
    '--brahma-primary': themeColors.primary,
    '--brahma-secondary': themeColors.secondary,
    '--jarvis-secondary': themeColors.secondary,
    '--jarvis-accent': themeColors.accent,
    '--brahma-glow-color': `${themeColors.accent}33`,
    backgroundColor: themeColors.primary,
  } as React.CSSProperties;

  const healthBlurb = aiHealthMessage 
    ? (aiHealthMessage.length > 70 ? `${aiHealthMessage.slice(0, 70)}…` : aiHealthMessage)
    : null;
  const quickActions = MODE_BEHAVIORS[mode].quickActions(triggerTool);
  const modeCopy = MODE_COPY[mode];

  const handleSaveApiKey = () => {
    const key = userApiKey.trim();
    if (!key) return;
    localStorage.setItem('brahma-user-api-key', key);
    setUserApiKey(key);
    setShowApiPrompt(false);
  };

  const startOnboardingMode = () => {
    applyMode(pendingModeSelection);
    setOnboardingStage('tour');
  };

  const saveApiKeyFromOnboarding = () => {
    if (userApiKey.trim()) {
      handleSaveApiKey();
    }
    setOnboardingStage('first-action');
  };

  const skipApiActivation = () => {
    setShowApiPrompt(false);
    setOnboardingStage('first-action');
  };

  const runFirstAction = (action: string) => {
    if (action === 'Open YouTube') {
      openUrl('https://youtube.com');
    } else {
      handleAgentChat(undefined, action);
    }
    setOnboardingStage('complete');
  };


  // SIDEBAR MODE: Only show the right sidebar (AI Agent)
  const baseStyle: React.CSSProperties = {};
  if (customBackground) {
    baseStyle.backgroundImage = `url(${customBackground})`;
    baseStyle.backgroundSize = 'cover';
    baseStyle.backgroundPosition = 'center';
  }

  if (isSidebarMode) {
    return (
      <motion.aside
        initial={{ x: 0 }}
        animate={{ x: 0 }}
        className="w-full h-screen flex flex-col spatial-glass border-l"
        style={{ ...baseStyle, ...themeStyle }}
      >
        <div className="p-6 flex items-center justify-between border-b border-brahma-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brahma-accent/20 rounded-full flex items-center justify-center border border-brahma-accent">
              <Bot className="text-brahma-accent w-5 h-5" />
            </div>
            <h2 className="font-display text-sm font-bold tracking-widest text-brahma-accent uppercase">Brahma Agent</h2>
          </div>
        </div>

        {/* Chats & Folders */}
        <div className="px-4 py-3 border-b border-jarvis-border bg-black/30 space-y-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-gray-500">
            <span>Chats</span>
            <div className="flex items-center gap-2">
              <button onClick={createNewSession} className="px-2 py-1 bg-jarvis-accent/20 text-jarvis-accent rounded text-[10px] border border-jarvis-accent/40 hover:bg-jarvis-accent/40">New Chat</button>
              <button onClick={createNewFolder} className="px-2 py-1 bg-white/5 text-gray-300 rounded text-[10px] border border-white/10 hover:bg-white/10">New Folder</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {chatSessions.map(s => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('sessionId', s.id)}
                onClick={() => setActiveSessionId(s.id)}
                className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${activeSessionId === s.id ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10' : 'border-white/10 text-gray-300 bg-white/5 hover:border-jarvis-accent/40'}`}
              >
                {s.title}{s.folderId ? ` • ${folders.find(f => f.id === s.folderId)?.name || ''}` : ''}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, null); }}
              className="px-2 py-1 rounded border border-white/10 text-[11px] text-gray-300 bg-white/5"
            >
              All Chats
            </div>
            {folders.map(f => (
              <div
                key={f.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, f.id); }}
                className="px-2 py-1 rounded border border-white/10 text-[11px] text-gray-300 bg-white/5 hover:border-jarvis-accent/40"
              >
                {f.name}
              </div>
            ))}
          </div>
        </div>
{/* Chat Messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {activeMessages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20 px-8">
              <Bot className="w-12 h-12 mb-4" />
              <p className="text-xs tracking-widest uppercase">I am your browser agent. Ask me to switch modes, start timers, or open shortcuts.</p>
            </div>
          )}
          {chatAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
              {chatAttachments.map((f, idx) => (
                <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10">
                  <span>{f.name}</span>
                  <button
                    onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-200"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {activeMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-lg text-xs ${
                msg.role === 'user' 
                  ? 'bg-jarvis-accent/10 border border-jarvis-accent/30 text-white' 
                  : 'bg-white/5 border border-white/10 text-gray-300'
              }`}>
                <div className="prose prose-invert prose-xs">
                  <Markdown>{msg.content}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                <div className="flex gap-1">
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce"></div>
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-100"></div>
                  <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 border-t border-jarvis-border bg-black/20">
          <form onSubmit={handleAgentChat} className="flex items-center gap-2 bg-black/40 rounded-lg p-2 border border-white/5">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Command Brahma..." 
                  className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-600 py-2 px-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (isChatListening) {
                      chatSpeechRef.current?.stop();
                      setIsChatListening(false);
                    } else {
                      chatSpeechRef.current?.start();
                      setIsChatListening(true);
                    }
                  }}
                  className={`p-2 rounded-md transition-colors ${isChatListening ? 'bg-red-500/30 text-red-200' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakEnabled(!speakEnabled)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
                  title="Toggle speech"
                >
                  {speakEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
            <button
              type="submit"
              disabled={isChatLoading}
              className="p-2 bg-jarvis-accent text-jarvis-dark rounded-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sequentialMode}
                onChange={(e) => setSequentialMode(e.target.checked)}
                className="accent-jarvis-accent"
              />
              Sequential mode (plan + execute)
            </label>
            <span className="text-gray-600">Fast, concise replies enabled</span>
          </div>
        </div>
      </motion.aside>
    );
  }

  // FULL MODE: Show complete interface
  const baseStyle2: React.CSSProperties = {};
  if (customBackground) {
    baseStyle2.backgroundImage = `url(${customBackground})`;
    baseStyle2.backgroundSize = 'cover';
    baseStyle2.backgroundPosition = 'center';
  } else {
    baseStyle2.backgroundImage = `
      radial-gradient(circle at 20% 20%, ${themeColors.accent}15, transparent 38%),
      radial-gradient(circle at 80% 10%, ${themeColors.secondary}25, transparent 40%),
      linear-gradient(135deg, ${themeColors.primary} 0%, #06090e 100%)
    `;
  }
  return (
    <div
      className={`brahma-shell min-h-screen w-full flex bg-brahma-dark text-white font-sans overflow-hidden relative ${getThemeClass()} ${
        mode === AppMode.DEVELOPER ? 'dev-grid' : mode === AppMode.GAMING ? 'gaming-neon' : 'study-soft'
      }`}
      style={{ ...baseStyle2, ...themeStyle, filter: isFocusBlur ? 'blur(3px)' : undefined, pointerEvents: isFocusBlur ? 'none' : 'auto' }}
    >
      {/* Ambient dynamic aurora lighting */}
      <div className="ambient-aurora">
        <div className="ambient-aurora-blob-1" />
        <div className="ambient-aurora-blob-2" />
        <div className="ambient-aurora-grid" />
      </div>
      <div className="scanline"></div>
      {isFocusBlur && (
        <div className="fixed inset-0 z-[9900] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 pointer-events-auto">
          <div className="spatial-glass max-w-md w-full p-6 rounded-2xl flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-jarvis-accent font-display tracking-widest uppercase">Focus Shield</div>
            <div className="text-center text-gray-200 text-xs">
              {focusAlert || "Distraction detected. Stay on track?"}
            </div>
            <div className="flex gap-3">
              <button onClick={() => applyMode(AppMode.STUDY)} className="px-4 py-2 text-xs rounded-xl border border-jarvis-accent bg-jarvis-accent/20 text-jarvis-accent hover:bg-jarvis-accent/30 transition-all">Switch to Study</button>
              <button onClick={() => applyMode(AppMode.DEVELOPER)} className="px-4 py-2 text-xs rounded-xl border border-white/20 text-gray-200 hover:border-jarvis-accent hover:text-jarvis-accent transition-all">Switch to Dev</button>
              <button onClick={() => { setFocusAlert(null); setIsFocusBlur(false); }} className="px-3 py-2 text-xs rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all">Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {/* News corner */}
      <AnimatePresence>
        {showNews && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNews(false)}
              className="fixed inset-0 z-[9350] bg-black/25 backdrop-blur-[2px] lg:left-16"
            />
            <motion.aside 
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 180 }}
            className="fixed right-0 top-0 z-[9400] h-screen w-full lg:w-[50vw] min-[1600px]:w-[44vw] max-w-[900px] border-l border-white/10 spatial-glass overflow-hidden flex flex-col shadow-[-24px_0_80px_rgba(0,0,0,0.55)]"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3 text-gray-200">
                <div className="w-10 h-10 rounded-2xl border border-jarvis-accent/30 bg-jarvis-accent/10 flex items-center justify-center shadow-[0_0_30px_var(--brahma-glow-color)]">
                  <Newspaper className="w-5 h-5 text-jarvis-accent" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.28em] text-gray-500">Live briefing</div>
                  <span className="text-lg font-display text-white">News Corner</span>
                </div>
              </div>
              <button onClick={() => setShowNews(false)} className="text-gray-400 hover:text-white rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-jarvis-accent/40 hover:text-jarvis-accent"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-black/10">
              <div className="text-xs text-gray-400">Top world + India headlines in one side panel.</div>
              <button
                onClick={() => setShowNews(false)}
                className="hidden lg:inline-flex px-3 py-2 rounded-xl text-xs border border-white/10 bg-white/5 text-gray-300 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition"
              >
                Back to workspace
              </button>
            </div>
            <div className="p-5 space-y-6 text-sm text-gray-200 flex-1 overflow-y-auto custom-scrollbar">
              {newsLoading && (
                <div className="space-y-4">
                  <div className="text-xs uppercase tracking-[0.28em] text-jarvis-accent">Loading live feed</div>
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 animate-pulse">
                      <div className="h-3 w-24 rounded bg-white/10 mb-3" />
                      <div className="h-4 w-full rounded bg-white/10 mb-2" />
                      <div className="h-4 w-4/5 rounded bg-white/10 mb-4" />
                      <div className="h-3 w-32 rounded bg-white/10" />
                    </div>
                  ))}
                </div>
              )}
              {newsError && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{newsError}</div>}
              {!newsLoading && !newsError && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-jarvis-accent">World</div>
                      <div className="text-[11px] text-gray-500">{newsWorld.length} stories</div>
                    </div>
                    <div className="grid gap-3">
                      {newsWorld.map((n, idx) => (
                        <a key={idx} href={n.link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-jarvis-accent/45 hover:bg-white/[0.06] transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">{n.source || 'Google News'}</div>
                              <div className="font-semibold text-white leading-relaxed">{n.title}</div>
                              {n.description && <div className="text-xs text-gray-400 mt-2 line-clamp-2">{n.description}</div>}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                          </div>
                          {n.pubDate && <div className="text-[11px] text-gray-500 mt-3">{n.pubDate}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs uppercase tracking-[0.24em] text-jarvis-accent">India</div>
                      <div className="text-[11px] text-gray-500">{newsIndia.length} stories</div>
                    </div>
                    <div className="grid gap-3">
                      {newsIndia.map((n, idx) => (
                        <a key={idx} href={n.link} target="_blank" rel="noreferrer" className="block rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-jarvis-accent/45 hover:bg-white/[0.06] transition">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 mb-2">{n.source || 'Google News'}</div>
                              <div className="font-semibold text-white leading-relaxed">{n.title}</div>
                              {n.description && <div className="text-xs text-gray-400 mt-2 line-clamp-2">{n.description}</div>}
                            </div>
                            <ExternalLink className="w-4 h-4 text-gray-500 shrink-0 mt-1" />
                          </div>
                          {n.pubDate && <div className="text-[11px] text-gray-500 mt-3">{n.pubDate}</div>}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Shield / VPN modal */}

      <AnimatePresence>
        {showVpnModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="w-full max-w-md spatial-glass rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-200">
                  <Shield className="w-4 h-4 text-jarvis-accent" />
                  <span>Brahma Shield</span>
                </div>
                <button onClick={() => setShowVpnModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center text-xs font-semibold transition-all ${shieldStatus === 'ACTIVE' ? 'border-emerald-400 shadow-[0_0_18px_#22c55e55] text-emerald-200' : shieldStatus === 'CONNECTING' ? 'border-yellow-400 animate-pulse text-yellow-100' : 'border-gray-600 text-gray-400'}`}>
                  {shieldStatus}
                </div>
                <div className="text-gray-300 text-sm">Route traffic through proxy</div>
                <div className="text-[11px] text-gray-500">Location: {shieldLocation}</div>
                  {/* Proxy hidden per user request */}
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                onClick={async () => { 
                  setShieldStatus('CONNECTING'); 
                  const res = await sendShield({ type: 'connect' }); 
                  if (!res?.ok) setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10 hover:bg-jarvis-accent/20 text-sm"
              >Connect</button>
              <button
                onClick={async () => { 
                  setShieldStatus('CONNECTING'); 
                  const res = await sendShield({ type: 'switch' }); 
                  if (!res?.ok) setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-white/10 text-gray-200 bg-white/5 hover:bg-white/10 text-sm"
              >Change Server</button>
              <button
                onClick={async () => { 
                  await sendShield({ type: 'disconnect' }); 
                  setShieldStatus('OFF'); 
                  await refreshShield();
                }}
                className="px-4 py-2 rounded border border-white/10 text-gray-200 bg-white/5 hover:bg-white/10 text-sm"
              >Disconnect</button>
              </div>
              <div className="text-[11px] text-gray-500 text-center">Note: Uses browser proxy API; not system-wide VPN.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showOnboarding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] bg-[radial-gradient(circle_at_top,var(--brahma-glow-color),transparent_28%),rgba(4,6,12,0.9)] backdrop-blur-md"
          >
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]" />

            {onboardingStage === 'boot' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.4em] text-jarvis-accent font-mono mb-6">System Boot</div>
                  <div className="space-y-3 font-mono text-sm md:text-base text-gray-200 min-h-[180px]">
                    {BOOT_LINES.slice(0, bootVisibleLines).map((line, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <span className="text-jarvis-accent">{'>'}</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'welcome' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-3xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Welcome</div>
                  <h1 className="font-display text-4xl md:text-6xl text-white leading-none">Welcome to Brahma OS</h1>
                  <p className="mt-4 text-lg text-gray-300">Your AI-powered browser system</p>
                  <div className="mt-8 grid md:grid-cols-3 gap-4">
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">AI Agent for tasks</div>
                      <div className="mt-2 text-xs text-gray-400">Ask, automate, summarize, and get help instantly.</div>
                    </div>
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">Smart tools on every website</div>
                      <div className="mt-2 text-xs text-gray-400">Use floating actions for explain, notes, and summaries.</div>
                    </div>
                    <div className="rounded-2xl spatial-glass-subtle p-4">
                      <div className="text-sm text-white font-semibold">Mode-based workflows</div>
                      <div className="mt-2 text-xs text-gray-400">Switch the system feel for study, gaming, or building.</div>
                    </div>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button onClick={() => setOnboardingStage('mode')} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'mode' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-4xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Personalize</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Choose your starting mode</h2>
                  <p className="mt-3 text-sm text-gray-400">This sets your theme, suggestions, and default quick tools.</p>
                  <div className="mt-8 grid md:grid-cols-3 gap-4">
                    {([AppMode.STUDY, AppMode.GAMING, AppMode.DEVELOPER] as AppMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setPendingModeSelection(m)}
                        className={`rounded-2xl p-5 text-left transition-all ${
                          pendingModeSelection === m ? 'spatial-glass border-jarvis-accent shadow-[0_0_30px_var(--brahma-glow-color)]' : 'spatial-glass-subtle hover:border-white/20'
                        }`}
                      >
                        <div className="font-display text-xl text-white">{m}</div>
                        <div className="mt-2 text-sm text-gray-300">{MODE_COPY[m].label}</div>
                        <div className="mt-3 text-xs text-gray-400">
                          {m === AppMode.STUDY && 'Focus, summaries, learning tools'}
                          {m === AppMode.GAMING && 'Speed, tips, performance'}
                          {m === AppMode.DEVELOPER && 'Debugging, coding, APIs'}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-8 flex justify-end">
                    <button onClick={startOnboardingMode} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Start with this mode
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'tour' && (
              <div className="h-full relative px-6 py-10">
                <div className="absolute top-6 right-6 rounded-2xl spatial-glass px-4 py-3 max-w-sm">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-jarvis-accent mb-2">Feature Tour</div>
                  {tourStep === 0 && (
                    <>
                      <div className="text-white font-semibold">Type anything. Brahma executes.</div>
                      <div className="mt-2 text-sm text-gray-400">Auto-typing example: <span className="text-jarvis-accent">{tourTypedText || 'Summarize this page'}</span></div>
                    </>
                  )}
                  {tourStep === 1 && (
                    <>
                      <div className="text-white font-semibold">Brahma works on every website</div>
                      <div className="mt-2 text-sm text-gray-400">The floating assistant gives you instant tools outside the new tab.</div>
                    </>
                  )}
                  {tourStep === 2 && (
                    <>
                      <div className="text-white font-semibold">Instant tools based on your mode</div>
                      <div className="mt-2 text-sm text-gray-400">Quick actions adapt to what you’re doing right now.</div>
                    </>
                  )}
                </div>
                {tourStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute bottom-10 right-10 rounded-2xl bg-jarvis-accent text-white shadow-[0_0_32px_var(--brahma-glow-color)] px-5 py-4 border border-white/10"
                  >
                    Floating Assistant
                  </motion.div>
                )}
              </div>
            )}

            {onboardingStage === 'activate' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">Activate AI</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Activate AI Features</h2>
                  <p className="mt-3 text-sm text-gray-400">Add your Gemini API key now, or skip and use Brahma in limited mode for the moment.</p>
                  <input
                    type="password"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder="Paste Gemini API key"
                    className="mt-6 w-full p-4 rounded-2xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none"
                  />
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm text-jarvis-accent hover:underline"
                  >
                    Get a Gemini API key from Google AI Studio
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <div className="mt-6 flex flex-wrap gap-3 justify-end">
                    <button onClick={skipApiActivation} className="px-4 py-3 rounded-xl spatial-glass-subtle text-gray-300">Skip for now</button>
                    <button onClick={saveApiKeyFromOnboarding} className="px-5 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                      Save Key
                    </button>
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'first-action' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-3xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)]">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">First Action</div>
                  <h2 className="font-display text-3xl md:text-5xl text-white">Get your first win fast</h2>
                  <p className="mt-3 text-sm text-gray-400">Try one of these to feel Brahma OS immediately.</p>
                  <div className="mt-8 grid md:grid-cols-2 gap-4">
                    {['Summarize this page', 'Explain this content', 'Open YouTube', 'Fix this error'].map((item) => (
                      <button
                        key={item}
                        onClick={() => runFirstAction(item)}
                        className="rounded-2xl spatial-glass-subtle p-5 text-left hover:border-jarvis-accent transition-all"
                      >
                        <div className="text-white font-semibold">{item}</div>
                        <div className="mt-2 text-xs text-gray-400">Run this now</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {onboardingStage === 'complete' && (
              <div className="h-full flex items-center justify-center px-6">
                <div className="w-full max-w-2xl rounded-3xl spatial-glass p-8 md:p-10 shadow-[0_0_60px_var(--brahma-glow-color)] text-center">
                  <div className="text-[11px] uppercase tracking-[0.35em] text-jarvis-accent mb-4">System Ready</div>
                  <h2 className="font-display text-4xl md:text-6xl text-white">Brahma OS is now active</h2>
                  <p className="mt-4 text-sm text-gray-400">Your AI browser system is ready to work with you.</p>
                  <button onClick={completeOnboarding} className="mt-8 px-6 py-3 rounded-xl bg-jarvis-accent text-white border border-white/10 shadow-[0_0_26px_var(--brahma-glow-color)]">
                    Enter System
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* API Key Prompt */}
      <AnimatePresence>
        {showApiPrompt && !showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-md spatial-glass rounded-2xl p-6"
            >
              <h3 className="font-display text-lg text-jarvis-accent tracking-widest mb-2">Enter Gemini API Key</h3>
              <p className="text-xs text-gray-400 mb-4">Your key is stored locally and used for all Brahma AI features.</p>
              <input
                type="password"
                value={userApiKey}
                onChange={(e) => setUserApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full p-3 rounded-xl spatial-glass-subtle text-sm focus:border-jarvis-accent outline-none mb-4"
              />
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-jarvis-accent hover:underline inline-flex items-center gap-2 mb-4"
              >
                Get a Gemini API key at Google AI Studio
                <ExternalLink className="w-3 h-3" />
              </a>
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowApiPrompt(false)}
                  className="px-4 py-2 text-xs border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-all"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { localStorage.removeItem('brahma-user-api-key'); setUserApiKey(''); setShowApiPrompt(true); }}
                    className="px-3 py-2 text-xs border border-white/10 rounded-lg text-gray-400 hover:text-white hover:border-white/30 transition-all"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleSaveApiKey}
                    disabled={!userApiKey.trim()}
                    className="px-4 py-2 text-xs bg-jarvis-accent text-white rounded-lg border border-white/10 shadow-[0_0_18px_var(--brahma-glow-color)] hover:scale-105 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    Save Key
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Settings modal */}
      <AnimatePresence>
        {showSettingsPage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="w-full max-w-3xl spatial-glass rounded-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-jarvis-accent">Brahma Settings</div>
                  <div className="text-lg font-display text-white">Themes & Background</div>
                </div>
                <button onClick={() => setShowSettingsPage(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[AppMode.STUDY, AppMode.GAMING, AppMode.DEVELOPER].map(m => (
                <button
                  key={m}
                  onClick={() => applyMode(m)}
                  className={`p-3 rounded border text-left transition-all ${mode === m ? 'border-jarvis-accent bg-jarvis-accent/10 text-white' : 'border-white/10 text-gray-400 hover:border-jarvis-accent/40 hover:text-white'}`}
                >
                  <div className="text-xs uppercase tracking-widest">{m}</div>
                  <div className="text-[11px] text-gray-500">Optimize colors & feel for {m.toLowerCase()}.</div>
                </button>
              ))}
            </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" checked={autoMode} onChange={(e) => setAutoMode(e.target.checked)} className="accent-jarvis-accent" />
                  Auto-switch mode based on visited site
                </label>
                <span className="text-[11px] text-gray-500">e.g., GitHub → Dev, Twitch → Gaming, Wikipedia → Study</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['primary','secondary','accent'] as const).map(key => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs text-gray-400 capitalize">{key} color</label>
                    <input
                      type="color"
                      value={themeColors[key]}
                      onChange={(e) => setThemeColors(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full h-12 rounded border border-white/20 bg-white/5"
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <label className="text-xs text-gray-400">Upload custom background</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setCustomBackground(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-jarvis-accent file:text-jarvis-dark hover:file:bg-jarvis-accent/80"
                />
                {customBackground && (
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-20 rounded border border-white/20 overflow-hidden">
                      <img src={customBackground} className="w-full h-full object-cover" />
                    </div>
                    <button
                      onClick={() => setCustomBackground(null)}
                      className="px-3 py-2 text-xs bg-red-500/20 border border-red-500 text-red-500 rounded hover:bg-red-500/30"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() => {
                    setThemeColors(MODE_THEMES[mode]);
                    setCustomBackground(null);
                    try { localStorage.removeItem(`brahma-theme-colors-${mode}`); } catch {}
                  }}
                  className="px-4 py-2 text-xs rounded border border-white/20 text-gray-400 hover:text-white hover:border-white/40"
                >
                  Reset to defaults
                </button>
                <button
                  onClick={() => setShowSettingsPage(false)}
                  className="px-4 py-2 text-xs bg-jarvis-accent text-black rounded hover:scale-105 active:scale-95 transition-all"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact icon rail */}
      <div className="fixed left-3 top-1/2 -translate-y-1/2 rounded-2xl spatial-glass flex flex-col items-center gap-3 py-4 px-2 z-20 shadow-[0_12px_36px_rgba(0,0,0,0.5)]">
        <div className="w-10 h-10 rounded-xl border border-white/15 bg-white/5 flex items-center justify-center text-jarvis-accent shadow-inner">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="text-[8px] uppercase tracking-[0.35em] text-gray-500 [writing-mode:vertical-rl] rotate-180 select-none font-display">Brahma</div>
        <button
          onClick={() => setShowNews(true)}
          title="News corner"
          className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"
        >
          <Newspaper className="w-5 h-5" />
        </button>
        <div className="mt-2 flex flex-col items-center gap-2">
          <button onClick={() => setShowSettingsPage(true)} title="Settings" className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"><Settings className="w-5 h-5" /></button>
          <button onClick={() => setShowNotes(true)} title="Notes" className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all"><Plus className="w-5 h-5" /></button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main 
        className="flex-1 h-screen flex flex-col relative z-10 transition-all duration-300 ease-out overflow-y-auto"
        style={{ marginRight: showNews ? 'min(50vw, 900px)' : '0px', paddingLeft: '76px' }}
      >
        {/* Top Control Bar HUD */}
        <div className="mx-6 mt-4 rounded-2xl spatial-glass px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {/* System Branding & Status */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className={`w-2 h-2 rounded-full ${
                  aiHealth === 'online' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : aiHealth === 'checking' ? 'bg-yellow-400 animate-ping' : 'bg-red-400'
                }`} />
                <span className="text-[11px] font-display font-semibold tracking-wider text-white">BRAHMA OS</span>
                <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-mono ml-1">{aiHealth === 'online' ? 'ONLINE' : aiHealth}</span>
              </div>
              {currentTime && (
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-gray-300">
                  <span className="text-jarvis-accent font-semibold">{currentTime}</span>
                </div>
              )}
            </div>

            {/* Telemetry Metrics */}
            <div className="hidden sm:flex items-center gap-2">
              {batteryLevel !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <Battery className={`w-3.5 h-3.5 ${batteryLevel > 50 ? 'text-emerald-400' : batteryLevel > 20 ? 'text-yellow-400' : 'text-red-400'}`} />
                  <span>{batteryLevel}%</span>
                </div>
              )}
              {memoryUsage !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <Activity className={`w-3.5 h-3.5 ${memoryUsage > 80 ? 'text-red-400' : memoryUsage > 60 ? 'text-yellow-400' : 'text-cyan-400'}`} />
                  <span>RAM {memoryUsage}%</span>
                </div>
              )}
              {weather && (
                <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
                  <span className="text-jarvis-accent font-medium">{weather.temp}°C</span> {weather.description}
                </div>
              )}
            </div>
          </div>

          {/* Mode Switcher & Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mode Pills Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
              {([AppMode.DEVELOPER, AppMode.STUDY, AppMode.GAMING] as AppMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => applyMode(m)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    mode === m 
                      ? 'bg-jarvis-accent text-black shadow-[0_0_15px_var(--brahma-glow-color)]' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <button
              onClick={pingModel}
              className="text-[11px] px-3 py-1.5 rounded-xl spatial-glass-subtle text-gray-300 hover:text-white hover:border-jarvis-accent/50 transition-all"
              title="Re-run AI health check"
            >
              Recheck
            </button>
            <button
              onClick={() => setShowApiPrompt(true)}
              className="text-[11px] px-3 py-1.5 rounded-xl spatial-glass-subtle text-gray-300 hover:text-white hover:border-jarvis-accent/50 transition-all"
              title="Set API key"
            >
              API Key
            </button>
            {!isRightSidebarOpen && (
              <button 
                onClick={() => setIsRightSidebarOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-jarvis-accent/15 border border-jarvis-accent/40 text-jarvis-accent transition-all flex items-center gap-2 hover:bg-jarvis-accent hover:text-black hover:shadow-[0_0_20px_var(--brahma-glow-color)]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wider">Agent</span>
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {contextHint && (
          <div className="mx-6 mt-4 rounded-2xl spatial-glass-subtle p-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <div className="text-[10px] uppercase tracking-[0.24em] text-jarvis-accent font-semibold">Brahma Hint</div>
              <div className="mt-0.5 text-sm text-white">{contextHint.text}</div>
            </div>
            <button
              onClick={() => triggerTool(contextHint.action)}
              className="px-3.5 py-1.5 text-xs bg-jarvis-accent text-black font-medium rounded-xl hover:shadow-[0_0_15px_var(--brahma-glow-color)] transition-all"
            >
              Try it
            </button>
          </div>
        )}

        {/* Hero Section: Left Clock + Center/Right Spotlight & Dock */}
        <div className="px-6 py-6 flex items-start justify-center">
          <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 xl:gap-10">
            
            {/* Left Column: Big Analogue Clock (12h format adapted to device local time) */}
            <div className="flex-shrink-0 flex flex-col items-center lg:sticky lg:top-8 pt-1">
              <AnalogClock 
                accentColor={themeColors.accent}
                glowColor="var(--brahma-glow-color)"
                mode={mode}
              />
            </div>

            {/* Right Column: Realigned Spotlight Command Bar, Quick Chips & Launch Dock */}
            <div className="flex-1 w-full max-w-3xl space-y-5">
              
              {/* Spotlight Command Bar */}
              <div
                ref={searchSurfaceRef}
                className={`spotlight-bar rounded-2xl p-2 transition-all ${
                  showOnboarding && onboardingStage === 'tour' && tourStep === 0 ? 'ring-2 ring-jarvis-accent shadow-[0_0_40px_var(--brahma-glow-color)]' : ''
                }`}
              >
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSearch(); }} 
                  className="flex items-center gap-3 px-3 py-1.5"
                >
                  <Search className="text-jarvis-accent w-5 h-5 flex-shrink-0" />
                  <input 
                    type="text" 
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={isListening ? "Listening to voice command..." : `Ask Brahma anything in ${mode} mode...`} 
                    className="flex-1 bg-transparent border-none outline-none text-base md:text-lg text-white placeholder:text-gray-500 font-sans caret-jarvis-accent"
                  />
                  
                  {/* Voice toggle with audio wave or mic */}
                  <div className="flex items-center gap-2">
                    {isListening && (
                      <div className="flex items-center gap-1 px-2">
                        <span className="listening-wave-bar" style={{ animationDelay: '0ms' }} />
                        <span className="listening-wave-bar" style={{ animationDelay: '150ms' }} />
                        <span className="listening-wave-bar" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                    <button 
                      type="button" 
                      onClick={toggleListening}
                      className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                      title="Voice Command"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-[10px] font-mono text-gray-400 bg-white/5 border border-white/10 rounded-lg">
                      ↵ Enter
                    </kbd>
                    <button 
                      type="button" 
                      onClick={() => {
                        if (query.trim()) {
                          openUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
                        }
                      }}
                      className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-jarvis-accent transition-all"
                      title="Google Search"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Contextual Quick Action Chips */}
              <div
                ref={quickActionStripRef}
                className={`flex flex-wrap items-center justify-center gap-2.5 transition-all ${
                  showOnboarding && onboardingStage === 'tour' && tourStep === 2 ? 'ring-2 ring-jarvis-accent shadow-[0_0_40px_var(--brahma-glow-color)] rounded-2xl p-2' : ''
                }`}
              >
                {quickActions.map((b, idx) => (
                  <button
                    key={idx}
                    onClick={b.action}
                    className="action-chip px-4 py-2 rounded-xl text-xs font-medium text-gray-300 flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-jarvis-accent" />
                    <span>{b.label}</span>
                  </button>
                ))}
              </div>

              {/* Floating Launch Dock */}
              <div className="launch-dock rounded-3xl p-5">
                <div className="flex items-center justify-between px-2 mb-4">
                  <span className="text-[11px] font-display uppercase tracking-[0.25em] text-gray-400 font-semibold flex items-center gap-2">
                    <LayoutGrid className="w-3.5 h-3.5 text-jarvis-accent" />
                    Launch Dock
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">{shortcuts.length} shortcuts</span>
                </div>

                <div className="flex items-center justify-start gap-4 flex-wrap px-1">
                  {shortcuts.map(s => (
                    <a 
                      key={s.id} 
                      href={s.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => handleShortcutClick(s)}
                      className="flex flex-col items-center gap-2 group relative"
                    >
                      <button 
                        onClick={(e) => deleteShortcut(s.id, e)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500 shadow-md"
                        title="Delete shortcut"
                      >
                        <X className="w-2.5 h-2.5 text-white" />
                      </button>
                      <div className="dock-tile w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden relative">
                        {s.favicon ? (
                          <img 
                            src={s.favicon} 
                            alt={s.name} 
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                              const sibling = (e.currentTarget.parentElement?.querySelector('.fallback-icon')) as HTMLElement;
                              if (sibling) sibling.style.display = 'flex';
                            }}
                            className="w-9 h-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]" 
                          />
                        ) : null}
                        <div className={`fallback-icon w-9 h-9 items-center justify-center ${s.favicon ? 'hidden' : 'flex'}`}>
                          {renderShortcutIcon(s.icon)}
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors text-center truncate max-w-[72px] font-medium">
                        {s.name}
                      </span>
                    </a>
                  ))}
                  
                  {/* Add Shortcut Tile */}
                  <button 
                    onClick={() => setShowAddShortcut(true)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className="w-16 h-16 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] flex items-center justify-center group-hover:border-jarvis-accent group-hover:bg-jarvis-accent/10 group-hover:scale-105 transition-all">
                      <Plus className="w-6 h-6 text-gray-400 group-hover:text-jarvis-accent transition-colors" />
                    </div>
                    <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors font-medium">Add</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Add Shortcut Modal */}
        <AnimatePresence>
          {showAddShortcut && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddShortcut(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md spatial-glass p-6 rounded-2xl z-[101]"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-display text-lg text-jarvis-accent tracking-widest uppercase">Add Shortcut</h2>
                  <button onClick={() => setShowAddShortcut(false)} className="text-gray-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={addShortcut} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest px-1">Name</label>
                    <input 
                      type="text" 
                      value={newShortcutName}
                      onChange={(e) => setNewShortcutName(e.target.value)}
                      placeholder="e.g. Netflix"
                      className="w-full spatial-glass-subtle border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-jarvis-accent transition-all"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-400 uppercase tracking-widest px-1">URL</label>
                    <input 
                      type="text" 
                      value={newShortcutUrl}
                      onChange={(e) => setNewShortcutUrl(e.target.value)}
                      placeholder="e.g. netflix.com"
                      className="w-full spatial-glass-subtle border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-jarvis-accent transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-jarvis-accent text-jarvis-dark py-3 rounded-xl font-display text-xs tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 font-semibold"
                  >
                    Initialize Shortcut
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Results / Notes View */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto h-full">
            <AnimatePresence mode="wait">
              {showNotes ? (
                <motion.div
                  key="notes"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-jarvis-border pb-4 mb-6">
                    <h2 className="font-display text-xl text-jarvis-accent flex items-center gap-2">
                      <StickyNote className="w-6 h-6" /> NEURAL ARCHIVE
                    </h2>
                    <button onClick={() => setShowNotes(false)} className="text-gray-500 hover:text-white"><X /></button>
                  </div>

                  <div className="spatial-glass rounded-2xl p-5 mb-6">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="text-sm text-white font-medium">Add source for Brahma</div>
                        <div className="text-xs text-gray-400">Save a URL, pasted text, or both. The agent can use enabled items while answering.</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveSelectedTextAsSource}
                          disabled={isCapturingSelection}
                          className="px-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCapturingSelection ? 'Saving selection...' : 'Save selected text'}
                        </button>
                        <button
                          onClick={saveCurrentPageAsSource}
                          disabled={isCapturingSource}
                          className="px-4 py-2 text-xs rounded-xl border border-white/10 bg-white/5 text-gray-200 hover:border-jarvis-accent/40 hover:text-jarvis-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCapturingSource ? 'Saving page...' : 'Save current page'}
                        </button>
                        <button
                          onClick={addArchiveSource}
                          className="px-4 py-2 text-xs rounded-xl bg-jarvis-accent text-black hover:scale-105 active:scale-95 transition-all"
                        >
                          Save source
                        </button>
                      </div>
                    </div>
                    {archiveStatusMessage && (
                      <div className="mb-4 rounded-xl border border-jarvis-accent/20 bg-jarvis-accent/10 px-3 py-2 text-xs text-jarvis-accent">
                        {archiveStatusMessage}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newSourceTitle}
                        onChange={(e) => setNewSourceTitle(e.target.value)}
                        placeholder="Source title"
                        className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50"
                      />
                      <input
                        type="text"
                        value={newSourceUrl}
                        onChange={(e) => setNewSourceUrl(e.target.value)}
                        placeholder="Source URL (optional)"
                        className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50"
                      />
                      <textarea
                        value={newSourceContent}
                        onChange={(e) => setNewSourceContent(e.target.value)}
                        placeholder="Paste article text, notes, repo context, docs, or any reference Brahma should use"
                        className="md:col-span-2 min-h-[120px] rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-jarvis-accent/50 resize-y"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {notes.map(note => (
                      <div key={note.id} className="spatial-glass p-5 rounded-2xl group">
                        <div className="flex items-start justify-between mb-2 gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] uppercase tracking-[0.25em] text-gray-500">{note.kind === 'source' ? 'Source' : 'Note'}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${note.useForAgent !== false ? 'border-jarvis-accent/40 text-jarvis-accent bg-jarvis-accent/10' : 'border-white/10 text-gray-500 bg-white/5'}`}>
                                {note.useForAgent !== false ? 'Agent on' : 'Agent off'}
                              </span>
                            </div>
                            <h3 className="font-bold text-jarvis-accent truncate">{note.title}</h3>
                            {note.sourceUrl && (
                              <a
                                href={note.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-gray-400 hover:text-jarvis-accent break-all"
                              >
                                {note.sourceUrl}
                              </a>
                            )}
                          </div>
                          <button onClick={() => deleteNote(note.id)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-400 line-clamp-4 whitespace-pre-wrap markdown-body prose prose-invert">
                          <Markdown>{note.content}</Markdown>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <button
                            onClick={() => toggleNoteForAgent(note.id)}
                            className={`text-[11px] px-3 py-1.5 rounded-lg border transition ${note.useForAgent !== false ? 'border-jarvis-accent/40 text-jarvis-accent bg-jarvis-accent/10 hover:bg-jarvis-accent/15' : 'border-white/10 text-gray-400 bg-white/5 hover:border-white/20 hover:text-white'}`}
                          >
                            {note.useForAgent !== false ? 'Used by agent' : 'Enable for agent'}
                          </button>
                          <div className="text-[9px] text-gray-600">{new Date(note.timestamp).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 opacity-20">
                        <StickyNote className="w-16 h-16 mb-4" />
                        <p className="font-display tracking-widest">ARCHIVE EMPTY</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full"
                >
                  {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center gap-6">
                      <div className="relative">
                        <div className="w-24 h-24 border-4 border-jarvis-accent/10 border-t-jarvis-accent rounded-full animate-spin"></div>
                        <Cpu className="absolute inset-0 m-auto w-8 h-8 text-jarvis-accent animate-pulse" />
                      </div>
                      <div className="text-center">
                        <div className="font-display text-sm text-jarvis-accent animate-pulse tracking-[0.3em] mb-2">ACCESSING NEURAL CORE</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-widest">Decrypting response from Gemini-3-Flash...</div>
                      </div>
                    </div>
                  ) : aiResponse ? (
                    <div className="spatial-glass p-6 rounded-2xl min-h-[320px]">
                      <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 bg-jarvis-accent rounded-full animate-ping"></div>
                          <h3 className="font-display text-sm text-jarvis-accent uppercase tracking-widest">
                            {mode} INTELLIGENCE FEED
                          </h3>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                            <input 
                              type="text" 
                              placeholder="Note title..." 
                              value={newNoteTitle}
                              onChange={(e) => setNewNoteTitle(e.target.value)}
                              className="bg-transparent border-none outline-none text-xs px-2 w-32 text-white placeholder:text-gray-500"
                            />
                            <button 
                              onClick={addNote}
                              className="bg-jarvis-accent/20 text-jarvis-accent p-1.5 rounded-lg hover:bg-jarvis-accent/40 transition-all"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button onClick={() => setAiResponse(null)} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all"><X className="w-5 h-5" /></button>
                        </div>
                      </div>
                      <div className="markdown-body prose prose-invert max-w-none text-gray-200 leading-relaxed font-sans">
                        <Markdown>{aiResponse.content}</Markdown>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      {/* RIGHT SIDEBAR - AI AGENT */}
      <AnimatePresence>
        {isRightSidebarOpen && (
          <motion.aside
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="fixed right-0 top-0 w-[420px] max-w-full h-screen flex flex-col spatial-glass z-20 border-l overflow-hidden shadow-[-20px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/10 bg-black/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-brahma-accent/20 rounded-full flex items-center justify-center border border-brahma-accent">
                  <Bot className="text-brahma-accent w-5 h-5" />
                </div>
                <h2 className="font-display text-sm font-bold tracking-widest text-brahma-accent uppercase">Brahma Agent</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsChatNavCollapsed(!isChatNavCollapsed)}
                  className="text-gray-500 hover:text-white border border-white/10 rounded px-2 py-1"
                  title={isChatNavCollapsed ? "Show chat sidebar" : "Hide chat sidebar"}
                >
                  {isChatNavCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsRightSidebarOpen(false)} className="text-gray-500 hover:text-white">
                  <PanelRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex h-full min-h-0">
              {/* LEFT CHAT NAV */}
              <div className={`${isChatNavCollapsed ? 'w-12' : 'w-60'} border-r border-jarvis-border bg-black/30 flex flex-col p-3 gap-3 transition-all duration-200`}>
                <button onClick={createNewSession} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/40 hover:bg-jarvis-accent/30 text-xs">
                  <PlusCircle className="w-4 h-4" /> {!isChatNavCollapsed && 'New chat'}
                </button>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs">
                  <SearchIcon className="w-4 h-4 text-gray-500" />
                  {!isChatNavCollapsed && (
                    <input
                      value={chatSearch}
                      onChange={(e) => setChatSearch(e.target.value)}
                      placeholder="Search chats"
                      className="bg-transparent border-none outline-none flex-1 text-gray-300 text-xs"
                    />
                  )}
                </div>
                {!isChatNavCollapsed && (
                  <>
                    <div className="space-y-2 text-xs text-gray-400">
                      <div className="font-semibold text-gray-200 flex items-center justify-between">
                        <span>Folders</span>
                        <button onClick={createNewFolder} className="px-2 py-1 bg-white/5 text-gray-300 rounded text-[10px] border border-white/10 hover:bg-white/10">New</button>
                      </div>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, null); }}
                        className="px-2 py-1 rounded border border-white/10 bg-white/5 hover:border-jarvis-accent/40 cursor-pointer"
                      >
                        All chats
                      </div>
                      {folders.map(f => (
                        <div
                          key={f.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('sessionId'); if (id) moveSessionToFolder(id, f.id); }}
                          className="px-2 py-1 rounded border border-white/10 bg-white/5 hover:border-jarvis-accent/40 cursor-pointer flex items-center gap-2"
                        >
                          <Folder className="w-4 h-4" /> {f.name}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 text-xs text-gray-400 flex-1 overflow-y-auto custom-scrollbar">
                      <div className="font-semibold text-gray-200">Your chats</div>
              {chatSessions
                .filter(s => !chatSearch || s.title.toLowerCase().includes(chatSearch.toLowerCase()))
                .map(s => (
                  <div
                    key={s.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('sessionId', s.id)}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`px-2 py-1 rounded border text-[11px] cursor-pointer flex items-center justify-between gap-2 ${activeSessionId === s.id ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10' : 'border-white/10 text-gray-300 bg-white/5 hover:border-jarvis-accent/40'}`}
                  >
                    <span className="truncate">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                      className="text-gray-500 hover:text-red-400"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
            </div>
                  </>
                )}
              </div>

              {/* RIGHT CONTENT */}
              <div className="flex-1 min-h-0 flex flex-col">
{/* Chat Messages */}
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-6 custom-scrollbar">
                  {activeMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-8">
                      <div className="w-16 h-16 rounded-[20px] border border-jarvis-accent/20 bg-jarvis-accent/10 flex items-center justify-center mb-4 opacity-80">
                        <Bot className="w-8 h-8 text-jarvis-accent" />
                      </div>
                      <p className="text-xs tracking-widest uppercase text-gray-500">I am your browser agent. Ask me to switch modes, start timers, or open shortcuts.</p>
                    </div>
                  )}
                  {smartTips.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-xs text-gray-200 shadow-[0_12px_24px_rgba(0,0,0,0.18)]">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-2">Smart suggestions</div>
                      <div className="flex flex-wrap gap-2">
                        {MODE_BEHAVIORS[mode].quickActions(triggerTool).slice(0,3).map((a, idx) => (
                          <button
                            key={idx}
                            onClick={a.action}
                            className="px-3 py-2 rounded border border-white/10 bg-black/40 hover:border-jarvis-accent hover:text-jarvis-accent transition text-[11px]"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-2xl text-xs ${
                        msg.role === 'user' 
                          ? 'bg-jarvis-accent/10 border border-jarvis-accent/30 text-white' 
                          : 'bg-white/5 border border-white/10 text-gray-300'
                      }`}>
                        <div className="prose prose-invert prose-xs">
                          <Markdown>{msg.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce"></div>
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-100"></div>
                          <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce delay-200"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-jarvis-border bg-black/20">
                  <form onSubmit={handleAgentChat} className="flex items-center gap-2 bg-black/40 rounded-2xl p-2 border border-white/5">
                    <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Command Brahma..." 
                      className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-gray-600 py-2 px-2"
                    />
                    <button 
                      type="submit"
                      disabled={isChatLoading}
                      className="p-2 bg-jarvis-accent text-jarvis-dark rounded-md hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sequentialMode}
                        onChange={(e) => setSequentialMode(e.target.checked)}
                        className="accent-jarvis-accent"
                      />
                      Sequential mode (plan + execute)
                    </label>
                    <span className="text-gray-600">Fast, concise replies enabled</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 210, 255, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 210, 255, 0.4);
        }
        .mode-surface,
        .mode-action-strip {
          transition: border-color 220ms ease, box-shadow 220ms ease, background 220ms ease, transform 220ms ease;
        }
        .gaming-neon .mode-surface,
        .gaming-neon .mode-action-strip,
        .gaming-neon .glass-panel,
        .gaming-neon .futuristic-border {
          border-color: color-mix(in srgb, var(--jarvis-accent) 40%, rgba(255,255,255,0.15));
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--jarvis-accent) 20%, transparent),
            0 0 28px color-mix(in srgb, var(--jarvis-accent) 25%, transparent),
            0 24px 60px rgba(0, 0, 0, 0.4);
        }
        .gaming-neon button:hover {
          box-shadow: 0 0 14px color-mix(in srgb, var(--jarvis-accent) 28%, transparent);
        }
        .dev-grid::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 80px 80px;
          z-index: 0;
        }
        .dev-grid .mode-surface,
        .dev-grid .mode-action-strip,
        .dev-grid .glass-panel {
          border-color: color-mix(in srgb, var(--jarvis-accent) 25%, rgba(255,255,255,0.12));
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--jarvis-accent) 15%, transparent),
            0 0 20px color-mix(in srgb, var(--jarvis-accent) 18%, transparent);
        }
      `}} />
    </div>
  );
}

function SidebarTool({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-all duration-200 group"
    >
      <div className="text-gray-500 group-hover:glow-text transition-colors">
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
      </div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}

function renderShortcutIcon(iconName: string) {
  switch (iconName) {
    case 'LayoutGrid': return <LayoutGrid className="w-7 h-7 text-blue-400" />;
    case 'Youtube': return <Youtube className="w-7 h-7 text-red-500" />;
    case 'MessageSquare': return <MessageSquare className="w-7 h-7 text-indigo-400" />;
    case 'Mail': return <Mail className="w-7 h-7 text-red-400" />;
    case 'Github': return <Github className="w-7 h-7 text-white" />;
    default: return <ExternalLink className="w-7 h-7" />;
  }
}



