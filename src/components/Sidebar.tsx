import { NavLink } from 'react-router-dom';
import {
  Package,
  List,
  Shield,
  Activity,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Truck,
  Users,
} from 'lucide-react';
import { useRole } from '../contexts/RoleContext';
import { useSidebar } from '../contexts/SidebarContext';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { toast } from '../hooks/use-toast';

export const Sidebar = () => {
  const { currentUser, hasPermission, isCompanyLevel, logout } = useRole();
  const { isExpanded, toggleSidebar } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
    navigate('/login');
  };

  // Build nav items by permissions (not roles)
  const getNavigationItems = () => {
    // FIXED: Dashboard item - show only for company-level users
    const baseItems = isCompanyLevel()
      ? [
          {
            to: '/',
            label: 'Dashboard',
            icon: Activity,
            permission: null,
          },
        ]
      : [];

    const items: any[] = [
      {
        to: '/materials-inventory',
        label: 'Materials Management',
        icon: Package,
        permission: 'inventory:materials:read',
      },
      {
        to: '/fleet-management',
        label: 'Fleet Management',
        icon: Truck,
        permission: 'inventory:material-indents:create',
      },
      {
        to: '/employee-management',
        label: 'Employee Management',
        icon: Users,
        permission: null, // Add specific permission if needed
      },
      // Example: enable more entries as needed
      // {
      //   to: '/requests-list',
      //   label: 'Requests',
      //   icon: List,
      //   permission: 'inventory:material-indents:read',
      // },
      // {
      //   to: '/approval-center',
      //   label: 'Approval Center',
      //   icon: Shield,
      //   permission: 'inventory:material-indents:approve',
      // },
    ];

    return [
      ...baseItems,
      ...items.filter(
        (item) => item.permission === null || hasPermission(item.permission)
      ),
    ];
  };

  const navItems = getNavigationItems();

  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-[#fafafa] border-r border-gray-200 shadow-lg z-40 transition-all duration-300 ${
        isExpanded ? 'w-64' : 'w-16'
      }`}
    >
      {/* Floating Toggle Button - Centered */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            onClick={toggleSidebar}
            className='absolute -right-3 top-1/2 -translate-y-1/2 z-50 w-6 h-6 p-0 bg-[#fafafa] border-2 border-gray-300 hover:border-primary hover:bg-primary hover:text-primary-foreground text-gray-700 rounded-[10px] shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110'
          >
            {isExpanded ? (
              <ChevronLeft className='w-3 h-3 transition-transform duration-200' />
            ) : (
              <ChevronRight className='w-3 h-3 transition-transform duration-200' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='right' className='rounded-[10px]'>
          <p>{isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}</p>
        </TooltipContent>
      </Tooltip>

      <div className='flex flex-col h-full'>
        {/* Navigation Items */}
        <nav className='flex-1  py-6 space-y-2'>
          {navItems.map((item) => {
            const Icon = item.icon;
            const navLink = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => {
                  // Set navigation flag when user explicitly clicks on dashboard
                  if (item.to === '/') {
                    sessionStorage.setItem('navigation-flag', 'true');
                  }
                }}
                className={({ isActive }) =>
                  `group flex items-center ${
                    isExpanded ? 'space-x-3 px-4' : 'justify-center px-2'
                  } py-3 font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-gray-100 text-gray-900 border-l-4 border-primary'
                      : 'text-gray-700 hover:bg-gray-50 border-none hover:text-gray-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 transition-all duration-300 group-hover:scale-105 flex-shrink-0 ${
                        isExpanded ? '' : 'mx-auto'
                      } ${isActive ? 'text-primary' : ''}`}
                    />
                    {isExpanded && (
                      <span className='text-sm font-medium whitespace-nowrap'>
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );

            if (!isExpanded) {
              return (
                <Tooltip key={item.to}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side='right' className='rounded-[10px]'>
                    <p>{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>

        {/* Logout Button at Bottom */}
        <div className='p-4  border-gray-200'>
          {!isExpanded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='outline'
                  onClick={handleLogout}
                  className='w-full justify-center border-gray-300 hover:bg-gray-50 hover:text-gray-900 text-gray-700 bg-transparent text-sm px-4 py-2 rounded-full transition-all duration-300 font-medium'
                >
                  <LogOut className='w-4 h-2 transition-all duration-300 group-hover:scale-105 flex-shrink-0' />
                </Button>
              </TooltipTrigger>
              <TooltipContent side='right' className='rounded-[10px]'>
                <p>Logout</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant='outline'
              onClick={handleLogout}
              className='w-full gap-3 border-gray-300 hover:bg-gray-50 hover:text-gray-900 text-gray-700 bg-transparent text-sm px-4 py-3 rounded-[10px] transition-all duration-300 font-medium'
            >
              <LogOut className='w-4 h-4 transition-all duration-300 group-hover:scale-105 flex-shrink-0' />
              <span>Logout</span>
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
};
