import { useState, useCallback } from "react";
import { Alert, ToastAndroid, Platform } from "react-native";

export function usePullToRefresh(refreshAction?: () => Promise<any> | void) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    try {
      if (refreshAction) {
        await refreshAction();
      } else {
        // If no action is provided (e.g., realtime screen with no specific reload),
        // we resolve immediately. We don't use artificial delays as per requirements.
      }
    } catch (error) {
      console.error("Refresh failed:", error);
      if (Platform.OS === "android") {
        ToastAndroid.show(
          "Unable to refresh. Please check your internet connection.",
          ToastAndroid.SHORT
        );
      } else {
        Alert.alert(
          "Refresh Failed",
          "Unable to refresh. Please check your internet connection."
        );
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshAction, refreshing]);

  return { refreshing, onRefresh };
}
