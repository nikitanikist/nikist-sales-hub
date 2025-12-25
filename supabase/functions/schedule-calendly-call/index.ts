import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Dipanshu's email - for Dipanshu, calls are booked via Calendly webhook
const DIPANSHU_EMAIL = "nikistofficial@gmail.com";

serve(async (req) => {
  // Handle CORS preflight requests
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

    const { lead_id, closer_id, scheduled_date, scheduled_time, user_id } = await req.json();
    
    console.log('Received request:', { lead_id, closer_id, scheduled_date, scheduled_time, user_id });

    // Fetch lead details
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead fetch error:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch closer details
    const { data: closer, error: closerError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', closer_id)
      .single();

    if (closerError || !closer) {
      console.error('Closer fetch error:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is Dipanshu - for Dipanshu, calls should be booked via Calendly
    const isDipanshu = closer.email?.toLowerCase() === DIPANSHU_EMAIL.toLowerCase();
    
    if (isDipanshu) {
      // For Dipanshu, calls should be booked directly in Calendly (webhook handles sync)
      console.log('Dipanshu closer - calls should be booked via Calendly');
      return new Response(
        JSON.stringify({ 
          error: 'For Dipanshu, please book calls directly in Calendly. The booking will sync automatically.',
          use_calendly: true 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For non-Dipanshu closers: create appointment directly in database
    console.log('Non-Dipanshu closer, creating appointment directly');
    
    // Assign lead to closer
    const { error: assignError } = await supabase
      .from('leads')
      .update({ assigned_to: closer_id })
      .eq('id', lead_id);

    if (assignError) {
      console.error('Lead assignment error:', assignError);
      throw assignError;
    }

    // Create call appointment
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .insert({
        lead_id,
        closer_id,
        scheduled_date,
        scheduled_time,
        status: 'scheduled',
        created_by: user_id,
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Appointment creation error:', appointmentError);
      throw appointmentError;
    }

    console.log('Appointment created:', appointment.id);

    // Send notification to closer
    let closerNotificationSent = false;
    try {
      console.log('Sending notification to closer for appointment:', appointment.id);
      const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-closer-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ appointment_id: appointment.id }),
      });
      const notificationResult = await notificationResponse.json();
      console.log('Closer notification result:', notificationResult);
      closerNotificationSent = notificationResponse.ok;
    } catch (notificationError) {
      console.error('Error sending closer notification:', notificationError);
    }

    return new Response(
      JSON.stringify({ success: true, appointment, calendly: false, closer_notification_sent: closerNotificationSent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in schedule-calendly-call:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
