import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, STAGES, type Stage } from "@/lib/auth-context";
import { NoCustomerSelected } from "@/components/AppShell";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Linkedin, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Devotion ATS" }] }),
  component: CandidatesPage,
});

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  job_id: string;
  stage: string;
  customer_id: string;
};

type Job = { id: string; title: string };

function CandidatesPage() {
  const { currentCustomerId } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filterJob, setFilterJob] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = async (customerId: string) => {
    const [{ data: cands }, { data: js }] = await Promise.all([
      supabase
        .from("candidates")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
      supabase.from("jobs").select("id, title").eq("customer_id", customerId).order("title"),
    ]);
    setCandidates((cands as Candidate[]) ?? []);
    setJobs((js as Job[]) ?? []);
  };

  useEffect(() => {
    if (!currentCustomerId) return;
    setFilterJob("all");
    setSearch("");
    load(currentCustomerId);
  }, [currentCustomerId]);

  const jobsById = useMemo(() => Object.fromEntries(jobs.map((j) => [j.id, j.title])), [jobs]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (filterJob !== "all" && c.job_id !== filterJob) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [candidates, filterJob, search]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const id = e.active.id as string;
    const newStage = e.over?.id as Stage | undefined;
    if (!newStage) return;
    const cand = candidates.find((c) => c.id === id);
    if (!cand || cand.stage === newStage) return;
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, stage: newStage } : c)));
    const { error } = await supabase.from("candidates").update({ stage: newStage }).eq("id", id);
    if (error) {
      toast.error(error.message);
      setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, stage: cand.stage } : c)));
    }
  };

  if (!currentCustomerId) return <NoCustomerSelected />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
          <p className="text-sm text-muted-foreground">Drag a card to update its stage.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={jobs.length === 0}>
              <Plus className="size-4 mr-1" /> Add candidate
            </Button>
          </DialogTrigger>
          <CandidateDialog
            jobs={jobs}
            customerId={currentCustomerId}
            onSaved={() => {
              setDialogOpen(false);
              if (currentCustomerId) load(currentCustomerId);
            }}
          />
        </Dialog>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterJob} onValueChange={setFilterJob}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All jobs</SelectItem>
            {jobs.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[240px]"
        />
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              candidates={filtered.filter((c) => c.stage === stage)}
              jobsById={jobsById}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  candidates,
  jobsById,
}: {
  stage: Stage;
  candidates: Candidate[];
  jobsById: Record<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/30 p-2 min-h-[300px] flex flex-col gap-2 transition-colors ${
        isOver ? "bg-accent border-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between px-1.5 py-1">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {stage}
        </h3>
        <span className="text-xs text-muted-foreground">{candidates.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.map((c) => (
          <Card key={c.id} candidate={c} jobTitle={jobsById[c.job_id]} />
        ))}
      </div>
    </div>
  );
}

function Card({ candidate, jobTitle }: { candidate: Candidate; jobTitle?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-card border rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="font-medium text-sm truncate">{candidate.name}</div>
      <div className="text-xs text-muted-foreground truncate mt-0.5">{jobTitle ?? "—"}</div>
      <div className="flex items-center gap-2 mt-2">
        {candidate.linkedin_url && (
          <a
            href={candidate.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title="View LinkedIn profile"
            className="text-muted-foreground hover:text-foreground"
          >
            <Linkedin className="size-3.5" />
          </a>
        )}
        <button
          type="button"
          disabled
          title="Coming soon"
          onPointerDown={(e) => e.stopPropagation()}
          className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 opacity-60 cursor-not-allowed"
        >
          <Sparkles className="size-3" />
          Assess CV
        </button>
      </div>
    </div>
  );
}

function CandidateDialog({
  jobs,
  customerId,
  onSaved,
}: {
  jobs: Job[];
  customerId: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [jobId, setJobId] = useState<string>(jobs[0]?.id ?? "");
  const [stage, setStage] = useState<Stage>("Ny");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return toast.error("Select a job");
    setSaving(true);
    const { error } = await supabase.from("candidates").insert({
      name,
      email: email || null,
      linkedin_url: linkedin || null,
      job_id: jobId,
      stage,
      customer_id: customerId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setName("");
    setEmail("");
    setLinkedin("");
    setStage("Ny");
    onSaved();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add candidate</DialogTitle>
      </DialogHeader>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cname">Name</Label>
          <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cemail">Email</Label>
          <Input
            id="cemail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clinkedin">LinkedIn URL</Label>
          <Input
            id="clinkedin"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="https://linkedin.com/in/…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Job</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Add candidate"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
