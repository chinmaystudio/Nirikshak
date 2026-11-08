import type { GovernmentAlert, GovernmentAlertView, AlertCategory, AlertSeverity } from "@/types/infrastructure";
import { offlineGuard } from "@/services/api/client";
import { alerts } from "../../data/alerts";
import { appStore } from "@/app/providers/store";
import { ALERT_SEVERITY_ORDER } from "@/constants/alertSeverities";
import { environment } from "@/config/environment";
import { supabase } from "@/core/supabase/client";

export interface AlertFilters {
  severity?: AlertSeverity | "all";
  category?: AlertCategory | "all";
  unreadOnly?: boolean;
}

function withRead(a: GovernmentAlert): GovernmentAlertView {
  return { ...a, read: appStore.getState().readAlerts.includes(a.id) };
}

/**
 * DF-29: in production, alerts are backed by the real `notifications` table
 * (RLS scopes rows to the signed-in user / their organization) instead of a
 * demo gate that permanently returned []. Notifications carry no severity,
 * so they are honestly presented as "info" notices — never as critical
 * alerts. The bundled fixture set is used only in explicit demo mode.
 */
let liveCache: GovernmentAlertView[] = [];

function mapNotification(n: any): GovernmentAlert {
  const category: AlertCategory = n.entity_type === 'projects' ? 'project' : 'infrastructure';
  return {
    id: n.id,
    severity: 'info',
    category,
    title: n.title || 'Notification',
    body: n.message || '',
    area: '',
    startTime: n.created_at || new Date().toISOString(),
    endTime: null,
    postedAt: n.created_at || new Date().toISOString(),
    projectId: n.entity_type === 'projects' ? (n.entity_id ?? null) : null,
    contact: '',
  };
}

function applyFilters(out: GovernmentAlertView[], filters: AlertFilters): GovernmentAlertView[] {
  let result = out;
  if (filters.severity && filters.severity !== "all") result = result.filter((a) => a.severity === filters.severity);
  if (filters.category && filters.category !== "all") result = result.filter((a) => a.category === filters.category);
  if (filters.unreadOnly) result = result.filter((a) => !a.read);
  return result.sort(
    (a, b) => ALERT_SEVERITY_ORDER[a.severity] - ALERT_SEVERITY_ORDER[b.severity] || new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
}

export async function getAlerts(filters: AlertFilters = {}): Promise<GovernmentAlertView[]> {
  offlineGuard();
  if (environment.demoMode) {
    return applyFilters(alerts.map(withRead), filters);
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    liveCache = [];
    return [];
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Could not load notifications: ${error.message}`);

  liveCache = (data || []).map((n: any) => {
    const view = withRead(mapNotification(n));
    return { ...view, read: view.read || n.read_at != null };
  });
  return applyFilters(liveCache, filters);
}

export async function getAlertById(id: string): Promise<GovernmentAlertView> {
  offlineGuard();
  if (environment.demoMode) {
    const found = alerts.find((a) => a.id === id);
    if (!found) throw new Error("Alert not found. It may have expired.");
    return withRead(found);
  }
  const { data, error } = await supabase.from('notifications').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Could not load the notification: ${error.message}`);
  if (!data) throw new Error("Alert not found. It may have expired.");
  const view = withRead(mapNotification(data));
  return { ...view, read: view.read || (data as any).read_at != null };
}

export function markAlertRead(id: string): void {
  const readAlerts = appStore.getState().readAlerts;
  if (!readAlerts.includes(id)) {
    appStore.setState({ readAlerts: [...readAlerts, id] });
  }
  if (!environment.demoMode) {
    // Best-effort server-side read marker; local state stays authoritative
    // for the badge if the update is not permitted.
    void supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }
}

export function markAllAlertsRead(): void {
  const ids = environment.demoMode ? alerts.map((a) => a.id) : liveCache.map((a) => a.id);
  appStore.setState({ readAlerts: Array.from(new Set([...appStore.getState().readAlerts, ...ids])) });
}

export function unreadAlertCount(): number {
  const readAlerts = appStore.getState().readAlerts;
  const source = environment.demoMode ? alerts : liveCache;
  return source.filter((a) => !readAlerts.includes(a.id) && !(a as GovernmentAlertView).read).length;
}

export function criticalUnreadAlerts(): GovernmentAlertView[] {
  if (!environment.demoMode) {
    // Production notifications carry no critical severity — report none
    // rather than inventing emergencies.
    return [];
  }
  return alerts
    .filter((a) => a.severity === "critical" && !appStore.getState().readAlerts.includes(a.id))
    .map(withRead);
}
