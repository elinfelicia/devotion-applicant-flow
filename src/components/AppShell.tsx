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
import { Menu, X } from "lucide-react";

type Customer = { id: string; name: string };

export function AppShell() {
  const { profile, currentCustomerId, setCurrentCustomerId, signOut } = useAuth();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const navLink = (to: string, label: string, onClick?: () => void) => (
    <Link
      to={to}
      onClick={onClick}
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

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-5">
            {navLink("/candidates", "Candidates")}
            {navLink("/jobs", "Jobs")}
            {profile?.role === "admin" && navLink("/customers", "Customers")}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {profile?.role === "admin" && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden md:inline">
                  Acting as
                </span>
                <Select
                  value={currentCustomerId ?? ""}
                  onValueChange={(v) => setCurrentCustomerId(v || null)}
                >
                  <SelectTrigger className="h-8 w-[160px]">
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
            <Button variant="ghost" size="sm" onClick={onSignOut} className="hidden sm:flex">
              Sign out
            </Button>

            {/* Mobile burger */}
            <button
              className="sm:hidden p-1.5 rounded-md hover:bg-muted transition-colors"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="sm:hidden border-t bg-card px-4 py-4 flex flex-col gap-4">
            <nav className="flex flex-col gap-3">
              {navLink("/candidates", "Candidates", () => setMobileOpen(false))}
              {navLink("/jobs", "Jobs", () => setMobileOpen(false))}
              {profile?.role === "admin" &&
                navLink("/customers", "Customers", () => setMobileOpen(false))}
            </nav>
            {profile?.role === "admin" && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Acting as</span>
                <Select
                  value={currentCustomerId ?? ""}
                  onValueChange={(v) => {
                    setCurrentCustomerId(v || null);
                    setMobileOpen(false);
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
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
            {profile?.email && (
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            )}
            <Button variant="outline" size="sm" onClick={onSignOut} className="w-full">
              Sign out
            </Button>
          </div>
        )}
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
