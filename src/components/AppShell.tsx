import { Link, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Customer = { id: string; name: string };

export function AppShell() {
  const { profile, currentCustomerId, setCurrentCustomerId, signOut } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    if (profile?.role !== "admin") return;
    supabase
      .from("customers")
      .select("id, name")
      .order("name")
      .then(({ data }) => setCustomers((data as Customer[]) ?? []));
  }, [profile?.role]);

  const onSignOut = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors data-[status=active]:text-foreground data-[status=active]:font-medium"
      activeOptions={{ exact: false }}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
          <Link to="/candidates" className="font-semibold tracking-tight">
            Devotion ATS
          </Link>
          <nav className="hidden sm:flex items-center gap-5">
            {navLink("/candidates", "Candidates")}
            {navLink("/jobs", "Jobs")}
            {profile?.role === "admin" && navLink("/customers", "Customers")}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {profile?.role === "admin" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden md:inline">
                  Acting as
                </span>
                <Select
                  value={currentCustomerId ?? ""}
                  onValueChange={(v) => setCurrentCustomerId(v || null)}
                >
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue placeholder="Select customer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="text-sm text-muted-foreground hidden md:block">
              {profile?.email}
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function NoCustomerSelected() {
  return (
    <div className="border rounded-lg p-10 text-center bg-card">
      <h2 className="font-medium">Select a customer to continue</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Use the “Acting as” picker in the top bar to choose which customer
        context to work in.
      </p>
    </div>
  );
}
