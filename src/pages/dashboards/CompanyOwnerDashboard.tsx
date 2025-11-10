import { useState, useEffect } from "react";
import { IndianRupee, Calendar, AlertCircle, Building2, Loader2, WifiOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend } from "../../components/ui/chart";
import { BarChart as ReBarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { branchesApi } from "../../lib/api/branches";
import { machinesApi } from "../../lib/api/machines";
import { materialsApi } from "../../lib/api/materials";
import { dashboardApi } from "../../lib/api/dashboard";
import { materialIndentsApi } from "../../lib/api/material-indents";
import { Branch, Machine, Material } from "../../lib/api/types";
import { useCache } from "../../contexts/CacheContext";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { useNavigate } from "react-router-dom";
import { Truck } from "lucide-react";

const CompanyOwnerDashboard = () => {
  const cache = useCache();
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    return localStorage.getItem('dashboard-selected-period') || "this_month";
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expensesData, setExpensesData] = useState<any>(null);
  const [fleetExpensesData, setFleetExpensesData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [windowWidth, setWindowWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Time period options
  const timePeriods = [
    { value: "this_month", label: "This Month", months: 1, dateRangeType: "this_month" },
    { value: "3m", label: "3 Months", months: 3, dateRangeType: "last_3_months" },
    { value: "6m", label: "6 Months", months: 6, dateRangeType: "last_6_months" },
    { value: "1y", label: "1 Year", months: 12, dateRangeType: "custom" },
  ];

  // Fetch branches from API with caching
  const fetchBranches = async (useCache: boolean = true) => {
    const cacheKey = 'dashboard-branches';
    
    if (useCache && cache.has(cacheKey)) {
      setBranches(cache.get(cacheKey));
      return;
    }

    try {
      const response = await branchesApi.getAll({
        page: 1,
        limit: 2,
        sortBy: 'id',
        sortOrder: 'ASC'
      });
      setBranches(response.data);
      cache.set(cacheKey, response.data, 10 * 60 * 1000); // Cache for 10 minutes
    } catch (err) {
      console.error('Error fetching branches:', err);
      throw new Error('Failed to load branches');
    }
  };

  // Fetch machines from API with caching
  const fetchMachines = async (useCache: boolean = true) => {
    const cacheKey = 'dashboard-machines';
    
    if (useCache && cache.has(cacheKey)) {
      setMachines(cache.get(cacheKey));
      return;
    }

    try {
      const response = await machinesApi.getAll({
        page: 1,
        limit: 100, // Get more machines for better data
        sortBy: 'name',
        sortOrder: 'ASC'
      });
      setMachines(response.data);
      cache.set(cacheKey, response.data, 10 * 60 * 1000); // Cache for 10 minutes
    } catch (err) {
      console.error('Error fetching machines:', err);
      throw new Error('Failed to load machines');
    }
  };

  // Fetch materials from API with caching
  const fetchMaterials = async (useCache: boolean = true) => {
    const cacheKey = 'dashboard-materials';
    
    if (useCache && cache.has(cacheKey)) {
      setMaterials(cache.get(cacheKey));
      return;
    }

    try {
      const response = await materialsApi.getMaterials({
        page: 1,
        limit: 100, // Get more materials for better data
        sortBy: 'name',
        sortOrder: 'ASC'
      });
      setMaterials(response.data);
      cache.set(cacheKey, response.data, 10 * 60 * 1000); // Cache for 10 minutes
    } catch (err) {
      console.error('Error fetching materials:', err);
      throw new Error('Failed to load materials');
    }
  };

  // Fetch pending approvals count for materials
  const fetchPendingApprovals = async (useCache: boolean = true) => {
    const cacheKey = 'dashboard-pending-approvals';
    
    if (useCache && cache.has(cacheKey)) {
      setPendingApprovalsCount(cache.get(cacheKey));
      return;
    }

    try {
      const response = await materialIndentsApi.getAll({
        page: 1,
        limit: 1,
        status: 'pending_approval', // Only get pending_approval status, exclude approved
        sortBy: 'id',
        sortOrder: 'DESC',
      });
      
      // Verify that all returned items have pending_approval status
      if (response.data && response.data.length > 0) {
        const nonPendingItems = response.data.filter(item => item.status !== 'pending_approval');
        if (nonPendingItems.length > 0) {
          // Silently handle data inconsistency
        }
      }
      
      setPendingApprovalsCount(response.meta.itemCount);
      cache.set(cacheKey, response.meta.itemCount, 2 * 60 * 1000); // Cache for 2 minutes
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      // Keep the current count on error
    }
  };


  // Fetch fleet expenses data
  const fetchFleetExpensesData = async (useCache: boolean = true) => {
    const cacheKey = `dashboard-fleet-expenses-${selectedPeriod}`;
    
    if (useCache && cache.has(cacheKey)) {
      setFleetExpensesData(cache.get(cacheKey));
      return;
    }

    try {
      const currentPeriod = timePeriods.find(p => p.value === selectedPeriod);
      
      // Calculate date range for API params
      let startDate: string | undefined;
      let endDate: string | undefined;
      let dateRangeType: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom' = 'this_month';
      
      if (currentPeriod) {
        dateRangeType = currentPeriod.dateRangeType as 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom';
        
        const endDateObj = new Date();
        const startDateObj = new Date();
        
        if (currentPeriod.value === 'this_month') {
          startDateObj.setDate(1);
        } else if (currentPeriod.value === '3m') {
          startDateObj.setMonth(endDateObj.getMonth() - 3);
        } else if (currentPeriod.value === '6m') {
          startDateObj.setMonth(endDateObj.getMonth() - 6);
        } else if (currentPeriod.value === '1y') {
          startDateObj.setFullYear(endDateObj.getFullYear() - 1);
        }
        
        startDate = startDateObj.toISOString().split('T')[0];
        endDate = endDateObj.toISOString().split('T')[0];
      }

      // Prepare API params
      const apiParams: any = {
        dateRangeType,
      };

      // Add startDate and endDate if available (for custom ranges or when needed)
      if (startDate) {
        apiParams.startDate = startDate;
      }
      if (endDate) {
        apiParams.endDate = endDate;
      }

      // Fetch vehicle expenses data (includes both totalExpenses and vehicleExpenses)
      const vehicleExpensesResponse = await dashboardApi.getVehicleExpenses(apiParams);

      // Use vehicle expenses data directly from API
      const vehicleExpensesByUnit = (vehicleExpensesResponse.vehicleExpenses || []).map((vehicle: any) => ({
        registrationNumber: vehicle.registrationNumber || 'Unknown',
        make: vehicle.make || 'Unknown Make',
        amount: vehicle.amount || 0,
      }));

      const fleetData = {
        totalFleetExpenses: vehicleExpensesResponse.totalExpenses?.total || 0,
        unitOneFleetExpenses: 0, // Not used if API doesn't provide unit breakdown
        unitTwoFleetExpenses: 0, // Not used if API doesn't provide unit breakdown
        vehicleExpensesByUnit,
      };

      setFleetExpensesData(fleetData);
      cache.set(cacheKey, fleetData, 5 * 60 * 1000); // Cache for 5 minutes
    } catch (err) {
      console.error('Error fetching fleet expenses data:', err);
      // Set empty data on error
      setFleetExpensesData({
        totalFleetExpenses: 0,
        unitOneFleetExpenses: 0,
        unitTwoFleetExpenses: 0,
        vehicleExpensesByUnit: [],
      });
    }
  };

  // Fetch expenses data from dashboard API with caching
  const fetchExpensesData = async (useCache: boolean = true) => {
    const cacheKey = `dashboard-expenses-${selectedPeriod}`;
    
    if (useCache && cache.has(cacheKey)) {
      setExpensesData(cache.get(cacheKey));
      return;
    }

    try {
      const currentPeriod = timePeriods.find(p => p.value === selectedPeriod);
      const params: any = {
        dateRangeType: (currentPeriod?.dateRangeType || 'this_month') as 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom'
      };

      // For custom date ranges, calculate start and end dates
      if (params.dateRangeType === 'custom') {
        const endDate = new Date();
        const startDate = new Date();
        
        if (selectedPeriod === '1y') {
          startDate.setFullYear(endDate.getFullYear() - 1);
        }
        
        params.startDate = startDate.toISOString().split('T')[0];
        params.endDate = endDate.toISOString().split('T')[0];
      }
      
      const response = await dashboardApi.getExpenses(params);
      setExpensesData(response);
      cache.set(cacheKey, response, 5 * 60 * 1000); // Cache for 5 minutes
    } catch (err) {
      console.error('Error fetching expenses data:', err);
      throw new Error('Failed to load expenses data');
    }
  };

  // Fetch all data with smart loading
  const fetchData = async (showLoading: boolean = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      
      // Load cached data first, then update in background
      // Fetch branches first as fleet expenses depend on them
      await fetchBranches(true);
      await Promise.all([
        fetchMachines(true), 
        fetchMaterials(true),
        fetchExpensesData(true),
        fetchFleetExpensesData(true),
        fetchPendingApprovals(true)
      ]);
      
      // If this is the initial load and we have cached data, mark as initialized
      if (!isInitialized) {
        setIsInitialized(true);
      }
      
      // Update data in background without showing loading
      setTimeout(async () => {
        try {
          await fetchBranches(false);
          await Promise.all([
            fetchMachines(false), 
            fetchMaterials(false),
            fetchExpensesData(false),
            fetchFleetExpensesData(false),
            fetchPendingApprovals(false)
          ]);
        } catch (err) {
          console.warn('Background data update failed:', err);
        }
      }, 100);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Get pending approvals data from API only
  const getPendingApprovalsData = () => {
    // Only return real data from API - no mock values
    return {
      pendingApprovals: pendingApprovalsCount || 0,
    };
  };

  // Handle navigation to pending approvals
  const handlePendingApprovalsClick = () => {
    // Navigate to materials inventory with material-order-book tab and pending filter
    navigate('/materials-inventory?tab=material-order-book&filter=pending_approval');
  };

  // Generate vehicle expenses data from fleet API data
  const generateVehicleExpensesData = () => {
    // Use API data directly - it should already be in the correct format
    if (fleetExpensesData?.vehicleExpensesByUnit && fleetExpensesData.vehicleExpensesByUnit.length > 0) {
      return fleetExpensesData.vehicleExpensesByUnit.map((vehicle: any) => ({
          registrationNumber: vehicle.registrationNumber || 'Unknown',
          make: vehicle.make || 'Unknown Make',
        amount: vehicle.amount || 0,
      }));
    }

    // Return empty array when no API data is available
    return [];
  };

  // Calculate max expense value for Y-axis scaling
  const getMaxExpenseValue = () => {
    const vehicleExpenses = generateVehicleExpensesData();
    let maxValue = 0;
    
    vehicleExpenses.forEach((expense: any) => {
      const value = expense.amount || 0;
      if (value > maxValue) {
        maxValue = value;
      }
    });
    
    // If maxValue is 0 or less, return 0 (no data to display)
    if (maxValue <= 0) {
      return 0;
    }
    
    // Add small padding (10%) and round up to nearest 10k for cleaner ticks
    // This reduces empty space at the top while keeping 10k increments
    const paddedValue = maxValue * 1.1;
    return Math.ceil(paddedValue / 10000) * 10000;
  };

  const vehicleExpensesByUnit = generateVehicleExpensesData();
  const pendingApprovalsData = getPendingApprovalsData();
  const maxExpenseValue = getMaxExpenseValue();
  
  // Generate Y-axis ticks (always 10k increments: 0k, 10k, 20k, 30k, 40k, 50k, 60k...)
  const generateYAxisTicks = () => {
    const ticks = [];
    
    // If no data, return just [0]
    if (maxExpenseValue <= 0) {
      return [0];
    }
    
    // Always use 10k step increments
    const step = 10000;
    
    // Round maxTick up to nearest 10k
    const maxTick = Math.ceil(maxExpenseValue / step) * step;
    
    // Generate ticks from 0 to maxTick with 10k increments
    for (let i = 0; i <= maxTick; i += step) {
      ticks.push(i);
    }
    
    return ticks;
  };

  // Get totals from API data only
  const allUnitsTotal = expensesData?.totalExpenses?.total || 0;
  const unitOneTotal = expensesData?.unitOneExpenses?.total || 0;
  const unitTwoTotal = expensesData?.unitTwoExpenses?.total || 0;


  const getPeriodLabel = () => {
    return timePeriods.find(p => p.value === selectedPeriod)?.label || "This Month";
  };

  // Persist selected period to localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-selected-period', selectedPeriod);
  }, [selectedPeriod]);

  // Fetch data on component mount and when period changes
  useEffect(() => {
    // Only show loading on initial load or when period changes
    const showLoading = !isInitialized;
    fetchData(showLoading);
  }, [selectedPeriod]);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, []);

  // Monitor network status
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

  // Monitor window resize for responsive chart labels
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Only show loading on initial load, not on background updates
  if (loading && !isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchData(true)} className="btn-primary">
            Reload
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="space-y-4 sm:space-y-8 p-0 sm:p-6 max-w-7xl mx-auto">
        {/* Network Status Alert */}
        {!isOnline && (
          <Alert className="border-red-200 bg-red-50 text-red-800">
            <WifiOff className="h-4 w-4" />
            <AlertDescription>
              You are currently offline. Some features may not work properly. Please check your internet connection.
            </AlertDescription>
          </Alert>
        )}
        {/* Header Section - Left/Right Layout */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-6">
          {/* Left Side - Title and Description */}
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
              Expenses Dashboard
            </h1>
          </div>
          
          {/* Right Side - Time Period Filter */}
          <Card className="p-3 sm:p-4 bg-card shadow-lg border border-primary/20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                Time Period:
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-2 w-full sm:w-auto">
                {timePeriods.map((period) => (
                  <Button
                    key={period.value}
                    variant={selectedPeriod === period.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2 h-auto transition-all duration-200 ${
                      selectedPeriod === period.value
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                        : "hover:bg-primary/10 border-primary/30 text-foreground"
                    }`}
                  >
                    {period.label}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Stats Cards with Colored Borders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {/* Total Fleet Expenses */}
          <Card className="p-4 sm:p-5 border-l-4 border-l-purple-500 min-w-0 hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight break-words">Total Fleet Expenses</p>
                </div>
                <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-purple-500 flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-xl sm:text-2xl font-bold leading-tight break-words text-purple-700 dark:text-purple-400">₹{(fleetExpensesData?.totalFleetExpenses || 0).toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight break-words">
                  Vehicle
                </p>
            </div>
          </Card>

          {/* Total Material Expenses - All Units */}
          <Card className="p-4 sm:p-5 border-l-4 border-l-green-500 min-w-0 hover:shadow-md transition-shadow">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight break-words">Total Material Expenses - All Units</p>
                </div>
                <IndianRupee className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-xl sm:text-2xl font-bold leading-tight break-words text-green-700 dark:text-green-400">₹{allUnitsTotal.toLocaleString()}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight break-words">
                {branches.length > 0 ? branches.map(b => b.name).join(', ') : 'All Branches'}
              </p>
            </div>
          </Card>

          {/* Dynamic Branch Cards */}
          {branches.map((branch, index) => {
            const branchTotal = index === 0 ? unitOneTotal : unitTwoTotal;
            const borderColor = index === 0 ? 'border-l-blue-500' : 'border-l-orange-500';
            const iconColor = index === 0 ? 'text-blue-500' : 'text-orange-500';
            const periodData = index === 0 ? expensesData?.unitOneExpenses : expensesData?.unitTwoExpenses;
            
            return (
              <Card key={branch.id} className={`p-4 sm:p-5 border-l-4 ${borderColor} min-w-0 hover:shadow-md transition-shadow`}>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight break-words">
                        Total Material Expenses - {branch.name}
                      </p>
                    </div>
                    <Building2 className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor} flex-shrink-0 mt-0.5`} />
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold leading-tight break-words ${index === 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>₹{branchTotal.toLocaleString()}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight break-words">
                    {branch.location || periodData?.period || 'N/A'}
                  </p>
                </div>
              </Card>
            );
          })}

          {/* Pending Approvals - Material Requests */}
          <Card 
            className="p-4 sm:p-5 border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-all duration-200 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 min-w-0"
            onClick={handlePendingApprovalsClick}
          >
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight break-words">Pending Approvals</p>
                </div>
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-xl sm:text-2xl font-bold leading-tight text-amber-700 dark:text-amber-400">{pendingApprovalsData.pendingApprovals}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight break-words">Material Requests</p>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="space-y-4 sm:space-y-8">
          {/* Vehicle Expenses Chart */}
          <Card className="card-friendly shadow-lg border border-primary/20">
            <CardHeader className="pb-1 sm:pb-2 px-2 sm:px-3 pt-2 sm:pt-3">
              <CardTitle className="text-xs sm:text-base lg:text-lg font-semibold flex flex-col sm:flex-row sm:items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full"></div>
                  <span className="text-xs sm:text-sm lg:text-base">Vehicle Expenses</span>
                </div>
                <Badge variant="outline" className="sm:ml-auto text-[9px] sm:text-[10px] bg-primary/10 text-primary border-primary/30 w-fit">
                  {getPeriodLabel()}
                </Badge>
              </CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Total vehicle expenses breakdown by individual vehicles
              </p>
            </CardHeader>
            <CardContent className="px-2 sm:px-3 pb-1 sm:pb-2">
              {vehicleExpensesByUnit.length > 0 ? (
                <ChartContainer config={{}} className="w-full h-80 sm:h-80 lg:h-96 xl:h-[28rem]">
                  <ReBarChart 
                    data={vehicleExpensesByUnit} 
                    margin={{ 
                      left: 0, 
                      right: 0, 
                      bottom: windowWidth < 480 ? 110 : windowWidth < 640 ? 100 : windowWidth < 1024 ? 85 : 80, 
                      top: 10 
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="registrationNumber" 
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      height={windowWidth < 480 ? 130 : windowWidth < 640 ? 115 : windowWidth < 1024 ? 105 : 100}
                      interval={0}
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const vehicleData = vehicleExpensesByUnit[payload.index];
                        const registrationNumber = vehicleData?.registrationNumber || payload.value || '';
                        const make = vehicleData?.make || '';
                        
                        // Responsive breakpoints based on window width state
                        const isMobile = windowWidth < 640;
                        const isTablet = windowWidth >= 640 && windowWidth < 1024;
                        const isSmallMobile = windowWidth < 480;
                        
                        // Responsive font sizes - optimized for mobile readability
                        const regFontSize = isSmallMobile ? 9 : isMobile ? 10 : isTablet ? 10 : 11;
                        const makeFontSize = isSmallMobile ? 8 : isMobile ? 9 : isTablet ? 9 : 10;
                        
                        // Responsive vertical positioning (stacked vertically)
                        const regDy = isSmallMobile ? 9 : isMobile ? 10 : isTablet ? 10 : 11;
                        const makeDy = isSmallMobile ? 20 : isMobile ? 22 : isTablet ? 22 : 24;
                        
                        // Don't truncate - show full text on all screens
                        const displayReg = registrationNumber;
                        
                        // Angle for diagonal/cross display (responsive angle - steeper on mobile)
                        const angle = isSmallMobile ? -65 : isMobile ? -55 : -45;
                        
                        return (
                          <g transform={`translate(${x},${y}) rotate(${angle})`}>
                            <text
                              x={0}
                              y={0}
                              dy={regDy}
                              textAnchor="end"
                              fill="hsl(var(--muted-foreground))"
                              fontSize={regFontSize}
                              fontWeight={500}
                            >
                              {displayReg}
                            </text>
                            <text
                              x={0}
                              y={0}
                              dy={makeDy}
                              textAnchor="end"
                              fill="hsl(var(--muted-foreground))"
                              fontSize={makeFontSize}
                            >
                              {make}
                            </text>
                          </g>
                        );
                      }}
                    />
                    <YAxis 
                      tick={(props: any) => {
                        const { x, y, payload } = props;
                        const fontSize = windowWidth < 480 ? 9 : windowWidth < 640 ? 10 : windowWidth < 1024 ? 10 : 11;
                        const formattedValue = payload.value >= 1000000
                          ? `₹${(payload.value / 1000000).toFixed(1)}M`
                          : `₹${(payload.value / 1000)}k`;
                        
                        return (
                          <text
                            x={x}
                            y={y}
                            textAnchor="end"
                            fill="hsl(var(--muted-foreground))"
                            fontSize={fontSize}
                            dy={3}
                          >
                            {formattedValue}
                          </text>
                        );
                      }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      width={windowWidth < 480 ? 48 : windowWidth < 640 ? 52 : windowWidth < 1024 ? 55 : 60}
                      domain={[0, maxExpenseValue]}
                      ticks={generateYAxisTicks()}
                      interval={0}
                      allowDecimals={false}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent 
                        formatter={(value) => [`₹${Number(value).toLocaleString()}`, '']}
                        labelFormatter={(label, payload) => {
                          if (payload && payload.length > 0) {
                            const data = payload[0].payload;
                            return `Registration: ${data.registrationNumber || label}\nMake: ${data.make || 'N/A'}`;
                          }
                          return `Vehicle: ${label}`;
                        }}
                      />} 
                    />
                    <Bar 
                      dataKey="amount" 
                      fill="#3B82F6" 
                      barSize={windowWidth < 480 ? 14 : windowWidth < 640 ? 16 : windowWidth < 1024 ? 18 : 20} 
                      radius={windowWidth < 480 ? [4, 4, 0, 0] : windowWidth < 640 ? [5, 5, 0, 0] : [6, 6, 0, 0]}
                      name="Total Expenses"
                        />
                  </ReBarChart>
                </ChartContainer>
              ) : (
                <div className="flex items-center justify-center h-80 sm:h-80 lg:h-96 xl:h-[28rem] text-muted-foreground">
                  <div className="text-center">
                    <Truck className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-xs sm:text-sm">No vehicle expense data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CompanyOwnerDashboard;
