import React, { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { 
  Film, 
  Tv, 
  Star, 
  Sparkles, 
  Crown, 
  EyeOff, 
  Check, 
  Info 
} from 'lucide-react';

export interface MediaItem {
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

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getGenres = (item: MediaItem) => {
  const genresList = [
    'Sci-Fi', 'Adventure', 'Action', 'Drama', 'Thriller', 
    'Comedy', 'Fantasy', 'Horror', 'Mystery', 'Romance', 
    'Crime', 'Animation', 'Biography', 'History', 'War'
  ];
  let hash = 0;
  for (let i = 0; i < item.title.length; i++) {
    hash = item.title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx1 = Math.abs(hash) % genresList.length;
  const idx2 = Math.abs(hash + 3) % genresList.length;
  return [genresList[idx1], genresList[idx2 === idx1 ? (idx2 + 1) % genresList.length : idx2]];
};

export const getMockRating = (item: MediaItem) => {
  let hash = 0;
  for (let i = 0; i < item.title.length; i++) {
    hash = item.title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ((Math.abs(hash + item.year) % 20 + 75) / 10).toFixed(1);
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (_, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const getContrastColor = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#fff';
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 128 ? '#000' : '#fff';
};

const getActionIcon = (action: string) => {
  switch (action) {
    case 'profile':
      return '✨';
    case 'delete':
      return '🗑️';
    case 'unmonitor':
      return '🚫';
    case 'skip':
      return '⏭️';
    default:
      return '⚙️';
  }
};

interface CurationCardProps {
  item: MediaItem;
  settings: Record<string, string>;
  apiKey: string;
  exitDirection: { x: number; y: number; rotate: number };
  setExitDirection: (dir: { x: number; y: number; rotate: number }) => void;
  onAction: (action: 'left' | 'right' | 'up' | 'down' | 'unmonitor' | 'delete', color: string, message: string) => void;
  onSkip: () => void;
  isBackground?: boolean;
  stackOffset?: number;
}

export const CurationCard: React.FC<CurationCardProps> = ({
  item,
  settings,
  apiKey,
  exitDirection,
  setExitDirection,
  onAction,
  onSkip,
  isBackground = false,
  stackOffset = 0
}) => {
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const getDirectionConfig = (dir: 'left' | 'right' | 'up' | 'down') => {
    const action = settings[`swipe_${dir}_action`] || (dir === 'down' ? 'delete' : 'profile');
    const color = settings[`swipe_${dir}_color`] || 
      (dir === 'left' ? '#00b0ff' : dir === 'right' ? '#00e676' : dir === 'up' ? '#ffd600' : '#ff1744');
    const label = settings[`swipe_${dir}_label`] || 
      (dir === 'left' ? 'Standard Profile' : dir === 'right' ? 'Upgraded Profile' : dir === 'up' ? 'God Tier Profile' : 'Delete');
    
    const mediaPrefix = item.mediaType === 'movie' ? 'radarr' : 'sonarr';
    const defaultProfileId = dir === 'left' ? 1 : dir === 'right' ? 2 : dir === 'up' ? 3 : 1;
    const profileIdVal = settings[`swipe_${dir}_${mediaPrefix}_profile_id`] || settings[`${mediaPrefix}_swipe_${dir}_profile_id`];
    const profileId = profileIdVal ? parseInt(profileIdVal, 10) : defaultProfileId;

    const rgbObj = hexToRgb(color) || { r: 255, g: 255, b: 255 };

    return {
      action,
      color,
      label,
      profileId,
      rgb: `${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b}`
    };
  };

  const leftConfig = getDirectionConfig('left');
  const rightConfig = getDirectionConfig('right');
  const upConfig = getDirectionConfig('up');
  const downConfig = getDirectionConfig('down');

  // Profile-specific glow for poster edges
  const getProfileGlow = () => {
    const currentProfileId = item.qualityProfileId;
    const directions: ('left' | 'right' | 'up' | 'down')[] = ['left', 'right', 'up', 'down'];
    for (const dir of directions) {
      const config = getDirectionConfig(dir);
      if (config.action === 'profile' && config.profileId === currentProfileId) {
        return {
          border: `1px solid rgba(${config.rgb}, 0.25)`,
          boxShadow: `0 0 14px rgba(${config.rgb}, 0.12)`
        };
      }
    }
    return {
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: 'none'
    };
  };

  const profileGlow = getProfileGlow();

  // Proportional glows (snapping to dominant axis to avoid corner overlaps)
  const glowRight = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(x) <= Math.abs(y)) return 0;
    if (x <= 30) return 0;
    return Math.min((x - 30) / 120, 1);
  });

  const glowLeft = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(x) <= Math.abs(y)) return 0;
    if (x >= -30) return 0;
    return Math.min((Math.abs(x) - 30) / 120, 1);
  });

  const glowUp = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(y) <= Math.abs(x)) return 0;
    if (y >= -30) return 0;
    return Math.min((Math.abs(y) - 30) / 90, 1);
  });

  const glowDown = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(y) <= Math.abs(x)) return 0;
    if (y <= 30) return 0;
    return Math.min((y - 30) / 90, 1);
  });

  const standardOpacity = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(x) <= Math.abs(y)) return 0;
    if (x >= -30) return 0;
    return Math.min((Math.abs(x) - 30) / 70, 1);
  });

  const upgradedOpacity = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(x) <= Math.abs(y)) return 0;
    if (x <= 30) return 0;
    return Math.min((x - 30) / 70, 1);
  });

  const godTierOpacity = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(y) <= Math.abs(x)) return 0;
    if (y >= -30) return 0;
    return Math.min((Math.abs(y) - 30) / 50, 1);
  });

  const deleteOpacity = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 0;
    const [x, y] = values as number[];
    if (Math.abs(y) <= Math.abs(x)) return 0;
    if (y <= 30) return 0;
    return Math.min((y - 30) / 50, 1);
  });

  const borderGlow = useTransform([dragX, dragY], (values) => {
    if (isBackground) return '1px solid rgba(255, 255, 255, 0.08)';
    const [x, y] = values as number[];
    const dx = x;
    const dy = y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 15) return '1px solid rgba(255, 255, 255, 0.08)';
    
    const baseRatio = Math.min(distance / 50, 1);
    const slateGlow = `1px solid rgba(144, 164, 174, ${0.1 + 0.3 * baseRatio})`;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 15) {
        if (rightConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((dx - 15) / 135, 1);
        return `1px solid rgba(${rightConfig.rgb}, ${0.1 + 0.7 * ratio})`;
      } else if (dx < -15) {
        if (leftConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((Math.abs(dx) - 15) / 135, 1);
        return `1px solid rgba(${leftConfig.rgb}, ${0.1 + 0.7 * ratio})`;
      }
    } else {
      if (dy < -15) {
        if (upConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((Math.abs(dy) - 15) / 105, 1);
        return `1px solid rgba(${upConfig.rgb}, ${0.1 + 0.7 * ratio})`;
      } else if (dy > 15) {
        if (downConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((dy - 15) / 105, 1);
        return `1px solid rgba(${downConfig.rgb}, ${0.1 + 0.7 * ratio})`;
      }
    }
    return slateGlow;
  });

  const shadowGlow = useTransform([dragX, dragY], (values) => {
    if (isBackground) return '0 12px 40px 0 rgba(0, 0, 0, 0.7)';
    const [x, y] = values as number[];
    const dx = x;
    const dy = y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 15) {
      return '0 12px 40px 0 rgba(0, 0, 0, 0.7)';
    }
    const baseRatio = Math.min(distance / 50, 1);
    const slateGlow = `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 ${12 * baseRatio}px rgba(144, 164, 174, ${0.3 * baseRatio})`;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 15) {
        if (rightConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((dx - 15) / 135, 1);
        const rgb = hexToRgb(rightConfig.color) || { r: 0, g: 230, b: 118 };
        const r = Math.round(144 + (rgb.r - 144) * ratio);
        const g = Math.round(164 + (rgb.g - 164) * ratio);
        const b = Math.round(174 + (rgb.b - 174) * ratio);
        return `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 ${12 + 18 * ratio}px rgba(${r}, ${g}, ${b}, ${0.3 + 0.5 * ratio})`;
      } else if (dx < -15) {
        if (leftConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((Math.abs(dx) - 15) / 135, 1);
        const rgb = hexToRgb(leftConfig.color) || { r: 33, g: 150, b: 243 };
        const r = Math.round(144 + (rgb.r - 144) * ratio);
        const g = Math.round(164 + (rgb.g - 164) * ratio);
        const b = Math.round(174 + (rgb.b - 174) * ratio);
        return `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 ${12 + 18 * ratio}px rgba(${r}, ${g}, ${b}, ${0.3 + 0.5 * ratio})`;
      }
    } else {
      if (dy < -15) {
        if (upConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((Math.abs(dy) - 15) / 105, 1);
        const rgb = hexToRgb(upConfig.color) || { r: 255, g: 179, b: 0 };
        const r = Math.round(144 + (rgb.r - 144) * ratio);
        const g = Math.round(164 + (rgb.g - 164) * ratio);
        const b = Math.round(174 + (rgb.b - 174) * ratio);
        return `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 ${12 + 18 * ratio}px rgba(${r}, ${g}, ${b}, ${0.3 + 0.5 * ratio})`;
      } else if (dy > 15) {
        if (downConfig.action === 'disabled') return slateGlow;
        const ratio = Math.min((dy - 15) / 105, 1);
        const rgb = hexToRgb(downConfig.color) || { r: 255, g: 23, b: 68 };
        const r = Math.round(144 + (rgb.r - 144) * ratio);
        const g = Math.round(164 + (rgb.g - 164) * ratio);
        const b = Math.round(174 + (rgb.b - 174) * ratio);
        return `0 12px 40px rgba(0, 0, 0, 0.7), 0 0 ${12 + 18 * ratio}px rgba(${r}, ${g}, ${b}, ${0.3 + 0.5 * ratio})`;
      }
    }
    return slateGlow;
  });

  const cardBackground = useTransform([dragX, dragY], (values) => {
    if (isBackground) return 'rgba(10, 10, 10, 0.6)';
    const [x, y] = values as number[];
    const dx = x;
    const dy = y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const ratio = Math.min(distance / 150, 1);
    return `rgba(10, 10, 10, ${0.6 + 0.25 * ratio})`;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const hasDragged = useRef(false);

  useEffect(() => {
    setPosterError(false);
    setIsFlipped(false);
  }, [item.id]);

  const handleDragStart = () => {
    setIsDragging(true);
    hasDragged.current = false;
    dragX.set(0);
    dragY.set(0);
  };

  const handleDrag = (event: any, info: any) => {
    if (Math.abs(info.offset.x) > 5 || Math.abs(info.offset.y) > 5) {
      hasDragged.current = true;
    }
    dragX.set(info.offset.x);
    dragY.set(info.offset.y);
  };

  const handleCardTap = () => {
    if (isBackground) return;
    if (hasDragged.current) return;
    setIsFlipped(prev => !prev);
  };

  const handleDragEnd = (event: any, info: any) => {
    setIsDragging(false);
    const x = info.offset.x;
    const y = info.offset.y;

    if (x > 150) {
      if (rightConfig.action === 'disabled') {
        dragX.set(0);
        dragY.set(0);
        return;
      }
      setExitDirection({ x: 800, y: dragY.get() || 0, rotate: 20 });
      setTimeout(() => {
        onAction('right', rightConfig.color, rightConfig.label);
      }, 0);
    } else if (x < -150) {
      if (leftConfig.action === 'disabled') {
        dragX.set(0);
        dragY.set(0);
        return;
      }
      setExitDirection({ x: -800, y: dragY.get() || 0, rotate: -20 });
      setTimeout(() => {
        onAction('left', leftConfig.color, leftConfig.label);
      }, 0);
    } else if (y < -120) {
      if (upConfig.action === 'disabled') {
        dragX.set(0);
        dragY.set(0);
        return;
      }
      setExitDirection({ x: dragX.get() || 0, y: -800, rotate: 0 });
      setTimeout(() => {
        onAction('up', upConfig.color, upConfig.label);
      }, 0);
    } else if (y > 120) {
      if (downConfig.action === 'disabled') {
        dragX.set(0);
        dragY.set(0);
        return;
      }
      setExitDirection({ x: dragX.get() || 0, y: 800, rotate: 0 });
      setTimeout(() => {
        onAction('down', downConfig.color, downConfig.label);
      }, 0);
    } else {
      dragX.set(0);
      dragY.set(0);
    }
  };

  const getSourceDisplay = (source: string) => {
    if (!source) return 'Unknown Format';
    return source.replace(/-(1080p|2160p|720p)/gi, '');
  };

  const currentPlayCount = item.playCount || 0;
  const currentWatchHours = item.watchTimeHours || 0;
  const lastPlayedRaw = item.lastPlayed;
  
  let formattedLastPlayed = 'Never';
  if (lastPlayedRaw) {
    const lastDate = new Date(lastPlayedRaw);
    const diffTime = Math.abs(new Date().getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) formattedLastPlayed = 'Today';
    else if (diffDays <= 7) formattedLastPlayed = `${diffDays} days ago`;
    else if (diffDays <= 30) formattedLastPlayed = `${Math.floor(diffDays / 7)} weeks ago`;
    else formattedLastPlayed = `${Math.floor(diffDays / 30)} months ago`;
  }

  const movieRating = getMockRating(item);
  const movieGenres = getGenres(item);

  return (
    <motion.div 
      drag={!isBackground}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.6}
      onDragStart={isBackground ? undefined : handleDragStart}
      onDrag={isBackground ? undefined : handleDrag}
      onDragEnd={isBackground ? undefined : handleDragEnd}
      exit={isBackground ? undefined : {
        x: exitDirection.x,
        y: exitDirection.y,
        rotate: exitDirection.rotate,
        opacity: 0,
        scale: 0.85,
        transition: { duration: 0.35, ease: 'easeOut' }
      }}
      animate={{
        scale: isBackground ? 1 - (stackOffset || 0) * 0.04 : 1,
        y: isBackground ? (stackOffset || 0) * 12 : 0,
        opacity: isBackground ? 1 - (stackOffset || 0) * 0.3 : 1,
        transition: { duration: 0.3, ease: 'easeOut' }
      }}
      style={{ 
        width: '100%',
        height: '520px', 
        position: 'absolute', 
        top: 0,
        left: 0,
        cursor: isBackground ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        perspective: '1200px',
        zIndex: isBackground ? 10 - (stackOffset || 0) : 10,
        pointerEvents: isBackground ? 'none' : 'auto',
      }}
    >
      <motion.div
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          position: 'relative',
        }}
        onTap={handleCardTap}
      >
        {/* FRONT FACE */}
        <motion.div
          className="glass-panel"
          style={{
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxSizing: 'border-box',
            border: borderGlow,
            boxShadow: shadowGlow,
            backgroundColor: cardBackground,
            borderRadius: '24px',
            overflow: 'hidden'
          }}
        >
          {/* Poster Container */}
          <div style={{
            width: '100%',
            height: '360px',
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: profileGlow.border,
            boxShadow: profileGlow.boxShadow,
            position: 'relative',
            marginBottom: '16px'
          }}>
            {!posterError ? (
              <img 
                src={`/api/v1/media/poster?mediaType=${item.mediaType}&id=${item.id}&apikey=${apiKey}`}
                alt={`${item.title} Poster`}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover'
                }}
                draggable={false}
                onError={() => setPosterError(true)}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #111, #222)',
                color: 'var(--text-secondary)'
              }}>
                <Film size={48} style={{ opacity: 0.2 }} />
              </div>
            )}

            {/* Glowing directional action indicators */}
            <motion.div 
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: `rgba(${leftConfig.rgb}, 0.15)`, 
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: leftConfig.action === 'disabled' ? 0 : glowLeft,
                pointerEvents: 'none'
              }}
            >
              <div className="glass-panel" style={{ padding: '10px 20px', borderRadius: '20px', border: `1px solid rgba(${leftConfig.rgb}, 0.3)`, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getActionIcon(leftConfig.action)} {leftConfig.label}
              </div>
            </motion.div>

            <motion.div 
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: `rgba(${rightConfig.rgb}, 0.15)`, 
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: rightConfig.action === 'disabled' ? 0 : glowRight,
                pointerEvents: 'none'
              }}
            >
              <div className="glass-panel" style={{ padding: '10px 20px', borderRadius: '20px', border: `1px solid rgba(${rightConfig.rgb}, 0.3)`, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getActionIcon(rightConfig.action)} {rightConfig.label}
              </div>
            </motion.div>

            <motion.div 
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: `rgba(${upConfig.rgb}, 0.15)`, 
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: upConfig.action === 'disabled' ? 0 : glowUp,
                pointerEvents: 'none'
              }}
            >
              <div className="glass-panel" style={{ padding: '10px 20px', borderRadius: '20px', border: `1px solid rgba(${upConfig.rgb}, 0.3)`, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getActionIcon(upConfig.action)} {upConfig.label}
              </div>
            </motion.div>

            <motion.div 
              style={{ 
                position: 'absolute', 
                top: 0, left: 0, right: 0, bottom: 0, 
                backgroundColor: `rgba(${downConfig.rgb}, 0.15)`, 
                backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: downConfig.action === 'disabled' ? 0 : glowDown,
                pointerEvents: 'none'
              }}
            >
              <div className="glass-panel" style={{ padding: '10px 20px', borderRadius: '20px', border: `1px solid rgba(${downConfig.rgb}, 0.3)`, color: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getActionIcon(downConfig.action)} {downConfig.label}
              </div>
            </motion.div>

            {/* Swipe Action badges */}
            <motion.div style={{ opacity: leftConfig.action === 'disabled' ? 0 : standardOpacity, position: 'absolute', top: '50%', y: '-50%', left: '16px', pointerEvents: 'none' }}>
              <span style={{ backgroundColor: leftConfig.color, color: getContrastColor(leftConfig.color), padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', boxShadow: `0 0 10px rgba(${leftConfig.rgb}, 0.4)` }}>{leftConfig.label.toUpperCase()}</span>
            </motion.div>

            <motion.div style={{ opacity: rightConfig.action === 'disabled' ? 0 : upgradedOpacity, position: 'absolute', top: '50%', y: '-50%', right: '16px', pointerEvents: 'none' }}>
              <span style={{ backgroundColor: rightConfig.color, color: getContrastColor(rightConfig.color), padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', boxShadow: `0 0 10px rgba(${rightConfig.rgb}, 0.4)` }}>{rightConfig.label.toUpperCase()}</span>
            </motion.div>

            <motion.div style={{ opacity: upConfig.action === 'disabled' ? 0 : godTierOpacity, position: 'absolute', top: '16px', left: 'calc(50% - 60px)', width: '120px', textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ backgroundColor: upConfig.color, color: getContrastColor(upConfig.color), padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', boxShadow: `0 0 10px rgba(${upConfig.rgb}, 0.4)`, display: 'inline-block', width: 'fit-content' }}>{upConfig.label.toUpperCase()}</span>
            </motion.div>

            <motion.div style={{ opacity: downConfig.action === 'disabled' ? 0 : deleteOpacity, position: 'absolute', bottom: '16px', left: 'calc(50% - 60px)', width: '120px', textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ backgroundColor: downConfig.color, color: getContrastColor(downConfig.color), padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', boxShadow: `0 0 10px rgba(${downConfig.rgb}, 0.4)`, display: 'inline-block', width: 'fit-content' }}>{downConfig.label.toUpperCase()}</span>
            </motion.div>

            {/* Info Cog top right */}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 5 }}>
              <div 
                className="glass-panel" 
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <Info size={11} color="#aaa" />
              </div>
            </div>
          </div>

          {/* Metadata info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-header)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '78%' }}>
                {item.title}
              </span>
              <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {item.year}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Star size={11} fill="var(--gold)" color="var(--gold)" /> {movieRating}
              </span>
              <span>•</span>
              <span>{movieGenres.join(' • ')}</span>
            </div>

            {/* Compact tags */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              <span style={{ fontSize: '10px', background: 'rgba(33, 150, 243, 0.1)', color: 'var(--blue)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={8} /> {getSourceDisplay(item.qualityFormatSource)}
              </span>
              <span style={{ fontSize: '10px', background: 'rgba(255, 179, 0, 0.1)', color: 'var(--gold)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Crown size={8} /> Score: {item.customFormatScore}
              </span>
            </div>
          </div>
        </motion.div>

        {/* BACK FACE */}
        <motion.div
          className="glass-panel"
          style={{
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxSizing: 'border-box',
            backgroundColor: 'rgba(10, 10, 10, 0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '24px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.8)'
          }}
        >
          {/* Back Header */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontFamily: 'var(--font-header)' }}>{item.title}</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.year} • {item.mediaType.toUpperCase()}</span>
          </div>

          {/* Series Alert for TV */}
          {item.mediaType === 'tv' && (
            <div style={{ 
              background: 'rgba(255,23,68,0.08)', 
              border: '1px solid rgba(255,23,68,0.2)', 
              borderRadius: '8px', 
              padding: '10px 14px', 
              fontSize: '12px', 
              color: 'var(--crimson)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px'
            }}>
              <Tv size={14} />
              <strong>⚠️ Affects Series: {item.seasons || 1} Seasons, {item.episodes || 12} Episodes</strong>
            </div>
          )}

          {/* Detailed stats grids */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
            
            {/* Tautulli statistics */}
            <div>
              <h5 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--gold)', fontSize: '10px', letterSpacing: '0.05em' }}>Plex Playback stats</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Plays</div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '2px' }}>{currentPlayCount}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Last Played</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formattedLastPlayed}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', gridColumn: 'span 2' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Total Watch Time</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{currentWatchHours.toFixed(1)} Hours</div>
                </div>
              </div>
            </div>

            {/* Arr disk storage details */}
            <div>
              <h5 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--blue)', fontSize: '10px', letterSpacing: '0.05em' }}>Arr Disk Storage details</h5>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Disk Size</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                    <strong>{formatBytes(item.sizeBytes)}</strong>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Release Source</div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.qualityFormatSource}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)', gridColumn: 'span 2' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>Root Folder Path</div>
                  <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-secondary)', marginTop: '2px', wordBreak: 'break-all' }}>{item.rootFolder}</div>
                </div>
              </div>
            </div>

            {/* Custom tags list */}
            {item.customFormatTags && item.customFormatTags.length > 0 && (
              <div>
                <h5 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', color: 'var(--violet)', fontSize: '10px', letterSpacing: '0.05em' }}>Custom Formats</h5>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {item.customFormatTags.map((tag: string, i: number) => (
                    <span key={i} style={{ fontSize: '9px', background: 'rgba(124, 77, 255, 0.1)', color: '#d1c4e9', border: '1px solid rgba(124, 77, 255, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>{tag}</span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Secondary buttons on back */}
          <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
            <button 
              className="glass-button" 
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: '12px', 
                fontSize: '12px',
                border: '1px solid rgba(255,255,255,0.08)', 
                color: 'var(--text-secondary)',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
              onClick={(e) => {
                e.stopPropagation(); // Stop tap event from flipping card back
                setExitDirection({ x: -800, y: 0, rotate: -20 });
                setTimeout(() => {
                  onAction('unmonitor', 'var(--slate)', 'Set to Unmonitored');
                }, 0);
              }}
            >
              <EyeOff size={14} /> Unmonitor
            </button>
            <button 
              className="glass-button" 
              style={{ 
                flex: 1,
                padding: '10px', 
                borderRadius: '12px', 
                fontSize: '12px',
                border: '1px solid rgba(0, 230, 118, 0.25)', 
                backgroundColor: 'rgba(0, 230, 118, 0.05)',
                color: 'var(--green)' 
              }}
              onClick={(e) => {
                e.stopPropagation(); // Stop tap event from flipping card back
                setExitDirection({ x: 800, y: 0, rotate: 20 });
                setTimeout(() => {
                  onSkip();
                }, 0);
              }}
            >
              <Check size={14} /> Keep (Skip)
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
