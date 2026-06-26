import {
  Package,
  HeartHandshake,
  Truck,
  Home,
  Users,
  Camera,
  HelpCircle,
  Video,
  Palette,
  FileText,
  Globe,
  Wifi
} from 'lucide-react';

const CONFIG_CATEGORIES = [
  // --- On-site / Physical Services ---
  {
    id: 'errands',
    label: 'Errands & Deliveries',
    shortLabel: 'Errands',
    icon: Package,
    type: 'physical',
    description: 'Pickups, deliveries, and errands',
    matchingBehavior: 'location_critical',
    examples: [
      'Pick up groceries',
      'Deliver a package',
      'Pick up a prescription',
      'Wait in line for an item'
    ]
  },
  {
    id: 'personal_assistance',
    label: 'Personal Assistance',
    shortLabel: 'Assist',
    icon: HeartHandshake,
    type: 'physical',
    description: 'Queue standing, accompanying, and personal help',
    matchingBehavior: 'location_critical',
    examples: [
      'Personal shopping help',
      'Appointment assistance',
      'Administrative assistance',
      'Senior companionship'
    ]
  },
  {
    id: 'moving',
    label: 'Moving & Heavy Lifting',
    shortLabel: 'Moving',
    icon: Truck,
    type: 'physical',
    description: 'Heavy lifting and moving assistance',
    matchingBehavior: 'location_critical',
    examples: [
      'Move furniture',
      'Load or unload a truck',
      'Help with moving homes',
      'Lift heavy items'
    ]
  },
  {
    id: 'local_helpers',
    label: 'Home Help',
    shortLabel: 'Home Help',
    icon: Home,
    type: 'physical',
    description: 'Furniture assembly, yard cleanup, and household tasks',
    matchingBehavior: 'location_critical',
    examples: [
      'Furniture assembly',
      'Organizing a room or garage',
      'Yard cleanup',
      'Household assistance'
    ]
  },
  {
    id: 'events',
    label: 'Events & Staffing',
    shortLabel: 'Events',
    icon: Users,
    type: 'physical',
    description: 'Temporary workers and event assistance',
    matchingBehavior: 'location_important',
    examples: [
      'Event setup',
      'Event teardown',
      'Registration desk assistance',
      'Temporary event staffing'
    ]
  },
  {
    id: 'creative',
    label: 'Cameraman & Vlog Shooting',
    shortLabel: 'Cameraman',
    icon: Camera,
    type: 'physical',
    isNew: true,
    description: 'Hire a cameraman to shoot vlogs, videos, and events locally',
    matchingBehavior: 'location_important',
    examples: [
      'Shoot a YouTube Vlog',
      'Cameraman for local streamer',
      'Shoot a local event',
      'B-roll local videography'
    ]
  },
  {
    id: 'others_physical',
    label: 'Others (On-site)',
    shortLabel: 'Others',
    icon: HelpCircle,
    type: 'physical',
    description: 'Any other miscellaneous physical tasks',
    matchingBehavior: 'generic',
    examples: [
      'On-site tasks not covered by the categories above'
    ]
  },

  // --- Online & Remote Services ---
  {
    id: 'video_editing',
    label: 'Video & Reels Editing',
    shortLabel: 'Video Edit',
    icon: Video,
    type: 'remote',
    isNew: true,
    description: 'Instagram reels, vlogs, and YouTube editing',
    matchingBehavior: 'remote',
    examples: [
      'Edit a 30s Instagram Reel',
      'Splice and color grade a vlog',
      'Add captions to video',
      'YouTube video editing'
    ]
  },
  {
    id: 'graphic_design',
    label: 'Design & Creatives',
    shortLabel: 'Design',
    icon: Palette,
    type: 'remote',
    isNew: true,
    description: 'Thumbnails, logos, social media posts, and layouts',
    matchingBehavior: 'remote',
    examples: [
      'Create a YouTube Thumbnail',
      'Design a company logo',
      'Social media post graphics',
      'Poster or flyer layout'
    ]
  },
  {
    id: 'writing_translation',
    label: 'Writing & Content',
    shortLabel: 'Writing',
    icon: FileText,
    type: 'remote',
    isNew: true,
    description: 'Content writing, captions, resumes, translation',
    matchingBehavior: 'remote',
    examples: [
      'Write captions for Instagram',
      'Translate text from English to Hindi',
      'Proofread a blog post',
      'Draft a resume or cover letter'
    ]
  },
  {
    id: 'tech_support',
    label: 'Website & Tech Help',
    shortLabel: 'Tech Help',
    icon: Globe,
    type: 'remote',
    isNew: true,
    description: 'Shopify/WordPress set up, bug fixes, sheets formatting',
    matchingBehavior: 'remote',
    examples: [
      'WordPress website bug fixing',
      'Format data in Excel sheets',
      'Set up a Shopify store page',
      'Basic software troubleshooting'
    ]
  },
  {
    id: 'others_remote',
    label: 'Others (Online)',
    shortLabel: 'Others',
    icon: Wifi,
    type: 'remote',
    isNew: true,
    description: 'Any other online/virtual digital tasks',
    matchingBehavior: 'remote',
    examples: [
      'Online tasks not covered by the categories above'
    ]
  }
];

export const SKILLS = [
  ...CONFIG_CATEGORIES.filter(c => c.id !== 'others_physical' && c.id !== 'others_remote'),
  ...CONFIG_CATEGORIES.filter(c => c.id === 'others_physical' || c.id === 'others_remote')
];
