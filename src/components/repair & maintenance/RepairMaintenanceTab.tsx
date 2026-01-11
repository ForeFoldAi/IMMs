/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  Plus,
  AlertTriangle,
  User,
  Calendar,
  Wrench,
  CheckSquare,
  List,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Search,
  Edit,
  Building2,
  Loader2,
  ChevronUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  RefreshCcw,
  Download,
  Upload,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../../contexts/RoleContext';
import { UnifiedTabSearch } from '../UnifiedTabSearch';
import {
  formatDateToDDMMYYYY,
} from '../../lib/utils';
import { branchesApi } from '../../lib/api/branches';
import {
  Branch,
  PaginationMeta,
} from '../../lib/api/types';
import { toast } from '../../hooks/use-toast';
import {
  repairMaintenanceApi,
  RepairMaintenance,
  RepairMaintenanceStatus,
  RepairMaintenanceType,
} from '../../lib/api/repair-maintenance.ts';

// Re-export for backward compatibility
export { RepairMaintenanceStatus, RepairMaintenanceType };
export type { RepairMaintenance };

export const RepairMaintenanceTab = () => {
  const { currentUser, hasPermission } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    const filterFromUrl = searchParams.get('filter');
    return filterFromUrl || 'all';
  });
  const [filterUnit, setFilterUnit] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Export functionality state
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);

  // Refresh functionality state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    from: '',
    to: '',
  });
  const [selectedExportPreset, setSelectedExportPreset] = useState<string>('all');

  // Sorting state
  const [sortBy, setSortBy] = useState<string>('id');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // API state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repairMaintenances, setRepairMaintenances] = useState<RepairMaintenance[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    itemCount: 0,
    pageCount: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  });

  // Available branches
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      setIsLoadingBranches(true);
      try {
        const response = await branchesApi.getAll({ limit: 100 });
        setAvailableBranches(response.data);
      } catch (error: any) {
        console.error('Error fetching branches:', error);
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

  // Fetch repair and maintenance records
  const fetchRepairMaintenances = useCallback(
    async (page = 1, limit = 10) => {
      setIsLoading(true);
      setError(null);

      try {
        const params: {
          page: number;
          limit: number;
          status?: string;
          branchId?: string;
          sortBy?: string;
          sortOrder?: 'ASC' | 'DESC';
        } = {
          page,
          limit,
        };

        if (filterStatus !== 'all') {
          params.status = filterStatus;
        }

        if (currentUser?.role === 'company_owner' && filterUnit !== 'all') {
          params.branchId = filterUnit;
        }

        if ((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id) {
          params.branchId = currentUser.branch.id.toString();
        }

        // Remove server-side sorting - all sorting is handled on frontend
        // params.sortBy = sortBy;
        // params.sortOrder = sortOrder;

        const response = await repairMaintenanceApi.getAll(params);

        setPagination(response.meta);
        setRepairMaintenances(response.data);
      } catch (error: any) {
        console.error('Error fetching repair and maintenance records:', error);
        
        let errorMessage = 'Failed to load repair and maintenance records. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const data = error.response.data;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 403) {
            errorMessage = 'You do not have permission to access repair and maintenance records.';
          } else if (status === 404) {
            errorMessage = 'Repair and maintenance endpoint not found.';
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
        
        setError(errorMessage);
        setRepairMaintenances([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filterStatus, filterUnit, currentUser?.role, currentUser?.branch?.id]
  );

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder(column === 'orderId' ? 'DESC' : 'ASC');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchRepairMaintenances(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get sort icon for column
  const getSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className='w-4 h-4 text-muted-foreground' />;
    }
    return sortOrder === 'ASC' ? (
      <ChevronUp className='w-4 h-4 text-primary' />
    ) : (
      <ChevronDown className='w-4 h-4 text-primary' />
    );
  };

  // Fetch repair and maintenance records when filters change (sorting is handled on frontend)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRepairMaintenances(pagination.page, pagination.limit);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [
    filterStatus,
    filterUnit,
    pagination.page,
    pagination.limit,
    fetchRepairMaintenances,
  ]);

  // Reset to first page when filters change (sorting is handled on frontend, no need to refetch)
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [filterStatus, filterUnit]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case RepairMaintenanceStatus.DRAFT:
        return 'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white';
      case RepairMaintenanceStatus.PENDING_APPROVAL:
        return 'bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-500 hover:text-white';
      case RepairMaintenanceStatus.APPROVED:
        return 'bg-green-500 text-white border-green-600 hover:bg-green-500 hover:text-white';
      case RepairMaintenanceStatus.IN_PROGRESS:
        return 'bg-blue-500 text-white border-blue-600 hover:bg-blue-500 hover:text-white';
      case RepairMaintenanceStatus.COMPLETED:
        return 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500 hover:text-emerald-600';
      case RepairMaintenanceStatus.REJECTED:
        return 'bg-red-500 text-white border-red-600 hover:bg-red-500 hover:text-white';
      case RepairMaintenanceStatus.CANCELLED:
        return 'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white';
      default:
        return 'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case RepairMaintenanceStatus.DRAFT:
        return <FileText className='w-4 h-4' />;
      case RepairMaintenanceStatus.PENDING_APPROVAL:
        return <Clock className='w-4 h-4' />;
      case RepairMaintenanceStatus.APPROVED:
        return <CheckCircle className='w-4 h-4' />;
      case RepairMaintenanceStatus.IN_PROGRESS:
        return <Wrench className='w-4 h-4' />;
      case RepairMaintenanceStatus.COMPLETED:
        return <CheckSquare className='w-4 h-4' />;
      case RepairMaintenanceStatus.REJECTED:
        return <XCircle className='w-4 h-4' />;
      case RepairMaintenanceStatus.CANCELLED:
        return <XCircle className='w-4 h-4' />;
      default:
        return <AlertTriangle className='w-4 h-4' />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case RepairMaintenanceStatus.DRAFT:
        return 'Draft';
      case RepairMaintenanceStatus.PENDING_APPROVAL:
        return 'Pending Approval';
      case RepairMaintenanceStatus.APPROVED:
        return 'Approved';
      case RepairMaintenanceStatus.IN_PROGRESS:
        return 'In Progress';
      case RepairMaintenanceStatus.COMPLETED:
        return 'Completed';
      case RepairMaintenanceStatus.REJECTED:
        return 'Rejected';
      case RepairMaintenanceStatus.CANCELLED:
        return 'Cancelled';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case RepairMaintenanceType.REPAIR:
        return 'Repair';
      case RepairMaintenanceType.MAINTENANCE:
        return 'Maintenance';
      case RepairMaintenanceType.PREVENTIVE_MAINTENANCE:
        return 'Preventive Maintenance';
      case RepairMaintenanceType.EMERGENCY_REPAIR:
        return 'Emergency Repair';
      default:
        return type;
    }
  };

  const toggleRowExpansion = (requestId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(requestId)) {
      newExpandedRows.delete(requestId);
    } else {
      newExpandedRows.add(requestId);
    }
    setExpandedRows(newExpandedRows);
  };

  // Client-side filtering for search only - searches all columns
  const filterRepairMaintenances = (records: RepairMaintenance[]) => {
    if (!searchTerm || !searchTerm.trim()) return records;

    const searchLower = searchTerm.toLowerCase().trim();

    return records.filter((record) => {
      // Search in top-level fields
      const matchesTopLevel = 
        record.uniqueId?.toLowerCase().includes(searchLower) ||
        record.nameOfWork?.toLowerCase().includes(searchLower) ||
        (record.typeOfWork && getTypeLabel(record.typeOfWork)?.toLowerCase().includes(searchLower)) ||
        record.totalAmount?.toString().includes(searchLower) ||
        getStatusLabel(record.status)?.toLowerCase().includes(searchLower) ||
        record.approvedBy?.name?.toLowerCase().includes(searchLower) ||
        (record.completedDate && formatDateToDDMMYYYY(record.completedDate)?.toLowerCase().includes(searchLower)) ||
        (record.requestedDate && formatDateToDDMMYYYY(record.requestedDate)?.toLowerCase().includes(searchLower)) ||
        (record.date && formatDateToDDMMYYYY(record.date)?.toLowerCase().includes(searchLower)) ||
        record.requestedBy?.name?.toLowerCase().includes(searchLower) ||
        record.branch?.name?.toLowerCase().includes(searchLower) ||
        record.branch?.location?.toLowerCase().includes(searchLower) ||
        record.description?.toLowerCase().includes(searchLower) ||
        record.machineName?.toLowerCase().includes(searchLower) ||
        record.location?.toLowerCase().includes(searchLower);

      // Search in all items (not just first item)
      const matchesItems = record.items && record.items.some((item) => {
        return (
          item.nameOfWork?.toLowerCase().includes(searchLower) ||
          (item.typeOfWork && getTypeLabel(item.typeOfWork)?.toLowerCase().includes(searchLower)) ||
          item.machineName?.toLowerCase().includes(searchLower) ||
          item.machine?.name?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.totalAmount?.toString().includes(searchLower) ||
          // Search in vendor quotations
          (item.vendorQuotations && item.vendorQuotations.some((quotation) => 
            quotation.vendorName?.toLowerCase().includes(searchLower) ||
            quotation.contactPerson?.toLowerCase().includes(searchLower) ||
            quotation.phone?.toLowerCase().includes(searchLower) ||
            quotation.quotedPrice?.toString().includes(searchLower) ||
            quotation.notes?.toLowerCase().includes(searchLower)
          ))
        );
      });

      return matchesTopLevel || matchesItems;
    });
  };

  // Sort data client-side
  const sortData = (data: any[]) => {
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'orderId':
          aValue = a.orderId || '';
          bValue = b.orderId || '';
          break;
        case 'nameOfWork':
          aValue = a.nameOfWork?.toLowerCase() || '';
          bValue = b.nameOfWork?.toLowerCase() || '';
          break;
        case 'typeOfWork':
          // typeOfWork is already a label string from transformToUiFormat
          aValue = (a.typeOfWork || '').toLowerCase();
          bValue = (b.typeOfWork || '').toLowerCase();
          break;
        case 'totalAmount':
          aValue = a.totalAmountRaw || 0;
          bValue = b.totalAmountRaw || 0;
          break;
        case 'status':
          // Use statusLabel which is already formatted, or fallback to status
          aValue = (a.statusLabel || a.status || '').toLowerCase();
          bValue = (b.statusLabel || b.status || '').toLowerCase();
          break;
        case 'approvedBy':
          aValue = a.approvedBy?.toLowerCase() || '';
          bValue = b.approvedBy?.toLowerCase() || '';
          break;
        case 'completedOn':
          const parseCompletedDate = (dateStr: string): number => {
            if (!dateStr || !dateStr.trim() || dateStr === '-') {
              return Number.MAX_SAFE_INTEGER;
            }
            if (dateStr.includes('-')) {
              const dateParts = dateStr.split('-');
              if (dateParts.length === 3 && dateParts[0].length === 2) {
                const [day, month, year] = dateParts;
                const parsed = new Date(`${year}-${month}-${day}`).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              }
            }
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
          };
          aValue = parseCompletedDate(a.completedOn || '');
          bValue = parseCompletedDate(b.completedOn || '');
          break;
        case 'machineName':
          aValue = a.machineName?.toLowerCase() || '';
          bValue = b.machineName?.toLowerCase() || '';
          break;
        case 'requestedDate':
          const parseDate = (dateStr: string): number => {
            if (!dateStr || !dateStr.trim()) {
              return Number.MAX_SAFE_INTEGER;
            }
            if (dateStr.includes('-')) {
              const dateParts = dateStr.split('-');
              if (dateParts.length === 3 && dateParts[0].length === 2) {
                const [day, month, year] = dateParts;
                const parsed = new Date(`${year}-${month}-${day}`).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              }
            }
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
          };
          aValue = parseDate(a.requestedDate || '');
          bValue = parseDate(b.requestedDate || '');
          break;
        default:
          aValue = a[sortBy];
          bValue = b[sortBy];
      }

      if (aValue === null || aValue === undefined || aValue === '') aValue = '';
      if (bValue === null || bValue === undefined || bValue === '') bValue = '';

      if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });
  };

  // Transform API data to UI format
  const transformToUiFormat = (record: RepairMaintenance) => {
    // Get first item for fallback values
    const firstItem = record.items && record.items.length > 0 ? record.items[0] : null;
    
    // Calculate total amount from items if not directly available
    let totalAmount = record.totalAmount;
    if (!totalAmount && record.items && record.items.length > 0) {
      totalAmount = record.items.reduce((sum, item) => {
        // Try to get amount from item's totalAmount
        let itemAmount = 0;
        if (item.totalAmount) {
          itemAmount = typeof item.totalAmount === 'number' 
            ? item.totalAmount 
            : (typeof item.totalAmount === 'string' ? parseFloat(item.totalAmount) : 0);
        } else if (item.vendorQuotations && item.vendorQuotations.length > 0) {
          // Calculate from selected vendor quotation or first quotation
          const selectedQuotation = item.vendorQuotations.find(q => q.isSelected === true) || item.vendorQuotations[0];
          if (selectedQuotation) {
            const quotedPrice = typeof selectedQuotation.quotedPrice === 'string' 
              ? parseFloat(selectedQuotation.quotedPrice) 
              : (selectedQuotation.quotedPrice || 0);
            itemAmount = quotedPrice;
          }
        }
        return sum + itemAmount;
      }, 0);
    }
    
    // Get first item's nameOfWork if order doesn't have it directly
    const nameOfWork = record.nameOfWork || firstItem?.nameOfWork || 'N/A';
    
    // Get first item's typeOfWork if order doesn't have it directly
    const typeOfWork = record.typeOfWork || firstItem?.typeOfWork || RepairMaintenanceType.REPAIR;
    
    // Get first item's machine name if order doesn't have it directly
    const machineName = record.machineName || 
      firstItem?.machineName || 
      firstItem?.machine?.name || 
      'N/A';
    
    // Get first item's description if order doesn't have it directly
    const description = record.description || firstItem?.description || '';

    // Handle date field - API uses 'date' but we also support 'requestedDate' for compatibility
    const requestedDate = record.requestedDate || record.date || '';
    
    // Handle approvedDate - API uses 'approvalDate' but we also support 'approvedDate' for compatibility
    const approvedDate = record.approvedDate || record.approvalDate;

    // Handle completedDate - show date when status was updated to completed
    // Use completedDate if available, otherwise if status is completed, use updatedAt as fallback
    let completedOn = '-';
    if (record.status === RepairMaintenanceStatus.COMPLETED) {
      if (record.completedDate) {
        completedOn = formatDateToDDMMYYYY(record.completedDate);
      } else if (record.updatedAt) {
        // Fallback to updatedAt if completedDate is not available
        completedOn = formatDateToDDMMYYYY(record.updatedAt);
      }
    } else if (record.completedDate) {
      // Show completedDate even if status is not currently completed (for historical records)
      completedOn = formatDateToDDMMYYYY(record.completedDate);
    }

    return {
      id: record.id,
      orderId: record.uniqueId,
      nameOfWork: nameOfWork,
      typeOfWork: getTypeLabel(typeOfWork),
      totalAmount: totalAmount && totalAmount > 0 ? `₹${totalAmount.toLocaleString('en-IN')}` : '₹0',
      totalAmountRaw: totalAmount || 0,
      status: record.status,
      statusLabel: getStatusLabel(record.status),
      approvedBy: record.approvedBy?.name || '-',
      completedOn: completedOn,
      requestedBy: record.requestedBy?.name || 'Unknown',
      requestedDate: requestedDate ? formatDateToDDMMYYYY(requestedDate) : '-',
      approvedDate: approvedDate ? formatDateToDDMMYYYY(approvedDate) : '-',
      branch: record.branch?.name || 'Unknown',
      branchLocation: record.branch?.location || '',
      description: description,
      machineName: machineName,
      originalRecord: record,
    };
  };

  // Get filtered and transformed records for UI - memoized to recompute when dependencies change
  const filteredRecords = useMemo(() => {
    const searchFilteredData = filterRepairMaintenances(repairMaintenances);
    const transformedData = searchFilteredData.map(transformToUiFormat);
    return sortData(transformedData);
  }, [repairMaintenances, searchTerm, sortBy, sortOrder]);
  
  // Debug: Log records for testing
  useEffect(() => {
    console.log('Repair Maintenances:', repairMaintenances.length, 'records');
    console.log('Filtered Records:', filteredRecords.length, 'records');
    if (filteredRecords.length > 0) {
      console.log('First record:', filteredRecords[0]);
    }
  }, [repairMaintenances, filteredRecords]);

  // Handle export to CSV
  const handleExportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Filter by date range if specified
      let filteredData = repairMaintenances;
      if (exportDateRange.from || exportDateRange.to) {
        filteredData = repairMaintenances.filter((record) => {
          const requestDate = new Date(record.requestedDate);
          
          if (exportDateRange.from && exportDateRange.to) {
            const fromDate = new Date(exportDateRange.from);
            const toDate = new Date(exportDateRange.to);
            return requestDate >= fromDate && requestDate <= toDate;
          } else if (exportDateRange.from) {
            const fromDate = new Date(exportDateRange.from);
            return requestDate >= fromDate;
          } else if (exportDateRange.to) {
            const toDate = new Date(exportDateRange.to);
            return requestDate <= toDate;
          }
          
          return true;
        });
      }

      const transformedData = filteredData.map(transformToUiFormat);
      
      const headers = [
        'Order ID',
        'Requested Date',
        'Machine',
        'Name of the Work',
        'Type of the Work',
        'Total Amount (₹)',
        'Status',
        'Approved By',
        'Completed On',
        'Requested By',
        'Branch',
        'Description',
      ];

      const csvData: string[][] = transformedData.map((record) => [
        `"${record.orderId}"`,
        `"${record.requestedDate}"`,
        `"${record.machineName}"`,
        `"${record.nameOfWork}"`,
        `"${record.typeOfWork}"`,
        `"${record.totalAmount}"`,
        `"${record.statusLabel}"`,
        `"${record.approvedBy}"`,
        `"${record.completedOn}"`,
        `"${record.requestedBy}"`,
        `"${record.branch}"`,
        `"${record.description}"`,
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const currentDate = new Date().toISOString().split('T')[0];
      let filename = `repair_maintenance_export_${currentDate}`;
      
      if (exportDateRange.from || exportDateRange.to) {
        if (exportDateRange.from && exportDateRange.to) {
          filename += `_${exportDateRange.from}_to_${exportDateRange.to}`;
        } else if (exportDateRange.from) {
          filename += `_from_${exportDateRange.from}`;
        } else if (exportDateRange.to) {
          filename += `_to_${exportDateRange.to}`;
        }
      } else {
        filename += '_all_data';
      }
      
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExportDialogOpen(false);
      setExportDateRange({ from: '', to: '' });
      setSelectedExportPreset('all');

      toast({
        title: 'Export Successful',
        description: `Repair and maintenance data exported successfully. ${csvData.length} records downloaded.`,
        variant: 'default',
      });

    } catch (error) {
      console.error('Error exporting repair and maintenance records:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export repair and maintenance data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Reset export date range
  const resetExportDateRange = () => {
    setExportDateRange({
      from: '',
      to: '',
    });
    setSelectedExportPreset('all');
  };

  // Add pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchRepairMaintenances(newPage, pagination.limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
    fetchRepairMaintenances(1, newLimit);
  };

  // Enhanced List View Component
  const ListView = ({ records }: { records: any[] }) => (
    <Card className='rounded-lg shadow-sm'>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                <TableHead className='w-12 text-foreground font-semibold'></TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('orderId')}
                >
                  <div className='flex items-center gap-2'>
                    Order ID
                    {getSortIcon('orderId')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('requestedDate')}
                >
                  <div className='flex items-center gap-2'>
                    Requested Date
                    {getSortIcon('requestedDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('machineName')}
                >
                  <div className='flex items-center gap-2'>
                    Machine
                    {getSortIcon('machineName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[150px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('nameOfWork')}
                >
                  <div className='flex items-center gap-2'>
                    Name of the Work
                    {getSortIcon('nameOfWork')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('typeOfWork')}
                >
                  <div className='flex items-center gap-2'>
                    Type of the Work
                    {getSortIcon('typeOfWork')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('totalAmount')}
                >
                  <div className='flex items-center gap-2'>
                    Total Amount
                    {getSortIcon('totalAmount')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('status')}
                >
                  <div className='flex items-center gap-2'>
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('approvedBy')}
                >
                  <div className='flex items-center gap-2'>
                    Approved By
                    {getSortIcon('approvedBy')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('completedOn')}
                >
                  <div className='flex items-center gap-2'>
                    Completed Date
                    {getSortIcon('completedOn')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length > 0 ? (
                records.map((record) => (
                  <TableRow
                    key={record.id}
                    className='hover:bg-muted/30 border-b border-secondary/20'
                  >
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0 rounded-lg'
                        onClick={() => toggleRowExpansion(record.id.toString())}
                      >
                        {expandedRows.has(record.id.toString()) ? (
                          <ChevronDown className='w-4 h-4' />
                        ) : (
                          <ChevronRight className='w-4 h-4' />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className='font-medium'>
                      <Button
                        type='button'
                        variant='link'
                        className='p-0 h-auto font-medium hover:underline text-black cursor-pointer'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Order ID clicked:', record.orderId, record);
                          
                          // Use originalRecord from transformed data, or find it from the array
                          const originalRecord = record.originalRecord || 
                            repairMaintenances.find((r) => r.id === record.id);
                          
                          console.log('Original record found:', originalRecord);
                          
                          if (originalRecord) {
                            console.log('Navigating to view form with data:', originalRecord);
                            // Store in sessionStorage as backup
                            sessionStorage.setItem('repairMaintenanceOrderData', JSON.stringify(originalRecord));
                            navigate('/materials-inventory/repair-maintenance-order/view', {
                              state: {
                                activeTab: 'repair-maintenance',
                                orderData: originalRecord,
                              },
                            });
                          } else {
                            console.error('Original record not found for order:', record.orderId, record);
                            toast({
                              title: 'Error',
                              description: 'Unable to load order details. Please try again.',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        {record.orderId}
                      </Button>
                    </TableCell>
                    <TableCell className='text-sm'>{record.requestedDate}</TableCell>
                    <TableCell className='text-sm'>{record.machineName}</TableCell>
                    <TableCell className='text-sm'>{record.nameOfWork}</TableCell>
                    <TableCell className='text-sm'>{record.typeOfWork}</TableCell>
                    <TableCell className='text-sm font-medium'>{record.totalAmount}</TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusColor(record.status)} border`}
                      >
                        <span className='flex items-center gap-1'>
                          {getStatusIcon(record.status)}
                          <span className='text-xs'>
                            {record.statusLabel}
                          </span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {record.approvedBy}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {record.completedOn}
                    </TableCell>
                  </TableRow>
                ))
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // Compact Table View Component
  const TableView = ({ records }: { records: any[] }) => (
    <Card className='rounded-lg shadow-sm'>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('orderId')}
                >
                  <div className='flex items-center gap-2'>
                    Order ID
                    {getSortIcon('orderId')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('requestedDate')}
                >
                  <div className='flex items-center gap-2'>
                    Requested Date
                    {getSortIcon('requestedDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('machineName')}
                >
                  <div className='flex items-center gap-2'>
                    Machine
                    {getSortIcon('machineName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[150px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('nameOfWork')}
                >
                  <div className='flex items-center gap-2'>
                    Name of the Work
                    {getSortIcon('nameOfWork')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('typeOfWork')}
                >
                  <div className='flex items-center gap-2'>
                    Type of the Work
                    {getSortIcon('typeOfWork')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('totalAmount')}
                >
                  <div className='flex items-center gap-2'>
                    Total Amount
                    {getSortIcon('totalAmount')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('status')}
                >
                  <div className='flex items-center gap-2'>
                    Status
                    {getSortIcon('status')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('approvedBy')}
                >
                  <div className='flex items-center gap-2'>
                    Approved By
                    {getSortIcon('approvedBy')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('completedOn')}
                >
                  <div className='flex items-center gap-2'>
                    Completed Date
                    {getSortIcon('completedOn')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length > 0 ? (
                records.map((record) => (
                  <TableRow
                    key={record.id}
                    className='hover:bg-muted/30 border-b border-secondary/20'
                  >
                    <TableCell className='font-medium'>
                      <Button
                        type='button'
                        variant='link'
                        className='p-0 h-auto font-medium hover:underline text-black cursor-pointer'
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Order ID clicked:', record.orderId, record);
                          
                          // Use originalRecord from transformed data, or find it from the array
                          const originalRecord = record.originalRecord || 
                            repairMaintenances.find((r) => r.id === record.id);
                          
                          console.log('Original record found:', originalRecord);
                          
                          if (originalRecord) {
                            console.log('Navigating to view form with data:', originalRecord);
                            // Store in sessionStorage as backup
                            sessionStorage.setItem('repairMaintenanceOrderData', JSON.stringify(originalRecord));
                            navigate('/materials-inventory/repair-maintenance-order/view', {
                              state: {
                                activeTab: 'repair-maintenance',
                                orderData: originalRecord,
                              },
                            });
                          } else {
                            console.error('Original record not found for order:', record.orderId, record);
                            toast({
                              title: 'Error',
                              description: 'Unable to load order details. Please try again.',
                              variant: 'destructive',
                            });
                          }
                        }}
                      >
                        {record.orderId}
                      </Button>
                    </TableCell>
                    <TableCell className='text-sm'>{record.requestedDate}</TableCell>
                    <TableCell className='text-sm'>{record.machineName}</TableCell>
                    <TableCell className='text-sm'>{record.nameOfWork}</TableCell>
                    <TableCell className='text-sm'>{record.typeOfWork}</TableCell>
                    <TableCell className='text-sm font-medium'>{record.totalAmount}</TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusColor(record.status)} border`}
                      >
                        <span className='flex items-center gap-1'>
                          {getStatusIcon(record.status)}
                          <span className='text-xs'>{record.statusLabel}</span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm'>{record.approvedBy}</TableCell>
                    <TableCell className='text-sm'>{record.completedOn}</TableCell>
                  </TableRow>
                ))
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className='space-y-6 p-4 sm:p-0'>
      {/* Network Status Alert */}
      {!isOnline && (
        <Alert className='border-red-200 bg-red-50 text-red-800'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            You are currently offline. Some features may not work properly.
            Please check your internet connection.
          </AlertDescription>
        </Alert>
      )}

      {/* Search, Views, Status and Actions Row */}
      <div className='flex flex-col gap-4 mb-6'>
        {/* Desktop: Show UnifiedTabSearch */}
        <div className='hidden sm:block'>
          <UnifiedTabSearch
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder='Search by order ID, name of work, type...'
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewToggle={true}
            filterUnit={filterUnit}
            onFilterUnitChange={setFilterUnit}
            availableBranches={availableBranches}
            isLoadingBranches={isLoadingBranches}
            statusFilter={filterStatus}
            onStatusFilterChange={(value) => {
              setFilterStatus(value);
              const newSearchParams = new URLSearchParams(searchParams);
              if (value === 'all') {
                newSearchParams.delete('filter');
              } else {
                newSearchParams.set('filter', value);
              }
              setSearchParams(newSearchParams, { replace: true });
            }}
            showStatusFilter={true}
            statusOptions={[
              { value: 'all', label: 'All Status' },
              { value: RepairMaintenanceStatus.PENDING_APPROVAL, label: 'Pending Approval' },
              { value: RepairMaintenanceStatus.APPROVED, label: 'Approved' },
              { value: RepairMaintenanceStatus.COMPLETED, label: 'Completed' },
              { value: RepairMaintenanceStatus.REJECTED, label: 'Rejected' },
            ]}
            onExport={() => setIsExportDialogOpen(true)}
            isExporting={isExporting}
            showExport={true}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            showRefresh={true}
            onAdd={() => navigate('/materials-inventory/repair-maintenance-order', {
              state: { activeTab: 'repair-maintenance' },
            })}
            addLabel='WORK ORDER FORM'
            addIcon={<Plus className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />}
            showAddButton={currentUser?.role !== 'company_owner'}
            isOnline={isOnline}
          />
        </div>

        {/* Mobile: Show UnifiedTabSearch */}
        <div className='sm:hidden'>
          <UnifiedTabSearch
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder='Search by order ID, name of work...'
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showViewToggle={true}
            filterUnit={filterUnit}
            onFilterUnitChange={setFilterUnit}
            availableBranches={availableBranches}
            isLoadingBranches={isLoadingBranches}
            statusFilter={filterStatus}
            onStatusFilterChange={(value) => {
              setFilterStatus(value);
              const newSearchParams = new URLSearchParams(searchParams);
              if (value === 'all') {
                newSearchParams.delete('filter');
              } else {
                newSearchParams.set('filter', value);
              }
              setSearchParams(newSearchParams, { replace: true });
            }}
            showStatusFilter={true}
            statusOptions={[
              { value: 'all', label: 'All Status' },
              { value: RepairMaintenanceStatus.PENDING_APPROVAL, label: 'Pending Approval' },
              { value: RepairMaintenanceStatus.APPROVED, label: 'Approved' },
              { value: RepairMaintenanceStatus.COMPLETED, label: 'Completed' },
              { value: RepairMaintenanceStatus.REJECTED, label: 'Rejected' },
            ]}
            onExport={() => setIsExportDialogOpen(true)}
            isExporting={isExporting}
            showExport={true}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            showRefresh={true}
            onAdd={() => navigate('/materials-inventory/repair-maintenance-order', {
              state: { activeTab: 'repair-maintenance' },
            })}
            addLabel='WORKORDER FORM'
            addIcon={<Plus className='w-4 h-4 mr-1' />}
            showAddButton={currentUser?.role !== 'company_owner'}
            isOnline={isOnline}
          />
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue='all' className='w-full'>
        <TabsContent value='all' className='space-y-3 sm:space-y-4'>
          {/* Loading State */}
          {isLoading ? (
            <Card className='rounded-lg shadow-sm p-8 text-center'>
              <Loader2 className='w-12 h-12 text-primary mx-auto mb-4 animate-spin' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                Loading Repair and Maintenance Records
              </h3>
              <p className='text-muted-foreground mb-4'>
                Please wait while we fetch the data...
              </p>
            </Card>
          ) : error ? (
            <Card className='rounded-lg shadow-sm p-8 text-center'>
              <RefreshCcw className='w-12 h-12 text-red-500 mx-auto mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                No Data Found, Reload Data
              </h3>
              <p className='text-muted-foreground mb-4'>{error}</p>
              <Button variant='outline' onClick={() => fetchRepairMaintenances()}>
                <RefreshCcw className='w-4 h-4 mr-2' />
                Reload
              </Button>
            </Card>
          ) : (
            <>
              {/* Table/List View */}
              {viewMode === 'table' ? (
                <TableView records={filteredRecords} />
              ) : (
                <ListView records={filteredRecords} />
              )}

              {/* Empty State */}
              {filteredRecords.length === 0 && (
                <Card className='rounded-lg shadow-sm p-8 text-center'>
                  <Wrench className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-foreground mb-2'>
                    No Repair and Maintenance Records Found
                  </h3>
                  <p className='text-muted-foreground mb-4'>
                    {searchTerm.trim() 
                      ? `No records found matching "${searchTerm}"`
                      : 'No repair and maintenance records match your current filters.'}
                  </p>
                </Card>
              )}

              {/* Search Results Info */}
              {searchTerm.trim() && !isLoading && filteredRecords.length > 0 && (
                <div className='text-sm text-muted-foreground text-center py-2'>
                  Showing {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} matching "{searchTerm}"
                </div>
              )}

              {/* Pagination Controls */}
              {pagination && !searchTerm.trim() && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
                  <div className='text-xs sm:text-sm text-muted-foreground'>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.itemCount
                    )}{' '}
                    of {pagination.itemCount} entries
                  </div>

                  <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-2 w-full sm:w-auto'>
                    <div className='flex items-center gap-2 w-full sm:w-auto justify-center'>
                      <span className='text-xs sm:text-sm text-muted-foreground whitespace-nowrap'>Show:</span>
                      <Select
                        value={pagination.limit.toString()}
                        onValueChange={(value) =>
                          handleLimitChange(parseInt(value))
                        }
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
                      <span className='text-xs sm:text-sm text-muted-foreground whitespace-nowrap'>
                        per page
                      </span>
                    </div>

                    <div className='flex items-center gap-1'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(1)}
                        disabled={
                          !pagination.hasPreviousPage || pagination.page === 1
                        }
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>

                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!pagination.hasPreviousPage}
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>

                      <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                        {Array.from(
                          { length: Math.min(6, pagination.pageCount) },
                          (_, i) => {
                            let pageNum;
                            
                            if (pagination.pageCount <= 6) {
                              pageNum = i + 1;
                            } else if (pagination.page <= 3) {
                              pageNum = i + 1;
                            } else if (
                              pagination.page >=
                              pagination.pageCount - 2
                            ) {
                              pageNum = pagination.pageCount - 5 + i;
                            } else {
                              pageNum = pagination.page - 3 + i;
                            }

                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  pagination.page === pageNum
                                    ? 'default'
                                    : 'outline'
                                }
                                size='sm'
                                onClick={() => handlePageChange(pageNum)}
                                className='h-7 w-7 sm:h-8 sm:w-8 p-0 text-xs sm:text-sm'
                              >
                                {pageNum}
                              </Button>
                            );
                          }
                        )}
                      </div>

                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!pagination.hasNextPage}
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>

                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(pagination.pageCount)}
                        disabled={
                          !pagination.hasNextPage ||
                          pagination.page === pagination.pageCount
                        }
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronsRight className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Download className='w-5 h-5 text-primary' />
              Export Repair and Maintenance to CSV
            </DialogTitle>
          </DialogHeader>
          
          <div className='space-y-4'>
            <div className='space-y-3'>
              <Label className='text-sm font-medium'>Export Options</Label>
              
              <div className='space-y-2'>
                <Label htmlFor='exportFromDate' className='text-sm'>
                  From Date (Optional)
                </Label>
                <Input
                  id='exportFromDate'
                  type='date'
                  value={exportDateRange.from}
                  onChange={(e) => {
                    setExportDateRange(prev => ({
                      ...prev,
                      from: e.target.value
                    }));
                    setSelectedExportPreset('');
                  }}
                  className='w-full'
                />
              </div>
              
              <div className='space-y-2'>
                <Label htmlFor='exportToDate' className='text-sm'>
                  To Date (Optional)
                </Label>
                <Input
                  id='exportToDate'
                  type='date'
                  value={exportDateRange.to}
                  onChange={(e) => {
                    setExportDateRange(prev => ({
                      ...prev,
                      to: e.target.value
                    }));
                    setSelectedExportPreset('');
                  }}
                  className='w-full'
                />
              </div>
              
              <div className='text-xs text-muted-foreground'>
                Select dates for filtered export, or use "All Data" for complete export. Current filters (status, unit) will be applied.
              </div>
              
              {/* Quick preset buttons */}
              <div className='pt-2 border-t space-y-2'>
                <div className='text-xs font-medium text-muted-foreground'>Quick Presets:</div>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setExportDateRange({
                        from: '',
                        to: ''
                      });
                      setSelectedExportPreset('all');
                    }}
                    className={`text-xs ${
                      selectedExportPreset === 'all'
                        ? 'bg-green-500 border-green-600 text-white hover:bg-green-600'
                        : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    All 
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      setExportDateRange({
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      setSelectedExportPreset('this_month');
                    }}
                    className={`text-xs ${
                      selectedExportPreset === 'this_month'
                        ? 'bg-primary border-primary text-white hover:bg-primary/90'
                        : 'hover:bg-muted'
                    }`}
                  >
                    This Month
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const now = new Date();
                      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                      
                      setExportDateRange({
                        from: firstDayLastMonth.toISOString().split('T')[0],
                        to: lastDayLastMonth.toISOString().split('T')[0]
                      });
                      setSelectedExportPreset('last_month');
                    }}
                    className={`text-xs ${
                      selectedExportPreset === 'last_month'
                        ? 'bg-primary border-primary text-white hover:bg-primary/90'
                        : 'hover:bg-muted'
                    }`}
                  >
                    Last Month
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const now = new Date();
                      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      setExportDateRange({
                        from: threeMonthsAgo.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      setSelectedExportPreset('last_3_months');
                    }}
                    className={`text-xs ${
                      selectedExportPreset === 'last_3_months'
                        ? 'bg-primary border-primary text-white hover:bg-primary/90'
                        : 'hover:bg-muted'
                    }`}
                  >
                    Last 3 Months
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), 0, 1);
                      const lastDay = new Date(now.getFullYear(), 11, 31);
                      
                      setExportDateRange({
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      setSelectedExportPreset('this_year');
                    }}
                    className={`text-xs ${
                      selectedExportPreset === 'this_year'
                        ? 'bg-primary border-primary text-white hover:bg-primary/90'
                        : 'hover:bg-muted'
                    }`}
                  >
                    This Year
                  </Button>
                </div>
              </div>
            </div>
            
            <div className='flex justify-end gap-2 pt-4'>
              <Button
                variant='outline'
                onClick={() => {
                  setIsExportDialogOpen(false);
                  resetExportDateRange();
                }}
                disabled={isExporting}
              >
                Cancel
              </Button>
              
              <Button
                onClick={handleExportToCSV}
                disabled={isExporting}
                className='bg-primary hover:bg-primary/90 text-white'
              >
                {isExporting ? (
                  <>
                    <Loader2 className='w-4 h-4 animate-spin mr-2' />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Upload className='w-4 h-4 mr-2' />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

