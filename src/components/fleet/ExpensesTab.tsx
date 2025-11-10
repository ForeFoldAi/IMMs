import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  IndianRupee,
  Search,
  Plus,
  Eye,
  Truck,
  User,
  Fuel,
  Wrench,
  CreditCard,
  MapPin,
  Receipt,
  FileText,
  Upload,
  RefreshCcw,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Image,
  Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';

// Date utility functions
const formatDateToString = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to convert API category to form category format
const convertApiCategoryToFormCategory = (apiCategory: string): string => {
  if (!apiCategory) return '';
  return apiCategory.toLowerCase().replace(/\s+/g, '_');
};

// Helper function to convert API VehicleExpense to VehicleExpenseData
const mapVehicleExpenseToExpenseData = (expense: VehicleExpense): VehicleExpenseData => {
  // Convert filePaths to a format that can be displayed
  // Note: filePaths are URLs from the API, not File objects
  const receipts: File[] = [];
  
  // Add defensive checks for undefined/null values
  const vehicleId = expense.vehicleId ?? 0;
  const amount = expense.amount ?? 0;
  // Handle nested category object (new API) or string (legacy)
  // Check for null object before accessing .name
  const categoryObj = typeof expense.category === 'object' && expense.category !== null ? expense.category : null;
  const categoryName = categoryObj?.name || (typeof expense.category === 'string' ? expense.category : '') || '';
  const categoryId = categoryObj?.id;
  const expenseType = expense.expenseType || '';
  const paymentMethod = expense.paymentMethod || '';
  
  // Use expenseCode if available, otherwise fall back to id
  const expenseCode = expense.expenseCode || (expense.id ?? 0).toString();
  
  return {
    id: (expense.id ?? 0).toString(),
    expenseNumber: expenseCode, // Use expenseCode from API
    vehicleId: vehicleId.toString(),
    vehicleRegistrationNumber: expense.vehicle?.registrationNumber || '',
    driverId: '', // Driver info not in API response
    driverName: '', // Driver info not in API response
    expenseDate: expense.expenseDate || '',
    expenseCategory: convertApiCategoryToFormCategory(categoryName),
    expenseCategoryId: categoryId,
    categoryName: categoryName, // Store original category name from API for display
    expenseType: expenseType,
    description: expense.additionalNotes || '',
    amount: amount.toString(),
    vendorName: expense.vendorName || '',
    vendorContact: expense.vendorContact || '',
    vendorAddress: expense.vendorAddress || '',
    paymentMethod: paymentMethod.toLowerCase().replace(/\s+/g, '_') as VehicleExpenseData['paymentMethod'],
    paymentReference: expense.paymentReference || '',
    location: expense.location || '',
    odometerReading: '', // Not in API
    receipts: receipts, // Files from API are URLs, will need separate handling for display
    approvalStatus: 'pending' as const, // Not in API
    approvedBy: '',
    approvedDate: '',
    rejectionReason: '',
    notes: expense.additionalNotes || '',
    requestedBy: expense.requestedBy || '',
    createdAt: expense.createdAt || '',
    updatedAt: expense.updatedAt || '',
    // Store createdBy name for display
    submittedBy: expense.createdBy?.name || '',
  };
};

// Helper function to convert VehicleExpenseData to API CreateVehicleExpenseRequest
// Note: This function is currently unused - ExpensesForm.tsx has its own version
// Keeping for potential future use, but updated to use categoryId
const mapExpenseDataToApiRequest = (data: VehicleExpenseData, categoryId?: number): CreateVehicleExpenseRequest => {
  const amount = parseFloat(data.amount);
  
  return {
    vehicleId: parseInt(data.vehicleId),
    expenseDate: data.expenseDate.includes('-') && data.expenseDate.split('-')[0].length === 2 
      ? convertDateFormatToApi(data.expenseDate) 
      : data.expenseDate, // Convert DD-MM-YYYY to YYYY-MM-DD
    categoryId: categoryId, // Use categoryId (number) instead of category (string)
    expenseType: data.expenseType,
    amount: amount.toString(), // Convert to string as API expects "number string"
    location: data.location,
    requestedBy: data.requestedBy,
    vendorName: data.vendorName,
    vendorContact: data.vendorContact,
    vendorAddress: data.vendorAddress,
    paymentMethod: data.paymentMethod.replace('_', ' '),
    paymentReference: data.paymentReference,
    additionalNotes: data.notes,
    files: data.receipts.length > 0 ? data.receipts : undefined,
  };
};

// Helper function to convert DD-MM-YYYY to YYYY-MM-DD for API
const convertDateFormatToApi = (dateString: string): string => {
  if (!dateString) return '';
  
  // If already in YYYY-MM-DD format, return as is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Handle DD-MM-YYYY format
  if (dateString.includes('-') && dateString.length === 10) {
    const parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateString;
};

const formatDateDisplay = (dateString: string): string => {
  if (!dateString) return '';
  
  // Handle ISO date strings with time (e.g., "2025-01-15T10:30:00.000Z")
  // Extract just the date part before 'T'
  let dateOnly = dateString;
  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  }
  
  // Handle different date formats
  if (dateOnly.includes('-')) {
    const parts = dateOnly.split('-');
    if (parts.length === 3) {
      // Check if first part is day (2 digits) vs year (4 digits)
      if (parts[0].length === 2 && parts[2].length === 4) {
        // Already DD-MM-YYYY format
        return dateOnly;
      } else if (parts[0].length === 4 && parts[2].length === 2) {
        // YYYY-MM-DD format, convert to DD-MM-YYYY
        const [year, month, day] = parts;
        return `${day}-${month}-${year}`;
      }
    }
  }
  
  // Try to parse as Date and format (only date part, no time)
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return formatDateToString(date);
    }
  } catch (error) {
    // If parsing fails, return original string (date part only)
  }
  
  return dateOnly;
};
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '../../hooks/use-toast';
import { useRole } from '../../contexts/RoleContext';
import { ExpensesForm, VehicleExpenseData } from './ExpensesForm';
import { fleetApi } from '../../lib/api';
import type { VehicleExpense, Vehicle, PaginatedResponse, CreateVehicleExpenseRequest } from '../../lib/api/types';

export const ExpensesTab = () => {
  const { currentUser, hasPermission, isCompanyLevel } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [expenses, setExpenses] = useState<VehicleExpenseData[]>([]);
  const [expensesData, setExpensesData] = useState<PaginatedResponse<VehicleExpense> | null>(null);
  const [availableVehicles, setAvailableVehicles] = useState<Array<{ id: string; registrationNumber: string; driverName: string; driverId: string }>>([]);
  const [expenseCategories, setExpenseCategories] = useState<Array<{ id: number; name: string }>>([]);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt'); // Sort by createdAt to show newest first
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Form states
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [viewingExpense, setViewingExpense] = useState<VehicleExpenseData | null>(null);
  const [viewingExpenseFilePaths, setViewingExpenseFilePaths] = useState<string[]>([]); // Stores attachmentUrls for preview
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  
  // Export states
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    from: '',
    to: '',
  });
  const [selectedExportPreset, setSelectedExportPreset] = useState<string>('all');

  // Fetch vehicles for the vehicle filter
  const fetchVehicles = useCallback(async () => {
    try {
      const response = await fleetApi.getAllVehicles({ page: 1, limit: 100 });
      
      // Map vehicles to the format expected by the form
      const mappedVehicles = response.data.map((vehicle: Vehicle) => ({
        id: vehicle.id.toString(),
        registrationNumber: vehicle.registrationNumber,
        driverName: '', // Driver info not available in vehicle API
        driverId: '', // Driver info not available in vehicle API
      }));
      
      setAvailableVehicles(mappedVehicles);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      // Don't show toast for vehicles, just log error
    }
  }, []);

  // Fetch expense categories from API
  useEffect(() => {
    const fetchExpenseCategories = async () => {
      try {
        const response = await fleetApi.getAllExpenseCategories({ page: 1, limit: 100 });
        setExpenseCategories(response.data.map(ec => ({ id: ec.id, name: ec.name })));
      } catch (error) {
        console.error('Error fetching expense categories:', error);
      }
    };

    fetchExpenseCategories();
  }, []);

  // Fetch expenses data from API
  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: 1,
        limit: 1000, // Fetch large batch for client-side sorting
        // Removed sortBy and sortOrder - sorting is now handled client-side
      };

      // Add category filter if not 'all' - use categoryId instead of category
    if (filterCategory !== 'all') {
        // Find expense category ID from the name
        const categoryMap: Record<string, string> = {
          'fuel': 'Fuel',
          'maintenance': 'Maintenance',
          'repair': 'Repair',
          'insurance': 'Insurance',
          'toll': 'Toll',
          'tyre': 'Tyre',
          'permit': 'Permit',
          'other': 'Other',
        };
        const categoryName = categoryMap[filterCategory] || filterCategory;
        const selectedCategory = expenseCategories.find(ec => 
          ec.name.toLowerCase() === filterCategory.toLowerCase() || 
          ec.name === categoryName
        );
        if (selectedCategory) {
          params.categoryId = selectedCategory.id;
        }
    }

      // Add vehicle filter if not 'all'
    if (filterVehicle !== 'all') {
        params.vehicleId = filterVehicle;
    }

      // Add date range filter if not 'all'
    if (filterDateRange !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (filterDateRange) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
            params.expenseDate = filterDate.toISOString().split('T')[0];
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
            params.expenseDateFrom = filterDate.toISOString().split('T')[0];
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
            params.expenseDateFrom = filterDate.toISOString().split('T')[0];
          break;
        case 'quarter':
          filterDate.setMonth(now.getMonth() - 3);
            params.expenseDateFrom = filterDate.toISOString().split('T')[0];
          break;
      }
    }

      // Fetch all pages for client-side sorting and filtering
      let allExpenses: VehicleExpense[] = [];
      let currentPageNum = 1;
      let hasMorePages = true;
      const limit = 100; // API limit per page

      while (hasMorePages) {
        const pageParams = { ...params, page: currentPageNum, limit: limit };
        
        // Remove API-side search - we'll do client-side filtering instead
        // This ensures we search across all columns consistently

        const response = await fleetApi.getAllVehicleExpenses(pageParams);
        allExpenses = [...allExpenses, ...response.data];
        
        hasMorePages = response.meta.hasNextPage || false;
        currentPageNum++;
        
        // Safety check to prevent infinite loops
        if (currentPageNum > 1000) break;
      }

      // Map API expenses to VehicleExpenseData format
      const mappedExpenses = allExpenses.map(mapVehicleExpenseToExpenseData);
        setExpenses(mappedExpenses);
      
      // Store metadata for reference (from last page)
      if (allExpenses.length > 0) {
        const lastResponse = await fleetApi.getAllVehicleExpenses({ ...params, page: 1, limit: 1 });
        if (lastResponse && lastResponse.meta) {
          setExpensesData({
            ...lastResponse,
            data: [],
            meta: {
              ...lastResponse.meta,
              itemCount: mappedExpenses.length,
            }
          });
        }
      } else {
        setExpensesData(null);
      }
    } catch (error: any) {
      console.error('Error fetching expenses:', error);
      
      let errorMessage = 'Failed to load expenses. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          // Provide more helpful message for company owners
          if (isCompanyLevel()) {
            errorMessage = 'Access denied. Please contact your administrator to ensure your account has the necessary fleet management permissions configured.';
          } else {
          errorMessage = 'You do not have permission to access expenses.';
          }
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data?.message) {
          errorMessage = data.message;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setExpenses([]);
      setExpensesData(null);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filterCategory, filterVehicle, filterDateRange, expenseCategories]);

  // Fetch vehicles on mount
  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  // Fetch expenses when dependencies change (no debounce needed for client-side search)
  useEffect(() => {
      fetchExpenses();
  }, [fetchExpenses]);

  // Reset to first page when filters or sorting change (except currentPage itself)
  useEffect(() => {
    if (currentPage !== 1) {
    setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterVehicle, filterDateRange, sortBy, sortOrder, itemsPerPage, searchTerm]);

  // Client-side search filtering function - searches across all columns
  const filterExpensesBySearch = useCallback((expenseList: VehicleExpenseData[], search: string): VehicleExpenseData[] => {
    if (!search.trim()) {
      return expenseList;
    }

    const searchLower = search.toLowerCase().trim();
    
    return expenseList.filter((expense) => {
      // Search across all visible and relevant fields
      const searchableFields = [
        expense.expenseNumber || '',
        expense.vehicleRegistrationNumber || '',
        expense.categoryName || expense.expenseCategory || '',
        expense.expenseType || '',
        expense.description || expense.notes || '',
        expense.amount || '',
        expense.location || '',
        expense.vendorName || '',
        expense.vendorContact || '',
        expense.vendorAddress || '',
        expense.paymentMethod ? expense.paymentMethod.replace('_', ' ') : '',
        expense.paymentReference || '',
        expense.requestedBy || '',
        expense.submittedBy || '',
        formatDateDisplay(expense.expenseDate) || '',
        formatDateDisplay(expense.createdAt || '') || '',
        formatCurrency(expense.amount) || '',
      ];

      // Check if any field contains the search term
      return searchableFields.some((field) => 
        field.toLowerCase().includes(searchLower)
      );
    });
  }, []);

  // Client-side sorting function
  const sortExpenses = useCallback((expenseList: VehicleExpenseData[]): VehicleExpenseData[] => {
    if (!sortBy) return expenseList;

    const sorted = [...expenseList].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'expenseCode':
          // Sort by expense number. If both are numeric use numeric sort, otherwise string compare.
          const aNum = parseFloat(a.expenseNumber);
          const bNum = parseFloat(b.expenseNumber);
          const aIsNumeric = !isNaN(aNum);
          const bIsNumeric = !isNaN(bNum);

          if (aIsNumeric && bIsNumeric) {
            return sortOrder === 'ASC' ? aNum - bNum : bNum - aNum;
          }

          const aCode = (a.expenseNumber || '').toString();
          const bCode = (b.expenseNumber || '').toString();
          return sortOrder === 'ASC'
            ? aCode.localeCompare(bCode)
            : bCode.localeCompare(aCode);
        
        case 'vehicleRegistrationNumber':
          aValue = a.vehicleRegistrationNumber || '';
          bValue = b.vehicleRegistrationNumber || '';
          break;
        
        case 'expenseCategory':
          aValue = (a.categoryName || a.expenseCategory || '').toLowerCase();
          bValue = (b.categoryName || b.expenseCategory || '').toLowerCase();
          break;
        
        case 'expenseDate':
          aValue = new Date(a.expenseDate).getTime();
          bValue = new Date(b.expenseDate).getTime();
          break;
        
        case 'createdAt':
          // Handle empty dates by putting them at the end
          if (!a.createdAt || !a.createdAt.trim()) {
            aValue = 0; // Will sort to end in DESC order
          } else {
            aValue = new Date(a.createdAt).getTime();
            if (isNaN(aValue)) aValue = 0;
          }
          if (!b.createdAt || !b.createdAt.trim()) {
            bValue = 0; // Will sort to end in DESC order
          } else {
            bValue = new Date(b.createdAt).getTime();
            if (isNaN(bValue)) bValue = 0;
          }
          break;
        
        case 'amount':
          aValue = parseFloat(a.amount) || 0;
          bValue = parseFloat(b.amount) || 0;
          break;
        
        case 'requestedBy':
          aValue = (a.requestedBy || '').toLowerCase();
          bValue = (b.requestedBy || '').toLowerCase();
          break;
        
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ASC' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'ASC' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [sortBy, sortOrder]);

  // Apply client-side search filtering first
  const filteredExpenses = useMemo(() => {
    return filterExpensesBySearch(expenses, searchTerm);
  }, [expenses, searchTerm, filterExpensesBySearch]);

  // Apply sorting to filtered expenses
  const sortedExpenses = useMemo(() => {
    return sortExpenses(filteredExpenses);
  }, [filteredExpenses, sortExpenses]);

  // Apply client-side pagination
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedExpenses.slice(startIndex, endIndex);
  }, [sortedExpenses, currentPage, itemsPerPage]);

  // Calculate pagination metadata
  const totalPages = Math.ceil(sortedExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedExpenses.length);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      // Default to DESC to show newest/highest values first
      setSortOrder('DESC');
    }
  };

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

  const getExpenseCategoryIcon = (category: string) => {
    const normalized = (category || '').toLowerCase().replace(/\s+/g, '_');
    switch (normalized) {
      case 'fuel':
        return <Fuel className='w-4 h-4' />;
      case 'maintenance':
      case 'repair':
        return <Wrench className='w-4 h-4' />;
      case 'insurance':
        return <CreditCard className='w-4 h-4' />;
      case 'toll':
      case 'parking':
        return <MapPin className='w-4 h-4' />;
      case 'driver_salary':
        return <IndianRupee className='w-4 h-4' />;
      case 'permit':
        return <FileText className='w-4 h-4' />;
      default:
        return <Receipt className='w-4 h-4' />;
    }
  };

  const getExpenseCategoryColor = (category: string) => {
    const normalized = (category || '').toLowerCase().replace(/\s+/g, '_');
    switch (normalized) {
      case 'fuel':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'repair':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'insurance':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'toll':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'parking':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'driver_salary':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'permit':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };


  const handleCreateExpense = async (expenseData: VehicleExpenseData) => {
    // Form component now handles the API call
    // This callback is called after successful creation to refresh the list
    try {
      setIsLoading(true);
      
      // Refresh the expenses list after successful creation
      await fetchExpenses();
      
    setIsExpenseFormOpen(false);
    } catch (error: any) {
      console.error('Error refreshing expenses list:', error);
      
      // Don't show error toast here as the form already handled the creation
      // Just log the error
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewExpense = async (expense: VehicleExpenseData) => {
    try {
      setIsLoading(true);
      
      // Fetch full expense details from API to get file attachments
      if (expense.id) {
        const fullExpense = await fleetApi.getVehicleExpenseById(parseInt(expense.id));
        const mappedExpense = mapVehicleExpenseToExpenseData(fullExpense);
        
        // Store attachmentUrls from API for display (preferred over filePaths)
        setViewingExpenseFilePaths(fullExpense.attachmentUrls || fullExpense.filePaths || []);
        setViewingExpense(mappedExpense);
      } else {
    setViewingExpense(expense);
        setViewingExpenseFilePaths([]);
      }
      
    setIsViewDialogOpen(true);
    } catch (error: any) {
      console.error('Error fetching expense details:', error);
      
      // Fallback to using the expense data we already have
      setViewingExpense(expense);
      setViewingExpenseFilePaths([]);
      setIsViewDialogOpen(true);
      
      toast({
        title: 'Warning',
        description: 'Could not fetch full expense details. Showing available information.',
        variant: 'default',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB');
  };

  const formatCurrency = (amount: string) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  // File handling functions
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className='w-4 h-4' />;
    }
    return <FileText className='w-4 h-4' />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Export functionality - Fetch all expenses from API for export
  const exportToXLSX = async () => {
    try {
      setIsExporting(true);

      const formatForApi = (date: Date) => date.toISOString().split('T')[0];

      let fromDate = exportDateRange.from || '';
      let toDate = exportDateRange.to || '';

      if (!fromDate && !toDate && filterDateRange !== 'all') {
        const now = new Date();
        
        switch (filterDateRange) {
          case 'today': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            fromDate = formatForApi(today);
            toDate = formatForApi(today);
            break;
          }
          case 'week': {
            const weekAgo = new Date();
            weekAgo.setDate(now.getDate() - 7);
            fromDate = formatForApi(weekAgo);
            toDate = formatForApi(now);
            break;
          }
          case 'month': {
            const monthAgo = new Date();
            monthAgo.setMonth(now.getMonth() - 1);
            fromDate = formatForApi(monthAgo);
            toDate = formatForApi(now);
            break;
          }
          case 'quarter': {
            const quarterAgo = new Date();
            quarterAgo.setMonth(now.getMonth() - 3);
            fromDate = formatForApi(quarterAgo);
            toDate = formatForApi(now);
            break;
          }
        }
      }

      const blob = await fleetApi.exportVehicleExpenses(
        fromDate || undefined,
        toDate || undefined
      );

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const currentDate = new Date().toISOString().split('T')[0];
      let filename = `ssrfm_expenses_export_${currentDate}`;

      if (fromDate || toDate) {
        if (fromDate && toDate) {
          filename += `_${fromDate}_to_${toDate}`;
        } else if (fromDate) {
          filename += `_from_${fromDate}`;
        } else if (toDate) {
          filename += `_to_${toDate}`;
        }
      } else {
        filename += '_all_data';
      }

      link.download = `${filename}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setIsExportDialogOpen(false);
      resetExportDateRange();

        toast({
        title: 'Export Successful',
        description: 'Expenses data export has been downloaded successfully.',
          variant: 'default',
        });
    } catch (error: any) {
      console.error('Error exporting expenses:', error);

      const errorMessage = error?.response?.data?.message || 'Failed to export expenses data. Please try again.';

        toast({
        title: 'Export Failed',
        description: errorMessage,
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

  return (
    <div className='space-y-4 p-2 sm:space-y-6 sm:p-0'>
      {/* Search, Filters and Actions */}
      <Card>
        <CardContent className='p-3 sm:p-4'>
          {/* Mobile Layout */}
          <div className='flex flex-col gap-3 sm:hidden'>
            {/* Search and Action Buttons Row */}
            <div className='flex gap-2'>
              <div className='flex-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                  <Input
                    placeholder='Search expenses...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>
              <Button
                variant='outline'
                onClick={fetchExpenses}
                disabled={isLoading}
                size='sm'
                className='gap-1 text-xs'
              >
                <RefreshCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Ref
              </Button>
              <Button
                variant='outline'
                onClick={() => setIsExportDialogOpen(true)}
                size='sm'
                className='gap-1 text-xs'
                disabled={sortedExpenses.length === 0}
              >
                <Upload className='w-3 h-3' />
                Export
              </Button>
              <Button
                onClick={() => setIsExpenseFormOpen(true)}
                size='sm'
                className='gap-1 text-xs'
                disabled={!isCompanyLevel() && !hasPermission('inventory:material-indents:create')}
              >
                <Plus className='w-3 h-3' />
                Add
              </Button>
            </div>
            
            {/* Filters Row */}
            <div className='flex gap-2'>
              <div className='flex-1'>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Category' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Categories</SelectItem>
                    {expenseCategories.map((ec) => (
                      <SelectItem key={ec.id || ec.name} value={ec.name.toLowerCase()}>
                        {ec.name}
                      </SelectItem>
                    ))}
                    {expenseCategories.length === 0 && (
                      <>
                    <SelectItem value='fuel'>Fuel</SelectItem>
                    <SelectItem value='maintenance'>Maintenance</SelectItem>
                    <SelectItem value='repair'>Repair</SelectItem>
                    <SelectItem value='insurance'>Insurance</SelectItem>
                    <SelectItem value='toll'>Toll</SelectItem>
                    <SelectItem value='tyre'>Tyre</SelectItem>
                    <SelectItem value='permit'>Permit</SelectItem>
                    <SelectItem value='other'>Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className='flex-1'>
                <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Vehicle' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Vehicles</SelectItem>
                    {availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className='flex gap-2'>
              <div className='flex-1'>
                <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Date Range' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Time</SelectItem>
                    <SelectItem value='today'>Today</SelectItem>
                    <SelectItem value='week'>This Week</SelectItem>
                    <SelectItem value='month'>This Month</SelectItem>
                    <SelectItem value='quarter'>This Quarter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className='hidden sm:flex flex-wrap items-center justify-end gap-3'>
            {/* Search */}
            <div className='min-w-[200px] max-w-[300px]'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                <Input
                  placeholder='Search expenses...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className='w-auto min-w-[130px]'>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className='text-sm w-full'>
                  <SelectValue placeholder='Category' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Categories</SelectItem>
                  {expenseCategories.map((ec) => (
                    <SelectItem key={ec.id || ec.name} value={ec.name.toLowerCase()}>
                      {ec.name}
                    </SelectItem>
                  ))}
                  {expenseCategories.length === 0 && (
                    <>
                  <SelectItem value='fuel'>Fuel</SelectItem>
                  <SelectItem value='maintenance'>Maintenance</SelectItem>
                  <SelectItem value='repair'>Repair</SelectItem>
                  <SelectItem value='insurance'>Insurance</SelectItem>
                  <SelectItem value='toll'>Toll</SelectItem>
                  <SelectItem value='tyre'>Tyre</SelectItem>
                  <SelectItem value='permit'>Permit</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Filter */}
            <div className='w-auto min-w-[130px]'>
              <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                <SelectTrigger className='text-sm w-full'>
                  <SelectValue placeholder='Vehicle' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Vehicles</SelectItem>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className='w-auto min-w-[120px]'>
              <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                <SelectTrigger className='text-sm w-full'>
                  <SelectValue placeholder='Date' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Time</SelectItem>
                  <SelectItem value='today'>Today</SelectItem>
                  <SelectItem value='week'>This Week</SelectItem>
                  <SelectItem value='month'>This Month</SelectItem>
                  <SelectItem value='quarter'>This Quarter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2 flex-shrink-0'>
              <Button
                variant='outline'
                onClick={fetchExpenses}
                disabled={isLoading}
                size='sm'
                className='gap-2 text-sm whitespace-nowrap'
              >
                <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className='hidden md:inline'>Refresh</span>
                <span className='md:hidden'>Ref</span>
              </Button>
              
              <Button
                variant='outline'
                onClick={() => setIsExportDialogOpen(true)}
                size='sm'
                className='gap-2 text-sm whitespace-nowrap'
                disabled={sortedExpenses.length === 0}
              >
                <Upload className='w-4 h-4' />
                <span className='hidden md:inline'>Export</span>
                <span className='md:hidden'>Exp</span>
              </Button>
              
              <Button
                onClick={() => setIsExpenseFormOpen(true)}
                size='sm'
                className='gap-2 text-sm whitespace-nowrap'
                disabled={!isCompanyLevel() && !hasPermission('inventory:material-indents:create')}
              >
                <Plus className='w-4 h-4' />
                <span className='hidden lg:inline'>Add Expense</span>
                <span className='lg:hidden hidden md:inline'>Add</span>
                <span className='md:hidden'>+</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <RefreshCcw className='w-8 h-8 animate-spin text-primary mx-auto mb-4' />
                <p className='text-muted-foreground'>Loading expenses...</p>
              </div>
            </div>
          ) : sortedExpenses.length === 0 ? (
            <div className='text-center py-12'>
              <IndianRupee className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No Expenses Found</h3>
              <p className='text-muted-foreground mb-4'>
                {searchTerm || filterCategory !== 'all' || filterVehicle !== 'all' || filterDateRange !== 'all'
                  ? 'No expenses match your current filters.'
                  : 'Get started by recording your first expense.'}
              </p>
             
            </div>
          ) : (
            <div className='overflow-x-auto -mx-4 sm:mx-0'>
              <div className='inline-block min-w-full align-middle px-4 sm:px-0'>
                <Table className='min-w-full'>
                <TableHeader>
                  <TableRow className='bg-secondary/20'>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('expenseCode')}
                    >
                      <div className='flex items-center gap-2'>
                        Expense ID
                        {getSortIcon('expenseCode')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('vehicleRegistrationNumber')}
                    >
                      <div className='flex items-center gap-2'>
                        Vehicle
                        {getSortIcon('vehicleRegistrationNumber')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('expenseCategory')}
                    >
                      <div className='flex items-center gap-2'>
                        Expense Category
                        {getSortIcon('expenseCategory')}
                      </div>
                    </TableHead>
                    <TableHead>Expense Details</TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('expenseDate')}
                    >
                      <div className='flex items-center gap-2'>
                        Expense Date
                        {getSortIcon('expenseDate')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className='flex items-center gap-2'>
                        Recorded Date
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('amount')}
                    >
                      <div className='flex items-center gap-2'>
                        Amount
                        {getSortIcon('amount')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('requestedBy')}
                    >
                      <div className='flex items-center gap-2'>
                      Reported By
                        {getSortIcon('requestedBy')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className='flex items-center gap-2'>
                        Submitted By
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedExpenses.map((expense) => (
                      <TableRow key={expense.id || expense.expenseNumber} className='hover:bg-muted/30'>
                        <TableCell className='font-medium'>
                          <button
                            onClick={() => handleViewExpense(expense)}
                            className='text-black hover:text-primary/80 hover:underline font-semibold text-sm cursor-pointer transition-colors duration-200'
                          >
                            {expense.expenseNumber}
                          </button>
                        </TableCell>
                        
                        <TableCell>
                            <span className='font-medium text-sm'>{expense.vehicleRegistrationNumber}</span>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={`${getExpenseCategoryColor(expense.expenseCategory)} border flex items-center gap-1 w-fit`}>
                            <span className='text-xs'>{expense.categoryName || expense.expenseCategory.replace('_', ' ').toUpperCase()}</span>
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm max-w-xs'>
                            <span className='font-medium truncate'>{expense.expenseType}</span>
                            <span className='text-xs text-muted-foreground truncate'>{expense.description}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{formatDateDisplay(expense.expenseDate)}</span>
                            <span className='text-xs text-muted-foreground'>
                              {expense.location}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{formatDateDisplay(expense.createdAt || new Date().toISOString())}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{formatCurrency(expense.amount)}</span>
                            <span className='text-xs text-muted-foreground'>
                              {expense.paymentMethod.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{expense.requestedBy || 'N/A'}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{expense.submittedBy || 'System User'}</span>
                          </div>
                        </TableCell>
                        </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
          
          {/* Pagination Controls */}
          {sortedExpenses.length > 0 && (
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
              {/* Page Info */}
              <div className='text-xs sm:text-sm text-muted-foreground'>
                Showing {startIndex + 1} to {endIndex} of {sortedExpenses.length} entries
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
                      <SelectItem value='10'>10</SelectItem>
                      <SelectItem value='20'>20</SelectItem>
                      <SelectItem value='30'>30</SelectItem>
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
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Page numbers - Show up to 5 pages */}
                  <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                      
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
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
                
                  {/* Next page button */}
                <Button
                  variant='outline'
                  size='sm'
                    onClick={() => setCurrentPage((prev) => prev + 1)}
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
          )}
        </CardContent>
      </Card>

      {/* Expense Form */}
      <ExpensesForm
        isOpen={isExpenseFormOpen}
        onClose={() => {
          setIsExpenseFormOpen(false);
        }}
        onSubmit={handleCreateExpense}
        editingExpense={null}
        availableVehicles={availableVehicles}
      />

      {/* View Expense Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) {
          setViewingExpense(null);
          setViewingExpenseFilePaths([]);
        }
      }}>
        <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='pb-2'>
            <DialogTitle className='flex items-center gap-2 text-lg'>
              <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
                <IndianRupee className='w-4 h-4 text-primary' />
              </div>
              Expense Details - {viewingExpense?.expenseNumber}
            </DialogTitle>
          </DialogHeader>
          
          {viewingExpense && (
            <div className='space-y-4'>
              {/* Single Card for all content */}
              <Card className='border-0 shadow-sm'>
                <CardContent className='space-y-4'>
                  {/* Basic Information */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Basic Information
                    </h4>

                    {/* First Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Expense ID</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.expenseNumber}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Vehicle</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.vehicleRegistrationNumber}
                        </div>
                      </div>
                    </div>

                    {/* Second Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Expense Date</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {formatDateDisplay(viewingExpense.expenseDate)}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Expense Category</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          <Badge className={`${getExpenseCategoryColor(viewingExpense.expenseCategory)} border flex items-center gap-1 w-fit`}>
                            <span className='text-xs'>{viewingExpense.categoryName || viewingExpense.expenseCategory.replace('_', ' ').toUpperCase()}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Third Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Expense For</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.expenseType}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Amount (₹)</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {formatCurrency(viewingExpense.amount)}
                        </div>
                      </div>
                    </div>

                    {/* Fourth Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Location</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.location}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Reported By</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.requestedBy || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Uploads Proofs */}
                  <div className='space-y-2'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Uploaded Proofs
                    </h4>

                    {/* Receipts/Attachments Display */}
                    {viewingExpenseFilePaths && viewingExpenseFilePaths.length > 0 ? (
                      <div className='space-y-3'>
                        <p className='text-xs font-medium text-muted-foreground'>
                          Files ({viewingExpenseFilePaths.length})
                        </p>
                        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                          {viewingExpenseFilePaths.map((fileUrl, index) => {
                            const fileName = fileUrl.split('/').pop()?.split('?')[0] || `File ${index + 1}`;
                            // Decode URL-encoded filename
                            const decodedFileName = decodeURIComponent(fileName);
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(decodedFileName);
                            
                            return (
                            <div
                              key={index}
                                className='border rounded-lg overflow-hidden hover:shadow-md transition-shadow'
                              >
                                {isImage ? (
                                  <a
                                    href={fileUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='block'
                                  >
                                    <div className='relative w-full aspect-video bg-secondary'>
                                      <img
                                        src={fileUrl}
                                        alt={decodedFileName}
                                        className='w-full h-full object-cover'
                                        onError={(e) => {
                                          // Fallback if image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = `
                                              <div class='flex items-center justify-center h-full'>
                                                <div class='text-center p-2'>
                                                  <svg class='w-8 h-8 mx-auto mb-1 text-muted-foreground' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                                    <path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' />
                                                  </svg>
                                                  <p class='text-xs text-muted-foreground'>Preview unavailable</p>
                                </div>
                              </div>
                                            `;
                                          }
                                        }}
                                      />
                            </div>
                                    <div className='p-2 bg-background border-t'>
                                      <p className='text-xs font-medium truncate' title={decodedFileName}>
                                        {decodedFileName}
                                      </p>
                                      <p className='text-xs text-muted-foreground mt-1'>Click to view full size</p>
                                    </div>
                                  </a>
                                ) : (
                                  <a
                                    href={fileUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='block p-4 bg-secondary hover:bg-secondary/80 transition-colors'
                                  >
                                    <div className='flex items-center gap-3'>
                                      <FileText className='w-8 h-8 text-muted-foreground flex-shrink-0' />
                                      <div className='flex-1 min-w-0'>
                                        <p className='text-xs font-medium truncate' title={decodedFileName}>
                                          {decodedFileName}
                                        </p>
                                        <p className='text-xs text-muted-foreground mt-1'>Click to download</p>
                                      </div>
                                    </div>
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className='text-center py-4 text-muted-foreground'>
                        <FileText className='w-8 h-8 mx-auto mb-2 opacity-50' />
                        <p className='text-xs'>No attachments uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Vendor Information */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Vendor Information
                    </h4>

                    {/* First Row - Vendor Name, Contact, Payment Method */}
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Vendor Name</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.vendorName || 'N/A'}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Vendor Contact</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.vendorContact || 'N/A'}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Payment Method</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.paymentMethod.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                    </div>

                    {/* Second Row - Payment Reference and Vendor Address */}
                    <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Payment Reference</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.paymentReference || 'N/A'}
                        </div>
                      </div>

                      <div className='space-y-1 md:col-span-2'>
                        <Label className='text-xs font-medium'>Vendor Address</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                          {viewingExpense.vendorAddress || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Additional Notes
                    </h4>

                    <div className='space-y-1'>
                      <div className='min-h-[40px] px-2 py-1 bg-secondary text-xs border border-input rounded-[5px] flex items-center'>
                        {viewingExpense.notes || 'N/A'}
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Submitted By</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-center font-semibold text-xs border border-input rounded-[5px] flex items-center justify-center'>
                          {viewingExpense.submittedBy || 'System User'}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Date</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-center font-semibold text-xs border border-input rounded-[5px] flex items-center justify-center'>
                          {viewingExpense.createdAt ? formatDateDisplay(viewingExpense.createdAt) : formatDateToString(new Date())}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Upload className='w-5 h-5 text-primary' />
              Export Expenses to CSV
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
                    setExportDateRange((prev) => ({
                      ...prev,
                      from: e.target.value,
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
                    setExportDateRange((prev) => ({
                      ...prev,
                      to: e.target.value,
                    }));
                    setSelectedExportPreset('');
                  }}
                  className='w-full'
                />
                    </div>

              <div className='text-xs text-muted-foreground'>
                Select dates for filtered export, or use "All Data" for complete
                export. Current filters (category, vehicle, date range) will be applied.
                    </div>

              {/* Quick preset buttons */}
              <div className='pt-2 border-t space-y-2'>
                <div className='text-xs font-medium text-muted-foreground'>
                  Quick Presets:
                      </div>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // All Data - clear both dates
                      setExportDateRange({
                        from: '',
                        to: '',
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
                      // This Month
                      const now = new Date();
                      const firstDay = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                      );
                      const lastDay = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                      );

                      setExportDateRange({
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0],
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
                      // Last Month
                      const now = new Date();
                      const firstDayLastMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1
                      );
                      const lastDayLastMonth = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        0
                      );

                      setExportDateRange({
                        from: firstDayLastMonth.toISOString().split('T')[0],
                        to: lastDayLastMonth.toISOString().split('T')[0],
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
                      // Last 3 Months
                      const now = new Date();
                      const threeMonthsAgo = new Date(
                        now.getFullYear(),
                        now.getMonth() - 3,
                        1
                      );
                      const lastDay = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                      );

                      setExportDateRange({
                        from: threeMonthsAgo.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0],
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
                      // This Year
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), 0, 1);
                      const lastDay = new Date(now.getFullYear(), 11, 31);

                      setExportDateRange({
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0],
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
                onClick={exportToXLSX}
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