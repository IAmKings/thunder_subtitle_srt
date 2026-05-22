"use client";

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import type { MediaDirectory, TaskResponse, AppConfig } from "@/lib/types";
import type { ScanResultItem } from "@/lib/types";

// ---- Types ----

export type ScanMode = "scan" | "dry_run" | "dump" | "dump_force";

interface ScannerState {
  mediaDirs: MediaDirectory[];
  config: AppConfig | null;
  activeTask: TaskResponse | null;
  progress: number;
  findings: ScanResultItem[];
  scanMode: ScanMode;
  filterKeywords: string;
  isLoadingDirs: boolean;
  isStartingScan: boolean;
}

interface ScannerActions {
  setMediaDirs: (dirs: MediaDirectory[]) => void;
  setConfig: (cfg: AppConfig | null) => void;
  setActiveTask: (task: TaskResponse | null) => void;
  setProgress: (p: number) => void;
  setFindings: (f: ScanResultItem[] | ((prev: ScanResultItem[]) => ScanResultItem[])) => void;
  setScanMode: (m: ScanMode) => void;
  setFilterKeywords: (k: string) => void;
  setIsLoadingDirs: (v: boolean) => void;
  setIsStartingScan: (v: boolean) => void;
  disabledPaths: Set<string>;
  togglePathDisabled: (path: string) => void;
}

const ScannerStateContext = createContext<ScannerState | null>(null);
const ScannerActionsContext = createContext<ScannerActions | null>(null);

export function ScannerStateProvider({ children }: { children: ReactNode }) {
  const [mediaDirs, setMediaDirs] = useState<MediaDirectory[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [activeTask, setActiveTask] = useState<TaskResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [findings, setFindings] = useState<ScanResultItem[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("dry_run");
  const [filterKeywords, setFilterKeywords] = useState("");
  const [isLoadingDirs, setIsLoadingDirs] = useState(true);
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [disabledPaths, setDisabledPaths] = useState<Set<string>>(new Set());

  const togglePathDisabled = useCallback((path: string) => {
    setDisabledPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const state = useMemo<ScannerState>(
    () => ({
      mediaDirs, config, activeTask, progress, findings,
      scanMode, filterKeywords, isLoadingDirs, isStartingScan,
    }),
    [mediaDirs, config, activeTask, progress, findings, scanMode, filterKeywords, isLoadingDirs, isStartingScan]
  );

  const actions = useMemo<ScannerActions>(
    () => ({
      setMediaDirs, setConfig, setActiveTask, setProgress,
      setFindings, setScanMode, setFilterKeywords,
      setIsLoadingDirs, setIsStartingScan,
      disabledPaths, togglePathDisabled,
    }),
    [disabledPaths, togglePathDisabled]
  );

  return (
    <ScannerStateContext.Provider value={state}>
      <ScannerActionsContext.Provider value={actions}>
        {children}
      </ScannerActionsContext.Provider>
    </ScannerStateContext.Provider>
  );
}

export function useScannerState() {
  const ctx = useContext(ScannerStateContext);
  if (!ctx) throw new Error("useScannerState must be used within ScannerStateProvider");
  return ctx;
}

export function useScannerActions() {
  const ctx = useContext(ScannerActionsContext);
  if (!ctx) throw new Error("useScannerActions must be used within ScannerStateProvider");
  return ctx;
}
