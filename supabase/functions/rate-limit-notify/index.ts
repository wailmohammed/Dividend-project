import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RateLimitNotifyRequest {
  user_id: string;
  user_email?: string;
  action_type: string;
  attempts: number;
  cooldown_seconds: number;
  ip_address?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email notification');
      return new Response(
        JSON.stringify({ success: false, message: 'Email service not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: RateLimitNotifyRequest = await req.json();
    const { user_id, user_email, action_type, attempts, cooldown_seconds, ip_address } = body;

    console.log(`Rate limit notification triggered for user ${user_id}, action: ${action_type}`);

    // Check if email notifications are enabled
    const { data: emailSetting } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'security_rate_limit_email_notifications')
      .maybeSingle();

    if (emailSetting?.value === 'false') {
      console.log('Email notifications disabled in settings');
      return new Response(
        JSON.stringify({ success: true, message: 'Notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if notify on exceeded is enabled
    const { data: notifyExceededSetting } = await serviceClient
      .from('system_settings')
      .select('value')
      .eq('key', 'security_rate_limit_notify_exceeded')
      .maybeSingle();

    if (notifyExceededSetting?.value === 'false') {
      console.log('Notify on exceeded disabled in settings');
      return new Response(
        JSON.stringify({ success: true, message: 'Exceeded notifications disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user who triggered the rate limit
    const { data: triggerProfile } = await serviceClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .maybeSingle();

    // Get all super admins to notify
    const { data: superAdminRoles } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    if (!superAdminRoles || superAdminRoles.length === 0) {
      console.log('No super admins found to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No super admins to notify' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const superAdminIds = superAdminRoles.map(r => r.user_id);

    // Get super admin emails
    const { data: superAdminProfiles } = await serviceClient
      .from('profiles')
      .select('email, full_name')
      .in('id', superAdminIds)
      .not('email', 'is', null);

    if (!superAdminProfiles || superAdminProfiles.length === 0) {
      console.log('No super admin emails found');
      return new Response(
        JSON.stringify({ success: true, message: 'No super admin emails found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const triggerUserName = triggerProfile?.full_name || triggerProfile?.email || user_email || 'Unknown User';
    const triggerUserEmail = triggerProfile?.email || user_email || 'Not available';
    const actionLabel = action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const cooldownMinutes = Math.ceil(cooldown_seconds / 60);
    const timestamp = new Date().toISOString();

    // Create audit log entry
    await serviceClient
      .from('audit_logs')
      .insert({
        user_id,
        action_type: 'rate_limit_exceeded',
        target_type: 'security',
        details: {
          action: action_type,
          attempts,
          cooldown_seconds,
          ip_address: ip_address || 'Unknown',
          timestamp
        }
      });

    // Send email to each super admin
    const emailPromises = superAdminProfiles.map(async (admin) => {
      if (!admin.email) return null;

      try {
        await resend.emails.send({
          from: 'WealthOS Security <onboarding@resend.dev>',
          to: [admin.email],
          subject: `⚠️ Rate Limit Alert: ${actionLabel}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Rate Limit Alert</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Potential abuse detected</p>
              </div>
              
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                <p style="margin: 0 0 20px 0;">Hi ${admin.full_name || 'Admin'},</p>
                
                <p style="margin: 0 0 20px 0;">A rate limit has been exceeded on WealthOS. Here are the details:</p>
                
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280; width: 140px;">Action Type:</td>
                      <td style="padding: 8px 0; font-weight: 600;">${actionLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Triggered By:</td>
                      <td style="padding: 8px 0; font-weight: 600;">${triggerUserName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">User Email:</td>
                      <td style="padding: 8px 0;">${triggerUserEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Attempts Made:</td>
                      <td style="padding: 8px 0; font-weight: 600; color: #dc2626;">${attempts}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Cooldown Period:</td>
                      <td style="padding: 8px 0;">${cooldownMinutes} minutes</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">IP Address:</td>
                      <td style="padding: 8px 0; font-family: monospace;">${ip_address || 'Not available'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #6b7280;">Timestamp:</td>
                      <td style="padding: 8px 0;">${new Date(timestamp).toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px;">
                  This could indicate a potential abuse attempt or an automated attack. Please review the audit logs for more details.
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                
                <p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
                  This is an automated security notification from WealthOS.<br>
                  Do not reply to this email.
                </p>
              </div>
            </body>
            </html>
          `
        });
        console.log(`Notification sent to ${admin.email}`);
        return { success: true, email: admin.email };
      } catch (err) {
        console.error(`Failed to send email to ${admin.email}:`, err);
        return { success: false, email: admin.email, error: err };
      }
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r?.success).length;

    console.log(`Rate limit notifications sent: ${successCount}/${superAdminProfiles.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Notifications sent to ${successCount} super admins`,
        sent: successCount,
        total: superAdminProfiles.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in rate-limit-notify:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
