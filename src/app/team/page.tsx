"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Crown, Users, Loader2, UserPlus, Mail, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getCurrentUser, setCurrentUser } from "@/lib/collaboration/user";

interface TeamMember {
  id: string;
  team_id: string;
  user_email: string;
  display_name: string | null;
  role: string;
  is_online: boolean;
  last_seen_at: string;
  joined_at: string;
}

interface PendingInvite {
  id: string;
  user_email: string;
  display_name: string | null;
  role: string;
  invited_by?: string;
  joined_at: string;
}

interface Team {
  id: string;
  name: string;
  owner_email: string;
  max_members: number;
  plan: string;
}

interface SharedProject {
  id: string;
  name: string;
  updated_at: string;
  collaborators: { user_email: string; display_name: string | null; permission: string }[];
}

export default function TeamPage() {
  const { userEmail, userName } = getCurrentUser();
  const [email, setEmail] = useState(userEmail);
  const [displayName, setDisplayName] = useState(userName);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [sharedProjects, setSharedProjects] = useState<SharedProject[]>([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingTeam, setSavingTeam] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!email.trim()) {
      setTeam(null);
      setMembers([]);
      setPendingInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/team?userEmail=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setTeam(data.team);
        setMembers(data.members ?? []);
        setPendingInvites(data.pendingInvites ?? []);
        if (data.team) setTeamName(data.team.name);
      } else {
        setTeam(null);
        setMembers([]);
        setPendingInvites([]);
      }
    } catch {
      setTeam(null);
      setMembers([]);
      setPendingInvites([]);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const fetchSharedProjects = useCallback(async () => {
    if (!email.trim()) return;
    try {
      const res = await fetch(`/api/team/projects?userEmail=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (res.ok && data.projects) setSharedProjects(data.projects);
      else setSharedProjects([]);
    } catch {
      setSharedProjects([]);
    }
  }, [email]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  useEffect(() => {
    fetchSharedProjects();
  }, [fetchSharedProjects]);

  const handleCreateTeam = async () => {
    if (!email.trim() || !teamName.trim() || savingTeam) return;
    setSavingTeam(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim(), ownerEmail: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setTeam(data.team);
        setMembers(data.team ? [{ team_id: data.team.id, user_email: email.trim(), display_name: displayName || email.split("@")[0], role: "owner", is_online: false, last_seen_at: "", joined_at: new Date().toISOString(), id: "" }] : []);
        setPendingInvites([]);
        toast.success("Team created");
      } else {
        toast.error(data.error ?? "Failed to create team");
      }
    } catch (e) {
      toast.error("Failed to create team");
    } finally {
      setSavingTeam(false);
    }
  };

  const handleSaveTeamName = async () => {
    if (!team || !email.trim() || team.owner_email !== email.trim() || savingTeam) return;
    setSavingTeam(true);
    try {
      const res = await fetch("/api/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, name: teamName.trim(), userEmail: email.trim() }),
      });
      if (res.ok) {
        setTeam((t) => (t ? { ...t, name: teamName.trim() } : null));
        toast.success("Team name saved");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSavingTeam(false);
    }
  };

  const handleInvite = async () => {
    if (!team || !inviteEmail.trim() || sendingInvite) return;
    setSendingInvite(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          inviterEmail: email.trim(),
          inviteeEmail: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setInviteEmail("");
        fetchTeam();
        toast.success("Invite sent");
      } else {
        toast.error(data.error ?? "Failed to send invite");
      }
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCancelInvite = async (memberEmail: string) => {
    if (!team || !email.trim()) return;
    try {
      const res = await fetch("/api/team/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          userEmail: memberEmail,
          removedByEmail: email.trim(),
        }),
      });
      if (res.ok) {
        fetchTeam();
        toast.success("Invite cancelled");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleRemoveMember = async (memberEmail: string) => {
    if (!team || !confirm(`Remove ${memberEmail} from the team?`)) return;
    try {
      const res = await fetch("/api/team/member", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          userEmail: memberEmail,
          removedByEmail: email.trim(),
        }),
      });
      if (res.ok) {
        fetchTeam();
        toast.success("Member removed");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed");
      }
    } catch {
      toast.error("Failed");
    }
  };

  const handleSaveProfile = () => {
    setCurrentUser(email.trim(), displayName.trim() || "Boss");
    setSavingProfile(true);
    toast.success("Profile saved");
    setTimeout(() => setSavingProfile(false), 1500);
  };

  const formatLastSeen = (iso: string) => {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 2) return "now";
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-boss-bg">
      <nav className="sticky top-0 z-40 border-b border-boss-border bg-boss-surface/95 glass-strong">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-text-primary">
            <Crown className="w-4 h-4 text-gold" />
            <span className="font-bold text-sm">Grand Studio</span>
          </Link>
          <div className="flex gap-2">
            <Link href="/team">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Team
              </Button>
            </Link>
            <Link href="/cloud">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Cloud
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm" className="text-text-muted hover:text-text-primary">
                Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-8 h-8 text-gold" />
          <div>
            <h1 className="text-2xl font-bold text-text-primary">My Team</h1>
            <p className="text-text-muted text-sm mt-0.5">
              Collaborate on game projects with your team.
            </p>
          </div>
        </div>

        {/* Your profile (email/name for collaboration) */}
        <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Your profile</h2>
          <p className="text-xs text-text-muted mb-3">Used for chat attribution and invites.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-text-muted mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-64 bg-boss-surface border-boss-border text-text-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Display name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-48 bg-boss-surface border-boss-border text-text-primary"
              />
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm" className="bg-gold hover:bg-gold/90 text-boss-bg">
              Save
            </Button>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center gap-2 text-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading…
          </div>
        ) : !team ? (
          <section className="rounded-2xl border border-boss-border bg-boss-card p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-3">Create your team</h2>
            <p className="text-sm text-text-muted mb-4">Enter a team name and create. You’ll be the owner.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Team name"
                className="w-64 bg-boss-surface border-boss-border text-text-primary"
              />
              <Button
                onClick={handleCreateTeam}
                disabled={savingTeam || !email.trim() || !teamName.trim()}
                className="bg-gold hover:bg-gold/90 text-boss-bg gap-2"
              >
                {savingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Create team
              </Button>
            </div>
          </section>
        ) : (
          <>
            {/* Team name & plan */}
            <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Team</h2>
              <div className="flex flex-wrap gap-2 items-center mb-2">
                <Input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team name"
                  className="w-64 bg-boss-surface border-boss-border text-text-primary"
                />
                {team.owner_email === email.trim() && (
                  <Button onClick={handleSaveTeamName} disabled={savingTeam} size="sm" variant="outline" className="border-boss-border">
                    Save
                  </Button>
                )}
              </div>
              <p className="text-xs text-text-muted">
                Plan: {team.plan === "free" ? "Free" : team.plan} ({team.max_members} members max)
              </p>
            </section>

            {/* Members */}
            <section className="rounded-2xl border border-boss-border bg-boss-card p-6 mb-8">
              <h2 className="text-sm font-semibold text-text-primary mb-3">
                Members ({members.length}/{team.max_members})
              </h2>
              <ul className="space-y-2 mb-6">
                {members.map((m) => (
                  <li
                    key={m.id || m.user_email}
                    className="flex items-center justify-between py-2 border-b border-boss-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👤</span>
                      <span className="text-sm text-text-primary">{m.display_name || m.user_email}</span>
                      <span className="text-xs text-text-muted capitalize">({m.role})</span>
                      <span className={`text-xs ${m.is_online ? "text-agent-green" : "text-text-muted"}`}>
                        {m.is_online ? "🟢 Online" : `⚫ Offline (${formatLastSeen(m.last_seen_at)})`}
                      </span>
                    </div>
                    {team.owner_email === email.trim() && m.role !== "owner" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-text-muted hover:text-red-500 h-7 text-xs"
                        onClick={() => handleRemoveMember(m.user_email)}
                      >
                        Remove
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {team.owner_email === email.trim() && members.length < team.max_members && (
                <>
                  <h3 className="text-xs font-semibold text-text-primary mb-2">Invite new member</h3>
                  <div className="flex flex-wrap gap-2 items-end">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Email"
                      className="w-56 bg-boss-surface border-boss-border text-text-primary"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="h-9 px-3 rounded-md bg-boss-surface border border-boss-border text-text-primary text-sm"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="member">Member</option>
                      <option value="editor">Editor</option>
                    </select>
                    <Button onClick={handleInvite} disabled={sendingInvite || !inviteEmail.trim()} size="sm" className="gap-2">
                      {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Send invite
                    </Button>
                  </div>
                </>
              )}

              {pendingInvites.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-semibold text-text-primary mb-2">Pending invites</h3>
                  <ul className="space-y-1">
                    {pendingInvites.map((p) => (
                      <li key={p.id || p.user_email} className="flex items-center justify-between text-sm">
                        <span className="text-text-secondary">
                          <Mail className="w-3.5 h-3.5 inline mr-1" />
                          {p.user_email} — {p.role} — Sent {formatLastSeen(p.joined_at)}
                        </span>
                        {team.owner_email === email.trim() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-text-muted hover:text-red-500 h-6 text-xs"
                            onClick={() => handleCancelInvite(p.user_email)}
                          >
                            Cancel invite
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* Shared projects */}
            <section className="rounded-2xl border border-boss-border bg-boss-card p-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Shared projects</h2>
              {sharedProjects.length === 0 ? (
                <p className="text-sm text-text-muted mb-3">No shared projects yet.</p>
              ) : (
                <ul className="space-y-2 mb-3">
                  {sharedProjects.map((proj) => (
                    <li key={proj.id} className="flex items-center justify-between py-2">
                      <Link href={`/project/${proj.id}`} className="flex items-center gap-2 text-text-primary hover:text-gold transition-colors">
                        <Gamepad2 className="w-4 h-4" />
                        {proj.name}
                      </Link>
                      <span className="text-xs text-text-muted">
                        {proj.collaborators.map((c) => c.display_name || c.user_email).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/">
                <Button variant="outline" size="sm" className="border-boss-border text-text-secondary">
                  Share a project
                </Button>
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}