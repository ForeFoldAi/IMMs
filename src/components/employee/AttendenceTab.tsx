import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, CheckCircle, Search, Calendar, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getDaysInMonth } from 'date-fns';
import { employeeApi, branchesApi, AttendanceStatus as ApiAttendanceStatus } from '@/lib/api';
import { useRole } from '@/contexts/RoleContext';
import type { Employee as ApiEmployee, Branch } from '@/lib/api';

interface AttendanceTabProps {
  // Props can be added here if needed
}

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  unit: string;
  email: string;
  phone: string;
  contractType: string;
  isActive: boolean;
}

type AttendanceStatus = 'present' | 'absent' | 'unmarked';

export const AttendenceTab = ({}: AttendanceTabProps) => {
  const { currentUser } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, Record<number, AttendanceStatus>>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterInitialized, setFilterInitialized] = useState(false);
  
  const [existingAttendance, setExistingAttendance] = useState<any[]>([]);
  const attendanceDataLoadedRef = React.useRef(false);
  // Store totals from API (key: employeeId, value: { presentTotal, absentTotal })
  const [attendanceTotals, setAttendanceTotals] = useState<Record<string, { presentTotal: number; absentTotal: number }>>({});
  
  // Track which employees are selected for editing/saving
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  
  // Drag state for date range selection
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartEmployeeId, setDragStartEmployeeId] = useState<string | null>(null);
  const [dragStartDay, setDragStartDay] = useState<number | null>(null);
  const [dragStatus, setDragStatus] = useState<AttendanceStatus | null>(null);
  
  // Shift+Click state for range selection
  const [lastSelectedDate, setLastSelectedDate] = useState<{ employeeId: string; day: number } | null>(null);

  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  // Default to 2025 (minimum allowed year)
  const [selectedYear, setSelectedYear] = useState(2025);
  const [months, setMonths] = useState<Array<{ value: number; label: string }>>([]);
  const [yearOptions, setYearOptions] = useState<number[]>([]);

  // Get units from branches (with 'all' option)
  const units = useMemo(() => ['all', ...branches.map(b => b.name)], [branches]);
  
  // Initialize months and years
  useEffect(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    setMonths(monthNames.map((name, index) => ({ value: index, label: name })));
    
    const currentYear = new Date().getFullYear();
    const years = [];
    // Start from 2025, go up to current year + 5
    const startYear = Math.max(2025, currentYear);
    for (let i = startYear; i <= currentYear + 5; i++) {
      years.push(i);
    }
    setYearOptions(years);
  }, []);

  const daysInSelectedMonth = useMemo(() => {
    const totalDays = getDaysInMonth(new Date(selectedYear, selectedMonth));
    return Array.from({ length: totalDays }, (_, index) => index + 1);
  }, [selectedMonth, selectedYear]);

  const totalDaysInMonth = daysInSelectedMonth.length;

  // Check if selected month/year is in the future (compared to current date)
  const isFutureMonth = useMemo(() => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth(); // 0-11
    
    const selectedDate = new Date(selectedYear, selectedMonth);
    const currentDateStart = new Date(currentYear, currentMonth, 1);
    
    return selectedDate > currentDateStart;
  }, [selectedYear, selectedMonth]);

  // Frontend-only search filtering (unit filter is handled by backend)
  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp) => {
        if (!emp.isActive) return false;
        
        if (!searchQuery.trim()) return true;
        
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          emp.name.toLowerCase().includes(query) ||
          (emp.employeeId && emp.employeeId.toLowerCase().includes(query)) ||
          (emp.phone && emp.phone.toLowerCase().includes(query));

        return matchesSearch;
      }),
    [employees, searchQuery]
  );

  // Reset page when search query changes (but don't clear attendance data)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset attendance data only when month/year changes
  useEffect(() => {
    // Reset attendance data loaded flag when month/year changes
    attendanceDataLoadedRef.current = false;
    // Clear totals when month/year changes
    setAttendanceTotals({});
    // Clear attendance map when month/year changes to show fresh data
    setAttendanceMap({});
    // Clear remarks when month/year changes - remarks are month-specific
    setRemarks({});
    // Clear selected employees when month/year changes
    setSelectedEmployees(new Set());
    // Clear existing attendance when month/year changes - it's month-specific
    setExistingAttendance([]);
    // Note: Attendance map and remarks will be reloaded with new data for the selected month/year
    console.log('Month/Year changed - will reload attendance with:', {
      year: selectedYear,
      month: selectedMonth + 1,
    });
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredEmployees, itemsPerPage, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Debug logging - verify attendance data is loaded and available
  useEffect(() => {
    if (employees.length > 0 && paginatedEmployees.length > 0) {
      const firstEmployee = paginatedEmployees[0];
      const hasAttendance = !!attendanceMap[firstEmployee.id];
      const hasTotals = !!attendanceTotals[firstEmployee.id];
      const attendanceData = attendanceMap[firstEmployee.id];
      
      console.log('=== Attendance Display Check ===');
      console.log('First employee:', firstEmployee.id, firstEmployee.name);
      console.log('Has attendance map:', hasAttendance);
      console.log('Has totals:', hasTotals);
      console.log('Attendance map keys:', Object.keys(attendanceMap));
      console.log('Attendance totals keys:', Object.keys(attendanceTotals));
      
      if (hasAttendance && attendanceData) {
        const daysWithData = Object.keys(attendanceData).length;
        const presentDays = Object.values(attendanceData).filter(s => s === 'present').length;
        const absentDays = Object.values(attendanceData).filter(s => s === 'absent').length;
        console.log(`✓ Employee ${firstEmployee.id} has ${daysWithData} days of attendance data`);
        console.log(`  Present: ${presentDays}, Absent: ${absentDays}`);
        console.log('  Day-by-day data:', attendanceData);
      } else {
        console.warn('⚠️ First employee has no attendance data in map');
      }
      
      if (hasTotals) {
        console.log('Totals for first employee:', attendanceTotals[firstEmployee.id]);
      }
    }
  }, [employees.length, paginatedEmployees.length, attendanceMap, attendanceTotals]);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        let companyId = 1;
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            companyId = parsed?.company?.id || parsed?.branch?.company?.id || 1;
          } catch {
            companyId = 1;
          }
        }
        
        if (!companyId || companyId <= 0) {
          console.warn('Cannot load branches: missing companyId');
          return;
        }
        
        console.log('Fetching branches for companyId:', companyId);
        const response = await branchesApi.getByCompanyId(companyId, {
          page: 1,
          limit: 100,
        });
        console.log('Fetched branches:', response.data.length);
        console.log('Available branches:', response.data.map(b => `${b.name} (ID: ${b.id})`));
        setBranches(response.data);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };

    fetchBranches();
  }, [currentUser]);

  // Initialize filterDepartment based on user role
  // Supervisor: default to their branch
  // Company Owner: default to 'all'
  useEffect(() => {
    if (filterInitialized || branches.length === 0 || !currentUser) {
      if (!filterInitialized && branches.length === 0) {
        console.log('Waiting for branches to load before initializing filterDepartment');
      }
      return;
    }
    
    console.log('Initializing filterDepartment - role:', currentUser.role);
    console.log('Current user branch:', currentUser.branch);
    console.log('Available branches:', branches.map(b => ({ id: b.id, name: b.name })));
    
    if (currentUser.role === 'company_owner') {
      // Company owner defaults to 'all'
      console.log('Setting filterDepartment to "all" for company owner');
      setFilterDepartment('all');
      setFilterInitialized(true);
    } else if (currentUser.role === 'supervisor' && currentUser.branch?.id) {
      // Supervisor defaults to their branch - match by ID first (more reliable), then by name
      const userBranch = branches.find(b => b.id === currentUser.branch?.id) || 
                         branches.find(b => b.name === currentUser.branch?.name);
      
      if (userBranch) {
        console.log('Setting filterDepartment to supervisor branch:', userBranch.name, '(ID:', userBranch.id, ')');
        setFilterDepartment(userBranch.name);
        setFilterInitialized(true);
      } else {
        console.warn('Supervisor branch not found in branches list. Current branch:', currentUser.branch);
        console.warn('Available branch IDs:', branches.map(b => b.id));
        console.warn('Available branch names:', branches.map(b => b.name));
        // Branch not found, keep as 'all' but mark as initialized
        setFilterInitialized(true);
      }
    } else {
      // For other roles (inventory_manager, etc.) - default to their branch if available, otherwise 'all'
      if (currentUser.branch?.id) {
        const userBranch = branches.find(b => b.id === currentUser.branch?.id) || 
                           branches.find(b => b.name === currentUser.branch?.name);
        if (userBranch) {
          console.log('Setting filterDepartment to user branch for role', currentUser.role, ':', userBranch.name);
          setFilterDepartment(userBranch.name);
          setFilterInitialized(true);
        } else {
          setFilterInitialized(true);
        }
      } else {
        console.log('No branch info available, keeping filterDepartment as "all"');
        setFilterInitialized(true);
      }
    }
  }, [branches, currentUser, filterInitialized]);

  useEffect(() => {
    const loadEmployees = async () => {
      setIsLoading(true);
      try {
        // Get company ID and branch ID from stored user data
        const storedUser = localStorage.getItem('user');
        let companyId: number | undefined;
        let branchIdFromStorage: number | undefined;
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            companyId = parsed?.company?.id || parsed?.branch?.company?.id;
            branchIdFromStorage = parsed?.branch?.id;
          } catch {
            // Ignore parse errors
          }
        }

        // If companyId is not available, don't make the request
        if (!companyId || companyId <= 0) {
          console.warn('Cannot load employees: missing companyId');
          setEmployees([]);
          setIsLoading(false);
          return;
        }

        // Build base params
        const baseParams: any = {
          limit: 100, // API maximum limit is 100
        };

        // Always include companyId (API requires it)
        baseParams.companyId = companyId;

        // Add branchId filter from Factory Location dropdown (backend filtering)
        // Only filter by branchId if a specific unit is selected (not 'all')
        if (filterDepartment !== 'all') {
          const selectedBranch = branches.find(b => b.name === filterDepartment);
          if (selectedBranch?.id) {
            baseParams.branchId = selectedBranch.id;
            console.log('Filtering employees by branch:', selectedBranch.name, 'branchId:', selectedBranch.id);
          } else {
            // If branch filter is selected but branch not found, wait for branches to load
            console.log('Waiting for branches to load...');
            setIsLoading(false);
            return;
          }
        } else {
          // When 'all' is selected, don't filter by branchId - show all units
          console.log('Showing all units - no branchId filter applied');
        }

        console.log('Fetching employees with params:', baseParams);
        console.log('filterDepartment:', filterDepartment);

        // Fetch all pages of employees
        let allEmployees: ApiEmployee[] = [];
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
          const params = { ...baseParams, page: currentPage };
          const response = await employeeApi.getAllEmployees(params);
          
          console.log(`Fetched page ${currentPage}:`, response.data.length, 'employees');
          console.log('Employee branches in response:', [...new Set(response.data.map((e: ApiEmployee) => e.branch?.name))]);
          
          allEmployees = [...allEmployees, ...response.data];
          
          // Check if there are more pages
          hasMorePages = response.meta?.hasNextPage || false;
          currentPage++;
          
          // Safety check to prevent infinite loops
          if (currentPage > 1000) break;
        }
        
        // Map API employees to component format
        // Filter out terminated employees - they should not appear in attendance tab
        const terminatedCount = allEmployees.filter((emp: ApiEmployee) => emp.employmentType === 'terminated').length;
        const mappedEmployees = allEmployees
          .filter((emp: ApiEmployee) => emp.employmentType !== 'terminated')
          .map((emp: ApiEmployee) => ({
            id: emp.id.toString(),
            name: `${emp.firstName} ${emp.lastName}`,
            employeeId: emp.employeeId || `E${emp.branchId}${emp.id.toString().padStart(3, '0')}`,
            department: emp.department?.name || '',
            position: emp.position?.name || '',
            unit: emp.branch?.name || '',
            email: emp.email || '',
            phone: emp.phoneNumber || '',
            contractType: emp.employmentType || '',
            isActive: true,
          }));

        console.log('Loaded employees from API:', allEmployees.length);
        console.log('Terminated employees filtered out:', terminatedCount);
        console.log('Active employees for attendance:', mappedEmployees.length);
        console.log('Mapped employees:', mappedEmployees);
        console.log('Employee IDs:', mappedEmployees.map(e => e.id));
        console.log('First few employees:', mappedEmployees.slice(0, 3));
        
        // Fetch existing attendance for the selected month BEFORE setting employees
        // This ensures attendance data is available when the useEffect runs
        let attendanceMapData: Record<string, Record<number, AttendanceStatus>> = {};
        let totalsData: Record<string, { presentTotal: number; absentTotal: number }> = {};
        let isEmptyResponse = false; // Flag to track if API returned empty array
        
        console.log('=== Starting Attendance Fetch ===');
        console.log('CompanyId:', companyId);
        console.log('Selected Year:', selectedYear);
        console.log('Selected Month (0-indexed):', selectedMonth);
        console.log('API Month (1-indexed):', selectedMonth + 1);
        
        try {
          // Only fetch attendance if we have a valid companyId
          if (companyId && companyId > 0) {
            // Prepare payload with current year and month
            const attendancePayload = {
              companyId,
              year: selectedYear,
              month: selectedMonth + 1, // API expects 1-12, but selectedMonth is 0-11
            };
            
            console.log('✓ Fetching attendance data from API...');
            console.log('📤 Payload being sent:', attendancePayload);
            console.log('🔄 Auto-updated with current year/month selection');
            
            const attendanceResponse = await employeeApi.getAttendanceByMonth(attendancePayload);
            
            console.log('Attendance API response:', attendanceResponse);
            
            // Handle both response formats: direct array or wrapped in { data: [...] }
            const attendanceData = Array.isArray(attendanceResponse) 
              ? attendanceResponse 
              : (attendanceResponse?.data || []);
            
            console.log('Attendance data:', attendanceData);
            console.log('Attendance data is array:', Array.isArray(attendanceData));
            console.log('Attendance data length:', attendanceData.length);
            
            // For future months, API should return empty array - this is expected
            if (isFutureMonth && attendanceData.length === 0) {
              console.log('Future month selected - API returned empty data (expected behavior). Checkboxes will be empty and disabled.');
            }
            
            // Check if API returned empty array
            isEmptyResponse = Array.isArray(attendanceData) && attendanceData.length === 0;
            
            setExistingAttendance(attendanceData);

            // Populate attendance map from existing attendance
            // API response structure: array of attendance objects with employee nested and records array
            attendanceMapData = {};
            totalsData = {};
            
            // If API returns empty array, clear all attendance data to show empty checkboxes
            if (Array.isArray(attendanceData) && attendanceData.length === 0) {
              console.log('API returned empty array - clearing attendance map and remarks to show empty data');
              // Clear remarks when API returns empty array - remarks are month-specific
              setRemarks({});
              // attendanceMapData will remain empty {}, which will clear the attendance map
              // totalsData will remain empty {}, which will clear the totals
            } else if (Array.isArray(attendanceData)) {
              attendanceData.forEach((attendance: any) => {
                // Get employeeId from nested employee object or direct property
                // Ensure it's always a string to match employee.id format
                const employeeId = attendance?.employee?.id?.toString() || attendance?.employeeId?.toString();
                
                if (!employeeId) {
                  console.warn('Skipping attendance - missing employeeId:', attendance);
                  return;
                }
                
                console.log('Processing attendance for employeeId:', employeeId, 'attendance:', attendance);
                
                // Store totals from API (if available)
                if (attendance.presentTotal !== undefined && attendance.absentTotal !== undefined) {
                  totalsData[employeeId] = {
                    presentTotal: attendance.presentTotal || 0,
                    absentTotal: attendance.absentTotal || 0,
                  };
                  console.log(`Stored totals for ${employeeId}:`, totalsData[employeeId]);
                } else {
                  // Calculate totals from records if not provided by API
                  let presentCount = 0;
                  let absentCount = 0;
                  if (attendance?.records && Array.isArray(attendance.records)) {
                    attendance.records.forEach((record: any) => {
                      const statusStr = record.status?.toString().toLowerCase() || '';
                      if (statusStr === 'present' || statusStr === 'PRESENT') {
                        presentCount++;
                      } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                        absentCount++;
                      }
                    });
                  }
                  totalsData[employeeId] = {
                    presentTotal: presentCount,
                    absentTotal: absentCount,
                  };
                  console.log(`Calculated totals for ${employeeId}:`, totalsData[employeeId]);
                }
                
                if (attendance?.records && Array.isArray(attendance.records)) {
                  if (!attendanceMapData[employeeId]) {
                    attendanceMapData[employeeId] = {};
                  }
                  
                  attendance.records.forEach((record: any) => {
                    // Handle both enum values (PRESENT, ABSENT) and lowercase strings (present, absent)
                    let status: AttendanceStatus = 'unmarked';
                    if (record.status) {
                      const statusStr = record.status.toString().toLowerCase();
                      if (statusStr === 'present' || statusStr === 'PRESENT') {
                        status = 'present';
                      } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                        status = 'absent';
                      } else if (statusStr === 'leave' || statusStr === 'LEAVE') {
                        status = 'unmarked'; // Treat leave as unmarked for now
                      } else if (statusStr === 'half_day' || statusStr === 'HALF_DAY') {
                        status = 'present'; // Treat half day as present
                      }
                    }
                    // Store day-by-day attendance status
                    attendanceMapData[employeeId][record.day] = status;
                    console.log(`✓ Set day ${record.day} to ${status} for employee ${employeeId}`);
                  });
                  
                  // Use month-level remark (one per month per employee)
                  if (attendance.remark) {
                    setRemarks(prev => ({
                      ...prev,
                      [employeeId]: attendance.remark
                    }));
                    console.log(`✓ Set month-level remark for employee ${employeeId}:`, attendance.remark);
                  }
                } else {
                  console.warn('Skipping attendance - missing records array:', attendance);
                }
              });
            }
            // Set totals from API FIRST
            setAttendanceTotals(totalsData);
            
            // Mark that attendance data has been loaded BEFORE setting the map
            // This prevents the useEffect from overwriting the data
            attendanceDataLoadedRef.current = true;
            
            console.log('Final attendance map data:', attendanceMapData);
            console.log('Employee IDs in attendance map:', Object.keys(attendanceMapData));
            console.log('Attendance totals:', totalsData);
            console.log('Attendance data loaded flag set to:', attendanceDataLoadedRef.current);
          }
        } catch (error) {
          console.error('Error loading attendance:', error);
        }
        
        // Set attendance map with the fetched data
        // If API returned empty array, clear the map. Otherwise, merge with existing data
        setAttendanceMap((prev) => {
          // If API returned empty array, clear all attendance for all employees
          if (isEmptyResponse) {
            console.log('Clearing attendance map and remarks - API returned empty array');
            // Clear remarks when API returns empty array - remarks are month-specific
            setRemarks({});
            // Return empty map, but preserve structure for employees (they'll show unmarked)
            const clearedMap: Record<string, Record<number, AttendanceStatus>> = {};
            // Initialize empty maps for all employees so they show unmarked checkboxes
            mappedEmployees.forEach((emp) => {
              if (emp.isActive) {
                clearedMap[emp.id] = {};
              }
            });
            console.log('Cleared attendance map for employees:', Object.keys(clearedMap));
            return clearedMap;
          }
          
          // Merge existing data with newly loaded data (new data takes precedence)
          const merged = { ...prev, ...attendanceMapData };
          console.log('Setting attendance map - merged data:', merged);
          console.log('Attendance map keys after merge:', Object.keys(merged));
          return merged;
        });
        
        // Set employees AFTER attendance map is set and ref is marked
        // This ensures the useEffect won't overwrite the attendance data
        setEmployees(mappedEmployees);
        
        console.log('=== Monthly Attendance Data Loading Summary ===');
        console.log('Employees loaded:', mappedEmployees.length);
        console.log('Attendance entries:', Object.keys(attendanceMapData).length);
        console.log('Employee IDs:', mappedEmployees.map(e => `${e.id} (${e.name})`));
        console.log('Attendance map keys:', Object.keys(attendanceMapData));
        console.log('Attendance totals keys:', Object.keys(totalsData));
        
        // Verify ID matching and day-by-day data
        mappedEmployees.forEach(emp => {
          const hasAttendance = !!attendanceMapData[emp.id];
          const hasTotals = !!totalsData[emp.id];
          if (hasAttendance || hasTotals) {
            console.log(`✓ Employee ${emp.id} (${emp.name}) - Attendance: ${hasAttendance}, Totals: ${hasTotals}`);
            if (hasAttendance) {
              const dayData = attendanceMapData[emp.id];
              const days = Object.keys(dayData).length;
              const presentDays = Object.values(dayData).filter(s => s === 'present').length;
              const absentDays = Object.values(dayData).filter(s => s === 'absent').length;
              console.log(`  Days with data: ${days} (Present: ${presentDays}, Absent: ${absentDays})`);
              console.log(`  Day-by-day status:`, dayData);
            }
          } else {
            console.log(`✗ Employee ${emp.id} (${emp.name}) - NO attendance data`);
          }
        });
      } catch (error: any) {
        console.error('Error loading employees:', error);
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load employees. Please try again.';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setEmployees([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Load employees when:
    // - filterDepartment is 'all' (don't need branches), OR
    // - filterDepartment is not 'all' and branches have been loaded
    // Note: companyId comes from localStorage, not currentUser, so we can load without currentUser
    // But we still include currentUser in dependencies in case it affects branch selection
    if (filterDepartment === 'all' || branches.length > 0) {
      loadEmployees();
    }
  }, [currentUser, selectedMonth, selectedYear, filterDepartment, branches, refreshTrigger]);

  // Listen for employee updates from other tabs (e.g., when employee is added/updated)
  useEffect(() => {
    const handleEmployeeUpdate = () => {
      console.log('Employee update event received, refreshing attendance tab...');
      setRefreshTrigger(prev => prev + 1);
    };

    // Listen for custom event when employees are added/updated
    window.addEventListener('employee:updated', handleEmployeeUpdate);
    
    return () => {
      window.removeEventListener('employee:updated', handleEmployeeUpdate);
    };
  }, []);

  useEffect(() => {
    if (!employees.length) {
      return;
    }

    // Skip if attendance data has been loaded from API
    if (attendanceDataLoadedRef.current) {
      console.log('Skipping attendance map initialization - data already loaded from API');
      console.log('Current attendance map state:', attendanceMap);
      attendanceDataLoadedRef.current = false; // Reset for next load
      return;
    }

    // Only initialize attendance map for employees that don't have data yet
    // This preserves any existing attendance data that was loaded
    setAttendanceMap((prev) => {
      const next: Record<string, Record<number, AttendanceStatus>> = { ...prev };

      employees.forEach((employee) => {
        if (!employee.isActive) {
          return;
        }

        // Preserve existing attendance data - don't overwrite if it exists
        const existing = next[employee.id] || {};
        const row: Record<number, AttendanceStatus> = { ...existing };

        // Only set unmarked for days that don't have data yet
        // This ensures we don't overwrite saved attendance data
        daysInSelectedMonth.forEach((day) => {
          if (row[day] === undefined) {
            row[day] = 'unmarked';
          }
        });
      
        next[employee.id] = row;
      });

      console.log('Initialized attendance map for employees (preserving existing data):', next);
      return next;
    });

    setRemarks((prev) => {
      const next: Record<string, string> = {};

      employees.forEach((employee) => {
        if (!employee.isActive) {
          return;
        }

        next[employee.id] = prev[employee.id] || '';
      });

      return next;
    });
  }, [employees, daysInSelectedMonth]);

  // Global mouse handlers for better trackpad support
  useEffect(() => {
    if (!isDragging || !dragStartEmployeeId || dragStartDay === null || dragStatus === null) {
      return;
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cell = target.closest('td[data-day]') as HTMLElement;
      
      if (cell) {
        const dayAttr = cell.getAttribute('data-day');
        const employeeIdAttr = cell.getAttribute('data-employee-id');
        
        if (dayAttr && employeeIdAttr && employeeIdAttr === dragStartEmployeeId) {
          const targetDay = parseInt(dayAttr, 10);
          markDateRange(dragStartEmployeeId, dragStartDay, targetDay, dragStatus);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging && dragStartEmployeeId && dragStartDay !== null) {
        setLastSelectedDate({ employeeId: dragStartEmployeeId, day: dragStartDay });
      }
      
      setIsDragging(false);
      setDragStartEmployeeId(null);
      setDragStartDay(null);
      setDragStatus(null);
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [isDragging, dragStartEmployeeId, dragStartDay, dragStatus]);

  const handleMarkAllPresent = async () => {
    // Prevent marking all present for future months
    if (isFutureMonth) {
      toast({
        title: 'Cannot Edit Future Months',
        description: 'Attendance cannot be edited for future months. Please select a current or past month.',
        variant: 'destructive',
      });
      return;
    }
    
    if (!filteredEmployees.length) {
      return;
    }
    
    // Check if attendance is already marked (first-time check)
    // PRIMARY CHECK: Look at what's actually visible in the table (source of truth)
    // If table shows no attendance (all zeros, no marked days), always allow "Mark All Present"
    const hasVisibleAttendance = filteredEmployees.some(emp => {
      const totals = getRowTotals(emp.id);
      const dayMap = attendanceMap[emp.id] || {};
      const hasMarkedDays = daysInSelectedMonth.some(day => {
        const status = dayMap[day];
        return status === 'present' || status === 'absent';
      });
      return (totals.totalPresent > 0 || totals.totalAbsent > 0) || hasMarkedDays;
    });
    
    // If table shows no attendance, allow "Mark All Present" (regardless of API data)
    // This handles cases where API has stale/empty records but table is correctly empty
    if (!hasVisibleAttendance) {
      console.log('Mark All Present Check: No visible attendance in table - allowing operation');
      // Continue with marking all present
    } else {
      // Table shows attendance - block the operation
      console.log('Mark All Present Check: Visible attendance found in table - blocking operation');
      toast({
        title: 'Attendance Already Marked',
        description: 'Attendance has already been marked for this month. Please select individual employees to edit their attendance.',
        variant: 'destructive',
      });
      return;
    }
    
    // Set hasExistingAttendance to false since we're allowing the operation
    const hasExistingAttendance = false;
    
    
    const shouldMarkAll = !filteredEmployees.every((employee) => {
      const dayMap = attendanceMap[employee.id];
      if (!dayMap) {
        return false;
      }
      return daysInSelectedMonth.every((day) => dayMap[day] === 'present');
    });

    // If marking all present, use API for each day
    if (shouldMarkAll) {
      setIsSaving(true);
      try {
        const storedUser = localStorage.getItem('user');
        let companyId: number | undefined;
        let branchId: number | undefined;
        
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            companyId = parsed?.company?.id || parsed?.branch?.company?.id;
          } catch {
            // Ignore parse errors
          }
        }

        // Get branchId from filter - only if a specific unit is selected
        // When 'all' is selected, branchId is not required (will mark all branches)
        if (filterDepartment !== 'all') {
          const selectedBranch = branches.find(b => b.name === filterDepartment);
          branchId = selectedBranch?.id;
        }

        if (!companyId) {
          toast({
            title: 'Error',
            description: 'Missing company information',
            variant: 'destructive',
          });
          return;
        }

        // branchId is optional - if not provided, API should handle marking all branches
        // If API requires branchId, this might need backend changes

        // Mark all present for each day in the month
        const apiMonth = selectedMonth + 1; // API expects 1-12
        
        // If "All Units" is selected and API requires branchId, we need to mark for each branch
        // Otherwise, if a specific branch is selected, mark for that branch only
        if (branchId) {
          // Mark for specific branch
          for (const day of daysInSelectedMonth) {
            await employeeApi.markAllPresent({
              companyId,
              year: selectedYear,
              month: apiMonth,
              day,
              branchId,
            });
          }
        } else {
          // If "All Units" selected and no branchId, mark for all branches
          // Get all branch IDs from branches list
          if (branches.length > 0) {
            for (const branch of branches) {
              for (const day of daysInSelectedMonth) {
                await employeeApi.markAllPresent({
                  companyId,
                  year: selectedYear,
                  month: apiMonth,
                  day,
                  branchId: branch.id,
                });
              }
            }
          } else {
            toast({
              title: 'Error',
              description: 'No branches available. Cannot mark all present for all units.',
              variant: 'destructive',
            });
            return;
          }
        }

        // Update local state
        toggleAllEmployees(true);
        
        // Reload attendance data
        console.log('Reloading attendance after mark all present with payload:', {
          companyId,
          year: selectedYear,
          month: apiMonth,
        });
        
        const attendanceResponse = await employeeApi.getAttendanceByMonth({
          companyId,
          year: selectedYear,
          month: apiMonth,
        });
        
        // Handle both response formats: direct array or wrapped in { data: [...] }
        const attendanceData = Array.isArray(attendanceResponse) 
          ? attendanceResponse 
          : (attendanceResponse?.data || []);
        
        setExistingAttendance(attendanceData);

        // Update attendance map and totals
        const attendanceMapData: Record<string, Record<number, AttendanceStatus>> = {};
        const totalsData: Record<string, { presentTotal: number; absentTotal: number }> = {};
        
        if (Array.isArray(attendanceData)) {
          attendanceData.forEach((attendance: any) => {
            // Get employeeId from nested employee object
            const employeeId = attendance?.employee?.id?.toString() || attendance?.employeeId?.toString();
            
            if (!employeeId) {
              return;
            }
            
            // Store totals from API
            if (attendance.presentTotal !== undefined && attendance.absentTotal !== undefined) {
              totalsData[employeeId] = {
                presentTotal: attendance.presentTotal || 0,
                absentTotal: attendance.absentTotal || 0,
              };
            } else {
              // Calculate totals from records if not provided
              let presentCount = 0;
              let absentCount = 0;
              if (attendance?.records && Array.isArray(attendance.records)) {
                attendance.records.forEach((record: any) => {
                  const statusStr = record.status?.toString().toLowerCase() || '';
                  if (statusStr === 'present' || statusStr === 'PRESENT') {
                    presentCount++;
                  } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                    absentCount++;
                  }
                });
              }
              totalsData[employeeId] = {
                presentTotal: presentCount,
                absentTotal: absentCount,
              };
            }
            
            if (attendance?.records && Array.isArray(attendance.records)) {
              attendanceMapData[employeeId] = {};
              attendance.records.forEach((record: any) => {
                // Handle both enum values and lowercase strings
                let status: AttendanceStatus = 'unmarked';
                if (record.status) {
                  const statusStr = record.status.toString().toLowerCase();
                  if (statusStr === 'present' || statusStr === 'PRESENT') {
                    status = 'present';
                  } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                    status = 'absent';
                  } else if (statusStr === 'leave' || statusStr === 'LEAVE') {
                    status = 'unmarked';
                  } else if (statusStr === 'half_day' || statusStr === 'HALF_DAY') {
                    status = 'present';
                  }
                }
                attendanceMapData[employeeId][record.day] = status;
              });
              
              // Use month-level remark (one per month per employee)
              if (attendance.remark) {
                setRemarks(prev => ({
                  ...prev,
                  [employeeId]: attendance.remark
                }));
              }
            }
          });
        }
        
        // Update attendance map and totals with reloaded data
        setAttendanceMap(attendanceMapData);
        setAttendanceTotals(totalsData);
        
        // Auto-select all employees after marking all present
        const allEmployeeIds = new Set(filteredEmployees.map(emp => emp.id));
        setSelectedEmployees(allEmployeeIds);
        
        console.log('Attendance data reloaded after mark all present:', {
          attendanceMap: attendanceMapData,
          totals: totalsData,
          selectedEmployees: Array.from(allEmployeeIds),
        });

        toast({
          title: 'Success',
          description: 'All employees marked as present for the selected month',
        });
      } catch (error: any) {
        console.error('Error marking all present:', error);
        toast({
          title: 'Error',
          description: error?.response?.data?.message || 'Failed to mark all present. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      // Unmark all - just update local state
      toggleAllEmployees(false);
    }
  };

  const handleExportAttendance = async () => {
    try {
      // Get company ID from stored user data
      const storedUser = localStorage.getItem('user');
      let companyId: number | undefined;
      let branchId: number | undefined;
      
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          companyId = parsed?.company?.id || parsed?.branch?.company?.id;
        } catch {
          // Ignore parse errors
        }
      }

      if (!companyId || companyId <= 0) {
        toast({
          title: 'Error',
          description: 'Missing company information. Cannot export attendance.',
          variant: 'destructive',
        });
        return;
      }

      // Get branchId from filter - only if a specific unit is selected
      // When 'all' is selected, don't filter by branchId - export all units
      if (filterDepartment !== 'all') {
        const selectedBranch = branches.find(b => b.name === filterDepartment);
        branchId = selectedBranch?.id;
      }

      const apiMonth = selectedMonth + 1; // API expects 1-12
      const monthName = months.find(m => m.value === selectedMonth)?.label || `Month ${selectedMonth + 1}`;
      
      // Prepare export parameters
      const exportParams: any = {
        companyId,
        year: selectedYear,
        month: apiMonth,
      };

      // Add branchId only if a specific unit is selected (not 'all')
      if (branchId) {
        exportParams.branchId = branchId;
      }

      // Call API to export attendance to XLSX
      const blob = await employeeApi.exportAttendanceToExcel(exportParams);

      // Create and download file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_${monthName}_${selectedYear}.xlsx`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: `Attendance register exported for ${monthName} ${selectedYear}`,
      });
    } catch (error: any) {
      console.error('Error exporting attendance:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to export attendance data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAttendance = async () => {
    // Prevent saving for future months
    if (isFutureMonth) {
      toast({
        title: 'Cannot Save Attendance',
        description: 'Attendance cannot be saved for future months. Please select a current or past month.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const apiMonth = selectedMonth + 1; // API expects 1-12
      
      // Get only SELECTED employees that have attendance data
      const employeesToSave = filteredEmployees.filter(emp => {
        // Must be selected AND have attendance data
        const isSelected = selectedEmployees.has(emp.id);
        const dayMap = attendanceMap[emp.id];
        const hasAttendanceData = dayMap && Object.keys(dayMap).length > 0;
        
        return isSelected && hasAttendanceData;
      });

      if (employeesToSave.length === 0) {
        toast({
          title: 'No Selection',
          description: 'Please select at least one employee to save attendance.',
          variant: 'destructive',
        });
        return;
      }

      // Save attendance for each selected employee
      const savePromises = employeesToSave.map(async (emp) => {
        const dayMap = attendanceMap[emp.id];
        const records: Array<{ day: number; status: ApiAttendanceStatus; remark: string | null }> = [];
        
        // Convert local attendance status to API format
        // Get remark for this employee (stored with key: employee.id)
        const employeeRemark = remarks[emp.id]?.trim() || null;
        
        console.log(`Saving attendance for employee ${emp.id} (${emp.name})`);
        console.log(`Employee remark:`, employeeRemark);
        console.log(`All remarks keys:`, Object.keys(remarks));
        
        daysInSelectedMonth.forEach(day => {
          const status = dayMap[day];
          if (status && status !== 'unmarked') {
            const apiStatus = 
              status === 'present' ? ApiAttendanceStatus.PRESENT :
              status === 'absent' ? ApiAttendanceStatus.ABSENT : ApiAttendanceStatus.PRESENT;
            
            // No per-day remarks - only month-level remark
            records.push({
              day,
              status: apiStatus,
              remark: null, // No per-day remarks
            });
          }
        });

        console.log(`Records to save for employee ${emp.id}:`, records);
        console.log(`Records with remarks:`, records.filter(r => r.remark).length);

        if (records.length === 0) return;

        // Check if attendance already exists
        // Handle both employeeId (direct) and employee.id (nested) formats
        const existingAttendanceRecord = existingAttendance.find(
          (att: any) => {
            const attEmployeeId = att?.employee?.id || att?.employeeId;
            return attEmployeeId && attEmployeeId === parseInt(emp.id);
          }
        );

        // Get month-level remark for this employee
        const monthRemark = employeeRemark || null;

        if (existingAttendanceRecord) {
          // Update existing attendance
          await employeeApi.updateAttendance(existingAttendanceRecord.id, {
            records: records as any,
            remark: monthRemark, // Month-level remark (one per month)
          });
        } else {
          // Create new attendance
          await employeeApi.createAttendance({
            employeeId: parseInt(emp.id),
            year: selectedYear,
            month: apiMonth,
            records: records as any,
            remark: monthRemark, // Month-level remark (one per month)
          });
        }
      });

      await Promise.all(savePromises);

      // Reload attendance data
      const storedUser = localStorage.getItem('user');
      let companyId: number | undefined;
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          companyId = parsed?.company?.id || parsed?.branch?.company?.id;
        } catch {
          // Ignore parse errors
        }
      }

      if (companyId) {
        const attendanceResponse = await employeeApi.getAttendanceByMonth({
          companyId,
          year: selectedYear,
          month: apiMonth,
        });
        
        // Handle both response formats: direct array or wrapped in { data: [...] }
        const attendanceData = Array.isArray(attendanceResponse) 
          ? attendanceResponse 
          : (attendanceResponse?.data || []);
        
        setExistingAttendance(attendanceData);
        
        // Rebuild attendance map and totals from reloaded data
        const updatedAttendanceMap: Record<string, Record<number, AttendanceStatus>> = {};
        const totalsData: Record<string, { presentTotal: number; absentTotal: number }> = {};
        
        if (Array.isArray(attendanceData)) {
          attendanceData.forEach((attendance: any) => {
            const employeeId = attendance?.employee?.id?.toString() || attendance?.employeeId?.toString();
            
            if (!employeeId) {
              return;
            }
            
            // Store totals from API
            if (attendance.presentTotal !== undefined && attendance.absentTotal !== undefined) {
              totalsData[employeeId] = {
                presentTotal: attendance.presentTotal || 0,
                absentTotal: attendance.absentTotal || 0,
              };
            } else {
              // Calculate totals from records if not provided
              let presentCount = 0;
              let absentCount = 0;
              if (attendance?.records && Array.isArray(attendance.records)) {
                attendance.records.forEach((record: any) => {
                  const statusStr = record.status?.toString().toLowerCase() || '';
                  if (statusStr === 'present' || statusStr === 'PRESENT') {
                    presentCount++;
                  } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                    absentCount++;
                  }
                });
              }
              totalsData[employeeId] = {
                presentTotal: presentCount,
                absentTotal: absentCount,
              };
            }
            
            // Rebuild day-by-day attendance map
            if (attendance?.records && Array.isArray(attendance.records)) {
              if (!updatedAttendanceMap[employeeId]) {
                updatedAttendanceMap[employeeId] = {};
              }
              
              attendance.records.forEach((record: any) => {
                let status: AttendanceStatus = 'unmarked';
                if (record.status) {
                  const statusStr = record.status.toString().toLowerCase();
                  if (statusStr === 'present' || statusStr === 'PRESENT') {
                    status = 'present';
                  } else if (statusStr === 'absent' || statusStr === 'ABSENT') {
                    status = 'absent';
                  } else if (statusStr === 'leave' || statusStr === 'LEAVE') {
                    status = 'unmarked';
                  } else if (statusStr === 'half_day' || statusStr === 'HALF_DAY') {
                    status = 'present';
                  }
                }
                updatedAttendanceMap[employeeId][record.day] = status;
              });
              
              // Use month-level remark (one per month per employee)
              if (attendance.remark) {
                setRemarks(prev => ({
                  ...prev,
                  [employeeId]: attendance.remark
                }));
                console.log(`✓ Set month-level remark for employee ${employeeId} after save:`, attendance.remark);
              }
            }
          });
        }
        
        // Update both attendance map and totals with reloaded data
        setAttendanceMap(updatedAttendanceMap);
        setAttendanceTotals(totalsData);
        
        // Clear selection after successful save
        setSelectedEmployees(new Set());
        
        console.log('Attendance data reloaded after save:', {
          attendanceMap: updatedAttendanceMap,
          totals: totalsData,
        });
      }

      const monthName = months.find(m => m.value === selectedMonth)?.label || `Month ${selectedMonth + 1}`;
      toast({
        title: 'Attendance Saved',
        description: `Attendance for ${monthName} ${selectedYear} has been saved successfully.`,
      });
      
      console.log('✅ Attendance saved and reloaded successfully');
    } catch (error: any) {
      console.error('Error saving attendance:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to save attendance. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAllEmployees = (value: boolean) => {
    if (!filteredEmployees.length) {
      return;
    }

    setAttendanceMap((prev) => {
      const next = { ...prev };

      filteredEmployees.forEach((employee) => {
        const row: Record<number, AttendanceStatus> = { ...(next[employee.id] || {}) };
        daysInSelectedMonth.forEach((day) => {
          row[day] = value ? 'present' : 'unmarked';
        });
        next[employee.id] = row;
      });

      return next;
    });
    
    // Auto-select all employees when marking all present
    if (value) {
      const allEmployeeIds = new Set(filteredEmployees.map(emp => emp.id));
      setSelectedEmployees(allEmployeeIds);
    }
  };

  const handleEmployeeSelection = (employeeId: string, isSelected: boolean) => {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(employeeId);
      } else {
        next.delete(employeeId);
        // IMPORTANT: Do NOT clear attendance data when unselecting
        // Data remains in attendanceMap, just not selected for saving
      }
      return next;
    });
  };

  const toggleSingleDay = (employeeId: string, day: number, value: boolean) => {
    // Prevent editing for future months
    if (isFutureMonth) {
      toast({
        title: 'Cannot Edit Future Months',
        description: 'Attendance cannot be edited for future months. Please select a current or past month.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if employee has existing attendance data (already saved)
    const hasExistingAttendance = existingAttendance.some((att: any) => {
      const attEmployeeId = att?.employee?.id?.toString() || att?.employeeId?.toString();
      return attEmployeeId === employeeId;
    });
    
    // Check if employee is selected for editing
    const isEmployeeSelected = selectedEmployees.has(employeeId);
    
    // If employee has existing attendance but is not selected, show message
    if (hasExistingAttendance && !isEmployeeSelected) {
      toast({
        title: 'Employee Not Selected',
        description: 'Please select the employee checkbox to edit their attendance.',
        variant: 'destructive',
      });
      return;
    }
    
    setAttendanceMap((prev) => {
      const existing = prev[employeeId] || {};
      const nextStatus: AttendanceStatus = value ? 'present' : 'absent';

      return {
        ...prev,
        [employeeId]: {
          ...existing,
          [day]: nextStatus,
        },
      };
    });
    
    // Auto-select employee when marking attendance (only for first-time attendance)
    if (!hasExistingAttendance) {
      setSelectedEmployees((prev) => {
        const next = new Set(prev);
        next.add(employeeId); // Automatically select employee for first-time attendance
        return next;
      });
    }
    
    // Update last selected date for Shift+Click functionality
    setLastSelectedDate({ employeeId, day });
  };

  const markDateRange = (employeeId: string, startDay: number, endDay: number, status: AttendanceStatus) => {
    // Check if employee has existing attendance data (already saved)
    const hasExistingAttendance = existingAttendance.some((att: any) => {
      const attEmployeeId = att?.employee?.id?.toString() || att?.employeeId?.toString();
      return attEmployeeId === employeeId;
    });
    
    // Check if employee is selected for editing
    const isEmployeeSelected = selectedEmployees.has(employeeId);
    
    // If employee has existing attendance but is not selected, don't allow drag editing
    if (hasExistingAttendance && !isEmployeeSelected) {
      return; // Silently prevent drag editing without showing toast (to avoid spam during drag)
    }
    
    setAttendanceMap((prev) => {
      const existing = prev[employeeId] || {};
      const updated = { ...existing };
      
      const minDay = Math.min(startDay, endDay);
      const maxDay = Math.max(startDay, endDay);
      
      for (let day = minDay; day <= maxDay; day++) {
        updated[day] = status;
      }

      return {
        ...prev,
        [employeeId]: updated,
      };
    });
    
    // Auto-select employee when marking attendance (only for first-time attendance)
    if (!hasExistingAttendance) {
      setSelectedEmployees((prev) => {
        const next = new Set(prev);
        next.add(employeeId);
        return next;
      });
    }
  };

  const handleDragStart = (employeeId: string, day: number, e: React.MouseEvent) => {
    // Prevent editing for future months
    if (isFutureMonth) {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: 'Cannot Edit Future Months',
        description: 'Attendance cannot be edited for future months. Please select a current or past month.',
        variant: 'destructive',
      });
      return;
    }
    
    // Check if employee has existing attendance data (already saved)
    const hasExistingAttendance = existingAttendance.some((att: any) => {
      const attEmployeeId = att?.employee?.id?.toString() || att?.employeeId?.toString();
      return attEmployeeId === employeeId;
    });
    
    // Check if employee is selected for editing
    const isEmployeeSelected = selectedEmployees.has(employeeId);
    
    // If employee has existing attendance but is not selected, show message and prevent drag
    if (hasExistingAttendance && !isEmployeeSelected) {
      e.preventDefault();
      e.stopPropagation();
      toast({
        title: 'Employee Not Selected',
        description: 'Please select the employee checkbox to edit their attendance.',
        variant: 'destructive',
      });
      return;
    }
    
    // Handle Shift+Click for range selection
    if (e.shiftKey && lastSelectedDate && lastSelectedDate.employeeId === employeeId) {
      e.preventDefault();
      e.stopPropagation();
      
      // Use the status of the last selected date (don't toggle)
      const lastStatus = attendanceMap[employeeId]?.[lastSelectedDate.day] ?? 'unmarked';
      // If unmarked, default to present; otherwise use the same status
      const newStatus: AttendanceStatus = lastStatus === 'unmarked' ? 'present' : lastStatus;
      
      // Mark range from last selected date to current date with the same status
      markDateRange(employeeId, lastSelectedDate.day, day, newStatus);
      setLastSelectedDate({ employeeId, day });
      return;
    }
    
    // Don't start drag if clicking directly on checkbox (let checkbox handle single clicks)
    // But allow Shift+Click which is handled above
    if ((e.target as HTMLElement).closest('button[role="checkbox"]') && !e.shiftKey) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    const currentStatus = attendanceMap[employeeId]?.[day] ?? 'unmarked';
    // Determine the status to apply: if unmarked or absent, mark as present; if present, mark as absent
    const newStatus: AttendanceStatus = currentStatus === 'present' ? 'absent' : 'present';
    
    setIsDragging(true);
    setDragStartEmployeeId(employeeId);
    setDragStartDay(day);
    setDragStatus(newStatus);
    
    // Mark the initial day
    markDateRange(employeeId, day, day, newStatus);
  };

  const handleDragEnter = (employeeId: string, day: number) => {
    if (!isDragging || !dragStartEmployeeId || dragStartDay === null || dragStatus === null) {
      return;
    }
    
    // Only allow dragging within the same employee row
    if (employeeId !== dragStartEmployeeId) {
      return;
    }
    
    // Mark the range from start to current day
    markDateRange(employeeId, dragStartDay, day, dragStatus);
  };

  const handleDragEnd = () => {
    if (isDragging && dragStartEmployeeId && dragStartDay !== null) {
      // Update last selected date when drag ends
      setLastSelectedDate({ employeeId: dragStartEmployeeId, day: dragStartDay });
    }
    
    setIsDragging(false);
    setDragStartEmployeeId(null);
    setDragStartDay(null);
    setDragStatus(null);
  };

  // Check if all employees are selected for saving
  const isAllSelected = filteredEmployees.length > 0 && 
    filteredEmployees.every((employee) => selectedEmployees.has(employee.id));

  const isPartiallySelected = !isAllSelected && 
    filteredEmployees.some((employee) => selectedEmployees.has(employee.id));

  // Function to handle header checkbox - selects/deselects all employees
  // For first-time attendance: marks all as present
  // For editing existing attendance: only selects/deselects
  const handleSelectAllEmployees = (selectAll: boolean) => {
    if (selectAll) {
      // Check if this is first-time attendance (no existing attendance data)
      const hasExistingAttendance = existingAttendance.length > 0 || 
        filteredEmployees.some(emp => {
          const dayMap = attendanceMap[emp.id];
          return dayMap && Object.keys(dayMap).length > 0 && 
            daysInSelectedMonth.some(day => {
              const status = dayMap[day];
              return status === 'present' || status === 'absent';
            });
        });
      
      // If first-time attendance, mark all employees as present
      if (!hasExistingAttendance) {
        setAttendanceMap((prev) => {
          const next = { ...prev };
          filteredEmployees.forEach((employee) => {
            const row: Record<number, AttendanceStatus> = { ...(next[employee.id] || {}) };
            daysInSelectedMonth.forEach((day) => {
              row[day] = 'present';
            });
            next[employee.id] = row;
          });
          return next;
        });
      }
      
      // Select all filtered employees
      const allEmployeeIds = new Set(filteredEmployees.map(emp => emp.id));
      setSelectedEmployees(allEmployeeIds);
    } else {
      // Deselect all (but don't clear data)
      setSelectedEmployees(new Set());
    }
  };

  const getRowTotals = (employeeId: string) => {
    // Use totals from API if available, otherwise calculate from records
    const apiTotals = attendanceTotals[employeeId];
    if (apiTotals) {
      return {
        totalPresent: apiTotals.presentTotal,
        totalAbsent: apiTotals.absentTotal,
      };
    }
    
    // Fallback: calculate from attendance map if API totals not available
    const dayMap = attendanceMap[employeeId] || {};
    const totalPresent = daysInSelectedMonth.reduce((count, day) => (dayMap[day] === 'present' ? count + 1 : count), 0);
    const totalAbsent = daysInSelectedMonth.reduce((count, day) => (dayMap[day] === 'absent' ? count + 1 : count), 0);

    return { totalPresent, totalAbsent };
  };

  const headerCheckedState = isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false;

  return (
    <div className='space-y-6'>
      {/* Future Month Warning Message */}
      {isFutureMonth && (
        <Card className='border-0 shadow-sm bg-amber-50 border-amber-200'>
          <CardContent className='px-4 sm:px-6 py-3'>
            <div className='flex items-center gap-2 text-sm text-amber-800'>
              <Calendar className='w-4 h-4' />
              <span>
                You are viewing a future month ({months.find(m => m.value === selectedMonth)?.label} {selectedYear}). 
                Attendance cannot be added for future months. Only current and past months are editable.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card className='border-0 shadow-sm'>
        <CardHeader className='px-4 sm:px-6'>
          <div className='flex flex-col gap-4'>
            <div className='hidden sm:flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
              <div className='flex flex-wrap items-end gap-2'>
                <Button variant='secondary' size='sm' onClick={handleMarkAllPresent} disabled={!filteredEmployees.length || isFutureMonth}>
                  <CheckCircle className='w-4 h-4 mr-2' />
                  {isAllSelected ? 'Unmark All Present' : 'Mark All Present'}
                </Button>
              </div>

              <div className='flex flex-wrap items-end gap-2'>
                <div className='flex flex-col'>
                  <Label className='text-xs text-muted-foreground mb-1'>Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value, 10))}>
                    <SelectTrigger className='w-[140px] h-9'>
                    <SelectValue placeholder='Month' />
                  </SelectTrigger>
                  <SelectContent>
                      {/* TODO: Populate from API */}
                      {months.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>

                <div className='flex flex-col'>
                  <Label className='text-xs text-muted-foreground mb-1'>Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value, 10))}>
                    <SelectTrigger className='w-[120px] h-9'>
                    <SelectValue placeholder='Year' />
                  </SelectTrigger>
                  <SelectContent>
                      {/* TODO: Populate from API */}
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                <div className='flex flex-col'>
                  <Label className='text-xs text-muted-foreground mb-1'>Factory Location</Label>
                <Select key={`filter-department-desktop-${filterInitialized}`} value={filterDepartment} onValueChange={setFilterDepartment}>
                    <SelectTrigger className='w-40 h-9 text-left'>
                    <SelectValue placeholder='Unit' className='text-left' />
                  </SelectTrigger>
                  <SelectContent>
                      {/* TODO: Populate from API */}
                      <SelectItem value='all'>All Units</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.name}>
                          {branch.name} - {branch.location}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                </div>

                <div className='relative'>
                  <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground' />
                  <Input 
                    placeholder='Search employees...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-64 pl-10 h-9'
                  />
                </div>

                <Button variant='default' size='sm' onClick={handleSaveAttendance} disabled={isSaving || isFutureMonth}>
                  {isSaving ? <Loader2 className='w-4 h-4 mr-2 animate-spin' /> : <Save className='w-4 h-4 mr-2' />}
                  Save
                </Button>

                <Button variant='outline' size='sm' className='h-9' onClick={handleExportAttendance}>
                  <Upload className='w-4 h-4 mr-2' />
                  Export
                </Button>
              </div>
            </div>

            <div className='flex flex-col gap-3 sm:hidden'>
              {/* Search and Filters Row */}
              <div className='flex flex-col gap-2'>
                <div className='relative w-full'>
                  <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground' />
                  <Input
                    placeholder='Search employees...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full pl-9 h-10'
                  />
                </div>
                <div className='flex items-end gap-2'>
                  <div className='flex flex-col flex-1'>
                    <Label className='text-xs text-muted-foreground mb-1'>Factory Location</Label>
                <Select key={`filter-department-mobile-${filterInitialized}`} value={filterDepartment} onValueChange={setFilterDepartment}>
                      <SelectTrigger className='w-full h-10 text-xs text-left'>
                    <SelectValue placeholder='Unit' className='text-left' />
                  </SelectTrigger>
                  <SelectContent>
                        <SelectItem value='all'>All Units</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.name}>
                            {branch.name} - {branch.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  </div>
                  <Button variant='outline' size='sm' className='h-10 px-4' onClick={handleExportAttendance}>
                  <Upload className='w-4 h-4 mr-1.5' />
                  Export
                </Button>
                </div>
              </div>

              {/* Month, Year, and Action Buttons Row */}
              <div className='flex flex-col gap-2'>
                <div className='flex gap-2'>
                  <div className='flex flex-col flex-1'>
                    <Label className='text-xs text-muted-foreground mb-1'>Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value, 10))}>
                      <SelectTrigger className='w-full h-10 text-sm'>
                    <SelectValue placeholder='Month' />
                  </SelectTrigger>
                  <SelectContent>
                        {/* TODO: Populate from API */}
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  </div>

                  <div className='flex flex-col flex-1'>
                    <Label className='text-xs text-muted-foreground mb-1'>Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value, 10))}>
                      <SelectTrigger className='w-full h-10 text-sm'>
                    <SelectValue placeholder='Year' />
                  </SelectTrigger>
                  <SelectContent>
                        {/* TODO: Populate from API */}
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  </div>
                </div>

                <div className='flex gap-2'>
                <Button
                  variant='secondary'
                  size='sm'
                  onClick={handleMarkAllPresent}
                  disabled={!filteredEmployees.length || isFutureMonth}
                    className='flex-1 h-10 text-xs'
                >
                  <CheckCircle className='w-4 h-4 mr-1.5' />
                  {isAllSelected ? 'Unmark All Present' : 'Mark All Present'}
                </Button>

                <Button
                  variant='default'
                  size='sm'
                  onClick={handleSaveAttendance}
                  disabled={isSaving || isFutureMonth}
                    className='flex-1 h-10'
                >
                  {isSaving ? <Loader2 className='w-4 h-4 mr-1.5 animate-spin' /> : <Save className='w-4 h-4 mr-1.5' />}
                  Save
                </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className='px-4 sm:px-6'>
          {isLoading ? (
            <div className='flex justify-center items-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
              <span className='ml-2'>Loading employees...</span>
            </div>
          ) : (
            <div className='overflow-x-auto' style={{ userSelect: isDragging ? 'none' : 'auto' }}>
              <Table>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='w-12 text-center'>
                      <div className='flex justify-center'>
                        <Checkbox
                          checked={headerCheckedState}
                          onCheckedChange={(value) => {
                            if (isFutureMonth) {
                              toast({
                                title: 'Cannot Edit Future Months',
                                description: 'Attendance cannot be edited for future months. Please select a current or past month.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            handleSelectAllEmployees(value === true);
                          }}
                          disabled={!filteredEmployees.length || isFutureMonth}
                          className='h-4 w-4'
                          title='Select/Deselect all employees for saving'
                        />
                      </div>
                    </TableHead>
                    <TableHead className='min-w-[140px]'>Employee Name</TableHead>
                    <TableHead className='w-36 text-center'>
                      <div className='flex flex-col items-center leading-4'>
                        <span>Present</span>
                        <span className='text-xs text-muted-foreground'>Total</span>
                      </div>
                    </TableHead>
                    <TableHead className='w-36 text-center'>
                      <div className='flex flex-col items-center leading-4'>
                        <span>Absent</span>
                        <span className='text-xs text-muted-foreground'>Total</span>
                      </div>
                    </TableHead>
                    {daysInSelectedMonth.map((day) => (
                      <TableHead key={day} className='text-center w-20 px-3'>
                        {day}
                    </TableHead>
                    ))}
                    <TableHead className='min-w-[300px]'>Remark</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((employee) => {
                    const totals = getRowTotals(employee.id);
                    const rowDayMap = attendanceMap[employee.id] || {};
                    
                    // Check if employee has any attendance data
                    const hasAnyAttendance = daysInSelectedMonth.some((day) => {
                      const status = rowDayMap[day];
                      return status === 'present' || status === 'absent';
                    });

                    // Check if all days are present
                    const allPresent = daysInSelectedMonth.every((day) => rowDayMap[day] === 'present');

                    // Check if all days are absent
                    const allAbsent = daysInSelectedMonth.every((day) => rowDayMap[day] === 'absent');

                    // Check if all days are unmarked (no attendance)
                    const allUnmarked = daysInSelectedMonth.every((day) => {
                      const status = rowDayMap[day];
                      return !status || status === 'unmarked';
                    });

                    // Determine checkbox state: Checked = all present, Indeterminate = mixed or all absent, Unchecked = all unmarked
                    let rowCheckedState: boolean | 'indeterminate';
                    if (allPresent) {
                      rowCheckedState = true; // ✅ Checked - all present
                    } else if (allAbsent || (hasAnyAttendance && !allPresent && !allUnmarked)) {
                      rowCheckedState = 'indeterminate'; // ➖ Indeterminate - mixed or all absent
                    } else {
                      rowCheckedState = false; // ☐ Unchecked - all unmarked
                    }
                    
                    // Check if employee is selected for saving
                    const isEmployeeSelected = selectedEmployees.has(employee.id);
                    
                    return (
                      <TableRow 
                        key={employee.id} 
                        className={`hover:bg-muted/30 ${
                          isEmployeeSelected ? 'bg-blue-50/50 border-l-2 border-l-blue-500' : ''
                        }`}
                      >
                        <TableCell className='w-12'>
                          <div className='flex justify-center'>
                            <Checkbox
                              checked={isEmployeeSelected}
                              onCheckedChange={(value) => handleEmployeeSelection(employee.id, value === true)}
                              className='h-4 w-4'
                              title={
                                allPresent 
                                  ? 'All days marked as present' 
                                  : allAbsent 
                                    ? 'All days marked as absent' 
                                    : hasAnyAttendance 
                                      ? 'Mixed attendance (some days marked)' 
                                      : 'No attendance marked'
                              }
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{employee.name}</div>
                            <div className='text-sm text-muted-foreground'>{employee.employeeId}</div>
                          </div>
                        </TableCell>
                        <TableCell className='text-center px-3'>{totals.totalPresent}</TableCell>
                        <TableCell className='text-center px-3'>{totals.totalAbsent}</TableCell>
                        {daysInSelectedMonth.map((day) => {
                          // Get day-by-day attendance status from the map
                          const status = rowDayMap[day] ?? 'unmarked';
                          const isPresent = status === 'present';
                          const isAbsent = status === 'absent';
                          
                          // Debug: Log first employee's first day to verify data flow
                          if (paginatedEmployees.indexOf(employee) === 0 && day === 1) {
                            console.log('=== Rendering First Day of First Employee ===');
                            console.log('Employee ID:', employee.id);
                            console.log('Day:', day);
                            console.log('Row day map:', rowDayMap);
                            console.log('Status for day 1:', status);
                            console.log('Is Present:', isPresent);
                            console.log('Is Absent:', isAbsent);
                          }
                              
                              return (
                            <TableCell 
                              key={day} 
                              className={`text-center px-3 ${isFutureMonth ? 'opacity-50 cursor-not-allowed' : (isDragging && dragStartEmployeeId === employee.id ? 'cursor-grabbing' : 'cursor-pointer')}`}
                              onMouseDown={(e) => {
                                if (!isFutureMonth) {
                                  handleDragStart(employee.id, day, e);
                                } else {
                                  e.preventDefault();
                                  toast({
                                    title: 'Cannot Edit Future Months',
                                    description: 'Attendance cannot be edited for future months. Please select a current or past month.',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                              onMouseEnter={() => {
                                if (!isFutureMonth && isDragging && dragStartEmployeeId === employee.id) {
                                  handleDragEnter(employee.id, day);
                                }
                              }}
                              data-day={day}
                              data-employee-id={employee.id}
                              style={{ userSelect: 'none' }}
                            >
                              <div className='relative flex justify-center'>
                                <Checkbox
                                  checked={isPresent}
                                  disabled={isFutureMonth}
                                  onCheckedChange={(value) => {
                                    // Handle single click toggle when not dragging
                                    if (!isDragging && !isFutureMonth) {
                                      toggleSingleDay(employee.id, day, value === true);
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    if (isFutureMonth) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      toast({
                                        title: 'Cannot Edit Future Months',
                                        description: 'Attendance cannot be edited for future months. Please select a current or past month.',
                                        variant: 'destructive',
                                      });
                                      return;
                                    }
                                    
                                    // Handle Shift+Click before checkbox processes it
                                    if (e.shiftKey && lastSelectedDate && lastSelectedDate.employeeId === employee.id) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      // Use the status of the last selected date (don't toggle)
                                      const lastStatus = attendanceMap[employee.id]?.[lastSelectedDate.day] ?? 'unmarked';
                                      // If unmarked, default to present; otherwise use the same status
                                      const newStatus: AttendanceStatus = lastStatus === 'unmarked' ? 'present' : lastStatus;
                                      
                                      markDateRange(employee.id, lastSelectedDate.day, day, newStatus);
                                      setLastSelectedDate({ employeeId: employee.id, day });
                                    }
                                  }}
                                  className={`h-5 w-5 [&_svg]:hidden transition-colors duration-150 ${
                                    isFutureMonth
                                      ? '!border-gray-300 !bg-gray-100 cursor-not-allowed opacity-50'
                                      : isPresent
                                        ? '!border-green-600 !bg-green-600'
                                        : isAbsent
                                          ? '!border-red-600 !bg-red-600'
                                          : '!border-yellow-400 !bg-transparent'
                                  }`}
                                />
                                <span
                                  className={`pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold ${
                                    isPresent || isAbsent ? 'text-white' : 'text-transparent'
                                  }`}
                                >
                                  {isPresent ? 'P' : isAbsent ? 'A' : ''}
                                </span>
                              </div>
                            </TableCell>
                              );
                            })}
                        <TableCell>
                          <Input
                            placeholder='Add remark'
                            value={remarks[employee.id] || ''}
                            maxLength={100}
                            className='min-w-[300px]'
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setRemarks((prev) => ({
                                ...prev,
                                [employee.id]: nextValue,
                              }));
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredEmployees.length && (
                    <TableRow>
                      <TableCell colSpan={4 + totalDaysInMonth + 2} className='text-center py-8 text-muted-foreground'>
                        No employees found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {!searchQuery.trim() && (
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
              <div className='text-xs sm:text-sm text-muted-foreground'>
                {filteredEmployees.length > 0 
                  ? `Showing ${startIndex + 1} to ${Math.min(endIndex, filteredEmployees.length)} of ${filteredEmployees.length} entries`
                  : 'Showing 0 to 0 of 0 entries'
                }
              </div>

              <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-2 w-full sm:w-auto'>
                <div className='flex items-center gap-2 w-full sm:w-auto justify-center'>
                  <span className='text-xs sm:text-sm text-muted-foreground whitespace-nowrap'>Show:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      const newLimit = parseInt(value, 10);
                      setItemsPerPage(newLimit);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className='w-16 sm:w-20 h-8 text-xs sm:text-sm'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='20'>20</SelectItem>
                      <SelectItem value='50'>50</SelectItem>
                      <SelectItem value='100'>100</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className='text-xs sm:text-sm text-muted-foreground whitespace-nowrap'>per page</span>
                </div>

                <div className='flex items-center gap-1'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                    {Array.from({ length: Math.min(6, totalPages) }, (_, index) => {
                        let pageNum;
                        
                        if (totalPages <= 6) {
                        pageNum = index + 1;
                        } else if (currentPage <= 3) {
                        pageNum = index + 1;
                        } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 5 + index;
                        } else {
                        pageNum = currentPage - 3 + index;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size='sm'
                            onClick={() => setCurrentPage(pageNum)}
                            className='h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs sm:text-sm'
                          >
                            {pageNum}
                          </Button>
                        );
                    })}
                  </div>

                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronsRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
