import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledSMS {
  id: string;
  organization_id: string;
  workshop_id: string;
  lead_id: string;
  template_id: string;
  variable_values: Record<string, string> | null;
  scheduled_for: string;
  status: string;
  retry_count: number;
}

interface Lead {
  id: string;
  phone: string | null;
}

interface SMSTemplate {
  id: string;
  dlt_template_id: string;
  content_preview: string;
  variables: { key: string; label: string }[] | null;
}

// Format phone number for India (remove country code prefix if present)
function formatPhoneForIndia(phone: string): string {
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code prefixes
  if (cleaned.startsWith('91') && cleaned.length > 10) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  // Return last 10 digits
  return cleaned.slice(-10);
}

// Build full message by replacing {#var#} placeholders with actual values
function buildMessageWithVariables(
  template: SMSTemplate,
  variableValues: Record<string, string> | null
): string {
  let message = template.content_preview;
  
  if (!template.variables || template.variables.length === 0 || !variableValues) {
    return message;
  }
  
  // Sort variables by key (var1, var2, etc.) to replace in order
  const sortedVars = [...template.variables].sort((a, b) => {
    const aNum = parseInt(a.key.replace('var', '')) || 0;
    const bNum = parseInt(b.key.replace('var', '')) || 0;
    return aNum - bNum;
  });
  
  // Replace each {#var#} placeholder in order with the corresponding value
  for (const v of sortedVars) {
    const value = variableValues[v.key] || '';
    // Replace the first occurrence of {#var#}
    message = message.replace('{#var#}', value);
  }
  
  return message;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FAST2SMS_API_KEY = Deno.env.get('FAST2SMS_API_KEY');
    const FAST2SMS_SENDER_ID = Deno.env.get('FAST2SMS_SENDER_ID');
    const FAST2SMS_ENTITY_ID = Deno.env.get('FAST2SMS_ENTITY_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!FAST2SMS_API_KEY || !FAST2SMS_SENDER_ID || !FAST2SMS_ENTITY_ID) {
      console.error('Missing Fast2SMS configuration (API_KEY, SENDER_ID, or ENTITY_ID)');
      return new Response(
        JSON.stringify({ error: 'Fast2SMS not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch pending SMS messages that are due
    const now = new Date().toISOString();
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_sms_messages')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending SMS messages:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending SMS messages', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${pendingMessages.length} pending SMS messages`);

    // Batch fetch leads and templates for efficiency
    const leadIds = [...new Set(pendingMessages.map(m => m.lead_id))];
    const templateIds = [...new Set(pendingMessages.map(m => m.template_id))];

    const [leadsResult, templatesResult] = await Promise.all([
      supabase.from('leads').select('id, phone').in('id', leadIds),
      supabase.from('sms_templates').select('id, dlt_template_id, content_preview, variables').in('id', templateIds),
    ]);

    const leadsMap = new Map<string, Lead>();
    (leadsResult.data || []).forEach(l => leadsMap.set(l.id, l));

    const templatesMap = new Map<string, SMSTemplate>();
    (templatesResult.data || []).forEach(t => templatesMap.set(t.id, t));

    const results = await Promise.allSettled(
      pendingMessages.map(async (msg: ScheduledSMS) => {
        const lead = leadsMap.get(msg.lead_id);
        const template = templatesMap.get(msg.template_id);

        if (!lead?.phone) {
          throw new Error('Lead has no phone number');
        }

        if (!template) {
          throw new Error('Template not found');
        }

        if (!template.content_preview) {
          throw new Error('Template has no content_preview');
        }

        const phoneNumber = formatPhoneForIndia(lead.phone);
        if (phoneNumber.length !== 10) {
          throw new Error(`Invalid phone number: ${phoneNumber}`);
        }

        // Build full message with variables substituted
        const fullMessage = buildMessageWithVariables(template, msg.variable_values);

        // Call Fast2SMS DLT Manual API
        const fast2smsBody = {
          route: 'dlt_manual',
          sender_id: FAST2SMS_SENDER_ID,
          entity_id: FAST2SMS_ENTITY_ID,
          template_id: template.dlt_template_id,
          message: fullMessage,
          numbers: phoneNumber,
          flash: '0',
        };

        console.log(`Sending SMS ${msg.id} to ${phoneNumber}:`, {
          templateId: template.dlt_template_id,
          message: fullMessage,
        });

        const response = await fetchWithRetry('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': FAST2SMS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(fast2smsBody),
        }, { maxRetries: 3, timeoutMs: 10000 });

        const responseText = await response.text();
        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        console.log(`Fast2SMS response for ${msg.id}:`, responseData);

        if (!response.ok || responseData.return === false) {
          const errorMessage = responseData.message || `Fast2SMS error ${response.status}`;
          throw new Error(errorMessage);
        }

        // Update message status to sent
        await supabase
          .from('scheduled_sms_messages')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
            fast2sms_request_id: responseData.request_id || null,
          })
          .eq('id', msg.id);

        return { id: msg.id, status: 'sent', requestId: responseData.request_id };
      })
    );

    // Handle failed messages
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const msg = pendingMessages[i];

      if (result.status === 'rejected') {
        const retryCount = (msg.retry_count || 0) + 1;
        const maxRetries = 3;

        await supabase
          .from('scheduled_sms_messages')
          .update({
            status: retryCount >= maxRetries ? 'failed' : 'pending',
            retry_count: retryCount,
            error_message: result.reason?.message || 'Unknown error',
          })
          .eq('id', msg.id);
      }
    }

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    const failCount = results.filter((r) => r.status === 'rejected').length;

    console.log(`SMS Processing complete: ${successCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Processing complete',
        processed: pendingMessages.length,
        sent: successCount,
        failed: failCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('SMS Queue processor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
