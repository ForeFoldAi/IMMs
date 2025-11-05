import { Outlet, useLocation } from "react-router-dom";
import { TopHeaderSimple } from "./TopHeaderSimple";
import { Sidebar } from "./Sidebar";
import { LogOut, Menu, Home, Package, List, ChevronDown , LayoutDashboard, Bell, Truck} from "lucide-react";
import { Button } from "./ui/button";
import { RoleSwitcher } from "./RoleSwitcher";
import { useRole } from "../contexts/RoleContext";
import { useSidebar } from "../contexts/SidebarContext";
import { useNavigate } from "react-router-dom";
import { toast } from "../hooks/use-toast";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";

export const Layout = () => {
  const { logout, currentUser, hasPermission, isCompanyLevel } = useRole();
  const { isExpanded } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);

  // Track current path for refresh persistence
  useEffect(() => {
    // Store current path in localStorage for refresh persistence
    if (location.pathname !== '/login') {
      localStorage.setItem('last-visited-path', location.pathname);
    }
  }, [location.pathname]);

  // Check notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      setIsNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Firebase Notification Toggle Handler
  const handleToggleNotifications = async () => {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          // Disable notifications
          setIsNotificationEnabled(false);
          toast({
            title: "Notifications Disabled",
            description: "You will no longer receive push notifications.",
          });
          // TODO: Remove FCM token from backend
        } else {
          // Request permission
          const permission = await Notification.requestPermission();
          
          if (permission === 'granted') {
            setIsNotificationEnabled(true);
            toast({
              title: "Notifications Enabled",
              description: "You will now receive notifications for important updates.",
            });
            // TODO: Initialize Firebase Cloud Messaging and save token to backend
          } else if (permission === 'denied') {
            setIsNotificationEnabled(false);
            toast({
              title: "Notifications Blocked",
              description: "Please enable notifications in your browser settings.",
              variant: "destructive",
            });
          }
        }
      } else {
        toast({
          title: "Not Supported",
          description: "Your browser doesn't support notifications.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      toast({
        title: "Error",
        description: "Failed to update notification settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    navigate("/login");
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!currentUser?.name) return 'U';
    const names = currentUser.name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return currentUser.name.substring(0, 2).toUpperCase();
  };

  // Build nav items by permissions (same as MobileNavigation)
  const getNavigationItems = () => {
    const baseItems = isCompanyLevel()
      ? [
          {
            to: '/',
            label: 'Dashboard',
            icon: LayoutDashboard,
            permission: null,
          },
        ]
      : [];

    const items = [
      {
        to: '/materials-inventory',
        label: 'Materials',
        icon: Package,
        permission: 'inventory:materials:read',
      },
      {
        to: '/fleet-management',
        label: 'Fleet Management',
        icon: Truck,
        permission: isCompanyLevel() ? null : 'inventory:material-indents:create', // Company owners have access regardless of permission
      },
     
    ];

    return [
      ...baseItems,
      ...items.filter(
        (item) => item.permission === null || hasPermission(item.permission as any)
      ),
    ];
  };

  const navItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-x-hidden w-full max-w-[100vw]">
      {/* Desktop Header */}
      <div className="hidden md:block">
        <TopHeaderSimple />
      </div>
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Mobile Header */}
      <div className="md:hidden fixed top-px left-px right-px z-50 w-auto">
        <div className="bg-gradient-to-r from-foreground to-foreground backdrop-blur-xl rounded-2xl shadow-2xl border border-warning/20 mx-auto transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between px-4 py-2 w-full">
          {/* Logo */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <img 
              src="/logo.png" 
              alt="Sree Sai Logo" 
              className="h-10 w-auto object-contain rounded-lg shadow-lg"
            />
          </div>

          {/* Right side: Navigation Menu + User Avatar + Logout */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Navigation Dropdown */}
            <DropdownMenu open={isNavOpen} onOpenChange={setIsNavOpen}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-1 px-2 py-1 text-white hover:text-warning hover:border-warning border-white rounded-[20px] bg-transparent flex-shrink-0"
                >
                  <Menu className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-background">
                <DropdownMenuLabel className="text-foreground">Navigation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.to}
                      onClick={() => {
                        navigate(item.to);
                        setIsNavOpen(false);
                        if (item.to === '/') {
                          sessionStorage.setItem('navigation-flag', 'true');
                        }
                      }}
                      className={`cursor-pointer ${
                        location.pathname === item.to
                          ? 'bg-primary/10 text-primary'
                          : 'text-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Avatar with Initials */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="p-0 h-auto rounded-full hover:opacity-80 flex-shrink-0"
                >
                  <Avatar className="h-8 w-8 border-2 border-warning">
                    <AvatarFallback className="bg-warning text-foreground font-semibold text-sm">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-background">
                <DropdownMenuLabel className="text-foreground">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{currentUser?.name || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.email || ''}</p>
                    <p className="text-xs text-primary font-semibold capitalize">
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-foreground">
                  <div className="w-full">
                    <RoleSwitcher />
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-foreground cursor-pointer"
                  onClick={handleToggleNotifications}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Bell className={`w-4 h-4 ${isNotificationEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <span className="text-sm">Push Notifications</span>
                    </div>
                    <Badge 
                      className={`text-xs px-2 py-0.5 ${
                        isNotificationEnabled 
                          ? 'bg-green-100 text-green-700 border-green-300' 
                          : 'bg-gray-100 text-gray-600 border-gray-300'
                      }`}
                      variant="outline"
                    >
                      {isNotificationEnabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Logout Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="gap-1 px-2 py-1 text-xs text-white hover:text-warning hover:border-warning border-white rounded-[20px] bg-transparent flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={`pt-[60px] md:pt-24 px-px sm:px-6 pb-8 md:pb-8 transition-all duration-300 overflow-x-hidden w-full ${
        isExpanded ? 'md:pl-72' : 'md:pl-24'
      }`}>
        <div className="w-full max-w-full overflow-x-hidden">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation - REMOVED, now in header dropdown */}
    </div>
  );
};
