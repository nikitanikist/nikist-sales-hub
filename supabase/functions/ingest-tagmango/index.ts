import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PabblyPayload {
  name: string;
  email: string;
  phone: string | number;
  workshop_name: string;
  amount: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received Pabbly webhook request');

    // Parse incoming JSON
    const payload: PabblyPayload = await req.json();
    console.log('Payload received:', JSON.stringify(payload, null, 2));

    // Validate required fields
    const errors: string[] = [];
    
    if (!payload.name || typeof payload.name !== 'string' || payload.name.trim().length === 0) {
      errors.push('name is required and must be a non-empty string');
    }
    if (!payload.email || typeof payload.email !== 'string' || !payload.email.includes('@')) {
      errors.push('email is required and must be a valid email address');
    }
    
    // Convert phone to string if it's a number
    const phoneValue = typeof payload.phone === 'number' ? String(payload.phone) : payload.phone;
    if (!phoneValue || phoneValue.trim().length === 0) {
      errors.push('phone is required and must be a non-empty string');
    }
    
    if (!payload.workshop_name || typeof payload.workshop_name !== 'string' || payload.workshop_name.trim().length === 0) {
      errors.push('workshop_name is required and must be a non-empty string');
    }
    if (typeof payload.amount !== 'number' || payload.amount < 0) {
      errors.push('amount is required and must be a non-negative number');
    }

    // Additional validation
    if (payload.name && payload.name.length > 255) {
      errors.push('name must be less than 255 characters');
    }
    if (payload.email && payload.email.length > 255) {
      errors.push('email must be less than 255 characters');
    }
    if (phoneValue && phoneValue.length > 20) {
      errors.push('phone must be less than 20 characters');
    }
    if (payload.workshop_name && payload.workshop_name.length > 255) {
      errors.push('workshop_name must be less than 255 characters');
    }

    if (errors.length > 0) {
      console.error('Validation failed:', errors);
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Map Pabbly fields to database columns
    const leadData = {
      contact_name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: phoneValue.trim(),
      workshop_name: payload.workshop_name.trim(),
      company_name: payload.workshop_name.trim(), // Using workshop name as company name
      value: payload.amount,
      source: 'tagmango',
      status: 'new',
      notes: `Lead created via Pabbly webhook at ${new Date().toISOString()}`,
      created_by: null, // External lead, no user_id
      assigned_to: null, // Not assigned yet
    };

    console.log('Inserting lead data:', JSON.stringify(leadData, null, 2));

    // Insert into leads table
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Database error', 
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Lead created successfully:', data.id);

    // Check if workshop exists with this name
    const { data: existingWorkshop, error: workshopCheckError } = await supabase
      .from('workshops')
      .select('id')
      .ilike('title', payload.workshop_name.trim())
      .maybeSingle();

    if (workshopCheckError) {
      console.error('Error checking workshop:', workshopCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'Workshop check error', 
          details: workshopCheckError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let workshopId: string;

    if (existingWorkshop) {
      // Workshop exists, use its ID
      workshopId = existingWorkshop.id;
      console.log('Using existing workshop:', workshopId);
    } else {
      // Create new workshop
      const newWorkshopData = {
        title: payload.workshop_name.trim(),
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
        status: 'planned',
        is_free: payload.amount === 0,
        ad_spend: 0,
        created_by: '00000000-0000-0000-0000-000000000000', // System-generated workshop
      };

      const { data: newWorkshop, error: workshopCreateError } = await supabase
        .from('workshops')
        .insert(newWorkshopData)
        .select()
        .single();

      if (workshopCreateError) {
        console.error('Error creating workshop:', workshopCreateError);
        return new Response(
          JSON.stringify({ 
            error: 'Workshop creation error', 
            details: workshopCreateError.message 
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      workshopId = newWorkshop.id;
      console.log('Created new workshop:', workshopId);
    }

    // Create lead assignment
    const assignmentData = {
      lead_id: data.id,
      workshop_id: workshopId,
      funnel_id: null,
      product_id: null,
      is_connected: false,
      created_by: null,
    };

    const { error: assignmentError } = await supabase
      .from('lead_assignments')
      .insert(assignmentData);

    if (assignmentError) {
      console.error('Error creating lead assignment:', assignmentError);
      return new Response(
        JSON.stringify({ 
          error: 'Lead assignment error', 
          details: assignmentError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Lead assignment created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lead created and assigned to workshop successfully',
        lead_id: data.id,
        workshop_id: workshopId
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
