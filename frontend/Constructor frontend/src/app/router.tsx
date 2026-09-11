import { useEffect, useState, useCallback } from "react";

export interface RouteLocation {
  path: string;
  query: Record<string, string>;
}

let listeners = new Set<() => void>();
let notifyVersion = 0;

function onHashChange(): void {
  notifyVersion += 1;
  listeners.forEach((l) => l());
}

export function parseHash(): RouteLocation {
  let h = window.location.hash.replace(/^#/, "");
  if (!h || h === "/") h = "/";
  const qIdx = h.indexOf("?");
  const pathPart = qIdx === -1 ? h : h.slice(0, qIdx);
  const query: Record<string, string> = {};
  if (qIdx !== -1) {
    h.slice(qIdx + 1)
      .split("&")
      .forEach((pair) => {
        if (!pair) return;
        const [k, v] = pair.split("=");
        query[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
      });
  }
  const path = "/" + pathPart.split("/").filter(Boolean).join("/");
  return { path: path === "//" ? "/" : path, query };
}

export function navigate(to: string): void {
  const target = to.startsWith("#") ? to : `#${to}`;
  if (window.location.hash === target) {
    onHashChange();
  } else {
    window.location.hash = target;
  }
}

export function useLocation(): RouteLocation & { fullPath: string } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = (): void => setTick((t) => t + 1);
    if (listeners.size === 0) {
      window.addEventListener("hashchange", onHashChange);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const { path, query } = parseHash();
  const fullPath = `${path}${Object.keys(query).length ? "?" : ""}${Object.entries(query)
    .map(([k, v]) => `${k}=${v}`)
    .join("&")}`;
  return { path, query, fullPath };
}

export function useNavigate(): (to: string) => void {
  return useCallback(navigate, []);
}

export interface MatchParams {
  [key: string]: string;
}

export function matchPattern(pattern: string, path: string): MatchParams | null {
  const patternSegs = pattern.split("/").filter(Boolean);
  const pathSegs = path.split("/").filter(Boolean);
  if (patternSegs.length !== pathSegs.length) return null;
  const params: MatchParams = {};
  for (let i = 0; i < patternSegs.length; i++) {
    if (patternSegs[i].startsWith(":")) {
      params[patternSegs[i].slice(1)] = decodeURIComponent(pathSegs[i]);
    } else if (patternSegs[i] !== pathSegs[i]) {
      return null;
    }
  }
  return params;
}
