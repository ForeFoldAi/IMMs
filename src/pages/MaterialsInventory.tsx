import { useState, useEffect } from "react";
import { Plus, Search, List, Table, Package, Settings, FileText, ClipboardList, Factory, Hourglass, ArrowUpRight, ShoppingBasket, Wrench } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { MaterialsTab } from "../components/MaterialsTab";
import { MachinesTab } from "../components/MachinesTab";
import { MaterialIssuesTab } from "../components/MaterialIssuesTab";
import { MaterialOrderBookTab } from "@/components/MaterialOrderBookTab";
import { RepairMaintenanceTab } from "../components/repair & maintenance/RepairMaintenanceTab";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";

const MaterialsInventory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Initialize activeTab from URL params, localStorage, or default to "materials"
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      return tabFromUrl;
    }
    return localStorage.getItem('materials-inventory-active-tab') || "materials";
  });
  
  // Check if we're on a nested route (like material-request or repair-maintenance-order)
  const isNestedRoute = location.pathname.includes('/material-request') || location.pathname.includes('/repair-maintenance-order');
  
  // Handle state parameter for active tab (from back navigation)
  useEffect(() => {
    if (location.state?.activeTab) {
      setActiveTab(location.state.activeTab);
      // Clear the state to prevent it from persisting
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('materials-inventory-active-tab', activeTab);
  }, [activeTab]);

  // Handle tab changes and update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', newTab);
    setSearchParams(newSearchParams, { replace: true });
  };
  
  // If we're on a nested route, render the outlet instead of the main content
  if (isNestedRoute) {
    return <Outlet />;
  }
  
  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0 pb-24 sm:pb-0">
      {/* Header */}
      {/*
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
          Stock Register
        </h1>
      </div>
      */}
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Desktop Tabs - Top positioned with responsive sizing */}
        <TabsList className="hidden sm:grid w-full md:w-11/12 lg:w-5/6 xl:w-4/5 2xl:w-3/4 grid-cols-5 h-auto p-1.5 bg-secondary/10 rounded-lg shadow-sm gap-1">
           <TabsTrigger 
            value="materials" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Hourglass className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Stock In Hand</span>
        </TabsTrigger>
          
          
          
          <TabsTrigger 
            value="material-issues" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <span className="relative w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5">
              <Package className="w-full h-full" />
              <ArrowUpRight className="w-1.5 h-1.5 md:w-2 md:h-2 absolute -top-1 -right-1" />
            </span>
            <span className="whitespace-nowrap">Issued Materials</span>
          </TabsTrigger>
          
<TabsTrigger 
            value="material-order-book" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <ShoppingBasket className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Purchased Materials</span>
          </TabsTrigger>

          
          <TabsTrigger 
            value="machines" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Factory className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Machines</span>
          </TabsTrigger>

          <TabsTrigger 
            value="repair-maintenance" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Wrench className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Repairs & Maintenance</span>
          </TabsTrigger>
        </TabsList>

        {/* Mobile Tabs - Fixed at Bottom */}
        <TabsList className="sm:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 h-auto p-2 bg-[#F6D7A0] backdrop-blur-xl shadow-2xl border-t border-warning/20">
          <TabsTrigger 
            value="materials" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold text-black data-[state=active]:bg-warning data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <Hourglass className="w-5 h-5 text-black" />
            <span className="text-[10px] leading-tight">Stock</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="material-issues" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold text-black data-[state=active]:bg-warning data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <span className="relative w-5 h-5">
              <Package className="w-5 h-5 text-black" />
              <ArrowUpRight className="w-2 h-2 absolute -top-1 -right-1 text-black" />
            </span>
            <span className="text-[10px] leading-tight">Issues</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="material-order-book" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold text-black data-[state=active]:bg-warning data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <ShoppingBasket className="w-5 h-5 text-black" />
            <span className="text-[10px] leading-tight">Purchased</span>
          </TabsTrigger>

          <TabsTrigger 
            value="machines" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold text-black data-[state=active]:bg-warning data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <Factory className="w-5 h-5 text-black" />
            <span className="text-[10px] leading-tight">Machines</span>
          </TabsTrigger>

          <TabsTrigger 
            value="repair-maintenance" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold text-black data-[state=active]:bg-warning data-[state=active]:text-black data-[state=active]:shadow-sm"
          >
            <Wrench className="w-5 h-5 text-black" />
            <span className="text-[10px] leading-tight">Repair</span>
          </TabsTrigger>
        </TabsList>

        {/* Custom Tab Content - Keep all components mounted to prevent reloading */}
        <div className="mt-4">
          {/* Material Issues Tab */}
          <div className={activeTab === "material-issues" ? "block" : "hidden"}>
          <MaterialIssuesTab />
          </div>

          {/* Materials Tab */}
          <div className={activeTab === "materials" ? "block" : "hidden"}>
          <MaterialsTab />
          </div>

          {/* Material Order Book Tab */}
          <div className={activeTab === "material-order-book" ? "block" : "hidden"}>
          <MaterialOrderBookTab />
          </div>

          {/* Machines Tab */}
          <div className={activeTab === "machines" ? "block" : "hidden"}>
          <MachinesTab />
          </div>

          {/* Repair and Maintenance Tab */}
          <div className={activeTab === "repair-maintenance" ? "block" : "hidden"}>
          <RepairMaintenanceTab />
          </div>
        </div>
      </Tabs>
      
      {/* Fixed Footer - Hidden on mobile, shown on desktop */}
      <div className="hidden sm:block fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 py-2 z-10">
        <p className="text-center text-sm text-muted-foreground">
          Developed & Maintained by{' '}
          <a 
            href="https://forefoldai.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 underline transition-colors duration-200"
          >
            ForeFold AI
          </a>
        </p>
      </div>
    </div>
  );
};

export default MaterialsInventory;