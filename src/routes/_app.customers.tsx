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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ShieldPlus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL as string;

export const Route = createFileRoute("/_app/customers")({
  head: () => ({ meta: [{ title: "Customers — Devotion ATS" }] }),
  component: CustomersPage,
});

type Customer = { id: string; name: string; created_at: string };

function CustomersPage() {
  const { profile, currentCustomerId, setCurrentCustomerId } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accountTarget, setAccountTarget] = useState<Customer | null>(null);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  type AccountProfile = { id: string; full_name: string | null; email: string | null };
  const [manageTarget, setManageTarget] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);

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

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (currentCustomerId === deleteTarget.id) setCurrentCustomerId(null);
    setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  };

  const onCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountTarget) return;
    setCreatingAccount(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: accountEmail,
        password: accountPassword,
        full_name: accountName || null,
        role: "customer",
        customer_id: accountTarget.id,
      }),
    });
    setCreatingAccount(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to create account");
      return;
    }
    toast.success(`Account created for ${accountEmail}`);
    setAccountTarget(null);
    setAccountEmail("");
    setAccountPassword("");
    setAccountName("");
  };

  const loadAccounts = async (customerId: string) => {
    setLoadingAccounts(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("customer_id", customerId)
      .eq("role", "customer")
      .order("full_name");
    setAccounts((data as AccountProfile[]) ?? []);
    setLoadingAccounts(false);
  };

  const onManageAccounts = (customer: Customer) => {
    setManageTarget(customer);
    loadAccounts(customer.id);
  };

  const onDeleteAccount = async (userId: string) => {
    if (!confirm("Remove this account? The user will no longer be able to log in.")) return;
    setDeletingAccountId(userId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: userId }),
    });
    setDeletingAccountId(null);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to delete account");
      return;
    }
    toast.success("Account removed.");
    setAccounts((prev) => prev.filter((a) => a.id !== userId));
  };

  const onCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        full_name: adminName || null,
        role: "admin",
      }),
    });
    setCreatingAdmin(false);
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Failed to create admin");
      return;
    }
    toast.success(`Admin account created for ${adminEmail}`);
    setAdminDialogOpen(false);
    setAdminEmail("");
    setAdminPassword("");
    setAdminName("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Admin-only. Manage tenant customers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setAdminDialogOpen(true)}>
            <ShieldPlus className="size-4 mr-1" /> New admin
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" /> New customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
              <DialogDescription>Enter a name to create a new customer workspace.</DialogDescription>
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
      </div>
      <div className="border rounded-lg bg-card divide-y">
        {customers.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No customers yet.
          </div>
        )}
        {customers.map((c) => (
          <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground font-mono truncate">
                {c.id}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onManageAccounts(c)}
              >
                <Users className="size-4 mr-1" />
                Accounts
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAccountTarget(c)}
              >
                <UserPlus className="size-4 mr-1" />
                Add account
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => setDeleteTarget(c)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create account dialog */}
      <Dialog
        open={!!accountTarget}
        onOpenChange={(o) => !o && setAccountTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Create account for {accountTarget?.name}
            </DialogTitle>
            <DialogDescription>Set up login credentials for this customer.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateAccount} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">Full name</Label>
              <Input
                id="acc-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-email">Email</Label>
              <Input
                id="acc-email"
                type="email"
                value={accountEmail}
                onChange={(e) => setAccountEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-pw">Password</Label>
              <Input
                id="acc-pw"
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creatingAccount}>
                {creatingAccount ? "Creating…" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create admin dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New admin account</DialogTitle>
            <DialogDescription>Create a new administrator account with full access.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreateAdmin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-name">Full name</Label>
              <Input
                id="admin-name"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pw">Password</Label>
              <Input
                id="admin-pw"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creatingAdmin}>
                {creatingAdmin ? "Creating…" : "Create admin"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage accounts dialog */}
      <Dialog open={!!manageTarget} onOpenChange={(o) => !o && setManageTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accounts — {manageTarget?.name}</DialogTitle>
            <DialogDescription>
              All customer accounts linked to this workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 min-h-[60px]">
            {loadingAccounts && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {!loadingAccounts && accounts.length === 0 && (
              <p className="text-sm text-muted-foreground">No accounts yet.</p>
            )}
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded-md border bg-muted/30">
                <div className="min-w-0">
                  {a.full_name && (
                    <div className="text-sm font-medium truncate">{a.full_name}</div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive shrink-0"
                  disabled={deletingAccountId === a.id}
                  onClick={() => onDeleteAccount(a.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setManageTarget(null);
                setAccountTarget(manageTarget);
              }}
            >
              <UserPlus className="size-4 mr-1" /> Add account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the customer and all associated jobs
              and candidates. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
