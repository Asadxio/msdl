import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { db, auth } from "@/lib/firebase";
import { normalizeFirebaseError } from "@/lib/errors";
import { logFirestoreFailure } from "@/lib/firestoreDebug";
import { createRazorpayOrder } from "@/lib/razorpayFunctions";

type PaymentType = "fees" | "sadqa" | "zakat" | "fitra" | "langar";

interface PaymentHistoryItem {
  id: string;
  type?: string;
  course_id?: string;
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
  const params = useLocalSearchParams<{ courseId?: string }>();
  const { user, profile } = useAuth();
  const { courses } = useData();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentPaymentId, setCurrentPaymentId] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("fees");
  const [selectedCourseId, setSelectedCourseId] = useState(String(params.courseId || "").trim());
  const [feesAmount, setFeesAmount] = useState(500);
  const [amount, setAmount] = useState("500");
  const [error, setError] = useState("");
  const [openingPayment, setOpeningPayment] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [waitingTimeout, setWaitingTimeout] = useState(false);
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    orderId: string;
    paymentDocId: string;
    amount: number;
    currency: string;
    keyId: string;
  } | null>(null);

  const getPaymentSettings = async () => {
    const globalSnap = await getDoc(doc(db, "app_settings", "global"));
    const platformSnap = await getDoc(doc(db, "app_settings", "platform"));
    const merged = {
      ...(platformSnap.exists() ? (platformSnap.data() as Record<string, unknown>) : {}),
      ...(globalSnap.exists() ? (globalSnap.data() as Record<string, unknown>) : {}),
    };
    const fee = Number(merged.fees_amount || 0);
    return { fee };
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
      logFirestoreFailure({ collection: "payments", operation: "get", query: `user_id == ${user?.uid}`, role: profile?.role, status: profile?.status }, err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { fee } = await getPaymentSettings();
        setFeesAmount(fee);
        setAmount(String(fee || ""));
        await loadHistory();
      } catch (err) {
        logFirestoreFailure({ collection: "app_settings/platform", operation: "get", query: "load payment settings", role: profile?.role, status: profile?.status }, err);
        setError(normalizeFirebaseError(err, "Could not load payment settings."));
      }
    };
    load().catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (paymentType === "fees") {
      setAmount(String(feesAmount || ""));
    }
  }, [feesAmount, paymentType]);

  const parsedAmount = useMemo(() => Number(amount || 0), [amount]);
  const selectedCourse = useMemo(() => courses.find((course) => course.id === selectedCourseId) || null, [courses, selectedCourseId]);

  useEffect(() => {
    if (params.courseId) {
      setSelectedCourseId(String(params.courseId).trim());
    } else if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, params.courseId, selectedCourseId]);

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
        logFirestoreFailure({ collection: "payments", operation: "get", path: `payments/${currentPaymentId}`, query: "onSnapshot payment reconciliation", role: profile?.role, status: profile?.status }, err);
      }
    );

    return () => {
      clearTimeout(timeoutTimer);
      unsubscribe();
    };
  }, [currentPaymentId, step]);

  const onContinueToReview = () => {
    const rawAmt = paymentType === "fees" ? (feesAmount || 500) : Number(amount || 0);
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    const effCourseId = selectedCourseId || (courses.length > 0 ? courses[0].id : "");
    if (effCourseId && !selectedCourseId) {
      setSelectedCourseId(effCourseId);
    }
    if (paymentType === "fees" && !effCourseId) {
      setError("Please select the course this fee payment is for.");
      return;
    }
    setError("");
    setStep(2);
  };

  const checkoutHtml = useMemo(() => {
    if (!checkoutData) return "";
    const { keyId, orderId, amount: orderAmt, currency } = checkoutData;
    const courseTitle = selectedCourse?.name || (paymentType === "fees" ? "Madrasa Course Fee" : paymentType.toUpperCase());
    const studentName = profile?.name || user?.displayName || "Student";
    const studentEmail = profile?.email || user?.email || "";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      body, html { margin: 0; padding: 0; height: 100%; width: 100%; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; }
      .loader { text-align: center; color: #475569; }
      .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top: 3px solid #006A60; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  </head>
  <body>
    <div class="loader">
      <div class="spinner"></div>
      <p style="font-size: 15px; font-weight: 500;">Securing Razorpay Gateway...</p>
    </div>
    <script>
      function launchCheckout() {
        var options = {
          "key": "${keyId}",
          "amount": ${orderAmt},
          "currency": "${currency}",
          "name": "Madrasatu-s-Salikat Lil Banat",
          "description": "Fee Payment: ${courseTitle.replace(/"/g, "")}",
          "order_id": "${orderId}",
          "prefill": {
            "name": "${studentName.replace(/"/g, "")}",
            "email": "${studentEmail.replace(/"/g, "")}"
          },
          "theme": {
            "color": "#006A60"
          },
          "handler": function (response) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                event: "PAYMENT_SUCCESS",
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature
              }));
            }
          },
          "modal": {
            "ondismiss": function () {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ event: "MODAL_CLOSED" }));
              }
            }
          }
        };
        var rzp = new Razorpay(options);
        rzp.on("payment.failed", function (response) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              event: "PAYMENT_FAILED",
              error: response.error
            }));
          }
        });
        rzp.open();
      }
      window.onload = launchCheckout;
    </script>
  </body>
</html>`;
  }, [checkoutData, selectedCourse, profile, user, paymentType]);

  const onInitiateCheckout = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !user?.uid) {
      Alert.alert("Sign In Required", "Please sign in to proceed with payment.");
      return;
    }
    const effCourseId = selectedCourseId || (courses.length > 0 ? courses[0].id : "");
    if (paymentType === "fees" && !effCourseId) {
      setError("Please select the course this fee payment is for.");
      return;
    }

    setError("");
    setOpeningPayment(true);

    try {
      // ...(paymentType === 'fees' ? { course_id: selectedCourseId } : {})
      const orderData = await createRazorpayOrder({
        courseId: paymentType === "fees" ? effCourseId : undefined,
        paymentType,
      });

      setCurrentPaymentId(orderData.paymentDocId);
      setCheckoutData(orderData);
      setCheckoutModalVisible(true);
      setStep(3);
    } catch (err: any) {
      logFirestoreFailure({ collection: "payments", operation: "add", query: "createRazorpayOrder", role: profile?.role, status: profile?.status }, err);
      setError(normalizeFirebaseError(err, "Failed to initialize payment checkout."));
    } finally {
      setOpeningPayment(false);
    }
  };

  const checkStatusManual = async () => {
    if (!currentPaymentId) return;
    try {
      const snap = await getDoc(doc(db, "payments", currentPaymentId));
      if (snap.exists()) {
        const data = snap.data() as any;
        const st = String(data.state ?? data.status ?? "pending");
        if (st === "succeeded") {
          setStep(4);
          await loadHistory();
        } else {
          Alert.alert("Status Update", `Current payment status: ${st.toUpperCase()}. Confirming with bank...`);
        }
      }
    } catch (err) {
      Alert.alert("Error", "Unable to check status. Please check your connection.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, "/more")}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment Flow</Text>
        <Text style={styles.subtitle}>Select → Review → Pay Online → Unlocked</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.stepRow}>
            {[1, 2, 3, 4].map((item) => (
              <View key={item} style={[styles.stepDot, step >= (item as 1 | 2 | 3 | 4) && styles.stepDotActive]} />
            ))}
          </View>

          {step === 1 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>1) Select Payment Type</Text>
              
              <View style={styles.paymentCategory}>
                <View style={styles.paymentCategoryHeader}>
                  <Ionicons name="school-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.paymentCategoryTitle}>Course Fees</Text>
                </View>
                <View style={styles.choiceRow}>
                  <TouchableOpacity style={[styles.choiceChip, paymentType === "fees" && styles.choiceChipActive]} onPress={() => setPaymentType("fees")}>
                    <Text style={[styles.choiceText, paymentType === "fees" && styles.choiceTextActive]}>FEES</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {paymentType === "fees" ? (
                <View style={styles.paymentCategory}>
                  <View style={styles.paymentCategoryHeader}>
                    <Ionicons name="book-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.paymentCategoryTitle}>Select Course</Text>
                  </View>
                  <View style={styles.choiceRow}>
                    {courses.map((course) => (
                      <TouchableOpacity
                        key={course.id}
                        style={[styles.choiceChip, selectedCourseId === course.id && styles.choiceChipActive]}
                        onPress={() => setSelectedCourseId(course.id)}
                      >
                        <Text style={[styles.choiceText, selectedCourseId === course.id && styles.choiceTextActive]}>{course.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={styles.paymentCategory}>
                <View style={styles.paymentCategoryHeader}>
                  <Ionicons name="heart-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.paymentCategoryTitle}>Donations & Support</Text>
                </View>
                <View style={styles.choiceRow}>
                  {(["sadqa", "zakat", "fitra", "langar"] as PaymentType[]).map((type) => (
                    <TouchableOpacity key={type} style={[styles.choiceChip, paymentType === type && styles.choiceChipActive]} onPress={() => setPaymentType(type)}>
                      <Text style={[styles.choiceText, paymentType === type && styles.choiceTextActive]}>{type.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={styles.label}>Amount (INR)</Text>
              <TextInput
                style={[styles.input, paymentType === "fees" && styles.inputDisabled]}
                keyboardType="numeric"
                value={amount}
                editable={paymentType !== "fees"}
                onChangeText={setAmount}
                placeholder="Enter amount"
                placeholderTextColor={COLORS.textMuted}
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={onContinueToReview}>
                <Text style={styles.primaryBtnText}>Continue to Review</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>2) Review & Pay Online</Text>
              
              <View style={styles.reviewBox}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Category:</Text>
                  <Text style={styles.reviewValue}>{paymentType.toUpperCase()}</Text>
                </View>
                {paymentType === "fees" ? (
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Course:</Text>
                    <Text style={styles.reviewValue}>{selectedCourse?.name || selectedCourseId}</Text>
                  </View>
                ) : null}
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Authoritative Fee:</Text>
                  <Text style={styles.reviewAmount}>₹{parsedAmount.toFixed(2)}</Text>
                </View>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>Payment Method:</Text>
                  <Text style={styles.reviewValue}>UPI / Card / Netbanking (Razorpay)</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, openingPayment && styles.primaryBtnDisabled]}
                onPress={onInitiateCheckout}
                disabled={openingPayment}
              >
                {openingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="card-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Pay with Razorpay</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={styles.secondaryBtnText}>Change Course / Type</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.card}>
              <View style={styles.statusCenter}>
                <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: SPACING.md }} />
                <Text style={styles.statusTitle}>Confirming Payment...</Text>
                <Text style={styles.statusDescription}>
                  Please complete the transaction in Razorpay. Once your bank confirms the payment, your course access will be unlocked automatically.
                </Text>

                {waitingTimeout ? (
                  <View style={styles.timeoutNotice}>
                    <Text style={styles.timeoutText}>
                      Confirmation is taking a moment. If you completed your payment, you can refresh status or check back shortly.
                    </Text>
                    <TouchableOpacity style={styles.refreshBtn} onPress={checkStatusManual}>
                      <Ionicons name="refresh" size={16} color={COLORS.primary} />
                      <Text style={styles.refreshBtnText}>Check Status</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.primaryBtn, { width: "100%", marginTop: SPACING.md }]}
                  onPress={() => setCheckoutModalVisible(true)}
                >
                  <Text style={styles.primaryBtnText}>Open Razorpay Modal</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelLink} onPress={() => setStep(2)}>
                  <Text style={styles.cancelLinkText}>Back to Review</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.card}>
              <View style={styles.statusCenter}>
                <View style={styles.successBadge}>
                  <Ionicons name="checkmark-circle" size={54} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>Payment Successful!</Text>
                <Text style={styles.successSubtitle}>
                  Your course enrollment is now active. You have full access to lessons and quizzes.
                </Text>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.replace("/courses")}
                >
                  <Text style={styles.primaryBtnText}>Go to My Courses</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                  <Text style={styles.secondaryBtnText}>Make Another Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Payment History</Text>
            {loadingHistory ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : paymentHistory.length === 0 ? (
              <Text style={styles.historyEmpty}>No payment records found.</Text>
            ) : (
              paymentHistory.map((item) => {
                const itemState = item.state ?? item.status ?? "pending";
                const isSuccess = itemState === "succeeded";
                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyHeaderRow}>
                      <Text style={styles.historyType}>{(item.type || "fees").toUpperCase()}</Text>
                      <View style={[styles.historyBadge, isSuccess ? styles.badgeSuccess : styles.badgePending]}>
                        <Text style={[styles.badgeText, isSuccess ? styles.badgeTextSuccess : styles.badgeTextPending]}>
                          {itemState.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.historyAmount}>₹{Number(item.amount || 0).toFixed(2)}</Text>
                    {item.provider_payment_id ? (
                      <Text style={styles.historyRef}>Ref: {item.provider_payment_id}</Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={checkoutModalVisible}
        animationType="slide"
        onRequestClose={() => setCheckoutModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: COLORS.background }}>
          <View style={[styles.header, { paddingTop: insets.top + SPACING.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color={COLORS.primary} />
              <Text style={styles.title}>Secure Razorpay Checkout</Text>
            </View>
            <TouchableOpacity
              style={{ padding: 8 }}
              onPress={() => setCheckoutModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {checkoutData ? (
            <WebView
              originWhitelist={["https://*", "upi://*", "phonepe://*", "paytmmp://*", "gpay://*", "bhim://*", "credpay://*", "about:blank"]}
              source={{ html: checkoutHtml }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.event === "PAYMENT_SUCCESS") {
                    setCheckoutModalVisible(false);
                  } else if (data.event === "MODAL_CLOSED") {
                    setCheckoutModalVisible(false);
                  } else if (data.event === "PAYMENT_FAILED") {
                    setCheckoutModalVisible(false);
                    setError(data.error?.description || "Payment failed. Please try again.");
                    setStep(2);
                  }
                } catch {
                  // Ignore JSON parse error from non-JSON message
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                const u = request.url;
                if (u.startsWith("upi://") || u.startsWith("phonepe://") || u.startsWith("paytmmp://") || u.startsWith("gpay://")) {
                  Linking.openURL(u).catch(() => {});
                  return false;
                }
                return true;
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background }]}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ marginTop: 12, ...TYPOGRAPHY.label, color: COLORS.textMuted }}>Loading Razorpay Gateway...</Text>
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: SPACING.xs },
  backText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },
  stepRow: { flexDirection: "row", gap: SPACING.xs, marginBottom: SPACING.xs },
  stepDot: { height: 6, flex: 1, backgroundColor: COLORS.border, borderRadius: 3 },
  stepDotActive: { backgroundColor: COLORS.primary },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, ...SHADOWS.card, gap: SPACING.md },
  cardTitle: { ...TYPOGRAPHY.heading, fontSize: 18, color: COLORS.text },
  paymentCategory: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.sm, gap: SPACING.xs, backgroundColor: COLORS.surfaceAlt },
  paymentCategoryHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  paymentCategoryTitle: { ...TYPOGRAPHY.label, color: COLORS.text, fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  choiceChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: COLORS.surface },
  choiceChipActive: { borderColor: COLORS.primary, backgroundColor: "#E8F5E9" },
  choiceText: { ...TYPOGRAPHY.body, fontSize: 13, color: COLORS.textMuted },
  choiceTextActive: { color: COLORS.primary, fontWeight: "700" },
  label: { ...TYPOGRAPHY.label, color: COLORS.text, marginTop: SPACING.xs },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.surface },
  inputDisabled: { backgroundColor: "#F3F4F6", color: COLORS.textMuted },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: "center", justifyContent: "center", marginTop: SPACING.xs },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { ...TYPOGRAPHY.heading, color: "#FFFFFF", fontSize: 16 },
  secondaryBtn: { borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  secondaryBtnText: { ...TYPOGRAPHY.body, color: COLORS.textMuted, fontSize: 14 },
  btnRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  reviewBox: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.xs, borderWidth: 1, borderColor: COLORS.border },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewLabel: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  reviewValue: { ...TYPOGRAPHY.body, color: COLORS.text, fontWeight: "600" },
  reviewAmount: { ...TYPOGRAPHY.heading, color: COLORS.primary, fontSize: 18 },
  statusCenter: { alignItems: "center", paddingVertical: SPACING.lg, gap: SPACING.sm },
  statusTitle: { ...TYPOGRAPHY.heading, fontSize: 20, color: COLORS.text },
  statusDescription: { ...TYPOGRAPHY.body, textAlign: "center", color: COLORS.textMuted, paddingHorizontal: SPACING.md },
  successBadge: { marginBottom: SPACING.sm },
  successTitle: { ...TYPOGRAPHY.title, color: "#10B981", fontSize: 22 },
  successSubtitle: { ...TYPOGRAPHY.body, textAlign: "center", color: COLORS.textMuted, paddingHorizontal: SPACING.md, marginBottom: SPACING.md },
  timeoutNotice: { backgroundColor: "#FEF3C7", borderRadius: RADIUS.md, padding: SPACING.md, gap: SPACING.xs, marginTop: SPACING.md, width: "100%", alignItems: "center" },
  timeoutText: { ...TYPOGRAPHY.body, fontSize: 13, color: "#92400E", textAlign: "center" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  refreshBtnText: { ...TYPOGRAPHY.label, color: COLORS.primary, fontWeight: "700" },
  cancelLink: { marginTop: SPACING.md, padding: 8 },
  cancelLinkText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  error: { color: "#EF4444", textAlign: "center", marginTop: SPACING.xs },
  historyContainer: { marginTop: SPACING.lg, gap: SPACING.sm },
  historyTitle: { ...TYPOGRAPHY.heading, fontSize: 16, color: COLORS.text },
  historyEmpty: { ...TYPOGRAPHY.body, color: COLORS.textMuted, fontStyle: "italic" },
  historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  historyHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyType: { ...TYPOGRAPHY.label, fontWeight: "700", color: COLORS.text },
  historyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  badgeSuccess: { backgroundColor: "#D1FAE5" },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  badgeTextSuccess: { color: "#065F46" },
  badgeTextPending: { color: "#92400E" },
  historyAmount: { ...TYPOGRAPHY.heading, fontSize: 16, color: COLORS.primary },
  historyRef: { ...TYPOGRAPHY.label, fontSize: 11, color: COLORS.textMuted },
});
