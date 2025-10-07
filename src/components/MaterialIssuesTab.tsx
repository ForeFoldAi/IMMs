import { useState, useEffect } from 'react';
import { MaterialIssue, MaterialIssueItem } from '../lib/api/types';
import { materialIssuesApi } from '../lib/api/material-issues';
import {
  Plus,
  Search,
  List,
  Table,
  Edit,
  Eye,
  Package,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  FileText,
  Building2,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  WifiOff,
  Download,
  Upload,
} from 'lucide-react';
import { formatDateToDDMMYYYY } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  Table as TableComponent,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { MaterialIssueForm } from './MaterialIssueForm';
import { toast } from '../hooks/use-toast';
import { useRole } from '../contexts/RoleContext';
import { Label } from './ui/label';
import { branchesApi } from '../lib/api/branches';
import { Branch } from '../lib/api/types';
import { Alert, AlertDescription } from './ui/alert';

type SortField =
  | 'id'
  | 'issueDate'
  | 'issuedBy'
  | 'branch'
  | 'uniqueId'
  | 'materialName'
  | 'specifications'
  | 'stockInfo'
  | 'issuedFor'
  | 'issuedTo'
  | 'purpose';
type SortOrder = 'ASC' | 'DESC';

export const MaterialIssuesTab = () => {
  const { currentUser, hasPermission } = useRole();
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isIssueFormOpen, setIsIssueFormOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<TransformedIssue | null>(
    null
  );
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<TransformedIssue | null>(
    null
  );

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC'); // Use ID DESC to show newest first

  // Helper function to format date as dd-mm-yyyy
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Define interface for transformed issue data
  interface TransformedIssueItem {
    materialId: number;
    materialName: string;
    specifications: string;
    makerBrand: string;
    existingStock: number;
    issuedQuantity: number;
    stockAfterIssue: number;
    recipientName: string;
    purpose: string;
    imagePath?: string;
    machineId: number;
    machineName: string;
    unitName: string;
    originalItem: MaterialIssueItem;
  }

  interface TransformedIssue {
    id: string;
    materialIssueFormSrNo: string;
    issuingPersonName: string;
    issuingPersonDesignation: string;
    issuedDate: string;
    status: string;
    unit: string;
    unitName: string;
    branchId?: number;
    branchLocation?: string;
    additionalNotes?: string;
    items: TransformedIssueItem[];
    originalIssue: MaterialIssue;
  }

  // API state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialIssues, setMaterialIssues] = useState<MaterialIssue[]>([]);
  const [sortedIssues, setSortedIssues] = useState<TransformedIssue[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [materialIssuesData, setMaterialIssuesData] = useState<{
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

  // Available branches (units) for company owner - fetched from API
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [exportDateRange, setExportDateRange] = useState({
    from: '',
    to: '',
  });

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
          errorMessage = 'Network error. Please check your internet connection.';
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

  // Frontend sorting function for transformed issues
  const sortIssues = (issues: TransformedIssue[], field: SortField, order: SortOrder): TransformedIssue[] => {
    return [...issues].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (field) {
        case 'id':
        case 'uniqueId':
          aValue = parseInt(a.id) || 0;
          bValue = parseInt(b.id) || 0;
          break;
        case 'issueDate':
          aValue = new Date(a.issuedDate).getTime();
          bValue = new Date(b.issuedDate).getTime();
          break;
        case 'issuedBy':
          aValue = a.issuingPersonName?.toLowerCase() || '';
          bValue = b.issuingPersonName?.toLowerCase() || '';
          break;
        case 'branch':
          aValue = a.unitName?.toLowerCase() || '';
          bValue = b.unitName?.toLowerCase() || '';
          break;
        case 'materialName':
          // Sort by first item's material name
          aValue = a.items[0]?.materialName?.toLowerCase() || '';
          bValue = b.items[0]?.materialName?.toLowerCase() || '';
          break;
        case 'specifications':
          // Sort by first item's specifications
          aValue = a.items[0]?.specifications?.toLowerCase() || '';
          bValue = b.items[0]?.specifications?.toLowerCase() || '';
          break;
        case 'stockInfo':
          // Sort by first item's issued quantity
          aValue = a.items[0]?.issuedQuantity || 0;
          bValue = b.items[0]?.issuedQuantity || 0;
          break;
        case 'issuedFor':
          // Sort by first item's machine name
          aValue = a.items[0]?.machineName?.toLowerCase() || '';
          bValue = b.items[0]?.machineName?.toLowerCase() || '';
          break;
        case 'issuedTo':
          // Sort by first item's recipient name
          aValue = a.items[0]?.recipientName?.toLowerCase() || '';
          bValue = b.items[0]?.recipientName?.toLowerCase() || '';
          break;
        case 'purpose':
          // Sort by first item's purpose
          aValue = a.items[0]?.purpose?.toLowerCase() || '';
          bValue = b.items[0]?.purpose?.toLowerCase() || '';
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
      // Set new field with descending order for ID (to show newest first)
      newSortOrder = field === 'id' || field === 'uniqueId' ? 'DESC' : 'ASC';
    }

    setSortField(field);
    setSortOrder(newSortOrder);

    // Apply frontend sorting immediately
    console.log('Frontend sorting by:', field, 'Order:', newSortOrder);
    const sorted = sortIssues(issuedMaterials, field, newSortOrder);
    setSortedIssues(sorted);
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

  // Transform API response to UI format
  const transformApiIssueToUiFormat = (
    issue: MaterialIssue
  ): TransformedIssue => {

    // Transform each item in the issue
    const transformedItems = issue.items.map((item) => {
      // Debug logging to see what's actually in the material data
      console.log('Material data for debugging:', {
        materialId: item.material.id,
        materialName: item.material.name,
        measureUnit: item.material.measureUnit,
        hasMeasureUnit: !!item.material.measureUnit,
        measureUnitName: item.material.measureUnit?.name
      });

      return {
        materialId: item.material.id,
        materialName: item.material.name,
        specifications: item.material.specifications || '',
        makerBrand: item.material.makerBrand || '',
        existingStock: item.stockBeforeIssue,
        issuedQuantity: item.issuedQuantity,
        stockAfterIssue: item.stockAfterIssue,
        recipientName: item.receiverName,
        purpose: item.purpose,
        imagePath: item.imagePath,
        // Updated to handle the new issuedFor structure
        machineId: item.issuedFor?.id || 0,
        machineName: item.issuedFor?.name || 'others',
        // Add unit information from material
        unitName: item.material.measureUnit?.name || 'units',
        originalItem: item,
      };
    });


    // Create a transformed issue with all items
    const transformedIssue = {
      id: issue.uniqueId.toString(),
      materialIssueFormSrNo: issue.uniqueId.toString(),
      issuingPersonName:
        issue.issuedBy?.name || `User ID: ${issue.issuedBy?.id || 'Unknown'}`,
      issuingPersonDesignation: issue.issuedBy?.email || '',
      issuedDate: issue.issueDate,
      status: 'Issued',
      unit: issue.branch?.code || '',
      unitName: issue.branch?.name || '',
      branchId: issue.branch?.id,
      branchLocation: issue.branch?.location || '',
      additionalNotes: issue.additionalNotes || '',
      items: transformedItems,
      originalIssue: issue,
    };

    return transformedIssue;
  };

  // Generate formatted Issue ID: SSRFM/UNIT1/I-YYMMDD/SQ
  const generateFormattedIssueId = (issue: MaterialIssue): string => {
    const date = new Date(issue.issueDate);

    // Format date as YYMMDD
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Get unit number (keep as numeric)
    const unitNumber = issue.branch?.id || 1;

    // Generate sequence number (using issue ID as sequence)
    const sequence = issue.id.toString().padStart(2, '0');

    // Format: SSRFM/UNIT1/I-YYMMDD/SQ
    return `SSRFM/UNIT${unitNumber}/I-${dateStr}/${sequence}`;
  };

  // Convert number to Roman numeral (kept for backward compatibility if needed)
  const convertToRoman = (num: number): string => {
    const romanNumerals = [
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' },
    ];

    let result = '';
    for (const { value, numeral } of romanNumerals) {
      while (num >= value) {
        result += numeral;
        num -= value;
      }
    }
    return result;
  };

  // Add the missing fetchMaterialIssues function
  const fetchMaterialIssues = async (page = 1, limit = itemsPerPage) => {
    setIsLoading(true);
    setError(null);

    try {
      const params: any = {
        page,
        limit,
        // Remove API sorting - we'll sort on frontend
        include: 'items.material.measureUnit,items.issuedFor,branch,issuedBy', // Include related data
      };

      // Add search if provided
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      // Add unit filter for company owner
      if (currentUser?.role === 'company_owner' && filterUnit !== 'all') {
        params.branchId = filterUnit;
      }

      // Debug logging
      console.log('MaterialIssues API call params:', params);
      console.log(
        'Current filters - Unit:',
        filterUnit,
        'Search:',
        searchQuery
      );

      const response = await materialIssuesApi.getAll(params);

      // Debug logging to see what the API is returning
      console.log('API Response:', response);
      console.log('First issue data:', response.data[0]);
      if (response.data[0]?.items?.[0]) {
        console.log('First item material data:', response.data[0].items[0].material);
      }

      setMaterialIssues(response.data);
      setMaterialIssuesData(response);

      // Transform the data for UI display
      const transformedIssues = response.data.map(transformApiIssueToUiFormat);
      setIssuedMaterials(transformedIssues);
      
      // Apply current sorting to the transformed issues
      const sorted = sortIssues(transformedIssues, sortField, sortOrder);
      setSortedIssues(sorted);
    } catch (err: any) {
      console.error('Error fetching material issues:', err);
      
      // Enhanced error handling
      let errorMessage = 'Failed to load material issues. Please try again.';
      
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
          errorMessage = 'You do not have permission to access material issues.';
        } else if (status === 404) {
          errorMessage = 'Material issues endpoint not found.';
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
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        // Something else happened
        console.error('Unexpected Error:', err.message);
        errorMessage = err.message || 'An unexpected error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Load material issues on component mount
  useEffect(() => {
    // Ensure we start with newest items first (by ID)
    setSortField('id');
    setSortOrder('DESC');
    fetchMaterialIssues(); // Use default parameters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when search or filter changes (not sorting - that's frontend only)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMaterialIssues(1, itemsPerPage);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, filterUnit, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterUnit, searchQuery]);

  // Load material issues when pagination changes
  useEffect(() => {
    fetchMaterialIssues(currentPage, itemsPerPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage]);

  const handleViewIssue = (issue: TransformedIssue) => {
    // Transform the TransformedIssue to the format expected by MaterialIssueForm for view-only
    const viewData = {
      id: issue.id, // Add the issue ID for image URL construction
      issuedDate: issue.issuedDate,
      additionalNotes: issue.additionalNotes || '',
      allItems: issue.items.map((item) => ({
        id: item.originalItem.id, // Add item ID for image URL construction
        material: {
          id: item.materialId,
          name: item.materialName,
          measureUnit: {
            name: item.unitName,
          },
          specifications: item.specifications,
        },
        stockBeforeIssue: item.existingStock,
        issuedQuantity: item.issuedQuantity,
        stockAfterIssue: item.stockAfterIssue,
        receiverName: item.recipientName,
        purpose: item.purpose,
        imagePath: item.imagePath,
        machineId: item.machineId,
        machineName: item.machineName,
      })),
    };

    setEditingIssue(viewData as unknown as TransformedIssue);
    setIsIssueFormOpen(true);
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

  // Transformed material issues for UI display
  const [issuedMaterials, setIssuedMaterials] = useState<TransformedIssue[]>(
    []
  );

  // Apply frontend sorting when issuedMaterials change
  useEffect(() => {
    console.log('Applying frontend sort on issues change:', sortField, sortOrder);
    const sorted = sortIssues(issuedMaterials, sortField, sortOrder);
    setSortedIssues(sorted);
  }, [issuedMaterials, sortField, sortOrder]);

  interface IssuedItem {
    materialId: number;
    nameOfMaterial: string;
    specifications: string;
    unit: string;
    existingStock: number;
    issuedQty: string;
    stockAfterIssue: number;
  }

  interface IssueFormData {
    date: string;
    purpose: string;
    receiverName: string;
    receiverDesignation: string;
    receiverId: string;
    issuingPersonName: string;
    issuingPersonDesignation: string;
    department: string;
    machineName: string;
    unit: string;
    issuedItems: IssuedItem[];
  }

  const handleIssueMaterial = async (issueData: MaterialIssue) => {
    try {
      // Reset to show newest items first after creating a new issue (by ID)
      setSortField('id');
      setSortOrder('DESC');
      setCurrentPage(1); // Go to first page to see the new item
      
      // Refresh the list to show the new issue
      await fetchMaterialIssues(1, itemsPerPage);

      toast({
        title: 'Success',
        description: 'Material issue created successfully',
      });

      // Close the form
      setIsIssueFormOpen(false);
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: { message?: string };
          status?: number;
        };
        message?: string;
      };

      let errorMessage = 'Failed to refresh material issues. Please try again.';

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  // Export functionality
  const exportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all material issues with pagination (API limit is 100)
      let allIssues: MaterialIssue[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const limit = 100; // API limit

      while (hasMorePages) {
        const response = await materialIssuesApi.getAll({
          page: currentPage,
          limit: limit,
          sortBy: sortField,
          sortOrder: 'DESC',
          include: 'items.material.measureUnit,items.issuedFor,branch,issuedBy', // Include related data
          ...(searchQuery.trim() && { search: searchQuery.trim() }),
          ...(currentUser?.role === 'company_owner' && filterUnit !== 'all' && {
            branchId: filterUnit,
          }),
        });

        allIssues = [...allIssues, ...response.data];
        
        // Check if there are more pages
        hasMorePages = response.meta?.hasNextPage || false;
        currentPage++;
        
        // Safety check to prevent infinite loops
        if (currentPage > 1000) {
          console.warn('Export stopped at page 1000 to prevent infinite loop');
          break;
        }
      }

      // Filter by date range if specified
      let filteredIssues = allIssues;
      if (exportDateRange.from || exportDateRange.to) {
        filteredIssues = allIssues.filter((issue) => {
          const issueDate = new Date(issue.issueDate);
          
          if (exportDateRange.from && exportDateRange.to) {
            const fromDate = new Date(exportDateRange.from);
            const toDate = new Date(exportDateRange.to);
            return issueDate >= fromDate && issueDate <= toDate;
          } else if (exportDateRange.from) {
            const fromDate = new Date(exportDateRange.from);
            return issueDate >= fromDate;
          } else if (exportDateRange.to) {
            const toDate = new Date(exportDateRange.to);
            return issueDate <= toDate;
          }
          
          return true;
        });
      }

      // Transform issues to UI format for export
      const transformedIssues = filteredIssues.map(transformApiIssueToUiFormat);
      
      // Prepare CSV headers
      const headers = [
        'Issue ID',
        'Issue Date',
        'Issued By',
        'Issuing Person Designation',
        'Unit',
        'Unit Location',
        'Material Name',
        'Specifications',
        'Model/Version',
        'Measure Unit',
        'Existing Stock',
        'Issued Quantity',
        'Stock After Issue',
        'Recipient Name',
        'Purpose',
        'Issued For (Machine)',
        'Additional Notes'
      ];

      // Prepare CSV data - flatten all items from all issues
      const csvData: string[][] = [];
      
      transformedIssues.forEach((issue) => {
        issue.items.forEach((item) => {
          csvData.push([
            `"${issue.id}"`,
            `"${formatDateToDDMMYYYY(issue.issuedDate)}"`,
            `"${issue.issuingPersonName}"`,
            `"${issue.issuingPersonDesignation}"`,
            `"${issue.unitName}"`,
            `"${issue.branchLocation || ''}"`,
            `"${item.materialName}"`,
            `"${item.specifications}"`,
            `"${item.makerBrand}"`,
            `"${item.originalItem.material.measureUnit?.name || 'units'}"`,
            (item.existingStock || 0).toString(),
            (item.issuedQuantity || 0).toString(),
            (item.stockAfterIssue || 0).toString(),
            `"${item.recipientName}"`,
            `"${item.purpose}"`,
            `"${item.machineName}"`,
            `"${issue.additionalNotes || ''}"`
          ]);
        });
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
      
      // Generate filename with current date and date range
      const currentDate = new Date().toISOString().split('T')[0];
      let filename = `ssrfm_material_issues_export_${currentDate}`;
      
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

      // Close dialog
      setIsExportDialogOpen(false);

      toast({
        title: 'Export Successful',
        description: `Material issues data exported successfully. ${csvData.length} records downloaded.`,
        variant: 'default',
      });

    } catch (error) {
      console.error('Error exporting material issues:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export material issues data. Please try again.',
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
  };

  // Use sortedIssues for display (search and unit filtering are handled by API)
  const displayIssues = sortedIssues;

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
      <div className='flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4'>
        {/* Left side: Title and View Toggle Buttons */}
        <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3'>
          {/* View Toggle Buttons - Moved to left side */}
          <div className='flex rounded-lg border border-secondary overflow-hidden bg-secondary/10 w-fit shadow-sm'>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('list')}
              className='rounded-none px-3 sm:px-4'
            >
              <List className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>List</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('table')}
              className='rounded-none px-3 sm:px-4'
            >
              <Table className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>Table</span>
            </Button>
          </div>
        </div>

        {/* Right side: Search, Unit Filter and Issue Material Button */}
        <div className='flex flex-col sm:flex-row gap-3 items-start sm:items-center'>
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
            <Input
              placeholder='Search issues, materials, recipients...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10 rounded-lg border-secondary focus:border-secondary focus:ring-0 outline-none h-10 w-64'
            />
          </div>

          {/* Unit Filter - Only for Company Owner */}
          {currentUser?.role === 'company_owner' && (
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className='w-full sm:w-48 rounded-lg border-secondary focus:border-secondary focus:ring-0'>
                <SelectValue
                  placeholder={isLoadingBranches ? 'Loading...' : 'Select Unit'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Units</SelectItem>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    <div className='flex items-center gap-2'>
                      <Building2 className='w-4 h-4' />
                      <div>
                        <div className='font-medium'>{branch.name}</div>
                        {branch.location && (
                          <div className='text-xs text-muted-foreground'>
                            {branch.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant='outline'
            className='w-full sm:w-auto text-sm sm:text-base'
            onClick={() => setIsExportDialogOpen(true)}
            disabled={isExporting || !isOnline}
          >
            {isExporting ? (
              <Loader2 className='w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin' />
            ) : (
              <Upload className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />
            )}
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>

          <Button
            className='btn-primary w-full sm:w-auto text-sm sm:text-base'
            onClick={() => setIsIssueFormOpen(true)}
          >
            <Plus className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />
            Issue Materials
          </Button>
        </div>
      </div>

      {/* Content - Rest of the component remains exactly the same */}
      {isLoading ? (
        <div className='flex items-center justify-center p-12'>
          <div className='flex items-center gap-3'>
            <Loader2 className='w-6 h-6 animate-spin text-primary' />
            <span className='text-muted-foreground'>
              Loading material issues...
            </span>
          </div>
        </div>
      ) : error ? (
        <Card className='rounded-lg shadow-sm p-8 text-center'>
          <AlertCircle className='w-12 h-12 text-destructive mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-foreground mb-2'>Error</h3>
          <p className='text-muted-foreground mb-4'>{error}</p>
          <Button onClick={() => fetchMaterialIssues()}>Try Again</Button>
        </Card>
      ) : displayIssues.length > 0 ? (
        viewMode === 'table' ? (
          // Table View for Material Issues - Individual Items
          <Card className='rounded-lg shadow-sm border border-primary/10'>
            <CardContent className='p-0'>
              <div className='overflow-x-auto'>
                <TableComponent>
                  <TableHeader>
                    <TableRow className='bg-gradient-to-r from-primary/5 to-primary/10 border-b-2 border-primary/20'>
                      <TableHead className='w-[100px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('uniqueId')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issue ID
                          {getSortIcon('uniqueId')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[140px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('materialName')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued Material
                          {getSortIcon('materialName')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[120px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('specifications')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Specifications
                          {getSortIcon('specifications')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[120px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('stockInfo')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Stock Info
                          {getSortIcon('stockInfo')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issueDate')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued Date
                          {getSortIcon('issueDate')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[120px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedFor')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued For
                          {getSortIcon('issuedFor')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[120px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedTo')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued To
                          {getSortIcon('issuedTo')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[130px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedBy')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued By
                          {getSortIcon('issuedBy')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('branch')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Unit
                          {getSortIcon('branch')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold text-sm'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('purpose')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Purpose
                          {getSortIcon('purpose')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayIssues.flatMap((issue) =>
                      issue.items.map((item, itemIndex) => (
                        <TableRow
                          key={`${issue.id}-item-${itemIndex}`}
                          className='hover:bg-primary/5 border-b border-border/50 cursor-pointer transition-colors duration-200'
                          onClick={() => handleViewIssue(issue)}
                        >
                          <TableCell className='font-medium text-sm py-3'>
                            <Button
                              variant='link'
                              className='p-0 h-auto text-left font-semibold text-primary hover:text-primary/80 text-sm uppercase'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewIssue(issue);
                              }}
                            >
                              {issue.id}
                            </Button>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='flex items-center gap-2'>
                              <div className='w-2 h-2 bg-primary rounded-full'></div>
                              <div>
                                <div className='font-semibold text-foreground capitalize'>
                                  {item.materialName}
                                </div>
                                {item.makerBrand && (
                                  <div className='text-xs text-muted-foreground mt-1'>
                                    {item.makerBrand}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div
                              className='text-muted-foreground max-w-[120px] truncate'
                              title={item.specifications}
                            >
                              {item.specifications}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='space-y-1'>
                              <div className='flex items-center justify-between text-xs'>
                                <span className='text-muted-foreground'>
                                  Existing:
                                </span>
                                <span className='text-foreground'>
                                  {item.existingStock} {item.originalItem.material.measureUnit?.name || 'units'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs font-bold text-primary">
  <span className="text-muted-foreground">
    Issued:
  </span>
  <span>
    {item.issuedQuantity} {item.originalItem.material.measureUnit?.name || 'units'}
  </span>
</div>

                              <div className='flex items-center justify-between text-xs'>
                                <span className='text-muted-foreground'>
                                  After:
                                </span>
                                <span className='text-foreground'>
                                  {item.stockAfterIssue} {item.originalItem.material.measureUnit?.name || 'units'}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <span className='text-foreground font-bold'>
                              {formatDate(issue.issuedDate)}
                            </span>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='flex items-center gap-2'>
                              {item.machineName ? (
                                <div
                                  className='font-medium text-foreground truncate'
                                  title={item.machineName}
                                >
                                  {item.machineName}
                                </div>
                              ) : (
                                <div className='font-medium text-amber-600 text-xs'>
                                  Other
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='font-medium text-foreground truncate'>
                              {item.recipientName}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='space-y-1'>
                              <div className='font-semibold text-foreground truncate'>
                                {issue.issuingPersonName}
                              </div>
                              <div className='text-xs text-muted-foreground truncate'>
                                {issue.issuingPersonDesignation}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div className='space-y-1'>
                              <Badge
                                variant='outline'
                                className='text-xs bg-primary/10 text-primary border-primary/30'
                              >
                                {issue.unitName}
                              </Badge>
                              {issue.branchLocation && (
                                <div className='text-xs text-muted-foreground'>
                                  {issue.branchLocation}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className='text-sm py-3'>
                            <div
                              className='text-muted-foreground truncate max-w-[100px]'
                              title={item.purpose}
                            >
                              {item.purpose}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </TableComponent>
              </div>
            </CardContent>
          </Card>
        ) : (
          // List View for Material Issues - Individual Items
          <Card className='rounded-lg shadow-sm'>
            <CardContent className='p-0'>
              <div className='overflow-hidden'>
                <TableComponent>
                  <TableHeader>
                    <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                      <TableHead className='w-8'></TableHead>
                      <TableHead className='w-[80px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('uniqueId')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issue ID
                          {getSortIcon('uniqueId')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[120px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('materialName')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued Material
                          {getSortIcon('materialName')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[80px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('specifications')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Specifications
                          {getSortIcon('specifications')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[90px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('stockInfo')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Stock Info
                          {getSortIcon('stockInfo')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedTo')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued To
                          {getSortIcon('issuedTo')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedBy')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issuing Person
                          {getSortIcon('issuedBy')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[70px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('branch')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Unit
                          {getSortIcon('branch')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[80px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issueDate')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Date
                          {getSortIcon('issueDate')}
                        </Button>
                      </TableHead>
                      <TableHead className='w-[100px] text-foreground font-semibold'>
                        <Button
                          variant='ghost'
                          onClick={() => handleSort('issuedFor')}
                          className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                        >
                          Issued For
                          {getSortIcon('issuedFor')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayIssues
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      )
                      .flatMap((issue) =>
                        issue.items.map((item, itemIndex) => (
                          <TableRow
                            key={`${issue.id}-item-${itemIndex}`}
                            className='hover:bg-muted/30 border-b border-secondary/20 cursor-pointer'
                            onClick={() => handleViewIssue(issue)}
                          >
                            <TableCell>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-6 w-6 p-0'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowExpansion(
                                    `${issue.id}-item-${itemIndex}`
                                  );
                                }}
                              >
                                {expandedRows.has(
                                  `${issue.id}-item-${itemIndex}`
                                ) ? (
                                  <ChevronDown className='w-4 h-4' />
                                ) : (
                                  <ChevronRight className='w-4 h-4' />
                                )}
                              </Button>
                            </TableCell>
                            <TableCell className='font-medium text-xs'>
                              <Button
                                variant='link'
                                className='p-0 h-auto text-left font-medium text-primary hover:text-primary/80 uppercase text-xs'
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewIssue(issue);
                                }}
                              >
                                {issue.id}
                              </Button>
                              <div className='text-xs mt-1'>
                                <Badge variant='outline' className='text-xs'>
                                  Item {itemIndex + 1}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className='text-sm'>
                              <div>
                                <div className='font-medium capitalize truncate'>
                                  {item.materialName}
                                </div>
                                {item.makerBrand && (
                                  <div className='text-xs text-muted-foreground mt-1 truncate'>
                                    {item.makerBrand}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className='text-xs text-muted-foreground truncate'>
                              {item.specifications}
                            </TableCell>
                            <TableCell className='text-xs'>
                              <div className='space-y-0.5'>
                                <div>
                                  <span className='text-muted-foreground'>
                                    Existing:
                                  </span>{' '}
                                  {item.existingStock} {item.originalItem.material.measureUnit?.name || 'units'}
                                </div>
                                <div className="text-primary font-bold">
  <span className="text-muted-foreground font-bold">
    Issued:
  </span>{' '}
  {item.issuedQuantity} {item.originalItem.material.measureUnit?.name || 'units'}
</div>

                                <div>
                                  <span className='text-muted-foreground'>
                                    After:
                                  </span>{' '}
                                  {item.stockAfterIssue} {item.originalItem.material.measureUnit?.name || 'units'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className='text-sm'>
                              <div className='font-medium truncate'>
                                {item.recipientName}
                              </div>
                            </TableCell>
                            <TableCell className='text-sm'>
                              <div>
                                <div className='font-medium truncate'>
                                  {issue.issuingPersonName}
                                </div>
                                <div className='text-xs text-muted-foreground truncate'>
                                  {issue.issuingPersonDesignation}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className='text-xs'>
                              <div className='space-y-1'>
                                <Badge variant='outline' className='text-xs'>
                                  {issue.unitName}
                                </Badge>
                                {issue.branchLocation && (
                                  <div className='text-xs text-muted-foreground'>
                                    {issue.branchLocation}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className='text-xs'>
                              <span className='font-bold'>
                                {formatDate(issue.issuedDate)}
                              </span>
                            </TableCell>
                            <TableCell className='text-xs'>
                              <div
                                className='font-medium truncate'
                                title={item.machineName}
                              >
                                {item.machineName || 'others'}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                  </TableBody>
                </TableComponent>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className='rounded-lg shadow-sm p-8 text-center'>
          <Package className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
          <h3 className='text-lg font-semibold text-foreground mb-2'>
            No Material Issues Found
          </h3>
          <p className='text-muted-foreground mb-4'>
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'No materials have been issued yet.'}
          </p>
        </Card>
      )}

      {/* Pagination - Restore the pagination section */}
      {materialIssuesData && materialIssuesData.meta && (
        <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
          {/* Page Info */}
          <div className='text-sm text-muted-foreground'>
            Showing{' '}
            {(materialIssuesData.meta.page - 1) *
              materialIssuesData.meta.limit +
              1}{' '}
            to{' '}
            {Math.min(
              materialIssuesData.meta.page * materialIssuesData.meta.limit,
              materialIssuesData.meta.itemCount
            )}{' '}
            of {materialIssuesData.meta.itemCount} entries
          </div>

          {/* Pagination Controls */}
          <div className='flex items-center gap-2'>
            {/* Items per page selector */}
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground'>Show:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  const newLimit = parseInt(value);
                  setItemsPerPage(newLimit);
                  setCurrentPage(1);
                  fetchMaterialIssues(1, newLimit);
                }}
              >
                <SelectTrigger className='w-20 h-8'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10</SelectItem>
                  <SelectItem value='20'>20</SelectItem>
                  <SelectItem value='50'>50</SelectItem>
                  <SelectItem value='100'>100</SelectItem>
                </SelectContent>
              </Select>
              <span className='text-sm text-muted-foreground'>per page</span>
            </div>

            {/* Page navigation */}
            <div className='flex items-center gap-1'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage(1);
                  fetchMaterialIssues(1, itemsPerPage);
                }}
                disabled={
                  !materialIssuesData.meta.hasPreviousPage ||
                  materialIssuesData.meta.page === 1
                }
                className='h-8 w-8 p-0'
              >
                <ChevronsLeft className='w-4 h-4' />
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage((prev) => prev - 1);
                  fetchMaterialIssues(currentPage - 1, itemsPerPage);
                }}
                disabled={!materialIssuesData.meta.hasPreviousPage}
                className='h-8 w-8 p-0'
              >
                <ChevronLeft className='w-4 h-4' />
              </Button>

              {/* Page numbers */}
              <div className='flex items-center gap-1 mx-2'>
                {Array.from(
                  { length: Math.min(5, materialIssuesData.meta.pageCount) },
                  (_, i) => {
                    let pageNum;
                    if (materialIssuesData.meta.pageCount <= 5) {
                      pageNum = i + 1;
                    } else if (materialIssuesData.meta.page <= 3) {
                      pageNum = i + 1;
                    } else if (
                      materialIssuesData.meta.page >=
                      materialIssuesData.meta.pageCount - 2
                    ) {
                      pageNum = materialIssuesData.meta.pageCount - 4 + i;
                    } else {
                      pageNum = materialIssuesData.meta.page - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={
                          materialIssuesData.meta.page === pageNum
                            ? 'default'
                            : 'outline'
                        }
                        size='sm'
                        onClick={() => {
                          setCurrentPage(pageNum);
                          fetchMaterialIssues(pageNum, itemsPerPage);
                        }}
                        className='h-8 w-8 p-0'
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
                onClick={() => {
                  setCurrentPage((prev) => prev + 1);
                  fetchMaterialIssues(currentPage + 1, itemsPerPage);
                }}
                disabled={!materialIssuesData.meta.hasNextPage}
                className='h-8 w-8 p-0'
              >
                <ChevronRight className='w-4 h-4' />
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setCurrentPage(materialIssuesData.meta.pageCount);
                  fetchMaterialIssues(
                    materialIssuesData.meta.pageCount,
                    itemsPerPage
                  );
                }}
                disabled={
                  !materialIssuesData.meta.hasNextPage ||
                  materialIssuesData.meta.page ===
                    materialIssuesData.meta.pageCount
                }
                className='h-8 w-8 p-0'
              >
                <ChevronsRight className='w-4 h-4' />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Material Issue Form */}
      <MaterialIssueForm
        isOpen={isIssueFormOpen}
        onClose={() => {
          setIsIssueFormOpen(false);
          setEditingIssue(null);
          // Refresh the table when form is closed (in case of successful submission)
          fetchMaterialIssues(currentPage, itemsPerPage);
        }}
        onSubmit={handleIssueMaterial}
        editingIssue={
          editingIssue
            ? (editingIssue as unknown as Record<string, unknown>)
            : undefined
        }
      />

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Download className='w-5 h-5 text-primary' />
              Export Material Issues to CSV
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
                  onChange={(e) => setExportDateRange(prev => ({
                    ...prev,
                    from: e.target.value
                  }))}
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
                  onChange={(e) => setExportDateRange(prev => ({
                    ...prev,
                    to: e.target.value
                  }))}
                  className='w-full'
                />
              </div>
              
              <div className='text-xs text-muted-foreground'>
                Select dates for filtered export, or use "All Data" for complete export. Current filters (unit) will be applied.
              </div>
              
              {/* Quick preset buttons */}
              <div className='pt-2 border-t space-y-2'>
                <div className='text-xs font-medium text-muted-foreground'>Quick Presets:</div>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // All Data - clear both dates
                      setExportDateRange({
                        from: '',
                        to: ''
                      });
                    }}
                    className='text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  >
                    All
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // This Month
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      setExportDateRange({
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                    }}
                    className='text-xs'
                  >
                    This Month
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // Last Month
                      const now = new Date();
                      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                      
                      setExportDateRange({
                        from: firstDayLastMonth.toISOString().split('T')[0],
                        to: lastDayLastMonth.toISOString().split('T')[0]
                      });
                    }}
                    className='text-xs'
                  >
                    Last Month
                  </Button>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      // Last 3 Months
                      const now = new Date();
                      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      setExportDateRange({
                        from: threeMonthsAgo.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                    }}
                    className='text-xs'
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
                        to: lastDay.toISOString().split('T')[0]
                      });
                    }}
                    className='text-xs'
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
                onClick={exportToCSV}
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
