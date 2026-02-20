"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Save, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProjectStore } from "@/lib/stores/projectStore";
import { getClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const project = useProjectStore((s) => s.project);
  const setProject = useProjectStore((s) => s.setProject);

  const [name, setName] = useState(project?.name ?? "");
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const supabase = getClient();
    const { data, error } = await supabase
      .from("projects")
      .update({ name: name.trim(), summary: summary.trim(), updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select()
      .single();

    if (!error && data) {
      setProject(data);
      toast.success("Project updated");
    } else {
      toast.error("Failed to update project");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    const supabase = getClient();
    await supabase.from("projects").delete().eq("id", projectId);
    toast.success("Project deleted");
    router.push("/");
  };

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href={`/project/${projectId}`}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to project
      </Link>

      <h2 className="text-xl font-bold text-text-primary mb-6">Project Settings</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Project Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-boss-card border-boss-border text-text-primary"
          />
        </div>

        <div>
          <label className="text-sm text-text-secondary mb-1.5 block">Summary</label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            className="bg-boss-card border-boss-border text-text-primary resize-none"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gold hover:bg-gold/90 text-boss-bg font-semibold gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            className="border-agent-rose/30 text-agent-rose hover:bg-agent-rose/10 gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Project
          </Button>
        </div>
      </div>
    </div>
  );
}
