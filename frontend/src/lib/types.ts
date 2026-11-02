export type Role = "admin" | "supervisor" | "technician";
export type MachineStatus = "operational" | "degraded" | "down" | "retired";
export type ProcessingStatus =
  | "uploaded"
  | "transcribing"
  | "transcription_failed"
  | "transcribed"
  | "analyzing"
  | "analysis_failed"
  | "awaiting_review";
export type ReviewStatus = "draft" | "confirmed";
export type ResolutionStatus = "open" | "monitoring" | "resolved" | "unresolved";
export type Urgency = "unknown" | "needs_review" | "routine" | "urgent";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface User {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  organization?: { id: string; name: string };
}

export interface Machine {
  id: string;
  asset_code: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  location: string | null;
  status: MachineStatus;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
  incident_count?: number;
  open_incident_count?: number;
  last_incident_at?: string | null;
}

export interface TimelineEntry {
  id: string;
  occurred_at: string;
  summary: string | null;
  symptoms: string[];
  urgency: Urgency;
  processing_status: ProcessingStatus;
  review_status: ReviewStatus;
  resolution_status: ResolutionStatus;
  outcome_summary: string | null;
  is_seed: boolean;
}

export interface MachineDetail extends Machine {
  incident_count: number;
  open_incident_count: number;
  recurring_symptoms: { tag: string; count: number; last_seen: string }[];
  timeline: TimelineEntry[];
}

export interface Ref {
  id: string;
  name: string;
}

export interface MachineRef {
  id: string;
  asset_code: string;
  name: string;
  type: string;
}

export interface IncidentListItem {
  id: string;
  machine: MachineRef;
  occurred_at: string;
  summary: string | null;
  symptoms: string[];
  symptom_tags: string[];
  urgency: Urgency;
  processing_status: ProcessingStatus;
  review_status: ReviewStatus;
  resolution_status: ResolutionStatus;
  transcript_source: string | null;
  analysis_source: string | null;
  is_seed: boolean;
  reporter: Ref | null;
  created_at: string;
}

export interface Outcome {
  id: string;
  incident_id: string;
  verified_cause: string | null;
  action_performed: string;
  parts_used: string[];
  resolution_status: ResolutionStatus;
  notes: string | null;
  verified_by: Ref | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AudioAsset {
  id: string;
  original_filename: string | null;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  retention_status: "retained" | "deleted";
  delete_after: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  provider: "prisma" | "evon" | "timbre";
  model: string;
  mode: "live" | "mock" | "disabled";
  status: "running" | "succeeded" | "failed";
  attempts: number;
  provider_request_id: string | null;
  latency_ms: number | null;
  error_code: string | null;
  safe_error_message: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface IncidentDetail extends IncidentListItem {
  transcript_original: string | null;
  transcript_edited: string | null;
  transcript_language: string | null;
  observations: string[];
  actions_taken: string[];
  suspected_causes: string[];
  missing_information: string[];
  suggested_checks: string[];
  confidence_notes: string | null;
  safety_notice: string | null;
  analysis_warnings: string[];
  confirmed_by: Ref | null;
  confirmed_at: string | null;
  updated_at: string;
  outcomes: Outcome[];
  audio_assets: AudioAsset[];
  jobs: Job[];
  provenance: {
    transcript: string;
    structured_fields: string;
    suspected_causes: string;
    outcome: string;
  } | null;
}

export interface RelatedIncident {
  rank: number;
  incident_id: string;
  link: string;
  occurred_at: string;
  machine: MachineRef;
  summary: string | null;
  symptoms: string[];
  observations: string[];
  actions_taken: string[];
  review_status: ReviewStatus;
  resolution_status: ResolutionStatus;
  is_seed: boolean;
  outcome: {
    resolution_status: ResolutionStatus;
    verified_cause: string | null;
    action_performed: string;
    resolved_at: string | null;
  } | null;
  outcome_label: string;
  rationale: string[];
  signals: {
    same_machine: boolean;
    same_machine_type: boolean;
    shared_symptoms: string[];
    matched_terms: string[];
    text_relevance: number;
  };
}

export interface RelatedResponse {
  incident_id: string | null;
  query_symptoms: string[];
  results: RelatedIncident[];
  no_match: boolean;
  disclaimer: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  actor: Ref | null;
  created_at: string;
}

export interface DashboardSummary {
  machines: { total: number; by_status: Partial<Record<MachineStatus, number>> };
  incidents: {
    total: number;
    open: number;
    awaiting_review: number;
    processing_failed: number;
    urgent_open: number;
    resolved_last_30_days: number;
    reported_last_30_days: number;
    seed_records: number;
  };
  top_symptoms: { tag: string; count: number }[];
  machine_activity_90d: { machine_id: string; asset_code: string; name: string; incident_count: number }[];
  recent_incidents: IncidentListItem[];
  unresolved_incidents: IncidentListItem[];
  is_empty: boolean;
}

export interface ProviderStatus {
  provider: "prisma" | "evon" | "timbre";
  purpose: string;
  mode: "live" | "mock" | "disabled";
  model: string;
  endpoint: string;
  credentials_configured: boolean;
  live_ready: boolean;
  label: string;
  last_call: { at: string; mode: string; model: string; status: string; latency_ms: number | null; error_code: string | null } | null;
  last_failure: { at: string; error_code: string | null } | null;
}

export interface IntegrationStatus {
  environment: string;
  providers: ProviderStatus[];
  audio: { max_bytes: number; max_seconds: number; retention_days: number; accepted_formats: string[] };
  privacy_notice: string;
}
