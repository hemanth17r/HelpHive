import {
  Package,
  HeartHandshake,
  Truck,
  Home,
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
    label: 'Creative Services',
    shortLabel: 'Creative',
    icon: Camera,
    description: 'Photography, design, and content creation',
    matchingBehavior: 'location_important',
    examples: [
      'Photography',
      'Videography',
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
      'Tasks not covered by the categories above'
    ]
  }
];

export const SKILLS = [
  ...CONFIG_CATEGORIES.filter(c => c.id !== 'others'),
  ...CONFIG_CATEGORIES.filter(c => c.id === 'others')
];
