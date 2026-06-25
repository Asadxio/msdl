import React from "react";
import { RefreshControl, RefreshControlProps } from "react-native";
import { COLORS } from "@/constants/theme";

interface ScreenRefreshControlProps extends RefreshControlProps {}

export function ScreenRefreshControl(props: ScreenRefreshControlProps) {
  return (
    <RefreshControl
      colors={[COLORS.primary, COLORS.goldBg]} // Android spinner colors
      tintColor={COLORS.primary} // iOS spinner color
      progressBackgroundColor={COLORS.background} // Android background
      {...props}
    />
  );
}
