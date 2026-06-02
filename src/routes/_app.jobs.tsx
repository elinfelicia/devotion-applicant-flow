import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { NoCustomerSelected } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/jobs")({
  head: () => ({ meta: [{ title: "Jobs — Devotion ATS" }] }),
  component: JobsPage,
});

type Job = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "closed";
  created_at: string;
  customer_id: string;
};

function JobsPage() {
  const { currentCustomerId } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async () => {
    if (!currentCustomerId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setJobs((data as Job[]) ?? []);
  };

  useEffect(() => {
    load();
  }, [currentCustomerId]);

  const onDelete = async (id: string) => {
    if (!confirm("Delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  if (!currentCustomerId) return <NoCustomerSelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Open roles for this customer.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="size-4 mr-1" /> New job
            </Button>
          </DialogTrigger>
          <JobDialog
            job={editing}
            customerId={currentCustomerId}
            onSaved={() => {
              setDialogOpen(false);
              setEditing(null);
              load();
            }}
          />
        </Dialog>
      </div>

      <div className="border rounded-lg bg-card divide-y">
        {loading && (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        )}
        {!loading && jobs.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No jobs yet.
          </div>
        )}
        {jobs.map((j) => (
          <div
            key={j.id}
            className="p-4 flex items-start gap-4 hover:bg-muted/40"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium truncate">{j.title}</h3>
                <Badge variant={j.status === "open" ? "default" : "secondary"}>
                  {j.status}
                </Badge>
              </div>
              {j.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {j.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditing(j);
                  setDialogOpen(true);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onDelete(j.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobDialog({
  job,
  customerId,
  onSaved,
}: {
  job: Job | null;
  customerId: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(job?.title ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [status, setStatus] = useState<"open" | "closed">(job?.status ?? "open");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(job?.title ?? "");
    setDescription(job?.description ?? "");
    setStatus(job?.status ?? "open");
  }, [job]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (job) {
      const { error } = await supabase
        .from("jobs")
        .update({ title, description, status })
        .eq("id", job.id);
      setSaving(false);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("jobs")
        .insert({ title, description, status, customer_id: customerId });
      setSaving(false);
      if (error) return toast.error(error.message);
    }
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{job ? "Edit job" : "New job"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as "open" | "closed")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
