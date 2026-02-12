import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
          created_at,
          closer_id,
          organization_id,
          closer:profiles!call_appointments_closer_id_fkey(email, full_name)
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

    // Fetch all closer notification configs for the relevant organization(s)
    const orgIds = [...new Set(dueReminders.map(r => {
      const appt = Array.isArray(r.appointment) ? r.appointment[0] : r.appointment;
      return appt?.organization_id;
    }).filter(Boolean))];

    const { data: allCloserConfigs } = await supabase
      .from('closer_notification_configs')
      .select('closer_id, is_active, organization_id')
      .in('organization_id', orgIds)
      .eq('is_active', true);

    // Build a set of enabled closer IDs
    const enabledCloserIds = new Set(
      (allCloserConfigs || []).map(c => c.closer_id)
    );

    console.log(`Found ${enabledCloserIds.size} closers with active notification configs`);

    // Separate reminders into categories
    const remindersToSkip: any[] = [];
    const enabledReminders: any[] = [];
    const nonEnabledReminders: any[] = [];

    for (const reminder of dueReminders) {
      const appointment = Array.isArray(reminder.appointment) ? reminder.appointment[0] : reminder.appointment;
      const closer = Array.isArray(appointment?.closer) ? appointment.closer[0] : appointment?.closer;
      const closerId = appointment?.closer_id;
      const appointmentCreatedAt = appointment?.created_at;
      const reminderTime = reminder.reminder_time;

      // Check if this reminder was already past when the appointment was booked
      if (appointmentCreatedAt && reminderTime) {
        const createdAt = new Date(appointmentCreatedAt);
        const reminderDateTime = new Date(reminderTime);
        
        if (reminderDateTime < createdAt) {
          remindersToSkip.push(reminder);
          console.log(`Reminder ${reminder.id} (${reminder.reminder_type}) was past at booking time - will skip`);
          continue;
        }
      }

      // Check if this closer has an active notification config
      if (closerId && enabledCloserIds.has(closerId)) {
        enabledReminders.push(reminder);
      } else {
        nonEnabledReminders.push(reminder);
        console.log(`Reminder ${reminder.id} - closer ${closer?.full_name || closerId} has no active notification config`);
      }
    }

    console.log(`${remindersToSkip.length} reminders to skip (past at booking time)`);
    console.log(`${enabledReminders.length} reminders for configured closers`);
    console.log(`${nonEnabledReminders.length} reminders for non-configured closers`);

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

    // Mark non-enabled reminders as skipped (no notification config)
    if (nonEnabledReminders.length > 0) {
      const nonEnabledIds = nonEnabledReminders.map((r: any) => r.id);
      await supabase
        .from('call_reminders')
        .update({ status: 'skipped' })
        .in('id', nonEnabledIds);
      
      console.log(`Marked ${nonEnabledIds.length} non-configured reminders as skipped`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        skipped: remindersToSkip.length,
        nonConfigured: nonEnabledReminders.length,
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
