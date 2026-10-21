import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { db } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';
import { getEnrollmentDocId } from '@/lib/enrollments';
import { OFFICIAL_COURSES_CATALOG, type OfficialCourseItem } from '@/lib/officialCourses';
import { createAdminLog } from '@/lib/adminLogs';
import { useAuth } from '@/context/AuthContext';

export interface UserForEnrollment {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AdminCourseEnrollmentModalProps {
  visible: boolean;
  onClose: () => void;
  student: UserForEnrollment | null;
  availableCourses: Array<{ id: string; name: string; category?: string; fee?: number; course_fee?: number; admission_fee?: number; description?: string }>;
  activeOrgId?: string;
  onEnrollmentUpdated?: () => void;
}

export function AdminCourseEnrollmentModal({
  visible,
  onClose,
  student,
  availableCourses,
  activeOrgId = 'mslb-main',
  onEnrollmentUpdated,
}: AdminCourseEnrollmentModalProps) {
  const { profile: adminProfile } = useAuth();
  const [enrolledMap, setEnrolledMap] = useState<Record<string, boolean>>({});
  const [selectedToEnroll, setSelectedToEnroll] = useState<Record<string, boolean>>({});
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Comprehensive merged catalog (all 12 official courses + any Firestore custom courses)
  const allCourses = useMemo(() => {
    const list = [...availableCourses];
    const seenNames = new Set(availableCourses.map((c) => String(c.name || '').trim().toLowerCase()));
    const seenIds = new Set(availableCourses.map((c) => c.id));

    for (const off of OFFICIAL_COURSES_CATALOG) {
      const key = off.name.trim().toLowerCase();
      if (!seenNames.has(key) && !seenIds.has(off.id)) {
        list.push({
          id: off.id,
          name: off.name,
          category: off.category,
          fee: off.fee,
          course_fee: off.course_fee,
          admission_fee: off.admission_fee,
          description: off.description,
        });
        seenNames.add(key);
        seenIds.add(off.id);
      }
    }
    return list;
  }, [availableCourses]);

  // Load existing enrollments whenever student or modal changes
  useEffect(() => {
    if (!visible || !student?.id) {
      setEnrolledMap({});
      setSelectedToEnroll({});
      return;
    }

    let isMounted = true;
    setLoadingEnrollments(true);

    (async () => {
      try {
        const q = query(
          collection(db, 'enrollments'),
          where('user_id', '==', student.id)
        );
        const snap = await withTimeout(getDocs(q), 8000);
        const map: Record<string, boolean> = {};

        snap.forEach((d) => {
          const data = d.data();
          if (data.status === 'active' && data.course_id) {
            map[String(data.course_id)] = true;
          }
        });

        // Also check by name matching for legacy enrollments
        allCourses.forEach((c) => {
          snap.forEach((d) => {
            const data = d.data();
            if (data.status === 'active' && (data.course_id === c.name || data.course_name === c.name)) {
              map[c.id] = true;
            }
          });
        });

        if (isMounted) {
          setEnrolledMap(map);
          setSelectedToEnroll({});
        }
      } catch (err) {
        console.warn('[AdminCourseEnrollmentModal] Failed to load student enrollments:', err);
      } finally {
        if (isMounted) setLoadingEnrollments(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [visible, student?.id, allCourses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allCourses;
    return allCourses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.category && c.category.toLowerCase().includes(q))
    );
  }, [allCourses, searchQuery]);

  const enrolledCount = Object.keys(enrolledMap).filter((k) => enrolledMap[k]).length;
  const selectedCount = Object.keys(selectedToEnroll).filter((k) => selectedToEnroll[k]).length;

  const toggleSelectCourse = (courseId: string) => {
    if (enrolledMap[courseId]) return; // already active
    setSelectedToEnroll((prev) => ({
      ...prev,
      [courseId]: !prev[courseId],
    }));
  };

  const handleSelectAllAvailable = () => {
    const next: Record<string, boolean> = {};
    allCourses.forEach((c) => {
      if (!enrolledMap[c.id]) {
        next[c.id] = true;
      }
    });
    setSelectedToEnroll(next);
  };

  const handleClearSelection = () => {
    setSelectedToEnroll({});
  };

  // Grant Free Enrollment in All Selected Courses
  const handleConfirmEnrollment = async () => {
    if (!student || selectedCount === 0) return;
    setSubmitting(true);

    try {
      const selectedCoursesToProcess = allCourses.filter((c) => selectedToEnroll[c.id]);
      const adminIdentity = adminProfile?.email || adminProfile?.name || 'admin';

      for (const course of selectedCoursesToProcess) {
        // 1. Ensure course exists in Firestore 'courses' collection
        const courseDocRef = doc(db, 'courses', course.id);
        await setDoc(
          courseDocRef,
          {
            name: course.name,
            organization_id: activeOrgId,
            category: course.category || 'General',
            course_fee: course.course_fee ?? course.fee ?? 500,
            admission_fee: course.admission_fee ?? 100,
            fee: course.fee ?? 500,
            status: 'active',
            updated_at: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});

        // 2. Write active enrollment
        const enrollmentDocId = getEnrollmentDocId(student.id, course.id);
        await withTimeout(
          setDoc(
            doc(db, 'enrollments', enrollmentDocId),
            {
              user_id: student.id,
              course_id: course.id,
              course_name: course.name,
              organization_id: activeOrgId,
              status: 'active',
              enrolled_at: serverTimestamp(),
              created_at: serverTimestamp(),
              granted_by_admin: adminIdentity,
              granted_free: true,
            },
            { merge: true }
          ),
          10000,
          `Enrolling in ${course.name} timed out`
        );

        // 3. Admin audit log
        await createAdminLog(adminProfile, {
          action: 'grant_free_course_access',
          performed_by: adminIdentity,
          target_id: student.id,
          details: `Admin granted free enrollment in: ${course.name} (${course.id}) to ${student.name}`,
        }).catch(() => {});
      }

      // Update local state
      const updatedMap = { ...enrolledMap };
      selectedCoursesToProcess.forEach((c) => {
        updatedMap[c.id] = true;
      });
      setEnrolledMap(updatedMap);
      setSelectedToEnroll({});

      Alert.alert(
        'Mubarak! ✨',
        `${student.name} has been successfully enrolled in ${selectedCoursesToProcess.length} course(s) for free.`
      );

      onEnrollmentUpdated?.();
    } catch (err: any) {
      Alert.alert('Enrollment Error', err?.message || 'Failed to grant course access.');
    } finally {
      setSubmitting(false);
    }
  };

  // Revoke / Unenroll from a course
  const handleUnenrollCourse = (course: { id: string; name: string }) => {
    if (!student) return;

    Alert.alert(
      'Remove Enrollment?',
      `Are you sure you want to unenroll ${student.name} from "${course.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unenroll',
          style: 'destructive',
          onPress: async () => {
            try {
              const enrollmentDocId = getEnrollmentDocId(student.id, course.id);
              await withTimeout(
                updateDoc(doc(db, 'enrollments', enrollmentDocId), {
                  status: 'cancelled',
                  cancelled_at: serverTimestamp(),
                  updated_at: serverTimestamp(),
                }),
                10000
              );

              setEnrolledMap((prev) => {
                const next = { ...prev };
                delete next[course.id];
                return next;
              });

              onEnrollmentUpdated?.();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to unenroll student');
            }
          },
        },
      ]
    );
  };

  if (!visible || !student) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconBadge}>
                <Ionicons name="school" size={22} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Free Course Enrollment</Text>
                <Text style={styles.arabicSubtitle}>مفت کورسز میں داخلہ برائے طالبات</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close modal">
                <Ionicons name="close" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Student Info Card */}
            <View style={styles.studentCard}>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
              </View>
              <View style={styles.enrolledBadge}>
                <Text style={styles.enrolledBadgeText}>
                  {enrolledCount} of {allCourses.length} Enrolled
                </Text>
              </View>
            </View>

            {/* Quick Actions & Search */}
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search 12 official courses..."
                  placeholderTextColor={COLORS.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity style={styles.quickActionBtn} onPress={handleSelectAllAvailable}>
                <Text style={styles.quickActionText}>Select All</Text>
              </TouchableOpacity>
              {selectedCount > 0 ? (
                <TouchableOpacity style={styles.clearActionBtn} onPress={handleClearSelection}>
                  <Text style={styles.clearActionText}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Courses List */}
          {loadingEnrollments ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading Madrasa course catalog...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
              <Text style={styles.sectionHeader}>
                All Official Madrasa Courses ({filteredCourses.length})
              </Text>

              {filteredCourses.map((course) => {
                const isEnrolled = Boolean(enrolledMap[course.id]);
                const isSelected = Boolean(selectedToEnroll[course.id]);
                const feeText = (course.course_fee === 0 || course.fee === 0) ? 'FREE' : `₹${course.course_fee ?? course.fee ?? 500}`;

                return (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.courseRow,
                      isEnrolled && styles.courseRowEnrolled,
                      isSelected && styles.courseRowSelected,
                    ]}
                    activeOpacity={isEnrolled ? 1 : 0.7}
                    onPress={() => toggleSelectCourse(course.id)}
                  >
                    {/* Checkbox or Enrolled Icon */}
                    <View style={styles.checkboxContainer}>
                      {isEnrolled ? (
                        <View style={styles.enrolledCheckCircle}>
                          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                        </View>
                      )}
                    </View>

                    {/* Course Details */}
                    <View style={styles.courseDetails}>
                      <View style={styles.courseNameRow}>
                        <Text style={[styles.courseName, isEnrolled && styles.courseNameEnrolled]}>
                          {course.name}
                        </Text>
                        {course.category ? (
                          <View style={styles.categoryPill}>
                            <Text style={styles.categoryText}>{course.category}</Text>
                          </View>
                        ) : null}
                      </View>
                      {course.description ? (
                        <Text style={styles.courseDesc} numberOfLines={1}>
                          {course.description}
                        </Text>
                      ) : null}
                      <Text style={styles.feeLabel}>
                        Standard Fee: <Text style={styles.feeVal}>{feeText}</Text> • <Text style={styles.freeHighlight}>Admin Free Grant</Text>
                      </Text>
                    </View>

                    {/* Action Status */}
                    <View style={styles.rightAction}>
                      {isEnrolled ? (
                        <TouchableOpacity
                          style={styles.unenrollBtn}
                          onPress={() => handleUnenrollCourse(course)}
                        >
                          <Text style={styles.unenrollBtnText}>Remove</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={[styles.statusPill, isSelected ? styles.statusPillSelected : styles.statusPillAvailable]}>
                          <Text style={[styles.statusPillText, isSelected && styles.statusPillTextSelected]}>
                            {isSelected ? 'Selected' : 'Available'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.closeFooterText}>Done / Close</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.enrollSubmitBtn,
                (selectedCount === 0 || submitting) && styles.enrollSubmitBtnDisabled,
              ]}
              onPress={handleConfirmEnrollment}
              disabled={selectedCount === 0 || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.enrollSubmitText}>
                    {selectedCount > 0
                      ? `Enroll in ${selectedCount} Course${selectedCount > 1 ? 's' : ''} (Free)`
                      : 'Select Courses to Enroll'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  title: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: '#0F172A',
    fontWeight: '700',
  },
  arabicSubtitle: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  studentEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  enrolledBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  enrolledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: SPACING.sm,
    height: 36,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    padding: 0,
  },
  quickActionBtn: {
    paddingHorizontal: 10,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  clearActionBtn: {
    paddingHorizontal: 8,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  scrollList: {
    flexGrow: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  centerLoading: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginBottom: SPACING.xs,
  },
  courseRowEnrolled: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  courseRowSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  checkboxContainer: {
    marginRight: SPACING.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  enrolledCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseDetails: {
    flex: 1,
  },
  courseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  courseNameEnrolled: {
    color: '#065F46',
  },
  categoryPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  courseDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  feeLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  feeVal: {
    fontWeight: '700',
    color: '#0F172A',
  },
  freeHighlight: {
    color: '#059669',
    fontWeight: '700',
  },
  rightAction: {
    marginLeft: SPACING.xs,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusPillAvailable: {
    backgroundColor: '#F1F5F9',
  },
  statusPillSelected: {
    backgroundColor: '#DBEAFE',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  statusPillTextSelected: {
    color: '#1D4ED8',
  },
  unenrollBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.md,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  unenrollBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  closeFooterBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeFooterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  enrollSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    minWidth: 160,
  },
  enrollSubmitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  enrollSubmitText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
