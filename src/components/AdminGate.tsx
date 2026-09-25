import React from 'react';
import { ShieldAlert, ArrowLeft, LayoutDashboard, PieChart, BarChart2, Newspaper, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { usePortfolio } from '@/context/PortfolioContext';
import { ViewState } from '@/types';

interface Props {
  children: React.ReactNode;
  requireSuperAdmin?: boolean;
}

const QUICK_LINKS: { id: ViewState; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'holdings', label: 'Holdings', icon: PieChart },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'news', label: 'News', icon: Newspaper },
];

const AdminGate: React.FC<Props> = ({ children, requireSuperAdmin = false }) => {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, loading } = useUserRole(user?.id);
  const { switchView } = usePortfolio();

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-32 rounded-lg bg-muted/40 animate-pulse" />
      </div>
    );
  }

  const allowed = requireSuperAdmin ? isSuperAdmin : (isAdmin || isSuperAdmin);
  if (allowed) return <>{children}</>;

  const roleLabel = requireSuperAdmin ? 'super admin' : 'administrator';

  return (
    <div className="p-6 flex justify-center">
      <Card className="max-w-lg w-full border-warning/40">
        <CardContent className="pt-8 pb-6 space-y-5">
          <div className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <ShieldAlert className="w-7 h-7 text-warning" />
            </div>
            <h2 className="text-lg font-semibold">Admin access required</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This page is only visible to <span className="font-medium text-foreground">{roleLabel}s</span>.
              Your current account doesn't have that role yet.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-semibold text-foreground text-sm">Next steps</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Sign in with an account that has the {roleLabel} role.</li>
              <li>Ask a workspace owner to grant you the role.</li>
              <li>Or head back to one of the dashboards available to your account.</li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Go to an allowed section</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_LINKS.map(({ id, label, icon: Icon }) => (
                <Button
                  key={id}
                  variant="outline"
                  size="sm"
                  onClick={() => switchView(id)}
                  className="justify-start gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={() => switchView('dashboard')} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to dashboard
            </Button>
            <a
              href="mailto:wailafmohammed@gmail.com?subject=Admin%20access%20request"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Mail className="w-3 h-3" /> Request access
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminGate;
