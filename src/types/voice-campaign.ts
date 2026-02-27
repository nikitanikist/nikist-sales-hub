export interface VoiceCampaign {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  agent_type: string;
  bolna_agent_id: string | null;
  bolna_batch_id: string | null;
  workshop_time: string | null;
  workshop_name: string | null;
  workshop_id: string | null;
  whatsapp_template_id: string | null;
  aisensy_integration_id: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  total_contacts: number;
  calls_completed: number;
  calls_confirmed: number;
  calls_rescheduled: number;
  calls_not_interested: number;
  calls_no_answer: number;
  calls_failed: number;
  total_cost: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VoiceCampaignCall {
  id: string;
  campaign_id: string;
  organization_id: string;
  lead_id: string | null;
  contact_name: string;
  contact_phone: string;
  status: CallStatus;
  outcome: CallOutcome | null;
  reschedule_day: string | null;
  in_whatsapp_group: boolean | null;
  whatsapp_link_sent: boolean;
  remarks: string | null;
  bolna_call_id: string | null;
  call_duration_seconds: number | null;
  total_cost: number | null;
  transcript: string | null;
  recording_url: string | null;
  extracted_data: any | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed';
export type CallStatus = 'pending' | 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'no-answer' | 'failed' | 'cancelled';
export type CallOutcome = 'confirmed' | 'rescheduled' | 'not_interested' | 'angry' | 'wrong_number' | 'voicemail' | 'no_response';

export interface CreateBroadcastData {
  name: string;
  workshop_id?: string;
  workshop_name?: string;
  workshop_time?: string;
  bolna_agent_id?: string;
  scheduled_at?: string;
  contacts: { name: string; phone: string; lead_id?: string }[];
}
