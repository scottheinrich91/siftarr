import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CurationCard, formatBytes } from './CurationCard';
import { 
  Play, 
  Trash2, 
  Check, 
  EyeOff, 
  Settings, 
  Flame, 
  SlidersHorizontal,
  ChevronDown,
  Database,
  Terminal,
  Activity,
  AlertTriangle,
  Key,
  RefreshCw,
  CheckCircle,
  XCircle,
  Film,
  Tv,
  Info,
  Compass,
  LayoutGrid,
  Star,
  Sparkles,
  Crown,
  ArrowLeft,
  X
} from 'lucide-react';

interface MediaItem {
  id: number;
  title: string;
  year: number;
  mediaType: 'movie' | 'tv';
  sizeBytes: number;
  qualityProfileId: number;
  qualityFormatSource: string;
  customFormatScore: number;
  customFormatTags: string[];
  playCount: number;
  lastPlayed: string | null;
  watchTimeHours: number;
  rootFolder: string;
  seasons?: number;
  episodes?: number;
}

export default function App() {
  // Authentication & Handshake
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('siftarr_api_key') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isValidatingAuth, setIsValidatingAuth] = useState(false);

  // App Navigation & Configuration State
  const [activeTab, setActiveTab] = useState<'curate' | 'queue' | 'logs' | 'settings'>('curate');
  const [dryRun, setDryRun] = useState(true);

  // Curation Feed state
  const [feed, setFeed] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedTotal, setFeedTotal] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState('');
  
  // Feed Filters & Sort
  const [selectedMediaType, setSelectedMediaType] = useState<'all' | 'movie' | 'tv'>('movie');
  const [libraryProfiles, setLibraryProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<number | 'all'>('all');
  const [isLibraryDropdownOpen, setIsLibraryDropdownOpen] = useState(false);
  const [unwatchedOnly, setUnwatchedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'size' | 'plays' | 'score' | 'added'>('size');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);



  // Deletion Queue
  const [deletionQueue, setDeletionQueue] = useState<any[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{ current: number; total: number; title: string } | null>(null);
  const [deleteConfirmCount, setDeleteConfirmCount] = useState(0);

  // System Logs
  const [logsText, setLogsText] = useState('');
  const [logType, setLogType] = useState<'info' | 'debug' | 'trace'>('info');
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

  // System Setup (Settings) Form
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'connections' | 'libraries' | 'gestures' | 'diagnostics'>('general');
  const [radarrProfiles, setRadarrProfiles] = useState<any[]>([]);
  const [sonarrProfiles, setSonarrProfiles] = useState<any[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Automated Library Discovery states
  const [radarrRoots, setRadarrRoots] = useState<any[]>([]);
  const [sonarrRoots, setSonarrRoots] = useState<any[]>([]);
  const [isLoadingRoots, setIsLoadingRoots] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  
  // Connection Test States
  const [testStatus, setTestStatus] = useState<Record<string, 'loading' | 'success' | 'failed' | null>>({
    radarr: null,
    sonarr: null,
    tautulli: null,
    overseerr: null
  });

  // Exit direction for fly-away animation
  const [exitDirection, setExitDirection] = useState({ x: 0, y: 0, rotate: 0 });

  // Activity logs for session stats
  const [sessionCuratedCount, setSessionCuratedCount] = useState(0);
  const [deletionQueueCount, setDeletionQueueCount] = useState(0);
  const [isResettingData, setIsResettingData] = useState(false);

  // Sync deletion queue count dynamically
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/v1/queue', { headers: { 'X-Api-Key': apiKey } })
        .then(res => res.json())
        .then(data => setDeletionQueueCount(data?.length || 0))
        .catch(() => {});
    }
  }, [currentIndex, activeTab, isAuthenticated]);

  const fetchLibraryProfiles = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/v1/profiles', { headers: { 'X-Api-Key': apiKey } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLibraryProfiles(data);
        }
      }
    } catch (e) {}
  };

  // Fetch library profiles when authenticated
  useEffect(() => {
    fetchLibraryProfiles();
  }, [isAuthenticated, apiKey]);

  // Authenticate Siftarr API Key on startup with auto-bootstrap fallback for local origin
  useEffect(() => {
    const startupAuth = async () => {
      setIsValidatingAuth(true);
      if (apiKey) {
        try {
          const res = await fetch('/api/v1/system/status', {
            headers: { 'X-Api-Key': apiKey }
          });
          if (res.ok) {
            const data = await res.json();
            setDryRun(data.dryRun);
            setIsAuthenticated(true);
            setIsValidatingAuth(false);
            return;
          }
        } catch (err) {
          // Fall through on validation failure
        }
      }
      
      // Try bootstrap fallback
      try {
        const bootRes = await fetch('/api/v1/system/bootstrap');
        if (bootRes.ok) {
          const bootData = await bootRes.json();
          if (bootData && bootData.apiKey) {
            setApiKey(bootData.apiKey);
            const statusRes = await fetch('/api/v1/system/status', {
              headers: { 'X-Api-Key': bootData.apiKey }
            });
            if (statusRes.ok) {
              const data = await statusRes.json();
              setDryRun(data.dryRun);
              setIsAuthenticated(true);
              localStorage.setItem('siftarr_api_key', bootData.apiKey);
              setIsValidatingAuth(false);
              return;
            }
          }
        }
      } catch (err) {
        // Bootstrap failed
      }
      
      if (apiKey) {
        setAuthError('Unauthorized: Invalid Siftarr API Key');
      }
      setIsValidatingAuth(false);
    };

    startupAuth();
  }, []);

  // Hotkey isolation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return; // Ignore if user is writing in a form field
      }

      if (activeTab !== 'curate') return;

      const getDirectionConfig = (dir: 'left' | 'right' | 'up' | 'down') => {
        const action = settings[`swipe_${dir}_action`] || (dir === 'down' ? 'delete' : 'profile');
        const color = settings[`swipe_${dir}_color`] || 
          (dir === 'left' ? '#00b0ff' : dir === 'right' ? '#00e676' : dir === 'up' ? '#ffd600' : '#ff1744');
        const label = settings[`swipe_${dir}_label`] || 
          (dir === 'left' ? 'Standard Profile' : dir === 'right' ? 'Upgraded Profile' : dir === 'up' ? 'God Tier Profile' : 'Delete');
        return { action, color, label };
      };

      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const conf = getDirectionConfig('left');
        if (conf.action === 'disabled') return;
        setExitDirection({ x: -800, y: 0, rotate: -20 });
        setTimeout(() => {
          handleProfileUpdate('left', conf.color, conf.label);
        }, 0);
      } else if (key === 'd' || e.key === 'ArrowRight') {
        e.preventDefault();
        const conf = getDirectionConfig('right');
        if (conf.action === 'disabled') return;
        setExitDirection({ x: 800, y: 0, rotate: 20 });
        setTimeout(() => {
          handleProfileUpdate('right', conf.color, conf.label);
        }, 0);
      } else if (key === 'w' || e.key === 'ArrowUp') {
        e.preventDefault();
        const conf = getDirectionConfig('up');
        if (conf.action === 'disabled') return;
        setExitDirection({ x: 0, y: -800, rotate: 0 });
        setTimeout(() => {
          handleProfileUpdate('up', conf.color, conf.label);
        }, 0);
      } else if (key === 's' || e.key === 'ArrowDown') {
        e.preventDefault();
        const conf = getDirectionConfig('down');
        if (conf.action === 'disabled') return;
        setExitDirection({ x: 0, y: 800, rotate: 0 });
        setTimeout(() => {
          handleProfileUpdate('down', conf.color, conf.label);
        }, 0);
      } else if (key === 'k' || e.key === ' ') {
        e.preventDefault();
        setExitDirection({ x: 800, y: 0, rotate: 20 });
        setTimeout(() => {
          handleSkip();
        }, 0);
      } else if (key === 'u') {
        e.preventDefault();
        setExitDirection({ x: -800, y: 0, rotate: -20 });
        setTimeout(() => {
          handleProfileUpdate('unmonitor', 'var(--slate)', 'Set to Unmonitored');
        }, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, feed, currentIndex, settings]);

  // Fetch feed when filters/sorting changes or authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchFeed();
    }
  }, [selectedProfileId, unwatchedOnly, sortBy, sortOrder, isAuthenticated]);

  // Fetch deletion queue on tab switch
  useEffect(() => {
    if (isAuthenticated && activeTab === 'queue') {
      fetchDeletionQueue();
    }
  }, [activeTab, isAuthenticated]);

  // Fetch logs on tab switch
  useEffect(() => {
    if (isAuthenticated && activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, logType, isAuthenticated]);

  // Fetch settings on settings tab load
  useEffect(() => {
    if (isAuthenticated && activeTab === 'settings') {
      fetchSettings();
      fetchArrProfiles();
    }
  }, [activeTab, isAuthenticated]);



  const validateApiKey = async (key: string) => {
    setIsValidatingAuth(true);
    setAuthError('');
    try {
      const res = await fetch('/api/v1/system/status', {
        headers: { 'X-Api-Key': key }
      });
      if (res.ok) {
        const data = await res.json();
        setDryRun(data.dryRun);
        setIsAuthenticated(true);
        localStorage.setItem('siftarr_api_key', key);
      } else {
        setAuthError('Unauthorized: Invalid Siftarr API Key');
        setIsAuthenticated(false);
      }
    } catch (err) {
      setAuthError('Could not reach Siftarr server');
      setIsAuthenticated(false);
    } finally {
      setIsValidatingAuth(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      validateApiKey(apiKey.trim());
    } else {
      setAuthError('API Key is required');
    }
  };

  const fetchFeed = async () => {
    setIsLoadingFeed(true);
    setFeedError('');
    try {
      const selectedProfile = selectedProfileId === 'all' 
        ? null 
        : libraryProfiles.find(p => p.id === selectedProfileId);

      const params = new URLSearchParams({
        mediaType: selectedProfile ? selectedProfile.media_type : 'all',
        unwatchedOnly: unwatchedOnly.toString(),
        sortBy,
        sortOrder,
        limit: '50'
      });

      if (selectedProfile) {
        params.append('rootFolder', selectedProfile.root_folder);
      }

      const res = await fetch(`/api/v1/curate/feed?${params}`, {
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        setFeed(data.items || []);
        setFeedTotal(data.total || 0);
        setCurrentIndex(0);
      } else {
        setFeedError('Failed to fetch curation cards');
      }
    } catch (err) {
      setFeedError('Error loading curation feed');
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const handleProfileUpdate = async (
    action: 'left' | 'right' | 'up' | 'down' | 'unmonitor' | 'delete', 
    color: string, 
    message: string
  ) => {
    if (!feed.length || currentIndex >= feed.length) return;
    const targetItem = feed[currentIndex];

    // Optimistically update counts and advance deck card immediately
    setSessionCuratedCount(prev => prev + 1);
    setCurrentIndex(prev => prev + 1);

    // Run network staging in the background to eliminate swipe lag
    (async () => {
      try {
        const res = await fetch('/api/v1/curate/action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
          },
          body: JSON.stringify({
            itemId: targetItem.id,
            mediaType: targetItem.mediaType,
            action
          })
        });

        if (res.ok) {
          // Fetch queue and update counts in the background
          await fetchDeletionQueue();
        } else {
          console.error('Failed to submit curation action to backend');
          // Rollback state if staging failed
          setSessionCuratedCount(prev => Math.max(0, prev - 1));
          setCurrentIndex(prev => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Network error staging curation action', err);
        // Rollback state if connection failed
        setSessionCuratedCount(prev => Math.max(0, prev - 1));
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
    })();
  };

  const handleSkip = async () => {
    if (!feed.length || currentIndex >= feed.length) return;
    const targetItem = feed[currentIndex];
    
    // Optimistically advance deck card immediately
    setCurrentIndex(prev => prev + 1);

    // Run network skip in the background to eliminate swipe lag
    (async () => {
      try {
        const res = await fetch('/api/v1/curate/skip', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
          },
          body: JSON.stringify({
            itemId: targetItem.id,
            mediaType: targetItem.mediaType
          })
        });
        if (!res.ok) {
          console.error('Failed to skip card', res.statusText);
          // Rollback state if skip failed
          setCurrentIndex(prev => Math.max(0, prev - 1));
        }
      } catch (err) {
        console.error('Failed to skip card', err);
        // Rollback state if connection failed
        setCurrentIndex(prev => Math.max(0, prev - 1));
      }
    })();
  };

  const handleResetTestData = async () => {
    setIsResettingData(true);
    try {
      const res = await fetch('/api/v1/test/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        }
      });
      if (res.ok) {
        setCurrentIndex(0);
        setSessionCuratedCount(0);
        await fetchFeed();
        await fetchDeletionQueue();
      } else {
        console.error('Failed to reset test data on server');
      }
    } catch (err) {
      console.error('Error resetting test data', err);
    } finally {
      setIsResettingData(false);
    }
  };

  // Deletion Queue Management
  const fetchDeletionQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const res = await fetch('/api/v1/queue', {
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        setDeletionQueue(data || []);
        setDeletionQueueCount(data?.length || 0);
      }
    } catch (e) {
      console.error('Failed to load deletion queue', e);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  const handleRemoveFromQueue = async (id: number) => {
    try {
      const res = await fetch(`/api/v1/queue/${id}`, {
        method: 'DELETE',
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        await fetchDeletionQueue();
      } else {
        console.error('Failed to remove item from queue');
      }
    } catch (e) {
      console.error('Error removing item from queue', e);
    }
  };

  const handleExecuteDeletions = async () => {
    setDeleteConfirmCount(0);
    setDeleteProgress({ current: 0, total: deletionQueue.length, title: 'Starting deletions...' });
    
    try {
      const response = await fetch('/api/v1/queue', {
        method: 'DELETE',
        headers: { 'X-Api-Key': apiKey }
      });
      
      const reader = response.body?.getReader();
      if (!reader) {
        setDeleteProgress(null);
        fetchDeletionQueue();
        return;
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setDeleteProgress({
                current: data.current,
                total: data.total,
                title: data.title
              });
            } else if (data.type === 'complete') {
              setDeleteProgress(null);
              fetchDeletionQueue();
            }
          } catch (err) {
            console.error('Chunk parsing error', err);
          }
        }
      }
    } catch (err) {
      console.error('Error running queue deletion', err);
      setDeleteProgress(null);
      fetchDeletionQueue();
    }
  };

  // Logs stream
  const fetchLogs = async () => {
    setIsRefreshingLogs(true);
    try {
      const res = await fetch(`/api/v1/system/logs?type=${logType}`, {
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        const text = await res.text();
        setLogsText(text || 'No logs available.');
      } else {
        setLogsText('Failed to retrieve server log files.');
      }
    } catch (e) {
      setLogsText('Error connecting to log streaming endpoint.');
    } finally {
      setIsRefreshingLogs(false);
    }
  };

  const fetchDiscoveredLibraries = async () => {
    setIsLoadingRoots(true);
    setLibraryError('');
    try {
      const [radarrRes, sonarrRes] = await Promise.all([
        fetch('/api/v1/radarr/rootfolders', { headers: { 'X-Api-Key': apiKey } }),
        fetch('/api/v1/sonarr/rootfolders', { headers: { 'X-Api-Key': apiKey } })
      ]);
      
      if (radarrRes.ok) {
        const radarrData = await radarrRes.json();
        setRadarrRoots(Array.isArray(radarrData) ? radarrData : []);
      }
      if (sonarrRes.ok) {
        const sonarrData = await sonarrRes.json();
        setSonarrRoots(Array.isArray(sonarrData) ? sonarrData : []);
      }
    } catch (err) {
      console.error('Failed to discover libraries', err);
      setLibraryError('Error discovering root folders from active connections.');
    } finally {
      setIsLoadingRoots(false);
    }
  };

  useEffect(() => {
    if (settingsSubTab === 'libraries') {
      fetchDiscoveredLibraries();
    }
  }, [settingsSubTab]);

  const toggleLibraryPath = async (path: string, mediaType: 'movie' | 'tv', checked: boolean, existingId?: number) => {
    try {
      if (checked) {
        // Derive name from last path segment and capitalize it (handle both / and \ paths)
        const normalizedPath = path.replace(/\\/g, '/');
        const segments = normalizedPath.split('/').filter(Boolean);
        const lastSegment = segments[segments.length - 1] || 'Library';
        const name = lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);

        const res = await fetch('/api/v1/settings/libraries', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey
          },
          body: JSON.stringify({
            name,
            mediaType,
            rootFolder: path
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          alert(errData.error || 'Failed to add library.');
        }
      } else if (existingId) {
        const res = await fetch(`/api/v1/settings/libraries/${existingId}`, {
          method: 'DELETE',
          headers: {
            'X-Api-Key': apiKey
          }
        });

        if (!res.ok) {
          alert('Failed to remove library.');
        }
      }
      
      // Refresh Siftarr library profiles (saved ones)
      await fetchLibraryProfiles();
    } catch (err) {
      console.error('Failed to toggle library path', err);
    }
  };

  // Settings tab methods
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/v1/settings', {
        headers: { 'X-Api-Key': apiKey }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data || {});
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const fetchArrProfiles = async () => {
    try {
      const [radarrRes, sonarrRes] = await Promise.all([
        fetch('/api/v1/radarr/profiles', { headers: { 'X-Api-Key': apiKey } }),
        fetch('/api/v1/sonarr/profiles', { headers: { 'X-Api-Key': apiKey } })
      ]);
      if (radarrRes.ok) setRadarrProfiles(await radarrRes.json());
      if (sonarrRes.ok) setSonarrProfiles(await sonarrRes.json());
    } catch (e) {
      console.error('Failed to fetch *arr quality profiles', e);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSettingsStatus(null);
    try {
      const res = await fetch('/api/v1/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSettingsStatus({ type: 'success', message: 'Configuration saved successfully!' });
        // Update dry run status locally from changes
        if (settings.dry_run !== undefined) {
          setDryRun(settings.dry_run === 'true');
        }
      } else {
        setSettingsStatus({ type: 'error', message: 'Failed to update Siftarr settings.' });
      }
    } catch (e) {
      setSettingsStatus({ type: 'error', message: 'Network error saving settings.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const testConnection = async (service: 'radarr' | 'sonarr' | 'tautulli' | 'overseerr') => {
    setTestStatus(prev => ({ ...prev, [service]: 'loading' }));
    try {
      const url = settings[`${service}_url`] || '';
      const serviceKey = settings[`${service}_api_key`] || '';
      
      const res = await fetch(`/api/v1/settings/test/${service}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey
        },
        body: JSON.stringify({ url, apiKey: serviceKey })
      });
      
      if (res.ok) {
        const data = await res.json();
        setTestStatus(prev => ({ ...prev, [service]: data.success ? 'success' : 'failed' }));
      } else {
        setTestStatus(prev => ({ ...prev, [service]: 'failed' }));
      }
    } catch (e) {
      setTestStatus(prev => ({ ...prev, [service]: 'failed' }));
    }
  };



  // Deletion Queue Confirmation activation logic
  const handleDeletionConfirmClick = () => {
    setDeleteConfirmCount(1);
    // Timeout reset confirmation tap
    setTimeout(() => {
      setDeleteConfirmCount(prev => prev === 1 ? 0 : prev);
    }, 5000);
  };

  // Unauthenticated setup gate screen
  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '32px 24px', borderRadius: '24px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'rgba(124, 77, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid rgba(124, 77, 255, 0.3)' }}>
            <Key size={22} color="var(--violet)" />
          </div>
          <h2 style={{ fontFamily: 'var(--font-header)', margin: '0 0 8px 0', fontSize: '24px' }}>Authorize Siftarr</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px 0', lineHeight: 1.5 }}>
            Please enter your Siftarr API Key. This was generated when Siftarr started and can be found in your container log output.
          </p>

          <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
                Siftarr API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter 32-character API key"
                style={{
                  width: 'calc(100% - 24px)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '14px',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            {authError && (
              <div style={{ color: 'var(--crimson)', fontSize: '12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={14} />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isValidatingAuth}
              className="glass-button"
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--green)',
                color: '#000',
                border: 'none',
                fontWeight: 'bold',
                borderRadius: '10px',
                marginTop: '8px'
              }}
            >
              {isValidatingAuth ? 'Validating API Key...' : 'Access Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active item in feed helper
  const currentItem = feed[currentIndex];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Dry Run Warning Banner */}
      {dryRun && (
        <div style={{
          backgroundColor: 'rgba(124, 77, 255, 0.15)',
          borderBottom: '1px solid rgba(124, 77, 255, 0.3)',
          color: '#b39ddb',
          textAlign: 'center',
          padding: '8px 16px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          fontSize: '12px',
          fontWeight: 500,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000
        }}>
          <AlertTriangle size={14} color="var(--violet)" />
          <span>DRY RUN ACTIVE — Settings will execute but files will not be deleted or modified in Arr stacks</span>
        </div>
      )}

      {/* Header */}
      <header className="glass-panel" style={{ 
        margin: '16px', 
        marginTop: dryRun ? '16px' : 'calc(env(safe-area-inset-top, 0px) + 16px)',
        padding: '12px 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        borderRadius: '16px', 
        borderBottom: '1px solid rgba(255,255,255,0.06)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/siftarr.png" alt="Siftarr Logo" style={{ height: '24px', width: '24px', objectFit: 'contain' }} />
          <span style={{ fontFamily: 'var(--font-header)', fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.05em' }}>SIFTARR</span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 16px 100px 16px', maxWidth: '600px', margin: '0 auto', width: 'calc(100% - 32px)' }}>
        
        {/* Progress Bar & Filter Row (Only displayed for Curation Feed tab) */}
        {activeTab === 'curate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                       {/* Library Selector Dropdown */}
            <div style={{ position: 'relative', marginBottom: '8px', zIndex: isLibraryDropdownOpen ? 50 : 10 }}>
              <button
                onClick={() => setIsLibraryDropdownOpen(!isLibraryDropdownOpen)}
                className="glass-button"
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  justifyContent: 'space-between',
                  borderRadius: '100px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedProfileId === 'all' ? (
                    <>
                      <LayoutGrid size={14} color="var(--green)" />
                      <span>
                        <strong>All Libraries</strong>
                      </span>
                    </>
                  ) : (
                    (() => {
                      const profile = libraryProfiles.find(p => p.id === selectedProfileId);
                      if (!profile) return <span><strong>All Libraries</strong></span>;
                      return (
                        <>
                          {profile.media_type === 'movie' ? <Film size={14} color="var(--green)" /> : <Tv size={14} color="var(--green)" />}
                          <span>
                            <strong>{profile.name}</strong>{' '}
                            <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '11px' }}>({profile.media_type})</span>
                          </span>
                        </>
                      );
                    })()
                  )}
                </span>
                <ChevronDown size={14} style={{ transform: isLibraryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
              </button>

              {isLibraryDropdownOpen && (
                <>
                  <div 
                    onClick={() => setIsLibraryDropdownOpen(false)} 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                  />
                  
                  <div 
                    className="glass-panel" 
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      right: 0,
                      zIndex: 100,
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '6px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                      backgroundColor: '#0a0a0a',
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedProfileId('all');
                        setIsLibraryDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        textAlign: 'left',
                        border: 'none',
                        background: selectedProfileId === 'all' ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                        color: selectedProfileId === 'all' ? 'var(--green)' : '#fff',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontWeight: selectedProfileId === 'all' ? 'bold' : 'normal'
                      }}
                    >
                      <LayoutGrid size={14} />
                      <span>All Libraries</span>
                    </button>

                    {libraryProfiles.map(profile => (
                      <button
                        key={profile.id}
                        onClick={() => {
                          setSelectedProfileId(profile.id);
                          setIsLibraryDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          textAlign: 'left',
                          border: 'none',
                          background: selectedProfileId === profile.id ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                          color: selectedProfileId === profile.id ? 'var(--green)' : '#fff',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontWeight: selectedProfileId === profile.id ? 'bold' : 'normal'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {profile.media_type === 'movie' ? <Film size={14} /> : <Tv size={14} />}
                          <span>
                            {profile.name}{' '}
                            <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'normal' }}>
                              ({profile.media_type})
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>


            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                {!currentItem ? (feed.length > 0 ? 'Curation Complete' : 'Inbox Empty') : `Card ${currentIndex + 1} of ${feed.length}`}
              </span>
              <button 
                className="glass-button" 
                style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '8px' }}
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal size={12} /> Filters
              </button>
            </div>

            {showFilters && (
              <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>Sort By</label>
                  <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value as any)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '8px' }}
                  >
                    <option value="size">Largest File Size first</option>
                    <option value="plays">Least Played (Tautulli) first</option>
                    <option value="score">Lowest Custom Format Score</option>
                    <option value="added">Recently Added</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '4px' }}>Media Type</label>
                  <select 
                    value={selectedMediaType} 
                    onChange={e => setSelectedMediaType(e.target.value as any)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '8px' }}
                  >
                    <option value="all">All Items</option>
                    <option value="movie">Movies Only</option>
                    <option value="tv">TV Shows Only</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="checkbox"
                    id="unwatched"
                    checked={unwatchedOnly}
                    onChange={e => setUnwatchedOnly(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="unwatched" style={{ color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                    Show Unwatched Media Only (Requires Tautulli Integration)
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CURATE TAB */}
        {activeTab === 'curate' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
            
            {isLoadingFeed ? (
              <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', borderRadius: '24px' }}>
                <RefreshCw size={32} className="spin-animation" color="var(--violet)" />
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading curation feed...</span>
              </div>
            ) : feedError ? (
              <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
                <XCircle size={40} color="var(--crimson)" />
                <span style={{ fontSize: '15px' }}>{feedError}</span>
                <button className="glass-button" style={{ padding: '8px 16px' }} onClick={fetchFeed}>Retry Loading</button>
              </div>
            ) : !currentItem ? (
              <div className="glass-panel" style={{ height: '350px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', borderRadius: '24px', padding: '24px', textAlign: 'center' }}>
                <CheckCircle size={48} color="var(--green)" />
                <h3 style={{ margin: 0, fontFamily: 'var(--font-header)', fontSize: '20px' }}>Library Clean!</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>All items have been curated. Check back later or adjust filters.</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                  <button className="glass-button" style={{ padding: '8px 16px' }} onClick={fetchFeed}>
                    <RefreshCw size={14} /> Refresh Cache
                  </button>
                  <button 
                    className="glass-button" 
                    style={{ padding: '8px 16px', border: '1px solid rgba(124, 77, 255, 0.3)', backgroundColor: 'rgba(124, 77, 255, 0.05)', color: '#b39ddb' }} 
                    onClick={handleResetTestData}
                    disabled={isResettingData}
                  >
                    <RefreshCw size={14} className={isResettingData ? "spin-animation" : ""} /> Reset Curation & Cache
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '520px' }}>
                <AnimatePresence mode="popLayout">
                  {feed.slice(currentIndex, currentIndex + 3).reverse().map((item, index, arr) => {
                    const isTop = item.id === currentItem.id;
                    const stackOffset = arr.length - 1 - index;
                    return (
                      <CurationCard 
                        key={item.id}
                        item={item}
                        settings={settings}
                        apiKey={apiKey}
                        exitDirection={exitDirection}
                        setExitDirection={setExitDirection}
                        onAction={handleProfileUpdate}
                        onSkip={handleSkip}
                        isBackground={!isTop}
                        stackOffset={stackOffset}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

          </div>
        )}

        {/* DELETION QUEUE TAB */}
        {activeTab === 'queue' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-header)', fontSize: '20px' }}>Deletion Queue</h3>
              <span style={{ fontSize: '12px', background: 'rgba(255,23,68,0.15)', color: 'var(--crimson)', padding: '4px 10px', borderRadius: '8px', fontWeight: 600 }}>
                {deletionQueue.length} Items Pending
              </span>
            </div>

            {isLoadingQueue ? (
              <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
                <RefreshCw size={24} className="spin-animation" color="var(--violet)" />
              </div>
            ) : deletionQueue.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                No movies or series marked for deletion.
              </div>
            ) : (
              <>
                {/* Deletion list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {deletionQueue.map((item, index) => (
                    <div 
                      key={item.id || index} 
                      style={{ 
                        padding: '12px', 
                        background: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.04)', 
                        borderRadius: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {item.year} • {item.media_type.toUpperCase()} • {formatBytes(item.size_bytes)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          {item.library_name}
                        </span>
                        <button
                          className="glass-button"
                          onClick={() => handleRemoveFromQueue(item.id)}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.02)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                          title="Remove from queue"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Progress bar loader */}
                {deleteProgress && (
                  <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px', background: 'rgba(0,0,0,0.4)', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>Deleting: {deleteProgress.title}</span>
                      <span>{deleteProgress.current} / {deleteProgress.total}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${(deleteProgress.current / deleteProgress.total) * 100}%`, 
                          height: '100%', 
                          background: 'var(--crimson)',
                          boxShadow: '0 0 8px var(--crimson)',
                          transition: 'width 0.1s linear'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Confirm deletions action buttons */}
                {!deleteProgress && (
                  deleteConfirmCount > 0 ? (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px', width: '100%' }}>
                      <button 
                        className="glass-button" 
                        onClick={() => setDeleteConfirmCount(0)}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          background: 'rgba(20, 20, 20, 0.8)', 
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#fff',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          backdropFilter: 'blur(12px)'
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="glass-button" 
                        onClick={handleExecuteDeletions}
                        style={{ 
                          flex: 1, 
                          padding: '12px', 
                          background: 'var(--crimson)', 
                          borderColor: 'rgba(255, 23, 68, 0.3)',
                          color: '#fff',
                          fontWeight: 'bold',
                          borderRadius: '12px',
                          boxShadow: '0 0 12px rgba(255, 23, 68, 0.4)'
                        }}
                      >
                        Confirm Deletions
                      </button>
                    </div>
                  ) : (
                    <button 
                      className="glass-button" 
                      onClick={handleDeletionConfirmClick}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        background: 'rgba(255,23,68,0.1)', 
                        borderColor: 'rgba(255,23,68,0.3)',
                        color: 'var(--crimson)',
                        fontWeight: 'bold',
                        marginTop: '10px'
                      }}
                    >
                      Execute Queue Deletions
                    </button>
                  )
                )}
              </>
            )}
          </div>
        )}


        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className="glass-button" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }} 
                  onClick={() => setActiveTab('settings')}
                  title="Back to Settings"
                >
                  <ArrowLeft size={14} />
                </button>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-header)', fontSize: '20px' }}>System Logs</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={logType}
                  onChange={e => setLogType(e.target.value as any)}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '8px', fontSize: '12px' }}
                >
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                  <option value="trace">Trace</option>
                </select>
                <button 
                  className="glass-button" 
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={fetchLogs}
                  disabled={isRefreshingLogs}
                >
                  {isRefreshingLogs ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div 
              style={{ 
                background: '#000', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '12px', 
                padding: '16px', 
                height: '320px', 
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#a5d6a7',
                whiteSpace: 'pre-wrap',
                textAlign: 'left'
              }}
            >
              {logsText}
            </div>
          </div>
        )}

        {/* SYSTEM SETUP TAB */}
        {activeTab === 'settings' && (
          <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-header)', fontSize: '20px' }}>Siftarr Configuration</h3>
            </div>

            {/* Sub-tabs selector */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              gap: '6px', 
              padding: '4px', 
              background: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '12px', 
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              {[
                { id: 'general', label: 'General' },
                { id: 'connections', label: 'Connections' },
                { id: 'libraries', label: 'Libraries' },
                { id: 'gestures', label: 'Gestures' },
                { id: 'diagnostics', label: 'Diagnostics' }
              ].map(subTab => (
                <button
                  key={subTab.id}
                  onClick={() => setSettingsSubTab(subTab.id as any)}
                  style={{
                    flex: '1 1 100px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: settingsSubTab === subTab.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    color: settingsSubTab === subTab.id ? '#fff' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: settingsSubTab === subTab.id ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                    border: settingsSubTab === subTab.id ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                  }}
                >
                  {subTab.label}
                </button>
              ))}
            </div>

            {/* Config settings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Siftarr settings */}
              {settingsSubTab === 'general' && (
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--violet)', letterSpacing: '0.05em' }}>General Settings</h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Dry Run Mode</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Stops real database/file deletions or mutations</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.dry_run === 'true'}
                      onChange={e => handleSettingChange('dry_run', e.target.checked ? 'true' : 'false')}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              )}

              {/* Connections (Radarr, Sonarr, Tautulli, Overseerr) */}
              {settingsSubTab === 'connections' && (
                <>
                  {/* Radarr Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--blue)', letterSpacing: '0.05em' }}>Radarr (Movies)</h4>
                      <button 
                        className="glass-button" 
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => testConnection('radarr')}
                        disabled={testStatus.radarr === 'loading'}
                      >
                        {testStatus.radarr === 'loading' ? 'Testing...' : testStatus.radarr === 'success' ? '✅ Connected' : testStatus.radarr === 'failed' ? '❌ Failed' : 'Test Connection'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>RADARR URL</label>
                      <input
                        type="text"
                        value={settings.radarr_url || ''}
                        onChange={e => handleSettingChange('radarr_url', e.target.value)}
                        placeholder="http://192.168.1.100:7878"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>RADARR API KEY</label>
                      <input
                        type="password"
                        value={settings.radarr_api_key || ''}
                        onChange={e => handleSettingChange('radarr_api_key', e.target.value)}
                        placeholder="Enter Radarr API Key"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Delete File on Upgrade</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Clears old movie files before pushing upgrades</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.delete_file_on_upgrade === 'true'}
                        onChange={e => handleSettingChange('delete_file_on_upgrade', e.target.checked ? 'true' : 'false')}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Delete File on Downgrade</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Clears old movie files before pushing downgrades</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.delete_file_on_downgrade === 'true'}
                        onChange={e => handleSettingChange('delete_file_on_downgrade', e.target.checked ? 'true' : 'false')}
                      />
                    </div>
                  </div>

                  {/* Sonarr Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--green)', letterSpacing: '0.05em' }}>Sonarr (TV Shows)</h4>
                      <button 
                        className="glass-button" 
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => testConnection('sonarr')}
                        disabled={testStatus.sonarr === 'loading'}
                      >
                        {testStatus.sonarr === 'loading' ? 'Testing...' : testStatus.sonarr === 'success' ? '✅ Connected' : testStatus.sonarr === 'failed' ? '❌ Failed' : 'Test Connection'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SONARR URL</label>
                      <input
                        type="text"
                        value={settings.sonarr_url || ''}
                        onChange={e => handleSettingChange('sonarr_url', e.target.value)}
                        placeholder="http://192.168.1.100:8989"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SONARR API KEY</label>
                      <input
                        type="password"
                        value={settings.sonarr_api_key || ''}
                        onChange={e => handleSettingChange('sonarr_api_key', e.target.value)}
                        placeholder="Enter Sonarr API Key"
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* Tautulli Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--gold)', letterSpacing: '0.05em' }}>Tautulli (Plex Stats)</h4>
                      <button 
                        className="glass-button" 
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => testConnection('tautulli')}
                        disabled={testStatus.tautulli === 'loading' || settings.is_tautulli_enabled !== 'true'}
                      >
                        {testStatus.tautulli === 'loading' ? 'Testing...' : testStatus.tautulli === 'success' ? '✅ Connected' : testStatus.tautulli === 'failed' ? '❌ Failed' : 'Test Connection'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Enable Tautulli watch stats integration</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.is_tautulli_enabled === 'true'}
                        onChange={e => handleSettingChange('is_tautulli_enabled', e.target.checked ? 'true' : 'false')}
                      />
                    </div>
                    {settings.is_tautulli_enabled === 'true' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TAUTULLI URL</label>
                          <input
                            type="text"
                            value={settings.tautulli_url || ''}
                            onChange={e => handleSettingChange('tautulli_url', e.target.value)}
                            placeholder="http://192.168.1.100:8181"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>TAUTULLI API KEY</label>
                          <input
                            type="password"
                            value={settings.tautulli_api_key || ''}
                            onChange={e => handleSettingChange('tautulli_api_key', e.target.value)}
                            placeholder="Enter Tautulli API Key"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Overseerr Settings */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--violet)', letterSpacing: '0.05em' }}>Overseerr / Seerr</h4>
                      <button 
                        className="glass-button" 
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => testConnection('overseerr')}
                        disabled={testStatus.overseerr === 'loading' || settings.is_overseerr_enabled !== 'true'}
                      >
                        {testStatus.overseerr === 'loading' ? 'Testing...' : testStatus.overseerr === 'success' ? '✅ Connected' : testStatus.overseerr === 'failed' ? '❌ Failed' : 'Test Connection'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>Enable Overseerr clean deletes integration</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.is_overseerr_enabled === 'true'}
                        onChange={e => handleSettingChange('is_overseerr_enabled', e.target.checked ? 'true' : 'false')}
                      />
                    </div>
                    {settings.is_overseerr_enabled === 'true' && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OVERSEERR URL</label>
                          <input
                            type="text"
                            value={settings.overseerr_url || ''}
                            onChange={e => handleSettingChange('overseerr_url', e.target.value)}
                            placeholder="http://192.168.1.100:5055"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>OVERSEERR API KEY</label>
                          <input
                            type="password"
                            value={settings.overseerr_api_key || ''}
                            onChange={e => handleSettingChange('overseerr_api_key', e.target.value)}
                            placeholder="Enter Overseerr API Key"
                            style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}

              {/* Libraries Configuration */}
              {settingsSubTab === 'libraries' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', textTransform: 'uppercase', color: 'var(--green)', letterSpacing: '0.05em' }}>Library Discovery</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                      Toggle which folders from Radarr and Sonarr you want to sync into Siftarr. Enabled libraries will automatically be cached and synced in the background.
                    </p>

                    {libraryError && (
                      <div style={{ color: 'var(--crimson)', fontSize: '12px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>⚠️ {libraryError}</span>
                      </div>
                    )}

                    {isLoadingRoots ? (
                      <div style={{ padding: '30px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <RefreshCw size={24} className="spin-animation" color="var(--violet)" />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Scanning connection paths...</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Radarr Sections */}
                        <div>
                          <h5 style={{ margin: '0 0 10px 0', color: 'var(--blue)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Radarr Movies</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {radarrRoots.length === 0 ? (
                              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                No folders discovered. Ensure Radarr connection is working.
                              </div>
                            ) : (
                              radarrRoots.map((root) => {
                                const matchedProfile = libraryProfiles.find(p => p.media_type === 'movie' && p.root_folder === root.path);
                                const isChecked = !!matchedProfile;
                                const existingId = matchedProfile?.id;
                                return (
                                  <label 
                                    key={root.path}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      padding: '12px 16px', 
                                      background: isChecked ? 'rgba(33, 150, 243, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                                      border: isChecked ? '1px solid rgba(33, 150, 243, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                                      borderRadius: '10px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                                        {isChecked ? matchedProfile.name : (() => {
                                          const norm = root.path.replace(/\\/g, '/');
                                          const segs = norm.split('/').filter(Boolean);
                                          const last = segs[segs.length - 1] || 'Movies';
                                          return last.charAt(0).toUpperCase() + last.slice(1);
                                        })()}
                                      </div>
                                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                                        {root.path}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                                        {formatBytes(root.freeSpace || 0)} free space
                                      </div>
                                    </div>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={(e) => toggleLibraryPath(root.path, 'movie', e.target.checked, existingId)}
                                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Sonarr Sections */}
                        <div>
                          <h5 style={{ margin: '0 0 10px 0', color: 'var(--green)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.05em' }}>Sonarr TV Shows</h5>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sonarrRoots.length === 0 ? (
                              <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                No folders discovered. Ensure Sonarr connection is working.
                              </div>
                            ) : (
                              sonarrRoots.map((root) => {
                                const matchedProfile = libraryProfiles.find(p => p.media_type === 'tv' && p.root_folder === root.path);
                                const isChecked = !!matchedProfile;
                                const existingId = matchedProfile?.id;
                                return (
                                  <label 
                                    key={root.path}
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'space-between',
                                      padding: '12px 16px', 
                                      background: isChecked ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
                                      border: isChecked ? '1px solid rgba(0, 230, 118, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                                      borderRadius: '10px',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#fff' }}>
                                        {isChecked ? matchedProfile.name : (() => {
                                          const norm = root.path.replace(/\\/g, '/');
                                          const segs = norm.split('/').filter(Boolean);
                                          const last = segs[segs.length - 1] || 'TV Shows';
                                          return last.charAt(0).toUpperCase() + last.slice(1);
                                        })()}
                                      </div>
                                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>
                                        {root.path}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                                        {formatBytes(root.freeSpace || 0)} free space
                                      </div>
                                    </div>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={(e) => toggleLibraryPath(root.path, 'tv', e.target.checked, existingId)}
                                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                    />
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Gestures (Swipe directional configurations) */}
              {settingsSubTab === 'gestures' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: '#ffb300', letterSpacing: '0.05em' }}>Curation Swipe Gestures</h4>
                  
                  {['left', 'right', 'up', 'down'].map((dir) => {
                    const action = settings[`swipe_${dir}_action`] || (dir === 'down' ? 'delete' : 'profile');
                    const color = settings[`swipe_${dir}_color`] || 
                      (dir === 'left' ? '#00b0ff' : dir === 'right' ? '#00e676' : dir === 'up' ? '#ffd600' : '#ff1744');
                    const label = settings[`swipe_${dir}_label`] !== undefined ? settings[`swipe_${dir}_label`] : 
                      (dir === 'left' ? 'Standard Profile' : dir === 'right' ? 'Upgraded Profile' : dir === 'up' ? 'God Tier Profile' : 'Delete');

                    const defaultRadarrId = dir === 'left' ? '1' : dir === 'right' ? '2' : dir === 'up' ? '3' : '1';
                    const defaultSonarrId = dir === 'left' ? '1' : dir === 'right' ? '2' : dir === 'up' ? '3' : '1';

                    const radarrProfileId = settings[`swipe_${dir}_radarr_profile_id`] || settings[`radarr_swipe_${dir}_profile_id`] || defaultRadarrId;
                    const sonarrProfileId = settings[`swipe_${dir}_sonarr_profile_id`] || settings[`sonarr_swipe_${dir}_profile_id`] || defaultSonarrId;

                    return (
                      <div key={dir} style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '8px', 
                        background: 'rgba(255,255,255,0.01)', 
                        padding: '12px', 
                        borderRadius: '10px', 
                        border: `1px solid ${color}33`,
                        boxShadow: `0 0 10px ${color}0b`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'capitalize', color: color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>Swipe {dir}</span>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }}></span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '11px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>ACTION</span>
                            <select 
                              value={action} 
                              onChange={e => handleSettingChange(`swipe_${dir}_action`, e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px' }}
                            >
                              <option value="profile">Quality Profile Upgrade</option>
                              <option value="delete">Delete</option>
                              <option value="unmonitor">Unmonitor</option>
                              <option value="skip">Keep / Skip</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>COLOR</span>
                            <select 
                              value={color} 
                              onChange={e => handleSettingChange(`swipe_${dir}_color`, e.target.value)}
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px' }}
                            >
                              <option value="#00b0ff">🔵 Blue</option>
                              <option value="#00e676">🟢 Green</option>
                              <option value="#ffd600">🟡 Gold</option>
                              <option value="#ff1744">🔴 Crimson</option>
                              <option value="#7c4dff">🟣 Violet</option>
                              <option value="#90a4ae">⚪ Slate</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: 'span 2' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>CUSTOM LABEL</span>
                            <input 
                              type="text"
                              value={label}
                              onChange={e => handleSettingChange(`swipe_${dir}_label`, e.target.value)}
                              placeholder="e.g. Delete"
                              style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '6px' }}
                            />
                          </div>

                          {action === 'profile' && (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>RADARR PROFILE (MOVIES)</span>
                                <select 
                                  value={radarrProfileId} 
                                  onChange={e => {
                                    handleSettingChange(`swipe_${dir}_radarr_profile_id`, e.target.value);
                                    handleSettingChange(`radarr_swipe_${dir}_profile_id`, e.target.value);
                                  }}
                                  style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px' }}
                                >
                                  <option value="">-- Select Profile --</option>
                                  {radarrProfiles.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
                                </select>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>SONARR PROFILE (TV)</span>
                                <select 
                                  value={sonarrProfileId} 
                                  onChange={e => {
                                    handleSettingChange(`swipe_${dir}_sonarr_profile_id`, e.target.value);
                                    handleSettingChange(`sonarr_swipe_${dir}_profile_id`, e.target.value);
                                  }}
                                  style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '6px' }}
                                >
                                  <option value="">-- Select Profile --</option>
                                  {sonarrProfiles.map(p => <option key={p.id} value={p.id.toString()}>{p.name}</option>)}
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Diagnostics & Logs */}
              {settingsSubTab === 'diagnostics' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--violet)', letterSpacing: '0.05em' }}>Diagnostics</h4>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button 
                      className="glass-button" 
                      style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}
                      onClick={() => setActiveTab('logs')}
                    >
                      <Terminal size={14} /> View System Logs
                    </button>
                    <button 
                      className="glass-button" 
                      style={{ flex: 1, padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '8px', border: '1px solid rgba(124, 77, 255, 0.3)', backgroundColor: 'rgba(124, 77, 255, 0.05)', color: '#b39ddb' }}
                      onClick={handleResetTestData}
                      disabled={isResettingData}
                    >
                      <RefreshCw size={14} className={isResettingData ? "spin-animation" : ""} /> Reset Curation & Cache
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Save indicator & save action button */}
            {settingsStatus && (
              <div style={{ 
                color: settingsStatus.type === 'success' ? 'var(--green)' : 'var(--crimson)', 
                fontSize: '13px', 
                textAlign: 'center', 
                padding: '8px', 
                background: settingsStatus.type === 'success' ? 'rgba(0,230,118,0.1)' : 'rgba(255,23,68,0.1)',
                borderRadius: '8px'
              }}>
                {settingsStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="glass-button" style={{ flex: 1, padding: '12px' }} onClick={() => setActiveTab('curate')}>Cancel</button>
              <button 
                className="glass-button" 
                style={{ flex: 1, padding: '12px', background: 'var(--green)', color: '#000', border: 'none', fontWeight: 'bold' }} 
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
              >
                {isSavingSettings ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}

      </main>


      {/* Bottom Navigation Bar styled exactly like the Stitch Mockup */}
      <nav 
        className="glass-panel" 
        style={{ 
          position: 'fixed', 
          bottom: '0', 
          left: '0', 
          right: '0', 
          height: '72px', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          padding: '0 8px 12px 8px', 
          borderRadius: '24px 24px 0 0', 
          zIndex: 900,
          backgroundColor: '#050505',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: 'none',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.9)'
        }}
      >
        {/* Manage Button */}
        <button 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
          onClick={() => setActiveTab('curate')}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: activeTab === 'curate' ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
            border: activeTab === 'curate' ? '1px solid var(--green)' : '1px solid transparent',
            boxShadow: activeTab === 'curate' ? '0 0 10px rgba(0, 230, 118, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}>
            <LayoutGrid size={18} color={activeTab === 'curate' ? '#fff' : 'var(--text-secondary)'} />
          </div>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 600,
            color: activeTab === 'curate' ? 'var(--green)' : 'var(--text-secondary)',
            textShadow: activeTab === 'curate' ? '0 0 6px rgba(0, 230, 118, 0.4)' : 'none'
          }}>
            Manage
          </span>
        </button>

        {/* Queue Button */}
        <button 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', position: 'relative' }}
          onClick={() => setActiveTab('queue')}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: activeTab === 'queue' ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
            border: activeTab === 'queue' ? '1px solid var(--green)' : '1px solid transparent',
            boxShadow: activeTab === 'queue' ? '0 0 10px rgba(0, 230, 118, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}>
            <Trash2 size={18} color={activeTab === 'queue' ? '#fff' : 'var(--text-secondary)'} />
          </div>
          {deletionQueueCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: 'calc(50% - 20px)',
              backgroundColor: '#ff1744',
              color: '#fff',
              borderRadius: '50%',
              width: '15px',
              height: '15px',
              fontSize: '9px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #050505',
              boxShadow: '0 0 6px rgba(255,23,68,0.5)'
            }}>
              {deletionQueueCount}
            </span>
          )}
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 600,
            color: activeTab === 'queue' ? 'var(--green)' : 'var(--text-secondary)',
            textShadow: activeTab === 'queue' ? '0 0 6px rgba(0, 230, 118, 0.4)' : 'none'
          }}>
            Queue
          </span>
        </button>

        {/* Settings Button */}
        <button 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
          onClick={() => setActiveTab('settings')}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: activeTab === 'settings' ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
            border: activeTab === 'settings' ? '1px solid var(--green)' : '1px solid transparent',
            boxShadow: activeTab === 'settings' ? '0 0 10px rgba(0, 230, 118, 0.3)' : 'none',
            transition: 'all 0.2s ease'
          }}>
            <Settings size={18} color={activeTab === 'settings' ? '#fff' : 'var(--text-secondary)'} />
          </div>
          <span style={{ 
            fontSize: '10px', 
            fontWeight: 600,
            color: activeTab === 'settings' ? 'var(--green)' : 'var(--text-secondary)',
            textShadow: activeTab === 'settings' ? '0 0 6px rgba(0, 230, 118, 0.4)' : 'none'
          }}>
            Settings
          </span>
        </button>
      </nav>

    </div>
  );
}
