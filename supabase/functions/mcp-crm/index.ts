import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
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
mcpServer.tool({
  name: "get_revenue_summary",
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
  handler: async ({ start_date, end_date, workshop_title, product_name }) => {
    try {
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

      const totalOfferAmount = calls?.reduce((sum, c) => sum + (c.offer_amount || 0), 0) || 0;
      const totalCashReceived = calls?.reduce((sum, c) => sum + (c.cash_received || 0), 0) || 0;
      const totalConversions = calls?.length || 0;

      // Get workshop-wise breakdown if no specific filter
      let workshopBreakdown = [];
      if (!workshop_title) {
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching revenue summary: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 2: Get Closer Performance
mcpServer.tool({
  name: "get_closer_performance",
  description: "Get performance metrics for sales closers. Shows calls completed, conversions, revenue generated, and pending calls.",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Specific date in YYYY-MM-DD format. Defaults to today." },
      closer_name: { type: "string", description: "Filter by closer name (optional)" },
    },
    required: [],
  },
  handler: async ({ date, closer_name }) => {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];
      
      const { data: metrics, error } = await supabase.rpc("get_closer_call_metrics", {
        target_date: targetDate,
      });

      if (error) throw error;

      let results = metrics || [];
      
      if (closer_name) {
        results = results.filter((m: any) => 
          m.full_name?.toLowerCase().includes(closer_name.toLowerCase())
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching closer performance: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 3: Search Customers
mcpServer.tool({
  name: "search_customers",
  description: "Search for customers by name, email, or phone number. Returns customer details, assigned workshops, products, and call history.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search term (name, email, or phone)" },
    },
    required: ["query"],
  },
  handler: async ({ query }) => {
    try {
      const { data: results, error } = await supabase.rpc("search_leads", {
        search_query: query,
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching customers: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 4: Get Pending EMIs
mcpServer.tool({
  name: "get_pending_emis",
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
  handler: async ({ product_type, overdue_only }) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const results: any[] = [];

      // Fetch from all three EMI tables
      const tables = [
        { name: "batch_emi_payments", type: "batches" },
        { name: "futures_emi_payments", type: "futures" },
        { name: "high_future_emi_payments", type: "high_future" },
      ];

      for (const table of tables) {
        if (product_type && table.type !== product_type) continue;

        let query = supabase
          .from(table.name)
          .select(`
            id,
            student_id,
            emi_number,
            amount,
            due_date,
            paid_at,
            notes
          `)
          .is("paid_at", null);

        if (overdue_only) {
          query = query.lt("due_date", today);
        }

        const { data, error } = await query;
        if (error) {
          console.error(`Error fetching ${table.name}:`, error);
          continue;
        }

        // Get student details
        const studentTable = table.type === "batches" 
          ? "batch_students" 
          : table.type === "futures" 
            ? "futures_students" 
            : "high_future_students";

        const studentIds = data?.map((d: any) => d.student_id) || [];
        if (studentIds.length === 0) continue;

        const { data: students } = await supabase
          .from(studentTable)
          .select("id, student_name, phone, email")
          .in("id", studentIds);

        const studentMap = new Map(students?.map((s: any) => [s.id, s]) || []);

        data?.forEach((emi: any) => {
          const student = studentMap.get(emi.student_id);
          const dueDate = new Date(emi.due_date);
          const todayDate = new Date(today);
          const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          results.push({
            product_type: table.type,
            student_name: student?.student_name || "Unknown",
            phone: student?.phone,
            email: student?.email,
            emi_number: emi.emi_number,
            amount: emi.amount,
            due_date: emi.due_date,
            days_overdue: daysOverdue > 0 ? daysOverdue : 0,
            is_overdue: daysOverdue > 0,
            notes: emi.notes,
          });
        });
      }

      // Sort by days overdue (most overdue first)
      results.sort((a, b) => b.days_overdue - a.days_overdue);

      const totalPending = results.reduce((sum, r) => sum + r.amount, 0);
      const overdueCount = results.filter(r => r.is_overdue).length;
      const overdueAmount = results.filter(r => r.is_overdue).reduce((sum, r) => sum + r.amount, 0);

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            summary: {
              total_pending_emis: results.length,
              total_pending_amount: totalPending,
              overdue_count: overdueCount,
              overdue_amount: overdueAmount,
            },
            emis: results,
          }, null, 2) 
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching pending EMIs: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 5: Get Daily Calls Schedule
mcpServer.tool({
  name: "get_daily_calls",
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
  handler: async ({ date, closer_name, status }) => {
    try {
      const targetDate = date || new Date().toISOString().split("T")[0];

      let query = supabase
        .from("call_appointments")
        .select(`
          id,
          scheduled_date,
          scheduled_time,
          status,
          offer_amount,
          cash_received,
          notes,
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

      if (status) {
        query = query.eq("status", status);
      }

      const { data: calls, error } = await query;
      if (error) throw error;

      let results = calls || [];

      if (closer_name) {
        results = results.filter((c: any) => 
          c.closer?.full_name?.toLowerCase().includes(closer_name.toLowerCase())
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
        notes: c.notes,
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching daily calls: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 6: Get Workshop Metrics
mcpServer.tool({
  name: "get_workshop_metrics",
  description: "Get detailed metrics for workshops including registrations, sales, conversions, fresh vs rejoin breakdown.",
  inputSchema: {
    type: "object",
    properties: {
      workshop_title: { type: "string", description: "Filter by workshop title (optional)" },
    },
    required: [],
  },
  handler: async ({ workshop_title }) => {
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

      if (workshop_title) {
        results = results.filter((r: any) => 
          r.workshop_title?.toLowerCase().includes(workshop_title.toLowerCase())
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
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching workshop metrics: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 7: Get Money Flow Summary
mcpServer.tool({
  name: "get_money_flow",
  description: "Get daily money flow summary showing all payments received across different payment modes.",
  inputSchema: {
    type: "object",
    properties: {
      start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
      end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
      payment_mode: { type: "string", description: "Filter by payment mode (optional)" },
    },
    required: [],
  },
  handler: async ({ start_date, end_date, payment_mode }) => {
    try {
      let query = supabase
        .from("daily_money_flows")
        .select("*")
        .order("payment_date", { ascending: false });

      if (start_date) {
        query = query.gte("payment_date", start_date);
      }
      if (end_date) {
        query = query.lte("payment_date", end_date);
      }
      if (payment_mode) {
        query = query.eq("payment_mode", payment_mode);
      }

      const { data: flows, error } = await query;
      if (error) throw error;

      const totalAmount = flows?.reduce((sum, f) => sum + (f.amount || 0), 0) || 0;

      // Group by payment mode
      const byMode: Record<string, number> = {};
      flows?.forEach((f: any) => {
        byMode[f.payment_mode] = (byMode[f.payment_mode] || 0) + f.amount;
      });

      // Group by date
      const byDate: Record<string, number> = {};
      flows?.forEach((f: any) => {
        byDate[f.payment_date] = (byDate[f.payment_date] || 0) + f.amount;
      });

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            total_amount: totalAmount,
            total_transactions: flows?.length || 0,
            by_payment_mode: byMode,
            by_date: byDate,
            transactions: flows?.slice(0, 50), // Limit to 50 most recent
          }, null, 2) 
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching money flow: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// Tool 8: Run Custom Read Query (with safety restrictions)
mcpServer.tool({
  name: "run_read_query",
  description: "Run a custom read-only SQL query against the database. Only SELECT statements are allowed. Use this for advanced data analysis that other tools don't cover.",
  inputSchema: {
    type: "object",
    properties: {
      query: { 
        type: "string", 
        description: "SQL SELECT query to run. Must be read-only (no INSERT, UPDATE, DELETE, DROP, etc.)" 
      },
    },
    required: ["query"],
  },
  handler: async ({ query }) => {
    try {
      // Validate query is read-only
      const upperQuery = query.toUpperCase().trim();
      const dangerousKeywords = [
        "INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", 
        "CREATE", "GRANT", "REVOKE", "EXECUTE", "EXEC", "CALL"
      ];
      
      for (const keyword of dangerousKeywords) {
        if (upperQuery.includes(keyword)) {
          return {
            content: [{ 
              type: "text", 
              text: `Error: Query contains forbidden keyword '${keyword}'. Only SELECT queries are allowed.` 
            }],
            isError: true,
          };
        }
      }

      if (!upperQuery.startsWith("SELECT")) {
        return {
          content: [{ type: "text", text: "Error: Query must start with SELECT." }],
          isError: true,
        };
      }

      // Use the Supabase RPC to run the query (you'd need to create this function)
      // For now, we'll provide guidance
      return {
        content: [{ 
          type: "text", 
          text: `Custom queries are not yet enabled. Please use the other available tools:\n- get_revenue_summary\n- get_closer_performance\n- search_customers\n- get_pending_emis\n- get_daily_calls\n- get_workshop_metrics\n- get_money_flow\n\nIf you need a specific query capability, let me know and I can add it as a dedicated tool.` 
        }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error running query: ${error.message}` }],
        isError: true,
      };
    }
  },
});

// ============== HTTP TRANSPORT ==============

const transport = new StreamableHttpTransport();

// API Key authentication middleware
app.use("*", async (c, next) => {
  // Skip auth for OPTIONS requests
  if (c.req.method === "OPTIONS") {
    return next();
  }

  // Check API key if configured
  if (mcpApiKey) {
    const authHeader = c.req.header("Authorization");
    const providedKey = authHeader?.replace("Bearer ", "");
    
    if (providedKey !== mcpApiKey) {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }

  return next();
});

// Handle all MCP requests
app.all("/*", async (c) => {
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
  } catch (error) {
    console.error("MCP Error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

Deno.serve(app.fetch);
