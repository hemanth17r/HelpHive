/**
 * HelpHive 2026 Game UI Design System Tokens
 * Derived from top-rated mobile game UI rules (Clash Royale, Marvel Snap, Genshin, Pokémon GO)
 */

export const GAME_TOKENS = {
  // 60-30-10 Color System
  colors: {
    canvas: 'bg-slate-50', // 60% Dominant Base
    surface: 'bg-white',   // 30% Structural Surfaces
    surfaceBorder: 'border border-slate-200/80',
    surfaceShadow: 'shadow-xs',
    
    // 10% High-Impact Game Accents
    primary: '#FF5C00',       // Hyper Orange
    primaryGradient: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
    amberGold: '#F59E0B',     // Level / Legendary Rewards
    emeraldMint: '#10B981',   // Reliability 100% / Active Radar
    cyberBlue: '#0284C7',     // Secondary / Community Quests
    
    text: {
      heading: 'text-slate-900 font-black tracking-tight',
      subheading: 'text-slate-700 font-bold',
      muted: 'text-slate-500 font-semibold',
      microLabel: 'text-[10px] font-black uppercase tracking-wider text-slate-400',
    }
  },
  
  // Game Rarity Tiers for Quests
  rarity: {
    legendary: {
      bg: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white',
      badge: 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold',
      border: 'border-amber-300/80',
      label: 'LEGENDARY BOUNTY'
    },
    volunteer: {
      bg: 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white',
      badge: 'bg-teal-100 text-teal-900 border border-teal-300 font-extrabold',
      border: 'border-teal-300/80',
      label: 'VOLUNTEER QUEST'
    },
    standard: {
      bg: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white',
      badge: 'bg-orange-50 text-orange-700 border border-orange-200 font-extrabold',
      border: 'border-slate-200/80',
      label: 'QUEST REWARD'
    }
  },

  // Mastery Tiers for Player Skill Tree
  masteryTiers: {
    legend: { label: 'TIER 4 LEGEND', badge: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black shadow-xs' },
    expert: { label: 'TIER 3 EXPERT', badge: 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' },
    pro: { label: 'TIER 2 PRO', badge: 'bg-blue-50 text-blue-800 border border-blue-200 font-bold' },
    rookie: { label: 'TIER 1 ROOKIE', badge: 'bg-slate-100 text-slate-500 font-semibold' }
  }
};
