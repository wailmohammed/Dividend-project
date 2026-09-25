import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SocialNotificationRequest {
  type: "follower" | "like" | "comment";
  recipientUserId: string;
  actorUserId: string;
  content?: string;
  postId?: string;
}

async function sendSocialEmail(
  recipientEmail: string,
  actorName: string,
  type: "follower" | "like" | "comment",
  content?: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[SocialNotifications] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  let subject = "";
  let htmlContent = "";
  const baseUrl = "https://wealthos.app";

  switch (type) {
    case "follower":
      subject = `${actorName} started following you on WealthOS`;
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">👋 New Follower!</h1>
              <p style="font-size: 18px; line-height: 1.6;">
                <strong>${actorName}</strong> started following you on WealthOS.
              </p>
              <p style="font-size: 14px; color: #ccc; margin-top: 20px;">
                Connect with other investors and share your investment journey!
              </p>
              <a href="${baseUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #4ade80; color: #000; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View on WealthOS
              </a>
            </div>
          </body>
        </html>
      `;
      break;

    case "like":
      subject = `${actorName} liked your post on WealthOS`;
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">❤️ Someone liked your post!</h1>
              <p style="font-size: 18px; line-height: 1.6;">
                <strong>${actorName}</strong> liked your post on WealthOS.
              </p>
              <p style="font-size: 14px; color: #ccc; margin-top: 20px;">
                Your insights are getting noticed by the community!
              </p>
              <a href="${baseUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #f87171; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Post
              </a>
            </div>
          </body>
        </html>
      `;
      break;

    case "comment":
      subject = `${actorName} commented on your post`;
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">💬 New Comment!</h1>
              <p style="font-size: 18px; line-height: 1.6;">
                <strong>${actorName}</strong> commented on your post:
              </p>
              ${content ? `
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px 0; font-style: italic;">
                  "${content.length > 150 ? content.substring(0, 150) + '...' : content}"
                </div>
              ` : ''}
              <a href="${baseUrl}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #60a5fa; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Comment
              </a>
            </div>
          </body>
        </html>
      `;
      break;

    default:
      return { success: false, error: "Unknown notification type" };
  }

  try {
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "WealthOS <notifications@resend.dev>",
        to: [recipientEmail],
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("[SocialNotifications] Email send failed:", errorData);
      return { success: false, error: "Failed to send email" };
    }

    const result = await emailResponse.json();
    console.log(`[SocialNotifications] Email sent successfully:`, result);
    return { success: true };
  } catch (error: unknown) {
    console.error("[SocialNotifications] Email error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to fetch user data
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Create user client to verify auth
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SocialNotificationRequest = await req.json();
    const { type, recipientUserId, actorUserId, content, postId } = body;

    console.log(`[SocialNotifications] Processing ${type} notification from ${actorUserId} to ${recipientUserId}`);

    // Don't send notification to yourself
    if (recipientUserId === actorUserId) {
      return new Response(
        JSON.stringify({ success: true, skipped: "Self notification" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get recipient's email and notification preferences
    const { data: recipientProfile, error: recipientError } = await adminClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', recipientUserId)
      .single();

    if (recipientError || !recipientProfile?.email) {
      console.log("[SocialNotifications] Recipient not found or no email:", recipientError);
      return new Response(
        JSON.stringify({ success: false, error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get actor's name
    const { data: actorProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', actorUserId)
      .single();

    const actorName = actorProfile?.full_name || "Someone";

    // Check recipient's notification preferences (default to enabled)
    const { data: preferences } = await adminClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', recipientUserId)
      .single();

    // For social notifications, we'll use a general "email_weekly_summary" as proxy for now
    // In a production app, you'd add specific preferences for social notifications
    const shouldSendEmail = true; // Default to sending emails

    if (shouldSendEmail) {
      const result = await sendSocialEmail(
        recipientProfile.email,
        actorName,
        type,
        content
      );

      if (result.success) {
        console.log(`[SocialNotifications] Successfully sent ${type} email to ${recipientProfile.email}`);
      } else {
        console.error(`[SocialNotifications] Failed to send email:`, result.error);
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, skipped: "Email notifications disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SocialNotifications] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
