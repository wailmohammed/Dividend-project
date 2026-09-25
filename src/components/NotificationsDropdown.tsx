import { useState } from 'react';
import { Bell, Heart, MessageSquare, UserPlus, Check, X, Calendar, AlertTriangle, Info } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { ScrollArea } from './ui/scroll-area';
import { useNotifications, AppNotification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

const NotificationsDropdown = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [open, setOpen] = useState(false);

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'follower':
        return <UserPlus className="w-4 h-4 text-primary" />;
      case 'like':
        return <Heart className="w-4 h-4 text-destructive" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case 'dividend':
        return <Calendar className="w-4 h-4 text-primary" />;
      case 'market_sync':
        return <AlertTriangle className="w-4 h-4 text-primary" />;
      case 'system':
        return <Info className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getNotificationText = (notification: AppNotification) => {
    switch (notification.type) {
      case 'follower':
        return `${notification.actor_name} started following you`;
      case 'like':
        return `${notification.actor_name} liked your post`;
      case 'comment':
        return `${notification.actor_name} commented: "${notification.content?.substring(0, 50)}${(notification.content?.length || 0) > 50 ? '...' : ''}"`;
      case 'dividend':
        return notification.content || 'Upcoming dividend event';
      case 'market_sync':
        return notification.content || 'Market sync status update';
      case 'system':
        return notification.content || 'System notification';
      default:
        return notification.content || 'New notification';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="py-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`group flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id);
                    }
                  }}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={notification.actor_avatar} />
                    <AvatarFallback>
                      {notification.actor_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {getNotificationIcon(notification.type)}
                      <p className="text-sm flex-1">
                        {getNotificationText(notification)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationsDropdown;
