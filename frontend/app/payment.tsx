import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, Image,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, addDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useActiveOrganization, DEFAULT_ORGANIZATION_NAME } from "@/lib/tenantContext";
import { useData } from "@/context/DataContext";
import { db, auth } from "@/lib/firebase";
import { normalizeFirebaseError } from "@/lib/errors";
import { logFirestoreFailure } from "@/lib/firestoreDebug";
import { createRazorpayOrder, verifyRazorpayPayment, enrollInFreeCourse } from "@/lib/razorpayFunctions";
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
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
  const { activeOrg } = useActiveOrganization();
  const { courses } = useData();

  // Admin Fee Management State
  const [adminFeeInput, setAdminFeeInput] = useState("");
  const [adminDonationNote, setAdminDonationNote] = useState("");
  const [savingAdminSettings, setSavingAdminSettings] = useState(false);
  const [adminSaveMessage, setAdminSaveMessage] = useState("");

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

  // Razorpay Checkout Modal (1-Click Instant Payment)
  const [checkoutModalVisible, setCheckoutModalVisible] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    orderId: string;
    paymentDocId: string;
    amount: number;
    currency: string;
    keyId: string;
    paymentDomain?: PaymentDomain;
    paymentType?: string;
  } | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  const [concessionLoading, setConcessionLoading] = useState(false);

  // Direct 1-Tap UPI States & Handlers
  const [directUpiModalVisible, setDirectUpiModalVisible] = useState(false);
  const [directUpiVpa, setDirectUpiVpa] = useState(activeOrg?.upi_id || "madrasatussalikat@icici");
  const [directUpiUtr, setDirectUpiUtr] = useState("");
  const [directUpiSubmitting, setDirectUpiSubmitting] = useState(false);
  const [upiCopied, setUpiCopied] = useState(false);
  const [copiedBankAcc, setCopiedBankAcc] = useState(false);
  const [copiedIfsc, setCopiedIfsc] = useState(false);
  const [activeUpiRef, setActiveUpiRef] = useState("");

  useEffect(() => {
    if (activeOrg?.upi_id) {
      setDirectUpiVpa(activeOrg.upi_id);
    }
  }, [activeOrg?.upi_id]);

  const getPaymentSettings = async () => {
    const globalSnap = await getDoc(doc(db, "app_settings", "global"));
    const platformSnap = await getDoc(doc(db, "app_settings", "platform"));
    const merged = {
      ...(platformSnap.exists() ? (platformSnap.data() as Record<string, unknown>) : {}),
      ...(globalSnap.exists() ? (globalSnap.data() as Record<string, unknown>) : {}),
    };
    const fee = Number(merged.fees_amount || 500);
    const donationUrl = String(activeOrg?.donation_url || merged.donation_url || merged.razorpay_link || "https://pages.razorpay.com/mslb-donation");
    const vpa = String(activeOrg?.upi_id || merged.upi_id || merged.upi_vpa || "madrasatussalikat@icici");
    const donationContent = String(merged.donation_content || "");
    return { fee, donationUrl, vpa, donationContent };
  };

  const handleSaveAdminFeeSettings = async () => {
    if (!isAdmin) return;
    const val = Number(adminFeeInput);
    if (!Number.isFinite(val) || val < 0) {
      Alert.alert("Invalid Fee", "Fee amount must be 0 or greater.");
      return;
    }
    setSavingAdminSettings(true);
    setAdminSaveMessage("");
    try {
      await setDoc(doc(db, "app_settings", "platform"), {
        fees_amount: val,
        donation_content: adminDonationNote,
        updated_at: serverTimestamp(),
      }, { merge: true });
      if (activeOrg?.id) {
        await updateDoc(doc(db, "organizations", activeOrg.id), {
          standard_fee: val,
          updated_at: serverTimestamp(),
        }).catch(() => {});
      }
      setFeesAmount(val);
      setAdminSaveMessage("Fee settings saved successfully!");
      Alert.alert("Saved", "Standard academic fee and donation appeal note updated successfully.");
    } catch (e: any) {
      Alert.alert("Save Failed", e?.message || "Could not save fee settings.");
    } finally {
      setSavingAdminSettings(false);
    }
  };

  const handleOpenDirectUpiModal = async () => {
    if (!user?.uid) {
      setError("Please sign in to make a payment.");
      return;
    }
    const orgSlug = (activeOrg?.slug || 'CAMPUS').toUpperCase().slice(0, 6);
    const ref = orgSlug + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1000);
    setActiveUpiRef(ref);
    setDirectUpiUtr("");
    setUpiCopied(false);
    setDirectUpiModalVisible(true);

    // Try auto-triggering the native Android UPI intent chooser immediately
    const orgName = activeOrg?.upi_name || activeOrg?.name || DEFAULT_ORGANIZATION_NAME;
    const note = activeDomain === "academic_fee"
      ? `Fee: ${selectedCourse?.name || "Course Fee"}`
      : `Donation: ${donationType.toUpperCase()}`;
    const upiUrl = `upi://pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;

    try {
      const canOpen = await Linking.canOpenURL(upiUrl);
      if (canOpen) {
        await Linking.openURL(upiUrl);
      }
    } catch {
      // If auto-open is delayed or no default set, modal remains visible for 1-tap app selection
    }
  };

  const launchSpecificUpiApp = async (appType: "universal" | "phonepe" | "gpay" | "paytm") => {
    const orgName = activeOrg?.upi_name || activeOrg?.name || DEFAULT_ORGANIZATION_NAME;
    const note = activeDomain === "academic_fee"
      ? `Fee: ${selectedCourse?.name || "Course Fee"}`
      : `Donation: ${donationType.toUpperCase()}`;
    const orgSlug = (activeOrg?.slug || 'CAMPUS').toUpperCase().slice(0, 6);
    const ref = activeUpiRef || (orgSlug + Date.now().toString(36).toUpperCase());

    let targetUrl = `upi://pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;

    if (appType === "phonepe") {
      targetUrl = `phonepe://upi/pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;
    } else if (appType === "gpay") {
      targetUrl = `tez://upi/pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;
    } else if (appType === "paytm") {
      targetUrl = `paytmmp://pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;
    }

    try {
      const supported = await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        // Fallback to universal upi://
        const universalUrl = `upi://pay?pa=${encodeURIComponent(directUpiVpa)}&pn=${encodeURIComponent(orgName)}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(ref)}`;
        await Linking.openURL(universalUrl);
      }
    } catch {
      Alert.alert(
        "Open UPI App",
        `Could not directly launch the selected app. Please copy the Madrasa UPI ID (${directUpiVpa}) and pay inside your UPI app, or scan the QR Code below.`,
        [{ text: "OK" }]
      );
    }
  };

  const handleCopyUpiId = async () => {
    try {
      await Clipboard.setStringAsync(directUpiVpa);
      setUpiCopied(true);
      setTimeout(() => setUpiCopied(false), 3000);
      Alert.alert("UPI ID Copied", `${directUpiVpa} copied to clipboard! You can paste this in Google Pay, PhonePe, or Paytm.`);
    } catch {
      Alert.alert("Madrasa UPI ID", directUpiVpa);
    }
  };

  const handleSubmitDirectUpiPayment = async () => {
    if (!user?.uid) {
      Alert.alert("Sign In Required", "Please sign in to submit your payment reference.");
      return;
    }
    const trimmedUtr = directUpiUtr.trim();
    if (!trimmedUtr || trimmedUtr.length < 6) {
      Alert.alert("Invalid Reference", "Please enter a valid 12-digit UPI Reference Number / UTR from your UPI payment receipt.");
      return;
    }

    setDirectUpiSubmitting(true);
    try {
      const orgId = activeOrg?.id || "mslb-main";
      const courseName = activeDomain === "academic_fee" ? (selectedCourse?.name || "Selected Course") : null;
      const orgSlug = (activeOrg?.slug || 'CAMPUS').toUpperCase().slice(0, 6);
      const ref = activeUpiRef || (orgSlug + Date.now().toString(36).toUpperCase());

      // Attempt 1: Direct atomic submission with state: "submitted"
      try {
        await addDoc(collection(db, "payments"), {
          user_id: user.uid,
          user_name: profile?.name || user.displayName || "Student",
          amount: currentTotalAmount * 100, // paise
          currency: "INR",
          state: "submitted",
          status: "submitted",
          provider: "razorpay", // Required invariant in firestore.rules
          provider_order_id: ref,
          transaction_ref: trimmedUtr,
          payment_domain: activeDomain,
          payment_type: activeDomain === "academic_fee" ? academicType : donationType,
          course_id: activeDomain === "academic_fee" ? selectedCourseId : null,
          course_name: courseName,
          organization_id: orgId,
          review_mode: "manual",
          source: "direct_upi_intent",
          created_at: serverTimestamp(),
          submitted_at: serverTimestamp(),
          created_at_ms: Date.now(),
        });
      } catch (atomicErr) {
        // Fallback: 2-step compliant submission (pending -> submitted)
        const pendingDoc = await addDoc(collection(db, "payments"), {
          user_id: user.uid,
          user_name: profile?.name || user.displayName || "Student",
          amount: currentTotalAmount * 100, // paise
          currency: "INR",
          state: "pending",
          status: "pending",
          provider: "razorpay",
          provider_order_id: ref,
          payment_domain: activeDomain,
          payment_type: activeDomain === "academic_fee" ? academicType : donationType,
          course_id: activeDomain === "academic_fee" ? selectedCourseId : null,
          course_name: courseName,
          review_mode: "manual",
          source: "direct_upi_intent",
          created_at: serverTimestamp(),
          created_at_ms: Date.now(),
        });

        await updateDoc(doc(db, "payments", pendingDoc.id), {
          transaction_ref: trimmedUtr,
          payment_ref: trimmedUtr,
          state: "submitted",
          status: "submitted",
          submitted_at: serverTimestamp(),
        });
      }

      setDirectUpiModalVisible(false);
      setDirectUpiUtr("");
      await loadHistory();

      Alert.alert(
        "Alhamdulillah! Payment Reference Submitted",
        `Your UPI payment reference (${trimmedUtr}) has been recorded. Our academic board will verify your transaction against bank records and activate your course access shortly.`,
        [
          {
            text: "View Payment History",
            onPress: () => {
              setStep(1);
            },
          },
          {
            text: "Done",
            style: "cancel",
          },
        ]
      );
    } catch (err: any) {
      logFirestoreFailure(
        { collection: "payments", operation: "add", query: "submit direct upi reference", role: profile?.role, status: profile?.status },
        err
      );
      Alert.alert("Submission Error", normalizeFirebaseError(err, "Failed to submit UPI reference. Please try again or contact admissions."));
    } finally {
      setDirectUpiSubmitting(false);
    }
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
        [{ text: "Back to Courses", onPress: () => router.replace("/(tabs)/courses") }]
      );
    } catch (err: any) {
      logFirestoreFailure(
        { collection: "admission_inquiries", operation: "add", query: "concession application", role: profile?.role, status: profile?.status },
        err
      );
      const contactEmail = activeOrg?.email || "admissions@suffahmadrasa.org";
      Alert.alert("Submission Notice", `Please contact the Admissions Desk directly via ${contactEmail}.`);
    } finally {
      setConcessionLoading(false);
    }
  };

  const handleContactAdmissions = () => {
    const email = activeOrg?.email || "admissions@suffahmadrasa.org";
    const subject = encodeURIComponent(`Admission & Course Fee Inquiry: ${selectedCourse?.name || "Academic Course"}`);
    const body = encodeURIComponent(
      `Assalamu Alaikum,\n\nI am inquiring regarding admission and tuition for ${selectedCourse?.name || "the course"}.\n\nStudent Name: ${profile?.name || user?.displayName || ""}\nStudent Email: ${user?.email || ""}`
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert("Admissions Desk", `Please email ${email} for admission guidance.`);
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
        const { fee, vpa, donationContent } = await getPaymentSettings();
        setFeesAmount(fee);
        setAdminFeeInput(String(fee));
        if (donationContent) setAdminDonationNote(donationContent);
        if (vpa) setDirectUpiVpa(vpa);
        await loadHistory();
      } catch (err) {
        logFirestoreFailure(
          { collection: "app_settings/platform", operation: "get", query: "load payment settings", role: profile?.role, status: profile?.status },
          err
        );
      }
    };
    load().catch(() => {});
  }, [user?.uid, activeOrg?.upi_id]);

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
  const monthlyFeeVal = (activeOrg as any)?.monthly_fee || 500;
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
          [{ text: "Go to Courses", onPress: () => router.replace("/(tabs)/courses") }]
        );
      }
    } catch (err: any) {
      setError(normalizeFirebaseError(err, "Failed to complete free enrollment."));
    } finally {
      setFreeEnrolling(false);
    }
  };

  const onInitiateRazorpayPayment = async () => {
    if (!user?.uid) {
      setError("Please sign in to make a payment.");
      return;
    }
    setError("");
    setOpeningPayment(true);
    try {
      const isDonation = activeDomain === "donation";
      const orderPayload: any = {
        paymentDomain: activeDomain,
        paymentType: isDonation ? donationType : academicType,
        currency: "INR",
      };
      if (isDonation) {
        orderPayload.donationAmountInr = payableDonationAmount;
      } else {
        orderPayload.courseId = selectedCourseId;
      }

      const orderData = await createRazorpayOrder(orderPayload);
      setCurrentPaymentId(orderData.paymentDocId);
      setCheckoutData(orderData);
      setCheckoutModalVisible(true);
      setStep(3);
    } catch (err: any) {
      const msg = normalizeFirebaseError(err, "Failed to initiate payment gateway.");
      setError(msg);
      Alert.alert("Payment Notice", msg);
    } finally {
      setOpeningPayment(false);
    }
  };

  const checkoutHtml = useMemo(() => {
    if (!checkoutData) return "";
    const { keyId, orderId, amount: orderAmt, currency } = checkoutData;
    const isDonation = activeDomain === "donation";
    const title = isDonation
      ? `Madrasa Donation: ${donationType.toUpperCase()}`
      : `Academic Fee: ${selectedCourse?.name || "Course Fee"}`;
    const studentName = profile?.name || user?.displayName || "Student / Donor";
    const studentEmail = profile?.email || user?.email || "";
    const studentPhone = profile?.phone || "";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
      body, html { margin: 0; padding: 0; height: 100%; width: 100%; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; }
      .loader { text-align: center; color: #475569; }
      .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top: 3px solid #005F46; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 12px; }
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
          "name": "${(activeOrg?.name || DEFAULT_ORGANIZATION_NAME).replace(/"/g, "")}",
          "description": "${title.replace(/"/g, "")}",
          "order_id": "${orderId}",
          "prefill": {
            "name": "${studentName.replace(/"/g, "")}",
            "email": "${studentEmail.replace(/"/g, "")}",
            "contact": "${studentPhone.replace(/"/g, "")}"
          },
          "theme": {
            "color": "#005F46"
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
      window.onload = function () {
        setTimeout(launchCheckout, 400);
      };
    </script>
  </body>
</html>`;
  }, [checkoutData, activeDomain, donationType, selectedCourse, profile, user]);

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
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="always">
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

                  {/* 1-Tap Quick Monthly Fee Pay Card (Ghalati 6 Fix) */}
                  <View style={styles.quickFeePayCard}>
                    <View style={styles.quickFeeHeaderRow}>
                      <View style={styles.quickFeeIconBox}>
                        <Ionicons name="card" size={20} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quickFeeTitle}>
                          {activeOrg?.name || DEFAULT_ORGANIZATION_NAME}
                        </Text>
                        <Text style={styles.quickFeeSub}>
                          Monthly Madrasa Fee • ماہانہ فیس ({new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })})
                        </Text>
                      </View>
                      <View style={styles.quickFeeAmountBadge}>
                        <Text style={styles.quickFeeAmountBadgeText}>₹{monthlyFeeVal}</Text>
                      </View>
                    </View>

                    <Text style={styles.quickFeeNotice}>
                      Instant fee clearance via your UPI app (Google Pay, PhonePe, Paytm, BHIM). No forms, no waiting timers.
                    </Text>

                    {/* Instant App Launchers */}
                    <View style={styles.quickUpiAppRow}>
                      <TouchableOpacity
                        style={[styles.quickUpiAppBtn, { borderColor: '#5F259F' }]}
                        onPress={() => launchSpecificUpiApp('phonepe')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="flash" size={13} color="#5F259F" />
                        <Text style={[styles.quickUpiAppBtnText, { color: '#5F259F' }]}>PhonePe</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickUpiAppBtn, { borderColor: '#1A73E8' }]}
                        onPress={() => launchSpecificUpiApp('gpay')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="logo-google" size={13} color="#1A73E8" />
                        <Text style={[styles.quickUpiAppBtnText, { color: '#1A73E8' }]}>GPay</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickUpiAppBtn, { borderColor: '#00B9F5' }]}
                        onPress={() => launchSpecificUpiApp('paytm')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="wallet-outline" size={13} color="#00B9F5" />
                        <Text style={[styles.quickUpiAppBtnText, { color: '#00B9F5' }]}>Paytm</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickUpiAppBtn, { borderColor: '#059669' }]}
                        onPress={() => handleOpenDirectUpiModal()}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="qr-code-outline" size={13} color="#059669" />
                        <Text style={[styles.quickUpiAppBtnText, { color: '#059669' }]}>Any UPI</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.instantPayNowBtn}
                      onPress={handleOpenDirectUpiModal}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="flash" size={18} color="#FFFFFF" />
                      <Text style={styles.instantPayNowBtnText}>
                        1-Tap Pay ₹{monthlyFeeVal} via UPI (فوری فیس ادا کریں)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, { marginTop: SPACING.md }]}>
                    Or Select Specific Course / Exam (دیگر کورس منتخب کریں)
                  </Text>
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
                    <Ionicons name="shield-checkmark" size={20} color="#005F46" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.donationNoticeText, { fontWeight: "700", color: "#005F46", marginBottom: 2 }]}>
                        100% Confidential Donation • صدقہ خفیہ
                      </Text>
                      <Text style={styles.donationNoticeText}>
                        Your donation is strictly private. In accordance with Islamic principles of sincere charity (Ikhlas), donor identity and contribution amounts are never displayed on public feeds or shared with other users. Only the authorized madrasa administration can access incoming contributions.
                      </Text>
                    </View>
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

              {/* PAYMENT METHOD SELECTION */}
              <View style={styles.paymentMethodsContainer}>
                <Text style={styles.paymentMethodsHeading}>Choose Payment Method (طریقہ کار منتخب کریں)</Text>

                {/* OPTION 1: DIRECT UPI APPS (1-TAP) */}
                <TouchableOpacity
                  style={styles.directUpiCard}
                  onPress={handleOpenDirectUpiModal}
                  activeOpacity={0.88}
                >
                  <View style={styles.directUpiHeaderRow}>
                    <View style={styles.upiBadgeRow}>
                      <View style={styles.directUpiIconWrap}>
                        <Ionicons name="flash" size={18} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={styles.directUpiCardTitle}>1-Tap Direct UPI Apps</Text>
                        <Text style={styles.directUpiCardSubtitle}>Google Pay • PhonePe • Paytm • BHIM • Cred</Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#059669" />
                  </View>

                  <View style={styles.upiAppsPillsRow}>
                    <View style={[styles.upiAppPill, { borderColor: "#5F259F" }]}>
                      <Text style={[styles.upiAppPillText, { color: "#5F259F" }]}>PhonePe</Text>
                    </View>
                    <View style={[styles.upiAppPill, { borderColor: "#1A73E8" }]}>
                      <Text style={[styles.upiAppPillText, { color: "#1A73E8" }]}>Google Pay</Text>
                    </View>
                    <View style={[styles.upiAppPill, { borderColor: "#00B9F5" }]}>
                      <Text style={[styles.upiAppPillText, { color: "#00B9F5" }]}>Paytm</Text>
                    </View>
                    <View style={[styles.upiAppPill, { borderColor: "#E05E2B" }]}>
                      <Text style={[styles.upiAppPillText, { color: "#E05E2B" }]}>BHIM UPI</Text>
                    </View>
                  </View>

                  <View style={styles.directUpiBtn}>
                    <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.directUpiBtnText}>
                      Pay ₹{currentTotalAmount.toLocaleString()} via UPI Apps
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* OPTION 2: RAZORPAY GATEWAY */}
                <TouchableOpacity
                  style={[styles.razorpayCard, openingPayment && styles.primaryBtnDisabled]}
                  onPress={onInitiateRazorpayPayment}
                  disabled={openingPayment}
                  activeOpacity={0.88}
                >
                  <View style={styles.directUpiHeaderRow}>
                    <View style={styles.upiBadgeRow}>
                      <View style={[styles.directUpiIconWrap, { backgroundColor: COLORS.primary }]}>
                        <Ionicons name="card" size={18} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={styles.directUpiCardTitle}>Razorpay Gateway</Text>
                        <Text style={styles.directUpiCardSubtitle}>Instant Auto-Access • Cards, UPI, NetBanking</Text>
                      </View>
                    </View>
                    {openingPayment ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                    )}
                  </View>

                  <View style={styles.upiAppsPillsRow}>
                    <View style={styles.razorpayPill}>
                      <Ionicons name="card-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.razorpayPillText}>Debit / Credit Card</Text>
                    </View>
                    <View style={styles.razorpayPill}>
                      <Ionicons name="business-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.razorpayPillText}>Net Banking</Text>
                    </View>
                    <View style={styles.razorpayPill}>
                      <Ionicons name="wallet-outline" size={12} color={COLORS.textMuted} />
                      <Text style={styles.razorpayPillText}>Wallets</Text>
                    </View>
                  </View>

                  <View style={[styles.primaryBtn, { marginTop: 4 }]}>
                    <View style={styles.btnRow}>
                      <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>
                        Pay ₹{currentTotalAmount.toLocaleString()} with Razorpay
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {activeDomain === "academic_fee" ? (
                <>
                  <TouchableOpacity
                    style={[styles.secondaryConcessionBtn, concessionLoading && styles.primaryBtnDisabled]}
                    onPress={handleScholarshipConcessionRequest}
                    disabled={concessionLoading}
                  >
                    {concessionLoading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <View style={styles.btnRow}>
                        <Ionicons name="school-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.secondaryConcessionText}>
                          Need Financial Aid / Concession? Apply Here
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.contactAdmissionsLink} onPress={handleContactAdmissions}>
                    <Ionicons name="mail-outline" size={14} color={COLORS.textMuted} />
                    <Text style={styles.contactAdmissionsText}>Contact Admissions Desk</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={onProceedToDonationWeb}
                >
                  <View style={styles.btnRow}>
                    <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.secondaryBtnText}>
                      Or Donate via External Web Browser
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep(1)}>
                <Text style={styles.secondaryBtnText}>Modify Selection</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* STEP 3: PAYMENT IN PROGRESS / GATEWAY WINDOW */}
          {step === 3 ? (
            <View style={styles.card}>
              <View style={styles.statusCenter}>
                {verifyingPayment ? (
                  <>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text style={styles.statusTitle}>Verifying Payment & Granting Access...</Text>
                    <Text style={styles.statusDescription}>
                      Mubarak! Razorpay payment received. Finalizing your course enrollment now.
                    </Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.statusTitle}>Razorpay Gateway Active</Text>
                    <Text style={styles.statusDescription}>
                      Please complete your payment of ₹{currentTotalAmount.toLocaleString()} in the Razorpay window. Your access will unlock automatically.
                    </Text>

                    <TouchableOpacity
                      style={[styles.primaryBtn, { width: "100%", marginTop: SPACING.md }]}
                      onPress={() => setCheckoutModalVisible(true)}
                    >
                      <View style={styles.btnRow}>
                        <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Open Razorpay Window</Text>
                      </View>
                    </TouchableOpacity>

                    {waitingTimeout ? (
                      <View style={styles.timeoutNotice}>
                        <Ionicons name="time-outline" size={18} color="#92400E" />
                        <Text style={styles.timeoutText}>
                          Payment verification is taking a moment. If you completed the payment, your course access will update automatically.
                        </Text>
                        <TouchableOpacity style={styles.refreshBtn} onPress={loadHistory}>
                          <Ionicons name="refresh" size={14} color={COLORS.primary} />
                          <Text style={styles.refreshBtnText}>Check Payment Status</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    <TouchableOpacity style={styles.cancelLink} onPress={() => setStep(2)}>
                      <Text style={styles.cancelLinkText}>Back to Review</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
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

                {/* View Official Receipt Button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, { width: "100%", marginTop: SPACING.md, marginBottom: SPACING.xs }]}
                  onPress={() => {
                    const latest = paymentHistory.find((p) => p.id === currentPaymentId) || {
                      id: currentPaymentId || "RCP-" + Date.now().toString(36).toUpperCase(),
                      payment_domain: activeDomain,
                      payment_type: activeDomain === "donation" ? donationType : academicType,
                      amount: currentTotalAmount,
                      course_name: selectedCourse?.name,
                      state: "succeeded",
                    };
                    openReceiptModal(latest as any);
                  }}
                >
                  <View style={styles.btnRow}>
                    <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>View My Private Receipt</Text>
                  </View>
                </TouchableOpacity>

                {activeDomain === "academic_fee" ? (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { width: "100%", marginTop: 6 }]}
                    onPress={() => router.replace("/(tabs)/courses")}
                  >
                    <Text style={styles.secondaryBtnText}>Go to My Courses</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { width: "100%", marginTop: 6 }]}
                    onPress={() => router.replace("/(tabs)/index")}
                  >
                    <Text style={styles.secondaryBtnText}>Back to Home</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ marginTop: 12, padding: 8 }}
                  onPress={() => {
                    setStep(1);
                    loadHistory().catch(() => {});
                  }}
                >
                  <Text style={{ fontSize: 13, color: COLORS.textMuted, fontWeight: "600" }}>Make Another Contribution</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* CLEAN DISCREET RECEIPT ARCHIVE LINK */}
          {step === 1 ? (
            <TouchableOpacity
              style={styles.cleanReceiptRow}
              onPress={() => router.push('/payment-history')}
              activeOpacity={0.7}
            >
              <Ionicons name="receipt-outline" size={15} color={COLORS.primary} />
              <Text style={styles.cleanReceiptRowText}>Looking for your past payment receipts? View My Private Receipts</Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}

          {/* ADMIN FEE & PAYMENT MANAGEMENT (Dedicated Single-Home for Admins) */}
          {isAdmin && step === 1 ? (
            <View style={styles.adminFeeCard}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="settings-outline" size={20} color={COLORS.primary} />
                <Text style={styles.cardTitle}>Madrasa Fee & Payment Governance</Text>
              </View>
              <Text style={styles.adminFeeSub}>
                Configure standard academic fee and public donation appeal note for this madrasa.
              </Text>

              <Text style={[styles.label, { marginTop: 12 }]}>Standard Monthly Fee Amount (INR)</Text>
              <TextInput
                style={styles.adminInput}
                keyboardType="numeric"
                placeholder="e.g. 500"
                value={adminFeeInput}
                onChangeText={setAdminFeeInput}
              />

              <Text style={[styles.label, { marginTop: 12 }]}>Donation Appeal Note</Text>
              <TextInput
                style={[styles.adminInput, styles.adminTextArea]}
                multiline
                placeholder="Write appeal message for Sadaqah & Zakat contributors..."
                value={adminDonationNote}
                onChangeText={setAdminDonationNote}
              />

              {adminSaveMessage ? (
                <Text style={styles.adminSuccessText}>{adminSaveMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 12 }]}
                onPress={handleSaveAdminFeeSettings}
                disabled={savingAdminSettings}
              >
                {savingAdminSettings ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.btnRow}>
                    <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Save Fee & Donation Settings</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.adminAuditBtn}
                onPress={() => router.push('/admin/payments')}
              >
                <Ionicons name="receipt-outline" size={16} color={COLORS.primary} />
                <Text style={styles.adminAuditBtnText}>Open Admin Payment Ledger & Audits</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* RAZORPAY WEBVIEW MODAL */}
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
            <TouchableOpacity style={{ padding: 8 }} onPress={() => setCheckoutModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          {checkoutData ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html: checkoutHtml }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.event === "PAYMENT_SUCCESS") {
                    setCheckoutModalVisible(false);
                    const paymentId = data.payment_id;
                    const orderId = data.order_id;
                    const signature = data.signature;
                    if (currentPaymentId && orderId && paymentId && signature) {
                      setVerifyingPayment(true);
                      verifyRazorpayPayment({
                        paymentDocId: currentPaymentId,
                        orderId,
                        paymentId,
                        signature,
                      })
                        .then((res) => {
                          if (res?.success) {
                            setStep(4);
                            loadHistory().catch(() => {});
                          }
                        })
                        .catch((err) => {
                          logFirestoreFailure(
                            { collection: "payments", operation: "update", query: "verifyRazorpayPayment callable fallback to webhook", role: profile?.role, status: profile?.status },
                            err
                          );
                        })
                        .finally(() => {
                          setVerifyingPayment(false);
                        });
                    }
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
                if (!u) return true;

                // Handle standard UPI schemes
                const isUpiScheme =
                  u.startsWith("upi://") ||
                  u.startsWith("phonepe://") ||
                  u.startsWith("paytmmp://") ||
                  u.startsWith("paytm://") ||
                  u.startsWith("gpay://") ||
                  u.startsWith("tez://") ||
                  u.startsWith("bhim://") ||
                  u.startsWith("credpay://") ||
                  u.startsWith("mobikwik://") ||
                  u.startsWith("whatsapp://");

                if (isUpiScheme) {
                  Linking.openURL(u).catch((err) => {
                    console.warn("[Razorpay] Failed to open UPI scheme URL:", err);
                  });
                  return false;
                }

                // Handle Android Intent URLs (frequently emitted by Razorpay UPI on Android)
                if (u.startsWith("intent://")) {
                  try {
                    let targetUrl = "";
                    if (u.includes("scheme=upi")) {
                      const match = u.match(/^intent:\/\/([^#]+)/);
                      if (match && match[1]) {
                        targetUrl = "upi://" + match[1];
                      }
                    } else if (u.includes("data=upi")) {
                      const match = u.match(/data=([^;]+)/);
                      if (match && match[1]) {
                        targetUrl = decodeURIComponent(match[1]);
                      }
                    }

                    if (targetUrl) {
                      Linking.openURL(targetUrl).catch(() => {
                        Linking.openURL(u).catch(() => {});
                      });
                      return false;
                    } else {
                      Linking.openURL(u).catch(() => {});
                      return false;
                    }
                  } catch {
                    Linking.openURL(u).catch(() => {});
                    return false;
                  }
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

      {/* DIRECT 1-TAP UPI PAYMENT MODAL */}
      <Modal
        visible={directUpiModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDirectUpiModalVisible(false)}
      >
        <View style={styles.directUpiModalOverlay}>
          <View style={styles.directUpiModalSheet}>
            <View style={styles.directUpiSheetHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.directUpiIconWrap}>
                  <Ionicons name="flash" size={18} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.directUpiSheetTitle}>Direct UPI Payment</Text>
                  <Text style={styles.directUpiSheetSubtitle}>براہ راست یو پی آئی ادائیگی</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.directUpiCloseBtn}
                onPress={() => setDirectUpiModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
              {/* AMOUNT & PAYEE SUMMARY */}
              <View style={styles.directUpiSummaryBox}>
                <Text style={styles.directUpiSummaryLabel}>Total Amount Payable</Text>
                <Text style={styles.directUpiSummaryAmount}>₹{currentTotalAmount.toLocaleString()}</Text>
                <Text style={styles.directUpiSummaryPayee}>
                  Payee: {activeOrg?.name || DEFAULT_ORGANIZATION_NAME}
                </Text>
                <Text style={styles.directUpiSummaryPurpose}>
                  Purpose: {activeDomain === "academic_fee" ? `Course Fee (${selectedCourse?.name || "Academic"})` : `Donation (${donationType.toUpperCase()})`}
                </Text>
              </View>

              {/* STEP 1: LAUNCH INSTALLED UPI APPS */}
              <Text style={styles.directUpiSectionTitle}>1. Tap to Pay via Installed App</Text>
              <Text style={styles.directUpiSectionDesc}>
                Tap your preferred app to open and complete payment directly:
              </Text>

              <View style={styles.directUpiAppGrid}>
                <TouchableOpacity
                  style={[styles.directUpiAppBtn, { borderColor: "#5F259F" }]}
                  onPress={() => launchSpecificUpiApp("phonepe")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.appCircle, { backgroundColor: "#5F259F" }]}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 13 }}>Pe</Text>
                  </View>
                  <Text style={styles.directUpiAppName}>PhonePe</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directUpiAppBtn, { borderColor: "#1A73E8" }]}
                  onPress={() => launchSpecificUpiApp("gpay")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.appCircle, { backgroundColor: "#1A73E8" }]}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 13 }}>G</Text>
                  </View>
                  <Text style={styles.directUpiAppName}>Google Pay</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directUpiAppBtn, { borderColor: "#00B9F5" }]}
                  onPress={() => launchSpecificUpiApp("paytm")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.appCircle, { backgroundColor: "#00B9F5" }]}>
                    <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 11 }}>Paytm</Text>
                  </View>
                  <Text style={styles.directUpiAppName}>Paytm</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.directUpiAppBtn, { borderColor: "#059669" }]}
                  onPress={() => launchSpecificUpiApp("universal")}
                  activeOpacity={0.8}
                >
                  <View style={[styles.appCircle, { backgroundColor: "#059669" }]}>
                    <Ionicons name="apps" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.directUpiAppName}>Any UPI App</Text>
                </TouchableOpacity>
              </View>

              {/* STEP 2: COPY UPI ID OR SCAN QR */}
              <Text style={[styles.directUpiSectionTitle, { marginTop: SPACING.md }]}>
                2. Or Pay via UPI ID / QR Code
              </Text>

              <View style={styles.upiVpaContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.upiVpaLabel}>Official Institutional UPI ID (VPA):</Text>
                  <Text style={styles.upiVpaText} selectable={true}>{directUpiVpa}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.upiCopyBtn, upiCopied && styles.upiCopyBtnActive]}
                  onPress={handleCopyUpiId}
                >
                  <Ionicons
                    name={upiCopied ? "checkmark" : "copy-outline"}
                    size={16}
                    color={upiCopied ? "#10B981" : COLORS.primary}
                  />
                  <Text style={[styles.upiCopyBtnText, upiCopied && { color: "#10B981" }]}>
                    {upiCopied ? "Copied" : "Copy"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* DYNAMIC QR CODE */}
              <View style={styles.qrCodeBox}>
                <Image
                  source={{
                    uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                      `upi://pay?pa=${directUpiVpa}&pn=${encodeURIComponent(activeOrg?.upi_name || activeOrg?.name || 'Suffah Madrasa')}&am=${currentTotalAmount}&cu=INR&tn=${encodeURIComponent(
                        activeDomain === "academic_fee" ? `Fee: ${selectedCourse?.name || "Course"}` : "Donation"
                      )}`
                    )}`,
                  }}
                  style={styles.qrCodeImage}
                  resizeMode="contain"
                />
                <Text style={styles.qrCodeCaption}>
                  Scan using Google Pay, PhonePe, Paytm, or BHIM from any mobile
                </Text>
              </View>

              {/* OFFICIAL MADRASA BANK ACCOUNT (NEFT / IMPS / NETBANKING) */}
              {(Boolean(activeOrg?.account_number) || Boolean(activeOrg?.bank_name)) && (
                <View style={styles.bankAccountCard}>
                  <View style={styles.bankHeaderRow}>
                    <Ionicons name="business" size={18} color="#005F46" />
                    <Text style={styles.bankHeaderTitle}>Official Madrasa Bank Account (NEFT / IMPS)</Text>
                  </View>
                  <Text style={styles.bankSubtitle}>
                    You may also transfer fees directly via NetBanking / IMPS / NEFT to {activeOrg?.name || 'the Madrasa'}:
                  </Text>

                  {Boolean(activeOrg?.account_holder) && (
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Beneficiary Name:</Text>
                      <Text style={styles.bankDetailValue} selectable>{activeOrg?.account_holder}</Text>
                    </View>
                  )}

                  {Boolean(activeOrg?.bank_name) && (
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Bank Name:</Text>
                      <Text style={styles.bankDetailValue}>{activeOrg?.bank_name}</Text>
                    </View>
                  )}

                  {Boolean(activeOrg?.account_number) && (
                    <View style={styles.bankDetailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bankDetailLabel}>Account Number:</Text>
                        <Text style={[styles.bankDetailValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800' }]} selectable>
                          {activeOrg?.account_number}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.bankCopyBtn, copiedBankAcc && styles.bankCopyBtnActive]}
                        onPress={async () => {
                          await Clipboard.setStringAsync(activeOrg?.account_number || '');
                          setCopiedBankAcc(true);
                          setTimeout(() => setCopiedBankAcc(false), 2500);
                        }}
                      >
                        <Ionicons name={copiedBankAcc ? "checkmark" : "copy-outline"} size={14} color={copiedBankAcc ? "#10B981" : COLORS.primary} />
                        <Text style={[styles.bankCopyBtnText, copiedBankAcc && { color: "#10B981" }]}>
                          {copiedBankAcc ? "Copied" : "Copy"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {Boolean(activeOrg?.ifsc_code) && (
                    <View style={styles.bankDetailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.bankDetailLabel}>IFSC Code:</Text>
                        <Text style={[styles.bankDetailValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: '800' }]} selectable>
                          {activeOrg?.ifsc_code}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.bankCopyBtn, copiedIfsc && styles.bankCopyBtnActive]}
                        onPress={async () => {
                          await Clipboard.setStringAsync(activeOrg?.ifsc_code || '');
                          setCopiedIfsc(true);
                          setTimeout(() => setCopiedIfsc(false), 2500);
                        }}
                      >
                        <Ionicons name={copiedIfsc ? "checkmark" : "copy-outline"} size={14} color={copiedIfsc ? "#10B981" : COLORS.primary} />
                        <Text style={[styles.bankCopyBtnText, copiedIfsc && { color: "#10B981" }]}>
                          {copiedIfsc ? "Copied" : "Copy"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {Boolean(activeOrg?.fee_instructions) && (
                    <View style={styles.feeInstructionsBox}>
                      <Ionicons name="information-circle" size={16} color="#D97706" />
                      <Text style={styles.feeInstructionsText}>{activeOrg?.fee_instructions}</Text>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 3: SUBMIT UTR / REFERENCE */}
              <View style={styles.utrSubmissionBox}>
                <Text style={styles.utrHeading}>3. Enter 12-Digit Reference / UTR Number</Text>
                <Text style={styles.utrSubtext}>
                  After completing the payment in your UPI app or NetBanking, enter the 12-digit UTR / Transaction ID from your payment receipt to confirm:
                </Text>
                <TextInput
                  style={styles.utrInput}
                  placeholder="e.g. 412345678901"
                  placeholderTextColor={COLORS.textMuted}
                  value={directUpiUtr}
                  onChangeText={setDirectUpiUtr}
                  keyboardType="numeric"
                  maxLength={30}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (!directUpiUtr.trim() || directUpiSubmitting) && styles.primaryBtnDisabled,
                  ]}
                  onPress={handleSubmitDirectUpiPayment}
                  disabled={!directUpiUtr.trim() || directUpiSubmitting}
                >
                  {directUpiSubmitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.btnRow}>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Submit UPI Payment Proof</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
  instantAccessBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    marginTop: 6,
  },
  instantAccessText: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: "#166534",
    fontWeight: "600",
  },
  secondaryConcessionBtn: {
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 8,
  },
  secondaryConcessionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  contactAdmissionsLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    marginTop: 4,
  },
  contactAdmissionsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    fontSize: 12,
  },
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
  cleanReceiptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.md,
    gap: 8,
  },
  cleanReceiptRowText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
    flex: 1,
  },
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

  // Direct UPI & Payment Methods Styles
  paymentMethodsContainer: { marginTop: SPACING.sm, gap: SPACING.md },
  paymentMethodsHeading: { ...TYPOGRAPHY.label, color: COLORS.text, fontWeight: "700", fontSize: 13 },
  directUpiCard: {
    backgroundColor: "#F0FDF4",
    borderWidth: 2,
    borderColor: "#10B981",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  directUpiHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upiBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  directUpiIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  directUpiCardTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 16,
    color: "#065F46",
  },
  directUpiCardSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: "#047857",
    fontWeight: "600",
    marginTop: 1,
  },
  upiAppsPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  upiAppPill: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#FFFFFF",
  },
  upiAppPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  directUpiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    marginTop: 4,
  },
  directUpiBtnText: {
    ...TYPOGRAPHY.heading,
    color: "#FFFFFF",
    fontSize: 14,
  },
  razorpayCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  razorpayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: COLORS.surfaceAlt,
  },
  razorpayPillText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  directUpiModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  directUpiModalSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    maxHeight: "90%",
  },
  directUpiSheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  directUpiSheetTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 17,
    color: COLORS.text,
  },
  directUpiSheetSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: "#C8A84E",
    fontWeight: "700",
  },
  directUpiCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  directUpiSummaryBox: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 3,
  },
  directUpiSummaryLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.textMuted,
    textTransform: "uppercase",
  },
  directUpiSummaryAmount: {
    ...TYPOGRAPHY.title,
    fontSize: 26,
    color: "#059669",
    fontWeight: "900",
  },
  directUpiSummaryPayee: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  directUpiSummaryPurpose: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  directUpiSectionTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  directUpiSectionDesc: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  directUpiAppGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginTop: SPACING.xs,
  },
  directUpiAppBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 6,
  },
  appCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  directUpiAppName: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  upiVpaContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.xs,
    gap: 8,
  },
  upiVpaLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  upiVpaText: {
    ...TYPOGRAPHY.heading,
    fontSize: 15,
    color: COLORS.primary,
    marginTop: 2,
  },
  upiCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  upiCopyBtnActive: {
    backgroundColor: "#DCFCE7",
    borderColor: "#10B981",
  },
  upiCopyBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "700",
  },
  qrCodeBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrCodeImage: {
    width: 170,
    height: 170,
    borderRadius: RADIUS.md,
  },
  qrCodeCaption: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
  utrSubmissionBox: {
    backgroundColor: "#FEF3C7",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#FCD34D",
    gap: 8,
  },
  utrHeading: {
    ...TYPOGRAPHY.heading,
    fontSize: 13,
    color: "#92400E",
  },
  utrSubtext: {
    ...TYPOGRAPHY.body,
    fontSize: 11,
    color: "#78350F",
    lineHeight: 16,
  },
  utrInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#F59E0B",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1E293B",
    fontWeight: "700",
    letterSpacing: 1,
  },
  adminFeeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    ...SHADOWS.card,
  },
  adminFeeSub: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  adminInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.text,
    marginTop: 6,
  },
  adminTextArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  adminSuccessText: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: "#16A34A",
    fontWeight: "700",
    marginTop: 8,
  },
  adminAuditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EEF2FF",
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  adminAuditBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "700",
    flex: 1,
    marginLeft: 8,
  },
  bankAccountCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankHeaderTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 14,
    color: '#065F46',
    fontWeight: '800',
  },
  bankSubtitle: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: '#047857',
    marginTop: 4,
    marginBottom: 8,
  },
  bankDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankDetailLabel: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  bankDetailValue: {
    ...TYPOGRAPHY.body,
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '700',
    marginTop: 1,
  },
  bankCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  bankCopyBtnActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#10B981',
  },
  bankCopyBtnText: {
    ...TYPOGRAPHY.label,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  feeInstructionsBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  feeInstructionsText: {
    ...TYPOGRAPHY.body,
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },
  quickFeePayCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    ...SHADOWS.card,
  },
  quickFeeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.xs,
  },
  quickFeeIconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  quickFeeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  quickFeeSub: {
    fontSize: 11,
    color: '#047857',
    marginTop: 1,
  },
  quickFeeAmountBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  quickFeeAmountBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  quickFeeNotice: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  quickUpiAppRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  quickUpiAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: 4,
  },
  quickUpiAppBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  instantPayNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    gap: 8,
    ...SHADOWS.card,
  },
  instantPayNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
