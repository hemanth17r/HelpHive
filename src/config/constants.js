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
    label: 'Creative Work',
    shortLabel: 'Creative Work',
    icon: Camera,
    type: 'physical',
    isNew: true,
    description: 'Recording vlogs, videos, and capturing events',
    matchingBehavior: 'location_important',
    examples: [
      'Hold my phone/gimbal to film a street food vlog or Reels',
      'Shoot raw video clips of a housewarming party using a phone/camera',
      'Record a local live stream setup or capture local B-roll footage'
    ]
  },
  {
    id: 'events',
    label: 'Event Helpers',
    shortLabel: 'Event Helpers',
    icon: Users,
    type: 'physical',
    description: 'Setup, teardown, and hosting assistance for events and parties',
    matchingBehavior: 'location_important',
    examples: [
      'Blow up balloons, hang banners, and arrange tables for a party',
      'Help pack up decorations, stack rented chairs, and collect trash post-event',
      'Greet guests and handle the reception desk at a local seminar'
    ]
  },
  {
    id: 'moving',
    label: 'Shift & Load',
    shortLabel: 'Shift & Load',
    icon: Boxes,
    type: 'physical',
    isHighDemand: true,
    description: 'Lifting, loading, unloading, and shifting heavy items',
    matchingBehavior: 'location_critical',
    examples: [
      'Need 2 people to carry furniture down 3 floors and load a truck',
      'Help rearrange heavy wardrobes, beds, and tables inside the house',
      'Unload heavy appliances from a delivery vehicle into the kitchen'
    ]
  },
  {
    id: 'queue_standing',
    label: 'Queue Standing & Waiting',
    shortLabel: 'Queue Standing & Waiting',
    icon: Clock,
    type: 'physical',
    isNew: true,
    description: 'Waiting in physical lines on your behalf',
    matchingBehavior: 'location_critical',
    examples: [
      'Stand in line at 6:00 AM at the hospital registry to secure a token',
      'Wait outside a visa center or government office to submit a form',
      'Wait in line for limited concert tickets or product drops'
    ]
  },
  {
    id: 'personal_assistance',
    label: 'Companion Help',
    shortLabel: 'Companion Help',
    icon: HeartHandshake,
    type: 'physical',
    description: 'Personal accompaniment and physical navigation support',
    matchingBehavior: 'location_critical',
    examples: [
      'Escort an elderly relative to a clinic appointment and push wheelchair',
      'Help a physically disabled person navigate public office counters',
      'Accompany you to a crowded market to help carry bags'
    ]
  },
  {
    id: 'local_helpers',
    label: 'Household Help',
    shortLabel: 'Household Help',
    icon: Home,
    type: 'physical',
    description: 'Hands-on help with organizing, assembly, and domestic tasks',
    matchingBehavior: 'location_critical',
    examples: [
      'Assemble an IKEA study desk or wardrobe',
      'Clear dry leaves, prune weeds, and move flower pots in my garden',
      'Help empty, wipe down, and organize my kitchen cabinets'
    ]
  },
  {
    id: 'errands',
    label: 'Local Deliveries',
    shortLabel: 'Local Deliveries',
    icon: Package,
    type: 'physical',
    isUrgent: true,
    description: 'Quick pickups and drop-offs around the city',
    matchingBehavior: 'location_critical',
    examples: [
      'Forgot keys at a cafe. Need someone to pick them up and bring them to me',
      'Buy prescription medicine from the pharmacy nearby and drop it off',
      'Deliver a signed document to a client\'s office 3 km away'
    ]
  },
  {
    id: 'others_physical',
    label: 'Custom On-Site Help',
    shortLabel: 'Custom On-Site Help',
    icon: HelpCircle,
    type: 'physical',
    description: 'Any custom physical task or odd job not covered by other categories',
    matchingBehavior: 'generic',
    examples: [
      'Walk my dog around the park for 30 minutes',
      'Hand out flyers for my new bakery at the local market corner',
      'Supervise an internet installation technician while I work from home'
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
    isHighDemand: true,
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
    isUrgent: true,
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
    label: 'Others',
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
