import { useState, useRef, useContext, useMemo } from 'react';
import { 
  X, 
  Share2, 
  Download, 
  Copy, 
  Check, 
  Zap, 
  Loader2
} from 'lucide-react';
import BirdAvatar, { getBirdSvgString } from './BirdAvatars';
import { ToastContext } from '../store/ToastContext';

const ShareHeroCardModal = ({
  isOpen,
  onClose,
  userProfile,
  selectedBird = 'falcon',
  agentLevel = 1,
  equippedSkills = [],
  completedTasksCount = 0,
  rating = 5.0,
  userId = null
}) => {
  const { showToast } = useContext(ToastContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const cardRef = useRef(null);

  // Highest Mastery Tier Calculation
  const topMastery = useMemo(() => {
    if (completedTasksCount >= 10) {
      return { title: 'TIER 4: SKILL KING', icon: '👑' };
    }
    if (completedTasksCount >= 6) {
      return { title: 'TIER 3: MASTER TACTICIAN', icon: '⭐' };
    }
    if (completedTasksCount >= 3) {
      return { title: 'TIER 2: PRO SPECIALIST', icon: '⚡' };
    }
    return { title: 'TIER 1: ROOKIE OPERATOR', icon: '🔰' };
  }, [completedTasksCount]);

  // Top 3 skills only (clean & uncluttered)
  const displayedSkills = useMemo(() => {
    if (!equippedSkills || equippedSkills.length === 0) {
      return [
        { label: 'Field Recon Specialist', shortLabel: 'Field Recon', mastery: { shortName: 'Rookie' } }
      ];
    }
    return equippedSkills.slice(0, 3);
  }, [equippedSkills]);

  if (!isOpen) return null;

  /**
   * Generates an 800x1000px high-resolution Obsidian & Amber Glow PNG on Canvas
   * Full solid black fill to ensure ZERO white-corner artifacts on WhatsApp / social.
   */
  const renderCardToCanvas = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Helper: Rounded Rectangle
    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    };

    // 1. Solid Obsidian Black Base (Fills entire bitmap so no transparent corners exist)
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, 800, 1000);

    // 2. Ambient Radial Iris / Amber Aura
    const auraGlow = ctx.createRadialGradient(400, 240, 10, 400, 240, 280);
    auraGlow.addColorStop(0, 'rgba(255, 92, 0, 0.35)');
    auraGlow.addColorStop(0.6, 'rgba(245, 158, 11, 0.12)');
    auraGlow.addColorStop(1, 'rgba(11, 15, 25, 0)');
    ctx.fillStyle = auraGlow;
    ctx.fillRect(0, 0, 800, 600);

    // 3. Inner Card Border with Amber Accent
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 3;
    roundRect(24, 24, 752, 952, 28);
    ctx.stroke();

    // 4. Top Header: "⚡ HELPHIVE HERO PASSPORT" + Level Badge
    ctx.font = '900 22px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#F59E0B';
    ctx.textAlign = 'left';
    ctx.fillText('⚡ HELPHIVE HERO PASSPORT', 55, 76);

    // Level Pill on Right
    ctx.fillStyle = '#1E293B';
    roundRect(615, 48, 130, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    roundRect(615, 48, 130, 40, 20);
    ctx.stroke();

    ctx.font = '900 17px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`LVL ${agentLevel} 🏆`, 680, 74);

    // Header separator line
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(55, 105);
    ctx.lineTo(745, 105);
    ctx.stroke();

    // 5. Center Bird Avatar with Warm Glow Ring
    const bird = selectedBird || userProfile?.bird || 'falcon';
    const svgStr = getBirdSvgString(bird, 180);

    if (svgStr) {
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);
      const img = new Image();
      
      await new Promise((resolve) => {
        img.onload = () => {
          // Circular Avatar Base
          ctx.save();
          ctx.beginPath();
          ctx.arc(400, 235, 80, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          
          ctx.fillStyle = '#FFF3ED';
          ctx.fillRect(320, 155, 160, 160);
          ctx.drawImage(img, 320, 155, 160, 160);
          ctx.restore();
          
          // Glowing Orange Avatar Ring
          ctx.strokeStyle = '#FF6B35';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(400, 235, 82, 0, Math.PI * 2);
          ctx.stroke();

          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          resolve();
        };
        img.src = blobUrl;
      });
    }

    // 6. User Name & Handle
    const displayName = userProfile?.name || 'Operative';
    const displayHandle = userProfile?.handle || (userProfile?.name ? `@${userProfile.name.toLowerCase().replace(/\s+/g, '_')}` : '@hero');

    ctx.font = '900 32px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(displayName, 400, 360);

    ctx.font = '700 18px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(displayHandle, 400, 390);

    // 7. Mastery Tier Pill
    ctx.fillStyle = '#1E293B';
    roundRect(240, 412, 320, 38, 19);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    roundRect(240, 412, 320, 38, 19);
    ctx.stroke();

    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`${topMastery.icon} ${topMastery.title}`, 400, 437);

    // 8. Section: EQUIPPED DISCIPLINES
    ctx.font = '900 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'left';
    ctx.fillText('EQUIPPED DISCIPLINES', 55, 490);

    // Skills Rows (3 skills nicely spaced)
    const startY = 510;
    displayedSkills.forEach((skill, idx) => {
      const rowY = startY + (idx * 72);
      
      // Skill Card Dark Glass Background
      ctx.fillStyle = 'rgba(30, 41, 59, 0.75)';
      roundRect(55, rowY, 690, 56, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.lineWidth = 1;
      roundRect(55, rowY, 690, 56, 14);
      ctx.stroke();

      // Orange Bullet Dot
      ctx.fillStyle = '#FF5C00';
      ctx.beginPath();
      ctx.arc(85, rowY + 28, 5, 0, Math.PI * 2);
      ctx.fill();

      // Skill Label
      ctx.font = 'bold 19px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'left';
      ctx.fillText(skill.label || skill.shortLabel || 'Combat Skill', 108, rowY + 35);

      // Mastery Tier Badge on right (Clean: NO square brackets)
      const masteryName = skill.mastery?.shortName || (completedTasksCount >= 10 ? 'Legend' : completedTasksCount >= 6 ? 'Master' : 'Pro');
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#38BDF8';
      ctx.textAlign = 'right';
      ctx.fillText(`${masteryName} ★`, 720, rowY + 35);
    });

    // 9. Battle Stats Container
    const statsY = 750;
    ctx.fillStyle = '#0F172A';
    roundRect(55, statsY, 690, 95, 20);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    roundRect(55, statsY, 690, 95, 20);
    ctx.stroke();

    // Stat 1: Bounties Cleared
    ctx.textAlign = 'center';
    ctx.font = '900 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`${completedTasksCount}`, 170, statsY + 44);
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('BOUNTIES', 170, statsY + 70);

    // Separator 1
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(285, statsY + 20);
    ctx.lineTo(285, statsY + 75);
    ctx.stroke();

    // Stat 2: Rating
    ctx.font = '900 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`${Number(rating || 5.0).toFixed(1)} ★`, 400, statsY + 44);
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('RATING', 400, statsY + 70);

    // Separator 2
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(515, statsY + 20);
    ctx.lineTo(515, statsY + 75);
    ctx.stroke();

    // Stat 3: Reliability
    ctx.font = '900 26px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#10B981';
    ctx.fillText('100%', 630, statsY + 44);
    ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('RELIABLE', 630, statsY + 70);

    // 10. Minimal Footer Brand Tag
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.textAlign = 'center';
    ctx.fillText('⚡ HELPHIVE.APP', 400, 915);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  };

  /**
   * Action: Native Mobile Share or Fallback
   */
  const handleShare = async () => {
    setIsGenerating(true);
    try {
      const blob = await renderCardToCanvas();
      if (!blob) {
        showToast('Failed to generate passport', 'error');
        return;
      }

      const file = new File([blob], 'helphive-passport.png', { type: 'image/png' });
      const shareUrl = `${window.location.origin}/?ref=${userId ? userId.slice(0, 8) : 'hero'}`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${userProfile?.name || 'Operative'}'s Hero Passport`,
          text: `⚡ Check out my HelpHive Hero Passport! Equipped with ${displayedSkills.length} disciplines:\n${shareUrl}`
        });
        showToast('Passport shared successfully!', 'success');
      } else {
        // Fallback: Trigger download & copy link
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `helphive-passport-${userProfile?.name || 'hero'}.png`;
        a.click();
        URL.revokeObjectURL(url);

        await navigator.clipboard.writeText(shareUrl);
        showToast('Passport downloaded & link copied!', 'success');
      }
    } catch {
      // User cancelled
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Action: Direct Download PNG
   */
  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const blob = await renderCardToCanvas();
      if (!blob) {
        showToast('Failed to generate image', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helphive-passport-${userProfile?.name || 'hero'}.png`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Hero Passport downloaded!', 'success');
    } catch {
      showToast('Download failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Action: Copy Invite Link
   */
  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/?ref=${userId ? userId.slice(0, 8) : 'hero'}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      showToast('Link copied to clipboard!', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const bird = selectedBird || userProfile?.bird || 'falcon';
  const displayName = userProfile?.name || 'Operative';
  const displayHandle = userProfile?.handle || (userProfile?.name ? `@${userProfile.name.toLowerCase().replace(/\s+/g, '_')}` : '@hero');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      {/* Matte Midnight Obsidian Modal Box */}
      <div className="relative w-full max-w-[340px] bg-[#0B0F19] rounded-[28px] border border-slate-800 shadow-2xl p-4 flex flex-col items-center">
        
        {/* Minimal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-full transition-colors cursor-pointer active-scale z-20"
          aria-label="Close"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ================= PREMIUM OBSIDIAN & AMBER GLOW PASSPORT PREVIEW ================= */}
        <div 
          ref={cardRef}
          className="w-full bg-gradient-to-b from-slate-900 via-[#0B0F19] to-slate-900 rounded-2xl p-3.5 border border-amber-500/40 shadow-xl flex flex-col space-y-2.5 relative overflow-hidden select-none"
        >
          {/* Ambient Iris / Amber Aura */}
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-primary/25 rounded-full blur-3xl pointer-events-none" />

          {/* Top Header Row */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 z-10">
            <div className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-[11px] font-black text-amber-400 tracking-tight">HERO PASSPORT</span>
            </div>
            <div className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-black text-white">
              LVL {agentLevel} 🏆
            </div>
          </div>

          {/* Center Identity */}
          <div className="flex flex-col items-center text-center z-10">
            {/* Avatar with Glow Ring */}
            <div className="w-14 h-14 rounded-full bg-orange-50 p-0.5 ring-2 ring-orange-500 shadow-md flex items-center justify-center mb-1 overflow-hidden">
              <BirdAvatar birdName={bird} size={50} />
            </div>

            <h3 className="text-sm font-black text-white leading-tight">
              {displayName}
            </h3>
            <span className="text-[10px] font-semibold text-slate-400">
              {displayHandle}
            </span>

            {/* Mastery Pill */}
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-800/90 border border-amber-500/60 flex items-center space-x-1 shadow-xs">
              <span className="text-xs">{topMastery.icon}</span>
              <span className="text-[10px] font-black text-amber-400 tracking-wide">
                {topMastery.title}
              </span>
            </div>
          </div>

          {/* Equipped Disciplines Preview (Top 3 Only) */}
          <div className="z-10 bg-slate-950/70 rounded-xl p-2 border border-slate-800/80 space-y-1">
            <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-0.5">
              Equipped Disciplines
            </div>
            <div className="space-y-1">
              {displayedSkills.map((skill, i) => (
                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 rounded-lg text-xs border border-slate-800/60">
                  <div className="flex items-center space-x-1.5 truncate max-w-[170px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="font-bold text-slate-200 text-[11px] truncate">
                      {skill.label || skill.shortLabel}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-400 shrink-0">
                    {skill.mastery?.shortName || 'Pro'} ★
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Battle Stats */}
          <div className="grid grid-cols-3 gap-1 bg-slate-950/90 rounded-xl p-1.5 border border-slate-800/80 text-center z-10">
            <div>
              <div className="text-xs font-black text-white">{completedTasksCount}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">Bounties</div>
            </div>
            <div className="border-x border-slate-800">
              <div className="text-xs font-black text-amber-400">{Number(rating || 5.0).toFixed(1)} ★</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">Rating</div>
            </div>
            <div>
              <div className="text-xs font-black text-emerald-400">100%</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase">Reliable</div>
            </div>
          </div>
        </div>

        {/* ================= ICON-ONLY SELF-EXPLANATORY ACTION BAR ================= */}
        <div className="w-full flex items-center justify-center gap-2.5 mt-3.5">
          
          {/* Primary Share Icon Button */}
          <button
            onClick={handleShare}
            disabled={isGenerating}
            className="flex-1 h-11 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 hover:opacity-95 text-white font-black rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20 active-scale cursor-pointer disabled:opacity-50 transition-all"
            title="Share Passport"
            aria-label="Share Passport"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>

          {/* Download Icon Button */}
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="w-12 h-11 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center border border-slate-800 transition-colors cursor-pointer active-scale"
            title="Save PNG Image"
            aria-label="Save PNG Image"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Copy Link Icon Button */}
          <button
            onClick={handleCopyLink}
            className="w-12 h-11 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-xl flex items-center justify-center border border-slate-800 transition-colors cursor-pointer active-scale"
            title="Copy Invite Link"
            aria-label="Copy Invite Link"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
            ) : (
              <Copy className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>

        </div>

      </div>
    </div>
  );
};

export default ShareHeroCardModal;
