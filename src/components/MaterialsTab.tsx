import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  List,
  Table,
  Eye,
  Package,
  FileText,
  Building2,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  WifiOff,
  Download,
  Upload,
  RefreshCcw,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription } from './ui/alert';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { AddMaterialForm } from './AddMaterialForm';
import { UnifiedTabSearch } from './UnifiedTabSearch';
import { useRole } from '../contexts/RoleContext';
import { materialsApi } from '../lib/api/materials';
import { Material, MaterialCategory, Unit } from '../lib/api/types';
import { getMaterialCategories, getUnits } from '../lib/api/common';
import { branchesApi } from '../lib/api/branches';
import { Branch } from '../lib/api/types';
import { toast } from '../hooks/use-toast';

type SortField =
  | 'name'
  | 'specifications'
  | 'currentStock'
  | 'makerBrand'
  | 'createdAt'
  | 'averagePrice'
  | 'totalValue'
  | 'stockStatus';
type SortOrder = 'ASC' | 'DESC';

export const MaterialsTab = () => {
  const { currentUser, hasPermission } = useRole();
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
    null
  );

  // Sorting state - Modified to show newly added materials at the top
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

  // API state management - updated to match MachinesTab structure
  const [materials, setMaterials] = useState<Material[]>([]);
  const [sortedMaterials, setSortedMaterials] = useState<Material[]>([]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [materialsData, setMaterialsData] = useState<{
    data?: unknown;
    meta?: {
      page: number;
      limit: number;
      itemCount: number;
      pageCount: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  } | null>(null);

  // Add state for material categories
  const [materialCategories, setMaterialCategories] = useState<MaterialCategory[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch materials from API
  const fetchMaterials = async (page = 1, limit = 10, customSortField?: SortField, customSortOrder?: SortOrder) => {
    try {
      setLoading(true);
      setError(null);

      // Use custom sort values if provided, otherwise use state values
      const activeSortField = customSortField || sortField;
      const activeSortOrder = customSortOrder || sortOrder;

      // Only include API-supported sort fields in the request
      const apiSupportedFields = ['name', 'specifications', 'currentStock', 'makerBrand', 'createdAt'];
      const shouldIncludeSort = apiSupportedFields.includes(activeSortField);

      const params: any = {
        page: page,
        limit: limit,
        // Filter by branch for company owner (when unit filter is selected)
        ...(filterUnit !== 'all' &&
          currentUser?.role === 'company_owner' && {
            branchId: filterUnit,
          }),
        // Filter by supervisor's/inventory_manager's own branch
        ...((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id && {
          branchId: currentUser.branch.id,
        }),
      };

      // Only add sort params if the field is API-supported
      if (shouldIncludeSort) {
        params.sortBy = activeSortField;
        params.sortOrder = activeSortOrder;
      }

      const response = await materialsApi.getMaterials(params);
      setMaterialsData(response);
      setMaterials(response.data);
      
      // If sorting by frontend-only fields, apply sorting immediately
      if (!shouldIncludeSort && (activeSortField === 'averagePrice' || activeSortField === 'totalValue' || activeSortField === 'stockStatus')) {
        const sorted = sortMaterials(response.data, activeSortField, activeSortOrder);
        setSortedMaterials(sorted);
      } else {
        setSortedMaterials(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching materials:', err);
      
      // Enhanced error handling
      let errorMessage = 'Failed to load materials. Please try again.';
      
      if (err.response) {
        // Server responded with error status
        const status = err.response.status;
        const data = err.response.data;
        
        console.error('API Error Response:', {
          status,
          data,
          url: err.config?.url,
          method: err.config?.method
        });
        
        if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to access materials.';
        } else if (status === 404) {
          errorMessage = 'Materials endpoint not found.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data?.message) {
          errorMessage = data.message;
        } else {
          errorMessage = `Request failed with status ${status}`;
        }
      } else if (err.request) {
        // Request was made but no response received
        console.error('Network Error:', err.request);
        errorMessage = 'Please Try Again';
      } else {
        // Something else happened
        console.error('Unexpected Error:', err.message);
        errorMessage = err.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchMaterials(currentPage, itemsPerPage, sortField, sortOrder);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fetch branches for filtering (only for company owners)
  const fetchBranches = async () => {
    if (currentUser?.role !== 'company_owner') return;

    try {
      setIsLoadingBranches(true);
      const response = await branchesApi.getAll({ limit: 100 });
      setAvailableBranches(response.data);
    } catch (err: any) {
      console.error('Error fetching branches:', err);
      
      // Enhanced error handling
      let errorMessage = 'Failed to load branches. Please try again.';
      
      if (err.response) {
        const status = err.response.status;
        const data = err.response.data;
        
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
      } else if (err.request) {
        errorMessage = 'Please Try Again';
      } else {
        errorMessage = err.message || 'An unexpected error occurred.';
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

  // Fetch units for measure unit display
  const fetchUnits = async () => {
    try {
      const response = await getUnits({ limit: 100 });
      setUnits(response.data || []);
    } catch (err) {
      console.error('Error fetching units:', err);
    }
  };

  // Fetch material categories
  const fetchMaterialCategories = async () => {
    try {
      const response = await getMaterialCategories({ limit: 100 });
      setMaterialCategories(response.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // Get unit name by ID
  const getUnitName = (measureUnitId?: number) => {
    if (!measureUnitId) {
      return '';
    }
    const unit = units.find(u => u.id === measureUnitId);
    return unit?.name || '';
  };

  // Get category name by ID
  const getCategoryName = (categoryId?: number) => {
    if (!categoryId) return '';
    const category = materialCategories.find(cat => cat.id === categoryId);
    return category?.name || '';
  };

  // Remove the calculateAveragePrice function and replace with this:
  const getAveragePrice = (material: Material) => {
    // Use averageValue from API if available, otherwise fallback to calculation
    if (material.averageValue !== undefined && material.averageValue !== null) {
      return material.averageValue.toFixed(2);
    }
    
    // Fallback calculation if averageValue is not provided
    const totalValue = material.totalValue || 0;
    const currentStock = material.currentStock || 0;
    
    if (currentStock === 0) return '0.00';
    return (totalValue / currentStock).toFixed(2);
  };

  // Frontend sorting function
  const sortMaterials = (materials: Material[], field: SortField, order: SortOrder): Material[] => {
    return [...materials].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'averagePrice':
          aValue = parseFloat(getAveragePrice(a)) || 0;
          bValue = parseFloat(getAveragePrice(b)) || 0;
          break;
        case 'totalValue':
          aValue = Number(a.totalValue) || 0;
          bValue = Number(b.totalValue) || 0;
          break;
        case 'stockStatus':
          const aStatus = getStockStatus(a.currentStock, a.minStockLevel);
          const bStatus = getStockStatus(b.currentStock, b.minStockLevel);
          // Define status priority: In Stock = 0, Low Stock = 1, Out of Stock = 2
          const statusPriority = { 'In Stock': 0, 'Low Stock': 1, 'Out of Stock': 2 };
          aValue = statusPriority[aStatus as keyof typeof statusPriority] ?? 3;
          bValue = statusPriority[bStatus as keyof typeof statusPriority] ?? 3;
          break;
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'specifications':
          aValue = a.specifications?.toLowerCase() || '';
          bValue = b.specifications?.toLowerCase() || '';
          break;
        case 'currentStock':
          aValue = a.currentStock || 0;
          bValue = b.currentStock || 0;
          break;
        case 'makerBrand':
          aValue = a.makerBrand?.toLowerCase() || '';
          bValue = b.makerBrand?.toLowerCase() || '';
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return order === 'ASC' ? -1 : 1;
      if (aValue > bValue) return order === 'ASC' ? 1 : -1;
      return 0;
    });
  };

  // Handle column sorting
  const handleSort = (field: SortField) => {
    let newSortField = field;
    let newSortOrder = sortOrder;

    if (sortField === field) {
      // Toggle sort order if same field
      newSortOrder = sortOrder === 'ASC' ? 'DESC' : 'ASC';
    } else {
      // Set new field with ascending order
      newSortOrder = 'ASC';
    }

    setSortField(newSortField);
    setSortOrder(newSortOrder);

    // For frontend-only sorting fields, sort immediately without API call
    if (field === 'averagePrice' || field === 'totalValue' || field === 'stockStatus') {
      const sorted = sortMaterials(materials, newSortField, newSortOrder);
      setSortedMaterials(sorted);
    } else {
      // For API-supported fields, trigger API call with new sort params
      fetchMaterials(currentPage, itemsPerPage, newSortField, newSortOrder);
    }
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

  const toggleRowExpansion = (id: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  // Helper function to format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Handle material view
  const handleMaterialView = (material: Material) => {
    setSelectedMaterial(material);
    setIsViewOpen(true);
  };

  // Initial data fetch
  useEffect(() => {
    fetchMaterials();
    fetchBranches();
    fetchUnits();
    fetchMaterialCategories(); // Add this
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Refetch when filter changes (but not for search - search is frontend only)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMaterials(1, itemsPerPage);
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUnit, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterUnit]);

  // Load materials when pagination changes
  useEffect(() => {
    fetchMaterials(currentPage, itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Apply frontend sorting when materials change and we're using frontend sort fields
  useEffect(() => {
    if (sortField === 'averagePrice' || sortField === 'totalValue' || sortField === 'stockStatus') {
      // Apply frontend sorting
      const sorted = sortMaterials(materials, sortField, sortOrder);
      setSortedMaterials(sorted);
    } else {
      // Just use materials as-is (API already sorted them)
      setSortedMaterials(materials);
    }
  }, [materials, sortField, sortOrder]);

  const handleAddMaterial = (materialData: Material) => {
    // Refresh the materials list after adding
    fetchMaterials(currentPage, itemsPerPage);
  };

  const getStockStatus = (currentStock: number, minStockLevel: number) => {
    if (currentStock === 0) return 'Out of Stock';
    if (currentStock <= minStockLevel) return 'Low Stock';
    return 'In Stock';
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      'In Stock':
        'bg-green-500 text-white border-green-600 hover:bg-green-500 hover:text-white',
      'Low Stock':
        'bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-500 hover:text-white',
      'Out of Stock':
        'bg-red-500 text-white border-red-600 hover:bg-red-500 hover:text-white',
    };
    return (
      badges[status as keyof typeof badges] ||
      'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white'
    );
  };

  const handleMaterialClick = (material: Material) => {
    handleMaterialView(material);
  };

  const handleViewClose = () => {
    setIsViewOpen(false);
    setSelectedMaterial(null);
  };

  // Apply frontend search filtering to sorted materials
  const displayMaterials = sortedMaterials.filter((material) => {
    // Search filtering - search across all columns including calculated ones
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      const stockStatus = getStockStatus(material.currentStock, material.minStockLevel);
      const avgPrice = getAveragePrice(material);
      
      return (
        material.name?.toLowerCase().includes(searchLower) ||
        material.specifications?.toLowerCase().includes(searchLower) ||
        material.makerBrand?.toLowerCase().includes(searchLower) ||
        material.measureUnit?.name?.toLowerCase().includes(searchLower) ||
        material.currentStock?.toString().includes(searchLower) ||
        material.minStockLevel?.toString().includes(searchLower) ||
        avgPrice.includes(searchLower) ||
        material.totalValue?.toString().includes(searchLower) ||
        stockStatus.toLowerCase().includes(searchLower) ||
        material.additionalNotes?.toLowerCase().includes(searchLower) ||
        getCategoryName(material.categoryId)?.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Export functionality
  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all materials with pagination (API limit is 100)
      let allMaterials: Material[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const limit = 100; // API limit

      while (hasMorePages) {
        const response = await materialsApi.getMaterials({
          page: currentPage,
          limit: limit,
          sortBy: sortField,
          sortOrder: sortOrder,
          ...(filterUnit !== 'all' &&
            currentUser?.role === 'company_owner' && {
              branchId: filterUnit,
            }),
          // Filter by supervisor's/inventory_manager's own branch
          ...((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id && {
            branchId: currentUser.branch.id,
          }),
        });

        allMaterials = [...allMaterials, ...response.data];
        
        // Check if there are more pages
        hasMorePages = response.meta?.hasNextPage || false;
        currentPage++;
        
        // Safety check to prevent infinite loops
        if (currentPage > 1000) {
          console.warn('Export stopped at page 1000 to prevent infinite loop');
          break;
        }
      }
      
      // Prepare CSV headers
      const headers = [
        'Material Name',
        'Specifications',
        'Model/Version',
        'Measure Unit',
        'Current Stock',
        'Min Stock Level',
        'Average Price (₹)',
        'Total Value (₹)',
        'Stock Status',
        'Created Date',
        'Additional Notes'
      ];

      // Prepare CSV data - export all data from API (no frontend search filter applied)
      const csvData = allMaterials.map((material) => {
        const stockStatus = getStockStatus(material.currentStock, material.minStockLevel);
        return [
          `"${material.name || ''}"`,
          `"${material.specifications || ''}"`,
          `"${material.makerBrand || ''}"`,
          `"${material.measureUnit?.name || ''}"`,
          material.currentStock || 0,
          material.minStockLevel || 0,
          getAveragePrice(material),
          material.totalValue || 0,
          `"${stockStatus}"`,
          `"${formatDate(material.createdAt)}"`,
          `"${material.additionalNotes || ''}"`
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `materials_export_${currentDate}.csv`;
      link.setAttribute('download', filename);
      
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Export Successful',
        description: `Materials data exported successfully. ${allMaterials.length} records downloaded.`,
        variant: 'default',
      });

    } catch (error) {
      console.error('Error exporting materials:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export materials data. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading && sortedMaterials.length === 0) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='flex items-center gap-3'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
          <span className='text-muted-foreground'>Loading materials...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className='rounded-lg shadow-sm p-8 text-center'>
        <div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4'>
          <RefreshCcw className='w-6 h-6 text-red-600' />
        </div>
        <h3 className='text-lg font-semibold text-foreground mb-2'>
          No Data Found, Reload Data
        </h3>
        <p className='text-muted-foreground mb-4'>{error}</p>
        <Button onClick={() => fetchMaterials()} className='btn-primary'>
        <RefreshCcw className='w-4 h-4 mr-2' />
        Reload
        </Button>
      </Card>
    );
  }

  return (
    <div className='space-y-4 sm:space-y-6'>
      {/* Network Status Alert */}
      {!isOnline && (
        <Alert className="border-red-200 bg-red-50 text-red-800">
          <WifiOff className="h-4 w-4" />
          <AlertDescription>
            You are currently offline. Some features may not work properly. Please check your internet connection.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Header with Actions */}
      <UnifiedTabSearch
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder='Search materials, specifications, model/version...'
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showViewToggle={true}
        filterUnit={filterUnit}
        onFilterUnitChange={setFilterUnit}
        availableBranches={availableBranches}
        isLoadingBranches={isLoadingBranches}
        onExport={exportToCSV}
        isExporting={isExporting}
        showExport={true}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        showRefresh={true}
        onAdd={() => setIsAddMaterialOpen(true)}
        addLabel='Add New Material'
        showAddButton={currentUser?.role !== 'company_owner'}
        isOnline={isOnline}
      />

      {/* Loading indicator for subsequent loads */}
      {loading && displayMaterials.length > 0 && (
        <div className='flex items-center justify-center p-4'>
          <Loader2 className='w-5 h-5 animate-spin text-primary' />
        </div>
      )}

      {/* Content */}
      {viewMode === 'list' ? (
        // List View for Materials - Matching MaterialIssuesTab structure
        <Card className='rounded-lg shadow-sm'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <TableComponent>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='w-12'></TableHead>
                    <TableHead className='w-48 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('name')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Material Name
                        {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-36 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('makerBrand')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Model/Version
                        {getSortIcon('makerBrand')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-64 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('specifications')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Specifications
                        {getSortIcon('specifications')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('currentStock')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Current Stock
                        {getSortIcon('currentStock')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-40 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('averagePrice')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Avg.Purchased Price (₹)
                        {getSortIcon('averagePrice')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('totalValue')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Total Value (₹)
                        {getSortIcon('totalValue')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('stockStatus')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Stock Indicator
                        {getSortIcon('stockStatus')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayMaterials.map((material) => {
                    const stockStatus = getStockStatus(
                      material.currentStock,
                      material.minStockLevel
                    );
                    return (
                      <TableRow
                        key={material.id}
                        className='hover:bg-muted/30 border-b border-secondary/20 cursor-pointer'
                        onClick={() => handleMaterialClick(material)}
                      >
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0'
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpansion(material.id.toString());
                            }}
                          >
                            {expandedRows.has(material.id.toString()) ? (
                              <ChevronDown className='w-4 h-4' />
                            ) : (
                              <ChevronRight className='w-4 h-4' />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className='font-medium'>
                          <span className='font-medium text-foreground hover:text-primary transition-colors'>
                            {material.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className='text-sm text-muted-foreground'>
                            {material.makerBrand}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='text-sm text-muted-foreground truncate max-w-40'>
                            {material.specifications}
                          </div>
                        </TableCell>
                        <TableCell className='text-sm'>
                          <div className='font-semibold text-foreground'>
                            {material.currentStock} {material.measureUnit?.name || 'units'}
                          </div>
                        </TableCell>
                        <TableCell className='text-sm'>
                          <div className='font-semibold text-foreground'>
                            ₹{getAveragePrice(material)}
                          </div>
                        </TableCell>
                        <TableCell className='text-sm'>
                          <div className='font-semibold text-foreground'>
                            ₹{Number(material.totalValue || 0).toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(stockStatus)}>
                            {stockStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </TableComponent>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className='rounded-lg shadow-sm'>
          <CardContent className='p-0'>
            <div className='overflow-x-auto'>
              <TableComponent>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='w-48 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('name')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Material
                        {getSortIcon('name')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-36 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('makerBrand')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Model/Version
                        {getSortIcon('makerBrand')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-64 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('specifications')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Specifications
                        {getSortIcon('specifications')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('currentStock')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Current Stock
                        {getSortIcon('currentStock')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-40 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('averagePrice')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Avg.Purchased Price (₹)
                        {getSortIcon('averagePrice')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('totalValue')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Total Value (₹)
                        {getSortIcon('totalValue')}
                      </Button>
                    </TableHead>
                    <TableHead className='w-32 text-foreground font-semibold'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('stockStatus')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Stock Indicator
                        {getSortIcon('stockStatus')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayMaterials.map((material) => {
                    const stockStatus = getStockStatus(
                      material.currentStock,
                      material.minStockLevel
                    );
                    return (
                      <TableRow
                        key={material.id}
                        className='hover:bg-muted/30 border-b border-secondary/20 cursor-pointer'
                        onClick={() => handleMaterialClick(material)}
                      >
                        <TableCell className='font-semibold text-foreground'>
                          <span className='font-semibold text-foreground hover:text-primary transition-colors'>
                            {material.name}
                          </span>
                        </TableCell>
                        <TableCell className='text-muted-foreground truncate max-w-32 hover:text-primary transition-colors'>
                          {material.makerBrand}
                        </TableCell>
                        <TableCell className='text-muted-foreground max-w-xs truncate hover:text-primary transition-colors'>
                          {material.specifications}
                        </TableCell>
                        <TableCell className='font-semibold text-foreground'>
                          {material.currentStock} {material.measureUnit?.name || 'units'}
                        </TableCell>
                        <TableCell className='font-semibold text-foreground'>
                          ₹{getAveragePrice(material)}
                        </TableCell>
                        <TableCell className='font-semibold text-foreground'>
                          ₹{Number(material.totalValue || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadge(stockStatus)}>
                            {stockStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </TableComponent>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {displayMaterials.length === 0 && !loading && (
        <Card className='rounded-lg shadow-sm p-8 text-center'>
          <div className='w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4'>
            <Package className='w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground' />
          </div>
          <h3 className='text-base sm:text-lg font-semibold text-foreground mb-2'>
            No materials found
          </h3>
          <p className='text-sm sm:text-base text-muted-foreground mb-4'>
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Start by adding your first material'}
          </p>
          <Button variant='outline' onClick={() => fetchMaterials()}>
            <RefreshCcw className='w-4 h-4 mr-2' />
            Reload
          </Button>
        </Card>
      )}

      {/* Search Results Info - Show when searching */}
      {searchQuery.trim() && !loading && (
        <div className='text-sm text-muted-foreground text-center py-2'>
          {displayMaterials.length > 0 ? (
            <>Showing {displayMaterials.length} material{displayMaterials.length !== 1 ? 's' : ''} matching "{searchQuery}"</>
          ) : (
            <>No materials found matching "{searchQuery}"</>
          )}
        </div>
      )}

      {/* Pagination - Updated to match MachinesTab - Hide when searching */}
      {materialsData && materialsData.meta && !searchQuery.trim() && (
        <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
          {/* Page Info */}
          <div className='text-xs sm:text-sm text-muted-foreground'>
            Showing{' '}
            {(materialsData.meta.page - 1) * materialsData.meta.limit + 1} to{' '}
            {Math.min(
              materialsData.meta.page * materialsData.meta.limit,
              materialsData.meta.itemCount
            )}{' '}
            of {materialsData.meta.itemCount} entries
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
                  fetchMaterials(1, newLimit);
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
                  fetchMaterials(1, itemsPerPage);
                }}
                disabled={
                  !materialsData.meta.hasPreviousPage ||
                  materialsData.meta.page === 1
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
                  fetchMaterials(currentPage - 1, itemsPerPage);
                }}
                disabled={!materialsData.meta.hasPreviousPage}
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>

              {/* Page numbers - Show up to 6 pages */}
              <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                {Array.from(
                  { length: Math.min(6, materialsData.meta.pageCount) },
                  (_, i) => {
                    let pageNum;
                    
                    if (materialsData.meta.pageCount <= 6) {
                      pageNum = i + 1;
                    } else if (materialsData.meta.page <= 3) {
                      pageNum = i + 1;
                    } else if (
                      materialsData.meta.page >=
                      materialsData.meta.pageCount - 2
                    ) {
                      pageNum = materialsData.meta.pageCount - 5 + i;
                    } else {
                      pageNum = materialsData.meta.page - 3 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          materialsData.meta.page === pageNum
                            ? 'default'
                            : 'outline'
                        }
                        size='sm'
                        onClick={() => {
                          setCurrentPage(pageNum);
                          fetchMaterials(pageNum, itemsPerPage);
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
                  fetchMaterials(currentPage + 1, itemsPerPage);
                }}
                disabled={!materialsData.meta.hasNextPage}
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>

              {/* Last page button */}
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage(materialsData.meta.pageCount);
                  fetchMaterials(materialsData.meta.pageCount, itemsPerPage);
                }}
                disabled={
                  !materialsData.meta.hasNextPage ||
                  materialsData.meta.page === materialsData.meta.pageCount
                }
                className='h-7 w-7 sm:h-8 sm:w-8 p-0'
              >
                <ChevronsRight className='w-3 h-3 sm:w-4 sm:h-4' />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Form */}
      <AddMaterialForm
        isOpen={isAddMaterialOpen}
        onClose={() => setIsAddMaterialOpen(false)}
        onSubmit={handleAddMaterial}
      />

      {/* View Material Dialog */}
      <Dialog open={isViewOpen} onOpenChange={handleViewClose}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='flex flex-row items-center justify-between'>
            <DialogTitle className='text-xl font-semibold'>
             View Material Details
            </DialogTitle>
          </DialogHeader>

          {selectedMaterial && (
            <div className='space-y-6 py-4'>
              {/* Material Information Section */}
              <div className='space-y-4'>
                {/* First Row */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>
                      Material Name
                    </Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm font-medium'>
                      {selectedMaterial.name}
                    </div>
                  </div>

                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>
                      Specifications
                    </Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm'>
                      {selectedMaterial.specifications}
                    </div>
                  </div>
                </div>

                {/* Second Row */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>
                      Measure Unit
                    </Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm'>
                      {selectedMaterial.measureUnit?.name || 'Not specified'}
                    </div>
                  </div>

                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>Model/Version</Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm'>
                      {selectedMaterial.makerBrand || 'Not specified'}
                  </div>
                </div>

                </div>

                {/* Third Row - Stock Status and Created Date */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>
                      Stock Status
                    </Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] flex items-center'>
                      <Badge className={getStatusBadge(getStockStatus(selectedMaterial.currentStock, selectedMaterial.minStockLevel))}>
                        {getStockStatus(selectedMaterial.currentStock, selectedMaterial.minStockLevel)}
                      </Badge>
                    </div>
                  </div>

                  <div className='space-y-1'>
                    <Label className='text-sm font-medium'>
                      Created Date
                    </Label>
                    <div className='h-9 px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm'>
                      {formatDate(selectedMaterial.createdAt)}
                    </div>
                  </div>
                </div>

               

                {/* Additional Notes */}
                <div className='space-y-1'>
                  <Label className='text-sm font-medium'>
                    Additional Notes
                  </Label>
                  <div className='min-h-[60px] px-3 py-2 bg-muted/50 border border-input rounded-[5px] text-sm'>
                    {selectedMaterial.additionalNotes || 'No additional notes'}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className='flex justify-end space-x-2 pt-4 border-t'>
                <Button type='button' variant='outline' onClick={handleViewClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
