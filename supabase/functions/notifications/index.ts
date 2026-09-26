import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Twilio env vars (fallback)
let TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
let TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
let TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceAlert {
  id: string;
  user_id: string;
  symbol: string;
  target_price: number;
  condition: 'ABOVE' | 'BELOW';
  is_active: boolean;
}

interface DividendReminder {
  symbol: string;
  pay_date: string;
  amount: number;
  user_id: string;
}

interface SecurityNotification {
  type: "backup_code_used" | "two_factor_enabled" | "two_factor_disabled";
  email: string;
  phoneNumber?: string;
  metadata?: {
    codesRemaining?: number;
    timestamp?: string;
  };
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

// Load Twilio config from database (for super admin saved config)
async function loadTwilioConfigFromDb(supabaseClient: any): Promise<TwilioConfig | null> {
  try {
    // Use service role to bypass RLS for system settings
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!serviceRoleKey) {
      console.log("[Notifications] No service role key, using env vars only");
      return null;
    }
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    
    const { data: settings, error } = await adminClient
      .from('system_settings')
      .select('key, value, encrypted_value')
      .in('key', ['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);
    
    if (error || !settings || settings.length === 0) {
      return null;
    }
    
    const config: Partial<TwilioConfig> = {};
    for (const setting of settings) {
      if (setting.key === 'twilio_account_sid') config.accountSid = setting.value || setting.encrypted_value;
      if (setting.key === 'twilio_auth_token') config.authToken = setting.encrypted_value || setting.value;
      if (setting.key === 'twilio_phone_number') config.phoneNumber = setting.value || setting.encrypted_value;
    }
    
    if (config.accountSid && config.authToken && config.phoneNumber) {
      console.log("[Notifications] Loaded Twilio config from database");
      return config as TwilioConfig;
    }
    return null;
  } catch (error) {
    console.error("[Notifications] Error loading Twilio config from DB:", error);
    return null;
  }
}

// Get effective Twilio config (DB takes precedence over env vars)
async function getEffectiveTwilioConfig(supabaseClient: any): Promise<TwilioConfig | null> {
  // First try database
  const dbConfig = await loadTwilioConfigFromDb(supabaseClient);
  if (dbConfig) {
    return dbConfig;
  }
  
  // Fall back to environment variables
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    return {
      accountSid: TWILIO_ACCOUNT_SID,
      authToken: TWILIO_AUTH_TOKEN,
      phoneNumber: TWILIO_PHONE_NUMBER
    };
  }
  
  return null;
}

// Twilio SMS sender
async function sendSmsNotification(phoneNumber: string, message: string, twilioConfig: TwilioConfig | null): Promise<{ success: boolean; error?: string }> {
  if (!twilioConfig) {
    console.log("[Notifications] Twilio SMS not configured - skipping SMS notification");
    return { success: false, error: "SMS service not configured" };
  }

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', phoneNumber);
    formData.append('From', twilioConfig.phoneNumber);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioConfig.accountSid}:${twilioConfig.authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[Notifications] Twilio SMS send failed:", errorData);
      return { success: false, error: "Failed to send SMS" };
    }

    const result = await response.json();
    console.log(`[Notifications] SMS sent successfully:`, result.sid);
    return { success: true };
  } catch (error: unknown) {
    console.error("[Notifications] SMS error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

// Get SMS message based on notification type
function getSmsMessage(notification: SecurityNotification): string {
  switch (notification.type) {
    case "backup_code_used":
      return `[WealthOS Security] A backup code was used to access your account. ${notification.metadata?.codesRemaining ?? 'Unknown'} codes remaining. If this wasn't you, secure your account immediately.`;
    case "two_factor_enabled":
      return `[WealthOS] Two-factor authentication has been enabled on your account.`;
    case "two_factor_disabled":
      return `[WealthOS Security] Two-factor authentication has been disabled on your account. If this wasn't you, secure your account immediately.`;
    default:
      return `[WealthOS] Security notification for your account.`;
  }
}

async function sendSecurityEmail(notification: SecurityNotification, twilioConfig: TwilioConfig | null): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.error("[Notifications] RESEND_API_KEY not configured");
    return { success: false, error: "Email service not configured" };
  }

  let subject = "";
  let htmlContent = "";

  switch (notification.type) {
    case "backup_code_used":
      subject = "🔐 WealthOS Security Alert: Backup Code Used";
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">🔐 Security Alert</h1>
              <p style="font-size: 16px; line-height: 1.6;">
                A two-factor authentication backup code was used to access your WealthOS account.
              </p>
              <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Time:</strong> ${notification.metadata?.timestamp || new Date().toISOString()}</p>
                <p style="margin: 5px 0;"><strong>Backup codes remaining:</strong> ${notification.metadata?.codesRemaining ?? 'Unknown'}</p>
              </div>
              ${(notification.metadata?.codesRemaining ?? 10) <= 3 ? `
                <div style="background: #ff6b6b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>⚠️ Warning:</strong> You're running low on backup codes. Consider regenerating them in your security settings.</p>
                </div>
              ` : ''}
              <p style="font-size: 14px; color: #ccc;">
                If you did not use this backup code, please secure your account immediately by changing your password and enabling a new 2FA secret.
              </p>
            </div>
          </body>
        </html>
      `;
      break;

    case "two_factor_enabled":
      subject = "✅ WealthOS: Two-Factor Authentication Enabled";
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">✅ 2FA Enabled</h1>
              <p style="font-size: 16px; line-height: 1.6;">
                Two-factor authentication has been successfully enabled on your WealthOS account.
              </p>
              <p style="font-size: 14px; color: #ccc; margin-top: 20px;">
                Your account is now more secure. You'll need your authenticator app to sign in from now on.
              </p>
            </div>
          </body>
        </html>
      `;
      break;

    case "two_factor_disabled":
      subject = "⚠️ WealthOS: Two-Factor Authentication Disabled";
      htmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
              <h1 style="margin-bottom: 20px;">⚠️ 2FA Disabled</h1>
              <p style="font-size: 16px; line-height: 1.6;">
                Two-factor authentication has been disabled on your WealthOS account.
              </p>
              <div style="background: #ff6b6b; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;">Your account is now less secure. We recommend re-enabling 2FA for better protection.</p>
              </div>
              <p style="font-size: 14px; color: #ccc;">
                If you did not make this change, please secure your account immediately.
              </p>
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
        from: "WealthOS <security@resend.dev>",
        to: [notification.email],
        subject,
        html: htmlContent,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("[Notifications] Email send failed:", errorData);
      return { success: false, error: "Failed to send email" };
    }

    const result = await emailResponse.json();
    console.log(`[Notifications] Email sent successfully:`, result);

    // Also send SMS if phone number is provided and Twilio is configured
    if (notification.phoneNumber && twilioConfig) {
      const smsMessage = getSmsMessage(notification);
      const smsResult = await sendSmsNotification(notification.phoneNumber, smsMessage, twilioConfig);
      if (smsResult.success) {
        console.log(`[Notifications] SMS also sent successfully`);
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error("[Notifications] Email error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Get the authorization header to extract user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's JWT (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authenticatedUserId = user.id;
    const body = await req.json();
    const { action, userId, alerts, dividends } = body;

    // Validate that userId in request matches authenticated user (prevent accessing other users' data)
    if (userId && userId !== authenticatedUserId) {
      console.error(`User ${authenticatedUserId} attempted to access data for user ${userId}`);
      return new Response(
        JSON.stringify({ error: "Forbidden: Cannot access other users' data" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing notification action: ${action} for user: ${authenticatedUserId}`);

    switch (action) {
      case 'check_twilio_status': {
        // Check if Twilio is configured
        const isConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
        
        return new Response(
          JSON.stringify({ 
            isConfigured,
            isEnabled: isConfigured, // For now, enabled if configured
            fromNumber: isConfigured ? TWILIO_PHONE_NUMBER?.slice(0, 4) + '****' + TWILIO_PHONE_NUMBER?.slice(-2) : ''
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'toggle_sms': {
        // Super admin only - toggle SMS notifications
        // For now, just return success since we don't have persistent settings
        const { enabled } = body;
        console.log(`[Notifications] SMS notifications ${enabled ? 'enabled' : 'disabled'}`);
        
        return new Response(
          JSON.stringify({ success: true, enabled }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'configure_twilio': {
        // Super admin only - stores Twilio config in system_settings table
        const { accountSid, authToken, phoneNumber } = body;
        
        if (!accountSid || !authToken || !phoneNumber) {
          return new Response(
            JSON.stringify({ error: "Missing Twilio credentials" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user is super_admin
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authenticatedUserId)
          .maybeSingle();

        if (userRole?.role !== 'super_admin') {
          return new Response(
            JSON.stringify({ error: "Only super admins can configure Twilio" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Validate Twilio credentials by making a test API call
        try {
          const testUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
          const testResponse = await fetch(testUrl, {
            headers: {
              'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            },
          });

          if (!testResponse.ok) {
            return new Response(
              JSON.stringify({ error: "Invalid Twilio credentials" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Save to system_settings table (super admin has access via RLS)
          const settings = [
            { key: 'twilio_account_sid', value: accountSid },
            { key: 'twilio_auth_token', encrypted_value: authToken },
            { key: 'twilio_phone_number', value: phoneNumber }
          ];

          for (const setting of settings) {
            await supabase
              .from('system_settings')
              .upsert(setting, { onConflict: 'key' });
          }

          console.log(`[Notifications] Twilio credentials saved by super_admin ${authenticatedUserId}`);
          
          return new Response(
            JSON.stringify({ success: true, message: "Twilio configured successfully" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (error) {
          console.error("[Notifications] Twilio validation error:", error);
          return new Response(
            JSON.stringify({ error: "Failed to validate Twilio credentials" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      case 'send_test_sms': {
        // Super admin only - send a test SMS
        const { phoneNumber: testPhone } = body;
        
        if (!testPhone) {
          return new Response(
            JSON.stringify({ error: "Phone number is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if user is super_admin
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authenticatedUserId)
          .maybeSingle();

        if (userRole?.role !== 'super_admin') {
          return new Response(
            JSON.stringify({ error: "Only super admins can send test SMS" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get Twilio config
        const twilioConfig = await getEffectiveTwilioConfig(supabase);
        
        const result = await sendSmsNotification(
          testPhone, 
          `[WealthOS] This is a test SMS from your admin dashboard. Twilio is configured correctly! Sent at ${new Date().toLocaleTimeString()}`,
          twilioConfig
        );

        if (!result.success) {
          return new Response(
            JSON.stringify({ error: result.error || "Failed to send test SMS" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[Notifications] Test SMS sent to ${testPhone} by super_admin ${authenticatedUserId}`);
        
        return new Response(
          JSON.stringify({ success: true, message: "Test SMS sent successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'send_security_notification': {
        const { type, metadata, phoneNumber: userPhone } = body;
        const email = user.email;
        
        // Also try to get phone number from profile if not provided
        let phoneToUse = userPhone;
        if (!phoneToUse) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number')
            .eq('id', authenticatedUserId)
            .maybeSingle();
          phoneToUse = profile?.phone_number;
        }
        
        if (!email) {
          return new Response(
            JSON.stringify({ error: "User email not found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get Twilio config for SMS
        const twilioConfig = await getEffectiveTwilioConfig(supabase);
        const result = await sendSecurityEmail({ type, email, phoneNumber: phoneToUse, metadata }, twilioConfig);
        
        if (!result.success) {
          return new Response(
            JSON.stringify({ error: result.error }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'check_price_alerts': {
        const triggeredAlerts: any[] = [];
        const unavailableSymbols: string[] = [];
        if (alerts && alerts.length > 0) {
          // Validate alerts belong to the authenticated user
          const userAlerts = alerts.filter((a: PriceAlert) => a.user_id === authenticatedUserId);
          const symbols = [...new Set(userAlerts.map((a: PriceAlert) => a.symbol.toUpperCase()))];
          const { data: quoteRows, error: quoteError } = symbols.length
            ? await supabase.from('market_data_cache').select('symbol, price, source, updated_at').in('symbol', symbols)
            : { data: [], error: null };
          if (quoteError) throw quoteError;
          const quotes = new Map((quoteRows || []).map((row: any) => [row.symbol.toUpperCase(), row]));
          const maxAgeMs = 24 * 60 * 60 * 1000;
          for (const alert of userAlerts) {
            const quote = quotes.get(alert.symbol.toUpperCase());
            const quotePrice = Number(quote?.price);
            const quoteAge = quote?.updated_at ? Date.now() - new Date(quote.updated_at).getTime() : Infinity;
            if (!quote || quote.source === 'mock' || !(quotePrice > 0) || quoteAge > maxAgeMs) {
              unavailableSymbols.push(alert.symbol.toUpperCase());
              continue;
            }
            const triggered = alert.condition === 'ABOVE' 
              ? quotePrice >= alert.target_price
              : quotePrice <= alert.target_price;
              
            if (triggered) {
              triggeredAlerts.push({
                ...alert,
                current_price: quotePrice,
                price_source: quote.source,
                quote_updated_at: quote.updated_at,
                triggered_at: new Date().toISOString(),
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            triggered: triggeredAlerts,
            unavailable_symbols: [...new Set(unavailableSymbols)],
            checked_at: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'send_price_alert_email': {
        // Send email and SMS notification for triggered price alert
        const { symbol, targetPrice, currentPrice, alertType } = body;
        const userEmail = user.email;
        
        if (!userEmail) {
          return new Response(
            JSON.stringify({ error: "User email not found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch user's notification preferences
        const { data: notifPrefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', authenticatedUserId)
          .maybeSingle();

        // Check if email notifications are enabled for price alerts
        const emailEnabled = notifPrefs?.email_price_alerts ?? true;
        const smsEnabled = notifPrefs?.sms_price_alerts ?? false;

        if (!emailEnabled && !smsEnabled) {
          console.log(`[Notifications] User ${authenticatedUserId} has disabled price alert notifications`);
          return new Response(
            JSON.stringify({ success: true, message: "Notifications disabled by user preference" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const direction = alertType === 'above' ? 'risen above' : 'fallen below';
        let emailSent = false;
        let smsSent = false;

        // Send email if enabled
        if (emailEnabled && RESEND_API_KEY) {
          const htmlContent = `
            <html>
              <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 10px; color: white;">
                  <h1 style="margin-bottom: 20px;">🔔 Price Alert Triggered</h1>
                  <p style="font-size: 16px; line-height: 1.6;">
                    Your price alert for <strong>${symbol}</strong> has been triggered!
                  </p>
                  <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 8px 0; font-size: 18px;"><strong>Symbol:</strong> ${symbol}</p>
                    <p style="margin: 8px 0; font-size: 18px;"><strong>Alert Type:</strong> Price ${direction}</p>
                    <p style="margin: 8px 0; font-size: 18px;"><strong>Target Price:</strong> $${targetPrice.toFixed(2)}</p>
                    <p style="margin: 8px 0; font-size: 18px; color: ${alertType === 'above' ? '#4ade80' : '#f87171'};"><strong>Current Price:</strong> $${currentPrice.toFixed(2)}</p>
                  </div>
                  <p style="font-size: 14px; color: #ccc; margin-top: 20px;">
                    This alert was triggered at ${new Date().toLocaleString()}.
                  </p>
                </div>
              </body>
            </html>
          `;

          try {
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "WealthOS <alerts@resend.dev>",
                to: [userEmail],
                subject: `🔔 Price Alert: ${symbol} has ${direction} $${targetPrice.toFixed(2)}`,
                html: htmlContent,
              }),
            });

            if (emailResponse.ok) {
              const result = await emailResponse.json();
              console.log(`[Notifications] Price alert email sent for ${symbol}:`, result);
              emailSent = true;
            } else {
              console.error("[Notifications] Price alert email failed:", await emailResponse.text());
            }
          } catch (error) {
            console.error("[Notifications] Email error:", error);
          }
        }

        // Send SMS if enabled
        if (smsEnabled) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number')
            .eq('id', authenticatedUserId)
            .maybeSingle();
          
          if (profile?.phone_number) {
            const smsMessage = `[WealthOS] Price Alert: ${symbol} has ${direction} $${targetPrice.toFixed(2)}. Current price: $${currentPrice.toFixed(2)}`;
            const twilioConfig = await getEffectiveTwilioConfig(supabase);
            const smsResult = await sendSmsNotification(profile.phone_number, smsMessage, twilioConfig);
            smsSent = smsResult.success;
            if (smsSent) {
              console.log(`[Notifications] Price alert SMS sent for ${symbol}`);
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, emailSent, smsSent }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'check_dividend_reminders': {
        // Check for upcoming dividends in the next 7 days
        const upcomingDividends: DividendReminder[] = [];
        const today = new Date();
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

        // Query uses RLS - only returns dividends for user's portfolios
        const { data: dividendsData, error } = await supabase
          .from('dividends')
          .select('*, portfolios!inner(user_id)')
          .gte('pay_date', today.toISOString().split('T')[0])
          .lte('pay_date', weekFromNow.toISOString().split('T')[0]);

        if (error) {
          console.error("Error fetching dividends:", error.message);
          return new Response(
            JSON.stringify({ error: "Failed to fetch dividend reminders" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (dividendsData) {
          for (const div of dividendsData) {
            upcomingDividends.push({
              symbol: div.symbol,
              pay_date: div.pay_date,
              amount: div.amount,
              user_id: authenticatedUserId
            });
          }
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            upcoming: upcomingDividends,
            checked_at: new Date().toISOString()
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'create_notification': {
        const { type, title, message } = body;
        
        // Use authenticated user ID, not provided user_id
        console.log(`Creating notification for user ${authenticatedUserId}: ${title}`);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            notification: { type, title, message, user_id: authenticatedUserId, created_at: new Date().toISOString() }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case 'get_market_summary': {
        const symbolKeys: Record<string, string> = { SPY: 'sp500_change', QQQ: 'nasdaq_change', DIA: 'dow_change' };
        const { data: quoteRows, error: quoteError } = await supabase
          .from('market_data_cache')
          .select('symbol, change_percent, source, updated_at')
          .in('symbol', Object.keys(symbolKeys));
        if (quoteError) throw quoteError;
        const bySymbol = new Map((quoteRows || []).filter((row: any) => row.source !== 'mock').map((row: any) => [row.symbol, row]));
        const summary = {
          sp500_change: bySymbol.get('SPY')?.change_percent ?? null,
          nasdaq_change: bySymbol.get('QQQ')?.change_percent ?? null,
          dow_change: bySymbol.get('DIA')?.change_percent ?? null,
          vix: null,
          market_mood: null,
          top_movers: [],
          source: 'market_data_cache',
          generated_at: new Date().toISOString(),
          last_quote_updated_at: [...bySymbol.values()].map((row: any) => row.updated_at).sort().at(-1) || null,
        };

        return new Response(
          JSON.stringify({ success: true, summary }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Notification function error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
