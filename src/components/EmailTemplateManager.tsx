import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Mail, Save, Eye, Plus, Trash2, RefreshCcw, Code, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EmailTemplate {
  id: string;
  name: string;
  type: 'price_alert' | 'dividend_alert' | 'security_alert' | 'weekly_summary' | 'welcome' | 'custom';
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Price Alert',
    type: 'price_alert',
    subject: '🔔 Price Alert: {{symbol}} has reached ${{currentPrice}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; }
    .header { text-align: center; margin-bottom: 20px; }
    .alert-box { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .details { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📈 WealthOS Price Alert</h1>
    </div>
    <div class="alert-box">
      <h2>{{symbol}} has reached your target price!</h2>
      <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">\${{price}}</p>
    </div>
    <div class="details">
      <p><strong>Alert Type:</strong> {{alert_type}}</p>
      <p><strong>Target Price:</strong> \${{target_price}}</p>
      <p><strong>Current Price:</strong> \${{price}}</p>
      <p><strong>Time:</strong> {{timestamp}}</p>
    </div>
    <div class="footer">
      <p>You received this because you set up a price alert on WealthOS.</p>
    </div>
  </div>
</body>
</html>`,
    textContent: "WealthOS Price Alert\n\n" +
      "{{symbol}} has reached your target price of ${{target_price}}!\n\n" +
      "Current Price: ${{price}}\n" +
      "Alert Type: {{alert_type}}\n" +
      "Time: {{timestamp}}\n\n" +
      "--\nWealthOS - Your Wealth Management Platform",
    variables: ['symbol', 'price', 'target_price', 'alert_type', 'timestamp'],
    isActive: true
  },
  {
    name: 'Dividend Alert',
    type: 'dividend_alert',
    subject: '💰 Dividend Payment: {{symbol}} - ${{dividendAmount}}',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; }
    .header { text-align: center; margin-bottom: 20px; }
    .dividend-box { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; text-align: center; }
    .details { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 6px; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Dividend Payment</h1>
    </div>
    <div class="dividend-box">
      <h2>{{symbol}}</h2>
      <p style="font-size: 32px; font-weight: bold; margin: 10px 0;">\${{amount}}</p>
    </div>
    <div class="details">
      <p><strong>Ex-Dividend Date:</strong> {{ex_date}}</p>
      <p><strong>Payment Date:</strong> {{pay_date}}</p>
      <p><strong>Shares Held:</strong> {{shares}}</p>
    </div>
    <div class="footer">
      <p>You received this because you own {{symbol}} in your portfolio.</p>
    </div>
  </div>
</body>
</html>`,
    textContent: "Dividend Payment Notification\n\n" +
      "{{symbol}} Dividend\n" +
      "Amount: ${{dividend_amount}}\n" +
      "Ex-Dividend Date: {{ex_date}}\n" +
      "Payment Date: {{pay_date}}\n" +
      "Shares Held: {{shares}}\n\n" +
      "--\nWealthOS",
    variables: ['symbol', 'dividend_amount', 'ex_date', 'pay_date', 'shares'],
    isActive: true
  },
  {
    name: 'Weekly Summary',
    type: 'weekly_summary',
    subject: '📊 Your Weekly Portfolio Summary',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; }
    .header { text-align: center; margin-bottom: 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 20px; border-radius: 8px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .stat-box { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Portfolio Summary</h1>
      <p>Week of {{week_start}} - {{week_end}}</p>
    </div>
    <div class="stat-grid">
      <div class="stat-box">
        <p style="color: #666; margin: 0;">Total Value</p>
        <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">\${{total_value}}</p>
      </div>
      <div class="stat-box">
        <p style="color: #666; margin: 0;">Weekly Change</p>
        <p class="{{change_class}}" style="font-size: 24px; font-weight: bold; margin: 5px 0;">{{weekly_change}}%</p>
      </div>
      <div class="stat-box">
        <p style="color: #666; margin: 0;">Dividends</p>
        <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">\${{dividends}}</p>
      </div>
      <div class="stat-box">
        <p style="color: #666; margin: 0;">Holdings</p>
        <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">{{holdings_count}}</p>
      </div>
    </div>
    <div class="footer">
      <p>Login to WealthOS for detailed analytics</p>
    </div>
  </div>
</body>
</html>`,
    textContent: "Weekly Portfolio Summary\n" +
      "Week of {{week_start}} - {{week_end}}\n\n" +
      "Total Value: ${{portfolio_total}}\n" +
      "Weekly Change: {{weekly_change}}%\n" +
      "Dividends: ${{weekly_dividends}}\n" +
      "Holdings: {{holdings_count}}\n\n" +
      "--\nWealthOS",
    variables: ['week_start', 'week_end', 'portfolio_total', 'weekly_change', 'weekly_dividends', 'holdings_count', 'change_class'],
    isActive: true
  }
];

export const EmailTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [editMode, setEditMode] = useState<'visual' | 'code'>('visual');

  // Load templates from system_settings
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'email_templates')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data?.value) {
        const parsed = JSON.parse(data.value);
        setTemplates(parsed);
        if (parsed.length > 0) {
          setSelectedTemplate(parsed[0]);
        }
      } else {
        // Initialize with default templates
        const initialTemplates = DEFAULT_TEMPLATES.map((t, i) => ({
          ...t,
          id: `template-${i}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        setTemplates(initialTemplates);
        if (initialTemplates.length > 0) {
          setSelectedTemplate(initialTemplates[0]);
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const saveTemplates = async (updatedTemplates: EmailTemplate[]) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'email_templates',
          value: JSON.stringify(updatedTemplates),
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

      if (error) throw error;

      setTemplates(updatedTemplates);
      toast.success('Templates saved successfully');
    } catch (error) {
      console.error('Error saving templates:', error);
      toast.error('Failed to save templates');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateChange = (field: keyof EmailTemplate, value: any) => {
    if (!selectedTemplate) return;

    const updated = {
      ...selectedTemplate,
      [field]: value,
      updatedAt: new Date().toISOString()
    };
    setSelectedTemplate(updated);
  };

  const handleSaveTemplate = () => {
    if (!selectedTemplate) return;

    const updatedTemplates = templates.map(t => 
      t.id === selectedTemplate.id ? selectedTemplate : t
    );
    saveTemplates(updatedTemplates);
  };

  const handlePreview = () => {
    if (!selectedTemplate) return;

    // Replace variables with sample data
    let html = selectedTemplate.htmlContent;
    const sampleData: Record<string, string> = {
      symbol: 'AAPL',
      price: '185.50',
      target_price: '185.00',
      alert_type: 'above',
      timestamp: new Date().toLocaleString(),
      amount: '25.50',
      ex_date: '2024-01-15',
      pay_date: '2024-01-20',
      shares: '100',
      week_start: '2024-01-08',
      week_end: '2024-01-14',
      total_value: '125,000',
      weekly_change: '+2.5',
      dividends: '150',
      holdings_count: '15',
      change_class: 'positive'
    };

    selectedTemplate.variables.forEach(v => {
      const regex = new RegExp(`{{${v}}}`, 'g');
      html = html.replace(regex, sampleData[v] || `{{${v}}}`);
    });

    setPreviewHtml(html);
    setIsPreviewOpen(true);
  };

  const handleAddTemplate = () => {
    const newTemplate: EmailTemplate = {
      id: `template-${Date.now()}`,
      name: 'New Template',
      type: 'custom',
      subject: 'Subject Line',
      htmlContent: DEFAULT_TEMPLATES[0].htmlContent,
      textContent: 'Plain text content',
      variables: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setTemplates([...templates, newTemplate]);
    setSelectedTemplate(newTemplate);
  };

  const handleDeleteTemplate = (id: string) => {
    const updatedTemplates = templates.filter(t => t.id !== id);
    saveTemplates(updatedTemplates);
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(updatedTemplates[0] || null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCcw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p>Loading email templates...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Email Template Manager
          </h3>
          <p className="text-sm text-muted-foreground">Customize notification email templates</p>
        </div>
        <Button onClick={handleAddTemplate} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Template List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1 p-2">
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedTemplate?.id === template.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{template.name}</span>
                    {template.type !== 'custom' && (
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        selectedTemplate?.id === template.id 
                          ? 'bg-primary-foreground/20 text-primary-foreground' 
                          : 'bg-muted-foreground/10 text-muted-foreground'
                      }`}>
                        {template.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Template Editor */}
        <Card className="lg:col-span-3">
          {selectedTemplate ? (
            <>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">{selectedTemplate.name}</CardTitle>
                  <CardDescription>Last updated: {new Date(selectedTemplate.updatedAt).toLocaleDateString()}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button size="sm" onClick={handleSaveTemplate} disabled={isSaving}>
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  {selectedTemplate.type === 'custom' && (
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(selectedTemplate.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input 
                      value={selectedTemplate.name} 
                      onChange={(e) => handleTemplateChange('name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select 
                      value={selectedTemplate.type} 
                      onValueChange={(v) => handleTemplateChange('type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="price_alert">Price Alert</SelectItem>
                        <SelectItem value="dividend_alert">Dividend Alert</SelectItem>
                        <SelectItem value="security_alert">Security Alert</SelectItem>
                        <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
                        <SelectItem value="welcome">Welcome</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Subject Line</Label>
                  <Input 
                    value={selectedTemplate.subject} 
                    onChange={(e) => handleTemplateChange('subject', e.target.value)}
                    placeholder="Email subject with {{variables}}"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Available Variables</Label>
                    <div className="flex items-center gap-2">
                      {selectedTemplate.variables.map(v => (
                        <code key={v} className="text-xs bg-muted px-2 py-1 rounded">
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>

                <Tabs value={editMode} onValueChange={(v) => setEditMode(v as 'visual' | 'code')}>
                  <TabsList>
                    <TabsTrigger value="code">
                      <Code className="w-4 h-4 mr-2" />
                      HTML
                    </TabsTrigger>
                    <TabsTrigger value="visual">
                      <FileText className="w-4 h-4 mr-2" />
                      Plain Text
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="code" className="space-y-2">
                    <Label>HTML Content</Label>
                    <Textarea 
                      value={selectedTemplate.htmlContent}
                      onChange={(e) => handleTemplateChange('htmlContent', e.target.value)}
                      className="font-mono text-sm min-h-[300px]"
                    />
                  </TabsContent>
                  <TabsContent value="visual" className="space-y-2">
                    <Label>Plain Text Content</Label>
                    <Textarea 
                      value={selectedTemplate.textContent}
                      onChange={(e) => handleTemplateChange('textContent', e.target.value)}
                      className="min-h-[300px]"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-12 text-center">
              <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p>Select a template to edit</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[500px] border-0"
              title="Email Preview"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplateManager;
