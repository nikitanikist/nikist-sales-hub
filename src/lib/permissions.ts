// Permission keys that map to sidebar menu items
export const PERMISSION_KEYS = {
  dashboard: 'dashboard',
  daily_money_flow: 'daily_money_flow',
  customers: 'customers',
  customer_insights: 'customer_insights',
  call_schedule: 'call_schedule',
  sales_closers: 'sales_closers',
  cohort_batches: 'cohort_batches', // Unified permission for all cohort types
  workshops: 'workshops',
  sales: 'sales',
  funnels: 'funnels',
  products: 'products',
  users: 'users',
  settings: 'settings',
  whatsapp: 'whatsapp',
} as const;

export type PermissionKey = typeof PERMISSION_KEYS[keyof typeof PERMISSION_KEYS];

// Map routes to permission keys
export const ROUTE_TO_PERMISSION: Record<string, PermissionKey> = {
  '/': PERMISSION_KEYS.dashboard,
  '/daily-money-flow': PERMISSION_KEYS.daily_money_flow,
  '/leads': PERMISSION_KEYS.customers,
  '/onboarding': PERMISSION_KEYS.customer_insights,
  '/calls': PERMISSION_KEYS.call_schedule,
  '/sales-closers': PERMISSION_KEYS.sales_closers,
  // Legacy routes map to unified cohort permission
  '/batches': PERMISSION_KEYS.cohort_batches,
  '/futures-mentorship': PERMISSION_KEYS.cohort_batches,
  '/high-future': PERMISSION_KEYS.cohort_batches,
  // Dynamic cohort routes handled separately
  '/cohorts': PERMISSION_KEYS.cohort_batches,
  '/workshops': PERMISSION_KEYS.workshops,
  '/sales': PERMISSION_KEYS.sales,
  '/funnels': PERMISSION_KEYS.funnels,
  '/products': PERMISSION_KEYS.products,
  '/users': PERMISSION_KEYS.users,
  '/settings': PERMISSION_KEYS.settings,
  '/whatsapp': PERMISSION_KEYS.whatsapp,
  '/whatsapp/campaigns': PERMISSION_KEYS.whatsapp,
  '/whatsapp/templates': PERMISSION_KEYS.whatsapp,
  '/whatsapp/scheduled': PERMISSION_KEYS.whatsapp,
};

// Permission labels for UI display
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Dashboard',
  daily_money_flow: 'Daily Money Flow',
  customers: 'All Customers',
  customer_insights: 'Customer Insights',
  call_schedule: '1:1 Call Schedule',
  sales_closers: 'Sales Closers',
  cohort_batches: 'Cohort Batches',
  workshops: 'All Workshops',
  sales: 'Sales',
  funnels: 'Active Funnels',
  products: 'Products',
  users: 'Team Members',
  settings: 'Organization Settings',
  whatsapp: 'WhatsApp',
};

// Permission groups for organized display (matches sidebar structure)
export const PERMISSION_GROUPS = [
  {
    label: 'Finance',
    permissions: [
      PERMISSION_KEYS.daily_money_flow,
      PERMISSION_KEYS.sales,
    ],
  },
  {
    label: 'Customers',
    permissions: [
      PERMISSION_KEYS.customers,
      PERMISSION_KEYS.customer_insights,
    ],
  },
  {
    label: 'Closers',
    permissions: [
      PERMISSION_KEYS.call_schedule,
      PERMISSION_KEYS.sales_closers,
    ],
  },
  {
    label: 'Funnels',
    permissions: [
      PERMISSION_KEYS.workshops,
      PERMISSION_KEYS.funnels,
      PERMISSION_KEYS.products,
    ],
  },
  {
    label: 'Cohort Batches',
    permissions: [
      PERMISSION_KEYS.cohort_batches,
    ],
  },
  {
    label: 'WhatsApp',
    permissions: [
      PERMISSION_KEYS.whatsapp,
    ],
  },
  {
    label: 'Other',
    permissions: [
      PERMISSION_KEYS.dashboard,
      PERMISSION_KEYS.users,
      PERMISSION_KEYS.settings,
    ],
  },
];

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: Object.values(PERMISSION_KEYS), // All permissions
  manager: [
    PERMISSION_KEYS.dashboard,
    // daily_money_flow - NOT included
    PERMISSION_KEYS.customers,
    PERMISSION_KEYS.customer_insights,
    PERMISSION_KEYS.call_schedule,
    PERMISSION_KEYS.sales_closers,
    PERMISSION_KEYS.cohort_batches,
    PERMISSION_KEYS.workshops,
    PERMISSION_KEYS.sales,
    PERMISSION_KEYS.funnels,
    PERMISSION_KEYS.products,
    PERMISSION_KEYS.whatsapp,
    // users - NOT included
  ],
  sales_rep: [
    PERMISSION_KEYS.call_schedule,
    PERMISSION_KEYS.sales_closers,
    PERMISSION_KEYS.cohort_batches,
  ],
  viewer: [], // No permissions by default
};

// Get default permissions for a role
export function getDefaultPermissionsForRole(role: string): Record<PermissionKey, boolean> {
  const allPermissions = Object.values(PERMISSION_KEYS);
  const enabledPermissions = DEFAULT_PERMISSIONS[role] || [];
  
  return allPermissions.reduce((acc, key) => {
    acc[key] = enabledPermissions.includes(key);
    return acc;
  }, {} as Record<PermissionKey, boolean>);
}

// Check if a route is a cohort route
export function isCohortRoute(path: string): boolean {
  return path.startsWith('/cohorts/') || 
         path === '/batches' || 
         path === '/futures-mentorship' || 
         path === '/high-future';
}

// Get permission key for a route (handles dynamic cohort routes)
export function getPermissionForRoute(path: string): PermissionKey | undefined {
  // Check exact match first
  if (ROUTE_TO_PERMISSION[path]) {
    return ROUTE_TO_PERMISSION[path];
  }
  
  // Handle dynamic cohort routes
  if (path.startsWith('/cohorts/')) {
    return PERMISSION_KEYS.cohort_batches;
  }
  
  // Handle dynamic whatsapp routes
  if (path.startsWith('/whatsapp')) {
    return PERMISSION_KEYS.whatsapp;
  }
  
  return undefined;
}
