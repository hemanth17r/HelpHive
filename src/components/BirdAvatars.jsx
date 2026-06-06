import React from 'react';

// ─── FALCON — Speed ──────────────────────────────────────────
const FalconSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Background circle */}
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Body — streamlined teardrop angled forward */}
    <ellipse cx="38" cy="42" rx="16" ry="12" transform="rotate(-15 38 42)" fill="#FF6B35" />
    {/* Chest highlight */}
    <ellipse cx="36" cy="44" rx="10" ry="7" transform="rotate(-15 36 44)" fill="#FF8A5C" />
    {/* Wing swept back tight */}
    <path d="M44 36 C52 28, 62 30, 60 38 C58 42, 50 40, 44 36Z" fill="#E55A2B" />
    <path d="M46 40 C54 34, 60 36, 58 42 C56 44, 50 43, 46 40Z" fill="#CC4A1E" />
    {/* Head */}
    <circle cx="28" cy="34" r="9" fill="#FF6B35" />
    {/* Head highlight */}
    <circle cx="26" cy="32" r="5" fill="#FF8A5C" opacity="0.5" />
    {/* Eye — small, determined */}
    <circle cx="25" cy="33" r="2.5" fill="#2D2D2D" />
    <circle cx="24.2" cy="32.3" r="0.8" fill="white" />
    {/* Sharp pointed beak facing right-forward */}
    <path d="M19 34 L12 32 L18 36Z" fill="#2D2D2D" />
    {/* Tail feathers — sharp, swept */}
    <path d="M54 42 L66 36 L64 42 L68 40 L62 46 L54 44Z" fill="#E55A2B" />
    {/* Feet — tucked, aerodynamic */}
    <line x1="36" y1="52" x2="34" y2="58" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="40" y1="52" x2="39" y2="58" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    {/* Speed lines */}
    <line x1="10" y1="28" x2="18" y2="28" stroke="#FF6B35" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
    <line x1="8" y1="34" x2="14" y2="34" stroke="#FF6B35" strokeWidth="1" opacity="0.3" strokeLinecap="round" />
    <line x1="10" y1="40" x2="16" y2="40" stroke="#FF6B35" strokeWidth="1" opacity="0.3" strokeLinecap="round" />
  </svg>
);

// ─── OWL — Wisdom ────────────────────────────────────────────
const OwlSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Body — fluffy rounded */}
    <ellipse cx="40" cy="48" rx="18" ry="16" fill="#FF6B35" />
    {/* Belly */}
    <ellipse cx="40" cy="52" rx="12" ry="10" fill="#FF8A5C" />
    {/* Belly pattern */}
    <ellipse cx="40" cy="50" rx="8" ry="7" fill="#FFB494" opacity="0.5" />
    {/* Head */}
    <circle cx="40" cy="30" r="14" fill="#FF6B35" />
    {/* Face disc */}
    <circle cx="40" cy="31" r="11" fill="#FFE0D0" />
    {/* Ear tufts */}
    <path d="M28 22 L32 28 L26 28Z" fill="#E55A2B" />
    <path d="M52 22 L48 28 L54 28Z" fill="#E55A2B" />
    {/* Left eye — large, round */}
    <circle cx="34" cy="30" r="5" fill="white" stroke="#2D2D2D" strokeWidth="1.5" />
    <circle cx="34" cy="30" r="2.5" fill="#2D2D2D" />
    <circle cx="33" cy="29" r="1" fill="white" />
    {/* Right eye — large, round */}
    <circle cx="46" cy="30" r="5" fill="white" stroke="#2D2D2D" strokeWidth="1.5" />
    <circle cx="46" cy="30" r="2.5" fill="#2D2D2D" />
    <circle cx="45" cy="29" r="1" fill="white" />
    {/* Beak — small */}
    <path d="M38 35 L40 39 L42 35Z" fill="#2D2D2D" />
    {/* Wings — small, tucked */}
    <ellipse cx="22" cy="46" rx="5" ry="10" transform="rotate(10 22 46)" fill="#E55A2B" />
    <ellipse cx="58" cy="46" rx="5" ry="10" transform="rotate(-10 58 46)" fill="#E55A2B" />
    {/* Feet — stable */}
    <path d="M34 62 L30 66 M34 62 L34 66 M34 62 L38 66" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M46 62 L42 66 M46 62 L46 66 M46 62 L50 66" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── EAGLE — Leadership ──────────────────────────────────────
const EagleSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Body — broad chest */}
    <ellipse cx="40" cy="46" rx="12" ry="14" fill="#FF6B35" />
    {/* Chest highlight */}
    <ellipse cx="40" cy="48" rx="8" ry="9" fill="#FFB494" />
    {/* Left wing — fully spread */}
    <path d="M28 42 C20 30, 6 26, 4 34 C2 38, 8 42, 14 44 L20 42 L16 38 C12 34, 10 32, 8 36" fill="#E55A2B" />
    <path d="M28 42 L14 44 L10 40 L6 42 L14 46 L28 44Z" fill="#CC4A1E" />
    {/* Right wing — fully spread */}
    <path d="M52 42 C60 30, 74 26, 76 34 C78 38, 72 42, 66 44 L60 42 L64 38 C68 34, 70 32, 72 36" fill="#E55A2B" />
    <path d="M52 42 L66 44 L70 40 L74 42 L66 46 L52 44Z" fill="#CC4A1E" />
    {/* Head — held high */}
    <circle cx="40" cy="28" r="10" fill="#FF6B35" />
    {/* White head feathers (eagle characteristic) */}
    <circle cx="40" cy="26" r="7" fill="#FFE0D0" />
    {/* Eye */}
    <circle cx="36" cy="27" r="2" fill="#2D2D2D" />
    <circle cx="35.3" cy="26.3" r="0.7" fill="white" />
    {/* Strong hooked beak */}
    <path d="M30 29 L26 28 L28 32 L30 31Z" fill="#2D2D2D" />
    {/* Beak hook detail */}
    <path d="M26 28 L24 30 L26 30Z" fill="#3D3D3D" />
    {/* Tail feathers */}
    <path d="M36 58 L32 68 L38 64 L40 70 L42 64 L48 68 L44 58Z" fill="#E55A2B" />
    {/* Feet */}
    <path d="M36 58 L34 62 M36 58 L38 62" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M44 58 L42 62 M44 58 L46 62" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── PEACOCK — Creativity ────────────────────────────────────
const PeacockSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Tail fan — radiating curved lines */}
    <path d="M40 44 L20 10 Q22 14, 24 10" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.6" />
    <path d="M40 44 L12 18 Q14 22, 16 18" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.5" />
    <path d="M40 44 L8 30 Q10 34, 12 30" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.4" />
    <path d="M40 44 L60 10 Q58 14, 56 10" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.6" />
    <path d="M40 44 L68 18 Q66 22, 64 18" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.5" />
    <path d="M40 44 L72 30 Q70 34, 68 30" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.4" />
    <path d="M40 44 L40 6" stroke="#FF6B35" strokeWidth="2" fill="none" opacity="0.7" />
    {/* Eye spots on tail */}
    <circle cx="20" cy="12" r="3" fill="#FF6B35" opacity="0.7" />
    <circle cx="20" cy="12" r="1.5" fill="#2D2D2D" opacity="0.5" />
    <circle cx="60" cy="12" r="3" fill="#FF6B35" opacity="0.7" />
    <circle cx="60" cy="12" r="1.5" fill="#2D2D2D" opacity="0.5" />
    <circle cx="40" cy="8" r="3" fill="#FF6B35" opacity="0.8" />
    <circle cx="40" cy="8" r="1.5" fill="#2D2D2D" opacity="0.5" />
    <circle cx="12" cy="20" r="2.5" fill="#FF6B35" opacity="0.5" />
    <circle cx="68" cy="20" r="2.5" fill="#FF6B35" opacity="0.5" />
    {/* Body */}
    <ellipse cx="40" cy="52" rx="10" ry="12" fill="#FF6B35" />
    <ellipse cx="40" cy="54" rx="6" ry="8" fill="#FF8A5C" />
    {/* Proud upright neck */}
    <rect x="37" y="36" width="6" height="14" rx="3" fill="#FF6B35" />
    {/* Small elegant head */}
    <circle cx="40" cy="34" r="7" fill="#FF6B35" />
    <circle cx="40" cy="33" r="4" fill="#FF8A5C" opacity="0.5" />
    {/* Crown feathers */}
    <line x1="38" y1="28" x2="36" y2="22" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="36" cy="21" r="1.5" fill="#FF6B35" />
    <line x1="40" y1="27" x2="40" y2="21" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="40" cy="20" r="1.5" fill="#FF6B35" />
    <line x1="42" y1="28" x2="44" y2="22" stroke="#FF6B35" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="44" cy="21" r="1.5" fill="#FF6B35" />
    {/* Eye */}
    <circle cx="37" cy="33" r="1.8" fill="#2D2D2D" />
    <circle cx="36.5" cy="32.5" r="0.6" fill="white" />
    {/* Beak */}
    <path d="M33 35 L30 34 L33 37Z" fill="#2D2D2D" />
    {/* Feet */}
    <line x1="38" y1="62" x2="36" y2="68" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="42" y1="62" x2="44" y2="68" stroke="#2D2D2D" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// ─── PENGUIN — Reliability ───────────────────────────────────
const PenguinSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Body — standing straight, round */}
    <ellipse cx="40" cy="46" rx="16" ry="20" fill="#2D2D2D" />
    {/* White belly */}
    <ellipse cx="40" cy="48" rx="11" ry="16" fill="white" />
    {/* Belly warm highlight */}
    <ellipse cx="40" cy="50" rx="8" ry="12" fill="#FFF3ED" />
    {/* Head */}
    <circle cx="40" cy="24" r="12" fill="#2D2D2D" />
    {/* Face patch */}
    <circle cx="40" cy="25" r="8" fill="white" />
    <circle cx="40" cy="26" r="6" fill="#FFF3ED" />
    {/* Left eye — simple, honest */}
    <circle cx="36" cy="24" r="2" fill="#2D2D2D" />
    <circle cx="35.5" cy="23.5" r="0.7" fill="white" />
    {/* Right eye */}
    <circle cx="44" cy="24" r="2" fill="#2D2D2D" />
    <circle cx="43.5" cy="23.5" r="0.7" fill="white" />
    {/* Slight smile */}
    <path d="M37 28 Q40 31, 43 28" stroke="#2D2D2D" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    {/* Beak — small orange */}
    <path d="M38 26 L40 29 L42 26Z" fill="#FF6B35" />
    {/* Flippers at sides */}
    <ellipse cx="22" cy="44" rx="4" ry="12" transform="rotate(10 22 44)" fill="#3D3D3D" />
    <ellipse cx="58" cy="44" rx="4" ry="12" transform="rotate(-10 58 44)" fill="#3D3D3D" />
    {/* Feet — planted firmly */}
    <ellipse cx="34" cy="66" rx="5" ry="2.5" fill="#FF6B35" />
    <ellipse cx="46" cy="66" rx="5" ry="2.5" fill="#FF6B35" />
  </svg>
);

// ─── HUMMINGBIRD — Agility ───────────────────────────────────
const HummingbirdSVG = ({ size = 80, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="40" cy="40" r="38" fill="#FFF3ED" />
    {/* Tiny compact body */}
    <ellipse cx="42" cy="40" rx="10" ry="8" transform="rotate(-10 42 40)" fill="#FF6B35" />
    {/* Belly */}
    <ellipse cx="41" cy="42" rx="6" ry="5" transform="rotate(-10 41 42)" fill="#FF8A5C" />
    {/* Wing 1 — upper position (blur/motion) */}
    <path d="M48 34 C56 22, 68 24, 66 30 C64 34, 56 32, 48 34Z" fill="#E55A2B" opacity="0.5" />
    {/* Wing 2 — mid position */}
    <path d="M50 38 C60 28, 70 32, 68 38 C66 42, 58 40, 50 38Z" fill="#E55A2B" opacity="0.8" />
    {/* Wing 3 — lower position (blur/motion) */}
    <path d="M48 42 C56 36, 66 40, 64 44 C62 48, 54 46, 48 42Z" fill="#E55A2B" opacity="0.4" />
    {/* Motion blur lines on wings */}
    <line x1="60" y1="26" x2="64" y2="24" stroke="#FF6B35" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
    <line x1="62" y1="30" x2="66" y2="28" stroke="#FF6B35" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
    <line x1="60" y1="44" x2="64" y2="46" stroke="#FF6B35" strokeWidth="0.8" opacity="0.3" strokeLinecap="round" />
    {/* Head */}
    <circle cx="34" cy="34" r="8" fill="#FF6B35" />
    <circle cx="33" cy="33" r="4.5" fill="#FF8A5C" opacity="0.4" />
    {/* Eye — big energy */}
    <circle cx="31" cy="33" r="2.2" fill="#2D2D2D" />
    <circle cx="30.3" cy="32.3" r="0.8" fill="white" />
    {/* Long thin beak pointing forward */}
    <path d="M26 34 L14 32 L26 36Z" fill="#2D2D2D" />
    {/* Tail — small, fan */}
    <path d="M52 42 L60 50 L56 44 L62 48 L54 44Z" fill="#E55A2B" />
    {/* Tiny feet — barely visible (hovering) */}
    <line x1="40" y1="47" x2="38" y2="52" stroke="#2D2D2D" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
    <line x1="44" y1="47" x2="42" y2="52" stroke="#2D2D2D" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
    {/* Motion sparkles */}
    <circle cx="18" cy="30" r="1" fill="#FF6B35" opacity="0.4" />
    <circle cx="22" cy="26" r="0.8" fill="#FF6B35" opacity="0.3" />
    <circle cx="16" cy="36" r="0.8" fill="#FF6B35" opacity="0.3" />
  </svg>
);

// ─── Bird Registry ───────────────────────────────────────────
export const BIRD_LIST = [
  { id: 'falcon', name: 'Falcon', trait: 'Speed', Component: FalconSVG },
  { id: 'owl', name: 'Owl', trait: 'Wisdom', Component: OwlSVG },
  { id: 'eagle', name: 'Eagle', trait: 'Leadership', Component: EagleSVG },
  { id: 'peacock', name: 'Peacock', trait: 'Creativity', Component: PeacockSVG },
  { id: 'penguin', name: 'Penguin', trait: 'Reliability', Component: PenguinSVG },
  { id: 'hummingbird', name: 'Hummingbird', trait: 'Agility', Component: HummingbirdSVG },
];

// ─── BirdAvatar — Universal renderer ────────────────────────
const BirdAvatar = ({ birdName = 'falcon', size = 80, className = '' }) => {
  const bird = BIRD_LIST.find(b => b.id === birdName) || BIRD_LIST[0];
  const BirdComponent = bird.Component;
  return <BirdComponent size={size} className={className} />;
};

export default BirdAvatar;
