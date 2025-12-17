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
  // UTM tracking fields
  'Utm Term'?: string | number;
  'Utm Source'?: string;
  'Utm Medium'?: string;
  'Utm Content'?: string | number;
  'Utm Campaign'?: string | number;
}

// Target Mango IDs for sending WhatsApp confirmations
const TARGET_MANGO_ID_CRYPTO = '689b7b7e37ddd15a781ec63b';
const TARGET_MANGO_ID_YOUTUBE = '6899e47bfa8e61e188499df3';

// Helper function to determine if a NEW item is a Product or Workshop (only used for items not found in DB)
const isProduct = (name: string, amount: number): boolean => {
  const productKeywords = [
    'mentorship', 'insider', 'recordings', 'community class', 
    'partial access', 'full access', 'half access', 'bonus', 'call bonus',
    'batch', 'emi', 'one to one', '1 to 1', 'crypto club',
    'mean coin', 'futures'
  ];
  const workshopKeywords = [
    'masterclass', 'webinar', 'workshop', 'live class', 'session'
  ];
  
  const lowerName = name.toLowerCase();
  
  // Priority 1: Workshop keywords → always workshop
  if (workshopKeywords.some(kw => lowerName.includes(kw))) {
    return false;
  }
  
  // Priority 2: Product keywords → always product (REGARDLESS OF PRICE)
  if (productKeywords.some(kw => lowerName.includes(kw))) {
    return true;
  }
  
  // Default: Free = Workshop, Paid = Product
  return amount > 0;
};

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
    const mangoId = payload['Mango Id'] || null;

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

    // Track if this is a duplicate - we'll still send WhatsApp but skip DB operations
    const isDuplicate = !!existingLead;
    let leadId: string | null = existingLead?.id || null;
    let workshopId: string | null = null;
    let productId: string | null = null;

    if (isDuplicate) {
      console.log('Duplicate lead detected for email:', normalizedEmail, 'and workshop:', normalizedWorkshopName);
      console.log('Will still send WhatsApp confirmation for duplicate registration');
    }

    // Format country code - strip + if present, default to 91 for India
    let countryCode = '91';
    if (payload['country code']) {
      countryCode = String(payload['country code']).replace('+', '').trim();
    }

    // Only create lead and assignments if NOT a duplicate
    if (!isDuplicate) {
      // Map Pabbly fields to database columns
      const leadData = {
        contact_name: payload.name.trim(),
        email: normalizedEmail,
        phone: phoneValue.trim(),
        workshop_name: normalizedWorkshopName,
        company_name: normalizedWorkshopName,
        value: payload.amount,
        source: 'tagmango',
        status: 'new',
        notes: `Lead created via Pabbly webhook at ${new Date().toISOString()}`,
        created_by: null,
        assigned_to: null,
        mango_id: mangoId,
        country: countryCode,
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

      leadId = data.id;
      console.log('Lead created successfully:', leadId);

      // ============ DATABASE-FIRST MATCHING ============
      // STEP 1: Check if name exists in PRODUCTS table first
      console.log('Checking PRODUCTS table for:', normalizedWorkshopName);
      
      const { data: existingProduct, error: productCheckError } = await supabase
        .from('products')
        .select('id, funnel_id, mango_id')
        .ilike('product_name', normalizedWorkshopName)
        .maybeSingle();

      if (productCheckError) {
        console.error('Error checking products:', productCheckError);
      }

      if (existingProduct) {
        // FOUND IN PRODUCTS → It's a PRODUCT!
        console.log('Found existing product by name:', existingProduct.id);
        productId = existingProduct.id;
        
        // Update mango_id if the product doesn't have one but we received one
        if (mangoId && !existingProduct.mango_id) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ mango_id: mangoId })
            .eq('id', productId);
          
          if (updateError) {
            console.error('Error updating product mango_id:', updateError);
          } else {
            console.log('Updated product mango_id to:', mangoId);
          }
        }
        
        // Create lead assignment with product
        const assignmentData = {
          lead_id: leadId,
          workshop_id: null,
          funnel_id: existingProduct.funnel_id,
          product_id: productId,
          is_connected: false,
          created_by: null,
        };

        const { error: assignmentError } = await supabase
          .from('lead_assignments')
          .insert(assignmentData);

        if (assignmentError) {
          console.error('Error creating lead assignment:', assignmentError);
        } else {
          console.log('Lead assignment created with existing product');
        }
        
      } else {
        // STEP 2: Not in products → Check WORKSHOPS table by name
        console.log('Not found in products, checking WORKSHOPS table for:', normalizedWorkshopName);
        
        const { data: existingWorkshop, error: workshopCheckError } = await supabase
          .from('workshops')
          .select('id')
          .ilike('title', normalizedWorkshopName)
          .maybeSingle();

        if (workshopCheckError) {
          console.error('Error checking workshops:', workshopCheckError);
        }

        if (existingWorkshop) {
          // FOUND IN WORKSHOPS → It's a WORKSHOP!
          console.log('Found existing workshop by name:', existingWorkshop.id);
          workshopId = existingWorkshop.id;
          
          // Create lead assignment with workshop
          const assignmentData = {
            lead_id: leadId,
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
          } else {
            console.log('Lead assignment created with existing workshop');
          }
          
        } else {
          // STEP 3: NOT FOUND IN EITHER → Use classification to CREATE new entry
          const isProductItem = isProduct(normalizedWorkshopName, payload.amount);
          console.log(`New item "${normalizedWorkshopName}" not found in DB, classified as: ${isProductItem ? 'PRODUCT' : 'WORKSHOP'}`);
          
          if (isProductItem) {
            // CREATE NEW PRODUCT
            console.log('Creating new product:', normalizedWorkshopName);
            
            // Get the first available funnel for the new product
            const { data: defaultFunnel } = await supabase
              .from('funnels')
              .select('id')
              .limit(1)
              .maybeSingle();

            const funnelId = defaultFunnel?.id || null;

            if (funnelId) {
              const newProductData = {
                product_name: normalizedWorkshopName,
                description: `Product created via TagMango webhook`,
                price: payload.amount,
                funnel_id: funnelId,
                is_active: true,
                mango_id: mangoId,
                created_by: null,
              };

              const { data: newProduct, error: productCreateError } = await supabase
                .from('products')
                .insert(newProductData)
                .select()
                .single();

              if (productCreateError) {
                console.error('Error creating product:', productCreateError);
              } else {
                productId = newProduct.id;
                console.log('Created new product:', productId);

                // Create lead assignment with new product
                const assignmentData = {
                  lead_id: leadId,
                  workshop_id: null,
                  funnel_id: funnelId,
                  product_id: productId,
                  is_connected: false,
                  created_by: null,
                };

                const { error: assignmentError } = await supabase
                  .from('lead_assignments')
                  .insert(assignmentData);

                if (assignmentError) {
                  console.error('Error creating lead assignment:', assignmentError);
                } else {
                  console.log('Lead assignment created with new product');
                }
              }
            } else {
              console.error('No funnel available for new product');
            }
          } else {
            // CREATE NEW WORKSHOP
            console.log('Creating new workshop:', normalizedWorkshopName);
            
            const newWorkshopData = {
              title: normalizedWorkshopName,
              start_date: new Date().toISOString(),
              end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              status: 'planned',
              is_free: payload.amount === 0,
              ad_spend: 0,
              created_by: 'efff01b2-c24a-4256-9a91-11459fe27386',
            };

            const { data: newWorkshop, error: workshopCreateError } = await supabase
              .from('workshops')
              .insert(newWorkshopData)
              .select()
              .single();

            if (workshopCreateError) {
              console.error('Error creating workshop:', workshopCreateError);
            } else {
              workshopId = newWorkshop.id;
              console.log('Created new workshop:', workshopId);

              // Create lead assignment with new workshop
              const assignmentData = {
                lead_id: leadId,
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
              } else {
                console.log('Lead assignment created with new workshop');
              }
            }
          }
        }
      }
    }

    // Extract date and title from workshop name (for WhatsApp templates)
    let workshopDate = '';
    let workshopTitle = normalizedWorkshopName;
    
    if (normalizedWorkshopName.includes('<>')) {
      const parts = normalizedWorkshopName.split('<>');
      workshopTitle = parts[0].trim();
      workshopDate = parts[1]?.trim() || '';
    }

    // Format phone with country code
    const formattedPhone = `${countryCode}${phoneValue.trim()}`;

    // Send WhatsApp confirmation based on Mango ID (ALWAYS - even for duplicates)

    if (mangoId === TARGET_MANGO_ID_CRYPTO) {
      // Crypto registration confirmation
      console.log('Mango ID matches CRYPTO target, sending WhatsApp confirmation...');
      if (isDuplicate) {
        console.log('Sending WhatsApp for DUPLICATE registration');
      }
      
      try {
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

          console.log('Sending Crypto WhatsApp confirmation:', JSON.stringify(whatsappPayload, null, 2));

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
            console.log('Crypto WhatsApp confirmation sent successfully');
          }
        }
      } catch (whatsappError) {
        console.error('Error sending Crypto WhatsApp confirmation:', whatsappError);
      }

      // Send data to Google Sheet for Crypto Mango ID (only for new leads)
      if (!isDuplicate) {
        try {
          const GOOGLE_SHEET_WEBHOOK_URL = Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL');
          
          if (!GOOGLE_SHEET_WEBHOOK_URL) {
            console.error('Missing GOOGLE_SHEET_WEBHOOK_URL configuration');
          } else {
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
              registrationDate: registrationDate,
              // UTM tracking fields
              utmTerm: String(payload['Utm Term'] || ''),
              utmSource: payload['Utm Source'] || '',
              utmMedium: payload['Utm Medium'] || '',
              utmContent: String(payload['Utm Content'] || ''),
              utmCampaign: String(payload['Utm Campaign'] || ''),
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
        }
      } else {
        console.log('Skipping Google Sheet for duplicate registration');
      }

    } else if (mangoId === TARGET_MANGO_ID_YOUTUBE) {
      // YouTube registration confirmation
      console.log('Mango ID matches YOUTUBE target, sending WhatsApp confirmation...');
      if (isDuplicate) {
        console.log('Sending WhatsApp for DUPLICATE registration');
      }
      
      try {
        const AISENSY_FREE_API_KEY = Deno.env.get('AISENSY_FREE_API_KEY');
        const AISENSY_FREE_SOURCE = Deno.env.get('AISENSY_FREE_SOURCE');

        if (!AISENSY_FREE_API_KEY || !AISENSY_FREE_SOURCE) {
          console.error('Missing AiSensy FREE configuration');
        } else {
          const whatsappPayload = {
            apiKey: AISENSY_FREE_API_KEY,
            campaignName: 'youtube_registration_confirmation',
            destination: formattedPhone,
            userName: payload.name.trim(),
            templateParams: [
              payload.name.trim(),           // Variable 1: Name
              workshopTitle,                  // Variable 2: Workshop name
              workshopDate,                   // Variable 3: Date (e.g., "11th December")
              '7 PM',                         // Variable 4: Time
              'https://nikistschool.in/yt'   // Variable 5: URL
            ],
            source: AISENSY_FREE_SOURCE,
            buttons: []
          };

          console.log('Sending YouTube WhatsApp confirmation:', JSON.stringify(whatsappPayload, null, 2));

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
            console.log('YouTube WhatsApp confirmation sent successfully');
          }
        }
      } catch (whatsappError) {
        console.error('Error sending YouTube WhatsApp confirmation:', whatsappError);
      }

      // Send data to YouTube Google Sheet (for ALL registrations including duplicates)
      try {
        const GOOGLE_SHEET_YOUTUBE_WEBHOOK_URL = Deno.env.get('GOOGLE_SHEET_YOUTUBE_WEBHOOK_URL');
        
        if (!GOOGLE_SHEET_YOUTUBE_WEBHOOK_URL) {
          console.error('Missing GOOGLE_SHEET_YOUTUBE_WEBHOOK_URL configuration');
        } else {
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

          console.log('Sending data to YouTube Google Sheet:', JSON.stringify(sheetPayload, null, 2));

          const sheetResponse = await fetch(GOOGLE_SHEET_YOUTUBE_WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(sheetPayload),
          });

          const sheetResult = await sheetResponse.text();
          console.log('YouTube Google Sheet API response:', sheetResponse.status, sheetResult);

          if (!sheetResponse.ok) {
            console.error('YouTube Google Sheet API error:', sheetResult);
          } else {
            console.log('YouTube Google Sheet entry added successfully');
          }
        }
      } catch (sheetError) {
        console.error('Error adding to YouTube Google Sheet:', sheetError);
      }

    } else {
      console.log('Mango ID does not match any target, skipping WhatsApp confirmation');
    }

    // Return appropriate response based on duplicate status
    if (isDuplicate) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Duplicate registration - WhatsApp confirmation sent',
          lead_id: leadId,
          is_duplicate: true
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Lead created and assigned successfully',
        lead_id: leadId,
        workshop_id: workshopId,
        product_id: productId,
        is_duplicate: false
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
