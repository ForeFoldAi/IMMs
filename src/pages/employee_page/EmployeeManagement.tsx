import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users,
  FileText,
  Clock,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import { AttendenceTab } from '../../components/employee/AttendenceTab';
import { EmployeeViewTab } from '../../components/employee/EmployeeViewTab';
import { LeavesViewTab } from '../../components/employee/LeavesViewTab';

export const EmployeeManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize activeTab from URL params, localStorage, or default to "attendance"
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['attendance', 'employees', 'leaves'].includes(tabFromUrl)) {
      return tabFromUrl;
    }
    return localStorage.getItem('employee-management-active-tab') || 'attendance';
  });

  // Update tab when URL parameter changes
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && ['attendance', 'employees', 'leaves'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  // Persist activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('employee-management-active-tab', activeTab);
  }, [activeTab]);

  // Handle tab changes and update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    // Update URL params
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('tab', newTab);
    setSearchParams(newSearchParams, { replace: true });
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-0 pb-24 sm:pb-0">
      {/* Header */}
      {/*
      <div className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
          Employee Management
        </h1>
      </div>
      */}
      
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        {/* Desktop Tabs - Top positioned with responsive sizing */}
        <TabsList className="hidden sm:grid w-full md:w-11/12 lg:w-5/6 xl:w-4/5 2xl:w-3/4 grid-cols-3 h-auto p-1.5 bg-secondary/10 rounded-lg shadow-sm gap-1">
          
          <TabsTrigger 
            value="attendance" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Attendance Register</span>
          </TabsTrigger>
          
          {/* <TabsTrigger 
            value="leaves" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Leave Requests</span>
          </TabsTrigger> */}
          
          <TabsTrigger 
            value="employees" 
            className="flex flex-row items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 lg:px-4 py-2 md:py-2.5 text-[11px] md:text-xs lg:text-sm font-medium rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200"
          >
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4 lg:w-4.5 lg:h-4.5" />
            <span className="whitespace-nowrap">Employee Directory</span>
          </TabsTrigger>
          
          
        </TabsList>

        {/* Mobile Tabs - Fixed at Bottom */}
        <TabsList className="sm:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-2 h-auto p-2 bg-gradient-to-r from-foreground to-foreground backdrop-blur-xl shadow-2xl border-t border-warning/20">
          
          <TabsTrigger 
            value="attendance" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold data-[state=active]:bg-warning data-[state=active]:text-foreground data-[state=active]:shadow-sm text-white/70 data-[state=inactive]:text-white/70"
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Attendance Register</span>
          </TabsTrigger>
          
          {/* <TabsTrigger 
            value="leaves" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold data-[state=active]:bg-warning data-[state=active]:text-foreground data-[state=active]:shadow-sm text-white/70 data-[state=inactive]:text-white/70"
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Leave Requests</span>
          </TabsTrigger> */}
          
          <TabsTrigger 
            value="employees" 
            className="flex flex-col items-center gap-1 px-1 py-2 text-xs font-semibold data-[state=active]:bg-warning data-[state=active]:text-foreground data-[state=active]:shadow-sm text-white/70 data-[state=inactive]:text-white/70"
          >
            <Users className="w-5 h-5" />
            <span className="text-[10px] leading-tight">Employee Directory</span>
          </TabsTrigger>
          
          
        </TabsList>

        {/* Custom Tab Content - Keep all components mounted to prevent reloading */}
        <div className="mt-4">
          {/* Attendance Tab */}
          <div className={activeTab === "attendance" ? "block" : "hidden"}>
            <AttendenceTab />
          </div>

          {/* Leaves Tab */}
          <div className={activeTab === "leaves" ? "block" : "hidden"}>
            <LeavesViewTab />
          </div>

          {/* Employees Tab */}
          <div className={activeTab === "employees" ? "block" : "hidden"}>
            <EmployeeViewTab />
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
