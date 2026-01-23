// @ts-nocheck - Using esm.sh imports for Deno compatibility
import { Hono } from "https://esm.sh/hono@4.4.0";
import { McpServer, StreamableHttpTransport } from "https://esm.sh/mcp-lite@0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.78.0";

const app = new Hono();

// Initialize Supabase client with service role for full read access
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mcpApiKey = Deno.env.get("MCP_CRM_API_KEY");

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Create MCP Server
const mcpServer = new McpServer({
  name: "nikist-crm-mcp",
  version: "1.0.0",
});

// ============== TOOL DEFINITIONS ==============

// Tool 1: Get Revenue Summary
mcpServer.tool("get_revenue_summary", {
  description: "Get revenue summary from the CRM. Can filter by date range, workshop, or product. Returns total cash collected, offer amounts, and conversion counts.",
  inputSchema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Start date in YYYY-MM-DD format (optional)" },
      end_date: { type: "string", description: "End date in YYYY-MM-DD format (optional)" },
      workshop_title: { type: "string", description: "Filter by workshop title (optional)" },
      product_name: { type: "string", description: "Filter by product name (optional)" },
    },
    required: [],
  },
  handler: async (params: { start_date?: string; end_date?: string; workshop_title?: string; product_name?: string }) => {
    try {
      const { start_date, end_date } = params;
      
      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          status,
          offer_amount,
          cash_received,
          lead:leads!call_appointments_lead_id_fkey(
            id,
            contact_name,
            email
          )
        `)
        .in("status", ["converted_beginner", "converted_intermediate", "converted_advance", "converted", "booking_amount"]);

      if (start_date) {
        query = query.gte("scheduled_date", start_date);
      }
      if (end_date) {
        query = query.lte("scheduled_date", end_date);
      }

      const { data: calls, error } = await query;

      if (error) throw error;

      const totalOfferAmount = calls?.reduce((sum: number, c: any) => sum + (c.offer_amount || 0), 0) || 0;
      const totalCashReceived = calls?.reduce((sum: number, c: any) => sum + (c.cash_received || 0), 0) || 0;
      const totalConversions = calls?.length || 0;

      // Get workshop-wise breakdown if no specific filter
      let workshopBreakdown: any[] = [];
      if (!params.workshop_title) {
        const { data: workshopMetrics } = await supabase.rpc("get_workshop_metrics");
        if (workshopMetrics) {
          const { data: workshops } = await supabase.from("workshops").select("id, title");
          workshopBreakdown = workshopMetrics.map((m: any) => {
            const ws = workshops?.find((w: any) => w.id === m.workshop_id);
            return {
              workshop: ws?.title || "Unknown",
              sales_count: m.sales_count,
              total_offer_amount: m.total_offer_amount,
              total_cash_received: m.total_cash_received,
              converted_calls: m.converted_calls,
              fresh_sales: m.fresh_sales_count,
              rejoin_sales: m.rejoin_sales_count,
            };
          });
        }
      }

      const summary = {
        date_range: {
          start: start_date || "All time",
          end: end_date || "Present",
        },
        totals: {
          total_conversions: totalConversions,
          total_offer_amount: totalOfferAmount,
          total_cash_received: totalCashReceived,
        },
        workshop_breakdown: workshopBreakdown,
      };

      return {
        content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching revenue summary: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 2: Get Closer Performance
mcpServer.tool("get_closer_performance", {
  description: "Get performance metrics for sales closers. Shows calls completed, conversions, revenue generated, and pending calls.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Specific date in YYYY-MM-DD format. Defaults to today." },
      closer_name: { type: "string", description: "Filter by closer name (optional)" },
    },
    required: [],
  },
  handler: async (params: { date?: string; closer_name?: string }) => {
    try {
      const targetDate = params.date || new Date().toISOString().split("T")[0];
      
      const { data: metrics, error } = await supabase.rpc("get_closer_call_metrics", {
        target_date: targetDate,
      });

      if (error) throw error;

      let results = metrics || [];
      
      if (params.closer_name) {
        results = results.filter((m: any) => 
          m.full_name?.toLowerCase().includes(params.closer_name!.toLowerCase())
        );
      }

      const formatted = results.map((m: any) => ({
        closer_name: m.full_name,
        total_calls: m.total_calls,
        converted: m.converted_count,
        not_converted: m.not_converted_count,
        rescheduled: m.rescheduled_count,
        pending: m.pending_count,
        offered_amount: m.offered_amount,
        cash_collected: m.cash_collected,
        conversion_rate: m.total_calls > 0 
          ? `${((m.converted_count / m.total_calls) * 100).toFixed(1)}%` 
          : "N/A",
      }));

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ date: targetDate, closers: formatted }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching closer performance: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 3: Search Customers
mcpServer.tool("search_customers", {
  description: "Search for customers by name, email, or phone number. Returns customer details, assigned workshops, products, and call history.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term (name, email, or phone)" },
    },
    required: ["query"],
  },
  handler: async (params: { query: string }) => {
    try {
      const { data: results, error } = await supabase.rpc("search_leads", {
        search_query: params.query,
      });

      if (error) throw error;

      // Group by customer
      const customerMap = new Map();
      results?.forEach((r: any) => {
        if (!customerMap.has(r.id)) {
          customerMap.set(r.id, {
            id: r.id,
            name: r.contact_name,
            email: r.email,
            phone: r.phone,
            country: r.country,
            workshop_name: r.workshop_name,
            status: r.status,
            created_at: r.created_at,
            assignments: [],
          });
        }
        if (r.assignment_id) {
          customerMap.get(r.id).assignments.push({
            workshop: r.workshop_title,
            product: r.product_name,
            product_price: r.product_price,
            is_connected: r.is_connected,
            is_refunded: r.is_refunded,
          });
        }
      });

      const customers = Array.from(customerMap.values());

      // Get call appointments for these customers
      const customerIds = customers.map((c: any) => c.id);
      const { data: calls } = await supabase
        .from("call_appointments")
        .select(`
          id,
          lead_id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          closer:profiles!call_appointments_closer_id_fkey(full_name)
        `)
        .in("lead_id", customerIds);

      // Attach calls to customers
      customers.forEach((c: any) => {
        c.calls = calls?.filter((call: any) => call.lead_id === c.id).map((call: any) => ({
          date: call.scheduled_date,
          time: call.scheduled_time,
          status: call.status,
          closer: call.closer?.full_name,
          offer_amount: call.offer_amount,
          cash_received: call.cash_received,
        })) || [];
      });

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            total_found: customers.length, 
            customers 
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error searching customers: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 4: Get Pending EMIs
mcpServer.tool("get_pending_emis", {
  description: "Get list of pending or overdue EMI payments. Shows customer name, amount due, due date, and days overdue.",
  inputSchema: {
    type: "object",
    properties: {
      product_type: { 
        type: "string", 
        description: "Filter by product type: 'batches', 'futures', or 'high_future'. Leave empty for all." 
      },
      overdue_only: { 
        type: "boolean", 
        description: "Show only overdue EMIs (past due date). Defaults to false." 
      },
    },
    required: [],
  },
  handler: async (params: { product_type?: string; overdue_only?: boolean }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const results: any[] = [];

      // Get pending EMIs from call_appointments with due_amount > 0
      const { data: pendingCalls, error: callsError } = await supabase
        .from("call_appointments")
        .select(`
          id,
          due_amount,
          cash_received,
          offer_amount,
          scheduled_date,
          lead:leads!call_appointments_lead_id_fkey(
            contact_name,
            phone,
            email
          )
        `)
        .gt("due_amount", 0)
        .in("status", ["converted_beginner", "converted_intermediate", "converted_advance", "converted", "booking_amount"]);

      if (callsError) throw callsError;

      pendingCalls?.forEach((call: any) => {
        results.push({
          product_type: "batch",
          student_name: call.lead?.contact_name || "Unknown",
          phone: call.lead?.phone,
          email: call.lead?.email,
          due_amount: call.due_amount,
          cash_received: call.cash_received,
          offer_amount: call.offer_amount,
          scheduled_date: call.scheduled_date,
        });
      });

      // Get futures students with due amount
      const { data: futuresStudents } = await supabase
        .from("futures_mentorship_students")
        .select(`
          id,
          due_amount,
          cash_received,
          offer_amount,
          conversion_date,
          lead:leads!futures_mentorship_students_lead_id_fkey(
            contact_name,
            phone,
            email
          )
        `)
        .gt("due_amount", 0);

      futuresStudents?.forEach((student: any) => {
        results.push({
          product_type: "futures",
          student_name: student.lead?.contact_name || "Unknown",
          phone: student.lead?.phone,
          email: student.lead?.email,
          due_amount: student.due_amount,
          cash_received: student.cash_received,
          offer_amount: student.offer_amount,
          conversion_date: student.conversion_date,
        });
      });

      // Get high future students with due amount
      const { data: highFutureStudents } = await supabase
        .from("high_future_students")
        .select(`
          id,
          due_amount,
          cash_received,
          offer_amount,
          conversion_date,
          lead:leads!high_future_students_lead_id_fkey(
            contact_name,
            phone,
            email
          )
        `)
        .gt("due_amount", 0);

      highFutureStudents?.forEach((student: any) => {
        results.push({
          product_type: "high_future",
          student_name: student.lead?.contact_name || "Unknown",
          phone: student.lead?.phone,
          email: student.lead?.email,
          due_amount: student.due_amount,
          cash_received: student.cash_received,
          offer_amount: student.offer_amount,
          conversion_date: student.conversion_date,
        });
      });

      // Filter by product type if specified
      let filteredResults = results;
      if (params.product_type) {
        filteredResults = results.filter(r => r.product_type === params.product_type);
      }

      // Sort by due amount descending
      filteredResults.sort((a, b) => (b.due_amount || 0) - (a.due_amount || 0));

      const totalPending = filteredResults.reduce((sum, r) => sum + (r.due_amount || 0), 0);

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            summary: {
              total_pending_count: filteredResults.length,
              total_pending_amount: totalPending,
            },
            pending_payments: filteredResults,
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching pending EMIs: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 5: Get Daily Calls Schedule
mcpServer.tool("get_daily_calls", {
  description: "Get scheduled calls for a specific date. Shows time, customer, closer assigned, and status.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Date in YYYY-MM-DD format. Defaults to today." },
      closer_name: { type: "string", description: "Filter by closer name (optional)" },
      status: { type: "string", description: "Filter by status: scheduled, pending, converted, not_converted, reschedule (optional)" },
    },
    required: [],
  },
  handler: async (params: { date?: string; closer_name?: string; status?: string }) => {
    try {
      const targetDate = params.date || new Date().toISOString().split("T")[0];

      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          closer_remarks,
          zoom_link,
          lead:leads!call_appointments_lead_id_fkey(
            contact_name,
            email,
            phone,
            country
          ),
          closer:profiles!call_appointments_closer_id_fkey(full_name)
        `)
        .eq("scheduled_date", targetDate)
        .order("scheduled_time", { ascending: true });

      if (params.status) {
        query = query.eq("status", params.status);
      }

      const { data: calls, error } = await query;
      if (error) throw error;

      let results = calls || [];

      if (params.closer_name) {
        results = results.filter((c: any) => 
          c.closer?.full_name?.toLowerCase().includes(params.closer_name!.toLowerCase())
        );
      }

      const formatted = results.map((c: any) => ({
        time: c.scheduled_time,
        customer_name: c.lead?.contact_name,
        customer_phone: c.lead?.phone,
        customer_email: c.lead?.email,
        country: c.lead?.country,
        closer: c.closer?.full_name,
        status: c.status,
        zoom_link: c.zoom_link,
        offer_amount: c.offer_amount,
        cash_received: c.cash_received,
        remarks: c.closer_remarks,
      }));

      // Calculate summary
      const statusCounts: Record<string, number> = {};
      formatted.forEach((c: any) => {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      });

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            date: targetDate,
            total_calls: formatted.length,
            status_breakdown: statusCounts,
            calls: formatted,
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching daily calls: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 6: Get Workshop Metrics
mcpServer.tool("get_workshop_metrics", {
  description: "Get detailed metrics for workshops including registrations, sales, conversions, fresh vs rejoin breakdown.",
  inputSchema: {
    type: "object",
    properties: {
      workshop_title: { type: "string", description: "Filter by workshop title (optional)" },
    },
    required: [],
  },
  handler: async (params: { workshop_title?: string }) => {
    try {
      const { data: metrics, error } = await supabase.rpc("get_workshop_metrics");
      if (error) throw error;

      const { data: workshops } = await supabase
        .from("workshops")
        .select("id, title, start_date, end_date, status");

      const workshopMap = new Map(workshops?.map((w: any) => [w.id, w]) || []);

      let results = (metrics || []).map((m: any) => {
        const ws = workshopMap.get(m.workshop_id);
        return {
          workshop_title: ws?.title,
          start_date: ws?.start_date,
          end_date: ws?.end_date,
          status: ws?.status,
          registration_count: m.registration_count,
          total_sales: m.sales_count,
          fresh_sales: m.fresh_sales_count,
          rejoin_sales: m.rejoin_sales_count,
          cross_workshop: m.cross_workshop_count,
          total_calls_booked: m.total_calls_booked,
          converted_calls: m.converted_calls,
          not_converted_calls: m.not_converted_calls,
          remaining_calls: m.remaining_calls,
          rescheduled_remaining: m.rescheduled_remaining,
          booking_amount_calls: m.booking_amount_calls,
          refunded_calls: m.refunded_calls,
          total_offer_amount: m.total_offer_amount,
          total_cash_received: m.total_cash_received,
          conversion_rate: m.total_calls_booked > 0 
            ? `${((m.converted_calls / m.total_calls_booked) * 100).toFixed(1)}%` 
            : "N/A",
        };
      });

      if (params.workshop_title) {
        results = results.filter((r: any) => 
          r.workshop_title?.toLowerCase().includes(params.workshop_title!.toLowerCase())
        );
      }

      // Sort by start date descending
      results.sort((a: any, b: any) => 
        new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime()
      );

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            total_workshops: results.length,
            workshops: results 
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching workshop metrics: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 7: Get Money Flow Summary
mcpServer.tool("get_money_flow", {
  description: "Get daily money flow summary showing cash collected and revenue.",
  inputSchema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
      end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
    },
    required: [],
  },
  handler: async (params: { start_date?: string; end_date?: string }) => {
    try {
      let query = supabase
        .from("daily_money_flow")
        .select("*")
        .order("date", { ascending: false });

      if (params.start_date) {
        query = query.gte("date", params.start_date);
      }
      if (params.end_date) {
        query = query.lte("date", params.end_date);
      }

      const { data: flows, error } = await query;
      if (error) throw error;

      const totalCashCollected = flows?.reduce((sum: number, f: any) => sum + (f.cash_collected || 0), 0) || 0;
      const totalRevenue = flows?.reduce((sum: number, f: any) => sum + (f.total_revenue || 0), 0) || 0;

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            summary: {
              total_cash_collected: totalCashCollected,
              total_revenue: totalRevenue,
              total_days: flows?.length || 0,
            },
            daily_flows: flows?.slice(0, 30), // Limit to 30 most recent
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching money flow: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 8: Get Database Overview
mcpServer.tool("get_database_overview", {
  description: "Get an overview of the CRM database with counts of key entities like leads, workshops, products, calls, etc.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
  handler: async () => {
    try {
      // Get counts from various tables
      const [
        { count: leadsCount },
        { count: workshopsCount },
        { count: productsCount },
        { count: callsCount },
        { count: futuresStudentsCount },
        { count: highFutureStudentsCount },
        { count: closersCount },
      ] = await Promise.all([
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("workshops").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("call_appointments").select("*", { count: "exact", head: true }),
        supabase.from("futures_mentorship_students").select("*", { count: "exact", head: true }),
        supabase.from("high_future_students").select("*", { count: "exact", head: true }),
        supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "sales_rep"),
      ]);

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            overview: {
              total_leads: leadsCount,
              total_workshops: workshopsCount,
              total_products: productsCount,
              total_call_appointments: callsCount,
              futures_students: futuresStudentsCount,
              high_future_students: highFutureStudentsCount,
              sales_closers: closersCount,
            },
            available_tools: [
              "get_revenue_summary - Revenue and sales data",
              "get_closer_performance - Sales closer metrics",
              "search_customers - Find customers by name/email/phone",
              "get_pending_emis - Pending EMI payments",
              "get_daily_calls - Scheduled calls for a date",
              "get_workshop_metrics - Workshop performance data",
              "get_money_flow - Daily money flow data",
            ],
          }, null, 2) 
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{ type: "text", text: `Error fetching database overview: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// ============== HTTP TRANSPORT ==============

const transport = new StreamableHttpTransport();

// API Key authentication middleware
app.use("*", async (c: any, next: any) => {
  // Skip auth for OPTIONS requests
  if (c.req.method === "OPTIONS") {
    return next();
  }

  // Check API key if configured - support both header and query param
  if (mcpApiKey) {
    const authHeader = c.req.header("Authorization");
    const headerKey = authHeader?.replace("Bearer ", "");
    
    // Also check query parameter (for Claude connector compatibility)
    const url = new URL(c.req.url);
    const queryKey = url.searchParams.get("api_key");
    
    const providedKey = headerKey || queryKey;
    
    if (providedKey !== mcpApiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }

  return next();
});

// Handle all MCP requests
app.all("/*", async (c: any) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const response = await transport.handleRequest(c.req.raw, mcpServer);
    
    // Add CORS headers to response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders,
    });
  } catch (err) {
    console.error("MCP Error:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
