
CREATE OR REPLACE FUNCTION public.transition_call_to_terminal(
  p_call_id uuid,
  p_status text,
  p_outcome text DEFAULT NULL,
  p_bolna_call_id text DEFAULT NULL,
  p_duration integer DEFAULT 0,
  p_cost numeric DEFAULT 0,
  p_transcript text DEFAULT NULL,
  p_recording_url text DEFAULT NULL,
  p_extracted_data jsonb DEFAULT NULL
)
RETURNS TABLE(was_first_transition boolean, campaign_id uuid, previous_outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_was_first boolean := false;
  v_campaign_id uuid;
  v_previous_outcome text;
BEGIN
  -- Atomic: only update if not already terminal
  UPDATE voice_campaign_calls
  SET
    status = p_status,
    outcome = COALESCE(p_outcome, outcome),
    bolna_call_id = COALESCE(p_bolna_call_id, bolna_call_id),
    call_duration_seconds = GREATEST(FLOOR(p_duration)::integer, COALESCE(call_duration_seconds, 0)),
    total_cost = GREATEST(p_cost, COALESCE(total_cost, 0)),
    transcript = COALESCE(p_transcript, transcript),
    recording_url = COALESCE(p_recording_url, recording_url),
    extracted_data = COALESCE(p_extracted_data, extracted_data),
    updated_at = NOW()
  WHERE id = p_call_id
    AND status NOT IN ('completed', 'no-answer', 'busy', 'failed', 'cancelled')
  RETURNING voice_campaign_calls.campaign_id, voice_campaign_calls.outcome
  INTO v_campaign_id, v_previous_outcome;

  IF FOUND THEN
    v_was_first := true;
  ELSE
    SELECT vcc.campaign_id, vcc.outcome
    INTO v_campaign_id, v_previous_outcome
    FROM voice_campaign_calls vcc
    WHERE vcc.id = p_call_id;
  END IF;

  was_first_transition := v_was_first;
  campaign_id := v_campaign_id;
  previous_outcome := v_previous_outcome;
  RETURN NEXT;
END;
$function$;
