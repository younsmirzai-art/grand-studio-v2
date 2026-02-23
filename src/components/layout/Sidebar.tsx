"use client";

import { useState, useEffect, useCallback } from "react";
import { Crown, Wifi, WifiOff, Database, Home, Settings, BookOpen, Globe, Mic, Gamepad2, TestTube2, ChevronDown, Loader2, Music, Film, ImageIcon, Store, Rocket, Key, Cloud, Monitor, Users, GraduationCap } from "lucide-react";
import Link from "next/link";
import { CLOUD_SESSION_KEY } from "@/lib/cloud/constants";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { useProjectStore } from "@/lib/stores/projectStore";
import { TEAM } from "@/lib/agents/identity";
import { AgentCard } from "@/components/team/AgentCard";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/uiStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { gamePresets, generatePresetCode } from "@/lib/gameDNA/presets";

interface SidebarProps {
  projectName?: string;
  projectStatus?: string;
  ue5Connected?: boolean;
}

export function Sidebar({ projectName, projectStatus, ue5Connected = false }: SidebarProps) {
  const agentStatuses = useProjectStore((s) => s.agentStatuses);
  const params = useParams();
  const projectId = params?.id as string | undefined;
  const setSketchfabModalOpen = useUIStore((s) => s.setSketchfabModalOpen);
  const setVoiceModalOpen = useUIStore((s) => s.setVoiceModalOpen);
  const setMusicModalOpen = useUIStore((s) => s.setMusicModalOpen);
  const setTrailerModalOpen = useUIStore((s) => s.setTrailerModalOpen);
  const setImageTo3DModalOpen = useUIStore((s) => s.setImageTo3DModalOpen);
  const setRunPlaytestTrigger = useUIStore((s) => s.setRunPlaytestTrigger);
  const [gameStyleApplying, setGameStyleApplying] = useState<string | null>(null);
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);
  const [cloudSession, setCloudSession] = useState<{ minutesRemaining: number } | null>(null);

  const checkRelay = useCallback(async () => {
    try {
      const res = await fetch("/api/ue5/status");
      const data = await res.json();
      setRelayOnline(data.relay_online === true);
    } catch {
      setRelayOnline(false);
    }
  }, []);

  useEffect(() => {
    checkRelay();
    const interval = setInterval(checkRelay, 10000);
    return () => clearInterval(interval);
  }, [checkRelay]);

  useEffect(() => {
    let sessionId: string | null = null;
    try {
      sessionId = localStorage.getItem(CLOUD_SESSION_KEY);
    } catch {}
    if (!sessionId) {
      setCloudSession(null);
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`/api/cloud/session?sessionId=${encodeURIComponent(sessionId!)}`);
        const data = await res.json();
        if (res.ok && (data.status === "active" || data.status === "starting")) {
          const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
          const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000));
          setCloudSession({ minutesRemaining: remaining });
        } else {
          setCloudSession(null);
        }
      } catch {
        setCloudSession(null);
      }
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, []);

  const applyGameStyle = async (presetKey: string) => {
    if (!projectId) return;
    const preset = gamePresets[presetKey];
    if (!preset) return;
    setGameStyleApplying(presetKey);
    try {
      const code = generatePresetCode(preset);
      const res = await fetch("/api/ue5/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, code, agentName: "Boss" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to apply game style");
        return;
      }
      toast.success(`Applied: ${preset.name}`);
    } catch {
      toast.error("Failed to send style to UE5");
    } finally {
      setGameStyleApplying(null);
    }
  };

  return (
    <aside className="w-64 h-screen flex flex-col bg-boss-surface border-r border-boss-border shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-boss-border">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center gold-glow">
            <Crown className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight group-hover:text-gold transition-colors">
              Grand Studio
            </h1>
            <p className="text-[10px] text-text-muted">v2</p>
          </div>
        </Link>
      </div>

      {/* Project info */}
      {projectName && (
        <div className="px-4 py-3 border-b border-boss-border">
          <p className="text-xs text-text-muted mb-1">Current Project</p>
          <p className="text-sm font-medium text-text-primary truncate">
            {projectName}
          </p>
          {projectStatus && (
            <span className={`text-[10px] ${projectStatus === "active" ? "text-agent-green" : "text-agent-amber"}`}>
              ● {projectStatus}
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="px-3 py-2 space-y-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Back to all projects</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/learn">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
              >
                <GraduationCap className="w-4 h-4" />
                Learn
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Academy &amp; interactive courses</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/team">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
              >
                <Users className="w-4 h-4" />
                Team
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Team &amp; collaboration</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/cloud">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
              >
                <Cloud className="w-4 h-4" />
                Cloud
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Cloud UE5 &amp; local setup</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/marketplace">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
              >
                <Store className="w-4 h-4" />
                Marketplace
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Game templates</TooltipContent>
        </Tooltip>
        {projectId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/project/${projectId}/publish-store`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
                >
                  <span className="text-base">💰</span>
                  Publish to Store
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Sell this game on the Store</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator className="bg-boss-border" />

      {/* Agent roster */}
      <div className="px-3 pt-3 pb-1">
        <p className="text-[10px] uppercase tracking-wider text-text-muted px-1 mb-2">
          Team
        </p>
        <div className="space-y-0.5">
          {TEAM.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              status={agentStatuses[agent.name]}
            />
          ))}
        </div>
      </div>

      <Separator className="bg-boss-border my-2" />

      {/* Quick tools */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[10px] uppercase tracking-wider text-text-muted px-1 mb-2">
          Tools
        </p>
        <div className="space-y-0.5">
          {projectId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!gameStyleApplying}
                  className="w-full justify-between gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
                >
                  <span className="flex items-center gap-2">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    Game Style
                  </span>
                  {gameStyleApplying ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-boss-card border-boss-border w-64 max-h-[280px] overflow-y-auto">
                <DropdownMenuLabel className="text-text-muted text-[10px] uppercase">
                  Apply lighting / atmosphere
                </DropdownMenuLabel>
                {Object.entries(gamePresets).map(([key, preset]) => (
                  <DropdownMenuItem
                    key={key}
                    onClick={() => applyGameStyle(key)}
                    disabled={!!gameStyleApplying}
                    className="flex flex-col items-start gap-0.5 py-2 text-text-primary cursor-pointer"
                  >
                    <span className="font-medium text-sm">{preset.name}</span>
                    <span className="text-[11px] text-text-muted">{preset.description}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {projectId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRunPlaytestTrigger(Date.now())}
                  className="w-full justify-start gap-2 text-cyan-500 hover:text-cyan-400 hover:bg-cyan-500/10 h-8 text-xs"
                >
                  <TestTube2 className="w-3.5 h-3.5" />
                  Run Playtest
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Capture + Amir playtest</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImageTo3DModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image to 3D
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSketchfabModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            Sketchfab Search
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTrailerModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <Film className="w-3.5 h-3.5" />
            Trailer Maker
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMusicModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <Music className="w-3.5 h-3.5" />
            Music Studio
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoiceModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice Generator
          </Button>
          {projectId && (
            <Link href={`/project/${projectId}/lore`}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Lore Editor
              </Button>
            </Link>
          )}
          {projectId && (
            <Link href={`/project/${projectId}/publish`}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
              >
                <Rocket className="w-3.5 h-3.5" />
                Publish
              </Button>
            </Link>
          )}
          <Link href="/developer">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
            >
              <Key className="w-3.5 h-3.5" />
              API
            </Button>
          </Link>
          {projectId && (
            <Link href={`/project/${projectId}/settings`}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Bottom status */}
      <div className="mt-auto border-t border-boss-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">UE5</span>
          <div className="flex items-center gap-1.5">
            {cloudSession != null ? (
              <>
                <Cloud className="w-3 h-3 text-blue-400" />
                <span className="text-[11px] text-blue-400">
                  Cloud UE5 Active — {cloudSession.minutesRemaining} min left
                </span>
              </>
            ) : relayOnline === true ? (
              <>
                <Monitor className="w-3 h-3 text-agent-green" />
                <span className="text-[11px] text-agent-green">Local UE5 Connected</span>
              </>
            ) : relayOnline === false ? (
              <>
                <WifiOff className="w-3 h-3 text-text-muted" />
                <Link
                  href="/cloud"
                  className="text-[11px] text-text-muted hover:text-text-secondary underline"
                >
                  Not Connected — Setup UE5
                </Link>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-text-muted" />
                <span className="text-[11px] text-text-muted">Checking…</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">Database</span>
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-agent-green" />
            <span className="text-[11px] text-agent-green">Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
