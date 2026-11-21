import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setOnline } from '../../services/network';

interface ConnectivityValue {
  online: boolean;
  /** Hanya untuk demo/QA: memaksa mode offline tanpa mematikan jaringan perangkat. */
  simulateOffline: boolean;
  setSimulateOffline(v: boolean): void;
}

const ConnectivityContext = createContext<ConnectivityValue>({
  online: true,
  simulateOffline: false,
  setSimulateOffline: () => undefined,
});

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [deviceOnline, setDeviceOnline] = useState(true);
  const [simulateOffline, setSimulateOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      // isInternetReachable bisa null saat belum diketahui → anggap online.
      setDeviceOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return unsub;
  }, []);

  const online = deviceOnline && !simulateOffline;

  useEffect(() => {
    setOnline(online);
  }, [online]);

  const value = useMemo(() => ({ online, simulateOffline, setSimulateOffline }), [online, simulateOffline]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity() {
  return useContext(ConnectivityContext);
}
