import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Devotion ATS" }] }),
  component: CustomersPage,
});

type Customer = { id: string; name: string; created_at: string };

function CustomersPage() {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setCustomers((data as Customer[]) ?? []);
  };

  useEffect(() => {
    if (profile?.role === "admin") load();
  }, [profile?.role]);

  if (profile && profile.role !== "admin")
    return <Navigate to="/candidates" replace />;

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("customers").insert({ name });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    setOpen(false);
    load();
  };

  const onCreateAccount = (customerId: string) => {
    toast.message(
      "Stub: this will call the `create-account` edge function (service role) to create a user for this customer.",
      { description: `customer_id: ${customerId}` },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Admin-only. Manage tenant customers.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> New customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name">Name</Label>
                <Input
                  id="customer-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg bg-card divide-y">
        {customers.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No customers yet.
          </div>
        )}
        {customers.map((c) => (
          <div key={c.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {c.id}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateAccount(c.id)}
            >
              <UserPlus className="size-4 mr-1" />
              Create account
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
