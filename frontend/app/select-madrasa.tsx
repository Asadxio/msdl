import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getPublicOrganizations,
  searchOrganizations,
  OrganizationSummary,
  FLAGSHIP_ORGANIZATION,
} from '@/lib/organizationDirectory';
import { setActiveOrganizationId, getActiveOrganizationIdSync } from '@/lib/tenantContext';
import { COLORS } from '@/constants/theme';

export default function SelectMadrasaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([FLAGSHIP_ORGANIZATION]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(getActiveOrganizationIdSync());

  const loadOrganizations = useCallback(async () => {
    try {
      const list = await getPublicOrganizations();
      setOrganizations(list);
    } catch (err) {
      console.warn('[SelectMadrasa] Error loading organizations:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrganizations();
  }, [loadOrganizations]);

  const filteredOrgs = useMemo(() => {
    return searchOrganizations(organizations, searchQuery);
  }, [organizations, searchQuery]);

  const handleSelectMadrasa = useCallback(
    async (org: OrganizationSummary) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedOrgId(org.id);
      await setActiveOrganizationId(org.id);

      // Navigate to login/signup with chosen organization
      router.push({
        pathname: '/auth/login',
        params: { orgId: org.id, orgName: org.name },
      });
    },
    [router]
  );

  const handleRegisterNewMadrasa = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/register-madrasa');
  }, [router]);

  const renderMadrasaItem = ({ item }: { item: OrganizationSummary }) => {
    const isSelected = item.id === selectedOrgId;
    const isFlagship = item.is_featured;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handleSelectMadrasa(item)}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isFlagship && styles.cardFlagship,
        ]}
      >
        <View style={styles.cardHeader}>
          {item.logo_url ? (
            <Image source={{ uri: item.logo_url }} style={styles.cardLogo} />
          ) : (
            <View
              style={[
                styles.cardLogoPlaceholder,
                { backgroundColor: item.primary_color || COLORS.primary },
              ]}
            >
              <Ionicons name="school" size={22} color="#FFFFFF" />
            </View>
          )}

          <View style={styles.cardInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
            </View>

            {(item.city || item.state) && (
              <View style={styles.locationRow}>
                <Ionicons name="location-sharp" size={13} color={COLORS.gold} />
                <Text style={styles.locationText}>
                  {[item.city, item.state, item.country].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            {Boolean(item.tagline) && (
              <Text style={styles.taglineText} numberOfLines={1}>
                {item.tagline}
              </Text>
            )}
          </View>

          <View style={styles.cardAction}>
            {isSelected ? (
              <View style={styles.checkBadge}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              </View>
            ) : (
              <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
            )}
          </View>
        </View>

        {isFlagship && (
          <View style={styles.flagshipPill}>
            <Ionicons name="star" size={12} color="#D4AF37" style={{ marginRight: 4 }} />
            <Text style={styles.flagshipPillText}>Flagship Campus • مرکزی کیمپس</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Hero Header */}
      <LinearGradient
        colors={[COLORS.primaryDeep, COLORS.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.brandArabic}>صُـفَّـة</Text>
            <Text style={styles.brandTitle}>SUFFAH MADRASA DIRECTORY</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.headerSubtitle}>
          Select your Madrasa to access your classes, courses & attendance
        </Text>
        <Text style={styles.headerUrdu}>اپنا مدرسہ منتخب کیجیے</Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, city, or madrasa code..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Directory List */}
      <View style={styles.listWrapper}>
        <View style={styles.listHeaderRow}>
          <Text style={styles.listCount}>
            {filteredOrgs.length} {filteredOrgs.length === 1 ? 'Madrasa' : 'Madrasas'} Available
          </Text>
          <Text style={styles.secureText}>
            <Ionicons name="shield-checkmark" size={12} color={COLORS.primary} /> Isolated Multi-Tenant
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading madrasa campus directory...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredOrgs}
            keyExtractor={(item) => item.id}
            renderItem={renderMadrasaItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyTitle}>No Madrasas Found</Text>
                <Text style={styles.emptyText}>
                  We could not find any madrasa matching "{searchQuery}".
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Footer Banner for Mudir / Institutional Registration */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.footerContent}>
          <View style={styles.footerTextGroup}>
            <Text style={styles.footerTitle}>Are you a Principal or Madrasa Mudir?</Text>
            <Text style={styles.footerSubtitle}>نیا مدرسہ رجسٹر کرنا چاہتے ہیں؟</Text>
          </View>
          <TouchableOpacity
            style={styles.registerButton}
            activeOpacity={0.85}
            onPress={handleRegisterNewMadrasa}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.registerButtonText}>Register Madrasa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  brandArabic: {
    color: '#D4AF37',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  headerSubtitle: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.9,
    lineHeight: 18,
  },
  headerUrdu: {
    color: '#D4AF37',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textMain,
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listCount: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  secureText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E7E4DA',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F9F5',
  },
  cardFlagship: {
    borderColor: '#D4AF37',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E7E4DA',
  },
  cardLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    lineHeight: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  taglineText: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardAction: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  checkBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagshipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCF9F0',
    borderColor: '#EAD9A6',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  flagshipPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9A7328',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E7E4DA',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  footerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  footerSubtitle: {
    fontSize: 11,
    color: COLORS.primary,
    marginTop: 2,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
