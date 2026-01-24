// Permission keys that map to sidebar menu items
export const PERMISSION_KEYS = {
  dashboard: 'dashboard',
  daily_money_flow: 'daily_money_flow',
  customers: 'customers',
  customer_insights: 'customer_insights',
  call_schedule: 'call_schedule',
  sales_closers: 'sales_closers',
  batch_icc: 'batch_icc',
  batch_futures: 'batch_futures',
  batch_high_future: 'batch_high_future',
  workshops: 'workshops',
  sales: 'sales',
  funnels: 'funnels',
  products: 'products',
  users: 'users',
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
  '/batches': PERMISSION_KEYS.batch_icc,
  '/futures-mentorship': PERMISSION_KEYS.batch_futures,
  '/high-future': PERMISSION_KEYS.batch_high_future,
  '/workshops': PERMISSION_KEYS.workshops,
  '/sales': PERMISSION_KEYS.sales,
  '/funnels': PERMISSION_KEYS.funnels,
  '/products': PERMISSION_KEYS.products,
  '/users': PERMISSION_KEYS.users,
};

// Permission labels for UI display
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: 'Dashboard',
  daily_money_flow: 'Daily Money Flow',
  customers: 'Customers',
  customer_insights: 'Customer Insights',
  call_schedule: '1:1 Call Schedule',
  sales_closers: 'Sales Closers',
  batch_icc: 'Insider Crypto Club',
  batch_futures: 'Future Mentorship',
  batch_high_future: 'High Future',
  workshops: 'All Workshops',
  sales: 'Sales',
  funnels: 'Active Funnels',
  products: 'Products',
  users: 'Users',
};

// Permission groups for organized display
export const PERMISSION_GROUPS = [
  {
    label: 'Main Menu',
    permissions: [
      PERMISSION_KEYS.dashboard,
      PERMISSION_KEYS.daily_money_flow,
      PERMISSION_KEYS.customers,
      PERMISSION_KEYS.customer_insights,
      PERMISSION_KEYS.call_schedule,
      PERMISSION_KEYS.sales_closers,
    ],
  },
  {
    label: 'Cohort Batches',
    permissions: [
      PERMISSION_KEYS.batch_icc,
      PERMISSION_KEYS.batch_futures,
      PERMISSION_KEYS.batch_high_future,
    ],
  },
  {
    label: 'Other',
    permissions: [
      PERMISSION_KEYS.workshops,
      PERMISSION_KEYS.sales,
      PERMISSION_KEYS.funnels,
      PERMISSION_KEYS.products,
      PERMISSION_KEYS.users,
    ],
  },
];

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<string, PermissionKey[]> = {
  admin: Object.values(PERMISSION_KEYS), // All permissions
  manager: [
    PERMISSION_KEYS.daily_money_flow,
    PERMISSION_KEYS.customers,
    PERMISSION_KEYS.sales_closers,
    PERMISSION_KEYS.batch_icc,
    PERMISSION_KEYS.batch_futures,
    PERMISSION_KEYS.batch_high_future,
    PERMISSION_KEYS.workshops,
  ],
  sales_rep: [
    PERMISSION_KEYS.call_schedule,
    PERMISSION_KEYS.sales_closers,
    PERMISSION_KEYS.batch_icc,
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
