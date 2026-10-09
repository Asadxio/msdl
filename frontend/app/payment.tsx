import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { db, auth } from "@/lib/firebase";
import { normalizeFirebaseError } from "@/lib/errors";
import { logFirestoreFailure } from "@/lib/firestoreDebug";
import { enrollInFreeCourse } from "@/lib/razorpayFunctions";
import { IslamicReceiptModal } from "@/components/IslamicReceiptModal";
import type { FeeReceiptData } from "@/lib/receiptGenerator";

type PaymentDomain = "academic_fee" | "donation";
type AcademicFeeType = "course_fee" | "admission_fee";
type DonationType = "sadqah" | "zakat" | "fitrah" | "langar" | "donation_other";

interface PaymentHistoryItem {
  id: string;
  payment_domain?: PaymentDomain;
  payment_type?: string;
  type?: string;
  course_id?: string;
  course_name?: string;
  amount: number;
  state?: string;
  status?: string;
  provider_order_id?: string;
  provider_payment_id?: string;
  created_at?: any;
}

export default function PaymentFlowScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string; domain?: string }>();
  const { user, profile } = useAuth();
  const { courses } = useData();

  // Domain Switcher
  const [activeDomain, setActiveDomain] = useState<PaymentDomain>(
    params.domain === "donation" ? "donation" : "academic_fee"
  );

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentPaymentId, setCurrentPaymentId] = useState("");

  // Academic Fee state
  const [academicType, setAcademicType] = useState<AcademicFeeType>("course_fee");
  const [selectedCourseId, setSelectedCourseId] = useState(String(params.courseId || "").trim());
  const [freeEnrolling, setFreeEnrolling] = useState(false);

  // Donation state
  const [donationType, setDonationType] = useState<DonationType>("sadqah");
  const [donationAmount, setDonationAmount] = useState("1000");
  const [donorNote, setDonorNote] = useState("");

  const [feesAmount, setFeesAmount] = useState(500);
  const [error, setError] = useState("");
  const [openingPayment, setOpeningPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [historyTab, setHistoryTab] = useState<"all" | "academic_fee" | "donation">("all");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [waitingTimeout, setWaitingTimeout] = useState(false);

  // Receipt Modal
  const [selectedReceipt, setSelectedReceipt] = useState<FeeReceiptData | null>(null);
  const [receiptModalVisible, setReceiptModalVisible] = useState(false);

  const [concessionLoading, setConcessionLoading] = useState(false);

  const getPaymentSettings = async () => {
    const globalSnap = await getDoc(doc(db, "app_settings", "global"));
    const platformSnap = await getDoc(doc(db, "app_settings", "platform"));
    const merged = {
      ...(platformSnap.exists() ? (platformSnap.data() as Record<string, unknown>) : {}),
      ...(globalSnap.exists() ? (globalSnap.data() as Record<string, unknown>) : {}),
    };
    const fee = Number(merged.fees_amount || 500);
    const donationUrl = String(merged.donation_url || merged.razorpay_link || "https://pages.razorpay.com/mslb-donation");
    return { fee, donationUrl };
  };

  const handleScholarshipConcessionRequest = async () => {
    if (!user?.uid || !selectedCourseId) return;
    setConcessionLoading(true);
    try {
      await addDoc(collection(db, "admission_inquiries"), {
        student_name: profile?.name || user.displayName || "Student",
        whatsapp_number: profile?.phone && profile.phone.length >= 7 ? profile.phone : "9999999999",
        course_id: selectedCourseId,
        course_name: selectedCourse?.name || "Selected Course",
        notes: `Institutional Fee Concession & Scholarship Request. Academic Fee: ₹${payableAcademicAmount}. Student email: ${user.email || ""}`,
        created_at: serverTimestamp(),
      });
      Alert.alert(
        "Application Received",
        "Mubarak! Your fee concession and admission inquiry has been submitted to the Madrasa Academic Board. Our administration will contact you shortly.",
        [{ text: "Back to Courses", onPress: () => router.replace("/courses") }]
      );
    } catch (err: any) {
      logFirestoreFailure(
        { collection: "admission_inquiries", operation: "add", query: "concession application", role: profile?.role, status: profile?.status },
        err
      );
      Alert.alert("Submission Notice", "Please contact the Admissions Desk directly via admissions@madrasatussalikat.com.");
    } finally {
      setConcessionLoading(false);
    }
  };

  const handleContactAdmissions = () => {
    const email = "admissions@madrasatussalikat.com";
    const subject = encodeURIComponent(`Admission & Course Fee Inquiry: ${selectedCourse?.name || "Academic Course"}`);
    const body = encodeURIComponent(
      `Assalamu Alaikum,\n\nI am inquiring regarding admission and tuition for ${selectedCourse?.name || "the course"}.\n\nStudent Name: ${profile?.name || user?.displayName || ""}\nStudent Email: ${user?.email || ""}`
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Admissions Desk", "Please email admissions@madrasatussalikat.com for admission guidance.");
    });
  };

  const onProceedToDonationWeb = async () => {
    const { donationUrl } = await getPaymentSettings();
    const targetUrl = donationUrl || "https://pages.razorpay.com/mslb-donation";
    try {
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert("Donation Portal", `Please visit our donation page in your browser: ${targetUrl}`);
    }
  };

  const loadHistory = async () => {
    if (!user?.uid) return;
    try {
      setLoadingHistory(true);
      const paymentsSnap = await getDocs(
        query(
          collection(db, "payments"),
          where("user_id", "==", user.uid),
          orderBy("created_at", "desc")
        )
      );
      const items: PaymentHistoryItem[] = paymentsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      setPaymentHistory(items);
    } catch (err) {
      logFirestoreFailure(
        { collection: "payments", operation: "get", query: `user_id == ${user?.uid}`, role: profile?.role, status: profile?.status },
        err
      );
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { fee } = await getPaymentSettings();
        setFeesAmount(fee);
        await loadHistory();
      } catch (err) {
        logFirestoreFailure(
          { collection: "app_settings/platform", operation: "get", query: "load payment settings", role: profile?.role, status: profile?.status },
          err
        );
      }
    };
    load().catch(() => {});
  }, [user?.uid]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  useEffect(() => {
    if (params.courseId) {
      setSelectedCourseId(String(params.courseId).trim());
    } else if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, params.courseId, selectedCourseId]);

  // Compute calculated amounts
  const courseFeeVal = selectedCourse?.course_fee !== undefined ? selectedCourse.course_fee : (feesAmount || 500);
  const admissionFeeVal = selectedCourse?.admission_fee ?? 100;
  const isFreeCourse = selectedCourse?.course_fee === 0;

  const payableAcademicAmount = useMemo(() => {
    if (isFreeCourse) return 0;
    if (academicType === "admission_fee") return admissionFeeVal;
    return courseFeeVal;
  }, [isFreeCourse, academicType, admissionFeeVal, courseFeeVal]);

  const payableDonationAmount = useMemo(() => {
    const val = Number(donationAmount || 0);
    return isNaN(val) ? 0 : val;
  }, [donationAmount]);

  const currentTotalAmount = activeDomain === "academic_fee" ? payableAcademicAmount : payableDonationAmount;

  // Realtime payment status reconciliation
  useEffect(() => {
    if (!currentPaymentId || step !== 3) return;

    setWaitingTimeout(false);
    const timeoutTimer = setTimeout(() => {
      setWaitingTimeout(true);
    }, 45000);

    const unsubscribe = onSnapshot(
      doc(db, "payments", currentPaymentId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const st = String(data.state ?? data.status ?? "pending");

        if (st === "succeeded") {
          clearTimeout(timeoutTimer);
          setStep(4);
          loadHistory().catch(() => {});
        } else if (["failed", "rejected", "cancelled", "expired"].includes(st)) {
          clearTimeout(timeoutTimer);
          setError(`Payment ${st}. Please try again.`);
          setStep(2);
        }
      },
      (err) => {
        logFirestoreFailure(
          { collection: "payments", operation: "get", path: `payments/${currentPaymentId}`, query: "onSnapshot payment reconciliation", role: profile?.role, status: profile?.status },
          err
        );
      }
    );

    return () => {
      clearTimeout(timeoutTimer);
      unsubscribe();
    };
  }, [currentPaymentId, step]);

  const onContinueToReview = () => {
    setError("");
    if (activeDomain === "academic_fee") {
      if (!selectedCourseId) {
        setError("Please select the course this fee payment is for.");
        return;
      }
      if (isFreeCourse) {
        handleFreeCourseEnrollment();
        return;
      }
      if (payableAcademicAmount <= 0) {
        setError("Invalid course fee amount.");
        return;
      }
    } else {
      if (payableDonationAmount < 10) {
        setError("Minimum donation amount is ₹10.");
        return;
      }
      if (payableDonationAmount > 500000) {
        setError("Maximum single online donation amount is ₹5,00,000.");
        return;
      }
    }
    setStep(2);
  };

  const handleFreeCourseEnrollment = async () => {
    if (!selectedCourseId) return;
    setFreeEnrolling(true);
    setError("");
    try {
      const res = await enrollInFreeCourse({ courseId: selectedCourseId });
      if (res?.success) {
        Alert.alert(
          "Enrollment Successful!",
          `Mubarak! You have been successfully enrolled in ${selectedCourse?.name || "this free course"}.`,
          [{ text: "Go to Courses", onPress: () => router.replace("/courses") }]
        );
      }
    } catch (err: any) {
      setError(normalizeFirebaseError(err, "Failed to complete free enrollment."));
    } finally {
      setFreeEnrolling(false);
    }
  };

  // Open receipt modal from history item
  const openReceiptModal = (item: PaymentHistoryItem) => {
    const isDonation = item.payment_domain === "donation" || ["sadqa", "sadqah", "zakat", "fitra", "fitrah", "langar", "donation_other"].includes(String(item.type || item.payment_type).toLowerCase());
    const cDoc = courses.find((c) => c.id === item.course_id);
    const dateStr = item.created_at?.toDate ? item.created_at.toDate().toLocaleDateString("en-IN") : "Today";

    const rData: FeeReceiptData = {
      receiptId: item.id,
      studentName: profile?.name || user?.displayName || "Student / Donor",
      studentEmail: profile?.email || user?.email || undefined,
      courseName: item.course_name || cDoc?.name,
      amount: Number(item.amount ? (item.amount > 10000 ? item.amount / 100 : item.amount) : 0),
      category: item.payment_type || item.type || (isDonation ? "sadqah" : "fees"),
      paymentDomain: isDonation ? "donation" : "academic_fee",
      paymentMethod: "Razorpay Online",
      transactionId: item.provider_payment_id || item.provider_order_id,
      issueDateGregorian: dateStr,
      status: (item.state || item.status || "succeeded").toUpperCase(),
    };
    setSelectedReceipt(rData);
    setReceiptModalVisible(true);
  };

  // Filtered payment history
  const filteredHistory = useMemo(() => {
    if (historyTab === "all") return paymentHistory;
    return paymentHistory.filter((item) => {
      const isDonation = item.payment_domain === "donation" || ["sadqa", "sadqah", "zakat", "fitra", "fitrah", "langar", "donation_other"].includes(String(item.type || item.payment_type).toLowerCase());
      return historyTab === "donation" ? isDonation : !isDonation;
    });
  }, [paymentHistory, historyTab]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, "/more")}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment & Donations</Text>
        <Text style={styles.subtitle}>Clean, Separate & Authoritative Payments</Text>

        {/* Domain Segmented Switcher */}
        <View style={styles.domainSwitcher}>
          <TouchableOpacity
            style={[styles.domainTab, activeDomain === "academic_fee" && styles.domainTabActive]}
            onPress={() => {
              setActiveDomain("academic_fee");
              setStep(1);
              setError("");
            }}
          >
            <Ionicons
              name="school-outline"
              size={16}
              color={activeDomain === "academic_fee" ? "#FFFFFF" : COLORS.textMuted}
            />
            <Text style={[styles.domainTabText, activeDomain === "academic_fee" && styles.domainTabTextActive]}>
              Academic Fees
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.domainTab, activeDomain === "donation" && styles.domainTabActive]}
            onPress={() => {
              setActiveDomain("donation");
              setStep(1);
              setError("");
            }}
          >
            <Ionicons
              name="heart-outline"
              size={16}
              color={activeDomain === "donation" ? "#FFFFFF" : COLORS.textMuted}
            />
            <Text style={[styles.domainTabText, activeDomain === "donation" && styles.domainTabTextActive]}>
              Donations & Zakat
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Step Dots */}
          <View style={styles.stepRow}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={[styles.stepDot, step >= (item as 1 | 2 | 3 | 4) && styles.stepDotActive]} />
            ))}
          </View>

          {/* STEP 1: CONFIGURE PAYMENT */}
          {step === 1 ? (
            <View style={styles.card}>
              {activeDomain === "academic_fee" ? (
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="school" size={20} color={COLORS.primary} />
                    <Text style={styles.cardTitle}>Academic Course & Fee Selection</Text>
                  </View>

                  <Text style={styles.label}>1. Select Your Course (کورس منتخب کریں)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseChipsScroll}>
                    {courses.map((course) => {
                      const isSelected = selectedCourseId === course.id;
                      const fee = course.course_fee ?? 500;
                      return (
                        <TouchableOpacity
                          key={course.id}
                          style={[styles.courseCardChip, isSelected && styles.courseCardChipActive]}
                          onPress={() => setSelectedCourseId(course.id)}
                        >
                          <Text style={[styles.courseCardName, isSelected && styles.courseCardNameActive]}>
                            {course.name}
                          </Text>
                          <View style={[styles.courseFeeBadge, isSelected && styles.courseFeeBadgeActive]}>
                            <Text style={[styles.courseFeeText, isSelected && styles.courseFeeTextActive]}>
                              {fee === 0 ? "FREE" : `₹${fee}`}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Free Course Special Treatment */}
                  {isFreeCourse ? (
                    <View style={styles.freeCourseBox}>
                      <Ionicons name="sparkles" size={24} color="#059669" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.freeCourseTitle}>100% Free Short Course!</Text>
                        <Text style={styles.freeCourseSubtitle}>
                          No payment or gateway fee required. Click below to enroll immediately.
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.freeEnrollBtn}
                        onPress={handleFreeCourseEnrollment}
                        disabled={freeEnrolling}
                      >
                        {freeEnrolling ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.freeEnrollBtnText}>Enroll Free</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.label}>2. Fee Component (فیس کی مد)</Text>
                      <View style={styles.choiceRow}>
                        <TouchableOpacity
                          style={[styles.choiceChip, academicType === "course_fee" && styles.choiceChipActive]}
                          onPress={() => setAcademicType("course_fee")}
                        >
                          <Text style={[styles.choiceText, academicType === "course_fee" && styles.choiceTextActive]}>
                            Course Fee (₹{courseFeeVal})
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.choiceChip, academicType === "admission_fee" && styles.choiceChipActive]}
                          onPress={() => setAcademicType("admission_fee")}
                        >
                          <Text style={[styles.choiceText, academicType === "admission_fee" && styles.choiceTextActive]}>
                            Admission Fee (₹{admissionFeeVal})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Authoritative Breakdown Box */}
                      <View style={styles.breakdownBox}>
                        <Text style={styles.breakdownTitle}>Official Fee Breakdown</Text>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>Selected Course:</Text>
                          <Text style={styles.breakdownValue}>{selectedCourse?.name || "Course"}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                          <Text style={styles.breakdownLabel}>
                            {academicType === "admission_fee" ? "Admission Fee:" : "Tuition / Course Fee:"}
                          </Text>
                          <Text style={styles.breakdownValue}>₹{payableAcademicAmount}</Text>
                        </View>
                        <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                          <Text style={styles.breakdownTotalLabel}>Total Payable (کل رقم):</Text>
                          <Text style={styles.breakdownTotalValue}>₹{payableAcademicAmount}</Text>
                        </View>
                      </View>

                      <TouchableOpacity style={styles.primaryBtn} onPress={onContinueToReview}>
                        <Text style={styles.primaryBtnText}>Continue to Review (₹{payableAcademicAmount})</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : (
                /* DOMAIN B: DONATIONS & ISLAMIC FUNDS */
                <>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="heart-circle" size={22} color={COLORS.primary} />
                    <Text style={styles.cardTitle}>Islamic Welfare Funds & Donations</Text>
                  </View>
                  <Text style={styles.islamicBismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>

                  <Text style={styles.label}>1. Choose Fund / Category (شعبہ منتخب کریں)</Text>
                  <View style={styles.choiceRow}>
                    {[
                      { key: "sadqah", label: "Sadqah Jariyah (صدقہ جاریہ)" },
                      { key: "zakat", label: "Zakat Fund (زکوٰۃ فنڈ)" },
                      { key: "fitrah", label: "Sadaqat-ul-Fitr (فطرہ)" },
                      { key: "langar", label: "Student Food / Langar (طعام)" },
                      { key: "donation_other", label: "General Madrasa Support (عام عطیہ)" },
                    ].map((f) => (
                      <TouchableOpacity
                        key={f.key}
                        style={[styles.choiceChip, donationType === f.key && styles.choiceChipActive]}
                        onPress={() => setDonationType(f.key as DonationType)}
                      >
                        <Text style={[styles.choiceText, donationType === f.key && styles.choiceTextActive]}>
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>2. Donation Amount (عطیہ کی رقم - INR)</Text>
                  <View style={styles.presetsRow}>
                    {["500", "1000", "2500", "5000"].map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[styles.presetBtn, donationAmount === preset && styles.presetBtnActive]}
                        onPress={() => setDonationAmount(preset)}
                      >
                        <Text style={[styles.presetBtnText, donationAmount === preset && styles.presetBtnTextActive]}>
                          ₹{Number(preset).toLocaleString()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={donationAmount}
                    onChangeText={setDonationAmount}
                    placeholder="Enter custom amount (min ₹10)"
                    placeholderTextColor={COLORS.textMuted}
                  />

                  <Text style={styles.label}>3. Donor Note / Intention (اختیاری نیت یا دعا)</Text>
                  <TextInput
                    style={styles.input}
                    value={donorNote}
                    onChangeText={setDonorNote}
                    placeholder="e.g. Sadqah on behalf of parents"
                    placeholderTextColor={COLORS.textMuted}
                  />

                  <View style={styles.donationNoticeBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#005F46" />
                    <Text style={styles.donationNoticeText}>
                      Notice: Donations are strictly allocated to Islamic charitable & student welfare funds. They do not constitute academic course fees or enrollments.
                    </Text>
                  </View>

                  <TouchableOpacity style={styles.primaryBtn} onPress={onContinueToReview}>
                    <Text style={styles.primaryBtnText}>
                      Continue to Donate (₹{payableDonationAmount.toLocaleString()})
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : null}

          {/* STEP 2: REVIEW SUMMARY */}
          {step === 2 ? (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.primary} />
                <Text style={styles.cardTitle}>
                  {activeDomain === "academic_fee" ? "Course Admission Review" : "Charitable Contribution Review"}
                </Text>
              </View>

              <View style={styles.reviewBox}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Domain:</Text>
                  <Text style={styles.reviewValue}>
                    {activeDomain === "academic_fee" ? "Academic Tuition Fee" : "Islamic Charitable Donation"}
                  </Text>
                </View>

                {activeDomain === "academic_fee" ? (
                  <>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Course:</Text>
                      <Text style={styles.reviewValue}>{selectedCourse?.name || selectedCourseId}</Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Fee Type:</Text>
                      <Text style={styles.reviewValue}>
                        {academicType === "admission_fee" ? "Admission Fee" : "Tuition Fee"}
                      </Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Standard Course Fee:</Text>
                      <Text style={styles.reviewAmount}>₹{currentTotalAmount.toLocaleString()}</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Fund Category:</Text>
                      <Text style={styles.reviewValue}>{donationType.toUpperCase()}</Text>
                    </View>
                    {donorNote ? (
                      <View style={styles.reviewRow}>
                        <Text style={styles.reviewLabel}>Note:</Text>
                        <Text style={styles.reviewValue}>{donorNote}</Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Donation Total:</Text>
                      <Text style={styles.reviewAmount}>₹{currentTotalAmount.toLocaleString()}</Text>
                    </View>
                    <View style={styles.reviewRow}>
                      <Text style={styles.reviewLabel}>Channel:</Text>
                      <Text style={styles.reviewValue}>External Web Browser (Play Store Policy)</Text>
                    </View>
                  </>
                )}
              </View>

              {activeDomain === "academic_fee" ? (
                <>
                  <View style={styles.policyNoticeBox}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.policyNoticeTitle}>Institutional Admission & Concession Policy</Text>
                    <Text style={styles.policyNoticeText}>
                      In compliance with Google Play Store Policies, digital course purchases via external gateways are restricted on Android. Deserving students can request fee concession / institutional sponsorship, or connect with the Madrasa Admissions Desk.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, concessionLoading && styles.primaryBtnDisabled]}
                    onPress={handleScholarshipConcessionRequest}
                    disabled={concessionLoading}
                  >
                    {concessionLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={styles.btnRow}>
                        <Ionicons name="school-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>
                          Apply for Fee Concession / Scholarship
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryBtn} onPress={handleContactAdmissions}>
                    <View style={styles.btnRow}>
                      <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryBtnText}>Contact Admissions Desk</Text>
                    </View>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.donationNoticeBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#005F46" />
                    <Text style={styles.donationNoticeText}>
                      Google Play Policy Disclosure: To comply with Google Play's Charitable Donations Policy, all voluntary religious contributions (Zakat, Sadqah, Fitrah) are processed securely using your device's web browser outside the app.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={onProceedToDonationWeb}
                  >
                    <View style={styles.btnRow}>
                      <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>
                        Donate ₹{currentTotalAmount.toLocaleString()} via External Web Browser
                      </Text>
                    </View>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={styles.secondaryBtnText}>Modify Selection</Text>
              </TouchableOpacity>
            </View>
          ) : null}



          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 ? (
            <View style={styles.card}>
              <View style={styles.statusCenter}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={60} color="#10B981" />
                </View>

                {activeDomain === "academic_fee" ? (
                  <>
                    <Text style={styles.successTitle}>Academic Fee Paid Successfully!</Text>
                    <Text style={styles.successSubtitle}>
                      Mubarak! Your enrollment in {selectedCourse?.name || "your course"} is now active. Lessons and quizzes are unlocked.
                    </Text>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={() => router.replace("/courses")}
                    >
                      <Text style={styles.primaryBtnText}>Go to My Courses</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.successTitle}>Jazakumullahu Khairan!</Text>
                    <Text style={styles.islamicDuaText}>جَزَاكُمُ اللَّهُ خَيْرًا وَأَحْسَنَ الْجَزَاء</Text>
                    <Text style={styles.successSubtitle}>
                      Your donation of ₹{payableDonationAmount.toLocaleString()} has been received and dedicated to the {donationType.toUpperCase()} fund.
                    </Text>
                  </>
                )}

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setStep(1);
                    loadHistory().catch(() => {});
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Make Another Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* PAYMENT HISTORY SECTION */}
          <View style={styles.historyContainer}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Payment & Donation History</Text>
              <View style={styles.historyFilterRow}>
                {(["all", "academic_fee", "donation"] as const).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.historyFilterChip, historyTab === tab && styles.historyFilterChipActive]}
                    onPress={() => setHistoryTab(tab)}
                  >
                    <Text style={[styles.historyFilterText, historyTab === tab && styles.historyFilterTextActive]}>
                      {tab === "all" ? "All" : tab === "academic_fee" ? "Fees" : "Donations"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loadingHistory ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : filteredHistory.length === 0 ? (
              <Text style={styles.historyEmpty}>No payment records found.</Text>
            ) : (
              filteredHistory.map((item) => {
                const itemState = item.state ?? item.status ?? "pending";
                const isSuccess = itemState === "succeeded";
                const isDonation = item.payment_domain === "donation" || ["sadqa", "sadqah", "zakat", "fitra", "fitrah", "langar", "donation_other"].includes(String(item.type || item.payment_type).toLowerCase());
                const displayAmt = item.amount ? (item.amount > 10000 ? item.amount / 100 : item.amount) : 0;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyCard}
                    onPress={() => openReceiptModal(item)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.historyHeaderRow}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Ionicons
                          name={isDonation ? "heart" : "school"}
                          size={16}
                          color={isDonation ? "#C8A84E" : COLORS.primary}
                        />
                        <Text style={styles.historyType}>
                          {isDonation
                            ? `Donation: ${(item.payment_type || item.type || "sadqah").toUpperCase()}`
                            : `Fee: ${(item.payment_type || item.type || "course_fee").toUpperCase()}`}
                        </Text>
                      </View>
                      <View style={[styles.historyBadge, isSuccess ? styles.badgeSuccess : styles.badgePending]}>
                        <Text style={[styles.badgeText, isSuccess ? styles.badgeTextSuccess : styles.badgeTextPending]}>
                          {itemState.toUpperCase()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <Text style={styles.historyAmount}>₹{Number(displayAmt).toFixed(2)}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="document-text-outline" size={14} color={COLORS.primary} />
                        <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: "600" }}>View Receipt</Text>
                      </View>
                    </View>

                    {item.course_name ? (
                      <Text style={styles.historyCourse}>Course: {item.course_name}</Text>
                    ) : null}
                    {item.provider_payment_id ? (
                      <Text style={styles.historyRef}>Ref: {item.provider_payment_id}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ISLAMIC RECEIPT MODAL */}
      <IslamicReceiptModal
        visible={receiptModalVisible}
        receipt={selectedReceipt}
        onClose={() => {
          setReceiptModalVisible(false);
          setSelectedReceipt(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.xs },
  backText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  title: { ...TYPOGRAPHY.title, color: COLORS.text, fontSize: 22 },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.sm },
  domainSwitcher: {
    flexDirection: "row",
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 4,
  },
  domainTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  domainTabActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.card,
  },
  domainTabText: {
    ...TYPOGRAPHY.label,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  domainTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  stepRow: { flexDirection: "row", gap: SPACING.xs, marginVertical: SPACING.xs },
  stepDot: { height: 6, flex: 1, backgroundColor: COLORS.border, borderRadius: 3 },
  stepDotActive: { backgroundColor: COLORS.primary },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, ...SHADOWS.card, gap: SPACING.sm },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { ...TYPOGRAPHY.heading, fontSize: 17, color: COLORS.text },
  islamicBismillah: { textAlign: "center", color: "#C8A84E", fontSize: 16, fontWeight: "700", marginVertical: 4 },
  label: { ...TYPOGRAPHY.label, color: COLORS.text, marginTop: SPACING.xs, fontWeight: "700" },
  courseChipsScroll: { flexDirection: "row", gap: SPACING.sm, paddingVertical: 4 },
  courseCardChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    minWidth: 120,
    gap: 6,
  },
  courseCardChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FDF4",
    borderWidth: 2,
  },
  courseCardName: { ...TYPOGRAPHY.body, fontSize: 13, fontWeight: "600", color: COLORS.text },
  courseCardNameActive: { color: COLORS.primary, fontWeight: "700" },
  courseFeeBadge: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  courseFeeBadgeActive: {
    backgroundColor: "#DCFCE7",
  },
  courseFeeText: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted },
  courseFeeTextActive: { color: "#166534" },
  freeCourseBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 12,
    marginTop: SPACING.xs,
  },
  freeCourseTitle: { ...TYPOGRAPHY.heading, fontSize: 15, color: "#065F46" },
  freeCourseSubtitle: { ...TYPOGRAPHY.body, fontSize: 12, color: "#047857", marginTop: 2 },
  freeEnrollBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: "center",
  },
  freeEnrollBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, marginTop: 4 },
  choiceChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: COLORS.surface },
  choiceChipActive: { borderColor: COLORS.primary, backgroundColor: "#E8F5E9" },
  choiceText: { ...TYPOGRAPHY.body, fontSize: 12, color: COLORS.textMuted },
  choiceTextActive: { color: COLORS.primary, fontWeight: "700" },
  presetsRow: { flexDirection: "row", gap: SPACING.xs, marginTop: 4 },
  presetBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: COLORS.surface,
  },
  presetBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#E8F5E9",
  },
  presetBtnText: { ...TYPOGRAPHY.label, fontSize: 12, color: COLORS.textMuted },
  presetBtnTextActive: { color: COLORS.primary, fontWeight: "700" },
  breakdownBox: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
  },
  breakdownTitle: { ...TYPOGRAPHY.label, fontSize: 12, fontWeight: "700", color: COLORS.textMuted, textTransform: "uppercase" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownLabel: { ...TYPOGRAPHY.body, fontSize: 13, color: COLORS.textMuted },
  breakdownValue: { ...TYPOGRAPHY.body, fontSize: 13, fontWeight: "600", color: COLORS.text },
  breakdownTotalRow: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6, marginTop: 4 },
  breakdownTotalLabel: { ...TYPOGRAPHY.heading, fontSize: 14, color: COLORS.primary },
  breakdownTotalValue: { ...TYPOGRAPHY.heading, fontSize: 18, color: COLORS.primary },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.surface, marginTop: 4 },
  donationNoticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  donationNoticeText: { ...TYPOGRAPHY.body, fontSize: 11, color: "#166534", flex: 1, lineHeight: 15 },
  policyNoticeBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  policyNoticeTitle: { ...TYPOGRAPHY.label, fontSize: 13, fontWeight: "700", color: "#166534" },
  policyNoticeText: { ...TYPOGRAPHY.body, fontSize: 12, color: "#166534", lineHeight: 16 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: SPACING.xs },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { ...TYPOGRAPHY.heading, color: "#FFFFFF", fontSize: 15 },
  secondaryBtn: { borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, marginTop: 6 },
  secondaryBtnText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, fontSize: 13 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  reviewBox: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  reviewLabel: { ...TYPOGRAPHY.body, fontSize: 13, color: COLORS.textMuted },
  reviewValue: { ...TYPOGRAPHY.body, fontSize: 13, color: COLORS.text, fontWeight: "600" },
  reviewAmount: { ...TYPOGRAPHY.heading, color: COLORS.primary, fontSize: 18 },
  statusCenter: { alignItems: "center", paddingVertical: SPACING.lg, gap: SPACING.sm },
  statusTitle: { ...TYPOGRAPHY.heading, fontSize: 19, color: COLORS.text },
  statusDescription: { ...TYPOGRAPHY.body, textAlign: "center", color: COLORS.textMuted, paddingHorizontal: SPACING.md, fontSize: 13 },
  successBadge: { marginBottom: SPACING.xs },
  successTitle: { ...TYPOGRAPHY.title, color: "#10B981", fontSize: 20, textAlign: "center" },
  islamicDuaText: { color: "#C8A84E", fontSize: 17, fontWeight: "700", textAlign: "center" },
  successSubtitle: { ...TYPOGRAPHY.body, textAlign: "center", color: COLORS.textMuted, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, fontSize: 13 },
  timeoutNotice: { backgroundColor: "#FEF3C7", borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs, marginTop: SPACING.md, width: "100%", alignItems: "center" },
  timeoutText: { ...TYPOGRAPHY.body, fontSize: 12, color: "#92400E", textAlign: "center" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  refreshBtnText: { ...TYPOGRAPHY.label, color: COLORS.primary, fontWeight: "700" },
  cancelLink: { marginTop: SPACING.md, padding: 8 },
  cancelLinkText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  error: { color: "#EF4444", textAlign: "center", marginTop: SPACING.xs },
  historyContainer: { marginTop: SPACING.lg, gap: SPACING.sm },
  historyHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyTitle: { ...TYPOGRAPHY.heading, fontSize: 15, color: COLORS.text },
  historyFilterRow: { flexDirection: "row", gap: 4 },
  historyFilterChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  historyFilterChipActive: { backgroundColor: COLORS.primary },
  historyFilterText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  historyFilterTextActive: { color: "#FFFFFF", fontWeight: "700" },
  historyEmpty: { ...TYPOGRAPHY.body, color: COLORS.textMuted, fontStyle: "italic", fontSize: 13 },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  historyHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyType: { ...TYPOGRAPHY.label, fontWeight: "700", color: COLORS.text, fontSize: 12 },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeSuccess: { backgroundColor: "#D1FAE5" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 10, fontWeight: "700" },
  badgeTextSuccess: { color: "#065F46" },
  badgeTextPending: { color: "#92400E" },
  historyAmount: { ...TYPOGRAPHY.heading, fontSize: 16, color: COLORS.primary },
  historyCourse: { fontSize: 12, color: COLORS.textMuted },
  historyRef: { ...TYPOGRAPHY.label, fontSize: 11, color: COLORS.textMuted },
});
