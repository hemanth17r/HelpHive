import {
  Package,
  HeartHandshake,
  Boxes,
  Home,
  Users,
  Camera,
  HelpCircle,
  Clock,
  Video,
  Palette,
  FileText,
  Globe,
  Wifi
} from 'lucide-react';

const CONFIG_CATEGORIES = [
  // --- On-site / Physical Services ---
  {
    id: 'creative',
    label: 'Creative Ops & Media',
    shortLabel: 'Creative Ops',
    icon: Camera,
    type: 'physical',
    isNew: true,
    description: 'Street filming, gimbal work, drone capture, and live events',
    matchingBehavior: 'location_important',
    examples: [
      'Hold phone/gimbal to film a high-energy street food vlog or Reels',
      'Capture raw cinematic clips of an event or private gathering',
      'Record multi-angle live stream setup and local B-roll footage'
    ]
  },
  {
    id: 'events',
    label: 'Crew & Event Squad',
    shortLabel: 'Event Squad',
    icon: Users,
    type: 'physical',
    description: 'Crowd coordination, tactical setup, hosting, and rapid strike teardown',
    matchingBehavior: 'location_important',
    examples: [
      'Stage prep, lighting/banner setup, and venue arrangement',
      'Rapid strike teardown: gear packing, chair stacking, and site cleanup',
      'VIP guest reception desk & crowd coordination at local event'
    ]
  },
  {
    id: 'moving',
    label: 'Muscle & Heavy Logistics',
    shortLabel: 'Muscle & Shift',
    icon: Boxes,
    type: 'physical',
    isHighDemand: true,
    description: 'Heavy lifting, rapid loading/unloading, and space re-hauling',
    matchingBehavior: 'location_critical',
    examples: [
      'Need 2 Operators to move heavy furniture down 3 floors and load truck',
      'Rearrange heavy wardrobes, workstations, and gym equipment',
      'Unload commercial appliances and heavy gear into venue/residence'
    ]
  },
  {
    id: 'queue_standing',
    label: 'Queue Recon & Proxy',
    shortLabel: 'Queue Recon',
    icon: Clock,
    type: 'physical',
    isNew: true,
    description: 'Physical proxy line holding, token acquisition, and counter submissions',
    matchingBehavior: 'location_critical',
    examples: [
      'Secure 6:00 AM hospital OPD priority token on my behalf',
      'Hold position at embassy or government office to submit documents',
      'Hold front spot in line for exclusive sneaker/concert drops'
    ]
  },
  {
    id: 'personal_assistance',
    label: 'Field Escort & Navigation',
    shortLabel: 'Field Escort',
    icon: HeartHandshake,
    type: 'physical',
    description: 'Personal accompaniment, mobility support, and physical navigation',
    matchingBehavior: 'location_critical',
    examples: [
      'Escort an elderly family member to a clinic and assist wheelchair mobility',
      'Accompany client through crowded civic offices and counter navigation',
      'Assist navigation and carry cargo through crowded city markets'
    ]
  },
  {
    id: 'local_helpers',
    label: 'Craft & Domestic Base Ops',
    shortLabel: 'Base Ops',
    icon: Home,
    type: 'physical',
    description: 'Gear assembly, spatial organization, groundskeeping, and base fixes',
    matchingBehavior: 'location_critical',
    examples: [
      'Assemble precision modular workstations or flat-pack wardrobes',
      'Prune perimeter foliage, clear grounds, and organize outdoor patio',
      'Overhaul, deep-clean, and systematically organize storage units'
    ]
  },
  {
    id: 'errands',
    label: 'Rapid Courier & Street Runs',
    shortLabel: 'Street Runs',
    icon: Package,
    type: 'physical',
    isUrgent: true,
    description: 'High-speed urban pickups, item drops, and time-critical deliveries',
    matchingBehavior: 'location_critical',
    examples: [
      'Urgent key recovery: pick up keys from cafe and rush deliver across town',
      'Procure prescription supplies from 24/7 pharmacy and drop off immediately',
      'Express courier: transport sealed contract to client HQ in under 30 mins'
    ]
  },
  {
    id: 'others_physical',
    label: 'Custom Field Missions',
    shortLabel: 'Custom Ops',
    icon: HelpCircle,
    type: 'physical',
    description: 'Custom on-site operations, reconnaissance, and unique physical tasks',
    matchingBehavior: 'generic',
    examples: [
      'Run urban dog training walk around the park for 45 minutes',
      'Deploy tactical flyer distribution for new store launch at high-traffic spot',
      'On-site supervision and security check during third-party tech installations'
    ]
  },

  // --- Online & Remote Services ---
  {
    id: 'video_editing',
    label: 'Cinematic & Reels Production',
    shortLabel: 'Video Edit',
    icon: Video,
    type: 'remote',
    isNew: true,
    isHighDemand: true,
    description: 'High-retention Reels, YouTube edits, sound design, and color grading',
    matchingBehavior: 'remote',
    examples: [
      'Cut and polish a viral 30s Instagram Reel with kinetic captions',
      'Cinematic color grading, pacing, and sound mix for YouTube vlog',
      'Rapid turnaround subtitle rendering, motion graphics, and audio boost'
    ]
  },
  {
    id: 'graphic_design',
    label: 'Visual Identity & Creative Lab',
    shortLabel: 'Design Lab',
    icon: Palette,
    type: 'remote',
    isNew: true,
    description: 'Thumbnails, vector logos, social assets, and deck graphics',
    matchingBehavior: 'remote',
    examples: [
      'Craft high-CTR YouTube Thumbnail with custom graphics',
      'Design modern vector logo, brand badges, and iconography',
      'Create high-impact social media campaign carousel designs'
    ]
  },
  {
    id: 'writing_translation',
    label: 'Content Intelligence & Copy',
    shortLabel: 'Copy & Content',
    icon: FileText,
    type: 'remote',
    isNew: true,
    description: 'High-conversion copywriting, localized translations, and editorial polish',
    matchingBehavior: 'remote',
    examples: [
      'Write engaging, high-hook social media caption threads',
      'Accurate English to Hindi / regional linguistic translation',
      'Revamp and elevate executive resume and portfolio pitch deck'
    ]
  },
  {
    id: 'tech_support',
    label: 'Cyber & Systems Engineering',
    shortLabel: 'Cyber & Tech',
    icon: Globe,
    type: 'remote',
    isNew: true,
    isUrgent: true,
    description: 'Website troubleshooting, cloud deployments, code debugging, and data sheets',
    matchingBehavior: 'remote',
    examples: [
      'Fix live production website bug and database connection glitch',
      'Automate complex Google Sheets / Excel data pipelines and macros',
      'Configure and deploy high-converting Shopify store storefront'
    ]
  },
  {
    id: 'others_remote',
    label: 'Special Remote Ops',
    shortLabel: 'Special Ops',
    icon: Wifi,
    type: 'remote',
    isNew: true,
    description: 'Custom digital tasks, remote workflows, and online specialist projects',
    matchingBehavior: 'remote',
    examples: [
      'Custom online research, data scraping, or specialized remote tasks'
    ]
  }
];

export { HERO_DISCIPLINES, GAME_SKILLS, LEGACY_CATEGORY_MAP, getSkillMastery, resolveUserSkills, searchGameSkills } from './skillRegistry';

export const SKILLS = [
  ...CONFIG_CATEGORIES.filter(c => c.id !== 'others_physical' && c.id !== 'others_remote'),
  ...CONFIG_CATEGORIES.filter(c => c.id === 'others_physical' || c.id === 'others_remote')
];

export const SUB_SKILL_TAGS = {
  creative: ['Reels Filming', 'Phone Gimbal', 'Event B-Roll', 'Cinematic Photo', 'Drone 4K'],
  events: ['Tactical Setup', 'Juice & Mocktails', 'Crowd Desk', 'Gear Teardown', 'Site Strike', 'Live Sound & DJ'],
  moving: ['Titan Muscle', 'Furniture Shift', 'Cargo Unload', 'Gear Moving', 'Workstation Build'],
  queue_standing: ['Hospital Priority', 'Embassy Token', 'Drop Queue', 'Visa Submission'],
  personal_assistance: ['Guardian Escort', 'Trail Guide', 'Wheelchair Support', 'Civic Guide'],
  local_helpers: ['Modular Assembly', 'Camp Chef', 'Handyman Ops', 'Groundskeeper', 'Storage Overhaul'],
  errands: ['Velocity Sprint', 'Trip Pilot', 'Supply Scout', 'Express Courier'],
  video_editing: ['Viral Reels', 'YouTube Cut', 'Kinetic Captions', 'Color Grade'],
  graphic_design: ['High-CTR Thumbnail', 'Vector Logo', 'Campaign Assets', 'Brand Deck'],
  writing_translation: ['Hook Copywriting', 'Voice Oracle', 'Pitch Polish', 'Dossier Draft'],
  tech_support: ['Code Hotfix', 'Sheet Wizard', 'PC Builder', 'System Debug'],
  others_physical: ['Custom Specs', 'Priority Dispatch', 'Special Gear', 'On-Demand'],
  others_remote: ['Custom Specs', 'Priority Dispatch', 'Special Request', 'On-Demand'],
  custom_op: ['Custom Specs', 'Priority Dispatch', 'Special Request', 'On-Demand']
};

export const GOATED_GUEST_PROFILE = {
  id: 'guest_goated_user',
  isGuest: true,
  name: 'Felix Wing',
  posterName: 'Felix Wing',
  taskerName: 'Felix Wing',
  handle: '@felix_wing',
  email: 'felix.wing.demo@helphive.app',
  phone: '+91 98765 43210',
  posterPhone: '+91 98765 43210',
  taskerPhone: '+91 98765 43210',
  verifiedPhones: ['+91 98765 43210'],
  bird: 'falcon',
  upiId: 'felix.wing@pay',
  unpaidCommissionDues: 0,
  referredBy: null,
  level: 12,
  totalTasksCompletedCount: 42,
  coverageRadius: 15,
  coverageLevel: 'district',
  serviceAreaName: 'Downtown & Tech District',
  serviceAreaLat: 12.9716,
  serviceAreaLng: 77.5946,
  
  // Goated Metrics for Tasker Role Context
  taskerRating: 4.98,
  taskerTasksCompleted: 42,
  taskerEarningsAmount: 24500,
  taskerEarnings: '₹24,500',
  taskerBadges: [
    'Skill King',
    'Community Hero',
    'Ultra Responder',
    'Safety Verified',
    'Speed Demon'
  ],
  taskerReviews: [
    {
      id: 'rev_1',
      reviewerName: 'Priya Sharma',
      reviewerBird: 'phoenix',
      rating: 5,
      role_context: 'tasker',
      comment: 'Felix arrived 10 minutes early with full toolkit and fixed complex workstation wiring in 20 mins! Absolute legend.',
      date: '2 days ago',
      taskTitle: 'Modular Workstation Build & Setup'
    },
    {
      id: 'rev_2',
      reviewerName: 'Rohan Mehta',
      reviewerBird: 'owl',
      rating: 5,
      role_context: 'tasker',
      comment: 'Super polite, handled heavy lifting effortlessly down 3 flights of stairs. Highest recommendation!',
      date: '1 week ago',
      taskTitle: 'Titan Muscle & Heavy Shift'
    },
    {
      id: 'rev_3',
      reviewerName: 'Ananya Rao',
      reviewerBird: 'hummingbird',
      rating: 5,
      role_context: 'tasker',
      comment: 'Extremely professional and clean work on our event lighting setup. Saved our evening tech launch!',
      date: '2 weeks ago',
      taskTitle: 'Event Strike Squad Setup'
    }
  ],

  // Goated Metrics for Poster Role Context
  posterRating: 5.0,
  posterTasksCompleted: 18,
  posterPaidOutAmount: 14200,
  posterPaidOut: '₹14,200',
  posterBadges: [
    'Legendary Host',
    'Instant Gold Payout',
    'Clear Objectives',
    '5-Star Guild Master'
  ],
  posterReviews: [
    {
      id: 'rev_p1',
      reviewerName: 'Vikram Das',
      reviewerBird: 'eagle',
      rating: 5,
      role_context: 'poster',
      comment: 'Great host! Clear instructions, accurate location, and released payment immediately upon quest completion.',
      date: '3 days ago',
      taskTitle: 'Velocity Sprint & Key Drop'
    },
    {
      id: 'rev_p2',
      reviewerName: 'Karan Verma',
      reviewerBird: 'falcon',
      rating: 5,
      role_context: 'poster',
      comment: 'Super easy to work with Felix. Super polite, quick communication and great tip!',
      date: '10 days ago',
      taskTitle: 'Queue Recon & Priority Token'
    }
  ],

  // Active Equipped Skills (Tasker Hero Sheet)
  skills: [
    'titan_muscle',
    'modular_assembly',
    'code_hotfix',
    'velocity_courier',
    'drone_aviator',
    'feast_chef'
  ],

  // Default fallback compatibility fields
  rating: 4.98,
  tasksCompleted: 42,
  badges: [
    'Skill King',
    'Community Hero',
    'Ultra Responder',
    'Safety Verified'
  ],
  reviews: []
};

export const GUEST_DEMO_ARCHIVE_JOBS = [
  {
    id: 'demo_job_1',
    title: 'Modular Workstation Build & Setup',
    description: 'Assemble dual motorized standing desk with cable management raceway in tech hub.',
    skillId: 'modular_assembly',
    amount: 2400,
    status: 'completed',
    v2_status: 'completed',
    taskerId: 'guest_goated_user',
    taskerName: 'Felix Wing',
    posterName: 'Priya Sharma',
    posterBird: 'phoenix',
    otp: '8491',
    completedAt: '2 days ago',
    timePosted: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    rating: 5,
    review: 'Felix arrived 10 minutes early with full toolkit and fixed complex workstation wiring in 20 mins! Absolute legend.'
  },
  {
    id: 'demo_job_2',
    title: 'Titan Muscle & Heavy Shift',
    description: 'Move 3 solid oak server credenzas across floor 4 to conference wing.',
    skillId: 'titan_muscle',
    amount: 3800,
    status: 'completed',
    v2_status: 'completed',
    taskerId: 'guest_goated_user',
    taskerName: 'Felix Wing',
    posterName: 'Rohan Mehta',
    posterBird: 'owl',
    otp: '3912',
    completedAt: '1 week ago',
    timePosted: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    rating: 5,
    review: 'Super polite, handled heavy lifting effortlessly down 3 flights of stairs. Highest recommendation!'
  },
  {
    id: 'demo_job_3',
    title: 'Event Strike Squad & Tech Setup',
    description: 'Deploy RGB stage washes and backup wireless audio receivers for product launch.',
    skillId: 'code_hotfix',
    amount: 4500,
    status: 'completed',
    v2_status: 'completed',
    taskerId: 'guest_goated_user',
    taskerName: 'Felix Wing',
    posterName: 'Ananya Rao',
    posterBird: 'hummingbird',
    otp: '5204',
    completedAt: '2 weeks ago',
    timePosted: new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString(),
    rating: 5,
    review: 'Extremely professional and clean work on our event lighting setup. Saved our evening tech launch!'
  }
];

export const GUEST_DEMO_DEPLOYED_JOBS = [
  {
    id: 'demo_dep_1',
    title: 'Velocity Sprint & Hardware Drop',
    description: 'Deliver emergency backup SSD drive to Sector 7 Studio before livestream.',
    skillId: 'velocity_courier',
    amount: 1500,
    status: 'completed',
    v2_status: 'completed',
    posterId: 'guest_goated_user',
    posterName: 'Felix Wing',
    taskerName: 'Vikram Das',
    taskerBird: 'eagle',
    otp: '9182',
    completedAt: '3 days ago',
    timePosted: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    rating: 5,
    review: 'Great host! Clear instructions, accurate location, and released payment immediately upon quest completion.'
  },
  {
    id: 'demo_dep_2',
    title: 'Queue Recon & Priority Token',
    description: 'Hold priority VIP pass line at Tech Expo entrance for delegation.',
    skillId: 'queue_standing',
    amount: 1800,
    status: 'completed',
    v2_status: 'completed',
    posterId: 'guest_goated_user',
    posterName: 'Felix Wing',
    taskerName: 'Karan Verma',
    taskerBird: 'falcon',
    otp: '6743',
    completedAt: '10 days ago',
    timePosted: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    rating: 5,
    review: 'Super easy to work with Felix. Super polite, quick communication and great tip!'
  }
];


