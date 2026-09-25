import { useState, useMemo } from 'react';
import { useNotifications, AppNotification, AppNotificationType } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Bell, CheckCheck, Trash2, User, Heart, MessageCircle, DollarSign, RefreshCw, Shield, Filter, Settings, Calculator, FlaskConical, Search, X, Clock } from 'lucide-react';
import { NotificationPreferencesPanel } from './NotificationPreferencesPanel';
import { NotificationHistoryView } from './NotificationHistoryView';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { getDemoModeEnabled } from '@/hooks/useDemoMode';
import { Alert as UIAlert, AlertDescription as UIAlertDescription } from '@/components/ui/alert';

type FilterType = 'all' | 'security' | 'dividends' | 'alerts' | 'social' | 'tax';
type MainTab = 'notifications' | 'history' | 'preferences';

const NotificationCenterView = () => {
  const { user } = useAuth();
  const isDemoMode = !user || user.id === 'demo-user' || getDemoModeEnabled();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<FilterType>('all');
  const [mainTab, setMainTab] = useState<MainTab>('notifications');
  const [searchQuery, setSearchQuery] = useState('');

  const getNotificationIcon = (type: AppNotificationType) => {
    switch (type) {
      case 'follower':
        return <User className="w-4 h-4 text-blue-500" />;
      case 'like':
        return <Heart className="w-4 h-4 text-pink-500" />;
      case 'comment':
        return <MessageCircle className="w-4 h-4 text-emerald-500" />;
      case 'dividend':
        return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'market_sync':
        return <RefreshCw className="w-4 h-4 text-amber-500" />;
      case 'system':
        return <Shield className="w-4 h-4 text-purple-500" />;
      case 'tax':
        return <Calculator className="w-4 h-4 text-orange-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationLabel = (type: AppNotificationType): string => {
    switch (type) {
      case 'follower':
        return 'New Follower';
      case 'like':
        return 'Post Liked';
      case 'comment':
        return 'New Comment';
      case 'dividend':
        return 'Dividend Alert';
      case 'market_sync':
        return 'Market Sync';
      case 'system':
        return 'System Alert';
      case 'tax':
        return 'Tax Alert';
      default:
        return 'Notification';
    }
  };

  const filterNotifications = (notifs: AppNotification[]): AppNotification[] => {
    let filtered = notifs;
    
    // Apply category filter
    switch (filter) {
      case 'security':
        filtered = notifs.filter(n => n.type === 'system');
        break;
      case 'dividends':
        filtered = notifs.filter(n => n.type === 'dividend');
        break;
      case 'alerts':
        filtered = notifs.filter(n => n.type === 'market_sync');
        break;
      case 'social':
        filtered = notifs.filter(n => ['follower', 'like', 'comment'].includes(n.type));
        break;
      case 'tax':
        filtered = notifs.filter(n => n.type === 'tax');
        break;
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(n => 
        n.content?.toLowerCase().includes(query) ||
        n.actor_name?.toLowerCase().includes(query) ||
        n.type.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  const filteredNotifications = useMemo(() => 
    filterNotifications(notifications), 
    [notifications, filter, searchQuery]
  );

  const filterCounts = {
    all: notifications.length,
    security: notifications.filter(n => n.type === 'system').length,
    dividends: notifications.filter(n => n.type === 'dividend').length,
    alerts: notifications.filter(n => n.type === 'market_sync').length,
    social: notifications.filter(n => ['follower', 'like', 'comment'].includes(n.type)).length,
    tax: notifications.filter(n => n.type === 'tax').length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <UIAlert className="border-amber-500/50 bg-amber-500/10">
          <FlaskConical className="h-4 w-4 text-amber-500" />
          <UIAlertDescription className="text-amber-700 dark:text-amber-300">
            <strong>Demo Mode:</strong> Viewing sample notifications and preferences.
          </UIAlertDescription>
        </UIAlert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notification Center
          </h2>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && mainTab === 'notifications' && (
          <Button onClick={markAllAsRead} variant="outline" className="gap-2">
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </Button>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as MainTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="w-4 h-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings className="w-4 h-4" />
            Preferences
          </TabsTrigger>
        </TabsList>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4 mt-4">
          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all" className="gap-1">
                <Filter className="w-3 h-3" />
                All
                {filterCounts.all > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.all}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-1">
                <Shield className="w-3 h-3" />
                Security
                {filterCounts.security > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.security}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="dividends" className="gap-1">
                <DollarSign className="w-3 h-3" />
                Dividends
                {filterCounts.dividends > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.dividends}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1">
                <RefreshCw className="w-3 h-3" />
                Alerts
                {filterCounts.alerts > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.alerts}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="tax" className="gap-1">
                <Calculator className="w-3 h-3" />
                Tax
                {filterCounts.tax > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.tax}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="social" className="gap-1">
                <Heart className="w-3 h-3" />
                Social
                {filterCounts.social > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{filterCounts.social}</Badge>}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{filter === 'all' ? 'All Notifications' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Notifications`}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {filteredNotifications.length} {searchQuery && 'matching '} items
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">
                    {searchQuery 
                      ? `No notifications matching "${searchQuery}"` 
                      : 'No notifications in this category'}
                  </p>
                  {searchQuery && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="mt-2"
                    >
                      Clear search
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted/50 ${
                        !notification.is_read ? 'bg-primary/5' : ''
                      }`}
                    >
                      {/* Avatar */}
                      <Avatar className="w-10 h-10 shrink-0">
                        <AvatarImage src={notification.actor_avatar || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {notification.actor_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getNotificationIcon(notification.type)}
                          <span className="text-xs font-medium text-muted-foreground">
                            {getNotificationLabel(notification.type)}
                          </span>
                          {!notification.is_read && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{notification.actor_name}</span>
                          {notification.content && (
                            <span className="text-muted-foreground"> {notification.content}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          <span className="mx-1">•</span>
                          {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-8 w-8 p-0"
                            title="Mark as read"
                          >
                            <CheckCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Delete"
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
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <NotificationHistoryView />
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences" className="space-y-4 mt-4">
          <NotificationPreferencesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationCenterView;
