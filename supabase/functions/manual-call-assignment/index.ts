import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead_id, closer_id, scheduled_date, scheduled_time, zoom_link } = await req.json();

    console.log('Manual call assignment request:', { lead_id, closer_id, scheduled_date, scheduled_time, zoom_link });

    // Validate required fields
    if (!lead_id || !closer_id || !scheduled_date || !scheduled_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: lead_id, closer_id, scheduled_date, scheduled_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify lead exists
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_name, email, phone')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify closer exists
    const { data: closer, error: closerError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', closer_id)
      .single();

    if (closerError || !closer) {
      console.error('Closer not found:', closerError);
      return new Response(
        JSON.stringify({ error: 'Closer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead:', lead.contact_name, '| Closer:', closer.full_name);

    // Update lead assignment
    const { error: updateLeadError } = await supabase
      .from('leads')
      .update({ 
        assigned_to: closer_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id);

    if (updateLeadError) {
      console.error('Error updating lead assignment:', updateLeadError);
    }

    // Create call appointment (trigger will automatically create reminders)
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .insert({
        lead_id,
        closer_id,
        scheduled_date,
        scheduled_time,
        zoom_link: zoom_link || null,
        status: 'scheduled'
      })
      .select()
      .single();

    if (appointmentError) {
      console.error('Error creating appointment:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Failed to create appointment', details: appointmentError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment created successfully:', appointment.id);
    console.log('Reminders will be created automatically by database trigger');

    // Send notification to closer
    let closerNotificationSent = false;
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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
      JSON.stringify({
        success: true,
        message: 'Call assigned successfully',
        closer_notification_sent: closerNotificationSent,
        appointment: {
          id: appointment.id,
          lead_name: lead.contact_name,
          closer_name: closer.full_name,
          scheduled_date,
          scheduled_time,
          zoom_link: zoom_link || 'Not provided'
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in manual-call-assignment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
