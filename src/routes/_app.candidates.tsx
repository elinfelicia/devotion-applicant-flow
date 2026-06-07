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
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Linkedin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Minus,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const Route = createFileRoute("/_app/candidates")({
  head: () => ({ meta: [{ title: "Candidates — Devotion ATS" }] }),
  component: CandidatesPage,
});

type Assessment = {
  summary: string;
  strengths: string[];
  concerns: string[];
  score: number;
  recommendation: "Proceed" | "Maybe" | "Pass";
};

type Candidate = {
  id: string;
  name: string;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
  job_id: string;
  stage: string;
  customer_id: string;
  ai_assessment: Assessment | null;
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

  const onAssessmentUpdate = (id: string, assessment: Assessment) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ai_assessment: assessment } : c)),
    );
  };

  const onCandidateUpdate = (updated: Candidate) => {
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              candidates={filtered.filter((c) => c.stage === stage)}
              jobsById={jobsById}
              jobs={jobs}
              onAssessmentUpdate={onAssessmentUpdate}
              onCandidateUpdate={onCandidateUpdate}
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
  jobs,
  onAssessmentUpdate,
  onCandidateUpdate,
}: {
  stage: Stage;
  candidates: Candidate[];
  jobsById: Record<string, string>;
  jobs: Job[];
  onAssessmentUpdate: (id: string, assessment: Assessment) => void;
  onCandidateUpdate: (updated: Candidate) => void;
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
          <Card
            key={c.id}
            candidate={c}
            jobTitle={jobsById[c.job_id]}
            jobs={jobs}
            onAssessmentUpdate={onAssessmentUpdate}
            onCandidateUpdate={onCandidateUpdate}
          />
        ))}
      </div>
    </div>
  );
}

function recommendationStyle(rec: Assessment["recommendation"]) {
  if (rec === "Proceed") return "bg-green-100 text-green-800 border-green-200";
  if (rec === "Maybe") return "bg-yellow-100 text-yellow-800 border-yellow-200";
  return "bg-red-100 text-red-800 border-red-200";
}

function recommendationIcon(rec: Assessment["recommendation"]) {
  if (rec === "Proceed") return <ThumbsUp className="size-3" />;
  if (rec === "Maybe") return <Minus className="size-3" />;
  return <ThumbsDown className="size-3" />;
}

function scoreColor(score: number) {
  if (score >= 7) return "text-green-700";
  if (score >= 5) return "text-yellow-700";
  return "text-red-700";
}

function Card({
  candidate,
  jobTitle,
  jobs,
  onAssessmentUpdate,
  onCandidateUpdate,
}: {
  candidate: Candidate;
  jobTitle?: string;
  jobs: Job[];
  onAssessmentUpdate: (id: string, assessment: Assessment) => void;
  onCandidateUpdate: (updated: Candidate) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: candidate.id,
  });
  const [assessing, setAssessing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const runAssessment = async (e: React.PointerEvent) => {
    e.stopPropagation();
    setAssessing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const res = await fetch(`${SUPABASE_URL}/functions/v1/assess-candidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidate_id: candidate.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Assessment failed");
        return;
      }
      onAssessmentUpdate(candidate.id, json.assessment as Assessment);
      setDialogOpen(true);
    } catch {
      toast.error("Assessment failed — check your network connection");
    } finally {
      setAssessing(false);
    }
  };

  const openExisting = (e: React.PointerEvent) => {
    e.stopPropagation();
    setDialogOpen(true);
  };

  const assessment = candidate.ai_assessment;

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`bg-card border rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing select-none ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{candidate.name}</div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{jobTitle ?? "—"}</div>
          </div>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              setEditOpen(true);
            }}
            title="Edit candidate"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          >
            <Pencil className="size-3" />
          </button>
        </div>
        {assessment && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 font-medium ${recommendationStyle(assessment.recommendation)}`}
            >
              {recommendationIcon(assessment.recommendation)}
              {assessment.recommendation}
            </span>
            <span className={`text-[10px] font-semibold ${scoreColor(assessment.score)}`}>
              {assessment.score}/10
            </span>
          </div>
        )}
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
            onPointerDown={assessment ? openExisting : runAssessment}
            disabled={assessing}
            title={assessment ? "View AI assessment" : "Assess with AI"}
            className={`ml-auto inline-flex items-center gap-1 text-[10px] border rounded px-1.5 py-0.5 transition-colors ${
              assessing
                ? "text-muted-foreground opacity-60 cursor-wait"
                : assessment
                  ? "text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {assessing ? (
              <RefreshCw className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {assessing ? "Assessing…" : assessment ? "View assessment" : "Assess CV"}
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-600" />
              AI Assessment — {candidate.name}
            </DialogTitle>
            <DialogDescription>
              AI-generated assessment based on the candidate's CV and job requirements.
            </DialogDescription>
          </DialogHeader>
          {assessment && <AssessmentView assessment={assessment} />}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" disabled={assessing} onPointerDown={runAssessment}>
              {assessing ? (
                <>
                  <RefreshCw className="size-3 mr-1 animate-spin" /> Re-assessing…
                </>
              ) : (
                <>
                  <RefreshCw className="size-3 mr-1" /> Re-assess
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <CandidateDialog
          jobs={jobs}
          customerId={candidate.customer_id}
          candidate={candidate}
          onSaved={(updated) => {
            onCandidateUpdate(updated);
            setEditOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

function AssessmentView({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium border rounded-full px-3 py-1 ${recommendationStyle(assessment.recommendation)}`}
        >
          {recommendationIcon(assessment.recommendation)}
          {assessment.recommendation}
        </span>
        <span className={`text-lg font-bold ${scoreColor(assessment.score)}`}>
          {assessment.score}
          <span className="text-xs font-normal text-muted-foreground">/10</span>
        </span>
      </div>

      <p className="text-muted-foreground leading-relaxed">{assessment.summary}</p>

      {assessment.strengths.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Strengths
          </div>
          <ul className="space-y-1">
            {assessment.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-green-500 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {assessment.concerns.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            Concerns
          </div>
          <ul className="space-y-1">
            {assessment.concerns.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-yellow-500 shrink-0" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CandidateDialog({
  jobs,
  customerId,
  candidate,
  onSaved,
}: {
  jobs: Job[];
  customerId: string;
  candidate?: Candidate;
  onSaved: (updated: Candidate) => void;
}) {
  const [name, setName] = useState(candidate?.name ?? "");
  const [email, setEmail] = useState(candidate?.email ?? "");
  const [linkedin, setLinkedin] = useState(candidate?.linkedin_url ?? "");
  const [notes, setNotes] = useState(candidate?.notes ?? "");
  const [jobId, setJobId] = useState<string>(candidate?.job_id ?? jobs[0]?.id ?? "");
  const [stage, setStage] = useState<Stage>((candidate?.stage as Stage) ?? "Ny");
  const [saving, setSaving] = useState(false);

  const isEdit = !!candidate;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return toast.error("Select a job");
    setSaving(true);
    if (isEdit) {
      const { data, error } = await supabase
        .from("candidates")
        .update({
          name,
          email: email || null,
          linkedin_url: linkedin || null,
          notes: notes || null,
          job_id: jobId,
          stage,
        })
        .eq("id", candidate.id)
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      onSaved(data as Candidate);
    } else {
      const { data, error } = await supabase
        .from("candidates")
        .insert({
          name,
          email: email || null,
          linkedin_url: linkedin || null,
          notes: notes || null,
          job_id: jobId,
          stage,
          customer_id: customerId,
        })
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message);
      setName("");
      setEmail("");
      setLinkedin("");
      setNotes("");
      setStage("Ny");
      onSaved(data as Candidate);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit candidate" : "Add candidate"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the candidate's details. Changes to CV / Notes will be used in the next AI assessment."
            : "Fill in the candidate's details. Paste their CV into the notes field for AI assessment."}
        </DialogDescription>
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
        <div className="space-y-1.5">
          <Label htmlFor="cnotes">CV / Notes</Label>
          <Textarea
            id="cnotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Paste CV text, key experience, or any notes for the AI to assess…"
            rows={4}
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add candidate"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
