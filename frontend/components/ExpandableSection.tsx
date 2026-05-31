import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS, SPACING } from "@/constants/theme";

type ExpandableSectionProps = {
  title: string;
  count: number;
  initiallyExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: React.ReactNode;
  testID?: string;
};

export function ExpandableSection({
  title,
  count,
  initiallyExpanded,
  onExpandedChange,
  children,
  testID = "expandable-section",
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [shouldRenderContent, setShouldRenderContent] = useState(initiallyExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const slideAnim = useRef(new Animated.Value(initiallyExpanded ? 1 : 0)).current;

  const runSlideAnimation = (nextExpanded: boolean) => {
    Animated.timing(slideAnim, {
      toValue: nextExpanded ? 1 : 0,
      duration: 300,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !nextExpanded) {
        setShouldRenderContent(false);
      }
    });
  };

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    onExpandedChange(nextExpanded);
    if (nextExpanded) {
      setShouldRenderContent(true);
      if (contentHeight > 0) {
        runSlideAnimation(true);
      }
      return;
    }
    runSlideAnimation(false);
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    const measuredHeight = event.nativeEvent.layout.height;
    setContentHeight(measuredHeight);
    if (expanded && measuredHeight > 0) {
      runSlideAnimation(true);
    }
  };

  const animatedHeight = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });
  const arrowRotation = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        activeOpacity={0.86}
        style={styles.header}
        onPress={toggleExpanded}
        testID={`${testID}-toggle`}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.count}>
            {count} {count === 1 ? "course" : "courses"}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: arrowRotation }] }}>
          <Ionicons name="chevron-down" size={22} color={COLORS.primary} />
        </Animated.View>
      </TouchableOpacity>
      <Animated.View
        style={[styles.body, { height: animatedHeight, opacity: slideAnim }]}
      >
        {shouldRenderContent ? (
          <View style={styles.content} onLayout={handleContentLayout}>
            {children}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  titleBlock: { flex: 1, gap: 2 },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.textMain },
  count: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  body: { overflow: "hidden" },
  content: { paddingBottom: SPACING.md },
});
