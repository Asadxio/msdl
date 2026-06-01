import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

  useEffect(() => {
    setExpanded(initiallyExpanded);
  }, [initiallyExpanded]);

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    onExpandedChange(nextExpanded);
  };

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        activeOpacity={0.86}
        style={styles.header}
        onPress={toggleExpanded}
        testID={`${testID}-toggle`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.count}>
            {count} {count === 1 ? "course" : "courses"}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={22} color={COLORS.primary} />
      </TouchableOpacity>
      {expanded ? <View style={styles.content}>{children}</View> : null}
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
  content: { paddingBottom: SPACING.md },
});
