import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  List,
  Table,
  Settings,
  MapPin,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  WifiOff,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  RefreshCcw,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent } from './ui/card';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { AddMachineForm } from './AddMachineForm';
import { UnifiedTabSearch } from './UnifiedTabSearch';
import { useRole } from '../contexts/RoleContext';
import type { Machine, PaginatedResponse } from '../lib/api/types';
import { MachineStatus } from '../lib/api/types';
import { machinesApi } from '../lib/api/machines';
import { branchesApi } from '../lib/api/branches';
import type { Branch } from '../lib/api/types.d.ts';
import { Alert, AlertDescription } from './ui/alert';
import { toast } from '../hooks/use-toast';

type SortField =
  | 'name'
  | 'type'
  | 'unit'
  | 'status'
  | 'lastService'
  | 'nextMaintenanceDue'
  | 'createdAt';
type SortOrder = 'ASC' | 'DESC';

export const MachinesTab = () => {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] =
    useState<TransformedMachine | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [machinesData, setMachinesData] =
    useState<PaginatedResponse<Machine> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [error, setError] = useState<string | null>(null);

  // Available branches (units) for company owner - fetched from API
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  // Define interface for transformed machine data
  interface TransformedMachine {
    id: number;
    name: string;
    type: string;
    status: string;
    createdDate: string;
    lastMaintenance: string;
    nextMaintenanceDue: string;
    specifications: string;
    unit: string;
    unitName: string;
    branch: string;
    branchName: string;
    branchLocation?: string;
    // Manufacturing Details
    manufacturer: string;
    model: string;
    serialNumber: string;
    capacity: string;
    purchaseDate: string;
    warrantyExpiry: string;
    installationDate: string;
    additionalNotes: string;
  }

  // Helper function to format date to dd-mm-yyyy
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Transformed machines data for UI - initialize with empty array to avoid showing dummy data
  const [machines, setMachines] = useState<TransformedMachine[]>([]);
  const [sortedMachines, setSortedMachines] = useState<TransformedMachine[]>(
    []
  );

  // Frontend sorting function for machines
  const sortMachinesData = (
    machines: TransformedMachine[],
    field: SortField,
    order: SortOrder
  ): TransformedMachine[] => {
    return [...machines].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'type':
          aValue = a.type?.toLowerCase() || '';
          bValue = b.type?.toLowerCase() || '';
          break;
        case 'unit':
          aValue = a.unitName?.toLowerCase() || '';
          bValue = b.unitName?.toLowerCase() || '';
          break;
        case 'status':
          // Sort by status priority: Active > Under Maintenance > Inactive
          const statusPriority = {
            [MachineStatus.ACTIVE]: 0,
            [MachineStatus.UNDER_MAINTENANCE]: 1,
            [MachineStatus.INACTIVE]: 2,
          };
          aValue = statusPriority[a.status as MachineStatus] ?? 3;
          bValue = statusPriority[b.status as MachineStatus] ?? 3;
          break;
        case 'lastService':
          // Sort by date, handle '-' as oldest
          aValue =
            a.lastMaintenance === '-'
              ? 0
              : new Date(
                  a.lastMaintenance.split('-').reverse().join('-')
                ).getTime();
          bValue =
            b.lastMaintenance === '-'
              ? 0
              : new Date(
                  b.lastMaintenance.split('-').reverse().join('-')
                ).getTime();
          break;
        case 'nextMaintenanceDue':
          // Sort by date, handle '-' as oldest
          aValue =
            a.nextMaintenanceDue === '-'
              ? 0
              : new Date(
                  a.nextMaintenanceDue.split('-').reverse().join('-')
                ).getTime();
          bValue =
            b.nextMaintenanceDue === '-'
              ? 0
              : new Date(
                  b.nextMaintenanceDue.split('-').reverse().join('-')
                ).getTime();
          break;
        case 'createdAt':
          aValue = new Date(
            a.createdDate.split('-').reverse().join('-')
          ).getTime();
          bValue = new Date(
            b.createdDate.split('-').reverse().join('-')
          ).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return order === 'ASC' ? -1 : 1;
      if (aValue > bValue) return order === 'ASC' ? 1 : -1;
      return 0;
    });
  };

  // Handle column sorting - all fields use frontend sorting now
  const handleSort = (field: SortField) => {
    let newSortOrder = sortOrder;

    if (sortField === field) {
      // Toggle sort order if same field
      newSortOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      // Set new field with ascending order
      newSortOrder = 'ASC';
    }

    setSortField(field);
    setSortOrder(newSortOrder);

    // Apply frontend sorting immediately
    console.log('Frontend sorting by:', field, 'Order:', newSortOrder);
    const sorted = sortMachinesData(machines, field, newSortOrder);
    setSortedMachines(sorted);
  };

  // Get sort icon for column header
  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className='w-4 h-4 text-muted-foreground' />;
    }
    return sortOrder === 'ASC' ? (
      <ArrowUp className='w-4 h-4 text-primary' />
    ) : (
      <ArrowDown className='w-4 h-4 text-primary' />
    );
  };

  // Fetch branches for company owner
  useEffect(() => {
    const fetchBranches = async () => {
      if (currentUser?.role !== 'company_owner') return;
      setIsLoadingBranches(true);
      try {
        const response = await branchesApi.getAll({ limit: 100 });
        setAvailableBranches(response.data);
      } catch (error: any) {
        console.error('Error fetching branches:', error);

        // Enhanced error handling
        let errorMessage = 'Failed to load branches. Please try again.';

        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;

          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 403) {
            errorMessage = 'You do not have permission to access branches.';
          } else if (status === 404) {
            errorMessage = 'Branches endpoint not found.';
          } else if (status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (data?.message) {
            errorMessage = data.message;
          }
        } else if (error.request) {
          errorMessage = 'Please Try Again';
        } else {
          errorMessage = error.message || 'An unexpected error occurred.';
        }

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [currentUser?.role]);

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

  // Fetch machines from API
  const fetchMachines = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: itemsPerPage,
        // For company owner: apply selected unit filter
        ...(filterUnit !== 'all' &&
          currentUser?.role === 'company_owner' && {
            branchId: filterUnit,
          }),
        // For supervisor/inventory_manager (branch-level users): automatically filter by their branch
        ...((currentUser?.role === 'supervisor' ||
          currentUser?.role === 'inventory_manager' ||
          currentUser?.userType?.isBranchLevel) &&
          currentUser?.branch?.id && {
            branchId: currentUser.branch.id.toString(),
          }),
      };

      // Debug logging for supervisor filtering
      console.log('MachinesTab fetchMachines - Debug Info:', {
        currentUserRole: currentUser?.role,
        currentUserBranch: currentUser?.branch,
        branchId: currentUser?.branch?.id,
        params: params,
        isSupervisor: currentUser?.role === 'supervisor',
        hasBranchId: currentUser?.branch?.id ? true : false,
        fullCurrentUser: currentUser,
        supervisorCondition:
          (currentUser?.role === 'supervisor' ||
            currentUser?.role === 'inventory_manager' ||
            currentUser?.userType?.isBranchLevel) &&
          currentUser?.branch?.id,
        userType: currentUser?.userType,
        localStorageUser: localStorage.getItem('user'),
      });

      // Additional debug for API URL construction
      console.log('MachinesTab API URL Debug:', {
        baseUrl: '/inventory/machines',
        queryParams: Object.keys(params)
          .map((key) => `${key}=${params[key]}`)
          .join('&'),
        fullParams: params,
      });

      const response = await machinesApi.getAll(params);

      // Debug logging for API response
      console.log('MachinesTab API Response:', {
        totalMachines: response.data.length,
        machines: response.data.map((m) => ({
          id: m.id,
          name: m.name,
          branch: m.branch,
          branchId: m.branchId,
        })),
      });

      setMachinesData(response);

      // Transform API data to match component data structure
      const transformedMachines = response.data.map((machine) => {
        return {
          id: machine.id,
          name: machine.name,
          type: machine.type?.name || 'Unknown Type',
          status: machine.status,
          createdDate: formatDate(machine.createdAt),
          lastMaintenance: machine.lastService
            ? formatDate(machine.lastService)
            : '-',
          nextMaintenanceDue: machine.nextMaintenanceDue
            ? formatDate(machine.nextMaintenanceDue)
            : '-',
          specifications:
            machine.specifications || 'No specifications available',
          unit: `unit-${machine.unit?.id || 1}`,
          unitName: machine.unit?.name || 'Unknown Unit',
          branch: machine.branch?.name || 'Unknown Location',
          branchName: machine.branch?.name || 'Unknown Location',
          branchLocation: machine.branch?.location || '',
          // Manufacturing Details
          manufacturer: machine.manufacturer || '',
          model: machine.model || '',
          serialNumber: machine.serialNumber || '',
          capacity: machine.capacity || '',
          purchaseDate: machine.purchaseDate
            ? formatDate(machine.purchaseDate)
            : '',
          warrantyExpiry: machine.warrantyExpiry
            ? formatDate(machine.warrantyExpiry)
            : '',
          installationDate: machine.installationDate
            ? formatDate(machine.installationDate)
            : '',
          additionalNotes: machine.additionalNotes || '',
        };
      });

      setMachines(transformedMachines);

      // Apply current sorting to the transformed machines
      const sorted = sortMachinesData(
        transformedMachines,
        sortField,
        sortOrder
      );
      setSortedMachines(sorted);
    } catch (error: any) {
      console.error('Error fetching machines:', error);

      // Enhanced error handling
      let errorMessage = 'Failed to load machines. Please try again.';

      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const data = error.response.data;

        console.error('API Error Response:', {
          status,
          data,
          url: error.config?.url,
          method: error.config?.method,
        });

        if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to access machines.';
        } else if (status === 404) {
          errorMessage = 'Machines endpoint not found.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data?.message) {
          errorMessage = data.message;
        } else {
          errorMessage = `Request failed with status ${status}`;
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('Network Error:', error.request);
        errorMessage = 'Please Try Again';
      } else {
        // Something else happened
        console.error('Unexpected Error:', error.message);
        errorMessage = error.message || 'An unexpected error occurred.';
      }

      setError(errorMessage);
      setMachines([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchMachines();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Load machines on component mount and when filters change
  useEffect(() => {
    fetchMachines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUnit]);

  // Handle pagination changes
  useEffect(() => {
    fetchMachines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterUnit, filterStatus]);

  // Apply frontend sorting when machines change
  useEffect(() => {
    console.log(
      'Applying frontend sort on machines change:',
      sortField,
      sortOrder
    );
    const sorted = sortMachinesData(machines, sortField, sortOrder);
    setSortedMachines(sorted);
  }, [machines, sortField, sortOrder]);

  // Update the handleAddMachine function to be async and add refresh to other operations
  const handleAddMachine = async (machineData: Machine) => {
    // After successfully adding/updating a machine, refresh the data
    await fetchMachines();
    setIsEditMode(false); // Reset edit mode
  };

  // Add function to handle machine updates
  const handleUpdateMachine = async (machineData: Machine) => {
    // After successfully updating a machine, refresh the data
    await fetchMachines();
    setIsEditMode(false);
  };

  // Add function to handle machine deletion (if needed)
  const handleDeleteMachine = async (machineId: number) => {
    try {
      await machinesApi.delete(machineId);
      await fetchMachines(); // Refresh the data
      toast({
        title: 'Success',
        description: 'Machine deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting machine:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete machine. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Add function to handle edit
  const handleEditMachine = (machine: TransformedMachine) => {
    setSelectedMachine(machine);
    setIsEditMode(true);
    setIsAddMachineOpen(true);
  };

  // Apply frontend filtering (status + search + supervisor branch) to sorted machines
  const displayMachines = sortedMachines.filter((machine) => {
    // Supervisor/Inventory Manager branch filtering - FRONTEND FALLBACK
    if (
      (currentUser?.role === 'supervisor' ||
        currentUser?.role === 'inventory_manager' ||
        currentUser?.userType?.isBranchLevel) &&
      currentUser?.branch?.id
    ) {
      // Get the actual machine data from the original API response
      const originalMachine = machinesData?.data?.find(
        (m) => m.id === machine.id
      );
      if (
        originalMachine &&
        originalMachine.branch?.id !== currentUser.branch.id
      ) {
        console.log(
          'Frontend filtering: Hiding machine from different branch',
          {
            machineId: machine.id,
            machineBranchId: originalMachine.branch?.id,
            supervisorBranchId: currentUser.branch.id,
            machine: originalMachine,
          }
        );
        return false;
      }
    }

    // Status filtering
    if (filterStatus !== 'all' && machine.status !== filterStatus) {
      return false;
    }

    // Search filtering - search across ALL columns
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      return (
        // Basic machine info
        machine.id?.toString().includes(searchLower) ||
        machine.name?.toLowerCase().includes(searchLower) ||
        machine.type?.toLowerCase().includes(searchLower) ||
        machine.status?.toLowerCase().includes(searchLower) ||
        // Unit and branch info
        machine.unit?.toLowerCase().includes(searchLower) ||
        machine.unitName?.toLowerCase().includes(searchLower) ||
        machine.branch?.toLowerCase().includes(searchLower) ||
        machine.branchName?.toLowerCase().includes(searchLower) ||
        machine.branchLocation?.toLowerCase().includes(searchLower) ||
        // Technical details
        machine.specifications?.toLowerCase().includes(searchLower) ||
        machine.manufacturer?.toLowerCase().includes(searchLower) ||
        machine.model?.toLowerCase().includes(searchLower) ||
        machine.serialNumber?.toLowerCase().includes(searchLower) ||
        machine.capacity?.toLowerCase().includes(searchLower) ||
        // Dates
        machine.createdDate?.toLowerCase().includes(searchLower) ||
        machine.lastMaintenance?.toLowerCase().includes(searchLower) ||
        machine.nextMaintenanceDue?.toLowerCase().includes(searchLower) ||
        machine.purchaseDate?.toLowerCase().includes(searchLower) ||
        machine.warrantyExpiry?.toLowerCase().includes(searchLower) ||
        machine.installationDate?.toLowerCase().includes(searchLower) ||
        // Additional info
        machine.additionalNotes?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      [MachineStatus.ACTIVE]:
        'badge-status bg-success/10 text-success ring-1 ring-success/20',
      [MachineStatus.UNDER_MAINTENANCE]:
        'badge-status bg-warning/10 text-warning ring-1 ring-warning/20',
      [MachineStatus.INACTIVE]:
        'badge-status bg-destructive/10 text-destructive ring-1 ring-destructive/20',
    };
    return (
      badges[status as keyof typeof badges] ||
      'badge-status bg-muted text-muted-foreground'
    );
  };

  // Handle machine name click - open edit form with pre-filled data
  const handleMachineClick = (machine: TransformedMachine) => {
    setSelectedMachine(machine);
    setIsEditMode(true);
    setIsAddMachineOpen(true);
  };

  // Handle export to CSV
  const handleExportToCSV = async () => {
    try {
      setIsExporting(true);

      // Fetch all machines with pagination (API limit is 100)
      let allMachines: Machine[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const limit = 100; // API limit

      while (hasMorePages) {
        const response = await machinesApi.getAll({
          page: currentPage,
          limit: limit,
          // No API search - we'll filter on frontend
          // For company owner: apply selected unit filter
          ...(filterUnit !== 'all' &&
            currentUser?.role === 'company_owner' && {
              branchId: filterUnit,
            }),
          // For supervisor/inventory_manager (branch-level users): automatically filter by their branch
          ...((currentUser?.role === 'supervisor' ||
            currentUser?.role === 'inventory_manager' ||
            currentUser?.userType?.isBranchLevel) &&
            currentUser?.branch?.id && {
              branchId: currentUser.branch.id.toString(),
            }),
        });

        allMachines = [...allMachines, ...response.data];

        // Check if there are more pages
        hasMorePages = response.meta?.hasNextPage || false;
        currentPage++;

        // Safety check to prevent infinite loops
        if (currentPage > 1000) {
          console.warn('Export stopped at page 1000 to prevent infinite loop');
          break;
        }
      }

      // Transform machines to UI format
      const allTransformedMachines = allMachines.map((machine) => {
        return {
          id: machine.id,
          name: machine.name,
          type: machine.type?.name || 'Unknown Type',
          status: machine.status,
          createdDate: formatDate(machine.createdAt),
          lastMaintenance: machine.lastService
            ? formatDate(machine.lastService)
            : '-',
          nextMaintenanceDue: machine.nextMaintenanceDue
            ? formatDate(machine.nextMaintenanceDue)
            : '-',
          specifications:
            machine.specifications || 'No specifications available',
          unit: `unit-${machine.unit?.id || 1}`,
          unitName: machine.unit?.name || 'Unknown Unit',
          branch: machine.branch?.name || 'Unknown Location',
          branchName: machine.branch?.name || 'Unknown Location',
          branchLocation: machine.branch?.location || '',
          // Manufacturing Details
          manufacturer: machine.manufacturer || '',
          model: machine.model || '',
          serialNumber: machine.serialNumber || '',
          capacity: machine.capacity || '',
          purchaseDate: machine.purchaseDate
            ? formatDate(machine.purchaseDate)
            : '',
          warrantyExpiry: machine.warrantyExpiry
            ? formatDate(machine.warrantyExpiry)
            : '',
          installationDate: machine.installationDate
            ? formatDate(machine.installationDate)
            : '',
          additionalNotes: machine.additionalNotes || '',
        };
      });

      // Apply status filter to export data (frontend filtering) - no search filter
      const transformedMachines = allTransformedMachines.filter((machine) => {
        // Status filter only
        if (filterStatus !== 'all' && machine.status !== filterStatus) {
          return false;
        }
        return true;
      });

      // Prepare CSV headers
      const headers = [
        'Machine ID',
        'Machine Name',
        'Type',
        'Status',
        'Manufacturer',
        'Model',
        'Serial Number',
        'Capacity',
        'Unit',
        'Branch',
        'Location',
        'Purchase Date',
        'Installation Date',
        'Warranty Expiry',
        'Last Service',
        'Next Maintenance Due',
        'Specifications',
        'Additional Notes',
        'Created Date',
      ];

      // Prepare CSV data
      const csvData = transformedMachines.map((machine) => {
        return [
          machine.id.toString(),
          `"${machine.name}"`,
          `"${machine.type}"`,
          `"${machine.status}"`,
          `"${machine.manufacturer}"`,
          `"${machine.model}"`,
          `"${machine.serialNumber}"`,
          `"${machine.capacity}"`,
          `"${machine.unitName}"`,
          `"${machine.branch}"`,
          `"${machine.branchName}"`,
          `"${machine.purchaseDate}"`,
          `"${machine.installationDate}"`,
          `"${machine.warrantyExpiry}"`,
          `"${machine.lastMaintenance}"`,
          `"${machine.nextMaintenanceDue}"`,
          `"${machine.specifications}"`,
          `"${machine.additionalNotes}"`,
          `"${machine.createdDate}"`,
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map((row) => row.join(',')),
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `machines_export_${currentDate}.csv`;
      link.setAttribute('download', filename);

      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export Successful',
        description: `Machines data exported successfully. ${transformedMachines.length} records downloaded.`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error exporting machines:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export machines data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Network Status Alert */}
      {!isOnline && (
        <Alert className='border-red-200 bg-red-50 text-red-800'>
          <WifiOff className='h-4 w-4' />
          <AlertDescription>
            You are currently offline. Some features may not work properly.
            Please check your internet connection.
          </AlertDescription>
        </Alert>
      )}

      {/* Header with Actions */}
      <UnifiedTabSearch
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder='Search machines...'
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={true}
        filterUnit={filterUnit}
        onFilterUnitChange={setFilterUnit}
        availableBranches={availableBranches}
        isLoadingBranches={isLoadingBranches}
        statusFilter={filterStatus}
        onStatusFilterChange={setFilterStatus}
        showStatusFilter={true}
        statusOptions={[
          { value: 'all', label: 'All Status' },
          {
            value: MachineStatus.ACTIVE,
            label: 'Active',
            icon: <div className='w-2 h-2 bg-green-500 rounded-full' />,
          },
          {
            value: MachineStatus.UNDER_MAINTENANCE,
            label: 'Under Maintenance',
            icon: <div className='w-2 h-2 bg-yellow-500 rounded-full' />,
          },
          {
            value: MachineStatus.INACTIVE,
            label: 'Inactive',
            icon: <div className='w-2 h-2 bg-red-500 rounded-full' />,
          },
        ]}
        onExport={handleExportToCSV}
        isExporting={isExporting}
        showExport={true}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showRefresh={true}
        onAdd={() => setIsAddMachineOpen(true)}
        addLabel='Add New Machine'
        showAddButton={true}
        isOnline={isOnline}
      />

      {/* Error State - Only show when there's an API error and we're not loading */}
      {error && !isLoading && (
        <Card className='rounded-lg shadow-sm p-8 text-center'>
          <RefreshCcw className='w-12 h-12 text-red-500 mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-foreground mb-2'>
            No Data Found, Reload Data
          </h3>
          <p className='text-muted-foreground mb-4'>{error}</p>
          <Button variant='outline' onClick={() => fetchMachines()}>
            <RefreshCcw className='w-4 h-4 mr-2' />
            Reload
          </Button>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className='flex justify-center items-center p-12'>
          <Loader2 className='w-8 h-8 animate-spin text-primary' />
          <span className='ml-2 text-lg'>Loading machines...</span>
        </div>
      )}

      {/* Content - Only show when not loading and no error */}
      {!isLoading && !error && viewMode === 'list' && (
        <div className='space-y-3'>
          {displayMachines.map((machine) => (
            <div
              key={machine.id}
              className='card-friendly p-3 sm:p-4 hover:bg-secondary/30 transition-colors duration-200'
            >
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
                <div className='flex items-start gap-3 flex-1 min-w-0'>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0'>
                    <Settings className='w-4 h-4 sm:w-5 sm:h-5 text-primary' />
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-2'>
                      <button
                        onClick={() => handleMachineClick(machine)}
                        className='font-semibold text-black text-sm sm:text-base text-left hover:text-primary hover:underline cursor-pointer transition-colors duration-200'
                      >
                        {machine.name}
                      </button>
                      <span className='text-black font-semibold text-xs sm:text-sm'>
                        {machine.type}
                      </span>
                      <span
                        className={`${getStatusBadge(machine.status)} text-xs`}
                      >
                        {machine.status}
                      </span>
                    </div>
                    <div className='space-y-1 mb-2'>
                      <Badge
                        variant='outline'
                        className='text-xs bg-primary/10 text-black border-primary/30'
                      >
                        {machine.branchName}
                      </Badge>
                      {machine.branchLocation && (
                        <div className='flex items-center gap-2 text-xs text-black'>
                          <MapPin className='w-3 h-3 flex-shrink-0' />
                          <span className='truncate'>
                            {machine.branchLocation}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className='text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2'>
                      {machine.specifications}
                    </p>
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-6 text-xs sm:text-sm'>
                      <span className='text-muted-foreground'>
                        Added:{' '}
                        <span className='font-medium text-foreground'>
                          {machine.createdDate}
                        </span>
                      </span>
                      <span className='text-muted-foreground'>
                        Last Service:{' '}
                        <span className='font-medium text-foreground'>
                          {machine.lastMaintenance}
                        </span>
                      </span>
                      <span className='text-muted-foreground'>
                        Next Due:{' '}
                        <span className='font-medium text-foreground'>
                          {machine.nextMaintenanceDue}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table view - Only show when not loading and no error */}
      {!isLoading && !error && viewMode === 'table' && (
        <Card className='rounded-lg shadow-sm'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <TableComponent>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='min-w-[150px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('name')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Machine
                        {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[150px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('type')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Type
                        {getSortIcon('type')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('unit')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Unit / Location
                        {getSortIcon('unit')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[100px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('status')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Status
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('lastService')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Last Service
                        {getSortIcon('lastService')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[140px] text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('nextMaintenanceDue')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Next Maintenance Due
                        {getSortIcon('nextMaintenanceDue')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayMachines.map((machine) => (
                    <TableRow
                      key={machine.id}
                      className='hover:bg-muted/30 border-b border-secondary/20'
                    >
                      <TableCell className='font-semibold text-foreground'>
                        <button
                          onClick={() => handleMachineClick(machine)}
                          className='text-black hover:text-primary/80 hover:underline font-semibold cursor-pointer transition-colors duration-200'
                        >
                          {machine.name}
                        </button>
                      </TableCell>
                      <TableCell className='text-black font-semibold'>
                        {machine.type}
                      </TableCell>
                      <TableCell className='text-sm'>
                        <div className='space-y-1'>
                          <Badge
                            variant='outline'
                            className='text-xs bg-primary/10 text-black border-primary/30'
                          >
                            {machine.branchName}
                          </Badge>
                          {machine.branchLocation && (
                            <div className='text-xs text-black'>
                              {machine.branchLocation}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${getStatusBadge(
                            machine.status
                          )} text-xs`}
                        >
                          {machine.status}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {machine.lastMaintenance}
                      </TableCell>
                      <TableCell className='text-muted-foreground'>
                        {machine.nextMaintenanceDue}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </TableComponent>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - Only show when not loading, no error, and no machines */}
      {!isLoading && !error && displayMachines.length === 0 && (
        <Card className='rounded-lg shadow-sm p-8 text-center'>
          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
            <Settings className='w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground' />
          </div>
          <h3 className='text-base sm:text-lg font-semibold text-foreground mb-2'>
            No machines found
          </h3>
          <p className='text-sm sm:text-base text-muted-foreground mb-4'>
            {searchQuery.trim()
              ? `No machines found matching "${searchQuery}"`
              : 'Start by adding your first machine'}
          </p>
          <Button variant='outline' onClick={() => fetchMachines()}>
            <RefreshCcw className='w-4 h-4 mr-2' />
            Reload
          </Button>
        </Card>
      )}

      {/* Search Results Info - Show when searching and no error */}
      {searchQuery.trim() &&
        !isLoading &&
        !error &&
        displayMachines.length > 0 && (
          <div className='text-sm text-muted-foreground text-center py-2'>
            Showing {displayMachines.length} machine
            {displayMachines.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </div>
        )}

      {/* Pagination - Hide when searching or when there's an error */}
      {machinesData && machinesData.meta && !searchQuery.trim() && !error && (
        <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
          {/* Page Info */}
          <div className='text-xs sm:text-sm text-muted-foreground'>
            Showing {(machinesData.meta.page - 1) * machinesData.meta.limit + 1}{' '}
            to{' '}
            {Math.min(
              machinesData.meta.page * machinesData.meta.limit,
              machinesData.meta.itemCount
            )}{' '}
            of {machinesData.meta.itemCount} entries
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
                  fetchMachines();
                }}
              >
                <SelectTrigger className='w-16 sm:w-20 h-8 text-xs sm:text-sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10</SelectItem>
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
                onClick={() => {
                  setCurrentPage(1);
                  fetchMachines();
                }}
                disabled={
                  !machinesData.meta.hasPreviousPage ||
                  machinesData.meta.page === 1
                }
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>

              {/* Previous page button */}
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage((prev) => prev - 1);
                  fetchMachines();
                }}
                disabled={!machinesData.meta.hasPreviousPage}
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>

              {/* Page numbers - Show up to 6 pages */}
              <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                {Array.from(
                  { length: Math.min(6, machinesData.meta.pageCount) },
                  (_, i) => {
                    let pageNum;
                    
                    if (machinesData.meta.pageCount <= 6) {
                      pageNum = i + 1;
                    } else if (machinesData.meta.page <= 3) {
                      pageNum = i + 1;
                    } else if (
                      machinesData.meta.page >=
                      machinesData.meta.pageCount - 2
                    ) {
                      pageNum = machinesData.meta.pageCount - 5 + i;
                    } else {
                      pageNum = machinesData.meta.page - 3 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          machinesData.meta.page === pageNum
                            ? 'default'
                            : 'outline'
                        }
                        size='sm'
                        onClick={() => {
                          setCurrentPage(pageNum);
                          fetchMachines();
                        }}
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
                onClick={() => {
                  setCurrentPage((prev) => prev + 1);
                  fetchMachines();
                }}
                disabled={!machinesData.meta.hasNextPage}
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>

              {/* Last page button */}
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage(machinesData.meta.pageCount);
                  fetchMachines();
                }}
                disabled={
                  !machinesData.meta.hasNextPage ||
                  machinesData.meta.page === machinesData.meta.pageCount
                }
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronsRight className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Machine Form */}
      <AddMachineForm
        isOpen={isAddMachineOpen}
        onClose={() => {
          setIsAddMachineOpen(false);
          setIsEditMode(false);
          setSelectedMachine(null);
        }}
        onSubmit={isEditMode ? handleUpdateMachine : handleAddMachine}
        editingData={isEditMode ? selectedMachine : null}
      />
    </div>
  );
};
