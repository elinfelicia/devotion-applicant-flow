import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  role: "admin" | "customer";
  customer_id: string | null;
  full_name: string | null;
  email: string | null;
};

type AuthCtx = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Customer the app is currently operating in (admin can switch). */
  currentCustomerId: string | null;
  setCurrentCustomerId: (id: string | null) => void;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

const STORAGE_KEY = "devotion.acting-customer-id";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentCustomerId, _setCurrentCustomerId] = useState<string | null>(
    null,
  );

  const setCurrentCustomerId = (id: string | null) => {
    _setCurrentCustomerId(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) {
        setProfile(null);
        _setCurrentCustomerId(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, customer_id, full_name, email")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setProfile(null);
      } else {
        const p = data as Profile;
        setProfile(p);
        if (p.role === "customer") {
          _setCurrentCustomerId(p.customer_id);
        } else {
          const saved =
            typeof window !== "undefined"
              ? localStorage.getItem(STORAGE_KEY)
              : null;
          _setCurrentCustomerId(saved);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        currentCustomerId,
        setCurrentCustomerId,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}

export const STAGES = [
  "Ny",
  "Screening",
  "Intervju",
  "Erbjudande",
  "Anställd",
  "Avslag",
] as const;
export type Stage = (typeof STAGES)[number];
