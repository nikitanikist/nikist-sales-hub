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
  'Mango Id'?: string;
  'country code'?: string;
}

// Target Mango ID for sending WhatsApp confirmations
const TARGET_MANGO_ID = '689b7b7e37ddd15a781ec63b';

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

    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedWorkshopName = payload.workshop_name.trim();

    // Check for duplicate lead (same email + workshop_name)
    const { data: existingLead, error: duplicateCheckError } = await supabase
      .from('leads')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('workshop_name', normalizedWorkshopName)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error('Error checking for duplicate lead:', duplicateCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'Duplicate check error', 
          details: duplicateCheckError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingLead) {
      console.log('Duplicate lead detected for email:', normalizedEmail, 'and workshop:', normalizedWorkshopName);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead already exists for this workshop',
          lead_id: existingLead.id,
          is_duplicate: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Format country code - strip + if present, default to 91 for India
    let countryCode = '91';
    if (payload['country code']) {
      countryCode = String(payload['country code']).replace('+', '').trim();
    }

    // Map Pabbly fields to database columns
    const leadData = {
      contact_name: payload.name.trim(),
      email: normalizedEmail,
      phone: phoneValue.trim(),
      workshop_name: normalizedWorkshopName,
      company_name: normalizedWorkshopName, // Using workshop name as company name
      value: payload.amount,
      source: 'tagmango',
      status: 'new',
      notes: `Lead created via Pabbly webhook at ${new Date().toISOString()}`,
      created_by: null, // External lead, no user_id
      assigned_to: null, // Not assigned yet
      mango_id: payload['Mango Id'] || null,
      country: countryCode, // Store country code
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
      .ilike('title', normalizedWorkshopName)
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
        title: normalizedWorkshopName,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 day
        status: 'planned',
        is_free: payload.amount === 0,
        ad_spend: 0,
        created_by: 'efff01b2-c24a-4256-9a91-11459fe27386', // Admin user
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

    // Send WhatsApp confirmation if Mango ID matches target
    if (payload['Mango Id'] === TARGET_MANGO_ID) {
      console.log('Mango ID matches target, sending WhatsApp confirmation...');
      
      try {
        // Extract date from workshop name (after "<>")
        let workshopDate = '';
        let workshopTitle = normalizedWorkshopName;
        
        if (normalizedWorkshopName.includes('<>')) {
          const parts = normalizedWorkshopName.split('<>');
          workshopTitle = parts[0].trim();
          workshopDate = parts[1]?.trim() || '';
        }

        // Format phone with country code
        const formattedPhone = `${countryCode}${phoneValue.trim()}`;
        
        const AISENSY_FREE_API_KEY = Deno.env.get('AISENSY_FREE_API_KEY');
        const AISENSY_FREE_SOURCE = Deno.env.get('AISENSY_FREE_SOURCE');

        if (!AISENSY_FREE_API_KEY || !AISENSY_FREE_SOURCE) {
          console.error('Missing AiSensy FREE configuration');
        } else {
          const whatsappPayload = {
            apiKey: AISENSY_FREE_API_KEY,
            campaignName: 'class_registration_confirmation_copy',
            destination: formattedPhone,
            userName: payload.name.trim(),
            templateParams: [
              payload.name.trim(),           // Variable 1: Name
              workshopTitle,                  // Variable 2: Workshop name
              workshopDate,                   // Variable 3: Date (e.g., "11th December")
              '7 PM',                         // Variable 4: Time
              'https://nikist.in/registrartionsuccessful'  // Variable 5: URL
            ],
            source: AISENSY_FREE_SOURCE,
            buttons: []
          };

          console.log('Sending WhatsApp confirmation:', JSON.stringify(whatsappPayload, null, 2));

          const whatsappResponse = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(whatsappPayload),
          });

          const whatsappResult = await whatsappResponse.text();
          console.log('WhatsApp API response:', whatsappResponse.status, whatsappResult);

          if (!whatsappResponse.ok) {
            console.error('WhatsApp API error:', whatsappResult);
          } else {
            console.log('WhatsApp confirmation sent successfully');
          }
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp confirmation:', whatsappError);
        // Don't fail the whole request if WhatsApp fails
      }

      // Send data to Google Sheet for the same Mango ID
      try {
        const GOOGLE_SHEET_WEBHOOK_URL = Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL');
        
        if (!GOOGLE_SHEET_WEBHOOK_URL) {
          console.error('Missing GOOGLE_SHEET_WEBHOOK_URL configuration');
        } else {
          // Format registration date in IST (India Standard Time)
          const registrationDate = new Date().toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });

          const sheetPayload = {
            name: payload.name.trim(),
            email: normalizedEmail,
            countryCode: countryCode,
            phone: phoneValue.trim(),
            service: normalizedWorkshopName,
            registrationDate: registrationDate
          };

          console.log('Sending data to Google Sheet:', JSON.stringify(sheetPayload, null, 2));

          const sheetResponse = await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sheetPayload),
          });

          const sheetResult = await sheetResponse.text();
          console.log('Google Sheet API response:', sheetResponse.status, sheetResult);

          if (!sheetResponse.ok) {
            console.error('Google Sheet API error:', sheetResult);
          } else {
            console.log('Google Sheet entry added successfully');
          }
        }
      } catch (sheetError) {
        console.error('Error adding to Google Sheet:', sheetError);
        // Don't fail the whole request if Google Sheet fails
      }
    } else {
      console.log('Mango ID does not match target, skipping WhatsApp confirmation');
    }

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
