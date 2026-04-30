/**
 * Navigation Route Constants
 * Centralized route definitions to avoid hardcoded strings
 */

export const ROUTES = {
  // Auth routes
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    FORGOT_PASSWORD: '/auth/forgot-password',
    UNAUTHORIZED: '/unauthorized',
  },
  
  // Main tab routes
  TABS: {
    HOME: '/(tabs)',
    INDEX: '/(tabs)/index',
    COURSES: '/(tabs)/courses',
    LIBRARY: '/(tabs)/library',
    TEACHERS: '/(tabs)/teachers',
    NOTIFICATIONS: '/(tabs)/notifications',
    CHATS: '/(tabs)/chats',
    ATTENDANCE: '/(tabs)/attendance',
    ABOUT: '/(tabs)/about',
  },
  
  // Detail routes
  DETAILS: {
    COURSE: (id: string) => `/course/${id}` as const,
    TEACHER: (id: string) => `/teacher/${id}` as const,
    BOOK: (id: string) => `/book/${id}` as const,
    CHAT: (id: string) => `/chat/${id}` as const,
  },
  
  // Admin routes
  ADMIN: {
    USERS: '/admin/users',
    ADD_BOOK: '/admin/add-book',
    MANAGE_ACADEMICS: '/admin/manage-academics',
    PAYMENTS: '/admin/payments',
    ANALYTICS: '/admin/analytics',
  },
  
  // Other routes
  MORE: '/more',
  STATUS: '/status',
  PAYMENT: '/payment',
} as const;

// Route type helper
export type RouteKey = keyof typeof ROUTES;

// Admin-only routes for access control
export const ADMIN_ONLY_ROUTES = [
  ROUTES.ADMIN.USERS,
  ROUTES.ADMIN.ADD_BOOK,
  ROUTES.ADMIN.MANAGE_ACADEMICS,
  ROUTES.ADMIN.PAYMENTS,
  ROUTES.ADMIN.ANALYTICS,
] as const;

// Public routes (no auth required)
export const PUBLIC_ROUTES = [
  ROUTES.AUTH.LOGIN,
  ROUTES.AUTH.SIGNUP,
  ROUTES.AUTH.FORGOT_PASSWORD,
] as const;

/**
 * Check if a route requires admin access
 */
export function isAdminRoute(path: string): boolean {
  return ADMIN_ONLY_ROUTES.some((route) => path.startsWith(route));
}

/**
 * Check if a route is public (no auth required)
 */
export function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some((route) => path === route);
}
