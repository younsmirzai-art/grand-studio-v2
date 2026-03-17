"use client";

import { useState, useEffect, useCallback } from "react";
import { Crown, WifiOff, Database, Home, Settings, Globe, ImageIcon, Monitor, Box } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/lib/stores/projectStore";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/stores/uiStore";

interface SidebarProps {
  projectName?: string;
  projectStatus?: string;
  ue5Connected?: boolean;
}

export function Sidebar({ projectName, projectStatus, ue5Connected = false }: SidebarProps) {
  const params = useParams();
  const projectId = params?.id as string | undefined;
  const setSketchfabModalOpen = useUIStore((s) => s.setSketchfabModalOpen);
  const setImageTo3DModalOpen = useUIStore((s) => s.setImageTo3DModalOpen);
  const [relayOnline, setRelayOnline] = useState<boolean | null>(null);

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
        {projectId && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/project/${projectId}/assets`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
                  >
                    <Box className="w-4 h-4" />
                    Asset Browser
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Browse UE5 assets</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href={`/project/${projectId}/settings`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 text-text-secondary hover:text-text-primary"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Project settings</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      <Separator className="bg-boss-border" />

      {/* Quick tools */}
      <div className="px-3 pt-1 pb-2">
        <p className="text-[10px] uppercase tracking-wider text-text-muted px-1 mb-2">
          Tools
        </p>
        <div className="space-y-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSketchfabModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            Community Models
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setImageTo3DModalOpen(true)}
            className="w-full justify-start gap-2 text-text-muted hover:text-text-secondary h-8 text-xs"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Image to 3D
          </Button>
        </div>
      </div>

      {/* Bottom status */}
      <div className="mt-auto border-t border-boss-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-muted">UE5</span>
          <div className="flex items-center gap-1.5">
            {relayOnline === true ? (
              <>
                <Monitor className="w-3 h-3 text-agent-green" />
                <span className="text-[11px] text-agent-green">Local UE5 Connected</span>
              </>
            ) : relayOnline === false ? (
              <>
                <WifiOff className="w-3 h-3 text-text-muted" />
                <span className="text-[11px] text-text-muted">Not Connected</span>
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
