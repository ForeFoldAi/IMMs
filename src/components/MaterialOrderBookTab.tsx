/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
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
  Package,
  Truck,
  CheckSquare,
  List,
  Table as TableIcon,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Send,
  Search,
  FileEdit,
  Edit,
  Building2,
  Loader2,
  ChevronUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ShoppingCart,
  CheckCircle2,
  X,
  WifiOff,
  
  Upload,
  Download,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Link, useNavigate } from 'react-router-dom';
import { useRole } from '../contexts/RoleContext';
import { MaterialIssueForm } from '../components/MaterialIssueForm';
import { RequestStatusManager } from '../components/RequestStatusManager';
import { RequisitionIndentForm } from '../components/RequisitionIndentForm';
import { UnifiedTabSearch } from '../components/UnifiedTabSearch';
import { useRequestWorkflow } from '../hooks/useRequestWorkflow';
import { HistoryView } from '../components/HistoryView';
import {
  generatePurchaseId,
  parseLocationFromId,
  formatDateToDDMMYYYY,
} from '../lib/utils';
import materialIndentsApi, { IndentStatus } from '../lib/api/material-indents';
import materialsApi from '../lib/api/materials';
import machinesApi from '../lib/api/machines';
import {
  materialPurchasesApi,
  MaterialPurchaseStatus,
} from '../lib/api/materials-purchases';
import { branchesApi } from '../lib/api/branches';
import {
  Branch,
  MaterialIndent,
  PaginationMeta,
  MaterialPurchase,
  ApproveRejectMaterialIndentRequest,
  ReceiveMaterialPurchaseItemRequest,
  Material,
  Machine,
} from '../lib/api/types';
import { toast } from '../hooks/use-toast';

export const MaterialOrderBookTab = () => {
  const { currentUser, hasPermission } = useRole();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => {
    const filterFromUrl = searchParams.get('filter');
    return filterFromUrl || 'all';
  });
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'table'>('table');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isIssueFormOpen, setIsIssueFormOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [selectedRequestForStatus, setSelectedRequestForStatus] =
    useState<MaterialIndent | null>(null);
  
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
  const [isStatusManagerOpen, setIsStatusManagerOpen] = useState(false);
  const [selectedRequestForResubmit, setSelectedRequestForResubmit] =
    useState<MaterialIndent | null>(null);
  const [isResubmitFormOpen, setIsResubmitFormOpen] = useState(false);

  // State for RequisitionIndentForm
  const [resubmitFormData, setResubmitFormData] = useState<any>(null);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [availableMachines, setAvailableMachines] = useState<string[]>([]);
  const [availableMachinesData, setAvailableMachinesData] = useState<Machine[]>(
    []
  );
  const [isLoadingResubmitForm, setIsLoadingResubmitForm] = useState(false);
  const [loadingResubmitId, setLoadingResubmitId] = useState<string | null>(null);
  const [isSubmittingResubmit, setIsSubmittingResubmit] = useState(false);

  // State for marking return items as fully received
  const [isMarkingReceived, setIsMarkingReceived] = useState<string | null>(null);

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log('State changed:', {
      isResubmitFormOpen,
      selectedRequestForResubmit: selectedRequestForResubmit?.id,
      resubmitFormData: resubmitFormData?.id,
      availableMaterials: availableMaterials.length,
      availableMachines: availableMachines.length,
    });
  }, [
    isResubmitFormOpen,
    selectedRequestForResubmit,
    resubmitFormData,
    availableMaterials,
    availableMachines,
  ]);

  // New state for approval/rejection workflow
  const [selectedIndentForApproval, setSelectedIndentForApproval] =
    useState<MaterialIndent | null>(null);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(
    null
  );

  // New state for material purchase workflow
  const [selectedIndentForOrder, setSelectedIndentForOrder] =
    useState<MaterialIndent | null>(null);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] =
    useState<MaterialPurchase | null>(null);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [receiveData, setReceiveData] =
    useState<ReceiveMaterialPurchaseItemRequest>({
      receivedQuantity: 0,
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
    });

  // Sorting state - now for client-side sorting (newest/highest Purchase ID on top by default)
  const [sortBy, setSortBy] = useState<string>('uniqueId');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // API state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materialIndents, setMaterialIndents] = useState<MaterialIndent[]>([]);
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

  // Add this after line 293 (after the useRequestWorkflow hook)
  const [issuedMaterials, setIssuedMaterials] = useState<IssuedMaterial[]>([]);

  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
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

  // Fetch material indents
  const fetchMaterialIndents = useCallback(
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

        // Add status filter if not 'all' (for all roles including company owner)
        if (filterStatus !== 'all') {
          params.status = filterStatus;
        }

        // Add branch filter for company owner
        if (currentUser?.role === 'company_owner' && filterUnit !== 'all') {
          params.branchId = filterUnit;
        }

        // For supervisor/inventory_manager (branch-level users): automatically filter by their branch
        if ((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id) {
          params.branchId = currentUser.branch.id.toString();
        }

        // Add sorting parameters for server-side sorting (newest Purchase ID on top)
        params.sortBy = 'id'; // Sort by the database ID
        params.sortOrder = sortOrder; // Use current sort order (default: DESC)

        // Debug logging
        console.log('API call params:', params);
        console.log(
          'Current filters - Status:',
          filterStatus,
          'Unit:',
          filterUnit,
          'SortBy:',
          params.sortBy,
          'SortOrder:',
          params.sortOrder
        );

        const response = await materialIndentsApi.getAll(params);

        setPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          itemCount: response.meta.itemCount,
          pageCount: response.meta.pageCount,
          hasPreviousPage: response.meta.hasPreviousPage,
          hasNextPage: response.meta.hasNextPage,
        });

        setMaterialIndents(response.data);
      } catch (error: any) {
        console.error('Error fetching material indents:', error);
        
        // Enhanced error handling
        let errorMessage = 'Failed to load material indents. Please try again.';
        
        if (error.response) {
          // Server responded with error status
          const status = error.response.status;
          const data = error.response.data;
          
          console.error('API Error Response:', {
            status,
            data,
            url: error.config?.url,
            method: error.config?.method
          });
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 403) {
            errorMessage = 'You do not have permission to access material indents.';
          } else if (status === 404) {
            errorMessage = 'Material indents endpoint not found.';
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
        setMaterialIndents([]);
      } finally {
        setIsLoading(false);
      }
    },
    [filterStatus, filterUnit, sortBy, sortOrder, currentUser?.role, currentUser?.branch?.id] // Added branch ID for supervisor filtering
  );

  // Handle column sorting - Triggers server-side sorting and data refetch
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // Toggle sort order if same column
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      // Set new column and default to DESC for Purchase ID (newest first)
      setSortBy(column);
      setSortOrder(column === 'uniqueId' ? 'DESC' : 'ASC');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchMaterialIndents(pagination.page, pagination.limit);
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

  // Workflow management
  const {
    initializeRequest,
    updateRequestStatus,
    approveRequest,
    updateMaterialReceipt,
    getRequestWorkflow,
    canPerformAction,
  } = useRequestWorkflow();
  interface IssuedMaterial {
    id: string;
    materialId: string;
    materialName: string;
    specifications: string;
    MeasureUnit: string;
    existingStock: number;
    issuedQuantity: string;
    stockAfterIssue: number;
    recipientName: string;
    recipientId: string;
    recipientDesignation: string;
    department: string;
    machineId: string;
    machineName: string;
    purpose: string;
    issuingPersonName: string;
    issuingPersonDesignation: string;
    issuedBy: string;
    issuedDate: string;
    materialIssueFormSrNo: string;
    reqFormSrNo: string;
    indFormSrNo: string;
    status: string;
    type: string;
    timestamp: string;
    unit: string;
    unitName: string;
    [key: string]: unknown; // For other properties
  }

  // Fetch material indents when filters or sorting changes (not search - search is frontend only)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMaterialIndents(pagination.page, pagination.limit);
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [
    filterStatus,
    filterUnit,
    sortBy,
    sortOrder,
    pagination.page,
    pagination.limit,
    fetchMaterialIndents,
  ]);

  // Reset to first page when filters or sorting changes
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [filterStatus, filterUnit, sortBy, sortOrder]);

  // Legacy state for backward compatibility
  interface LegacyRequest {
    id: string;
    originalId: number;
    materialName: string;
    specifications: string;
    maker: string;
    quantity: string;
    unitPrice?: string;
    value: string;
    priority: string;
    materialPurpose: string;
    machineId: string;
    machineName: string;
    date: string;
    status: string;
    statusDescription: string;
    currentStage: string;
    progressStage: number;
    requestedBy: string;
    department?: string; // Make optional since some entries don't have it
    unit: string;
    unitName: string;
    approvedBy?: string;
    approvedDate?: string;
    additionalNotes?: string;
    rejectionReason?: string;
    [key: string]: unknown; // For other legacy fields
  }

  const [allRequests, setAllRequests] = useState<LegacyRequest[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case IndentStatus.DRAFT:
        return 'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white';
      case IndentStatus.PENDING_APPROVAL:
        return 'bg-yellow-500 text-white border-yellow-600 hover:bg-yellow-500 hover:text-white';
      case IndentStatus.APPROVED:
        return 'bg-green-500 text-white border-green-600 hover:bg-green-500 hover:text-white';
      case IndentStatus.REVERTED:
        return 'bg-orange-500 text-white border-orange-600 hover:bg-orange-500 hover:text-white';
      case IndentStatus.ORDERED:
        return 'bg-blue-500 text-white border-blue-600 hover:bg-blue-500 hover:text-white';
      case IndentStatus.PARTIALLY_RECEIVED:
        return 'bg-orange-500 text-white border-orange-600 hover:bg-orange-500 hover:text-white';
      case IndentStatus.FULLY_RECEIVED:
        return 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500 hover:text-white';
      case IndentStatus.REJECTED:
        return 'bg-red-500 text-white border-red-600 hover:bg-red-500 hover:text-white';
      default:
        return 'bg-gray-500 text-white border-gray-600 hover:bg-gray-500 hover:text-white';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-secondary/100 text-white';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getProgressColor = (stage: number) => {
    switch (stage) {
      case 1: // DRAFT or PENDING_APPROVAL
        return 'bg-secondary/100';
      case 2: // APPROVED
        return 'bg-secondary/100';
      case 3: // ORDERED
        return 'bg-purple-500';
      case 4: // PARTIALLY_RECEIVED or FULLY_RECEIVED
        return 'bg-orange-500';
      default:
        return 'bg-gray-300';
    }
  };

  const getProgressStage = (status: string): number => {
    switch (status) {
      case IndentStatus.DRAFT:
        return 1;
      case IndentStatus.PENDING_APPROVAL:
        return 1;
      case IndentStatus.APPROVED:
        return 2;
      case IndentStatus.REVERTED:
        return 0;
      case IndentStatus.ORDERED:
        return 3;
      case IndentStatus.PARTIALLY_RECEIVED:
        return 4;
      case IndentStatus.FULLY_RECEIVED:
        return 4;
      case IndentStatus.REJECTED:
        return 0;
      default:
        return 0;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case IndentStatus.DRAFT:
        return <FileEdit className='w-4 h-4' />;
      case IndentStatus.PENDING_APPROVAL:
        return <Clock className='w-4 h-4' />;
      case IndentStatus.APPROVED:
        return <CheckCircle className='w-4 h-4' />;
      case IndentStatus.REVERTED:
        return <AlertTriangle className='w-4 h-4' />;
      case IndentStatus.ORDERED:
        return <Package className='w-4 h-4' />;
      case IndentStatus.PARTIALLY_RECEIVED:
        return <Truck className='w-4 h-4' />;
      case IndentStatus.FULLY_RECEIVED:
        return <CheckSquare className='w-4 h-4' />;
      case IndentStatus.REJECTED:
        return <XCircle className='w-4 h-4' />;
      default:
        return <AlertTriangle className='w-4 h-4' />;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case IndentStatus.PENDING_APPROVAL:
        return 'Pending Approval';
      case IndentStatus.APPROVED:
        return 'Approved';
      case IndentStatus.REVERTED:
        return 'Reverted';
      case IndentStatus.ORDERED:
        return 'Ordered';
      case IndentStatus.PARTIALLY_RECEIVED:
        return 'Partially Received';
      case IndentStatus.FULLY_RECEIVED:
        return 'Fully Received';
      default:
        return 'Fully Received';
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

  const handleMaterialIssue = (issueData: Record<string, unknown>) => {
    // Cast the issueData to IssuedMaterial to satisfy TypeScript
    setIssuedMaterials((prev) => [
      ...prev,
      issueData as unknown as IssuedMaterial,
    ]);
  };

  // Add missing functions
  const openStatusManager = (request: MaterialIndent | LegacyRequest) => {
    setSelectedRequestForStatus(request as MaterialIndent);
    setIsStatusManagerOpen(true);
  };

  const openResubmitForm = async (request: MaterialIndent | LegacyRequest) => {
    console.log('Opening resubmit form with request:', request);
    setIsLoadingResubmitForm(true);

    try {
      setSelectedRequestForResubmit(request as MaterialIndent);

      // Transform MaterialIndent data to RequisitionIndentForm format
      const transformedData = transformIndentToFormData(
        request as MaterialIndent
      );
      console.log('Transformed data:', transformedData);
      setResubmitFormData(transformedData);

      // Fetch materials and machines data
      await fetchFormData();

      setIsResubmitFormOpen(true);
      
      // Clear loading state after form opens
      setLoadingResubmitId(null);
    } catch (error) {
      console.error('Error opening resubmit form:', error);
      toast({
        title: 'Error',
        description: 'Failed to open resubmit form. Please try again.',
        variant: 'destructive',
      });
      // Clear loading state on error
      setLoadingResubmitId(null);
    } finally {
      setIsLoadingResubmitForm(false);
    }
  };

  // Transform MaterialIndent to RequisitionIndentForm data format
  const transformIndentToFormData = (indent: MaterialIndent) => {
    return {
      id: indent.id.toString(),
      items: indent.items.map((item, index) => ({
        id: item.id.toString(),
        srNo: String(index + 1),
        productName: item.material?.name || '',
        machineName: item.machine?.name || '',
        specifications: item.specifications || '',
        oldStock: item.currentStock || 0,
        reqQuantity: item.requestedQuantity?.toString() || '',
        measureUnit: item.material?.measureUnit?.name || 'units',
        images: [],
        imagePreviews: item.imagePaths || [],
        notes: item.notes || '',
        vendorQuotations: (item.quotations || [])
          .map((quotation) => ({
            id: quotation.id.toString(),
            vendorName: quotation.vendorName || '',
            contactPerson: quotation.contactPerson || '',
            phone: quotation.phone || '',
            price: quotation.price || '0',
            quotedPrice: quotation.quotationAmount || '0',
            quotationAmount: quotation.quotationAmount?.toString() || '0', // Keep raw amount for API
            notes: quotation.notes || '',
            quotationFile: null,
            isSelected: quotation.isSelected || false,
            filePaths: quotation.filePaths || [],
          })),
        purposeType: (item as any).purposeType || 'machine', // Use actual purposeType from API data
      })),
      requestedBy: indent.requestedBy?.name || '',
      location: indent.branch?.location || '',
      date: indent.requestDate || '',
      status: indent.status || '',
      apiData: {
        partialReceiptHistory: indent.partialReceiptHistory || [],
        totalReceivedQuantity: indent.totalReceivedQuantity || 0,
      },
    };
  };

  // Fetch materials and machines data for the form
  const fetchFormData = async () => {
    try {
      // Fetch materials
      const materialsResponse = await materialsApi.getMaterials({
        limit: 100,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      setAvailableMaterials(materialsResponse.data);

      // Fetch machines
      const machinesResponse = await machinesApi.getAll({
        limit: 100,
        sortBy: 'name',
        sortOrder: 'ASC',
      });
      setAvailableMachinesData(machinesResponse.data);
      setAvailableMachines(
        machinesResponse.data.map((machine) => machine.name)
      );
    } catch (error) {
      console.error('Error fetching form data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form data',
        variant: 'destructive',
      });
    }
  };

  const handleStatusUpdate = async (
    requestId: string,
    newStatus: string,
    updateData?: any
  ) => {
    try {
      // Find the request in materialIndents (API data) or allRequests (legacy)
      let request: MaterialIndent | LegacyRequest | undefined = materialIndents.find((indent) => indent.id.toString() === requestId.toString());
      
      if (!request) {
        // Fallback to allRequests for legacy compatibility
        request = allRequests.find((req) => req.id === requestId);
      }
      
      if (!request) {
        throw new Error('Request not found');
      }

      // Use the numeric ID for API calls - handle both MaterialIndent and LegacyRequest
      const numericId = (request as MaterialIndent).id || (request as LegacyRequest).originalId || parseInt(requestId);
      if (isNaN(numericId)) {
        throw new Error('Invalid request ID');
      }

      // Use specific API endpoints for different status updates
      if (newStatus === 'reverted' && updateData?.revertReason) {
        // Use the dedicated revert API endpoint
        await materialIndentsApi.revert(numericId, updateData.revertReason);
      } else if (newStatus === 'approved') {
        // For approval, we need to use the generic update endpoint
        // since the approve API requires specific item and quotation data
        const updatePayload: any = { status: newStatus };
        if (updateData?.approvedBy) {
          updatePayload.approvedBy = updateData.approvedBy;
          updatePayload.approvedDate = updateData.approvedDate;
        }
        if (updateData?.additionalNotes) {
          updatePayload.additionalNotes = updateData.additionalNotes;
        }
        await materialIndentsApi.update(numericId, updatePayload);
      } else {
        // For other status updates, use the generic update endpoint
        const updatePayload: any = { status: newStatus };

        // Add additional data if provided
        if (updateData) {
          // Handle order-specific data
          if (newStatus === 'ordered' && updateData.orderedBy) {
            updatePayload.orderedBy = updateData.orderedBy;
            updatePayload.orderedDate = updateData.orderedDate;
          }

          // Handle receipt-specific data
          if (
            (newStatus === 'partially_received' ||
              newStatus === 'material_received') &&
            updateData.receivedBy
          ) {
            updatePayload.receivedBy = updateData.receivedBy;
            updatePayload.receivedDate = updateData.receivedDate;
            updatePayload.purchasedPrice = updateData.purchasedPrice;
            updatePayload.purchasedQuantity = updateData.purchasedQuantity;
            updatePayload.purchasedFrom = updateData.purchasedFrom;
            updatePayload.invoiceNumber = updateData.invoiceNumber;
            updatePayload.qualityCheck = updateData.qualityCheck;
            updatePayload.notes = updateData.notes;
            updatePayload.partialReceipts = updateData.partialReceipts;
            updatePayload.totalReceivedQuantity =
              updateData.totalReceivedQuantity;
          }
        }

        await materialIndentsApi.update(numericId, updatePayload);
      }

      // Refresh the data from API to ensure we have the latest state
      await fetchMaterialIndents(pagination.page, pagination.limit);

      toast({
        title: 'Success',
        description: 'Request status updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update request status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleResubmitRequest = async (
    requestData: Record<string, unknown>
  ) => {
    try {
      setIsSubmittingResubmit(true);
      console.log('Starting resubmit request with data:', requestData);

      // Validate required fields
      if (
        !requestData.items ||
        !Array.isArray(requestData.items) ||
        requestData.items.length === 0
      ) {
        throw new Error('No items found in the request data');
      }

      // Validate each item has required fields
      for (const item of requestData.items) {
        if (!item.productName) {
          throw new Error('Product name is required for all items');
        }
        if (!item.reqQuantity || Number(item.reqQuantity) <= 0) {
          throw new Error('Valid requested quantity is required for all items');
        }
      }

      // Check if we have a selected request to resubmit
      if (!selectedRequestForResubmit) {
        throw new Error('No request selected for resubmission');
      }

      // Process items and submit each with multipart form data
      const failedItems: string[] = [];
      let successCount = 0;

      // Submit each item individually with its files
      for (let i = 0; i < requestData.items.length; i++) {
        const item = requestData.items[i];
        
        console.log('Processing item for resubmit:', item);
        console.log('Item images:', item.images);
        console.log('Item vendorQuotations:', item.vendorQuotations);
        console.log('Item vendorQuotations length:', item.vendorQuotations?.length);
        console.log('All vendor quotations with details:', item.vendorQuotations);
        console.log('Vendor quotations with isSelected flag:', item.vendorQuotations?.map(v => ({ 
          vendorName: v.vendorName, 
          isSelected: v.isSelected,
          hasFile: !!v.quotationFile
        })));
        
        // Find the material and machine
        const material = availableMaterials.find(
          (m) => m.name === item.productName
        );
        
        if (!material) {
          failedItems.push(`${item.productName}: Material not found`);
          continue;
        }

        const machine = availableMachinesData.find(
          (m) => m.name === item.machineName
        );

        // Build the item payload similar to MaterialRequest - WITHOUT any IDs
        // Note: We don't pass item ID, quotation IDs, or any IDs to let backend create new records
        const itemPayload = {
          // DON'T include item ID - let backend create new item record
          materialId: material.id,
          specifications: item.specifications || '',
          requestedQuantity: Number(item.reqQuantity) || 0,
          purposeType: (item as any).purposeType || 'machine',
          machineId: (item as any).purposeType === 'machine' ? machine?.id : undefined,
          machineName: (item as any).purposeType !== 'machine' ? item.machineName : undefined,
          itemImageCount: (item.images as File[])?.length || 0,
          notes: item.notes || '',
          vendorQuotations: (() => {
            const quotations = item.vendorQuotations || [];
            const selectedQuotations = quotations.filter((v: any) => v.isSelected === true);
            
            console.log('Total quotations available:', quotations.length);
            console.log('Selected quotations count:', selectedQuotations.length);
            
            // If there are selected quotations, use only those; otherwise include all quotations
            const quotationsToSend = selectedQuotations.length > 0 ? selectedQuotations : quotations;
            
            console.log('Quotations to send (count):', quotationsToSend.length);
            
            return quotationsToSend.map((v: any) => {
              // DON'T include quotation ID - let backend create new quotation record
              console.log('Processing quotation:', v.vendorName, 'hasFile:', !!v.quotationFile);
              return {
                // No ID field - backend will create new quotation
                vendorName: v.vendorName,
                contactPerson: v.contactPerson || '',
                phone: v.phone || '',
                price: Number(v.price) || 0,
                imageCount: v.quotationFile ? 1 : 0,
                quotationAmount: Number((v.quotationAmount || v.quotedPrice || '0').toString().replace(/[₹,]/g, '')) || 0,
                notes: v.notes || '',
              };
            });
          })(),
        };
        
        console.log('Item payload (WITHOUT any IDs - ready for backend to create new records):', itemPayload);

        // Create FormData for this item
        const form = new FormData();
        
        // Add additional notes if available
        const additionalNotes = `Resubmitted after addressing revert reason: ${
          selectedRequestForResubmit.rejectionReason || 'N/A'
        }. Changes made: ${(requestData as any).resubmissionNotes || 'N/A'}`;
        
        form.append('additionalNotes', additionalNotes);
        form.append('items', JSON.stringify([itemPayload]));
        form.append('status', IndentStatus.PENDING_APPROVAL);

        // Append item files if any
        if (item.images && Array.isArray(item.images)) {
          console.log('Appending item files:', item.images.length, 'files');
          (item.images as File[]).forEach((file, index) => {
            if (file instanceof File) {
              console.log(`Appending item file ${index + 1}:`, file.name, file.type, file.size);
              form.append('itemFiles', file);
            } else {
              console.warn('File at index', index, 'is not a File instance:', file);
            }
          });
        } else {
          console.log('No item images to append');
        }

        // Append vendor quotation files if any
        if (item.vendorQuotations && Array.isArray(item.vendorQuotations)) {
          console.log('Appending vendor quotation files');
          item.vendorQuotations.forEach((quotation: any, index) => {
            if (quotation.quotationFile && quotation.quotationFile instanceof File) {
              console.log(`Appending quotation file ${index + 1}:`, quotation.quotationFile.name);
              form.append('quotationFiles', quotation.quotationFile);
            }
          });
        }

        // Submit via API
        try {
      const response = await materialIndentsApi.reSubmit(
        selectedRequestForResubmit.id,
            form
          );
          
          console.log('Item resubmitted successfully:', response);
          successCount++;
          
          toast({
            title: 'Success',
            description: `${item.productName} resubmitted successfully.`,
            variant: 'default',
          });
        } catch (itemError) {
          console.error('Failed to resubmit item:', itemError);
          
          const axiosError = itemError as {
            response?: { 
              data?: { message?: string; error?: string };
              status?: number;
            };
          };

          const errorMessage = 
            axiosError.response?.data?.message ||
            axiosError.response?.data?.error ||
            `Failed to resubmit ${item.productName}`;

          failedItems.push(`${item.productName}: ${errorMessage}`);

          toast({
            title: 'Error',
            description: `Failed to resubmit ${item.productName}`,
            variant: 'destructive',
          });
        }
      }

      // Show final summary
      setIsSubmittingResubmit(false);

      if (failedItems.length === 0) {
      toast({
        title: 'Success',
        description: 'Request resubmitted successfully.',
      });

        // Close the dialog
        setIsResubmitFormOpen(false);
        setSelectedRequestForResubmit(null);
        setResubmitFormData(null);
        setLoadingResubmitId(null);

      // Refresh the data from API
      await fetchMaterialIndents(pagination.page, pagination.limit);
      } else {
        // Show detailed errors
        toast({
          title: 'Partial Failure',
          description: `Some items failed to resubmit. Check console for details.`,
          variant: 'destructive',
        });
      }

    } catch (error) {
      console.error('Failed to resubmit request:', error);

      // Extract more detailed error information
      let errorMessage = 'Failed to resubmit request. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Check for Axios error response
      const axiosError = error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
          status?: number;
        };
      };

      if (axiosError.response?.status === 500) {
        errorMessage =
          'Server error occurred. Please check the console for details.';
      } else if (axiosError.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
      } else if (axiosError.response?.data?.error) {
        errorMessage = axiosError.response.data.error;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Clear loading state on error
      setLoadingResubmitId(null);
      setIsSubmittingResubmit(false);
    }
  };

  // Handle item changes in the form
  const handleItemChange = (itemId: string, field: string, value: string) => {
    if (resubmitFormData) {
      setResubmitFormData((prev) => ({
        ...prev,
        items: prev.items.map((item: any) =>
          item.id === itemId ? { ...item, [field]: value } : item
        ),
      }));
    }
  };

  // Handle export to CSV
  const handleExportToCSV = async () => {
    try {
      setIsExporting(true);
      
      // Fetch all material indents with pagination (API limit is 100)
      let allIndents: MaterialIndent[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const limit = 100; // API limit

      while (hasMorePages) {
        const response = await materialIndentsApi.getAll({
          page: currentPage,
          limit: limit,
          ...(filterStatus !== 'all' && { status: filterStatus }),
          // For company owner: apply selected unit filter
          ...(currentUser?.role === 'company_owner' && filterUnit !== 'all' && { branchId: filterUnit }),
          // For supervisor/inventory_manager (branch-level users): automatically filter by their branch
          ...((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id && { 
            branchId: currentUser.branch.id.toString() 
          }),
        });

        allIndents = [...allIndents, ...response.data];
        
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
      let filteredIndents = allIndents;
      if (exportDateRange.from || exportDateRange.to) {
        filteredIndents = allIndents.filter((indent) => {
          const requestDate = new Date(indent.requestDate);
          
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

      // Transform indents to UI format for export
      const transformedIndents = filteredIndents.map(transformApiIndentToUiFormat);
      
      // Prepare CSV headers
      const headers = [
        'Purchase ID',
        'Request Date',
        'Material Name',
        'Specifications',
        'Maker/Brand',
        'Quantity',
        'Unit Price (₹)',
        'Total Amount (₹)',
        'Status',
        'Approved By',
        'Requested By',
        'Unit',
        'Branch',
        'Machine Name',
        'Purpose',
        'Received Date',
        'Approved Date',
        'Additional Notes',
        'Rejection Reason'
      ];

      // Prepare CSV data - flatten all items from all indents
      const csvData: string[][] = [];
      
      filteredIndents.forEach((indent) => {
        indent.items.forEach((item) => {
          const transformedIndent = transformedIndents.find(t => t.originalId === indent.id);
          
          // Get the approved quotation:
          // 1. Try selectedQuotation field first
          // 2. If not available, find quotation with isSelected: true
          // 3. Otherwise null
          const approvedQuotation = item.selectedQuotation || 
            (item.quotations?.find(q => q.isSelected === true)) || 
            null;
          
          // Get machine name using the same logic as UI transformation
          const getMachineName = () => {
            // Check if purposeType is spare, other, or return
            const purposeType = (item as any).purposeType?.toLowerCase();
            if (purposeType === 'spare' || purposeType === 'other' || purposeType === 'return') {
              // For spare/other/return, use the machineName field which stores the purpose type text
              return (item as any).machineName || purposeType.charAt(0).toUpperCase() + purposeType.slice(1);
            }
            
            // For machine purpose type, use the actual machine name
            return item.machine?.name || 'N/A';
          };
          
          // Show price and value only for received statuses and when we have approved quotation
          const shouldShowPrice = approvedQuotation && (
            indent.status === IndentStatus.FULLY_RECEIVED ||
            indent.status === IndentStatus.PARTIALLY_RECEIVED
          );
          
          csvData.push([
            `"${transformedIndent?.id || indent.uniqueId}"`,
            `"${formatDateToDDMMYYYY(indent.requestDate)}"`,
            `"${item.material?.name || 'N/A'}"`,
            `"${item.specifications || item.material?.specifications || ''}"`,
            `"${item.material?.makerBrand || 'N/A'}"`,
            `"${item.requestedQuantity} ${item.material?.measureUnit?.name || 'units'}"`,
            shouldShowPrice && approvedQuotation ? `"₹${approvedQuotation.price}"` : '""',
            shouldShowPrice && approvedQuotation ? `"₹${approvedQuotation.quotationAmount}"` : '""',
            `"${getStatusLabel(indent.status)}"`,
            `"${['approved', 'ordered', 'partially_received', 'fully_received', 'reverted'].includes(indent.status) 
                ? (indent.approvedBy?.name || '') 
                : ''}"`,
            `"${indent.requestedBy?.name || 'Unknown'}"`,
            `"${indent.branch?.name || 'Unknown'}"`,
            `"${indent.branch?.location || ''}"`,
            `"${getMachineName()}"`,
            `"${item.notes || indent.additionalNotes || ''}"`,
            `"${transformedIndent?.receivedDate || ''}"`,
            `"${indent.approvalDate ? formatDateToDDMMYYYY(indent.approvalDate) : ''}"`,
            `"${indent.additionalNotes || ''}"`,
            `"${indent.rejectionReason || ''}"`
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
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      let filename = `material_indents_export_${currentDate}`;
      
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
      resetExportDateRange(); // Reset date range and preset after successful export

      toast({
        title: 'Export Successful',
        description: `Material indents data exported successfully. ${csvData.length} records downloaded.`,
        variant: 'default',
      });

    } catch (error) {
      console.error('Error exporting material indents:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export material indents data. Please try again.',
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

  // Handle vendor quotation changes
  const handleVendorQuotationChange = (itemId: string, quotations: any[]) => {
    if (resubmitFormData) {
      setResubmitFormData((prev) => ({
        ...prev,
        items: prev.items.map((item: any) =>
          item.id === itemId ? { ...item, vendorQuotations: quotations } : item
        ),
      }));
    }
  };

  // New function to handle approval
  const handleApproveIndent = async () => {
    if (!selectedIndentForApproval || !selectedItemId || !selectedQuotationId) {
      toast({
        title: 'Error',
        description: 'Please select an item and quotation to approve.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const approvalData: ApproveRejectMaterialIndentRequest = {
        status: 'approved',
        itemId: selectedItemId,
        quotationId: selectedQuotationId,
      };

      console.log('Approval data being sent:', {
        indentId: selectedIndentForApproval.id,
        approvalData,
        selectedIndent: selectedIndentForApproval,
        selectedItem: selectedIndentForApproval.items.find(
          (item) => item.id === selectedItemId
        ),
        selectedQuotation: selectedIndentForApproval.items
          .find((item) => item.id === selectedItemId)
          ?.quotations.find((q) => q.id === selectedQuotationId),
      });

      await materialIndentsApi.approve(
        selectedIndentForApproval.id,
        approvalData
      );

      setIsApprovalDialogOpen(false);
      setSelectedIndentForApproval(null);
      setSelectedItemId(null);
      setSelectedQuotationId(null);

      toast({
        title: 'Success',
        description: 'Material indent approved successfully.',
      });

      // Refresh the data
      await fetchMaterialIndents(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error approving indent:', error);

      // Extract more detailed error information
      let errorMessage = 'Failed to approve material indent. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Check for Axios error response
      const axiosError = error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
          status?: number;
        };
      };

      if (axiosError.response?.status === 502) {
        errorMessage =
          'Server error occurred (502). Please check the console for details.';
      } else if (axiosError.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
      } else if (axiosError.response?.data?.error) {
        errorMessage = axiosError.response.data.error;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };


  // New function to create material purchase order
  const handleCreatePurchaseOrder = async () => {
    if (!selectedIndentForOrder) {
      toast({
        title: 'Error',
        description: 'No indent selected for ordering.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Create purchase order from approved indent
      const purchaseData = {
        purchaseOrderNumber: `PO-${selectedIndentForOrder.uniqueId}`,
        orderDate: new Date().toISOString().split('T')[0],
        totalValue: selectedIndentForOrder.items
          .reduce((total, item) => {
            // Use only the selected (approved) quotation
            const approvedQuotation = item.selectedQuotation;
            return (
              total +
              (approvedQuotation
                ? Number(approvedQuotation.quotationAmount)
                : 0)
            );
          }, 0)
          .toString(),
        additionalNotes: selectedIndentForOrder.additionalNotes || '',
        items: selectedIndentForOrder.items.map((item) => ({
          materialId: item.material.id,
          orderedQuantity: item.requestedQuantity,
          unitPrice:
            item.selectedQuotation?.price || '0',
          notes: item.notes || '',
        })),
      };

      await materialPurchasesApi.create({
        ...purchaseData,
        indentId: selectedIndentForOrder.id,
      });

      // Update indent status to ordered
      // Note: You might need to add an update status API call here

      setIsOrderDialogOpen(false);
      setSelectedIndentForOrder(null);

      toast({
        title: 'Success',
        description: 'Purchase order created successfully.',
      });

      // Refresh the data
      await fetchMaterialIndents(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({
        title: 'Error',
        description: 'Failed to create purchase order. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // New function to handle material receipt
  const handleReceiveMaterial = async () => {
    if (
      !selectedPurchase ||
      !receiveData.receivedQuantity ||
      !receiveData.receivedDate
    ) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // For now, we'll assume we're receiving the first item
      // In a real implementation, you'd select which item to receive
      const firstItem = selectedPurchase.items[0];
      if (!firstItem) {
        toast({
          title: 'Error',
          description: 'No items found in this purchase order.',
          variant: 'destructive',
        });
        return;
      }

      await materialPurchasesApi.receiveItem(
        selectedPurchase.id,
        firstItem.id,
        receiveData
      );

      toast({
        title: 'Success',
        description: 'Material received successfully.',
      });

      setIsReceiveDialogOpen(false);
      setSelectedPurchase(null);
      setReceiveData({
        receivedQuantity: 0,
        receivedDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      fetchMaterialIndents(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error receiving material:', error);
      toast({
        title: 'Error',
        description: 'Failed to receive material. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Helper function to format Purchase ID
  const formatPurchaseId = (uniqueId: string, branchCode?: string) => {
    // Convert to uppercase and keep the format as UNIT-1, UNIT-2, etc.
    let formattedId = uniqueId.toUpperCase();

    return formattedId;
  };

  // Transform API data to UI format
  const transformApiIndentToUiFormat = (indent: MaterialIndent) => {
    // Get the first item for display purposes (if available)
    const firstItem =
      indent.items && indent.items.length > 0 ? indent.items[0] : null;
    
    // Get the approved quotation:
    // 1. Try selectedQuotation field first
    // 2. If not available, find quotation with isSelected: true
    // 3. Otherwise null
    const approvedQuotation = firstItem?.selectedQuotation || 
      (firstItem?.quotations?.find(q => q.isSelected === true)) || 
      null;

    // Debug logging for received items without prices
    if ((indent.status === IndentStatus.FULLY_RECEIVED || indent.status === IndentStatus.PARTIALLY_RECEIVED) && !approvedQuotation) {
      console.log('Received item without approved quotation:', {
        indentId: indent.id,
        status: indent.status,
        firstItem: firstItem,
        selectedQuotation: firstItem?.selectedQuotation,
        quotations: firstItem?.quotations,
        quotationsWithIsSelected: firstItem?.quotations?.filter(q => q.isSelected)
      });
    }

    // Show price and value only for received statuses and when we have approved quotation
    const shouldShowPrice = approvedQuotation && (
      indent.status === IndentStatus.FULLY_RECEIVED ||
      indent.status === IndentStatus.PARTIALLY_RECEIVED
    );

    // Get received date - use updatedAt for partially_received and fully_received
    const getReceivedDate = () => {
      if (indent.status === IndentStatus.FULLY_RECEIVED || 
          indent.status === IndentStatus.PARTIALLY_RECEIVED) {
        // Use updatedAt field for received statuses
        return indent.updatedAt ? formatDateToDDMMYYYY(indent.updatedAt) : '';
      }
      return '';
    };

    // Get machine name based on purpose type
    const getMachineName = () => {
      if (!firstItem) return 'N/A';
      
      // Check if purposeType is spare, other, or return
      const purposeType = (firstItem as any).purposeType?.toLowerCase();
      if (purposeType === 'spare' || purposeType === 'other' || purposeType === 'return') {
        // For spare/other/return, use the machineName field which stores the purpose type text
        return (firstItem as any).machineName || purposeType.charAt(0).toUpperCase() + purposeType.slice(1);
      }
      
      // For machine purpose type, use the actual machine name
      return firstItem.machine?.name || 'N/A';
    };

    return {
      id: formatPurchaseId(indent.uniqueId, indent.branch?.code),
      originalId: indent.id,
      materialName: firstItem?.material.name || 'N/A',
      specifications:
        firstItem?.specifications || firstItem?.material.specifications || '',
      maker: firstItem?.material.makerBrand || 'N/A',
      quantity: firstItem
        ? `${firstItem.requestedQuantity} ${
            firstItem.material.measureUnit?.name ||
            firstItem.material.unit ||
            'units'
          }`
        : '0',
      unitPrice:
        shouldShowPrice && approvedQuotation
          ? `₹${approvedQuotation.price}`
          : '',
      value:
        shouldShowPrice && approvedQuotation
          ? `₹${approvedQuotation.quotationAmount}`
          : '',
      priority: 'medium', // Not available in API, using default
      materialPurpose: firstItem?.notes || indent.additionalNotes || '',
      machineId: firstItem?.machine?.id.toString() || 'N/A',
      machineName: getMachineName(),
      date: formatDateToDDMMYYYY(indent.requestDate),
      status: indent.status,
      statusDescription: `${getStatusLabel(indent.status)} - ${
        indent.additionalNotes || ''
      }`,
      currentStage: getStatusLabel(indent.status),
      progressStage: getProgressStage(indent.status),
      requestedBy: indent.requestedBy?.name || 'Unknown',
      department: 'Production', // Not available in API, using default
      unit: indent.branch?.code || '',
      unitName: indent.branch?.name || '',
      branch: indent.branch?.name || '',
      branchLocation: indent.branch?.location || '',
      receivedDate: getReceivedDate(),
      approvedBy: indent.approvedBy?.name,
      approvedDate: indent.approvalDate
        ? formatDateToDDMMYYYY(indent.approvalDate)
        : undefined,
      additionalNotes: indent.additionalNotes,
      rejectionReason: indent.rejectionReason,
      // Include the original data for reference
      originalIndent: indent,
    };
  };

  // Client-side filtering for search only (status and unit filters are handled by API)
  const filterIndents = (indents: MaterialIndent[]) => {
    if (!searchTerm) return indents;

    const searchLower = searchTerm.toLowerCase();

    return indents.filter((indent) => {
      // Search in indent-level fields
      if (
        indent.uniqueId?.toLowerCase().includes(searchLower) ||
        indent.requestDate?.toLowerCase().includes(searchLower) ||
        formatDateToDDMMYYYY(indent.requestDate)?.toLowerCase().includes(searchLower) ||
        indent.status?.toLowerCase().includes(searchLower) ||
        getStatusLabel(indent.status)?.toLowerCase().includes(searchLower) ||
        indent.requestedBy?.name?.toLowerCase().includes(searchLower) ||
        indent.requestedBy?.email?.toLowerCase().includes(searchLower) ||
        indent.branch?.name?.toLowerCase().includes(searchLower) ||
        indent.branch?.code?.toLowerCase().includes(searchLower) ||
        indent.branch?.location?.toLowerCase().includes(searchLower) ||
        indent.additionalNotes?.toLowerCase().includes(searchLower) ||
        indent.rejectionReason?.toLowerCase().includes(searchLower) ||
        indent.approvedBy?.name?.toLowerCase().includes(searchLower) ||
        indent.approvalDate?.toLowerCase().includes(searchLower) ||
        (indent.approvalDate && formatDateToDDMMYYYY(indent.approvalDate)?.toLowerCase().includes(searchLower)) ||
        indent.updatedAt?.toLowerCase().includes(searchLower) ||
        (indent.updatedAt && formatDateToDDMMYYYY(indent.updatedAt)?.toLowerCase().includes(searchLower))
      ) {
        return true;
      }

      // Search in items (materials, machines, quotations, etc.)
      return indent.items.some((item) => {
        // Material fields
        const materialMatch = 
          item.material?.name?.toLowerCase().includes(searchLower) ||
          item.material?.makerBrand?.toLowerCase().includes(searchLower) ||
          item.material?.specifications?.toLowerCase().includes(searchLower) ||
          item.material?.measureUnit?.name?.toLowerCase().includes(searchLower) ||
          item.specifications?.toLowerCase().includes(searchLower);

        // Machine fields
        const machineMatch =
          item.machine?.name?.toLowerCase().includes(searchLower) ||
          (item as any).machineName?.toLowerCase().includes(searchLower) ||
          (item as any).purposeType?.toLowerCase().includes(searchLower);

        // Quantity and stock fields
        const quantityMatch =
          item.requestedQuantity?.toString().includes(searchLower) ||
          item.currentStock?.toString().includes(searchLower);

        // Notes and purpose
        const notesMatch =
          item.notes?.toLowerCase().includes(searchLower);

        // Quotation fields
        const quotationMatch = item.quotations?.some((quotation) =>
          quotation.vendorName?.toLowerCase().includes(searchLower) ||
          quotation.contactPerson?.toLowerCase().includes(searchLower) ||
          quotation.phone?.toLowerCase().includes(searchLower) ||
          quotation.price?.toString().includes(searchLower) ||
          quotation.quotationAmount?.toString().includes(searchLower) ||
          quotation.notes?.toLowerCase().includes(searchLower)
        );

        return materialMatch || machineMatch || quantityMatch || notesMatch || quotationMatch;
      });
    });
  };

  // Sort data client-side (used for search-filtered results only; main sorting is server-side)
  const sortData = (data: any[]) => {
    // Server handles primary sorting, this is backup for client-side filtered data
    if (!sortBy) return data;

    return [...data].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'uniqueId':
          // Sort by the original numeric ID for proper ordering of newest items
          aValue = a.originalId || 0;
          bValue = b.originalId || 0;
          break;
        case 'requestDate':
          // Convert date strings (DD-MM-YYYY or DD/MM/YYYY format) to timestamps for proper chronological sorting
          // Empty dates should sort to the end regardless of sort order
          const parseRequestDate = (dateStr: string): number => {
            if (!dateStr || !dateStr.trim()) {
              // Return a very large number so empty dates sort to the end
              return Number.MAX_SAFE_INTEGER;
            }
            
            // Handle DD-MM-YYYY format (with dashes)
            if (dateStr.includes('-')) {
              const dateParts = dateStr.split('-');
              if (dateParts.length === 3 && dateParts[0].length === 2) {
                // DD-MM-YYYY format
                const [day, month, year] = dateParts;
                const parsed = new Date(`${year}-${month}-${day}`).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              } else {
                // Try parsing as-is (might be YYYY-MM-DD)
                const parsed = new Date(dateStr).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              }
            }
            
            // Handle DD/MM/YYYY format (with slashes)
            if (dateStr.includes('/')) {
              const dateParts = dateStr.split('/');
              if (dateParts.length === 3 && dateParts[0].length === 2) {
                // DD/MM/YYYY format
                const [day, month, year] = dateParts;
                const parsed = new Date(`${year}-${month}-${day}`).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              }
            }
            
            // Try parsing as-is (might be ISO format or other)
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
          };
          
          aValue = parseRequestDate(a.date || '');
          bValue = parseRequestDate(b.date || '');
          break;
        case 'materialName':
          aValue = a.materialName?.toLowerCase() || '';
          bValue = b.materialName?.toLowerCase() || '';
          break;
        case 'quantity':
          // Extract numeric value from quantity string (e.g., "10 units" -> 10)
          aValue = parseFloat(a.quantity) || 0;
          bValue = parseFloat(b.quantity) || 0;
          break;
        case 'unitPrice':
          // Extract numeric value from price string (e.g., "₹1000" -> 1000)
          aValue = parseFloat(a.unitPrice?.replace(/[₹,]/g, '') || '0');
          bValue = parseFloat(b.unitPrice?.replace(/[₹,]/g, '') || '0');
          break;
        case 'value':
          // Extract numeric value from value string (e.g., "₹1000" -> 1000)
          aValue = parseFloat(a.value?.replace(/[₹,]/g, '') || '0');
          bValue = parseFloat(b.value?.replace(/[₹,]/g, '') || '0');
          break;
        case 'status':
          aValue = a.status?.toLowerCase() || '';
          bValue = b.status?.toLowerCase() || '';
          break;
        case 'approvedBy':
          aValue = a.approvedBy?.toLowerCase() || '';
          bValue = b.approvedBy?.toLowerCase() || '';
          break;
        case 'receivedDate':
          // Convert date strings (DD-MM-YYYY format) to timestamps for proper chronological sorting
          // Empty dates should sort to the end regardless of sort order
          const parseReceivedDate = (dateStr: string): number => {
            if (!dateStr || !dateStr.trim()) {
              // Return a very large number so empty dates sort to the end
              return Number.MAX_SAFE_INTEGER;
            }
            
            if (dateStr.includes('-')) {
              const dateParts = dateStr.split('-');
              if (dateParts.length === 3 && dateParts[0].length === 2) {
                // DD-MM-YYYY format
                const parsed = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              } else {
                // Try parsing as-is (might be YYYY-MM-DD)
                const parsed = new Date(dateStr).getTime();
                return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
              }
            }
            
            // Try parsing as-is
            const parsed = new Date(dateStr).getTime();
            return isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
          };
          
          aValue = parseReceivedDate(a.receivedDate || '');
          bValue = parseReceivedDate(b.receivedDate || '');
          break;
        case 'machineName':
          aValue = a.machineName?.toLowerCase() || '';
          bValue = b.machineName?.toLowerCase() || '';
          break;
        case 'branch':
          aValue = a.branch?.toLowerCase() || '';
          bValue = b.branch?.toLowerCase() || '';
          break;
        default:
          aValue = a[sortBy];
          bValue = b[sortBy];
      }

      // Handle null/undefined values
      if (aValue === null || aValue === undefined || aValue === '') aValue = '';
      if (bValue === null || bValue === undefined || bValue === '') bValue = '';

      // Compare values
      if (aValue < bValue) return sortOrder === 'ASC' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });
  };

  // Get filtered and transformed indents for UI
  const getFilteredIndents = () => {
    // Only apply client-side search filtering, status and unit filters are handled by API
    const searchFilteredData = filterIndents(materialIndents);
    const transformedData = searchFilteredData.map(transformApiIndentToUiFormat);
    // Apply client-side sorting
    return sortData(transformedData);
  };

  const filteredRequests = getFilteredIndents();

  // Get last 5 approved requests for Company Owner
  const getApprovedHistory = () => {
    if (currentUser?.role !== 'company_owner') return [];

    return allRequests
      .filter((req) => req.status === 'approved')
      .slice(0, 5)
      .map((req) => ({
        id: req.id,
        date: req.date,
        materialName: req.materialName,
        quantity: req.quantity,
        purchaseValue: req.value,
        previousMaterialValue: '₹0', // Default value
        perMeasureQuantity: '1', // Default value
        requestedValue: req.value,
        currentValue: req.value,
        requestedBy: req.requestedBy,
        status: req.status,
      }));
  };

  // Navigation handler for request details
  const handleRequestClick = (requestId: string, requestStatus?: string) => {
    console.log('handleRequestClick called with:', {
      requestId,
      requestStatus,
    });

    // If status is reverted and user is supervisor, open resubmit form
    if (
      requestStatus === 'reverted' &&
      hasPermission('inventory:material-indents:update')
    ) {
      console.log('Status is reverted, looking for original indent...');

      // Set loading state for this specific request
      setLoadingResubmitId(requestId);

      // Show loading toast
      toast({
        title: 'Loading Resubmit Form',
        description: 'Please wait while we prepare the form...',
        duration: 2000,
      });

      // Find the original MaterialIndent from the API data, not the transformed UI data
      const originalIndent = materialIndents.find((indent) => {
        const indentIdStr = indent.id.toString();
        const requestIdStr = requestId.toString();

        return indentIdStr === requestIdStr;
      });

      console.log('Found original indent:', originalIndent);

      if (originalIndent) {
        openResubmitForm(originalIndent);
        return;
      } else {
        // Clear loading state if indent not found
        setLoadingResubmitId(null);
      }
    }

    // Default behavior - navigate to request details
    const encodedRequestId = encodeURIComponent(requestId);
    navigate(`/request-details/${encodedRequestId}`);
  };

  const pendingRequests = filteredRequests.filter(
    (req) => req.status === 'pending_approval'
  );
  const approvedRequests = filteredRequests.filter(
    (req) =>
      req.status === 'approved' ||
      req.status === 'ordered' ||
      req.status === 'issued' ||
      req.status === 'completed'
  );

  // SSRFM Progress Bar: Submit → Approved → Ordered → Received → Complete
  const ProgressBar = ({ stage }: { stage: number }) => {
    const stages = ['Submit', 'Approved', 'Ordered', 'Received', 'Complete'];
    return (
      <div className='my-3'>
        {/* Desktop Progress Bar */}
        <div className='hidden sm:flex items-center space-x-2'>
          {stages.map((stageName, index) => (
            <div key={index} className='flex items-center'>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                  index < stage ? getProgressColor(index + 1) : 'bg-gray-300'
                }`}
              >
                {index + 1}
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`w-12 h-1 mx-2 rounded-full ${
                    index < stage - 1
                      ? getProgressColor(index + 1)
                      : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Mobile Progress Bar - Vertical */}
        <div className='sm:hidden space-y-2'>
          {stages.map((stageName, index) => (
            <div key={index} className='flex items-center space-x-3'>
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white ${
                  index < stage ? getProgressColor(index + 1) : 'bg-gray-300'
                }`}
              >
                {index + 1}
              </div>
              <div className='flex-1'>
                <span
                  className={`text-xs font-medium ${
                    index < stage ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {stageName}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Enhanced List View Component - Table-like format with expandable details
  const ListView = ({ requests }: { requests: any[] }) => (
    <Card className='rounded-lg shadow-sm'>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                <TableHead className='w-12 text-foreground font-semibold'></TableHead>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('uniqueId')}
                >
                  <div className='flex items-center gap-2'>
                    Purchase ID
                    {getSortIcon('uniqueId')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('requestDate')}
                >
                  <div className='flex items-center gap-2'>
                  Requested Date
                    {getSortIcon('requestDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[150px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('materialName')}
                >
                  <div className='flex items-center gap-2'>
                    Materials
                    {getSortIcon('materialName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('quantity')}
                >
                  <div className='flex items-center gap-2'>
                    Quantity
                    {getSortIcon('quantity')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('unitPrice')}
                >
                  <div className='flex items-center gap-2'>
                    Price
                    {getSortIcon('unitPrice')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('value')}
                >
                  <div className='flex items-center gap-2'>
                    Total Amount
                    {getSortIcon('value')}
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
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('receivedDate')}
                >
                  <div className='flex items-center gap-2'>
                    Received Date
                    {getSortIcon('receivedDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('machineName')}
                >
                  <div className='flex items-center gap-2'>
                    Purchased For
                    {getSortIcon('machineName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('branch')}
                >
                  <div className='flex items-center gap-2'>
                    Unit/Location
                    {getSortIcon('branch')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length > 0 ? (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className='hover:bg-muted/30 border-b border-secondary/20'
                  >
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-6 w-6 p-0 rounded-lg'
                        onClick={() => toggleRowExpansion(request.id)}
                      >
                        {expandedRows.has(request.id) ? (
                          <ChevronDown className='w-4 h-4' />
                        ) : (
                          <ChevronRight className='w-4 h-4' />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className='font-medium'>
                      <Button
                        variant='link'
                        className={`p-0 h-auto font-medium hover:underline ${
                          request.status === 'reverted' &&
                          hasPermission('inventory:material-indents:update')
                            ? 'text-orange-600 hover:text-orange-700'
                            : 'text-black'
                        }`}
                        onClick={() =>
                          handleRequestClick(
                            request.originalId || request.id,
                            request.status
                          )
                        }
                        disabled={loadingResubmitId === (request.originalId || request.id).toString()}
                        title={
                          request.status === 'reverted' &&
                          hasPermission('inventory:material-indents:update')
                            ? 'Click to edit and resubmit form'
                            : 'Click to view details'
                        }
                      >
                        {loadingResubmitId === (request.originalId || request.id).toString() ? (
                          <span className='flex items-center gap-2'>
                            <Loader2 className='w-4 h-4 animate-spin' />
                            {request.id}
                          </span>
                        ) : (
                          request.id
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className='text-sm'>{request.date}</TableCell>
                    <TableCell>
                      <div className='font-medium'>{request.materialName}</div>
                      {request.maker && request.maker !== 'N/A' && (
                        <div className='text-xs text-muted-foreground mt-1'>
                          {request.maker}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {request.quantity}
                    </TableCell>
                    <TableCell className='text-sm font-medium'>
                      {request.unitPrice || '-'}
                    </TableCell>
                    <TableCell className='text-sm font-medium'>
                      {request.value || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusColor(request.status)} border`}
                      >
                        <span className='flex items-center gap-1'>
                          {getStatusIcon(request.status)}
                          <span className='text-xs'>
                            {request.currentStage}
                          </span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {['approved', 'ordered', 'partially_received', 'fully_received', 'reverted'].includes(request.status) 
                        ? (request.approvedBy || '-') 
                        : '-'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {request.receivedDate || '-'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {request.machineName}
                    </TableCell>
                    <TableCell className='text-sm'>
                      <div className='space-y-1'>
                        <Badge
                          variant='outline'
                          className='text-xs bg-primary/10 text-black border-primary/30'
                        >
                          {request.unitName}
                        </Badge>
                        {request.branchLocation && (
                          <div className='text-xs text-muted-foreground'>
                            {request.branchLocation}
                          </div>
                        )}
                      </div>
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
  const TableView = ({ requests }: { requests: any[] }) => (
    <Card className='rounded-lg shadow-sm'>
      <CardContent className='p-0'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                <TableHead
                  className='min-w-[120px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('uniqueId')}
                >
                  <div className='flex items-center gap-2'>
                    Purchase ID
                    {getSortIcon('uniqueId')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('requestDate')}
                >
                  <div className='flex items-center gap-2'>
                  Requested Date
                    {getSortIcon('requestDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[150px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('materialName')}
                >
                  <div className='flex items-center gap-2'>
                    Materials
                    {getSortIcon('materialName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('quantity')}
                >
                  <div className='flex items-center gap-2'>
                    Quantity
                    {getSortIcon('quantity')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('unitPrice')}
                >
                  <div className='flex items-center gap-2'>
                    Price
                    {getSortIcon('unitPrice')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('value')}
                >
                  <div className='flex items-center gap-2'>
                    Total  Amount
                    {getSortIcon('value')}
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
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('receivedDate')}
                >
                  <div className='flex items-center gap-2'>
                    Received Date
                    {getSortIcon('receivedDate')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('machineName')}
                >
                  <div className='flex items-center gap-2'>
                    Purchased For
                    {getSortIcon('machineName')}
                  </div>
                </TableHead>
                <TableHead
                  className='min-w-[100px] text-foreground font-semibold cursor-pointer hover:bg-secondary/30'
                  onClick={() => handleSort('branch')}
                >
                  <div className='flex items-center gap-2'>
                  Unit/Location
                    {getSortIcon('branch')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length > 0 ? (
                requests.map((request) => (
                  <TableRow
                    key={request.id}
                    className='hover:bg-muted/30 border-b border-secondary/20'
                  >
                    <TableCell className='font-medium'>
                      <Button
                        variant='link'
                        className={`p-0 h-auto font-medium hover:underline ${
                          request.status === 'reverted' &&
                          hasPermission('inventory:material-indents:update')
                            ? 'text-orange-600 hover:text-orange-700'
                            : 'text-black'
                        }`}
                        onClick={() =>
                          handleRequestClick(
                            request.originalId || request.id,
                            request.status
                          )
                        }
                        disabled={loadingResubmitId === (request.originalId || request.id).toString()}
                        title={
                          request.status === 'reverted' &&
                          hasPermission('inventory:material-indents:update')
                            ? 'Click to edit and resubmit form'
                            : 'Click to view details'
                        }
                      >
                        {loadingResubmitId === (request.originalId || request.id).toString() ? (
                          <span className='flex items-center gap-2'>
                            <Loader2 className='w-4 h-4 animate-spin' />
                            {request.id}
                          </span>
                        ) : (
                          request.id
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className='text-sm'>{request.date}</TableCell>
                    <TableCell>
                      <div className='font-medium'>{request.materialName}</div>
                      {request.maker && request.maker !== 'N/A' && (
                        <div className='text-xs text-muted-foreground mt-1'>
                          {request.maker}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='text-sm'>{request.quantity}</TableCell>
                    <TableCell className='text-sm font-medium'>
                      {request.unitPrice || '-'}
                    </TableCell>
                    <TableCell className='text-sm font-medium'>
                      {request.value || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${getStatusColor(request.status)} border`}
                      >
                        <span className='flex items-center gap-1'>
                          {getStatusIcon(request.status)}
                          <span className='text-xs'>{request.currentStage}</span>
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm'>
                      {['approved', 'ordered', 'partially_received', 'fully_received', 'reverted'].includes(request.status) 
                        ? (request.approvedBy || '-') 
                        : '-'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {request.receivedDate || '-'}
                    </TableCell>
                    <TableCell className='text-sm'>
                      {request.machineName}
                    </TableCell>
                    <TableCell className='text-sm'>
                      <div className='space-y-1'>
                        <Badge
                          variant='outline'
                          className='text-xs bg-primary/10 text-black border-primary/30'
                        >
                          {request.unitName}
                        </Badge>
                        {request.branchLocation && (
                          <div className='text-xs text-muted-foreground'>
                            {request.branchLocation}
                          </div>
                        )}
                      </div>
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

  // Add pagination handlers
  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
    fetchMaterialIndents(newPage, pagination.limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
    fetchMaterialIndents(1, newLimit);
  };

  // Function to mark return items as fully received
  const handleMarkAsFullyReceived = async (request: any) => {
    try {
      setIsMarkingReceived((request.originalId || request.id).toString());

      // Use the update API to change status to fully_received
      await materialIndentsApi.update(request.originalId || request.id, {
        status: IndentStatus.FULLY_RECEIVED,
      } as any);

      toast({
        title: 'Success',
        description: 'Return item marked as fully received successfully.',
      });

      // Refresh the data
      await fetchMaterialIndents(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error marking item as fully received:', error);

      // Extract error message
      let errorMessage = 'Failed to mark item as fully received. Please try again.';

      const axiosError = error as {
        response?: {
          data?: {
            message?: string;
            error?: string;
          };
          status?: number;
        };
      };

      if (axiosError.response?.data?.message) {
        errorMessage = axiosError.response.data.message;
      } else if (axiosError.response?.data?.error) {
        errorMessage = axiosError.response.data.error;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsMarkingReceived(null);
    }
  };

  // Enhanced action buttons in the expanded detail row
  const renderActionButtons = (request: any) => {
    const canApprove =
      hasPermission('inventory:material-indents:approve') &&
      request.status === 'pending_approval';
    const canOrder =
      hasPermission('inventory:material-indents:update') &&
      request.status === 'approved';
    const canReceive =
      hasPermission('inventory:material-purchases:receive') &&
      (request.status === 'ordered' || request.status === 'partially_received');
    
    // Check if this is a return item that's approved and can be marked as received
    const isReturnItem = request.originalIndent?.items?.some(
      (item: any) => item.purposeType?.toLowerCase() === 'return'
    );
    const canMarkAsReceived =
      hasPermission('inventory:material-indents:update') &&
      request.status === 'approved' &&
      isReturnItem;

    return (
      <div className='flex flex-wrap gap-2 pt-4 border-t mt-6'>
        <Button
          variant='outline'
          className={`gap-2 rounded-lg ${
            request.status === 'reverted' &&
            hasPermission('inventory:material-indents:update')
              ? 'border-orange-600 text-orange-600 hover:bg-orange-50'
              : ''
          }`}
          onClick={() =>
            handleRequestClick(request.originalId || request.id, request.status)
          }
          disabled={loadingResubmitId === (request.originalId || request.id).toString()}
        >
          {loadingResubmitId === (request.originalId || request.id).toString() ? (
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : (
            <Eye className='w-4 h-4' />
          )}
          {request.status === 'reverted' &&
          hasPermission('inventory:material-indents:update')
            ? loadingResubmitId === (request.originalId || request.id).toString()
              ? 'Loading...'
              : 'Edit & Resubmit Form'
            : 'View Full Details'}
        </Button>

        {canApprove && (
          <Button
            variant='outline'
            className={`gap-2 rounded-lg ${
              // Check if all items have selected quotations
              request.originalIndent?.items?.every(
                (item) => item.selectedQuotation
              )
                ? 'text-green-600 border-green-600 hover:bg-green-50'
                : 'text-gray-400 border-gray-300 cursor-not-allowed'
            }`}
            disabled={
              !request.originalIndent?.items?.every(
                (item) => item.selectedQuotation
              )
            }
            onClick={() => {
              setSelectedIndentForApproval(request.originalIndent);
              setSelectedItemId(null); // Reset item selection
              setSelectedQuotationId(null); // Reset quotation selection
              setIsApprovalDialogOpen(true);
            }}
          >
            <CheckCircle className='w-4 h-4' />
            {request.originalIndent?.items?.every(
              (item) => item.selectedQuotation
            )
              ? 'Approve'
              : 'Select Vendor to Approve'}
          </Button>
        )}


        {canOrder && !isReturnItem && (
          <Button
            variant='outline'
            className='gap-2 rounded-lg text-blue-600 border-blue-600 hover:bg-blue-50'
            onClick={() => {
              setSelectedIndentForOrder(request.originalIndent);
              setIsOrderDialogOpen(true);
            }}
          >
            <ShoppingCart className='w-4 h-4' />
            Create Order
          </Button>
        )}

        {canMarkAsReceived && (
          <Button
            variant='outline'
            className='gap-2 rounded-lg text-emerald-600 border-emerald-600 hover:bg-emerald-50'
            onClick={() => handleMarkAsFullyReceived(request)}
            disabled={isMarkingReceived === (request.originalId || request.id).toString()}
          >
            {isMarkingReceived === (request.originalId || request.id).toString() ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <CheckCircle2 className='w-4 h-4' />
            )}
            {isMarkingReceived === (request.originalId || request.id).toString()
              ? 'Marking...'
              : 'Mark as Fully Received'}
          </Button>
        )}

        {canReceive && (
          <Button
            variant='outline'
            className='gap-2 rounded-lg text-orange-600 border-orange-600 hover:bg-orange-50'
            onClick={async () => {
              try {
                // First try to get purchase order from the indent's purchases array
                let purchases = request.originalIndent?.purchases || [];
                
                // If purchases not included in the response, fetch the full indent
                if (purchases.length === 0 && request.originalIndent?.id) {
                  const fullIndent = await materialIndentsApi.getById(request.originalIndent.id);
                  purchases = fullIndent.purchases || [];
                }
                
                if (purchases.length === 0) {
                  toast({
                    title: 'Error',
                    description: 'No purchase order found for this indent. Please create a purchase order first.',
                    variant: 'destructive',
                  });
                  return;
                }
                
                // Use the first purchase order (most recent)
                const purchase = purchases[0];
                
                // Verify purchase has items
                if (!purchase.items || purchase.items.length === 0) {
                  toast({
                    title: 'Error',
                    description: 'Purchase order has no items to receive.',
                    variant: 'destructive',
                  });
                  return;
                }
                
                setSelectedPurchase(purchase);
                setIsReceiveDialogOpen(true);
              } catch (error) {
                console.error('Error fetching purchase order:', error);
                toast({
                  title: 'Error',
                  description: 'Failed to load purchase order. Please try again.',
                  variant: 'destructive',
                });
              }
            }}
          >
            <Package className='w-4 h-4' />
            Receive Material
          </Button>
        )}

        {/* Status Management Button */}
        {(hasPermission('inventory:material-indents:approve') ||
          hasPermission('inventory:material-indents:update')) && (
          <Button
            variant='outline'
            className='gap-2 rounded-lg'
            onClick={() => openStatusManager(request)}
          >
            <CheckSquare className='w-4 h-4' />
            Manage Status
          </Button>
        )}

        {(request.status === 'rejected' || request.status === 'reverted') && (
          <Button
            variant='outline'
            className='gap-2 rounded-lg'
            onClick={() => {
              if (request.status === 'reverted') {
                // Set loading state
                setLoadingResubmitId((request.originalId || request.id).toString());
                
                // Show loading toast
                toast({
                  title: 'Loading Resubmit Form',
                  description: 'Please wait while we prepare the form...',
                  duration: 2000,
                });
                
                // Find the original MaterialIndent from the API data
                const originalIndent = materialIndents.find((indent) => {
                  const indentIdStr = indent.id.toString();
                  const requestOriginalIdStr = request.originalId?.toString();

                  return indentIdStr === requestOriginalIdStr;
                });

                if (originalIndent) {
                  openResubmitForm(originalIndent);
                } else {
                  setLoadingResubmitId(null);
                }
              }
            }}
            disabled={loadingResubmitId === (request.originalId || request.id).toString()}
          >
            {loadingResubmitId === (request.originalId || request.id).toString() ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Plus className='w-4 h-4' />
            )}
            {request.status === 'reverted'
              ? loadingResubmitId === (request.originalId || request.id).toString()
                ? 'Loading...'
                : 'Resubmit Indent Form'
              : 'Resubmit Request'}
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className='space-y-6 p-4 sm:p-0'>
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

      {/* Main Heading */}

      {/* Search, Views, Status and Actions Row */}
      <div className='flex flex-col gap-4 mb-6'>
        {/* Desktop: Show UnifiedTabSearch with export and indent form button */}
        <div className='hidden sm:block'>
          <UnifiedTabSearch
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder='Search by materials, purchase ID.....'
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
                // Update URL params
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
              { value: IndentStatus.PENDING_APPROVAL, label: 'Pending Approval' },
              { value: IndentStatus.APPROVED, label: 'Approved' },
              { value: IndentStatus.REVERTED, label: 'Reverted' },
              { value: IndentStatus.ORDERED, label: 'Ordered' },
              { value: IndentStatus.PARTIALLY_RECEIVED, label: 'Partially Received' },
              { value: IndentStatus.FULLY_RECEIVED, label: 'Fully Received' },
            ]}
            onExport={() => setIsExportDialogOpen(true)}
            isExporting={isExporting}
            showExport={true}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            showRefresh={true}
            onAdd={() => navigate('/materials-inventory/material-request')}
            addLabel='INDENT FORM'
            addIcon={<Plus className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />}
            showAddButton={currentUser?.role !== 'company_owner'}
            isOnline={isOnline}
          />
        </div>

        {/* Mobile: Show UnifiedTabSearch with export and indent form */}
        <div className='sm:hidden'>
          <UnifiedTabSearch
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder='Search by materials, purchase ID.....'
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
                // Update URL params
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
              { value: IndentStatus.PENDING_APPROVAL, label: 'Pending Approval' },
              { value: IndentStatus.APPROVED, label: 'Approved' },
              { value: IndentStatus.REVERTED, label: 'Reverted' },
              { value: IndentStatus.ORDERED, label: 'Ordered' },
              { value: IndentStatus.PARTIALLY_RECEIVED, label: 'Partially Received' },
              { value: IndentStatus.FULLY_RECEIVED, label: 'Fully Received' },
            ]}
            onExport={() => setIsExportDialogOpen(true)}
            isExporting={isExporting}
            showExport={true}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            showRefresh={true}
            onAdd={() => navigate('/materials-inventory/material-request')}
            addLabel='INDENT FORM'
            addIcon={<Plus className='w-4 h-4 mr-1' />}
            showAddButton={currentUser?.role !== 'company_owner'}
            isOnline={isOnline}
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='order-status' className='w-full'>
        {/* All Requests Tab */}
        <TabsContent value='all' className='space-y-3 sm:space-y-4'>
          {viewMode === 'table' ? (
            <TableView requests={filteredRequests} />
          ) : (
            <ListView requests={filteredRequests} />
          )}
        </TabsContent>

        {/* Order Request Status Tab */}
        <TabsContent value='order-status' className='space-y-3 sm:space-y-4'>
          {/* Loading State */}
          {isLoading ? (
            <Card className='rounded-lg shadow-sm p-8 text-center'>
              <Loader2 className='w-12 h-12 text-primary mx-auto mb-4 animate-spin' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                Loading Material Indents
              </h3>
              <p className='text-muted-foreground mb-4'>
                Please wait while we fetch the data...
              </p>
            </Card>
          ) : error ? (
            <Card className='rounded-lg shadow-sm p-8 text-center'>
              <RefreshCcw className='w-12 h-12 text-red-500 mx-auto mb-4' />
              <h3 className='text-lg font-semibold text-foreground mb-2'>
                 No Data Found,Reload Data
              </h3>
              <p className='text-muted-foreground mb-4'>{error}</p>
              <Button variant='outline' onClick={() => fetchMaterialIndents()}>
                <RefreshCcw className='w-4 h-4 mr-2' />
                Reload
              </Button>
            </Card>
          ) : (
            <>
              {/* Always show table/list view with headers */}
              {viewMode === 'table' ? (
                <TableView requests={filteredRequests} />
              ) : (
                <ListView requests={filteredRequests} />
              )}

              {/* Empty State - only show when no data */}
              {filteredRequests.length === 0 && (
                <Card className='rounded-lg shadow-sm p-8 text-center'>
                  <FileText className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-foreground mb-2'>
                    No Material Indents Found
                  </h3>
                  <p className='text-muted-foreground mb-4'>
                    {searchTerm.trim() 
                      ? `No indents found matching "${searchTerm}"`
                      : 'No material indents match your current filters.'}
                  </p>
                </Card>
              )}

              {/* Search Results Info - Show when searching */}
              {searchTerm.trim() && !isLoading && filteredRequests.length > 0 && (
                <div className='text-sm text-muted-foreground text-center py-2'>
                  Showing {filteredRequests.length} indent{filteredRequests.length !== 1 ? 's' : ''} matching "{searchTerm}"
                </div>
              )}

              {/* Pagination Controls - hide when searching */}
              {pagination && !searchTerm.trim() && (
                <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
                  {/* Page Info */}
                  <div className='text-xs sm:text-sm text-muted-foreground'>
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(
                      pagination.page * pagination.limit,
                      pagination.itemCount
                    )}{' '}
                    of {pagination.itemCount} entries
                  </div>

                  {/* Pagination Controls */}
                  <div className='flex flex-col sm:flex-row items-center gap-3 sm:gap-2 w-full sm:w-auto'>
                    {/* Items per page selector - Mobile optimized */}
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

                    {/* Page navigation - Mobile optimized */}
                    <div className='flex items-center gap-1'>
                      {/* First page button */}
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

                      {/* Previous page button */}
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={!pagination.hasPreviousPage}
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>

                      {/* Page numbers - Show up to 6 pages */}
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

                      {/* Next page button */}
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!pagination.hasNextPage}
                        className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                      >
                        <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                      </Button>

                      {/* Last page button */}
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

      {/* Material Issue Form */}
      <MaterialIssueForm
        isOpen={isIssueFormOpen}
        onClose={() => setIsIssueFormOpen(false)}
        onSubmit={(data) =>
          handleMaterialIssue(data as unknown as Record<string, unknown>)
        }
      />

      {/* Request Status Manager */}
      {selectedRequestForStatus && (
        <RequestStatusManager
          request={selectedRequestForStatus}
          onStatusUpdate={handleStatusUpdate}
          isOpen={isStatusManagerOpen}
          onClose={() => {
            setIsStatusManagerOpen(false);
            setSelectedRequestForStatus(null);
          }}
        />
      )}

      {/* Resubmit Form using RequisitionIndentForm */}
      {selectedRequestForResubmit && (
        <Dialog
          open={isResubmitFormOpen}
          onOpenChange={() => {
            setIsResubmitFormOpen(false);
            setSelectedRequestForResubmit(null);
            setResubmitFormData(null);
            setLoadingResubmitId(null);
          }}
        >
          <DialogContent className='max-w-[95vw] max-h-[80vh] w-full overflow-y-auto p-6'>
            <DialogHeader className='pb-4'>
              <DialogTitle className='flex items-center gap-2 text-xl'>
                {currentUser?.role === 'company_owner' ? (
                  <>
                    <Eye className='w-6 h-6 text-foreground' />
                    View Request - {selectedRequestForResubmit.id}
                  </>
                ) : (
                  <>
                    <Edit className='w-6 h-6 text-foreground' />
                    Resubmit Request - {selectedRequestForResubmit.id}
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            {isLoadingResubmitForm ? (
              <div className='flex items-center justify-center py-8'>
                <Loader2 className='w-8 h-8 animate-spin text-primary mr-2' />
                <span>Loading form data...</span>
              </div>
            ) : resubmitFormData && availableMaterials.length > 0 ? (
              <div className='space-y-6'>
                {/* Show revert reason if available */}
                {selectedRequestForResubmit.rejectionReason && (
                  <Alert className='border-orange-200 bg-orange-50'>
                    <AlertTriangle className='h-4 w-4 text-orange-600' />
                    <div className='text-orange-800 font-semibold'>
                      Original Revert Reason
                    </div>
                    <AlertDescription className='text-orange-700'>
                      {selectedRequestForResubmit.rejectionReason}
                    </AlertDescription>
                  </Alert>
                )}

                <div className='min-h-[40vh]'>
                  <RequisitionIndentForm
                  requestData={resubmitFormData}
                  isReadOnly={currentUser?.role === 'company_owner'}
                  onItemChange={handleItemChange}
                  onVendorQuotationChange={handleVendorQuotationChange}
                  availableMaterials={availableMaterials.map((material) => ({
                    name: material.name,
                    specifications: material.specifications || '',
                    measureUnit: material.measureUnit?.name || 'units',
                    category: material.category?.name || 'General',
                  }))}
                  machines={availableMachines}
                  onStatusChange={(newStatus: string, additionalData?: any) => {
                    // Handle status change if needed
                    console.log(
                      'Status changed to:',
                      newStatus,
                      additionalData
                    );
                  }}
                  userRole='supervisor'
                  hasPermission={hasPermission}
                />
                </div>

                <div className='flex justify-center gap-3 pt-6 border-t border-border'>
                  <Button
                    variant='outline'
                    onClick={() => {
                      setIsResubmitFormOpen(false);
                      setSelectedRequestForResubmit(null);
                      setResubmitFormData(null);
                      setLoadingResubmitId(null);
                      setIsSubmittingResubmit(false);
                    }}
                    className='px-6 py-2'
                    disabled={isSubmittingResubmit}
                  >
                    {currentUser?.role === 'company_owner' ? 'Close' : 'Cancel'}
                  </Button>
                  {/* Hide Resubmit button for company owners */}
                  {currentUser?.role !== 'company_owner' && (
                    <Button
                      onClick={() => handleResubmitRequest(resubmitFormData)}
                      className='bg-primary hover:bg-primary/90 text-white px-6 py-2'
                      disabled={isSubmittingResubmit}
                    >
                      {isSubmittingResubmit ? (
                        <>
                          <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                          Resubmitting...
                        </>
                      ) : (
                        <>
                          <Send className='w-4 h-4 mr-2' />
                          Resubmit Request
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-center py-8'>
                <AlertTriangle className='w-8 h-8 text-red-500 mr-2' />
                <span>Failed to load form data. Please try again.</span>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Approval Dialog */}
      <Dialog
        open={isApprovalDialogOpen}
        onOpenChange={setIsApprovalDialogOpen}
      >
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Approve Material Indent</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {selectedIndentForApproval && (
              <div className='space-y-4'>
                <div className='p-4 bg-green-50 border border-green-200 rounded-lg'>
                  <h3 className='font-semibold text-green-800 mb-2'>
                    Indent Details
                  </h3>
                  <p>
                    <strong>ID:</strong> {selectedIndentForApproval.uniqueId}
                  </p>
                  <p>
                    <strong>Requested By:</strong>{' '}
                    {selectedIndentForApproval.requestedBy?.name}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {formatDateToDDMMYYYY(
                      selectedIndentForApproval.requestDate
                    )}
                  </p>
                </div>

                <div className='space-y-3'>
                  <Label>Select Item to Approve</Label>
                  <Select
                    onValueChange={(value) =>
                      setSelectedItemId(parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Select an item' />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedIndentForApproval.items.map((item) => (
                        <SelectItem key={item.id} value={item.id.toString()}>
                          {item.material.name} - Qty: {item.requestedQuantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedItemId && (
                  <div className='space-y-3'>
                    <Label>Select Quotation</Label>
                    <Select
                      onValueChange={(value) =>
                        setSelectedQuotationId(parseInt(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder='Select a quotation' />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedIndentForApproval.items
                          .find((item) => item.id === selectedItemId)
                          ?.quotations.map((quotation) => (
                            <SelectItem
                              key={quotation.id}
                              value={quotation.id.toString()}
                            >
                              {quotation.vendorName} - ₹
                              {quotation.quotationAmount}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className='flex justify-end gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setIsApprovalDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleApproveIndent}
                    disabled={!selectedItemId || !selectedQuotationId}
                    className='bg-green-600 hover:bg-green-700'
                  >
                    <CheckCircle className='w-4 h-4 mr-2' />
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>


      {/* Order Creation Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {selectedIndentForOrder && (
              <div className='space-y-4'>
                <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                  <h3 className='font-semibold text-blue-800 mb-2'>
                    Indent Details
                  </h3>
                  <p>
                    <strong>ID:</strong> {selectedIndentForOrder.uniqueId}
                  </p>
                  <p>
                    <strong>Requested By:</strong>{' '}
                    {selectedIndentForOrder.requestedBy?.name}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {formatDateToDDMMYYYY(selectedIndentForOrder.requestDate)}
                  </p>
                </div>

                <div className='space-y-3'>
                  <h4 className='font-semibold'>Items to Order:</h4>
                  <div className='space-y-2'>
                    {selectedIndentForOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className='p-3 bg-gray-50 rounded border'
                      >
                        <p>
                          <strong>{item.material.name}</strong>
                        </p>
                        <p>Quantity: {item.requestedQuantity}</p>
                        <p>
                          Selected Quotation:{' '}
                          {item.selectedQuotation?.vendorName ||
                            'None selected'}
                        </p>
                        <p>
                          Amount: ₹
                          {item.selectedQuotation?.quotationAmount || '0'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='flex justify-end gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setIsOrderDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreatePurchaseOrder}
                    className='bg-blue-600 hover:bg-blue-700'
                  >
                    <ShoppingCart className='w-4 h-4 mr-2' />
                    Create Order
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Material Receipt Dialog */}
      <Dialog open={isReceiveDialogOpen} onOpenChange={setIsReceiveDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Receive Material</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {selectedPurchase && (
              <div className='space-y-4'>
                <div className='p-4 bg-orange-50 border border-orange-200 rounded-lg'>
                  <h3 className='font-semibold text-orange-800 mb-2'>
                    Purchase Order Details
                  </h3>
                  <p>
                    <strong>PO Number:</strong>{' '}
                    {selectedPurchase.purchaseOrderNumber}
                  </p>
                  <p>
                    <strong>Order Date:</strong>{' '}
                    {formatDateToDDMMYYYY(selectedPurchase.orderDate)}
                  </p>
                  <p>
                    <strong>Total Value:</strong> ₹{selectedPurchase.totalValue}
                  </p>
                </div>

                <div className='space-y-3'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <Label htmlFor='receivedQuantity'>
                        Received Quantity *
                      </Label>
                      <Input
                        id='receivedQuantity'
                        type='number'
                        value={receiveData.receivedQuantity}
                        onChange={(e) =>
                          setReceiveData((prev) => ({
                            ...prev,
                            receivedQuantity: parseInt(e.target.value) || 0,
                          }))
                        }
                        min='1'
                      />
                    </div>
                    <div>
                      <Label htmlFor='receivedDate'>Received Date *</Label>
                      <Input
                        id='receivedDate'
                        type='date'
                        value={receiveData.receivedDate}
                        onChange={(e) =>
                          setReceiveData((prev) => ({
                            ...prev,
                            receivedDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor='receiveNotes'>Notes</Label>
                    <Textarea
                      id='receiveNotes'
                      placeholder='Any additional notes about the received material...'
                      value={receiveData.notes}
                      onChange={(e) =>
                        setReceiveData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className='flex justify-end gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => setIsReceiveDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReceiveMaterial}
                    disabled={
                      !receiveData.receivedQuantity || !receiveData.receivedDate
                    }
                    className='bg-orange-600 hover:bg-orange-700'
                  >
                    <Package className='w-4 h-4 mr-2' />
                    Receive Material
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Download className='w-5 h-5 text-primary' />
              Export Material Indents to CSV
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
                      // All Data - clear both dates
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
                      // This Month
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      console.log('Setting This Month dates:', {
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      
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
                      // Last Month
                      const now = new Date();
                      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
                      
                      console.log('Setting Last Month dates:', {
                        from: firstDayLastMonth.toISOString().split('T')[0],
                        to: lastDayLastMonth.toISOString().split('T')[0]
                      });
                      
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
                      // Last 3 Months
                      const now = new Date();
                      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      
                      console.log('Setting Last 3 Months dates:', {
                        from: threeMonthsAgo.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      
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
                      // This Year
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), 0, 1);
                      const lastDay = new Date(now.getFullYear(), 11, 31);
                      
                      console.log('Setting This Year dates:', {
                        from: firstDay.toISOString().split('T')[0],
                        to: lastDay.toISOString().split('T')[0]
                      });
                      
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