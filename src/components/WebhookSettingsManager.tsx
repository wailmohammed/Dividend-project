import { useState } from 'react';
import { useWebhookSettings, WebhookSetting } from '@/hooks/useWebhookSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Bell, Plus, Trash2, TestTube, Slack, MessageCircle, Settings, ExternalLink } from 'lucide-react';

export const WebhookSettingsManager = () => {
  const { webhooks, loading, addWebhook, updateWebhook, deleteWebhook, testWebhook } = useWebhookSettings();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWebhookType, setNewWebhookType] = useState<'slack' | 'discord'>('slack');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [notifyPrice, setNotifyPrice] = useState(true);
  const [notifyDividend, setNotifyDividend] = useState(true);
  const [notifyPortfolio, setNotifyPortfolio] = useState(true);

  const handleAdd = async () => {
    if (!newWebhookUrl.trim()) return;

    await addWebhook(newWebhookType, newWebhookUrl.trim(), {
      notifyPriceAlerts: notifyPrice,
      notifyDividendAlerts: notifyDividend,
      notifyPortfolioAlerts: notifyPortfolio,
    });

    setIsAddDialogOpen(false);
    setNewWebhookUrl('');
    setNotifyPrice(true);
    setNotifyDividend(true);
    setNotifyPortfolio(true);
  };

  const getWebhookIcon = (type: string) => {
    return type === 'slack' ? <Slack className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading webhooks...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Webhook Notifications
            </CardTitle>
            <CardDescription>
              Get real-time alerts in Slack or Discord when your portfolio alerts trigger
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook Integration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Platform</Label>
                  <Select value={newWebhookType} onValueChange={(v) => setNewWebhookType(v as 'slack' | 'discord')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slack">
                        <div className="flex items-center gap-2">
                          <Slack className="w-4 h-4" />
                          Slack
                        </div>
                      </SelectItem>
                      <SelectItem value="discord">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="w-4 h-4" />
                          Discord
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    placeholder={newWebhookType === 'slack' 
                      ? 'https://hooks.slack.com/services/...' 
                      : 'https://discord.com/api/webhooks/...'
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {newWebhookType === 'slack' ? (
                      <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        How to create a Slack webhook <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <a href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        How to create a Discord webhook <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Notification Types</Label>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Price Alerts</span>
                    <Switch checked={notifyPrice} onCheckedChange={setNotifyPrice} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Dividend Alerts</span>
                    <Switch checked={notifyDividend} onCheckedChange={setNotifyDividend} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Portfolio Alerts</span>
                    <Switch checked={notifyPortfolio} onCheckedChange={setNotifyPortfolio} />
                  </div>
                </div>

                <Button onClick={handleAdd} className="w-full" disabled={!newWebhookUrl.trim()}>
                  Add Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No webhooks configured yet.</p>
            <p className="text-sm">Add a Slack or Discord webhook to receive real-time alerts.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <div
                key={webhook.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${webhook.webhook_type === 'slack' ? 'bg-purple-500/20' : 'bg-indigo-500/20'}`}>
                    {getWebhookIcon(webhook.webhook_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{webhook.webhook_type}</span>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'} className="text-xs">
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {webhook.webhook_url.substring(0, 40)}...
                    </p>
                    <div className="flex gap-2 mt-1">
                      {webhook.notify_price_alerts && <Badge variant="outline" className="text-xs">Price</Badge>}
                      {webhook.notify_dividend_alerts && <Badge variant="outline" className="text-xs">Dividend</Badge>}
                      {webhook.notify_portfolio_alerts && <Badge variant="outline" className="text-xs">Portfolio</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={(checked) => updateWebhook(webhook.id, { is_active: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testWebhook(webhook)}
                    title="Send test notification"
                  >
                    <TestTube className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteWebhook(webhook.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
