import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'role_change' | 'plan_upgrade' | 'user_deletion' | 'admin_action';
  targetUserId?: string;
  targetEmail?: string;
  adminUserId: string;
  details: Record<string, any>;
}

// Helper to make Supabase REST API calls
async function supabaseQuery(table: string, method: string, body?: any, filters?: Record<string, string>) {
  let url = `${supabaseUrl}/rest/v1/${table}`;
  
  if (filters) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      params.append(key, value);
    }
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": supabaseServiceKey,
    "Authorization": `Bearer ${supabaseServiceKey}`,
  };

  if (method === "GET") {
    headers["Accept"] = "application/vnd.pgrst.object+json";
  }

  const options: RequestInit = { method, headers };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
    headers["Prefer"] = "return=minimal";
  }

  const response = await fetch(url, options);
  
  if (!response.ok && response.status !== 406) {
    const error = await response.text();
    throw new Error(`Supabase error: ${error}`);
  }

  if (method === "GET" && response.status !== 406) {
    return await response.json();
  }
  
  return null;
}

// Send email using Resend API directly
async function sendEmail(to: string, subject: string, html: string) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("RESEND_API_KEY not configured, skipping email");
    return null;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "Portfolio Tracker <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null;
    const userAgent = req.headers.get('user-agent') || null;

    // Best-effort audit log for auth/role rejections. Never throw from logging.
    const logRejection = async (
      reason: 'missing_auth_header' | 'invalid_jwt' | 'not_admin',
      userId: string | null,
      extra: Record<string, any> = {},
    ) => {
      try {
        await supabaseQuery('audit_logs', 'POST', {
          user_id: userId,
          action_type: 'admin_notifications_rejected',
          target_type: 'edge_function',
          target_id: null,
          details: { reason, ...extra },
          ip_address: ipAddress,
          user_agent: userAgent,
        });
      } catch (e) {
        console.error('Failed to write rejection audit log:', e);
      }
    };

    // Verify JWT and enforce admin role - never trust caller identity from body
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.warn('admin-notifications: missing Authorization header');
      await logRejection('missing_auth_header', null);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.warn('admin-notifications: invalid JWT', claimsError?.message);
      await logRejection('invalid_jwt', null, { error: claimsError?.message ?? null });
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const authenticatedUserId = claimsData.claims.sub as string;

    // Role check via service role (bypasses RLS reliably)
    const roleResp = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${authenticatedUserId}&select=role`,
      {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      }
    );
    const roles: Array<{ role: string }> = roleResp.ok ? await roleResp.json() : [];
    const isAdmin = roles.some((r) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) {
      console.warn(`admin-notifications: user ${authenticatedUserId} lacks admin role`);
      await logRejection('not_admin', authenticatedUserId, {
        roles: roles.map((r) => r.role),
      });
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }


    const { type, targetUserId, targetEmail, details }: NotificationRequest = await req.json();
    // Force adminUserId from verified JWT; ignore any body-supplied value
    const adminUserId = authenticatedUserId;

    console.log(`Processing ${type} notification from admin ${adminUserId}`);

    // Get admin info
    let adminProfile: any = null;
    try {
      adminProfile = await supabaseQuery('profiles', 'GET', null, { 
        id: `eq.${adminUserId}`,
        select: 'email,full_name'
      });
    } catch (e) {
      console.log("Could not fetch admin profile:", e);
    }

    // Get target user info if applicable
    let targetUserEmail = targetEmail;
    let targetUserName = 'User';
    if (targetUserId) {
      try {
        const targetProfile = await supabaseQuery('profiles', 'GET', null, {
          id: `eq.${targetUserId}`,
          select: 'email,full_name'
        });
        if (targetProfile) {
          targetUserEmail = targetProfile.email || targetEmail;
          targetUserName = targetProfile.full_name || 'User';
        }
      } catch (e) {
        console.log("Could not fetch target profile:", e);
      }
    }

    // Create audit log entry
    const auditLog = {
      user_id: adminUserId,
      action_type: type,
      target_type: targetUserId ? 'user' : 'system',
      target_id: targetUserId || null,
      details: {
        ...details,
        admin_email: adminProfile?.email,
        target_email: targetUserEmail
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null
    };

    let auditLogCreated = true;
    try {
      await supabaseQuery('audit_logs', 'POST', auditLog);
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
      auditLogCreated = false;
    }

    // Send email notifications based on type
    let emailSubject = '';
    let emailHtml = '';

    switch (type) {
      case 'role_change':
        emailSubject = `Your account role has been updated`;
        emailHtml = `
          <h1>Role Update Notification</h1>
          <p>Hello ${targetUserName},</p>
          <p>Your account role has been changed from <strong>${details.oldRole}</strong> to <strong>${details.newRole}</strong>.</p>
          <p>If you have any questions, please contact support.</p>
          <p>Best regards,<br>The Admin Team</p>
        `;
        break;

      case 'plan_upgrade':
        emailSubject = `Subscription plan updated to ${details.newPlan}`;
        emailHtml = `
          <h1>Subscription Update</h1>
          <p>Hello ${targetUserName},</p>
          <p>Your subscription plan has been ${details.oldPlan ? `changed from ${details.oldPlan} to` : 'set to'} <strong>${details.newPlan}</strong>.</p>
          <p>Thank you for being a valued member!</p>
          <p>Best regards,<br>The Team</p>
        `;
        break;

      case 'user_deletion':
        emailSubject = `User account deleted`;
        emailHtml = `
          <h1>User Account Deleted</h1>
          <p>Admin ${adminProfile?.full_name || adminProfile?.email} has deleted user account: ${targetUserEmail}</p>
          <p>This action has been logged in the audit system.</p>
        `;
        targetUserEmail = adminProfile?.email;
        break;

      case 'admin_action':
        emailSubject = `Admin Action Notification`;
        emailHtml = `
          <h1>Admin Action Performed</h1>
          <p>Action: ${details.action}</p>
          <p>Performed by: ${adminProfile?.full_name || adminProfile?.email}</p>
          <p>Details: ${JSON.stringify(details, null, 2)}</p>
          <p>Time: ${new Date().toISOString()}</p>
        `;
        targetUserEmail = adminProfile?.email;
        break;
    }

    // Send email if we have a target
    if (targetUserEmail) {
      try {
        const emailResponse = await sendEmail(targetUserEmail, emailSubject, emailHtml);
        console.log("Email sent successfully:", emailResponse);
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, auditLogCreated }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
