import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  type: 'price_alert' | 'dividend_alert' | 'portfolio_alert';
  userId: string;
  data: {
    symbol?: string;
    alertType?: string;
    currentPrice?: number;
    targetPrice?: number;
    changePercent?: number;
    message?: string;
    triggeredAt?: string;
  };
}

// Send Slack notification
async function sendSlackNotification(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const emoji = payload.type === 'price_alert' ? '📊' : payload.type === 'dividend_alert' ? '💰' : '🔔';
    const color = payload.type === 'price_alert' ? '#3498db' : payload.type === 'dividend_alert' ? '#27ae60' : '#e74c3c';
    
    const message = {
      attachments: [{
        color: color,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} ${payload.type.replace('_', ' ').toUpperCase()}`,
              emoji: true
            }
          },
          {
            type: "section",
            fields: [
              ...(payload.data.symbol ? [{
                type: "mrkdwn",
                text: `*Symbol:*\n${payload.data.symbol}`
              }] : []),
              ...(payload.data.currentPrice ? [{
                type: "mrkdwn", 
                text: `*Current Price:*\n$${payload.data.currentPrice.toFixed(2)}`
              }] : []),
              ...(payload.data.changePercent ? [{
                type: "mrkdwn",
                text: `*Change:*\n${payload.data.changePercent > 0 ? '+' : ''}${payload.data.changePercent.toFixed(2)}%`
              }] : []),
              ...(payload.data.alertType ? [{
                type: "mrkdwn",
                text: `*Alert Type:*\n${payload.data.alertType}`
              }] : [])
            ]
          },
          ...(payload.data.message ? [{
            type: "section",
            text: {
              type: "mrkdwn",
              text: payload.data.message
            }
          }] : []),
          {
            type: "context",
            elements: [{
              type: "mrkdwn",
              text: `Triggered at ${payload.data.triggeredAt || new Date().toISOString()}`
            }]
          }
        ]
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Slack webhook error:', response.status, await response.text());
      return false;
    }
    
    console.log('Slack notification sent successfully');
    return true;
  } catch (error) {
    console.error('Slack notification error:', error);
    return false;
  }
}

// Send Discord notification
async function sendDiscordNotification(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  try {
    const emoji = payload.type === 'price_alert' ? '📊' : payload.type === 'dividend_alert' ? '💰' : '🔔';
    const color = payload.type === 'price_alert' ? 0x3498db : payload.type === 'dividend_alert' ? 0x27ae60 : 0xe74c3c;
    
    const fields = [];
    if (payload.data.symbol) {
      fields.push({ name: 'Symbol', value: payload.data.symbol, inline: true });
    }
    if (payload.data.currentPrice) {
      fields.push({ name: 'Current Price', value: `$${payload.data.currentPrice.toFixed(2)}`, inline: true });
    }
    if (payload.data.changePercent) {
      const sign = payload.data.changePercent > 0 ? '+' : '';
      fields.push({ name: 'Change', value: `${sign}${payload.data.changePercent.toFixed(2)}%`, inline: true });
    }
    if (payload.data.alertType) {
      fields.push({ name: 'Alert Type', value: payload.data.alertType, inline: true });
    }

    const message = {
      embeds: [{
        title: `${emoji} ${payload.type.replace('_', ' ').toUpperCase()}`,
        description: payload.data.message || '',
        color: color,
        fields: fields,
        footer: {
          text: `Triggered at ${payload.data.triggeredAt || new Date().toISOString()}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Discord webhook error:', response.status, await response.text());
      return false;
    }
    
    console.log('Discord notification sent successfully');
    return true;
  } catch (error) {
    console.error('Discord notification error:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: WebhookPayload = await req.json();
    console.log('Webhook notify payload:', JSON.stringify(payload));

    if (!payload.userId || !payload.type) {
      return new Response(JSON.stringify({ error: 'Missing userId or type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get user's webhook settings
    const { data: webhookSettings, error: settingsError } = await supabase
      .from('webhook_settings')
      .select('*')
      .eq('user_id', payload.userId)
      .eq('is_active', true);

    if (settingsError) {
      console.error('Error fetching webhook settings:', settingsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch settings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!webhookSettings || webhookSettings.length === 0) {
      console.log('No active webhooks configured for user');
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let sent = 0;
    for (const setting of webhookSettings) {
      // Check if this notification type is enabled
      const shouldNotify = 
        (payload.type === 'price_alert' && setting.notify_price_alerts) ||
        (payload.type === 'dividend_alert' && setting.notify_dividend_alerts) ||
        (payload.type === 'portfolio_alert' && setting.notify_portfolio_alerts);

      if (!shouldNotify) {
        console.log(`Skipping ${setting.webhook_type} - notification type not enabled`);
        continue;
      }

      let success = false;
      if (setting.webhook_type === 'slack') {
        success = await sendSlackNotification(setting.webhook_url, payload);
      } else if (setting.webhook_type === 'discord') {
        success = await sendDiscordNotification(setting.webhook_url, payload);
      }

      if (success) sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook notify error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
