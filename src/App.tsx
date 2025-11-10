import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { RoleProvider, useRole } from './contexts/RoleContext';
import { StockProvider } from './contexts/StockContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { CacheProvider } from './contexts/CacheContext';
import { Layout } from './components/Layout';
import { NavigationTracker } from './components/NavigationTracker';
import Dashboard from './pages/Dashboard';
import MaterialsInventory from './pages/MaterialsInventory';
import MaterialRequest from './pages/MaterialRequest';

import AddStock from './pages/AddStock';
import OrganizationalManagement from './pages/OrganizationalManagement';
import RequestDetails from './pages/RequestDetails';
import { FleetManagement } from './pages/fleet_page/fleet_management';
import { Alert, AlertDescription } from './components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

import Login from './pages/Login';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();

// Network Status Component
const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert className="border-red-200 bg-red-50 text-red-800">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          You are currently offline. Some features may not work properly. Please check your internet connection.
        </AlertDescription>
      </Alert>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useRole();
  return isAuthenticated ? <>{children}</> : <Navigate to='/login' replace />;
};

// Role-based Home Redirect Component
const RoleBasedHome = () => {
  const { currentUser, isCompanyLevel, hasPermission } = useRole();

  if (!currentUser) {
    return <Navigate to='/login' replace />;
  }

  // FIXED: Only company-level users get the dashboard
  if (isCompanyLevel()) {
    return <Dashboard />;
  }

  // For supervisors and other users, redirect to materials inventory
  if (hasPermission('inventory:materials:read')) {
    return <Navigate to='/materials-inventory' replace />;
  }

  // Fallback to dashboard
  return <Dashboard />;
};

const AppRoutes = () => {
  const { isAuthenticated, currentUser, isCompanyLevel, hasPermission } = useRole();

  // Handle login redirect based on userType
  const getLoginRedirect = () => {
    if (!currentUser) return '/';

    // FIXED: Check isCompanyLevel instead of permissions
    if (isCompanyLevel()) {
      return '/';
    }

    if (hasPermission('inventory:materials:read')) {
      return '/materials-inventory';
    }

    return '/';
  };

  return (
    <Routes>
      <Route
        path='/login'
        element={
          !isAuthenticated ? (
            <Login />
          ) : (
            <Navigate to={getLoginRedirect()} replace />
          )
        }
      />
      <Route
        path='/'
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<RoleBasedHome />} />
        
        {/* Nested routes under materials-inventory */}
        <Route path='materials-inventory' element={<MaterialsInventory />}>
          <Route path='material-request' element={<MaterialRequest />} />
        </Route>
        
        {/* Keep the standalone material-request route for backwards compatibility */}
        <Route path='material-request' element={<MaterialRequest />} />
        
      
        <Route path='add-stock' element={<AddStock />} />
      
        <Route
          path='organizational-management'
          element={<OrganizationalManagement />}
        />
        <Route path='fleet-management' element={<FleetManagement />} />
      
       
        <Route path='request-details/:requestId' element={<RequestDetails />} />

        {/* Legacy routes for backwards compatibility */}
        <Route path='materials' element={<MaterialsInventory />} />
       
        <Route path='inventory' element={<MaterialsInventory />} />
      </Route>
      <Route path='*' element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <CacheProvider>
      <RoleProvider>
        <StockProvider>
          <SidebarProvider>
            <TooltipProvider>
              <NetworkStatus />
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <NavigationTracker />
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </SidebarProvider>
        </StockProvider>
      </RoleProvider>
    </CacheProvider>
  </QueryClientProvider>
);

export default App;
