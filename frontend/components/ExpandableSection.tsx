import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import type { PropsWithChildren } from "react";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SHADOWS, SPACING } from "@/constants/theme";

const ANIMATION_DURATION_MS = 300;

type ExpandableSectionProps = PropsWithChildren<{
  title: string;
  count?: number;
  countLabel?: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

export function ExpandableSection({
  title,
  count,
  countLabel = "courses",
  expanded,
  onExpandedChange,
  style,
  contentStyle,
  testID,
  children,
}: ExpandableSectionProps) {
  const animation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const [shouldRenderContent, setShouldRenderContent] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setShouldRenderContent(true);
      return;
    }

    Animated.timing(animation, {
      toValue: 0,
      duration: ANIMATION_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setShouldRenderContent(false);
      }
    });
  }, [animation, expanded]);

  useEffect(() => {
    if (!expanded || contentHeight <= 0) return;

    Animated.timing(animation, {
      toValue: 1,
      duration: ANIMATION_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [animation, contentHeight, expanded]);

  const animatedHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, contentHeight],
  });
  const animatedOpacity = animation.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [0, 0, 1],
  });
  const arrowRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={[styles.section, style]} testID={testID}>
      <TouchableOpacity
        activeOpacity={0.86}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
        testID={testID ? `${testID}-header` : undefined}
        onPress={() => onExpandedChange(!expanded)}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {typeof count === "number" ? (
            <Text style={styles.count}>
              {count} {count === 1 ? countLabel.replace(/s$/, "") : countLabel}
            </Text>
          ) : null}
        </View>
        <Animated.View
          style={[styles.iconCircle, { transform: [{ rotate: arrowRotation }] }]}
        >
          <Ionicons name="chevron-down" size={18} color={COLORS.primary} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.collapsible,
          { maxHeight: animatedHeight, opacity: animatedOpacity },
        ]}
        pointerEvents={expanded ? "auto" : "none"}
      >
        {shouldRenderContent ? (
          <View
            style={[styles.contentSizer, contentStyle]}
            onLayout={(event) =>
              setContentHeight(event.nativeEvent.layout.height)
            }
          >
            {children}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  header: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  titleBlock: { flex: 1, gap: 4 },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
  },
  count: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(6, 78, 59, 0.1)",
  },
  collapsible: {
    overflow: "hidden",
  },
  contentSizer: {
    width: "100%",
  },
});
