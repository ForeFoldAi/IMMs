import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Truck,
  MapPin,
  IndianRupee,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import { VehicleTab } from '../../components/fleet/vehicleTab';
import { TripEntryTab } from '../../components/fleet/tripEntryTab';
import { ExpensesTab } from '../../components/fleet/ExpensesTab';

export const FleetManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'expenses');

  // Update tab when URL parameter changes
  useEffect(() => {
    if (tabFromUrl && ['expenses', 'vehicles', 'trips'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Update URL when tab changes
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0 pb-24 sm:pb-0">
      {/* Header */}
      {/*
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
          Fleet Management
        </h1>
      </div>
      */}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Desktop Tabs - Top positioned with responsive sizing */}
        <TabsList className="hidden sm:grid w-full md:w-11/12 lg:w-5/6 xl:w-4/5 2xl:w-3/4 grid-cols-3 h-auto p-1.5 bg-secondary/10 rounded-lg shadow-sm gap-1">
          
        <TabsTrigger 
            value="expenses" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <IndianRupee className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap"> Recorded Vehicle Expenses</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="vehicles" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Truck className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Vehicles</span>
          </TabsTrigger>
          
          
          
        </TabsList>

        {/* Mobile Tabs - Fixed at Bottom */}
        <TabsList className="sm:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-2 h-auto p-2 bg-gradient-to-r from-foreground to-foreground backdrop-blur-xl shadow-2xl border-t border-warning/20">
          
        <TabsTrigger 
            value="expenses" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold data-[state=active]:bg-warning data-[state=active]:text-foreground data-[state=active]:shadow-sm text-white/70 data-[state=inactive]:text-white/70"
          >
            <IndianRupee className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Recorded Vehicle Expenses</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="vehicles" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold data-[state=active]:bg-warning data-[state=active]:text-foreground data-[state=active]:shadow-sm text-white/70 data-[state=inactive]:text-white/70"
          >
            <Truck className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Vehicles</span>
          </TabsTrigger>
         
        </TabsList>

        {/* Custom Tab Content - Keep all components mounted to prevent reloading */}
        <div className="mt-4">
          {/* Vehicles Tab */}
          <div className={activeTab === "vehicles" ? "block" : "hidden"}>
            <VehicleTab />
          </div>

          {/* Trips Tab */}
          <div className={activeTab === "trips" ? "block" : "hidden"}>
            <TripEntryTab />
          </div>

          {/* Expenses Tab */}
          <div className={activeTab === "expenses" ? "block" : "hidden"}>
            <ExpensesTab />
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