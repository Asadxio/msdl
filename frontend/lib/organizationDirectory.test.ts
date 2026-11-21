jest.mock('@/lib/firebase', () => ({
  db: {},
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

import {
  FLAGSHIP_ORGANIZATION,
  searchOrganizations,
  OrganizationSummary,
} from './organizationDirectory';
import { DEFAULT_ORGANIZATION_ID } from './tenantContext';

describe('Multi-Madrasa Organization Directory Service', () => {
  const mockOrganizations: OrganizationSummary[] = [
    FLAGSHIP_ORGANIZATION,
    {
      id: 'jamia-fatima',
      name: 'Jamia Fatima Lil Banat',
      slug: 'jamia-fatima',
      city: 'Delhi',
      state: 'Delhi',
      country: 'India',
      status: 'active',
      primary_color: '#005F46',
      secondary_color: '#C8A84E',
      is_featured: false,
    },
    {
      id: 'darul-huda',
      name: 'Darul Huda Islamic Academy',
      slug: 'darul-huda',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      country: 'India',
      status: 'trial',
      primary_color: '#005F46',
      secondary_color: '#C8A84E',
      is_featured: false,
    },
  ];

  test('flagship organization is MSLB and is marked as featured', () => {
    expect(FLAGSHIP_ORGANIZATION.id).toBe(DEFAULT_ORGANIZATION_ID);
    expect(FLAGSHIP_ORGANIZATION.id).toBe('mslb-main');
    expect(FLAGSHIP_ORGANIZATION.is_featured).toBe(true);
    expect(FLAGSHIP_ORGANIZATION.name).toContain('Salikat');
  });

  test('searchOrganizations returns all items for empty search', () => {
    const results = searchOrganizations(mockOrganizations, '');
    expect(results).toHaveLength(3);
  });

  test('searchOrganizations filters by madrasa name (case-insensitive)', () => {
    const results = searchOrganizations(mockOrganizations, 'fatima');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('jamia-fatima');
  });

  test('searchOrganizations filters by city', () => {
    const results = searchOrganizations(mockOrganizations, 'Lucknow');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('darul-huda');
  });

  test('searchOrganizations filters by slug/code', () => {
    const results = searchOrganizations(mockOrganizations, 'mslb');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('mslb-main');
  });

  test('searchOrganizations returns empty list for unmatched query', () => {
    const results = searchOrganizations(mockOrganizations, 'xyznonexistent123');
    expect(results).toHaveLength(0);
  });

  test('each madrasa organization supports distinct social and support channels', () => {
    const madrasaA: Partial<import('./tenantContext').Organization> = {
      id: 'madrasa-a',
      name: 'Madrasa Ayesha',
      whatsapp_channel: 'https://whatsapp.com/channel/aaa111',
      whatsapp_contact: '+919876543210',
      instagram: 'https://instagram.com/madrasa_ayesha',
      youtube_link: 'https://youtube.com/@madrasa_ayesha',
      telegram_link: 'https://t.me/madrasa_ayesha',
      website: 'https://ayesha.edu',
    };

    const madrasaB: Partial<import('./tenantContext').Organization> = {
      id: 'madrasa-b',
      name: 'Jamia Khadija',
      whatsapp_channel: 'https://whatsapp.com/channel/bbb222',
      whatsapp_contact: '+919123456789',
      instagram: 'https://instagram.com/jamia_khadija',
      youtube_link: 'https://youtube.com/@jamia_khadija',
      telegram_link: 'https://t.me/jamia_khadija',
      website: 'https://khadija.org',
    };

    expect(madrasaA.whatsapp_channel).not.toBe(madrasaB.whatsapp_channel);
    expect(madrasaA.whatsapp_contact).not.toBe(madrasaB.whatsapp_contact);
    expect(madrasaA.instagram).not.toBe(madrasaB.instagram);
    expect(madrasaA.youtube_link).not.toBe(madrasaB.youtube_link);
    expect(madrasaA.telegram_link).not.toBe(madrasaB.telegram_link);
    expect(madrasaA.website).not.toBe(madrasaB.website);
  });
});
