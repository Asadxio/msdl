import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

export const DEFAULT_ORGANIZATION_ID = 'mslb-main';
export const DEFAULT_ORGANIZATION_NAME = "Madrasatu-s-Salikat Lil Banat";
const STORAGE_KEY_ACTIVE_ORG = '@mslb_active_organization_id_v1';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  language?: string;
  status: 'active' | 'trial' | 'suspended' | 'archived';
  plan_id?: 'starter' | 'growth' | 'enterprise';
  subscription_status?: 'active' | 'trial' | 'past_due' | 'canceled';
  payment_status?: 'pending' | 'received' | 'not_required' | 'waived';
  payment_reference?: string;
  payment_confirmed_at?: any;
  activated_by?: string;
  student_limit?: number;
  teacher_limit?: number;
  primary_color?: string;
  secondary_color?: string;
  setup_checklist_dismissed?: boolean;
  is_demo?: boolean;
  created_at?: any;
  updated_at?: any;
}

export interface OrganizationMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'student' | 'teacher' | 'assistant_teacher' | 'moderator' | 'admin' | 'super_admin';
  status: 'active' | 'pending' | 'suspended';
  joined_at: any;
  invited_by?: string;
}

// In-memory cache of active organization ID for synchronous read
let cachedActiveOrgId: string = DEFAULT_ORGANIZATION_ID;
const activeOrgListeners = new Set<(orgId: string) => void>();

/**
 * Retrieve the active organization ID from storage or fallback to default.
 */
export async function getActiveOrganizationId(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY_ACTIVE_ORG);
    if (saved && saved.trim().length > 0) {
      cachedActiveOrgId = saved.trim();
      return cachedActiveOrgId;
    }
  } catch (err) {
    console.warn('[TenantContext] Failed to read active org ID from storage:', err);
  }
  return DEFAULT_ORGANIZATION_ID;
}

/**
 * Synchronous get of active org ID (defaults to mslb-main).
 */
export function getActiveOrganizationIdSync(): string {
  return cachedActiveOrgId || DEFAULT_ORGANIZATION_ID;
}

/**
 * Persist the active organization ID for multi-tenant switching.
 */
export async function setActiveOrganizationId(orgId: string): Promise<void> {
  try {
    const clean = (orgId || DEFAULT_ORGANIZATION_ID).trim();
    cachedActiveOrgId = clean;
    await AsyncStorage.setItem(STORAGE_KEY_ACTIVE_ORG, clean);
    activeOrgListeners.forEach((listener) => listener(clean));
  } catch (err) {
    console.warn('[TenantContext] Failed to save active org ID to storage:', err);
  }
}

/**
 * Reset active organization to default on logout or user switch.
 */
export async function resetActiveOrganization(): Promise<void> {
  try {
    cachedActiveOrgId = DEFAULT_ORGANIZATION_ID;
    await AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_ORG);
    activeOrgListeners.forEach((listener) => listener(DEFAULT_ORGANIZATION_ID));
  } catch (err) {
    console.warn('[TenantContext] Failed to reset active org ID in storage:', err);
  }
}

/**
 * Fetch organization metadata by ID with local caching.
 */
export async function getOrganizationMetadata(orgId: string): Promise<Organization | null> {
  try {
    const orgRef = doc(db, 'organizations', orgId || DEFAULT_ORGANIZATION_ID);
    const snap = await getDoc(orgRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Organization;
    }
  } catch (err) {
    console.warn('[TenantContext] Failed to fetch organization metadata:', err);
  }
  return null;
}

/**
 * Ensures the default organization exists in Firestore without overwriting existing data.
 */
export async function ensureDefaultOrganization(): Promise<Organization> {
  const orgRef = doc(db, 'organizations', DEFAULT_ORGANIZATION_ID);
  const snap = await getDoc(orgRef);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as Organization;
  }

  const defaultOrg: Organization = {
    id: DEFAULT_ORGANIZATION_ID,
    name: DEFAULT_ORGANIZATION_NAME,
    slug: 'mslb',
    phone: '+91-9999999999',
    email: 'sumraftm@gmail.com',
    status: 'active',
    plan_id: 'enterprise',
    subscription_status: 'active',
    student_limit: 10000,
    teacher_limit: 500,
    primary_color: '#005F46',
    secondary_color: '#C8A84E',
  };

  await setDoc(orgRef, {
    ...defaultOrg,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return defaultOrg;
}

/**
 * React hook for consuming and updating active tenant context.
 */
export function useActiveOrganization() {
  const [activeOrgId, setActiveOrgIdState] = useState<string>(cachedActiveOrgId);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    // Read initial
    getActiveOrganizationId().then((id) => {
      if (isMounted) {
        setActiveOrgIdState(id);
      }
    });

    const listener = (newId: string) => {
      if (isMounted) {
        setActiveOrgIdState(newId);
      }
    };
    activeOrgListeners.add(listener);

    return () => {
      isMounted = false;
      activeOrgListeners.delete(listener);
    };
  }, []);

  // Listen to Firestore document of active organization
  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const orgRef = doc(db, 'organizations', activeOrgId);
    const unsub = onSnapshot(
      orgRef,
      (snap) => {
        if (snap.exists()) {
          setActiveOrg({ id: snap.id, ...snap.data() } as Organization);
        } else if (activeOrgId === DEFAULT_ORGANIZATION_ID) {
          // Fallback if mslb-main doc is pending
          ensureDefaultOrganization().then((org) => setActiveOrg(org));
        } else {
          setActiveOrg(null);
        }
        setLoading(false);
      },
      (err) => {
        console.warn('[useActiveOrganization] Snapshot listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [activeOrgId]);

  const switchOrganization = useCallback(async (orgId: string) => {
    await setActiveOrganizationId(orgId);
  }, []);

  return {
    activeOrgId,
    activeOrg,
    loading,
    switchOrganization,
    isDefaultOrg: activeOrgId === DEFAULT_ORGANIZATION_ID,
  };
}

