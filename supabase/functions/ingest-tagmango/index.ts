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

// Helper function to parse date from workshop name like "9th January", "25th December"
const parseDateFromWorkshopName = (workshopName: string): Date | null => {
  // Match patterns like "<> 9th January" or "<> 25th December"
  const match = workshopName.match(/<>\s*(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)/i);
  if (!match) return null;
  
  const day = parseInt(match[1]);
  const monthName = match[2].toLowerCase();
  
  const monthMap: { [key: string]: number } = {
    'january': 0, 'jan': 0,
    'february': 1, 'feb': 1,
    'march': 2, 'mar': 2,
    'april': 3, 'apr': 3,
    'may': 4,
    'june': 5, 'jun': 5,
    'july': 6, 'jul': 6,
    'august': 7, 'aug': 7,
    'september': 8, 'sep': 8, 'sept': 8,
    'october': 9, 'oct': 9,
    'november': 10, 'nov': 10,
    'december': 11, 'dec': 11
  };
  
  const month = monthMap[monthName];
  if (month === undefined) return null;
  
  // Determine year (use current year, or next year if the date has passed)
  const now = new Date();
  let year = now.getFullYear();
  
  // Default workshop time: 7:00 PM IST = 13:30 UTC
  // IST is UTC+5:30, so 19:00 IST = 19:00 - 5:30 = 13:30 UTC
  const defaultWorkshopTimeUtcHour = 13;
  const defaultWorkshopTimeUtcMinute = 30;
  
  const tentativeDate = new Date(Date.UTC(year, month, day, defaultWorkshopTimeUtcHour, defaultWorkshopTimeUtcMinute, 0));
  
  // If the date is more than 2 months in the past, assume next year
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
  
  if (tentativeDate < twoMonthsAgo) {
    year++;
  }
  
  return new Date(Date.UTC(year, month, day, defaultWorkshopTimeUtcHour, defaultWorkshopTimeUtcMinute, 0));
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let eventId: string | null = null;

  // Initialize Supabase client with service role key
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('Received Pabbly webhook request');

    // Parse incoming JSON
    const payload: PabblyPayload = await req.json();
    console.log('Payload received:', JSON.stringify(payload, null, 2));

    // Create webhook event log entry
    const { data: eventData } = await supabase
      .from('webhook_ingest_events')
      .insert({
        source: 'tagmango',
        email: payload.email || null,
        workshop_name: payload.workshop_name || null,
        mango_id: payload['Mango Id'] || null,
        amount: payload.amount || 0,
        result: 'pending',
      })
      .select('id')
      .single();
    
    eventId = eventData?.id || null;
    console.log('Created webhook event:', eventId);

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
      
      // Update webhook event with error
      if (eventId) {
        await supabase
          .from('webhook_ingest_events')
          .update({
            result: 'error',
            error_message: errors.join('; '),
            processing_time_ms: Date.now() - startTime,
          })
          .eq('id', eventId);
      }
      
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

    const normalizedEmail = payload.email.trim().toLowerCase();
    const normalizedWorkshopName = payload.workshop_name.trim();
    const mangoId = payload['Mango Id'] || null;

    // Format country code - strip + if present, default to 91 for India
    let countryCode = '91';
    if (payload['country code']) {
      countryCode = String(payload['country code']).replace('+', '').trim();
    }

    let workshopId: string | null = null;
    let productId: string | null = null;
    let leadId: string | null = null;
    let isExistingLead = false;

    // STEP 1: Check if a lead with this email already exists (ONE lead per customer)
    const { data: existingLead, error: leadCheckError } = await supabase
      .from('leads')
      .select('id')
      .eq('email', normalizedEmail)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (leadCheckError) {
      console.error('Error checking for existing lead:', leadCheckError);
      
      // Update webhook event with error
      if (eventId) {
        await supabase
          .from('webhook_ingest_events')
          .update({
            result: 'error',
            error_message: `Lead check error: ${leadCheckError.message}`,
            processing_time_ms: Date.now() - startTime,
          })
          .eq('id', eventId);
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Lead check error', 
          details: leadCheckError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (existingLead) {
      // Reuse existing lead - ONE lead per customer
      leadId = existingLead.id;
      isExistingLead = true;
      console.log('Found existing lead for email:', normalizedEmail, 'using lead_id:', leadId);
    } else {
      // Create new lead only if customer doesn't exist
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

      console.log('Creating new lead:', JSON.stringify(leadData, null, 2));

      const { data, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        
        // Update webhook event with error
        if (eventId) {
          await supabase
            .from('webhook_ingest_events')
            .update({
              result: 'error',
              error_message: `Database error: ${error.message}`,
              processing_time_ms: Date.now() - startTime,
            })
            .eq('id', eventId);
        }
        
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
      console.log('New lead created:', leadId);
    }

    // Track if this is a duplicate assignment (same workshop/product for this lead)
    let isDuplicateAssignment = false;

    // ============ DATABASE-FIRST MATCHING ============
    // STEP 1: Check PRODUCTS table - first by mango_id (primary), then by name (fallback)
    let existingProduct = null;
    
    // Primary match: by mango_id (prevents duplicates from same TagMango product)
    if (mangoId) {
      console.log('Checking PRODUCTS table by mango_id:', mangoId);
      const { data: productByMangoId, error: mangoIdError } = await supabase
        .from('products')
        .select('id, funnel_id, mango_id')
        .eq('mango_id', mangoId)
        .maybeSingle();
      
      if (mangoIdError) {
        console.error('Error checking products by mango_id:', mangoIdError);
      }
      
      if (productByMangoId) {
        existingProduct = productByMangoId;
        console.log('Found existing product by mango_id:', existingProduct.id);
      }
    }
    
    // Fallback: by name (for backwards compatibility)
    if (!existingProduct) {
      console.log('Checking PRODUCTS table by name:', normalizedWorkshopName);
      const { data: productByName, error: productCheckError } = await supabase
        .from('products')
        .select('id, funnel_id, mango_id')
        .ilike('product_name', normalizedWorkshopName)
        .maybeSingle();

      if (productCheckError) {
        console.error('Error checking products by name:', productCheckError);
      }
      
      if (productByName) {
        existingProduct = productByName;
        console.log('Found existing product by name:', existingProduct.id);
      }
    }

    if (existingProduct) {
      // FOUND IN PRODUCTS → It's a PRODUCT!
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
      
      // Check if this assignment already exists
      const { data: existingAssignment } = await supabase
        .from('lead_assignments')
        .select('id')
        .eq('lead_id', leadId)
        .eq('product_id', productId)
        .maybeSingle();

      if (existingAssignment) {
        console.log('Duplicate assignment detected - lead already assigned to this product');
        isDuplicateAssignment = true;
      } else {
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
        
        // Check if this assignment already exists
        const { data: existingAssignment } = await supabase
          .from('lead_assignments')
          .select('id')
          .eq('lead_id', leadId)
          .eq('workshop_id', workshopId)
          .maybeSingle();

        if (existingAssignment) {
          console.log('Duplicate assignment detected - lead already assigned to this workshop');
          isDuplicateAssignment = true;
        } else {
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
          // CREATE NEW WORKSHOP with proper date parsing
          console.log('Creating new workshop:', normalizedWorkshopName);
          
          // Parse date from workshop name
          const parsedDate = parseDateFromWorkshopName(normalizedWorkshopName);
          let startDate: string;
          let endDate: string;
          
          if (parsedDate) {
            // Use parsed date with IST timezone offset
            startDate = parsedDate.toISOString();
            endDate = new Date(parsedDate.getTime() + 24 * 60 * 60 * 1000).toISOString();
            console.log(`Parsed date from workshop name: ${parsedDate.toDateString()}`);
          } else {
            // Fallback to current date
            startDate = new Date().toISOString();
            endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            console.log('No date found in workshop name, using current date');
          }
          
          // Fetch the default tag for this organization
          let defaultTagId: string | null = null;
          const { data: defaultTag, error: tagError } = await supabase
            .from('workshop_tags')
            .select('id')
            .eq('is_default', true)
            .limit(1)
            .maybeSingle();
          
          if (tagError) {
            console.error('Error fetching default tag:', tagError);
          } else if (defaultTag) {
            defaultTagId = defaultTag.id;
            console.log('Auto-assigning default tag:', defaultTagId);
          }
          
          const newWorkshopData = {
            title: normalizedWorkshopName,
            start_date: startDate,
            end_date: endDate,
            status: 'planned',
            is_free: payload.amount === 0,
            ad_spend: 0,
            created_by: 'efff01b2-c24a-4256-9a91-11459fe27386',
            tag_id: defaultTagId,
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

            // Auto-create WhatsApp community for the new workshop
            try {
              console.log('Triggering WhatsApp community creation for auto-created workshop:', workshopId);
              const createCommunityResponse = await fetch(
                `${supabaseUrl}/functions/v1/create-whatsapp-community`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    workshopId,
                    workshopName: normalizedWorkshopName,
                    organizationId: newWorkshop.organization_id
                  })
                }
              );
              
              if (!createCommunityResponse.ok) {
                console.error('Failed to create WhatsApp community:', await createCommunityResponse.text());
              } else {
                const communityResult = await createCommunityResponse.json();
                if (communityResult.success) {
                  console.log('WhatsApp community created for workshop:', communityResult.groupId);
                } else if (communityResult.skipped) {
                  console.log('WhatsApp community creation skipped:', communityResult.reason);
                } else {
                  console.warn('WhatsApp community creation unsuccessful:', communityResult);
                }
              }
            } catch (communityErr) {
              console.error('Error calling create-whatsapp-community:', communityErr);
              // Don't fail the webhook - workshop is still created
            }

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
      if (isDuplicateAssignment) {
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
      if (!isDuplicateAssignment) {
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
      if (isDuplicateAssignment) {
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

    // Update webhook event with success
    if (eventId) {
      await supabase
        .from('webhook_ingest_events')
        .update({
          result: isDuplicateAssignment ? 'duplicate' : 'success',
          lead_id: leadId,
          created_workshop_id: workshopId,
          created_product_id: productId,
          is_duplicate: isDuplicateAssignment,
          processing_time_ms: Date.now() - startTime,
        })
        .eq('id', eventId);
    }

    // Return appropriate response based on duplicate status
    if (isDuplicateAssignment) {
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
    
    // Update webhook event with error
    if (eventId) {
      await supabase
        .from('webhook_ingest_events')
        .update({
          result: 'error',
          error_message: errorMessage,
          processing_time_ms: Date.now() - startTime,
        })
        .eq('id', eventId);
    }
    
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
