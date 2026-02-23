
CREATE OR REPLACE FUNCTION public.migrate_whatsapp_session(
  p_old_session_id UUID, 
  p_new_session_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB := '{}'::jsonb;
  cnt INTEGER;
BEGIN
  -- Migrate workshops
  UPDATE workshops SET whatsapp_session_id = p_new_session_id
  WHERE whatsapp_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('workshops', cnt);

  -- Migrate webinars
  UPDATE webinars SET whatsapp_session_id = p_new_session_id
  WHERE whatsapp_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('webinars', cnt);

  -- Migrate active/pending campaigns only
  UPDATE notification_campaigns SET session_id = p_new_session_id
  WHERE session_id = p_old_session_id 
    AND status IN ('pending', 'sending', 'scheduled');
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('campaigns', cnt);

  -- Migrate organization community session
  UPDATE organizations SET community_session_id = p_new_session_id
  WHERE community_session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('organizations', cnt);

  -- Migrate groups (reactivate under new session)
  UPDATE whatsapp_groups 
  SET session_id = p_new_session_id, is_active = true
  WHERE session_id = p_old_session_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('groups', cnt);

  -- Update pending scheduled workshop messages
  UPDATE scheduled_whatsapp_messages swm
  SET group_id = ng.id
  FROM whatsapp_groups og
  JOIN whatsapp_groups ng ON ng.group_jid = og.group_jid 
    AND ng.session_id = p_new_session_id
  WHERE swm.group_id = og.id 
    AND og.session_id = p_old_session_id
    AND swm.status = 'pending';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('scheduled_messages', cnt);

  -- Update pending scheduled webinar messages
  UPDATE scheduled_webinar_messages swm
  SET group_id = ng.id
  FROM whatsapp_groups og
  JOIN whatsapp_groups ng ON ng.group_jid = og.group_jid 
    AND ng.session_id = p_new_session_id
  WHERE swm.group_id = og.id 
    AND og.session_id = p_old_session_id
    AND swm.status = 'pending';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  result := result || jsonb_build_object('scheduled_webinar_messages', cnt);

  RETURN result;
END;
$$;
