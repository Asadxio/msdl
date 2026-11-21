import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_ORGANIZATION_ID, DEFAULT_ORGANIZATION_NAME } from '@/lib/tenantContext';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  tagline?: string;
  logo_url?: string;
  city?: string;
  state?: string;
  country?: string;
  status: 'active' | 'trial' | 'suspended' | 'archived';
  primary_color?: string;
  secondary_color?: string;
  is_featured?: boolean;
  student_count_approx?: number;
}

const STORAGE_KEY_ORGS_CACHE = '@suffah_cached_organizations_v1';

export const FLAGSHIP_ORGANIZATION: OrganizationSummary = {
  id: DEFAULT_ORGANIZATION_ID,
  name: DEFAULT_ORGANIZATION_NAME,
  slug: 'mslb',
  tagline: "Markaz-e-Ta'leem: Dedicated to Women's Islamic Education & Adab (جامعة الصالحات)",
  city: 'Hyderabad',
  state: 'Telangana',
  country: 'India',
  status: 'active',
  primary_color: '#005F46',
  secondary_color: '#C8A84E',
  is_featured: true,
  student_count_approx: 500,
};

/**
 * Fetch all publicly listed active and trial madrasas for onboarding selection.
 * Always includes MSLB as the featured flagship madrasa at index 0.
 * Falls back gracefully to cached directory or offline bundle on network errors.
 */
export async function getPublicOrganizations(): Promise<OrganizationSummary[]> {
  try {
    const orgsRef = collection(db, 'organizations');
    // Fetch active and trial organizations
    const q = query(orgsRef, where('status', 'in', ['active', 'trial']), limit(100));
    const snapshot = await getDocs(q);

    const remoteOrgs: OrganizationSummary[] = [];
    let hasMslb = false;

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const isMslb = docSnap.id === DEFAULT_ORGANIZATION_ID || data.slug === 'mslb';
      if (isMslb) hasMslb = true;

      remoteOrgs.push({
        id: docSnap.id,
        name: data.name || 'Madrasa',
        slug: data.slug || docSnap.id,
        tagline: data.tagline || '',
        logo_url: data.logo_url || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || 'India',
        status: data.status || 'active',
        primary_color: data.primary_color || '#005F46',
        secondary_color: data.secondary_color || '#C8A84E',
        is_featured: isMslb || Boolean(data.is_featured),
        student_count_approx: data.student_count_approx || 0,
      });
    });

    // If mslb-main is not yet in firestore docs or status differed, prepended as flagship
    if (!hasMslb) {
      remoteOrgs.unshift(FLAGSHIP_ORGANIZATION);
    } else {
      // Ensure mslb-main is at index 0
      const mslbIndex = remoteOrgs.findIndex((o) => o.id === DEFAULT_ORGANIZATION_ID || o.slug === 'mslb');
      if (mslbIndex > 0) {
        const [mslbItem] = remoteOrgs.splice(mslbIndex, 1);
        mslbItem.is_featured = true;
        remoteOrgs.unshift(mslbItem);
      }
    }

    // Cache to AsyncStorage for immediate offline cold-start
    await AsyncStorage.setItem(STORAGE_KEY_ORGS_CACHE, JSON.stringify(remoteOrgs)).catch(() => {});
    return remoteOrgs;
  } catch (err) {
    console.warn('[organizationDirectory] Failed to fetch remote organizations, attempting cache fallback:', err);
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY_ORGS_CACHE);
      if (cached) {
        const parsed: OrganizationSummary[] = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [FLAGSHIP_ORGANIZATION];
  }
}

/**
 * Fast search utility for filtering organizations by name, city, state, or slug.
 */
export function searchOrganizations(orgs: OrganizationSummary[], searchFilter: string): OrganizationSummary[] {
  const queryText = (searchFilter || '').trim().toLowerCase();
  if (!queryText) return orgs;

  return orgs.filter((org) => {
    return (
      org.name.toLowerCase().includes(queryText) ||
      (org.city && org.city.toLowerCase().includes(queryText)) ||
      (org.state && org.state.toLowerCase().includes(queryText)) ||
      org.slug.toLowerCase().includes(queryText) ||
      org.id.toLowerCase().includes(queryText)
    );
  });
}
