import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Template for booking confirmation (using Akansha's template which works for all)
const BOOKING_TEMPLATE = '1_to_1_call_booking_crypto_nikist_video';
const VIDEO_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/VIDEO/66f4f03f444c5c0b8013168b/5384969_1706706new video 1 14.mp4';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const aisensyApiKey = Deno.env.get('AISENSY_API_KEY');
    const aisensySource = Deno.env.get('AISENSY_SOURCE');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { appointment_id, new_date, new_time } = await req.json();

    console.log('Rebook call request:', { appointment_id, new_date, new_time });

    // Validate required fields
    if (!appointment_id || !new_date || !new_time) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: appointment_id, new_date, new_time' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch current appointment with lead and closer details
    const { data: appointment, error: appointmentError } = await supabase
      .from('call_appointments')
      .select(`
        *,
        lead:leads(id, contact_name, email, phone),
        closer:profiles!call_appointments_closer_id_fkey(id, full_name, email)
      `)
      .eq('id', appointment_id)
      .single();

    if (appointmentError || !appointment) {
      console.error('Appointment not found:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = appointment.lead;
    const closer = appointment.closer;

    if (!lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found for this appointment' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Rebooking call for:', lead.contact_name, '| Closer:', closer?.full_name);

    // Save previous schedule and update appointment
    const { error: updateError } = await supabase
      .from('call_appointments')
      .update({
        previous_scheduled_date: appointment.scheduled_date,
        previous_scheduled_time: appointment.scheduled_time,
        scheduled_date: new_date,
        scheduled_time: new_time,
        status: 'scheduled',
        was_rescheduled: true,
        rescheduled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', appointment_id);

    if (updateError) {
      console.error('Error updating appointment:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update appointment', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Appointment updated successfully');
    console.log('Reminders will be recalculated automatically by database trigger');

    // Send WhatsApp confirmation message
    let whatsappSent = false;
    let whatsappError = null;

    if (aisensyApiKey && aisensySource && lead.phone) {
      try {
        // Format customer phone
        const customerPhone = lead.phone.replace(/\D/g, '');
        const phoneWithCountry = customerPhone.startsWith('91') ? customerPhone : `91${customerPhone}`;

        // Format date and time
        const callDate = new Date(new_date);
        const formattedDate = callDate.toLocaleDateString('en-IN', { 
          day: 'numeric', 
          month: 'long' 
        });
        
        const [hours, minutes] = new_time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        const formattedTime = `${hour12}:${minutes} ${ampm} IST`;

        // Build template params (using Akansha's format - 6 params)
        const templateParams = [
          lead.contact_name,
          'Our Crypto Expert',
          formattedDate,
          formattedTime,
          'you will get zoom link 30 minutes before the zoom call',
          '+919266395637',
        ];

        console.log('Sending WhatsApp confirmation:', {
          phone: phoneWithCountry,
          template: BOOKING_TEMPLATE,
          params: templateParams,
        });

        // Build WhatsApp payload
        const whatsappPayload = {
          apiKey: aisensyApiKey,
          campaignName: BOOKING_TEMPLATE,
          destination: phoneWithCountry,
          userName: 'Crypto Call',
          source: aisensySource,
          templateParams,
          media: {
            url: VIDEO_URL,
            filename: 'booking.mp4',
          },
        };

        // Send WhatsApp message
        const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(whatsappPayload),
        });

        const whatsappResult = await whatsappResponse.json();
        console.log('WhatsApp API response:', whatsappResult);

        whatsappSent = whatsappResponse.ok;
        if (!whatsappResponse.ok) {
          whatsappError = whatsappResult;
        }

        // Update the call_booked reminder status to 'sent'
        const { error: reminderUpdateError } = await supabase
          .from('call_reminders')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .eq('appointment_id', appointment_id)
          .eq('reminder_type', 'call_booked');

        if (reminderUpdateError) {
          console.error('Error updating call_booked reminder:', reminderUpdateError);
        }

      } catch (error) {
        console.error('Error sending WhatsApp:', error);
        whatsappError = error instanceof Error ? error.message : 'Unknown error';
      }
    } else {
      console.log('WhatsApp not sent - missing AiSensy config or phone number');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Call rebooked successfully',
        appointment: {
          id: appointment_id,
          lead_name: lead.contact_name,
          closer_name: closer?.full_name || 'Unknown',
          previous_date: appointment.scheduled_date,
          previous_time: appointment.scheduled_time,
          new_date,
          new_time,
        },
        whatsapp: {
          sent: whatsappSent,
          error: whatsappError,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in rebook-call:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
