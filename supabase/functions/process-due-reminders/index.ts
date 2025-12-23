import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Closers who should receive WhatsApp reminders
const ENABLED_CLOSER_EMAILS = [
  'nikistofficial@gmail.com',  // Dipanshu
  'akanshanikist@gmail.com',   // Akansha
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing due reminders at:', new Date().toISOString());

    // Query pending reminders where reminder_time is due
    // Exclude 'call_booked' as it's handled immediately during scheduling
    const { data: dueReminders, error: queryError } = await supabase
      .from('call_reminders')
      .select(`
        id,
        reminder_type,
        reminder_time,
        appointment:call_appointments(
          id,
          closer:profiles!call_appointments_closer_id_fkey(email)
        )
      `)
      .eq('status', 'pending')
      .neq('reminder_type', 'call_booked')
      .lte('reminder_time', new Date().toISOString());

    if (queryError) {
      console.error('Query error:', queryError);
      throw queryError;
    }

    console.log(`Found ${dueReminders?.length || 0} due reminders`);

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0,
          message: 'No due reminders found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter to only process reminders for enabled closers (Dipanshu and Akansha)
    const enabledReminders = dueReminders.filter((r: any) => {
      const closerEmail = r.appointment?.closer?.email?.toLowerCase();
      return closerEmail && ENABLED_CLOSER_EMAILS.includes(closerEmail);
    });

    console.log(`${enabledReminders.length} reminders are for enabled closers (Dipanshu/Akansha)`);

    // Process each reminder
    const results = [];
    for (const reminder of enabledReminders) {
      console.log(`Processing reminder ${reminder.id} (${reminder.reminder_type})`);
      
      try {
        // Call the send-whatsapp-reminder function
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-whatsapp-reminder`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ reminder_id: reminder.id }),
          }
        );

        const result = await response.json();
        results.push({
          reminder_id: reminder.id,
          type: reminder.reminder_type,
          success: response.ok,
          result,
        });
        
        console.log(`Reminder ${reminder.id} processed:`, result);
      } catch (error: any) {
        console.error(`Error processing reminder ${reminder.id}:`, error);
        results.push({
          reminder_id: reminder.id,
          type: reminder.reminder_type,
          success: false,
          error: error.message,
        });

        // Mark as failed
        await supabase
          .from('call_reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id);
      }
    }

    // Mark non-enabled reminders as sent to prevent reprocessing
    const nonEnabledReminders = dueReminders.filter((r: any) => {
      const closerEmail = r.appointment?.closer?.email?.toLowerCase();
      return !closerEmail || !ENABLED_CLOSER_EMAILS.includes(closerEmail);
    });

    if (nonEnabledReminders.length > 0) {
      const nonEnabledIds = nonEnabledReminders.map((r: any) => r.id);
      await supabase
        .from('call_reminders')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .in('id', nonEnabledIds);
      
      console.log(`Marked ${nonEnabledIds.length} non-enabled reminders as sent`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        skipped: nonEnabledReminders.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-due-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
