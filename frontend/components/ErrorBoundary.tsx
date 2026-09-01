import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING } from '@/constants/theme';
import { reportTelemetryError } from '@/lib/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught crash:', error, errorInfo);
    void reportTelemetryError({
      category: 'crash',
      message: error.message || 'Unhandled UI Crash',
      stack: errorInfo.componentStack || error.stack,
      severityOverride: 'critical',
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="refresh-circle-outline" size={48} color="#C8A84E" />
            </View>

            <Text style={styles.arabicHeading}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
            <Text style={styles.title}>کچھ خرابی پیش آئی ہے</Text>
            <Text style={styles.subtitle}>
              ہم نے خودکار طور پر اس تکنیکی مسئلے کی رپورٹ ایڈمن کو ارسال کر دی ہے۔ برائے مہربانی دوبارہ کوشش فرمائیں۔
            </Text>

            <TouchableOpacity style={styles.reloadBtn} onPress={this.handleReload} activeOpacity={0.8}>
              <Ionicons name="reload" size={18} color="#FFFFFF" />
              <Text style={styles.reloadBtnText}>دوبارہ لوڈ کریں (Reload App)</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 380,
    borderWidth: 2,
    borderColor: '#C8A84E',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#003D2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arabicHeading: {
    fontSize: 14,
    color: '#005F46',
    fontWeight: '700',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginVertical: 4,
  },
  reloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005F46',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.lg,
    gap: 8,
    width: '100%',
    marginTop: 6,
  },
  reloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
