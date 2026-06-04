import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getEnvStatus, type EnvStatus } from "../env";
import { createNebulaClient, type NebulaSupabaseClient } from "./client";
import { runConnectionSmoke } from "./queries";
import type { ConnectionSmoke } from "./types";

type SupabaseContextValue = {
  envStatus: EnvStatus;
  client: NebulaSupabaseClient | null;
  smoke: ConnectionSmoke | null;
  isChecking: boolean;
  error: string | null;
  refreshSmoke: () => Promise<void>;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const envStatus = useMemo(() => getEnvStatus(), []);
  const client = useMemo(() => {
    if (
      !envStatus.isSupabaseReady ||
      !envStatus.env.supabaseUrl ||
      !envStatus.env.supabaseAnonKey
    ) {
      return null;
    }

    return createNebulaClient(envStatus.env.supabaseUrl, envStatus.env.supabaseAnonKey);
  }, [envStatus]);

  const [smoke, setSmoke] = useState<ConnectionSmoke | null>(null);
  const [isChecking, setIsChecking] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);

  const refreshSmoke = async () => {
    if (!client) {
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const result = await runConnectionSmoke(client);
      setSmoke(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Supabase check failed.");
      setSmoke(null);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    void refreshSmoke();
  }, [client]);

  const value = useMemo(
    () => ({
      envStatus,
      client,
      smoke,
      isChecking,
      error,
      refreshSmoke,
    }),
    [envStatus, client, smoke, isChecking, error],
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabase must be used inside SupabaseProvider.");
  }

  return context;
}
