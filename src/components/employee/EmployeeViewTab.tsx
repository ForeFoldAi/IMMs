import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Search,
  Filter,
  Upload,
  Eye,
  Edit,
  MoreHorizontal,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building,
  Briefcase,
  DollarSign,
  Clock,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Users,
  UserPlus,
  Settings,
  FileText,
  Star,
  Shield
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRole } from '@/contexts/RoleContext';
import { format } from 'date-fns';
import { EmployeeOnboardForm } from './EmployeeOnboardForm';
import { employeeApi, branchesApi, EmploymentType as EmploymentTypeEnum, AttendanceStatus } from '@/lib/api';
import type { Employee as ApiEmployee, Branch, EmploymentType, Attendance } from '@/lib/api/types';

interface EmployeeViewTabProps {
  // Props can be added here if needed
}

interface Employee {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  nationality: string;
  
  // Address Information
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  
  // Employment Information
  department: string;
  position: string;
  reportingManager: string;
  joiningDate: string;
  contractType: 'permanent' | 'contract' | 'temporary' | 'intern' | 'terminated';
  unit: string;
  unitLocation: string;
  
  // Contract Details
  probationPeriod?: string;
  noticePeriod?: string;
  salary?: string;
  benefits?: string;
  workingHours?: string;
  workLocation?: string;
  
  // Status and Additional Information
  status: 'active' | 'inactive' | 'terminated' | 'on_leave';
  skills: string;
  experience: string;
  education: string;
  notes: string;
  
  // System Information
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastLogin?: string;
}

interface EmployeeLeaveRecord {
  year: number;
  month: string;
  leavesTaken: number;
}

type SortField = 'fullName' | 'employeeId' | 'department' | 'position' | 'unit' | 'phone' | 'contractType' | 'joiningDate' | 'status' | 'createdAt' | 'updatedAt';
type SortOrder = 'ASC' | 'DESC';

export const EmployeeViewTab = ({}: EmployeeViewTabProps) => {
  const { currentUser, hasPermission } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddEmployeeDialogOpen, setIsAddEmployeeDialogOpen] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isLoadingLeaveHistory, setIsLoadingLeaveHistory] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const [leaveRecords, setLeaveRecords] = useState<EmployeeLeaveRecord[]>([]);
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterContractType, setFilterContractType] = useState('all');
  
  // Sorting and pagination
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [totalItems, setTotalItems] = useState(0);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [filterInitialized, setFilterInitialized] = useState(false);
  
  // Get units from branches (with 'all' option)
  const units = ['all', ...branches.map(b => b.name)];
  // Get contract types from enum (with 'all' option)
  const contractTypes = ['all', ...Object.values(EmploymentTypeEnum)];


  const contractTypeConfig = {
    permanent: { label: 'Permanent', color: 'bg-blue-100 text-blue-800', icon: Shield },
    contract: { label: 'Contract', color: 'bg-orange-100 text-orange-800', icon: FileText },
    temporary: { label: 'Temporary', color: 'bg-purple-100 text-purple-800', icon: Clock },
    intern: { label: 'Intern', color: 'bg-green-100 text-green-800', icon: Star },
    terminated: { label: 'Terminated', color: 'bg-red-100 text-red-800', icon: FileText },
  };

  // Reset page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterUnit, filterContractType, searchQuery]);

  // Load employees when filters, pagination, or sorting changes (search is handled on frontend)
  useEffect(() => {
    loadEmployees();
  }, [currentPage, itemsPerPage, sortField, sortOrder, filterUnit, filterContractType, branches]);

  // Frontend-only search filtering (searches all columns)
  useEffect(() => {
    let filtered = employees;

    // Apply search filter (frontend-only) - searches all columns
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(employee => {
        // Search across all employee fields
        const searchableFields = [
          employee.employeeId,
          employee.firstName,
          employee.lastName,
          employee.fullName,
          employee.email,
          employee.phone,
          employee.dateOfBirth,
          employee.gender,
          employee.maritalStatus,
          employee.nationality,
          employee.address,
          employee.city,
          employee.state,
          employee.postalCode,
          employee.country,
          employee.department,
          employee.position,
          employee.unit,
          employee.unitLocation,
          employee.contractType,
          employee.joiningDate,
          employee.status,
          employee.skills,
          employee.experience,
          employee.education,
          employee.notes,
        ];
        
        // Check if search query matches any field
        return searchableFields.some(field => 
          field && String(field).toLowerCase().includes(searchLower)
        );
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Special handling for unit (factory location) - include location if available
      if (sortField === 'unit') {
        const aLocation = (a as any).unitLocation || '';
        const bLocation = (b as any).unitLocation || '';
        // Create combined string for sorting: "UNIT1-Location" or just "UNIT1"
        aValue = aValue ? `${String(aValue)}${aLocation ? `-${String(aLocation)}` : ''}` : '';
        bValue = bValue ? `${String(bValue)}${bLocation ? `-${String(bLocation)}` : ''}` : '';
      }

      // Handle null/undefined values (after unit special handling)
      if (aValue == null || aValue === undefined) aValue = '';
      if (bValue == null || bValue === undefined) bValue = '';

      // Convert to appropriate type for comparison
      if (sortField === 'joiningDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = aValue ? new Date(aValue).getTime() : 0;
        bValue = bValue ? new Date(bValue).getTime() : 0;
      } else if (typeof aValue === 'string' || sortField === 'unit') {
        // String sorting (including unit which is now a string after special handling)
        aValue = String(aValue).toLowerCase().trim();
        bValue = String(bValue).toLowerCase().trim();
      } else if (typeof aValue === 'number') {
        // Handle numeric sorting
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      // Handle comparison
      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      if (sortOrder === 'ASC') {
        return comparison;
      } else {
        return -comparison;
      }
    });

    setFilteredEmployees(filtered);
    setCurrentPage(1);
  }, [employees, searchQuery, sortField, sortOrder]);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      if (!currentUser?.branch?.id) return;
      
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
        
        const response = await branchesApi.getByCompanyId(companyId, {
          page: 1,
          limit: 100,
        });
        setBranches(response.data);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };

    fetchBranches();
  }, [currentUser]);

  // Initialize filterUnit based on user role
  // Supervisor: default to their branch
  // Company Owner: default to 'all'
  useEffect(() => {
    if (filterInitialized || branches.length === 0 || !currentUser) {
      if (!filterInitialized && branches.length === 0) {
        console.log('Waiting for branches to load before initializing filterUnit');
      }
      return;
    }
    
    console.log('Initializing filterUnit - role:', currentUser.role);
    console.log('Current user branch:', currentUser.branch);
    console.log('Available branches:', branches.map(b => ({ id: b.id, name: b.name })));
    
    if (currentUser.role === 'company_owner') {
      // Company owner defaults to 'all'
      console.log('Setting filterUnit to "all" for company owner');
      setFilterUnit('all');
      setFilterInitialized(true);
    } else if (currentUser.role === 'supervisor' && currentUser.branch?.id) {
      // Supervisor defaults to their branch - match by ID first (more reliable), then by name
      const userBranch = branches.find(b => b.id === currentUser.branch?.id) || 
                         branches.find(b => b.name === currentUser.branch?.name);
      
      if (userBranch) {
        console.log('Setting filterUnit to supervisor branch:', userBranch.name, '(ID:', userBranch.id, ')');
        setFilterUnit(userBranch.name);
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
          console.log('Setting filterUnit to user branch for role', currentUser.role, ':', userBranch.name);
          setFilterUnit(userBranch.name);
          setFilterInitialized(true);
        } else {
          setFilterInitialized(true);
        }
      } else {
        console.log('No branch info available, keeping filterUnit as "all"');
        setFilterInitialized(true);
      }
    }
  }, [branches, currentUser, filterInitialized]);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      // Get company ID from stored user data
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

      if (!companyId || companyId <= 0) {
        console.warn('Cannot load employees: missing companyId');
        setEmployees([]);
        setIsLoading(false);
        return;
      }

      // Map frontend sortField to backend field names
      // For 'unit', we skip backend sorting and rely on frontend sorting by branch name
      const getBackendSortField = (field: SortField): string | null => {
        switch (field) {
          case 'fullName':
            return 'createdAt'; // Backend doesn't have fullName, use createdAt
          case 'unit':
            return null; // Skip backend sorting for unit - use frontend sorting by branch name
          case 'phone':
            return 'phoneNumber'; // Map phone to phoneNumber for backend sorting
          case 'contractType':
            return 'employmentType'; // Map contractType to employmentType for backend sorting
          default:
            return field;
        }
      };

      const backendSortField = getBackendSortField(sortField);
      
      // Use normal pagination (search is handled on frontend)
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        companyId: companyId,
      };
      
      // Only add sortBy if we have a valid backend sort field
      // For 'unit', we rely on frontend sorting after data is loaded
      if (backendSortField) {
        params.sortBy = backendSortField;
        params.sortOrder = sortOrder;
      }

      // Add branchId filter from Factory Location dropdown (backend filtering)
      // Only filter by branchId if a specific unit is selected (not 'all')
      if (filterUnit !== 'all') {
        const selectedBranch = branches.find(b => b.name === filterUnit);
        if (selectedBranch?.id) {
          params.branchId = selectedBranch.id;
          console.log('Filtering by branch:', selectedBranch.name, 'branchId:', selectedBranch.id);
        }
      } else {
        // When 'all' is selected, explicitly set branchId to null/undefined to request all branches
        // Some backends might default to user's branch if branchId is omitted
        // Try explicitly setting it to null or omit it - backend should return all if user has permission
        console.log('Showing all units - no branchId filter applied');
        // Explicitly don't set branchId to let backend decide based on user permissions
        // If backend filters by user branch by default, this needs to be fixed on backend
      }

      // Add employmentType filter (backend filtering)
      if (filterContractType !== 'all') {
        params.employmentType = filterContractType;
      }

      console.log('Loading employees with params:', params);
      console.log('filterUnit value:', filterUnit);
      console.log('branches available:', branches.map(b => b.name));
      const response = await employeeApi.getAllEmployees(params);
      console.log('Received employees:', response.data.length, 'total:', response.meta?.itemCount);
      console.log('Employee branches in response:', [...new Set(response.data.map((e: ApiEmployee) => e.branch?.name))]);
      
      // Map API employees to component format
      const mappedEmployees = response.data.map((emp: ApiEmployee) => ({
        id: emp.id.toString(),
        employeeId: emp.employeeId || `E${emp.branchId}${emp.id.toString().padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`,
        email: emp.email,
        phone: emp.phoneNumber,
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender,
        maritalStatus: emp.maritalStatus,
        nationality: emp.country,
        address: emp.address,
        city: emp.city,
        state: emp.state,
        postalCode: emp.postalCode,
        country: emp.country,
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        department: emp.department?.name || '',
        position: emp.position?.name || '',
        reportingManager: '',
        joiningDate: emp.joiningDate,
        contractType: (emp.employmentType === 'permanent' || emp.employmentType === 'contract' || emp.employmentType === 'temporary' || emp.employmentType === 'intern' || emp.employmentType === 'terminated')
          ? emp.employmentType 
          : 'permanent' as 'permanent' | 'contract' | 'temporary' | 'intern' | 'terminated',
        unit: emp.branch?.name || 'UNIT1',
        unitLocation: emp.branch?.location || '',
        probationPeriod: '',
        noticePeriod: '',
        salary: '',
        benefits: '',
        workingHours: '',
        workLocation: '',
        status: (emp.employmentType === 'terminated' ? 'terminated' : 'active') as 'active' | 'inactive' | 'terminated' | 'on_leave',
        skills: '',
        experience: '',
        education: '',
        notes: '',
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt,
        createdBy: '',
        lastLogin: '',
      }));

      setEmployees(mappedEmployees);
      
      // Update pagination based on API response
      if (response.meta) {
        setTotalItems(response.meta.itemCount || 0);
        const totalPages = response.meta.pageCount || 1;
        if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
        }
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employees. Please try again.',
        variant: 'destructive',
      });
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column: SortField) => {
    if (sortField === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(column);
      setSortOrder('DESC');
    }
  };

  const getSortIcon = (column: SortField) => {
    if (sortField !== column) {
      return <ArrowUpDown className='w-4 h-4 text-muted-foreground' />;
    }
    return sortOrder === 'ASC' ? (
      <ChevronUp className='w-4 h-4 text-primary' />
    ) : (
      <ChevronDown className='w-4 h-4 text-primary' />
    );
  };

  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewDialogOpen(true);
  };

  const handleViewEmployeeLeaves = async (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsLeaveDialogOpen(true);
    setIsLoadingLeaveHistory(true);
    setLeaveRecords([]);
    
    try {
      const employeeId = parseInt(employee.id);
      if (isNaN(employeeId)) {
        console.error('Invalid employee ID:', employee.id);
        setLeaveRecords([]);
        return;
      }

      // Get current date to determine which months to fetch
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 1-12

      // Fetch attendance data for current year (all months up to current month)
      const attendancePromises: Promise<Attendance>[] = [];
      
      for (let month = 1; month <= currentMonth; month++) {
        attendancePromises.push(
          employeeApi.getAttendance({
            employeeId,
            year: currentYear,
            month,
          }).catch((error) => {
            // If attendance doesn't exist for a month, return null
            console.warn(`No attendance data for ${currentYear}-${month}:`, error);
            return null as any;
          })
        );
      }

      // Also fetch previous year if needed (optional - can remove if not needed)
      // For now, just fetch current year

      const attendanceData = await Promise.all(attendancePromises);

      // Process attendance data: filter for absent records and group by year/month
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      const leaveRecordsMap = new Map<string, EmployeeLeaveRecord>();

      attendanceData.forEach((attendance, index) => {
        if (!attendance || !attendance.records) return;

        const month = index + 1; // month number (1-12)
        const year = attendance.year || currentYear;
        const key = `${year}-${month}`;

        // Filter for absent records only
        const absentRecords = attendance.records.filter(
          (record) => record.status === AttendanceStatus.ABSENT || record.status?.toLowerCase() === 'absent'
        );

        if (absentRecords.length > 0) {
          leaveRecordsMap.set(key, {
            year,
            month: monthNames[month - 1],
            leavesTaken: absentRecords.length,
          });
        }
      });

      // Convert map to array and sort by year (desc) then month (desc)
      const records = Array.from(leaveRecordsMap.values()).sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year; // Descending year
        }
        // Sort by month index (descending)
        const aMonthIndex = monthNames.indexOf(a.month);
        const bMonthIndex = monthNames.indexOf(b.month);
        return bMonthIndex - aMonthIndex;
      });

      setLeaveRecords(records);
    } catch (error) {
      console.error('Error loading leave history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave history. Please try again.',
        variant: 'destructive',
      });
      setLeaveRecords([]);
    } finally {
      setIsLoadingLeaveHistory(false);
    }
  };

  const handleCloseViewDialog = () => {
    setSelectedEmployee(null);
    setIsViewDialogOpen(false);
  };

  const handleCloseLeaveDialog = () => {
    setSelectedEmployee(null);
    setLeaveRecords([]);
    setIsLeaveDialogOpen(false);
  };

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setIsAddEmployeeDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsAddEmployeeDialogOpen(true);
  };

  const handleCloseAddEmployeeDialog = () => {
    setEditingEmployee(null);
    setIsAddEmployeeDialogOpen(false);
  };

  const handleEmployeeSubmit = async (employeeData: any) => {
    console.log('Employee submitted:', employeeData);
    
    // Store editing state before clearing it
    const wasEditing = !!editingEmployee;
    
    // Close the dialog first
    setIsAddEmployeeDialogOpen(false);
    setEditingEmployee(null);
    
    // Reset to first page to see the newly added employee
    setCurrentPage(1);
    
    // Small delay to ensure backend has processed the new employee
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Reload employees to show the new one
    await loadEmployees();
    
    // Dispatch custom event to notify other tabs (like AttendenceTab) to refresh
    window.dispatchEvent(new CustomEvent('employee:updated'));
    
    toast({
      title: 'Success',
      description: wasEditing ? 'Employee updated successfully.' : 'Employee added successfully.',
    });
  };

  const handleExportEmployees = async () => {
    try {
      // Get company ID from stored user data
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

      if (!companyId || companyId <= 0) {
        toast({
          title: 'Error',
          description: 'Missing company information. Cannot export employees.',
          variant: 'destructive',
        });
        return;
      }

      // Prepare export parameters matching current filters
      const exportParams: any = {
        companyId,
      };

      // Add branchId filter if Factory Location filter is selected
      // Only filter by branchId if a specific unit is selected (not 'all')
      if (filterUnit !== 'all') {
        const selectedBranch = branches.find(b => b.name === filterUnit);
        if (selectedBranch?.id) {
          exportParams.branchId = selectedBranch.id;
        }
      }
      // When 'all' is selected, don't filter by branchId - export all units

      // Add employmentType filter if Contract Type filter is selected
      if (filterContractType !== 'all') {
        exportParams.employmentType = filterContractType;
      }

      // Call API to export employees to XLSX
      const blob = await employeeApi.exportToExcel(exportParams);

      // Create and download file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employees_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export Successful',
        description: 'Employee directory exported successfully as XLSX',
      });
    } catch (error: any) {
      console.error('Error exporting employees:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.message || 'Failed to export employee data. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Calculate pagination
  // When searching, use frontend pagination on filtered results
  // Otherwise, use API pagination
  const isSearching = searchQuery.trim().length > 0;
  const totalItemsForPagination = isSearching ? filteredEmployees.length : totalItems;
  const totalPages = Math.max(1, Math.ceil(totalItemsForPagination / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItemsForPagination);
  
  // Apply frontend pagination when searching, otherwise use already paginated data
  const paginatedEmployees = isSearching 
    ? filteredEmployees.slice(startIndex, endIndex)
    : filteredEmployees;


  return (
    <div className='space-y-6'>
      {/* Main Content */}
      <Card className='border-0 shadow-sm'>
        <CardHeader>
          <div className='flex flex-col gap-4'>
            <div className='hidden sm:flex flex-col gap-4 md:flex-row md:justify-between md:items-end'>
              <CardTitle className='text-base flex items-center gap-2'>
                
              </CardTitle>

              <div className='flex flex-wrap items-end gap-2'>
                <div className='relative'>
                  <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground' />
                  <Input
                    placeholder='Search employees...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='pl-10 w-64 h-9'
                  />
                </div>

                <div className='flex flex-col'>
                  <Label className='text-xs text-muted-foreground mb-1'>Factory Location</Label>
                <Select key={`filter-unit-desktop-${filterInitialized}`} value={filterUnit} onValueChange={setFilterUnit}>
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

                <div className='flex flex-col'>
                  <Label className='text-xs text-muted-foreground mb-1'>Employment Type</Label>
                <Select value={filterContractType} onValueChange={setFilterContractType}>
                    <SelectTrigger className='w-36 h-9'>
                    <SelectValue placeholder='Contract' />
                  </SelectTrigger>
                  <SelectContent>
                      {/* TODO: Populate from API */}
                      <SelectItem value='all'>All Types</SelectItem>
                    {contractTypes.filter(type => type !== 'all').map((type) => (
                      <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>

                <div className='flex items-center gap-2 ml-0 md:ml-2'>
                  <Button variant='outline' size='sm' className='h-9' onClick={handleExportEmployees}>
                    <Upload className='w-4 h-4 mr-2' />
                    Export
                  </Button>
                  <Button size='sm' onClick={handleAddEmployee} className='h-9'>
                    <UserPlus className='w-4 h-4 mr-2' />
                    Add Employee
                  </Button>
                </div>
              </div>
            </div>

            <div className='flex flex-col gap-3 sm:hidden'>
              {/* Search Bar - Full Width */}
              <div className='relative w-full'>
                  <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground' />
                  <Input
                    placeholder='Search employees...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-9 w-full h-10'
                  />
                </div>

              {/* Filters Row */}
              <div className='flex items-end gap-2'>
                <div className='flex flex-col flex-1'>
                  <Label className='text-xs text-muted-foreground mb-1'>Factory Location</Label>
                <Select key={`filter-unit-${filterInitialized}`} value={filterUnit} onValueChange={setFilterUnit}>
                    <SelectTrigger className='w-full h-10 text-xs text-left'>
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

                <div className='flex flex-col flex-1'>
                  <Label className='text-xs text-muted-foreground mb-1'>Employment Type</Label>
                <Select value={filterContractType} onValueChange={setFilterContractType}>
                    <SelectTrigger className='w-full h-10 text-xs'>
                    <SelectValue placeholder='Type' />
                  </SelectTrigger>
                  <SelectContent>
                      {/* TODO: Populate from API */}
                      <SelectItem value='all'>All Types</SelectItem>
                    {contractTypes.filter(type => type !== 'all').map((type) => (
                      <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className='flex items-center gap-2'>
                <Button variant='outline' size='sm' className='flex-1 h-10' onClick={handleExportEmployees}>
                  <Upload className='w-4 h-4 mr-1.5' />
                  Export
                </Button>
                <Button size='sm' onClick={handleAddEmployee} className='flex-1 h-10'>
                  <UserPlus className='w-4 h-4 mr-1.5' />
                  Add Employee
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center items-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
              <span className='ml-2'>Loading employees...</span>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('employeeId')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Employee ID
                        {getSortIcon('employeeId')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[200px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('fullName')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Employee Name
                        {getSortIcon('fullName')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('unit')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Factory Location
                        {getSortIcon('unit')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[150px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('department')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Department
                        {getSortIcon('department')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('phone')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Phone Number
                        {getSortIcon('phone')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[100px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('contractType')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Employment Type
                        {getSortIcon('contractType')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('position')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Position/Job Title
                        {getSortIcon('position')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEmployees.map((employee) => {
                    const employeeContractConfig = contractTypeConfig[employee.contractType];
                    
                    return (
                      <TableRow key={employee.id} className='hover:bg-muted/30'>
                        <TableCell className='font-mono text-sm'>
                          <div className='inline-flex flex-col items-start group'>
                            <button
                              onClick={() => handleEditEmployee(employee)}
                              className='text-primary hover:text-primary/80 hover:underline cursor-pointer'
                            >
                              {employee.employeeId}
                            </button>
                            <span className='text-[10px] uppercase text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150'>
                              Edit
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='inline-flex flex-col items-start group'>
                            <button
                              onClick={() => handleViewEmployeeLeaves(employee)}
                              className='font-medium text-primary hover:text-primary/80 hover:underline'
                            >
                              {employee.fullName}
                            </button>
                            <span className='text-[10px] uppercase text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150'>
                              View leave history
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-muted-foreground' />
                            {employee.unitLocation ? `${employee.unit}-${employee.unitLocation}` : employee.unit}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <Building className='w-4 h-4 text-muted-foreground' />
                            {employee.department}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-1 text-sm'>
                            <Phone className='w-3 h-3 text-muted-foreground' />
                            <span>{employee.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex flex-col'>
                            <Badge className={employeeContractConfig.color}>
                              {React.createElement(employeeContractConfig.icon, { className: 'w-3 h-3 mr-1' })}
                              {employeeContractConfig.label}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {employee.position}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination - Show always (frontend pagination when searching) */}
          <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
            {/* Page Info */}
            <div className='text-xs sm:text-sm text-muted-foreground'>
              {totalItemsForPagination > 0 
                ? `Showing ${startIndex + 1} to ${endIndex} of ${totalItemsForPagination} entries`
                : 'Showing 0 to 0 of 0 entries'
              }
            </div>

              {/* Pagination Controls */}
              <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-2 w-full sm:w-auto'>
                {/* Items per page selector - Mobile optimized */}
                <div className='flex items-center gap-2 w-full sm:w-auto justify-center'>
                  <span className='text-xs sm:text-sm text-muted-foreground whitespace-nowrap'>Show:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      const newLimit = parseInt(value);
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

                {/* Page navigation - Mobile optimized */}
                <div className='flex items-center gap-1'>
                  {/* First page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Previous page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Page numbers - Show up to 6 pages */}
                  <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                    {Array.from(
                      { length: Math.min(6, totalPages) },
                      (_, i) => {
                        let pageNum;
                        
                        if (totalPages <= 6) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
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
                      }
                    )}
                  </div>

                  {/* Next page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Last page button */}
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
        </CardContent>
      </Card>

      {/* Search Results Info - Show when searching and no error */}
      {searchQuery.trim() && filteredEmployees.length > 0 && (
        <div className='text-sm text-muted-foreground text-center py-2'>
          Showing {filteredEmployees.length} employee
          {filteredEmployees.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

      {/* Employee Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={handleCloseViewDialog}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <User className='w-5 h-5' />
              Employee Details - {selectedEmployee?.fullName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (
            <div className='space-y-6'>
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Full Name</Label>
                    <p className='font-medium'>{selectedEmployee.fullName}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Employee ID</Label>
                    <p className='font-mono'>{selectedEmployee.employeeId}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Email</Label>
                    <p>{selectedEmployee.email}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Phone</Label>
                    <p>{selectedEmployee.phone}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Date of Birth</Label>
                    <p>{format(new Date(selectedEmployee.dateOfBirth), 'dd-MM-yyyy')}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Gender</Label>
                    <p className='capitalize'>{selectedEmployee.gender}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Marital Status</Label>
                    <p className='capitalize'>{selectedEmployee.maritalStatus}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Nationality</Label>
                    <p>{selectedEmployee.nationality}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Employment Information</CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Factory Location</Label>
                    <p>{selectedEmployee.unitLocation ? `${selectedEmployee.unit}-${selectedEmployee.unitLocation}` : selectedEmployee.unit}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Department</Label>
                    <p>{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Position</Label>
                    <p>{selectedEmployee.position}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Reporting Manager</Label>
                    <p>{selectedEmployee.reportingManager}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Joining Date</Label>
                    <p>{format(new Date(selectedEmployee.joiningDate), 'dd-MM-yyyy')}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Contract Type</Label>
                    <Badge className={contractTypeConfig[selectedEmployee.contractType].color}>
                      {contractTypeConfig[selectedEmployee.contractType].label}
                    </Badge>
                  </div>
                  {selectedEmployee.salary && (
                    <div>
                      <Label className='text-sm font-medium text-muted-foreground'>Salary</Label>
                      <p>${selectedEmployee.salary}</p>
                    </div>
                  )}
                  {selectedEmployee.workingHours && (
                    <div>
                      <Label className='text-sm font-medium text-muted-foreground'>Working Hours</Label>
                      <p>{selectedEmployee.workingHours}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Address Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Address Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='space-y-2'>
                    <p>{selectedEmployee.address}</p>
                    <p>{selectedEmployee.city}, {selectedEmployee.state} {selectedEmployee.postalCode}</p>
                    <p>{selectedEmployee.country}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>Emergency Contact</CardTitle>
                </CardHeader>
                <CardContent className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Name</Label>
                    <p>{selectedEmployee.emergencyContactName}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Phone</Label>
                    <p>{selectedEmployee.emergencyContactPhone}</p>
                  </div>
                  <div>
                    <Label className='text-sm font-medium text-muted-foreground'>Relationship</Label>
                    <p>{selectedEmployee.emergencyContactRelation}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Information */}
              {(selectedEmployee.skills || selectedEmployee.experience || selectedEmployee.education || selectedEmployee.notes) && (
                <Card>
                  <CardHeader>
                    <CardTitle className='text-base'>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {selectedEmployee.skills && (
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Skills</Label>
                        <p>{selectedEmployee.skills}</p>
                      </div>
                    )}
                    {selectedEmployee.experience && (
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Experience</Label>
                        <p>{selectedEmployee.experience}</p>
                      </div>
                    )}
                    {selectedEmployee.education && (
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Education</Label>
                        <p>{selectedEmployee.education}</p>
                      </div>
                    )}
                    {selectedEmployee.notes && (
                      <div>
                        <Label className='text-sm font-medium text-muted-foreground'>Notes</Label>
                        <p>{selectedEmployee.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Leave History Dialog */}
      <Dialog open={isLeaveDialogOpen} onOpenChange={handleCloseLeaveDialog}>
        <DialogContent className='max-w-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Calendar className='w-5 h-5' />
              {selectedEmployee ? `${selectedEmployee.fullName} - Leave History` : 'Leave History'}
            </DialogTitle>
          </DialogHeader>

          {isLoadingLeaveHistory ? (
            <div className='flex justify-center items-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
              <span className='ml-2'>Loading leave history...</span>
            </div>
          ) : leaveRecords.length > 0 ? (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Leaves Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRecords.map((record, index) => {
                    // Show year only for the first occurrence of each year
                    const prevRecord = index > 0 ? leaveRecords[index - 1] : null;
                    const showYear = !prevRecord || prevRecord.year !== record.year;
                    
                    return (
                      <TableRow key={`${record.year}-${record.month}-${index}`}>
                        <TableCell className='font-medium'>{showYear ? record.year : ''}</TableCell>
                        <TableCell className='capitalize'>{record.month}</TableCell>
                        <TableCell className='font-medium'>{record.leavesTaken}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className='py-6 text-center text-sm text-muted-foreground'>
              No leave records found for this employee.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Employee Onboard Form Dialog */}
      <EmployeeOnboardForm
        isOpen={isAddEmployeeDialogOpen}
        onClose={handleCloseAddEmployeeDialog}
        onSubmit={handleEmployeeSubmit}
        editingEmployee={editingEmployee}
      />
    </div>
  );
};
