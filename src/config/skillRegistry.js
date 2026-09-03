import {
  Utensils,
  Coffee,
  Car,
  Compass,
  HeartHandshake,
  Camera,
  Video,
  Palette,
  Volume2,
  Boxes,
  Wrench,
  Clock,
  Package,
  ShoppingCart,
  Code,
  Table,
  Monitor,
  Gamepad2,
  Users,
  Mic,
  FileText,
  Languages,
  Search,
  Zap,
  Crown,
  Award,
  Star,
  Trees,
  Footprints
} from 'lucide-react';

/**
 * 8 Core Hero Disciplines (Game Skill Domains)
 */
export const HERO_DISCIPLINES = [
  {
    id: 'culinary',
    title: 'Culinary & Feast Craft',
    shortTitle: 'Feast Craft',
    description: 'Camp cooking, party batch feasts, artisan refreshments & baked treats',
    icon: Utensils,
    color: 'from-amber-500 to-orange-500',
    type: 'physical'
  },
  {
    id: 'adventure',
    title: 'Adventure, Escort & Scouting',
    shortTitle: 'Scouts & Escorts',
    description: 'Trip piloting, trail trekking, elderly clinic escorts & pet care',
    icon: Compass,
    color: 'from-emerald-500 to-teal-500',
    type: 'physical'
  },
  {
    id: 'creative_ops',
    title: 'Visual, Drone & Content Alchemy',
    shortTitle: 'Creative Ops',
    description: 'Drone 4K aerials, street gimbal cam, viral reels edits & brand art',
    icon: Camera,
    color: 'from-purple-500 to-pink-500',
    type: 'hybrid'
  },
  {
    id: 'titan_muscle',
    title: 'Titan Muscle & Tactician Build',
    shortTitle: 'Titan Muscle',
    description: 'Heavy shifts, flatpack IKEA assembly, base fixes & groundskeeping',
    icon: Boxes,
    color: 'from-blue-600 to-indigo-600',
    type: 'physical'
  },
  {
    id: 'urban_recon',
    title: 'Urban Recon & Velocity Proxy',
    shortTitle: 'Velocity Proxy',
    description: 'Hospital OPD token queues, emergency sprints & market scouting',
    icon: Clock,
    color: 'from-amber-600 to-yellow-500',
    type: 'physical'
  },
  {
    id: 'cyber_alchemy',
    title: 'Cyber & Code Alchemy',
    shortTitle: 'Cyber & Code',
    description: 'Live hotfixes, sheets automation, PC builds & esports coaching',
    icon: Code,
    color: 'from-cyan-500 to-blue-500',
    type: 'remote'
  },
  {
    id: 'event_crew',
    title: 'Event Squad & Atmosphere',
    shortTitle: 'Event Squad',
    description: 'Stage strike teardown, crowd emceeing & aesthetic theme decor',
    icon: Users,
    color: 'from-rose-500 to-pink-600',
    type: 'physical'
  },
  {
    id: 'intel_lore',
    title: 'Intel, Wordsmith & Voice Oracle',
    shortTitle: 'Intel & Words',
    description: 'Hook copywriting, regional language voiceovers & deep web research',
    icon: FileText,
    color: 'from-violet-500 to-indigo-500',
    type: 'remote'
  }
];

/**
 * 28+ Granular, Monetizable Game Skills (100% Wholesome & Family-Friendly)
 */
export const GAME_SKILLS = [
  // --- A. Culinary & Feast Craft ---
  {
    id: 'feast_chef',
    disciplineId: 'culinary',
    categoryId: 'local_helpers', // Legacy DB mapping
    label: 'Camp Chef & Feast Master',
    shortLabel: 'Feast Chef',
    icon: Utensils,
    type: 'physical',
    isHighDemand: true,
    tagline: 'Cooks for trip squads, outdoor BBQ & party feasts',
    examples: [
      'Cook delicious camp food and BBQ for our 8-person weekend trip squad',
      'Prep multi-course party batch lunch at an Airbnb gathering',
      'Craft signature biryani or customized family meal batch'
    ],
    aliases: ['cooking', 'cook', 'chef', 'bbq', 'trip food', 'breakfast prep', 'biryani', 'party food', 'kitchen help', 'meal prep']
  },
  {
    id: 'refreshment_artisan',
    disciplineId: 'culinary',
    categoryId: 'events',
    label: 'Artisan Juice & Refreshment Alchemist',
    shortLabel: 'Juice & Mocktails',
    icon: Coffee,
    type: 'physical',
    tagline: 'Fresh fruit juice bar, smoothies & mocktail stations',
    examples: [
      'Manage fresh fruit smoothie and mocktail bar for 40 party guests',
      'Set up artisan lemonade & hydration station for outdoor sports event',
      'Craft signature fruit punch drinks for birthday celebration'
    ],
    aliases: ['juice bar', 'smoothies', 'mocktails', 'refreshments', 'drinks', 'fruit punch', 'lemonade stand', 'beverages']
  },
  {
    id: 'bake_artisan',
    disciplineId: 'culinary',
    categoryId: 'creative',
    label: 'Bake & Dessert Artisan',
    shortLabel: 'Bake Artisan',
    icon: Utensils,
    type: 'physical',
    tagline: 'Celebration cakes, artisan pastries & dessert tables',
    examples: [
      'Bake custom 2-tier themed birthday cake with intricate piping',
      'Set up aesthetic dessert platter for family anniversary',
      'Bake fresh batch of artisan cupcakes for weekend gathering'
    ],
    aliases: ['baker', 'cakes', 'pastries', 'desserts', 'cupcakes', 'sweets', 'baking']
  },

  // --- B. Adventure, Escort & Scouting ---
  {
    id: 'trip_pilot',
    disciplineId: 'adventure',
    categoryId: 'errands',
    label: 'Trip Pilot & Road Escort',
    shortLabel: 'Trip Pilot',
    icon: Car,
    type: 'physical',
    isHighDemand: true,
    tagline: 'Long-distance road trip driver & highway escort',
    examples: [
      'Drive our SUV on a 6-hour hill station road trip with friends',
      'Night highway driving escort for out-of-station family journey',
      'Express airport pilot: drive client vehicle and return safely'
    ],
    aliases: ['driver', 'road trip', 'chauffeur', 'car pilot', 'highway drive', 'trip driver', 'outstation driver']
  },
  {
    id: 'trail_guide',
    disciplineId: 'adventure',
    categoryId: 'personal_assistance',
    label: 'Trail Guide & Trek Leader',
    shortLabel: 'Trail Guide',
    icon: Compass,
    type: 'physical',
    tagline: 'Hiking leader, campsite scout & hidden spots guide',
    examples: [
      'Lead our friend group on a safe sunrise mountain trek route',
      'Scout and set up campsite tents for overnight valley hike',
      'Guide newcomers through local nature reserve trails'
    ],
    aliases: ['trekking', 'hiking', 'local guide', 'trail lead', 'camping', 'trek leader', 'scout']
  },
  {
    id: 'guardian_escort',
    disciplineId: 'adventure',
    categoryId: 'personal_assistance',
    label: 'Guardian Escort & Mobility Shield',
    shortLabel: 'Guardian Escort',
    icon: HeartHandshake,
    type: 'physical',
    tagline: 'Clinic companion, wheelchair assist & patient support',
    examples: [
      'Escort senior citizen to hospital appointment and assist wheelchair',
      'Accompany family member through crowded civic/government counters',
      'Assist patient with clinic navigation and prescription retrieval'
    ],
    aliases: ['hospital companion', 'elderly care', 'wheelchair assist', 'patient escort', 'escort', 'mobility support']
  },
  {
    id: 'pet_ranger',
    disciplineId: 'adventure',
    categoryId: 'others_physical',
    label: 'Pet Ranger & Animal Whisperer',
    shortLabel: 'Pet Ranger',
    icon: Footprints,
    type: 'physical',
    isHighDemand: true,
    tagline: 'Dog walking pack leader, pet sitting & animal care',
    examples: [
      'Take 2 Golden Retrievers on a high-energy 45-minute park run',
      'Pet sit and feed a cat while owners are away for the weekend',
      'Escort dog to vet clinic appointment and assist handling'
    ],
    aliases: ['dog walking', 'pet sitting', 'dog runner', 'cat care', 'puppy sitting', 'vet escort', 'pet care']
  },

  // --- C. Visual, Drone & Content Alchemy ---
  {
    id: 'drone_aviator',
    disciplineId: 'creative_ops',
    categoryId: 'creative',
    label: 'Drone Aviator & Aerial Cam',
    shortLabel: 'Drone Aviator',
    icon: Camera,
    type: 'physical',
    isHighDemand: true,
    tagline: '4K aerial videography & panoramic drone capture',
    examples: [
      'Capture cinematic 4K overhead drone shots of outdoor wedding venue',
      'Fly FPV drone for action car track or bike trail video footage',
      'Aerial land and roof inspection scan with high-res photos'
    ],
    aliases: ['drone', 'aerial video', 'fpv', 'drone pilot', 'mavic', 'aerial photography', 'sky shots']
  },
  {
    id: 'gimbal_cameraman',
    disciplineId: 'creative_ops',
    categoryId: 'creative',
    label: 'Gimbal Master & Street Cam',
    shortLabel: 'Gimbal Cam',
    icon: Video,
    type: 'physical',
    tagline: 'Street reels filming, smartphone gimbal & raw B-roll',
    examples: [
      'Hold phone on gimbal to film high-energy street food vlog and Reels',
      'Record multi-angle live event B-roll clips for instant social posting',
      'Follow host dynamically through expo or conference hall'
    ],
    aliases: ['reels filming', 'smartphone cam', 'video shoot', 'b-roll', 'content creator', 'gimbal', 'camera operator']
  },
  {
    id: 'reels_editor',
    disciplineId: 'creative_ops',
    categoryId: 'video_editing',
    label: 'Viral Reels & Kinetic Editor',
    shortLabel: 'Reels Editor',
    icon: Zap,
    type: 'remote',
    isHighDemand: true,
    tagline: 'High-retention Reels, Shorts & sound design',
    examples: [
      'Turn raw 10-min podcast recording into 3 viral Shorts with kinetic subtitles',
      'Cut and color-grade high-energy Instagram Reel with sound effects',
      'Speed-edit event recap video under 60 seconds with motion graphics'
    ],
    aliases: ['video editing', 'capcut', 'premiere', 'subtitles', 'viral hook', 'shorts editor', 'reels edit']
  },
  {
    id: 'visual_artist',
    disciplineId: 'creative_ops',
    categoryId: 'graphic_design',
    label: 'Visual Alchemist & Brand Artist',
    shortLabel: 'Brand Artist',
    icon: Palette,
    type: 'remote',
    tagline: 'High-CTR YouTube thumbnails, vector badges & decks',
    examples: [
      'Design ultra high-CTR YouTube thumbnail with custom glow typography',
      'Craft vector logo badge, icons, and social media brand kit',
      'Design 10-slide high-impact presentation pitch deck graphics'
    ],
    aliases: ['thumbnail design', 'logo', 'photoshop', 'canva', 'graphic design', 'poster design', 'banner']
  },
  {
    id: 'live_sound_dj',
    disciplineId: 'creative_ops',
    categoryId: 'events',
    label: 'Live Sound & DJ Beatmaker',
    shortLabel: 'Sound & DJ',
    icon: Volume2,
    type: 'physical',
    tagline: 'Party sound setups, wireless mics & acoustic mixes',
    examples: [
      'Set up PA speakers, audio mixer, and 4 wireless mics for stage talk',
      'DJ energetic music set for house birthday bash or sports meet',
      'Live audio balancing and sound check for musical band performance'
    ],
    aliases: ['dj', 'sound system', 'audio mixer', 'speaker setup', 'music', 'sound check', 'pa system']
  },

  // --- D. Titan Muscle & Tactician Build ---
  {
    id: 'titan_muscle',
    disciplineId: 'titan_muscle',
    categoryId: 'moving',
    label: 'Titan Muscle & Heavy Shift',
    shortLabel: 'Titan Muscle',
    icon: Boxes,
    type: 'physical',
    isHighDemand: true,
    tagline: 'Heavy furniture moves, truck loading & space shifts',
    examples: [
      '2 Heroes needed to move heavy solid wood wardrobe down 3 flights of stairs',
      'Load commercial appliances and heavy sound gear into transport van',
      'Rearrange heavy home gym equipment and steel racks'
    ],
    aliases: ['heavy lifting', 'furniture moving', 'truck unload', 'shift muscle', 'lifting', 'moving', 'load truck']
  },
  {
    id: 'modular_assembly',
    disciplineId: 'titan_muscle',
    categoryId: 'local_helpers',
    label: 'Modular Craft & Flatpack Builder',
    shortLabel: 'Flatpack Builder',
    icon: Wrench,
    type: 'physical',
    tagline: 'IKEA furniture assembly, modular desk & shelf setups',
    examples: [
      'Assemble 3-door modular wardrobe, study desk, and gaming chair',
      'Mount dual monitor arms and custom cable management on workstation',
      'Precision build modular shelving unit with magnetic doors'
    ],
    aliases: ['ikea assembly', 'wardrobe build', 'desk setup', 'furniture assembly', 'modular assembly', 'flatpack']
  },
  {
    id: 'base_handyman',
    disciplineId: 'titan_muscle',
    categoryId: 'local_helpers',
    label: 'Base Repair & Handyman Ops',
    shortLabel: 'Handyman Ops',
    icon: Wrench,
    type: 'physical',
    tagline: 'Wall drilling, curtain rod mounts, tap fixes & fixtures',
    examples: [
      'Drill and securely mount 4 curtain rods and heavy bathroom mirrors',
      'Fix leaking kitchen sink tap and replace flush valve seal',
      'Mount ceiling fan and replace damaged wall switchboards'
    ],
    aliases: ['drilling', 'handyman', 'plumber fix', 'electrician fix', 'wall mount', 'tap leak', 'home repair']
  },
  {
    id: 'groundskeeper',
    disciplineId: 'titan_muscle',
    categoryId: 'local_helpers',
    label: 'Groundskeeper & Terrain Clear',
    shortLabel: 'Groundskeeper',
    icon: Trees,
    type: 'physical',
    tagline: 'Lawn mowing, foliage pruning & outdoor overhaul',
    examples: [
      'Prune overgrown garden hedges, trim lawn, and clear yard foliage',
      'Power-wash patio stones, clear perimeter moss, and bag garden waste',
      'Prepare backyard flower beds and potting soil for new saplings'
    ],
    aliases: ['gardening', 'lawn mowing', 'yard clean', 'bush trimming', 'grass cutting', 'patio clean']
  },

  // --- E. Urban Recon & Velocity Proxy ---
  {
    id: 'queue_proxy',
    disciplineId: 'urban_recon',
    categoryId: 'queue_standing',
    label: 'Queue Recon & Priority Proxy',
    shortLabel: 'Queue Proxy',
    icon: Clock,
    type: 'physical',
    isHighDemand: true,
    tagline: '6 AM Hospital OPD tokens, embassy lines & ticket drops',
    examples: [
      'Secure 6:00 AM hospital OPD specialist priority token on my behalf',
      'Hold position at regional transport / passport office counter',
      'Hold front queue spot for limited sneaker or collectible drop'
    ],
    aliases: ['hospital token', 'queue stand', 'line holding', 'embassy token', 'opd token', 'queue', 'proxy line']
  },
  {
    id: 'velocity_courier',
    disciplineId: 'urban_recon',
    categoryId: 'errands',
    label: 'Velocity Sprint & Courier',
    shortLabel: 'Velocity Sprint',
    icon: Package,
    type: 'physical',
    isUrgent: true,
    tagline: 'Urgent key recoveries, medicine sprints & fast drops',
    examples: [
      'Urgent key recovery: pick up house keys from office and rush across town',
      'Procure prescription medicines from 24/7 hospital pharmacy immediately',
      'Express courier: transport sealed legal document in under 30 minutes'
    ],
    aliases: ['urgent delivery', 'key pickup', 'fast courier', 'medicine sprint', 'express courier', 'package drop', 'errands']
  },
  {
    id: 'supply_scout',
    disciplineId: 'urban_recon',
    categoryId: 'errands',
    label: 'Market Scout & Supply Proxy',
    shortLabel: 'Supply Scout',
    icon: ShoppingCart,
    type: 'physical',
    tagline: 'Wholesale market bargaining & custom grocery sourcing',
    examples: [
      'Procure bulk fresh organic produce from central wholesale market',
      'Scout local hardware street for specific vintage plumbing brass fitting',
      'Hand-pick fresh bakery supplies and party favors across multiple shops'
    ],
    aliases: ['grocery shopper', 'market run', 'buy items', 'wholesale scout', 'shopping proxy', 'market scout']
  },

  // --- F. Cyber & Code Alchemy ---
  {
    id: 'code_hotfix',
    disciplineId: 'cyber_alchemy',
    categoryId: 'tech_support',
    label: 'Code Slayer & Web Hotfix',
    shortLabel: 'Web Hotfix',
    icon: Code,
    type: 'remote',
    isUrgent: true,
    tagline: 'Urgent web bug fixes, Shopify deploy & database hotfixes',
    examples: [
      'Hotfix critical React/Next.js production bug breaking checkout flow',
      'Deploy and configure high-converting Shopify store theme and payment gateway',
      'Debug SQL query timeout and resolve API connection bottleneck'
    ],
    aliases: ['bug fix', 'website help', 'shopify', 'wordpress', 'code debugger', 'react fix', 'programmer', 'hotfix']
  },
  {
    id: 'sheet_wizard',
    disciplineId: 'cyber_alchemy',
    categoryId: 'tech_support',
    label: 'Automation Mage & Sheet Wizard',
    shortLabel: 'Sheet Wizard',
    icon: Table,
    type: 'remote',
    tagline: 'Excel formulas, Google Sheets macros & Zapier flows',
    examples: [
      'Build automated Google Sheets dashboard with INDEX/MATCH and QUERY formulas',
      'Set up Zapier automation syncing incoming leads directly to CRM and WhatsApp',
      'Cleanse, deduplicate, and standardize 5,000 messy customer spreadsheet rows'
    ],
    aliases: ['excel formulas', 'google sheets', 'zapier automation', 'data cleanup', 'excel macro', 'sheet wizard']
  },
  {
    id: 'pc_tactician',
    disciplineId: 'cyber_alchemy',
    categoryId: 'tech_support',
    label: 'Hardware Tactician & PC Builder',
    shortLabel: 'PC Builder',
    icon: Monitor,
    type: 'remote',
    tagline: 'Custom gaming PC builds, Wi-Fi mesh & device setup',
    examples: [
      'Guide component selection and assemble custom water-cooled gaming rig',
      'Troubleshoot home Wi-Fi dead zones and configure mesh router network',
      'Set up wireless printer, multi-monitor display hub, and backup NAS'
    ],
    aliases: ['gaming pc build', 'wifi fix', 'router setup', 'computer repair', 'pc builder', 'hardware setup']
  },
  {
    id: 'gaming_coach',
    disciplineId: 'cyber_alchemy',
    categoryId: 'others_remote',
    label: 'Esports Coach & Squad Carry',
    shortLabel: 'Game Coach',
    icon: Gamepad2,
    type: 'remote',
    tagline: 'Rank coaching, co-op duo carry & mechanics training',
    examples: [
      '1-on-1 aim, positioning, and crosshair placement coaching for Valorant/CS2',
      'Co-op duo partner to clear high-difficulty MMO raid dungeon',
      'Review recorded gameplay clips and provide tactical strategy analysis'
    ],
    aliases: ['valorant coach', 'bgmi duo', 'gaming tutor', 'game carry', 'esports coach', 'gameplay coach']
  },

  // --- G. Event Squad & Atmosphere ---
  {
    id: 'event_strike_squad',
    disciplineId: 'event_crew',
    categoryId: 'events',
    label: 'Event Squad & Strike Teardown',
    shortLabel: 'Event Strike',
    icon: Users,
    type: 'physical',
    tagline: 'Rapid stage setup, banner hanging & midnight teardown',
    examples: [
      'Stage prep, lighting/banner setup, and 100-chair seating arrangement',
      'Rapid midnight strike teardown: gear packing, truss breakdown, and site cleanup',
      'VIP guest reception desk check-in and queue coordination'
    ],
    aliases: ['event helper', 'stage setup', 'venue teardown', 'party setup', 'crew squad', 'event strike']
  },
  {
    id: 'hype_host',
    disciplineId: 'event_crew',
    categoryId: 'events',
    label: 'Hype Emcee & Crowd Host',
    shortLabel: 'Hype Emcee',
    icon: Mic,
    type: 'physical',
    tagline: 'Birthday games host, party anchor & crowd energizer',
    examples: [
      'Host engaging party games and keep energy high at birthday event',
      'Serve as charismatic master of ceremonies for college fest or corporate meet',
      'Lead crowd warm-up exercises and introduce stage performers'
    ],
    aliases: ['emcee', 'anchor', 'party host', 'announcer', 'event speaker', 'mc', 'host']
  },
  {
    id: 'flash_decorator',
    disciplineId: 'event_crew',
    categoryId: 'events',
    label: 'Flash Stylist & Decor Alchemist',
    shortLabel: 'Decor Alchemist',
    icon: Palette,
    type: 'physical',
    tagline: 'Balloon arches, photo booth styling & theme aesthetics',
    examples: [
      'Build organic pastel balloon arch and neon light backdrop photo booth',
      'Style aesthetic table centerpieces and fairy lighting for garden party',
      'Transform blank hall into vibrant retro-themed celebration space'
    ],
    aliases: ['balloon decor', 'party styling', 'theme decoration', 'backdrop setup', 'decorator', 'party decor']
  },

  // --- H. Intel, Wordsmith & Voice Oracle ---
  {
    id: 'hook_wordsmith',
    disciplineId: 'intel_lore',
    categoryId: 'writing_translation',
    label: 'Hook Copywriter & Wordsmith',
    shortLabel: 'Copy Wordsmith',
    icon: FileText,
    type: 'remote',
    tagline: 'High-converting copy, viral threads & pitch decks',
    examples: [
      'Write high-hook Instagram carousel captions and X viral threads',
      'Craft high-converting landing page headlines and sales email sequence',
      'Polish executive resume, LinkedIn headline, and founder pitch deck'
    ],
    aliases: ['copywriting', 'content writing', 'resume revamp', 'caption writer', 'wordsmith', 'sales copy', 'deck writing']
  },
  {
    id: 'linguistic_oracle',
    disciplineId: 'intel_lore',
    categoryId: 'writing_translation',
    label: 'Linguistic Oracle & Regional Voice',
    shortLabel: 'Voice Oracle',
    icon: Languages,
    type: 'remote',
    tagline: 'Live translation, regional voiceover & subtitle dubbing',
    examples: [
      'Translate English business contract into accurate conversational Hindi/Telugu',
      'Record energetic regional language voiceover for product promo video',
      'Proofread and culturally adapt regional marketing campaign slogans'
    ],
    aliases: ['translation', 'english to hindi', 'voiceover', 'regional dubbing', 'translator', 'dubbing', 'regional voice']
  },
  {
    id: 'intel_scout',
    disciplineId: 'intel_lore',
    categoryId: 'others_remote',
    label: 'Deep Intel & Market Scout',
    shortLabel: 'Intel Scout',
    icon: Search,
    type: 'remote',
    tagline: 'In-depth web research, competitor pricing & sourcing',
    examples: [
      'Conduct deep online research and compile top 30 direct manufacturing suppliers',
      'Audit competitor pricing matrix and feature breakdown across 10 products',
      'Fact-check historical dossiers and find verified primary source citations'
    ],
    aliases: ['web research', 'data scraping', 'sourcing list', 'price research', 'market research', 'intel', 'fact finder']
  },
  {
    id: 'custom_physical_op',
    disciplineId: 'urban_recon',
    categoryId: 'others_physical',
    label: 'Custom Physical Bounty & Special Op',
    shortLabel: 'Custom Physical Op',
    icon: Zap,
    type: 'physical',
    tagline: 'Unique on-site micro-quests, bespoke tasks & local errands',
    examples: [
      'Specialized in-person errand or custom assistance tailored to your exact needs',
      'Bespoke physical or local coordination not listed in standard disciplines',
      'One-off unique local mission with custom instructions'
    ],
    aliases: ['custom', 'other', 'others', 'special', 'misc', 'general', 'unique', 'miscellaneous', 'anything', 'help', 'task', 'errand', 'request', 'custom_op']
  },
  {
    id: 'custom_remote_op',
    disciplineId: 'intel_lore',
    categoryId: 'others_remote',
    label: 'Custom Remote Bounty & Special Op',
    shortLabel: 'Custom Remote Op',
    icon: Zap,
    type: 'remote',
    tagline: 'Unique digital micro-quests, virtual tasks & online assistance',
    examples: [
      'Specialized online task or digital assistance tailored to your exact needs',
      'Bespoke remote coordination or virtual gig not listed in standard disciplines',
      'One-off unique online mission with custom instructions'
    ],
    aliases: ['remote custom', 'digital help', 'virtual task', 'online help', 'custom remote', 'remote task', 'misc remote']
  }
];

/**
 * Legacy Category Map (Zero-Breakage Backward Compatibility)
 * Maps old category IDs to their primary game skill counterparts
 */
export const LEGACY_CATEGORY_MAP = {
  moving: ['titan_muscle'],
  local_helpers: ['modular_assembly', 'base_handyman', 'feast_chef', 'groundskeeper'],
  errands: ['velocity_courier', 'trip_pilot', 'supply_scout'],
  queue_standing: ['queue_proxy'],
  personal_assistance: ['guardian_escort', 'trail_guide'],
  creative: ['gimbal_cameraman', 'drone_aviator', 'bake_artisan'],
  events: ['event_strike_squad', 'refreshment_artisan', 'hype_host', 'flash_decorator', 'live_sound_dj'],
  video_editing: ['reels_editor'],
  graphic_design: ['visual_artist'],
  tech_support: ['code_hotfix', 'pc_tactician', 'sheet_wizard'],
  writing_translation: ['hook_wordsmith', 'linguistic_oracle'],
  others_physical: ['pet_ranger', 'custom_physical_op'],
  others_remote: ['gaming_coach', 'intel_scout', 'custom_remote_op']
};

/**
 * Mastery Calculation Engine
 * Tiers: Rookie (0-2) -> Pro (3-5) -> Expert (6-9) -> Legend / Skill King (10+)
 */
export const getSkillMastery = (skillId, completedQuestsCount = 0) => {
  const count = Number(completedQuestsCount) || 0;
  if (count >= 10) {
    return {
      tier: 4,
      name: 'Tier 4: Skill King',
      shortName: 'Legend King',
      badgeClass: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black shadow-md border border-amber-300',
      tagColor: 'text-amber-600 bg-amber-50 border-amber-300',
      icon: Crown,
      glow: true
    };
  }
  if (count >= 6) {
    return {
      tier: 3,
      name: 'Tier 3: Master Tactician',
      shortName: 'Master',
      badgeClass: 'bg-purple-100 text-purple-900 border border-purple-300 font-extrabold',
      tagColor: 'text-purple-700 bg-purple-50 border-purple-200',
      icon: Award,
      glow: false
    };
  }
  if (count >= 3) {
    return {
      tier: 2,
      name: 'Tier 2: Pro Specialist',
      shortName: 'Pro',
      badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300 font-bold',
      tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: Star,
      glow: false
    };
  }
  return {
    tier: 1,
    name: 'Tier 1: Rookie Operator',
    shortName: 'Rookie',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200 font-semibold',
    tagColor: 'text-slate-600 bg-slate-50 border-slate-200',
    icon: Zap,
    glow: false
  };
};

/**
 * Resolves an array of user skill IDs (which may contain legacy category IDs or custom skills)
 * into rich, normalized game skill objects with mastery levels.
 */
export const resolveUserSkills = (rawSkillsArray = [], completedTasksCount = 0) => {
  if (!Array.isArray(rawSkillsArray) || rawSkillsArray.length === 0) {
    return [];
  }

  const resolvedIds = new Set();

  rawSkillsArray.forEach(id => {
    if (!id) return;
    // If it is a direct match in GAME_SKILLS
    if (GAME_SKILLS.some(s => s.id === id)) {
      resolvedIds.add(id);
    } else if (LEGACY_CATEGORY_MAP[id]) {
      // If it is a legacy category ID, add its mapped game skills
      LEGACY_CATEGORY_MAP[id].forEach(mappedId => resolvedIds.add(mappedId));
    } else {
      // Custom forged skill
      resolvedIds.add(id);
    }
  });

  return Array.from(resolvedIds).map(id => {
    const definedSkill = GAME_SKILLS.find(s => s.id === id);
    if (definedSkill) {
      return {
        ...definedSkill,
        mastery: getSkillMastery(definedSkill.id, completedTasksCount)
      };
    }
    // Custom forged skill card
    return {
      id: id,
      label: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      shortLabel: id.split('_')[0],
      icon: Zap,
      type: 'physical',
      isCustom: true,
      tagline: 'Custom Forged Hero Skill',
      aliases: [id.toLowerCase()],
      mastery: getSkillMastery(id, completedTasksCount)
    };
  });
};

/**
 * Instant Search Engine for Game Skills
 * Performs fuzzy keyword and alias matching across all skills and disciplines.
 */
export const searchGameSkills = (query = '') => {
  const clean = query.trim().toLowerCase();
  if (!clean) return GAME_SKILLS;

  return GAME_SKILLS.filter(skill => {
    if (skill.label.toLowerCase().includes(clean)) return true;
    if (skill.shortLabel.toLowerCase().includes(clean)) return true;
    if (skill.tagline.toLowerCase().includes(clean)) return true;
    if (skill.id.toLowerCase().includes(clean)) return true;
    if (skill.aliases?.some(a => a.toLowerCase().includes(clean))) return true;
    if (skill.examples?.some(e => e.toLowerCase().includes(clean))) return true;
    return false;
  });
};
