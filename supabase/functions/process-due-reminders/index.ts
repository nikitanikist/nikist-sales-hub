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
  'aadeshnikist@gmail.com',    // Adesh
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
    // Include appointment created_at to check if reminder was already past at booking time
    const { data: dueReminders, error: queryError } = await supabase
      .from('call_reminders')
      .select(`
        id,
        reminder_type,
        reminder_time,
        appointment:call_appointments(
          id,
          created_at,
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

    // Separate reminders into: to-skip (past at booking), enabled, and non-enabled
    const remindersToSkip: any[] = [];
    const enabledReminders: any[] = [];
    const nonEnabledReminders: any[] = [];

    for (const reminder of dueReminders) {
      const appointment = Array.isArray(reminder.appointment) ? reminder.appointment[0] : reminder.appointment;
      const closer = Array.isArray(appointment?.closer) ? appointment.closer[0] : appointment?.closer;
      const closerEmail = closer?.email?.toLowerCase();
      const appointmentCreatedAt = appointment?.created_at;
      const reminderTime = reminder.reminder_time;

      // Check if this reminder was already past when the appointment was booked
      if (appointmentCreatedAt && reminderTime) {
        const createdAt = new Date(appointmentCreatedAt);
        const reminderDateTime = new Date(reminderTime);
        
        if (reminderDateTime < createdAt) {
          // This reminder was already supposed to go before the call was booked
          remindersToSkip.push(reminder);
          console.log(`Reminder ${reminder.id} (${reminder.reminder_type}) was past at booking time - will skip`);
          continue;
        }
      }

      // Check if this closer is enabled for WhatsApp reminders
      if (closerEmail && ENABLED_CLOSER_EMAILS.includes(closerEmail)) {
        enabledReminders.push(reminder);
      } else {
        nonEnabledReminders.push(reminder);
      }
    }

    console.log(`${remindersToSkip.length} reminders to skip (past at booking time)`);
    console.log(`${enabledReminders.length} reminders for enabled closers (Dipanshu/Akansha/Adesh)`);
    console.log(`${nonEnabledReminders.length} reminders for non-enabled closers`);

    // Mark reminders that were past at booking time as 'skipped'
    if (remindersToSkip.length > 0) {
      const skipIds = remindersToSkip.map((r: any) => r.id);
      const { error: skipError } = await supabase
        .from('call_reminders')
        .update({ status: 'skipped' })
        .in('id', skipIds);
      
      if (skipError) {
        console.error('Error marking reminders as skipped:', skipError);
      } else {
        console.log(`Marked ${skipIds.length} reminders as skipped (were past at booking time)`);
      }
    }

    // Process each enabled reminder
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
        skipped: remindersToSkip.length,
        nonEnabled: nonEnabledReminders.length,
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
