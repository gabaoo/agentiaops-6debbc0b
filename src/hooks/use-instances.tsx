import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type Instance = {
  id: string;
  user_id: string;
  instance_name: string;
  whatsapp_number: string;
  evolution_instance_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type InstancesCtx = {
  instances: Instance[];
  current: Instance | null;
  currentId: string | null;
  setCurrentId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<unknown>;
};

const Ctx = createContext<InstancesCtx | null>(null);
const STORAGE_KEY = "current_instance_id";

export function InstancesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentId, setCurrentIdState] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["instances", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instances")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as Instance[]) ?? [];
    },
    enabled: !!user,
  });

  const instances = useMemo(() => data ?? [], [data]);

  // Initialize current from localStorage or first instance
  useEffect(() => {
    if (instances.length === 0) {
      setCurrentIdState(null);
      return;
    }
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const valid = stored && instances.some((i) => i.id === stored) ? stored : instances[0].id;
    setCurrentIdState(valid);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, valid);
  }, [instances]);

  const setCurrentId = (id: string) => {
    setCurrentIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, id);
  };

  const current = instances.find((i) => i.id === currentId) ?? null;

  return (
    <Ctx.Provider value={{ instances, current, currentId, setCurrentId, loading: isLoading, refetch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useInstances() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useInstances must be used within InstancesProvider");
  return c;
}

export function useCurrentInstance() {
  const { current, currentId } = useInstances();
  return { instance: current, instanceId: currentId };
}