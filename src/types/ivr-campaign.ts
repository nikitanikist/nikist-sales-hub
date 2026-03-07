export interface IvrCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: IvrCampaignStatus;

  // Audio
  audio_opening_url: string;
  audio_thankyou_url: string;
  audio_not_interested_url: string;
  audio_repeat_url: string | null;
  audio_goodbye_url: string | null;

  // Action config
  on_yes_action: string;
  on_yes_template_name: string | null;
  on_yes_template_params: any | null;
  on_yes_media_url: string | null;
  aisensy_integration_id: string | null;

  // Speech
  speech_language: string;
  speech_hints: string;
  positive_keywords: string;
  negative_keywords: string;

  // VoBiz
  vobiz_from_number: string;
  calls_per_second: number;
  concurrent_limit: number;

  // Schedule
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;

  // Counters
  total_contacts: number;
  calls_initiated: number;
  calls_answered: number;
  calls_interested: number;
  calls_not_interested: number;
  calls_no_response: number;
  calls_no_answer: number;
  calls_busy: number;
  calls_failed: number;
  calls_voicemail: number;
  total_duration_seconds: number;
  total_cost: number;

  // Retry
  retry_no_answer: boolean;
  max_retries: number;
  retry_delay_minutes: number;

  // Meta
  workshop_id: string | null;
  source_type: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IvrCampaignCall {
  id: string;
  campaign_id: string;
  organization_id: string;
  contact_name: string | null;
  contact_phone: string;
  contact_data: any | null;
  status: IvrCallStatus;
  outcome: IvrCallOutcome | null;

  vobiz_call_uuid: string | null;
  vobiz_from: string | null;
  vobiz_to: string | null;

  speech_transcript: string | null;
  speech_confidence: number | null;
  detected_input_type: string | null;

  call_duration_seconds: number;
  call_cost: number;
  hangup_cause: string | null;
  answered_by_voicemail: boolean;

  whatsapp_sent: boolean;
  whatsapp_sent_at: string | null;
  whatsapp_error: string | null;

  retry_count: number;
  last_retry_at: string | null;
  next_retry_at: string | null;

  queued_at: string | null;
  initiated_at: string | null;
  answered_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IvrAudioClip {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  audio_url: string;
  duration_seconds: number | null;
  language: string;
  audio_type: IvrAudioType;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

export type IvrCampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
export type IvrCallStatus = 'pending' | 'queued' | 'initiated' | 'answered' | 'completed' | 'no_answer' | 'busy' | 'failed' | 'voicemail' | 'cancelled';
export type IvrCallOutcome = 'interested' | 'not_interested' | 'no_response' | 'unclear' | 'voicemail' | 'error';
export type IvrAudioType = 'opening' | 'thankyou' | 'not_interested' | 'repeat' | 'goodbye';

export interface CreateIvrCampaignData {
  name: string;
  description?: string;
  audio_opening_url: string;
  audio_thankyou_url: string;
  audio_not_interested_url: string;
  audio_repeat_url?: string;
  audio_goodbye_url?: string;
  on_yes_action?: string;
  on_yes_template_name?: string;
  on_yes_template_params?: any;
  on_yes_media_url?: string;
  aisensy_integration_id?: string;
  speech_language?: string;
  vobiz_from_number: string;
  calls_per_second?: number;
  concurrent_limit?: number;
  retry_no_answer?: boolean;
  max_retries?: number;
  retry_delay_minutes?: number;
  workshop_id?: string;
  source_type?: string;
  scheduled_at?: string;
  contacts: { name?: string; phone: string; data?: Record<string, any> }[];
}
