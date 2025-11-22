"use client";

import { useEffect, useRef } from "react";
import { useDeviceState } from "./use-device-state";
import { useThermostat } from "./store";

/**
 * Hook that syncs both Convex real-time data AND HTTP polling into Zustand store
 * - HTTP polling provides immediate data on page load and acts as fallback
 * - Convex provides real-time updates when WebSocket is connected
 */
export function useSyncConvexToStore() {
  const { devices, userState, isLoading } = useDeviceState();
  const setDevicesFromConvex = useThermostat((s) => s.setDevicesFromConvex);
  const fetchStatus = useThermostat((s) => s.fetchStatus);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync Convex data when available
  useEffect(() => {
    if (!isLoading && devices) {
      console.log('[useSyncConvexToStore] Syncing Convex data:', devices.length, 'devices');
      setDevicesFromConvex(devices, userState);
    }
  }, [devices, userState, isLoading, setDevicesFromConvex]);

  // HTTP polling fallback - runs immediately and every 10 seconds
  useEffect(() => {
    console.log('[useSyncConvexToStore] Starting HTTP polling fallback');

    // Fetch immediately on mount
    fetchStatus().catch((error) => {
      console.error('[useSyncConvexToStore] Initial fetch failed:', error);
    });

    // Poll every 10 seconds
    pollingIntervalRef.current = setInterval(() => {
      fetchStatus().catch((error) => {
        console.error('[useSyncConvexToStore] Polling fetch failed:', error);
      });
    }, 10000);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [fetchStatus]);
}
