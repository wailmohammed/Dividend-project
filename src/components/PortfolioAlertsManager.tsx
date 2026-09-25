import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { usePortfolio } from '@/context/PortfolioContext';
import { usePortfolioAlerts, PortfolioAlert } from '@/hooks/usePortfolioAlerts';
import { PortfolioAlertsExport } from './PortfolioAlertsExport';
import { PortfolioAlertsImport } from './PortfolioAlertsImport';
import { PortfolioAlertRow } from './PortfolioAlertRow';
import { AddAlertDialog } from './alerts/AddAlertDialog';
import { AlertTemplates } from './alerts/AlertTemplates';
import { BulkDeleteConfirmDialog } from './alerts/BulkDeleteConfirmDialog';
import { BatchCloneDialog } from './alerts/BatchCloneDialog';
import { Bell, BellOff, AlertCircle, Trash2, ToggleLeft, ToggleRight, Copy } from 'lucide-react';
import { toast } from 'sonner';

export const PortfolioAlertsManager: React.FC = () => {
  const { activePortfolio } = usePortfolio();
  const { alerts, loading, createAlert, updateAlert, deleteAlert } = usePortfolioAlerts();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBatchCloneOpen, setIsBatchCloneOpen] = useState(false);

  const holdings = useMemo(() => {
    return activePortfolio?.holdings || [];
  }, [activePortfolio]);

  const selectedAlertObjects = useMemo(() => {
    return alerts.filter(a => selectedAlerts.has(a.id));
  }, [alerts, selectedAlerts]);

  const handleSelectAll = () => {
    if (selectedAlerts.size === alerts.length) {
      setSelectedAlerts(new Set());
    } else {
      setSelectedAlerts(new Set(alerts.map(a => a.id)));
    }
  };

  const handleSelectAlert = (alertId: string) => {
    const newSet = new Set(selectedAlerts);
    if (newSet.has(alertId)) {
      newSet.delete(alertId);
    } else {
      newSet.add(alertId);
    }
    setSelectedAlerts(newSet);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedAlerts.size === 0) return;
    setIsDeleting(true);
    try {
      const promises = Array.from(selectedAlerts).map(id => deleteAlert(id));
      await Promise.all(promises);
      setSelectedAlerts(new Set());
      toast.success(`Deleted ${promises.length} alerts`);
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };
  const handleBulkToggle = async (active: boolean) => {
    if (selectedAlerts.size === 0) return;
    const promises = Array.from(selectedAlerts).map(id => 
      updateAlert(id, { is_active: active })
    );
    await Promise.all(promises);
    setSelectedAlerts(new Set());
    toast.success(`${active ? 'Enabled' : 'Disabled'} ${promises.length} alerts`);
  };

  const activeAlerts = alerts.filter(a => a.is_active);
  const triggeredAlerts = alerts.filter(a => a.triggered_at);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Portfolio Alerts
          </h2>
          <p className="text-sm text-muted-foreground">
            Get notified about important changes in your holdings
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedAlerts.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsBatchCloneOpen(true)}>
                <Copy className="w-4 h-4 mr-1" />
                Clone ({selectedAlerts.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggle(true)}>
                <ToggleRight className="w-4 h-4 mr-1" />
                Enable ({selectedAlerts.size})
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggle(false)}>
                <ToggleLeft className="w-4 h-4 mr-1" />
                Disable ({selectedAlerts.size})
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
                <Trash2 className="w-4 h-4 mr-1" />
                Delete ({selectedAlerts.size})
              </Button>
              <BulkDeleteConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                alerts={selectedAlertObjects}
                onConfirm={handleBulkDeleteConfirm}
                isDeleting={isDeleting}
              />
              <BatchCloneDialog
                open={isBatchCloneOpen}
                onOpenChange={setIsBatchCloneOpen}
                alerts={selectedAlertObjects}
                holdings={holdings}
                onClone={createAlert}
              />
            </>
          )}
          <PortfolioAlertsImport onImportComplete={() => {}} />
          <PortfolioAlertsExport alerts={alerts} />
          <AddAlertDialog
            isOpen={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            holdings={holdings}
            onCreateAlert={createAlert}
          />
        </div>
      </div>

      {/* Alert Templates */}
      <AlertTemplates
        holdings={holdings}
        onCreateAlert={createAlert}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{activeAlerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Triggered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{triggeredAlerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Monitored Symbols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(alerts.map(a => a.symbol)).size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Alerts</CardTitle>
          <CardDescription>Manage your portfolio alerts</CardDescription>
        </CardHeader>
        <CardContent>
        {alerts.length > 0 && (
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <Checkbox
              checked={selectedAlerts.size === alerts.length && alerts.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-sm text-muted-foreground">
              {selectedAlerts.size > 0 ? `${selectedAlerts.size} selected` : 'Select all'}
            </span>
          </div>
        )}
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BellOff className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No alerts configured</p>
              <p className="text-sm mt-1">Create an alert to get notified about important changes</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
              <div key={alert.id} className="flex items-start gap-3">
                <Checkbox
                  checked={selectedAlerts.has(alert.id)}
                  onCheckedChange={() => handleSelectAlert(alert.id)}
                  className="mt-5"
                />
                <div className="flex-1">
                  <PortfolioAlertRow
                    alert={alert}
                    onUpdate={updateAlert}
                    onDelete={deleteAlert}
                    onClone={createAlert}
                    holdings={holdings}
                  />
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-muted">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">How alerts work</p>
            <p className="mt-1">
              Price alerts are checked during each market data sync. Dividend alerts trigger when 
              we detect changes in dividend announcements. Enable email notifications in settings 
              to receive alerts via email.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PortfolioAlertsManager;
