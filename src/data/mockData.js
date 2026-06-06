import {
  Package,
  ShoppingBag,
  Tent,
  Camera,
  BookOpen,
  Compass,
  Laptop,
  HelpCircle
} from 'lucide-react';

const CONFIG_CATEGORIES = [
  { id: 'moving', label: 'Moving', shortLabel: 'Moving', icon: Package, description: 'Help with shifting and moving items' },
  { id: 'errands', label: 'Errands', shortLabel: 'Errands', icon: ShoppingBag, description: 'Running local errands and shopping' },
  { id: 'events', label: 'Events', shortLabel: 'Events', icon: Tent, description: 'Event Setup, management, and hosting' },
  { id: 'photography', label: 'Photography', shortLabel: 'Photos', icon: Camera, description: 'Photography, filming, and editing' },
  { id: 'academic_help', label: 'Academic Help', shortLabel: 'Academic', icon: BookOpen, description: 'Tutoring, homework help, and guidance' },
  { id: 'travel', label: 'Travel', shortLabel: 'Travel', icon: Compass, description: 'Travel, tour guiding, and transport help' },
  { id: 'tech_help', label: 'Tech Help', shortLabel: 'Tech', icon: Laptop, description: 'IT support, coding, and gadget setup' },
  { id: 'others', label: 'Others', shortLabel: 'Others', icon: HelpCircle, description: 'Any other miscellaneous tasks' }
];

export const SKILLS = [
  ...CONFIG_CATEGORIES.filter(c => c.id !== 'others'),
  ...CONFIG_CATEGORIES.filter(c => c.id === 'others')
];
