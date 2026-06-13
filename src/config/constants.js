import {
  Package,
  HeartHandshake,
  Truck,
  MapPin,
  Users,
  Laptop,
  Camera,
  HelpCircle
} from 'lucide-react';

const CONFIG_CATEGORIES = [
  {
    id: 'errands',
    label: 'Errands & Deliveries',
    shortLabel: 'Errands',
    icon: Package,
    description: 'Pickups, deliveries, and errands',
    matchingBehavior: 'location_critical',
    examples: [
      'Need someone to bring keys from home to office',
      'Pick up medicines and deliver them',
      'Deliver important documents nearby',
      'Collect a parcel and drop it off'
    ]
  },
  {
    id: 'personal_assistance',
    label: 'Personal Assistance',
    shortLabel: 'Assist',
    icon: HeartHandshake,
    description: 'Queue standing, accompanying, and personal help',
    matchingBehavior: 'location_critical',
    examples: [
      'Need someone to stand in a queue',
      'Need help accompanying an elderly family member',
      'Need someone to wait for a courier',
      'Looking for a helper for an hour'
    ]
  },
  {
    id: 'moving',
    label: 'Moving & Lifting',
    shortLabel: 'Moving',
    icon: Truck,
    description: 'Heavy lifting and moving assistance',
    matchingBehavior: 'location_critical',
    examples: [
      'Need 2 people to unload items from a truck',
      'Help moving furniture upstairs',
      'Need assistance shifting heavy boxes',
      'Help with apartment moving'
    ]
  },
  {
    id: 'local_helpers',
    label: 'Local Helpers',
    shortLabel: 'Local',
    icon: MapPin,
    description: 'Small local tasks and neighborhood help',
    matchingBehavior: 'location_critical',
    examples: [
      'Check a property',
      'Water plants',
      'Organize a room',
      'Small local tasks',
      'Quick neighborhood help'
    ]
  },
  {
    id: 'events',
    label: 'Events & Staffing',
    shortLabel: 'Events',
    icon: Users,
    description: 'Temporary workers and event assistance',
    matchingBehavior: 'location_important',
    examples: [
      'Event helpers needed',
      'Temporary workers for today',
      'Wedding helpers',
      'Registration desk helpers',
      'Setup assistance'
    ]
  },
  {
    id: 'creative',
    label: 'Creative Services',
    shortLabel: 'Creative',
    icon: Camera,
    description: 'Photography, design, and content creation',
    matchingBehavior: 'location_important',
    examples: [
      'Photography for an hour',
      'Videography needed',
      'Editing assistance',
      'Graphic design',
      'Content creation'
    ]
  },
  {
    id: 'others',
    label: 'Others',
    shortLabel: 'Others',
    icon: HelpCircle,
    description: 'Any other miscellaneous tasks',
    matchingBehavior: 'generic',
    examples: [
      'Anything not covered above',
      'Miscellaneous request'
    ]
  }
];

export const SKILLS = [
  ...CONFIG_CATEGORIES.filter(c => c.id !== 'others'),
  ...CONFIG_CATEGORIES.filter(c => c.id === 'others')
];
