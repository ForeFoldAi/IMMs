import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  FileEdit,
  Package,
  Loader2,
  ShoppingCart,
  CheckCircle,
  XCircle,
  Truck,
  Printer,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useRole } from '../contexts/RoleContext';
import { toast } from '../hooks/use-toast';
import { RequisitionIndentForm } from '../components/RequisitionIndentForm';
import { SupervisorRequestForm } from '../components/SupervisorRequestForm';
import { StatusDropdown } from '../components/StatusDropdown';
import { HistoryView } from '../components/HistoryView';
import { ConfirmApproveDialog } from '../components/ConfirmApproveDialog';
import { generatePurchaseId, parseLocationFromId, formatDateToDDMMYYYY } from '../lib/utils';
import materialIndentsApi, { IndentStatus } from '../lib/api/material-indents';
import {
  materialPurchasesApi,
  MaterialPurchaseStatus,
} from '../lib/api/materials-purchases';
import type {
  MaterialIndent,
  MaterialPurchase,
  ApproveRejectMaterialIndentRequest,
  ReceiveMaterialPurchaseItemRequest,
  MaterialPurchaseItem,
} from '../lib/api/types';
import { PurposeType } from '../lib/api/types';
import { Badge } from '../components/ui/badge';

interface VendorQuotation {
  id: string;
  vendorName: string;
  contactPerson: string;
  phone: string;
  price: string;
  quotedPrice: string;
  quotationAmount?: string; // Raw quotation amount from API (without currency symbol)
  notes: string;
  quotationFile?: File | null;
  isSelected?: boolean;
  filePaths?: string[]; // Add filePaths for API data
}

interface PartialReceipt {
  id?: string | number;
  receivedQuantity?: number;
  receivedDate?: string;
  notes?: string;
  receivedBy?: string;
  timestamp?: string;
  createdAt?: string;
  status?: string;
}

interface RequestItem {
  id: string;
  srNo: string; // Change from number to string
  productName: string;
  machineName: string;
  specifications: string;
  oldStock: number;
  reqQuantity: string;
  measureUnit: string;
  images?: File[];
  imagePreviews?: string[];
  notes?: string;
  purposeType: PurposeType;
  vendorQuotations: VendorQuotation[];
}

interface RequestData {
  id: string;
  items: RequestItem[];
  requestedBy: string;
  location: string;
  date: string;
  status: string;
  selectedVendors?: Record<string, string>;
  receiptHistory?: Array<{
    id: string;
    date: string;
    materialName: string;
    quantity: string;
    receivedQuantity?: string;
    receivedDate?: string;
    purchaseOrderNumber?: string;
    totalValue?: string;
    notes?: string;
    status: string;
    items?: MaterialPurchaseItem[];
    purchasedFrom?: string;
  }>;
  apiData?: MaterialIndent; // Store the original API data
  partialReceiptHistory?: Array<{
    id: string;
    receivedQuantity: number;
    receivedDate: string;
    notes: string;
    receivedBy: string;
    timestamp: string;
    status: IndentStatus;
  }>;
  totalReceivedQuantity?: number;
}

const RequestDetails: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { currentUser, hasPermission, isCompanyLevel } = useRole();

  // Decode the requestId to handle URL encoded characters
  const decodedRequestId = requestId ? decodeURIComponent(requestId) : null;

  const [requestData, setRequestData] = useState<RequestData | null>(null);
  // Removed vendor selection state in favor of dialog-based approval per item
  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<string, string>
  >({});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state for enhanced workflow
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState<number | null>(
    null
  );
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [resetStatusDropdown, setResetStatusDropdown] = useState<(() => void) | null>(null);
  const [selectedPurchase, setSelectedPurchase] =
    useState<MaterialPurchase | null>(null);
  const [receiveData, setReceiveData] =
    useState<ReceiveMaterialPurchaseItemRequest>({
      receivedQuantity: 0,
      receivedDate: new Date().toISOString().split('T')[0],
      notes: '',
    });

  // Loading states for dialogs
  const [isResubmitting, setIsResubmitting] = useState(false);

  // Add state for vendor selection
  const [selectedVendors, setSelectedVendors] = useState<Record<string, string>>({});

  // Available materials and machines will be populated from API data
  const [availableMaterials, setAvailableMaterials] = useState<
    Array<{
      name: string;
      specifications: string;
      measureUnit: string;
      category: string;
      makerBrand?: string;
    }>
  >([]);
  const [machines, setMachines] = useState<string[]>([]);

  // Helper function to format Purchase ID (same as MaterialOrderBookTab)
  const formatPurchaseId = (uniqueId: string, branchCode?: string) => {
    // Convert to uppercase and keep hyphen format (UNIT-1, UNIT-2, etc.)
    let formattedId = uniqueId.toUpperCase();

    return formattedId;
  };

  // Helper function to get machine name based on purpose type
  const getMachineName = (item: any) => {
    // Check if purposeType is spare, other, or return
    const purposeType = item.purposeType?.toLowerCase();
    if (purposeType === 'spare' || purposeType === 'other' || purposeType === 'return') {
      // For spare/other/return, use the machineName field or capitalize the purposeType
      return item.machineName || purposeType.charAt(0).toUpperCase() + purposeType.slice(1);
    }
    
    // For machine purpose type, use the actual machine name
    return item.machine?.name || 'N/A';
  };

  useEffect(() => {
    const loadRequestData = async () => {
      if (!decodedRequestId) {
        setError('Request ID is missing');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // The decodedRequestId should be the numeric ID from the URL
        // For example: if URL is /request-details/16, then decodedRequestId is "16"
        const numericId = parseInt(decodedRequestId, 10);

        if (isNaN(numericId) || numericId <= 0) {
          throw new Error('Invalid request ID format');
        }

        // Fetch the material indent data from API
        const indentData = await materialIndentsApi.getById(numericId);

        // Build partial receipt history from purchase items
        const partialReceiptHistory: Array<{
          id: string;
          receivedQuantity: number;
          receivedDate: string;
          notes: string;
          receivedBy: string;
          timestamp: string;
          status: IndentStatus;
        }> = [];
        
        // Get selected vendor name from indent items (find first item with selected quotation)
        const selectedVendorName = (() => {
          // Try to find any item with a selected quotation
          for (const item of indentData.items || []) {
            if (item.selectedQuotation?.vendorName) {
              return item.selectedQuotation.vendorName;
            }
          }
          // Fallback: check if any item has quotations with isSelected=true
          for (const item of indentData.items || []) {
            const selectedQuotation = item.quotations?.find(q => q.isSelected === true);
            if (selectedQuotation?.vendorName) {
              return selectedQuotation.vendorName;
            }
          }
          return 'Unknown Vendor';
        })();
        
        // Check if backend provides partialReceiptHistory directly
        if (indentData.partialReceiptHistory && Array.isArray(indentData.partialReceiptHistory) && indentData.partialReceiptHistory.length > 0) {
          // Use the backend's partialReceiptHistory if available (this has individual receipts)
          console.log('Using backend partialReceiptHistory:', indentData.partialReceiptHistory);
          indentData.partialReceiptHistory.forEach((receipt: PartialReceipt) => {
            partialReceiptHistory.push({
              id: String(receipt.id || `receipt-${Date.now()}-${Math.random()}`),
              receivedQuantity: receipt.receivedQuantity || 0,
              receivedDate: receipt.receivedDate || new Date().toISOString().split('T')[0],
              notes: receipt.notes || '',
              receivedBy: receipt.receivedBy || selectedVendorName,
              timestamp: receipt.timestamp || receipt.createdAt || new Date().toISOString(),
              status: (receipt.status as IndentStatus) || IndentStatus.PARTIALLY_RECEIVED,
            });
          });
        } else {
          // Fallback: Extract from purchase items (this only shows cumulative, not individual receipts)
          console.log('Backend does not provide partialReceiptHistory, using purchase items (cumulative only)');
          if (indentData.purchases && indentData.purchases.length > 0) {
            indentData.purchases.forEach((purchase) => {
              if (purchase.items && Array.isArray(purchase.items)) {
                purchase.items.forEach((item) => {
                  // Check if this item has received quantity
                  if (item.receivedQuantity && item.receivedQuantity > 0) {
                    // WARNING: This only shows cumulative total, not individual receipts
                    // Backend needs to implement individual receipt tracking
                    partialReceiptHistory.push({
                      id: `receipt-${purchase.id}-${item.id}`,
                      receivedQuantity: item.receivedQuantity,
                      receivedDate: item.receivedDate || purchase.orderDate,
                      notes: item.notes || '',
                      receivedBy: item.receivedBy || selectedVendorName,
                      timestamp: item.updatedAt || new Date().toISOString(),
                      status: item.status === 'fully_received' ? IndentStatus.FULLY_RECEIVED : IndentStatus.PARTIALLY_RECEIVED,
                    });
                  }
                });
              }
            });
          }
        }
        
        // Calculate total received quantity from all receipts
        const totalReceivedQuantity = partialReceiptHistory.reduce((sum, receipt) => 
          sum + (receipt.receivedQuantity || 0), 0
        );

        console.log('Partial Receipt History (Initial Load):', {
          purchaseCount: indentData.purchases?.length || 0,
          receiptsFound: partialReceiptHistory.length,
          totalReceivedQuantity,
          partialReceiptHistory,
        });

        // Transform API data to match the RequestData interface
        const transformedData: RequestData = {
          id: formatPurchaseId(indentData.uniqueId, indentData.branch?.code), // Apply formatting here
          requestedBy: indentData.requestedBy?.name || 'Unknown',
          location: indentData.branch?.name || 'Unknown',
          date: indentData.requestDate,
          status: indentData.status,
          apiData: {
            ...indentData,
            partialReceiptHistory,
            totalReceivedQuantity,
          }, // Store the original API data with enhanced receipt history
          items: indentData.items.map((item) => ({
            id: item.id.toString(),
            srNo: formatPurchaseId(indentData.uniqueId, indentData.branch?.code), // Use the same formatted ID as the Purchase ID
            productName: item.material.name,
            machineName: getMachineName(item), // Use helper function to get correct machine name based on purpose type
            specifications:
              item.specifications || item.material.specifications || '',
            oldStock: item.currentStock,
            reqQuantity: item.requestedQuantity.toString(),
            measureUnit: item.material.measureUnitId?.toString() || 'units',
            notes: item.notes || '',
            imagePreviews: item.imagePaths || [],
            purposeType: (item as any).purposeType || PurposeType.MACHINE, // Use actual purposeType from API data
            vendorQuotations: item.quotations
              // Show ALL quotations if pending_approval, only selected ones otherwise
              .filter((quotation) => 
                indentData.status === IndentStatus.PENDING_APPROVAL || quotation.isSelected === true
              )
              .map((quotation) => ({
                id: quotation.id.toString(),
                vendorName: quotation.vendorName,
                contactPerson: quotation.contactPerson,
                phone: quotation.phone,
                price: quotation.price || '0',
                quotedPrice: `₹${quotation.quotationAmount}`,
                quotationAmount: quotation.quotationAmount?.toString() || '0', // Keep raw amount for API
                notes: quotation.notes,
                quotationFile: null,
                isSelected: quotation.isSelected,
                filePaths: quotation.filePaths || [], // Pass filePaths from API
              })),
          })),
          selectedVendors: {},
          receiptHistory: indentData.purchases.map((purchase) => ({
            id: purchase.id.toString(),
            date: purchase.orderDate,
            materialName: indentData.items[0]?.material.name || 'Unknown',
            quantity: indentData.items[0]?.requestedQuantity.toString() || '0',
            purchaseOrderNumber: purchase.purchaseOrderNumber,
            totalValue: purchase.totalValue,
            notes: purchase.additionalNotes,
            status: 'purchased',
            items: purchase.items,
          })),
          partialReceiptHistory,
          totalReceivedQuantity,
        };

        // Removed initial selected vendors; handled via approval dialog
        setRequestData(transformedData);

        // Extract available materials and machines from the API data
        const materials = indentData.items.map((item) => ({
          name: item.material.name,
          specifications: item.material.specifications || '',
          measureUnit: item.material.measureUnitId?.toString() || 'units',
          category: 'Materials',
          makerBrand: item.material.makerBrand || '',
        }));

        const machineNames = indentData.items
          .filter((item) => item.machine)
          .map((item) => item.machine.name);

        setAvailableMaterials(materials);
        setMachines([...new Set(machineNames)]);
      } catch (error) {
        console.error('Error fetching request details:', error);
        setError('Failed to load request details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadRequestData();
  }, [decodedRequestId]);

  const handleItemChange = (itemId: string, field: string, value: string) => {
    if (!requestData) return;

    setRequestData((prev) => ({
      ...prev!,
      items: prev!.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Vendor selection handled via approval dialog; removed separate selector

  const handleStatusSelect = (itemId: string, status: string) => {
    setSelectedStatuses((prev) => ({
      ...prev,
      [itemId]: status,
    }));
  };

  // Removed duplicate company owner bulk submit; approval now via dialog only

  const handleSupervisorSubmit = async () => {
    if (!requestData || !requestData.apiData) return;

    try {
      // Extract numeric ID from the request ID
      const numericId = parseInt(
        requestData.id.split('/').pop()?.split('-').pop() || '0',
        10
      );

      if (isNaN(numericId) || numericId <= 0) {
        throw new Error('Invalid request ID format');
      }

      // Process the supervisor status updates
      const updates = requestData.items.map((item) => ({
        itemId: parseInt(item.id),
        materialName: item.productName,
        newStatus: selectedStatuses[item.id],
      }));

      // Determine the overall request status
      const statusValues = Object.values(selectedStatuses);
      let finalStatus = requestData.status;

      if (statusValues.every((status) => status === IndentStatus.ORDERED)) {
        finalStatus = IndentStatus.ORDERED;
      } else if (
        statusValues.every((status) => status === IndentStatus.FULLY_RECEIVED)
      ) {
        finalStatus = IndentStatus.FULLY_RECEIVED;
      } else if (statusValues.every((status) => status === 'issued')) {
        // Custom status
        finalStatus = 'issued';
      } else if (
        statusValues.every((status) => status === IndentStatus.PENDING_APPROVAL)
      ) {
        finalStatus = IndentStatus.PENDING_APPROVAL;
      } else if (
        statusValues.some(
          (status) => status === IndentStatus.PARTIALLY_RECEIVED
        )
      ) {
        finalStatus = IndentStatus.PARTIALLY_RECEIVED;
      }

      // Update the material indent via API
      const updatedIndent = await materialIndentsApi.update(numericId, {
        status: finalStatus as IndentStatus,
        additionalNotes: `Status updated by ${
          currentUser?.name || 'Supervisor'
        } on ${new Date().toLocaleDateString()}.`,
      });

      // Update local state with API response
      const updatedData = {
        ...requestData,
        status: finalStatus,
        apiData: updatedIndent,
      };

      setRequestData(updatedData);

      // Show success message
      const orderedCount = statusValues.filter(
        (status) => status === IndentStatus.ORDERED
      ).length;
      const partialCount = statusValues.filter(
        (status) => status === IndentStatus.PARTIALLY_RECEIVED
      ).length;
      const receivedCount = statusValues.filter(
        (status) => status === IndentStatus.FULLY_RECEIVED
      ).length;
      const issuedCount = statusValues.filter(
        (status) => status === 'issued'
      ).length;
      const completedCount = statusValues.filter(
        (status) => status === IndentStatus.FULLY_RECEIVED
      ).length;
      const resubmitCount = statusValues.filter(
        (status) => status === IndentStatus.PENDING_APPROVAL
      ).length;

      let successMessage = `Successfully updated ${updates.length} item${
        updates.length > 1 ? 's' : ''
      }`;
      if (orderedCount > 0) successMessage += ` - ${orderedCount} ordered`;
      if (partialCount > 0)
        successMessage += ` - ${partialCount} partially received`;
      if (receivedCount > 0)
        successMessage += ` - ${receivedCount} fully received`;
      if (issuedCount > 0) successMessage += ` - ${issuedCount} issued`;
      if (completedCount > 0)
        successMessage += ` - ${completedCount} completed`;
      if (resubmitCount > 0)
        successMessage += ` - ${resubmitCount} resubmitted`;

      toast({
        title: 'Status Updated',
        description: successMessage,
      });
    } catch (error) {
      console.error('Error updating supervisor status:', error);

      toast({
        title: 'Status Update Failed',
        description: 'Failed to update the status. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleStatusChange = async (
    newStatus: string,
    additionalData?: Record<string, unknown>
  ) => {
    if (!requestData || !requestData.apiData) return;

    try {
      // Use the API data ID directly instead of parsing from the formatted ID
      const numericId = requestData.apiData.id;

      if (!numericId || numericId <= 0) {
        throw new Error('Invalid request ID');
      }

      let updatedIndent;
      let updatedHistory: Array<{
        id: string;
        receivedQuantity: number;
        receivedDate: string;
        notes: string;
        receivedBy: string;
        timestamp: string;
        status: IndentStatus;
      }> = [];
      let totalReceived = 0;

      // Handle different status changes
      if (newStatus === IndentStatus.APPROVED) {
        // For approval, we need to select item and quotation
        setIsApprovalDialogOpen(true);
        return;
      } else if (newStatus === IndentStatus.REVERTED) {
        // For revert, use the dedicated revert method
        if (additionalData?.revertReason) {
          updatedIndent = await materialIndentsApi.revert(numericId, String(additionalData.revertReason));
        } else {
          throw new Error('Revert reason is required');
        }
      } else if (newStatus === IndentStatus.ORDERED) {
        // Create purchase order
        const purchaseData = {
          purchaseOrderNumber: `PO-${requestData.apiData.uniqueId}`,
          orderDate: new Date().toISOString().split('T')[0],
          additionalNotes: requestData.apiData.additionalNotes || '',
          indentId: requestData.apiData.id,
        };
        updatedIndent = await materialPurchasesApi.create(purchaseData);
      } else if (newStatus === IndentStatus.PARTIALLY_RECEIVED || 
                 newStatus === IndentStatus.FULLY_RECEIVED) {
        // Check if this is a return item - return items don't need purchase orders
        const isReturnItem = requestData.apiData?.items?.[0]?.purposeType?.toLowerCase() === 'return';
        
        if (isReturnItem) {
          // For return items, use the approve endpoint with a custom approach
          // Since the approve endpoint only accepts 'approved' or 'reverted', 
          // we'll use the approve endpoint with the item data to update to fully_received
          const firstItem = requestData.apiData.items[0];
          const firstQuotation = firstItem.quotations?.[0];
          
          // Use the approve endpoint with the item and quotation IDs
          const approvalData: ApproveRejectMaterialIndentRequest = {
            status: 'approved', // We'll use approved status as the base
            itemId: firstItem.id,
            quotationId: firstQuotation?.id || 0,
          };

          // First, ensure the item is approved
          updatedIndent = await materialIndentsApi.approve(numericId, approvalData);
          
          // Then try to update to fully_received using a different approach
          // We'll use the material-purchases API to mark as received
          try {
            // Create a minimal purchase order for return items
            const purchaseData = {
              purchaseOrderNumber: `RETURN-${requestData.apiData.uniqueId}`,
              orderDate: new Date().toISOString().split('T')[0],
              additionalNotes: 'Return item - no purchase required',
              indentId: requestData.apiData.id,
            };
            
            const purchaseOrder = await materialPurchasesApi.create(purchaseData);
            
            // Now mark the purchase order as fully received
            if (purchaseOrder.items && purchaseOrder.items.length > 0) {
              const receiveData = {
                receivedQuantity: firstItem.requestedQuantity,
                receivedDate: new Date().toISOString().split('T')[0],
                notes: 'Return item marked as fully received',
              };
              
              await materialPurchasesApi.receiveItem(
                purchaseOrder.id,
                purchaseOrder.items[0].id,
                receiveData
              );
              
              // Refresh to get the updated status
              updatedIndent = await materialIndentsApi.getById(numericId);
            }
          } catch (purchaseError) {
            console.warn('Could not create purchase order for return item:', purchaseError);
            // If purchase order creation fails, at least the item is approved
            updatedIndent = await materialIndentsApi.getById(numericId);
          }
        } else {
          // Handle material receipt using material-purchases API for non-return items
          
          // Find the first purchase order to receive
          const firstPurchase = requestData.receiptHistory?.[0];
          if (!firstPurchase || !firstPurchase.items || !Array.isArray(firstPurchase.items) || firstPurchase.items.length === 0) {
            throw new Error('No purchase order found. Please create a purchase order (status: ordered) before receiving materials.');
          }

        const purchaseId = Number(firstPurchase.id);
        const itemId = firstPurchase.items[0].id;

        if (newStatus === IndentStatus.PARTIALLY_RECEIVED) {
          // For partial receipt, call receiveItem with the partial quantity
          if (additionalData?.receivedQuantity && additionalData?.receivedDate) {
            const receiveData = {
              receivedQuantity: Number(additionalData.receivedQuantity),
              receivedDate: String(additionalData.receivedDate),
              notes: String(additionalData.notes || ''),
            };

            console.log('Attempting to receive partial quantity:', {
              purchaseId,
              itemId,
              receiveData,
              currentPurchaseItem: firstPurchase.items[0],
              orderedQuantity: firstPurchase.items[0].orderedQuantity,
              alreadyReceived: firstPurchase.items[0].receivedQuantity,
              pendingQuantity: firstPurchase.items[0].pendingQuantity,
            });

            // Call the receive item API to save partial receipt
            const receiveResponse = await materialPurchasesApi.receiveItem(
              purchaseId,
              itemId,
              receiveData
            );

            console.log('Partial receipt saved:', receiveResponse);

            // Get existing partial receipt history and add the new one
            const existingHistory = requestData.apiData?.partialReceiptHistory || [];
            updatedHistory = [...existingHistory, {
              id: `receipt-${Date.now()}`,
              receivedQuantity: receiveData.receivedQuantity,
              receivedDate: receiveData.receivedDate,
              notes: receiveData.notes,
              receivedBy: currentUser?.name || 'Supervisor',
              timestamp: new Date().toISOString(),
              status: newStatus,
            }];

            // Calculate total received quantity
            totalReceived = updatedHistory.reduce((sum, receipt) => 
              sum + (receipt.receivedQuantity || 0), 0
            );
          }
        } else if (newStatus === IndentStatus.FULLY_RECEIVED) {
          // For fully received, first receive the remaining quantity if provided
          if (additionalData?.receivedQuantity && additionalData?.receivedDate) {
            const receiveData = {
              receivedQuantity: Number(additionalData.receivedQuantity),
              receivedDate: String(additionalData.receivedDate),
              notes: String(additionalData.notes || ''),
            };

            // Call the receive item API to save the final receipt
            await materialPurchasesApi.receiveItem(
              purchaseId,
              itemId,
              receiveData
            );
          }

          // Purchase order is now fully received
          console.log('Purchase order fully received:', purchaseId);
        }

        // Refresh the data to get the updated status from backend
        updatedIndent = await materialIndentsApi.getById(numericId);
        }
      } else {
        // For other status changes
        updatedIndent = await materialIndentsApi.update(numericId, {
          status: newStatus as IndentStatus,
          items: [], // Send empty array to satisfy backend validation
        });
      }

      // Refresh the data from API to get the latest state
      if (requestData?.apiData?.id) {
        const refreshedIndent = await materialIndentsApi.getById(requestData.apiData.id);
        
        // Build partial receipt history from purchase items
        const partialReceiptHistory: Array<{
          id: string;
          receivedQuantity: number;
          receivedDate: string;
          notes: string;
          receivedBy: string;
          timestamp: string;
          status: IndentStatus;
        }> = [];
        
        // Get selected vendor name from indent items (find first item with selected quotation)
        const selectedVendorName = (() => {
          // Try to find any item with a selected quotation
          for (const item of refreshedIndent.items || []) {
            if (item.selectedQuotation?.vendorName) {
              return item.selectedQuotation.vendorName;
            }
          }
          // Fallback: check if any item has quotations with isSelected=true
          for (const item of refreshedIndent.items || []) {
            const selectedQuotation = item.quotations?.find(q => q.isSelected === true);
            if (selectedQuotation?.vendorName) {
              return selectedQuotation.vendorName;
            }
          }
          return 'Unknown Vendor';
        })();
        
        // Check if backend provides partialReceiptHistory directly
        if (refreshedIndent.partialReceiptHistory && Array.isArray(refreshedIndent.partialReceiptHistory) && refreshedIndent.partialReceiptHistory.length > 0) {
          // Use the backend's partialReceiptHistory if available (this has individual receipts)
          console.log('Using backend partialReceiptHistory (after refresh):', refreshedIndent.partialReceiptHistory);
          refreshedIndent.partialReceiptHistory.forEach((receipt: PartialReceipt) => {
            partialReceiptHistory.push({
              id: String(receipt.id || `receipt-${Date.now()}-${Math.random()}`),
              receivedQuantity: receipt.receivedQuantity || 0,
              receivedDate: receipt.receivedDate || new Date().toISOString().split('T')[0],
              notes: receipt.notes || '',
              receivedBy: receipt.receivedBy || selectedVendorName,
              timestamp: receipt.timestamp || receipt.createdAt || new Date().toISOString(),
              status: (receipt.status as IndentStatus) || IndentStatus.PARTIALLY_RECEIVED,
            });
          });
        } else {
          // Fallback: Extract from purchase items (this only shows cumulative, not individual receipts)
          console.log('Backend does not provide partialReceiptHistory (after refresh), using purchase items (cumulative only)');
          if (refreshedIndent.purchases && refreshedIndent.purchases.length > 0) {
            refreshedIndent.purchases.forEach((purchase) => {
              if (purchase.items && Array.isArray(purchase.items)) {
                purchase.items.forEach((item) => {
                  // Check if this item has received quantity
                  if (item.receivedQuantity && item.receivedQuantity > 0) {
                    // WARNING: This only shows cumulative total, not individual receipts
                    // Backend needs to implement individual receipt tracking
                    partialReceiptHistory.push({
                      id: `receipt-${purchase.id}-${item.id}`,
                      receivedQuantity: item.receivedQuantity,
                      receivedDate: item.receivedDate || purchase.orderDate,
                      notes: item.notes || '',
                      receivedBy: item.receivedBy || selectedVendorName,
                      timestamp: item.updatedAt || new Date().toISOString(),
                      status: item.status === 'fully_received' ? IndentStatus.FULLY_RECEIVED : IndentStatus.PARTIALLY_RECEIVED,
                    });
                  }
                });
              }
            });
          }
        }
        
        // Calculate total received quantity from all receipts
        const totalReceivedQuantity = partialReceiptHistory.reduce((sum, receipt) => 
          sum + (receipt.receivedQuantity || 0), 0
        );

        console.log('Partial Receipt History (After Status Update):', {
          purchaseCount: refreshedIndent.purchases?.length || 0,
          receiptsFound: partialReceiptHistory.length,
          totalReceivedQuantity,
          partialReceiptHistory,
          purchaseItems: refreshedIndent.purchases?.map(p => ({
            id: p.id,
            items: p.items?.map(i => ({
              id: i.id,
              materialName: i.materialName,
              receivedQuantity: i.receivedQuantity,
              receivedDate: i.receivedDate,
              receivedBy: i.receivedBy,
              status: i.status,
            }))
          })),
        });

        // Transform the refreshed data to match the RequestData interface
        const transformedData: RequestData = {
          id: formatPurchaseId(refreshedIndent.uniqueId, refreshedIndent.branch?.code),
          requestedBy: refreshedIndent.requestedBy?.name || 'Unknown',
          location: refreshedIndent.branch?.name || 'Unknown',
          date: refreshedIndent.requestDate,
          status: refreshedIndent.status,
          apiData: {
            ...refreshedIndent,
            partialReceiptHistory,
            totalReceivedQuantity,
          },
          items: refreshedIndent.items.map((item) => ({
            id: item.id.toString(),
            srNo: formatPurchaseId(refreshedIndent.uniqueId, refreshedIndent.branch?.code),
            productName: item.material.name,
            machineName: getMachineName(item), // Use helper function to get correct machine name based on purpose type
            specifications: item.specifications || item.material.specifications || '',
            oldStock: item.currentStock,
            reqQuantity: item.requestedQuantity.toString(),
            measureUnit: item.material.measureUnitId?.toString() || 'units',
            notes: item.notes || '',
            imagePreviews: item.imagePaths || [],
            purposeType: (item as any).purposeType || PurposeType.MACHINE, // Use actual purposeType from API data
            vendorQuotations: item.quotations
              // Show ALL quotations if pending_approval, only selected ones otherwise
              .filter((quotation) => 
                refreshedIndent.status === IndentStatus.PENDING_APPROVAL || quotation.isSelected === true
              )
              .map((quotation) => ({
                id: quotation.id.toString(),
                vendorName: quotation.vendorName,
                contactPerson: quotation.contactPerson,
                phone: quotation.phone,
                price: quotation.price || '0',
                quotedPrice: `₹${quotation.quotationAmount}`,
                quotationAmount: quotation.quotationAmount?.toString() || '0', // Keep raw amount for API
                notes: quotation.notes,
                quotationFile: null,
                isSelected: quotation.isSelected,
                filePaths: quotation.filePaths || [],
              })),
          })),
          selectedVendors: requestData?.selectedVendors || {},
          receiptHistory: refreshedIndent.purchases.map((purchase) => ({
            id: purchase.id.toString(),
            date: purchase.orderDate,
            materialName: refreshedIndent.items[0]?.material.name || 'Unknown',
            quantity: refreshedIndent.items[0]?.requestedQuantity.toString() || '0',
            purchaseOrderNumber: purchase.purchaseOrderNumber,
            totalValue: purchase.totalValue,
            notes: purchase.additionalNotes,
            status: 'purchased',
            items: purchase.items,
          })),
          partialReceiptHistory,
          totalReceivedQuantity,
        };
        
        setRequestData(transformedData);
      }

      // Status-specific success messages
      let successMessage = '';
      let shouldNavigateBack = false;
      
      switch (newStatus) {
        case IndentStatus.APPROVED:
          successMessage = 'Material indent has been approved successfully';
          shouldNavigateBack = true;
          break;
        case IndentStatus.REVERTED:
          successMessage = 'Material indent has been reverted for corrections';
          shouldNavigateBack = true;
          break;
        case IndentStatus.ORDERED:
          successMessage = 'Purchase order has been created successfully';
          shouldNavigateBack = true;
          break;
        case IndentStatus.PARTIALLY_RECEIVED: {
          const receiptCount = (requestData.apiData?.partialReceiptHistory?.length || 0) + 1;
          successMessage = `Material partially received (Receipt #${receiptCount}) and status updated`;
          break;
        }
        case IndentStatus.FULLY_RECEIVED:
          successMessage = 'Material fully received and status updated';
          shouldNavigateBack = true;
          break;
        default:
          successMessage = `Request status changed to ${newStatus.replace('_', ' ')}`;
      }

      toast({
        title: 'Success',
        description: successMessage,
      });

      // Navigate back to MaterialOrderBookTab after successful submission
      // Always navigate back for status changes that require it, especially for company owners
      if (shouldNavigateBack) {
        setTimeout(() => {
          navigate('/materials-inventory', {
            state: { activeTab: 'material-order-book' },
          });
        }, 1500);
      }
    } catch (error: unknown) {
      console.error('Error updating status:', error);
      
      const errorResponse = error as { response?: { data?: { message?: string[] | string; error?: string } }; message?: string };
      console.error('Error response:', errorResponse?.response?.data);

      const errorMessage = Array.isArray(errorResponse?.response?.data?.message) 
        ? errorResponse.response.data.message.join(', ')
        : errorResponse?.response?.data?.message || 
          errorResponse?.response?.data?.error || 
          errorResponse?.message || 
          'Failed to update the request status. Please try again.';

      toast({
        title: 'Status Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    if (!requestData || !requestData.apiData) return;

    try {
      // Extract numeric ID from the request ID
      const numericId = parseInt(
        requestData.id.split('/').pop()?.split('-').pop() || '0',
        10
      );

      if (isNaN(numericId) || numericId <= 0) {
        throw new Error('Invalid request ID format');
      }

      // Transform the edited data back to API format
      const apiUpdateData: Partial<MaterialIndent> = {
        additionalNotes: requestData.items.some((item) => item.notes)
          ? requestData.items.find((item) => item.notes)?.notes
          : undefined,
        // We're only updating notes and specifications, not the entire item structure
        // The API will handle partial updates correctly
      };

      // Update the material indent via API
      const updatedIndent = await materialIndentsApi.update(
        numericId,
        apiUpdateData
      );

      // Update local state with API response
      setRequestData({
        ...requestData,
        apiData: updatedIndent,
      });

      toast({
        title: 'Changes Saved',
        description: 'Request has been updated successfully',
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error saving changes:', error);

      toast({
        title: 'Save Failed',
        description: 'Failed to save changes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleResubmit = async () => {
    if (!requestData || !requestData.apiData || isResubmitting) return;

    setIsResubmitting(true);
    try {
      // Use the API data ID directly
      const numericId = requestData.apiData.id;

      if (!numericId || numericId <= 0) {
        throw new Error('Invalid request ID');
      }

      console.log('Resubmitting request:', {
        numericId,
        currentStatus: requestData.status,
        itemsCount: requestData.items.length,
      });

      // Use the reSubmit method specifically for reverted indents
      const resubmitData: any = {
        status: IndentStatus.PENDING_APPROVAL,
        additionalNotes: requestData.items.some((item) => item.notes)
          ? `Resubmitted by ${
              currentUser?.name || 'Supervisor'
            } on ${new Date().toLocaleDateString()}. ${
              requestData.items.find((item) => item.notes)?.notes || ''
            }`
          : `Resubmitted by ${
              currentUser?.name || 'Supervisor'
            } on ${new Date().toLocaleDateString()}.`,
        // Transform items to exclude IDs (let backend create new records)
        items: requestData.apiData.items.map((item: any) => ({
          materialId: item.material.id,
          specifications: item.specifications,
          requestedQuantity: item.requestedQuantity,
          notes: item.notes,
          currentStock: item.currentStock,
          machineId: item.machine?.id,
          // Transform quotations to exclude IDs
          quotations: item.quotations?.map((quotation: any) => ({
            vendorName: quotation.vendorName,
            contactPerson: quotation.contactPerson,
            phone: quotation.phone,
            price: quotation.price,
            quotationAmount: quotation.quotationAmount,
            notes: quotation.notes,
            isSelected: quotation.isSelected,
            filePaths: quotation.filePaths,
          })) || []
        }))
      };

      console.log('Resubmit data being sent:', resubmitData);

      // Add retry logic for 502 errors
      let updatedIndent;
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount < maxRetries) {
        try {
          updatedIndent = await materialIndentsApi.reSubmit(numericId, resubmitData);
          break; // Success, exit retry loop
        } catch (error: unknown) {
          retryCount++;
          const errorResponse = error as { response?: { status?: number; data?: any } };
          
          console.log(`Resubmit attempt ${retryCount} failed:`, errorResponse);
          
          // If it's a 502 error and we have retries left, wait and retry
          if (errorResponse?.response?.status === 502 && retryCount < maxRetries) {
            console.log(`502 error on attempt ${retryCount}, retrying in ${retryCount * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
            continue;
          }
          
          // If it's not a 502 error or we've exhausted retries, throw the error
          throw error;
        }
      }

      console.log('Resubmission successful:', updatedIndent);

      // Update local state with API response
      const updatedData = {
        ...requestData,
        status: IndentStatus.PENDING_APPROVAL,
        apiData: updatedIndent,
      };

      setRequestData(updatedData);

      toast({
        title: 'Request Resubmitted',
        description:
          'Request has been resubmitted for approval with updated vendor quotations',
      });

      // Navigate back to MaterialOrderBookTab after successful resubmission
      setTimeout(() => {
        navigate('/materials-inventory', {
          state: { activeTab: 'material-order-book' },
        });
      }, 1500);
    } catch (error: unknown) {
      console.error('Error resubmitting request:', error);
      
      const errorResponse = error as { response?: { data?: { message?: string[] | string; error?: string } }; message?: string };
      console.error('Error response:', errorResponse?.response?.data);

      const errorMessage = Array.isArray(errorResponse?.response?.data?.message) 
        ? errorResponse.response.data.message.join(', ')
        : errorResponse?.response?.data?.message ||
          errorResponse?.response?.data?.error || 
          errorResponse?.message || 
          'Failed to resubmit the request. Please try again.';

      toast({
        title: 'Resubmission Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleVendorQuotationChange = (
    itemId: string,
    quotations: VendorQuotation[]
  ) => {
    if (!requestData) return;

    setRequestData((prev) => ({
      ...prev!,
      items: prev!.items.map((item) =>
        item.id === itemId ? { ...item, vendorQuotations: quotations } : item
      ),
    }));
  };

  const canEdit = () => {
    if (!requestData) return false;

    // Require update permission
    if (!hasPermission('inventory:material-indents:update')) return false;

    // Approvers don't edit in this flow
    if (hasPermission('inventory:material-indents:approve')) return false;

    // Only allow editing for reverted requests
    return requestData.status === IndentStatus.REVERTED;
  };

  const isReadOnly = () => {
    if (!requestData) return true;

    if (hasPermission('inventory:material-indents:approve')) {
      return true; // Always read-only for approvers here
    }

    if (hasPermission('inventory:material-indents:update')) {
      // Only allow editing for reverted requests, read-only for all others
      return requestData.status !== IndentStatus.REVERTED;
    }

    return true;
  };

  // Removed separate vendor selector in favor of approval dialog

  const shouldShowStatusDropdown = () => {
    if (!requestData) return false;

    if (isCompanyLevel() && hasPermission('inventory:material-indents:approve')) {
      return requestData.status === 'pending_approval';
    }

    if (!isCompanyLevel() && hasPermission('inventory:material-indents:update')) {
      return ['approved', 'ordered', 'partially_received'].includes(
        requestData.status
      );
    }

    return false;
  };

  // Add function to check if all items have vendors selected
  const checkAllVendorsSelected = () => {
    if (!requestData?.apiData?.items) return false;
    
    return requestData.apiData.items.every(item => {
      // Check if this item has a selected vendor in the selectedVendors state
      return selectedVendors[item.id.toString()] && selectedVendors[item.id.toString()].trim() !== '';
    });
  };

  // Add function to check if there are no vendor quotations for any item
  const checkNoVendorQuotations = () => {
    if (!requestData?.apiData?.items) return false;
    
    return requestData.apiData.items.every(item => {
      // Check if this item has no vendor quotations
      return !item.quotations || item.quotations.length === 0;
    });
  };

  // Add function to check if print icon should be shown
  // const shouldShowPrintIcon = () => {
  //   if (!requestData) return false;
  //   
  //   const allowedStatuses = ['approved', 'ordered', 'partially_received', 'fully_received'];
  //   return allowedStatuses.includes(requestData.status);
  // };

  // State for last five material indents
  const [lastFiveIndents, setLastFiveIndents] = useState<MaterialIndent[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Item and quotation image URLs state
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string[]>>(
    {}
  );
  const [quotationImageUrls, setQuotationImageUrls] = useState<
    Record<string, string[]>
  >({});

  const handleFetchItemImages = async (itemId: number) => {
    try {
      if (!requestData?.apiData?.id) return;
      const urls = await materialIndentsApi.getItemImageUrls(
        requestData.apiData.id,
        itemId
      );
      setItemImageUrls((prev) => ({ ...prev, [String(itemId)]: urls }));
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load item images',
        variant: 'destructive',
      });
    }
  };

  const handleFetchQuotationImages = async (itemId: number) => {
    try {
      if (!requestData?.apiData?.id) return;
      const urls = await materialIndentsApi.getItemQuotationImageUrls(
        requestData.apiData.id,
        itemId
      );
      setQuotationImageUrls((prev) => ({ ...prev, [String(itemId)]: urls }));
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load quotation images',
        variant: 'destructive',
      });
    }
  };

  // Fetch last five material indents for the current material
  useEffect(() => {
    const fetchLastFiveIndents = async () => {
      if (!hasPermission('inventory:material-indents:read:all')) return;
      if (!requestData?.apiData?.items?.[0]?.material?.id) return;

      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        // Get the material ID from the first item in the request
        const materialId = requestData.apiData.items[0].material.id;
        console.log('Fetching last 5 indents for material ID:', materialId);
        
        const indents = await materialIndentsApi.getLastFive(materialId);
        // Sort by date descending (newest first), then by uniqueId descending
        const sortedIndents = indents.sort((a, b) => {
          // First, sort by date (newest first)
          const dateComparison = new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
          if (dateComparison !== 0) return dateComparison;
          
          // If dates are equal, sort by uniqueId (descending)
          return b.uniqueId.localeCompare(a.uniqueId);
        });
        setLastFiveIndents(sortedIndents);
      } catch (error) {
        console.error('Error fetching last five indents:', error);
        setHistoryError('Failed to load recent Last 5 Material Transactions.');
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchLastFiveIndents();
  }, [hasPermission, requestData?.apiData?.items]);

  const getHistoryData = () => {
    if (!requestData) return [];

    if (hasPermission('inventory:material-indents:read:all')) {
      // Use the last five indents from API - filter only partially_received and fully_received
      return lastFiveIndents
        .filter((indent) => 
          indent.status === IndentStatus.PARTIALLY_RECEIVED || 
          indent.status === IndentStatus.FULLY_RECEIVED
        )
        .map((indent) => {
          // Get the first item for display purposes
          const firstItem =
            indent.items && indent.items.length > 0 ? indent.items[0] : null;
          
          // Use ONLY the selected quotation (approved by company owner)
          // Try multiple approaches to find the selected quotation:
          // 1. Check if selectedQuotation is directly available
          let selectedQuotation = firstItem?.selectedQuotation || null;
          
          // 2. If not found, look for quotation with isSelected === true
          if (!selectedQuotation && firstItem?.quotations) {
            selectedQuotation = firstItem.quotations.find(q => q.isSelected === true) || null;
          }

          // Log for debugging which vendor was selected
          if (selectedQuotation) {
            console.log(`History item ${indent.uniqueId}: Selected vendor is ${selectedQuotation.vendorName} with price ₹${selectedQuotation.quotationAmount}`);
          }

          return {
            id: formatPurchaseId(indent.uniqueId, indent.branch?.code), // Apply formatting here too
            date: indent.requestDate,
            materialName: firstItem?.material?.name || 'Unknown',
            quantity: firstItem ? `${firstItem.requestedQuantity}` : '0',
            purchaseValue: selectedQuotation ? selectedQuotation.quotationAmount : '0', // Use selected vendor's quotation amount
            previousMaterialValue: '0', // Default value
            perMeasureQuantity: '1', // Default value
            requestedValue: selectedQuotation ? selectedQuotation.quotationAmount : '0', // Use selected vendor's quotation amount
            currentValue: selectedQuotation ? selectedQuotation.quotationAmount : '0', // Use selected vendor's quotation amount
            status: indent.status,
            requestedBy: indent.requestedBy?.name,
            location: indent.branch?.name || 'Unknown',
            purchasedFrom: selectedQuotation?.vendorName || 'No Vendor', // Show selected vendor name (approved by company owner)
          };
        })
        .slice(0, 5); // Take only the first 5 after filtering
    } else {
      // For supervisor, show receipt history from current indent
      // Get the selected vendor from the current indent's first item
      const firstItem = requestData.apiData?.items?.[0];
      let selectedQuotation = firstItem?.selectedQuotation || null;
      
      // Fallback: look for quotation with isSelected === true
      if (!selectedQuotation && firstItem?.quotations) {
        selectedQuotation = firstItem.quotations.find(q => q.isSelected === true) || null;
      }
      
      const selectedVendorName = selectedQuotation?.vendorName || 'No Vendor';
      
      // Return receipt history for supervisor, but ensure it matches the HistoryItem interface
      return (requestData.receiptHistory || [])
        .map((item) => ({
          ...item,
          purchaseValue: item.totalValue || '0',
          previousMaterialValue: '0', // Default value
          perMeasureQuantity: '1', // Default value
          requestedValue: item.totalValue || '0',
          currentValue: item.totalValue || '0',
          purchasedFrom: selectedVendorName, // Use the selected vendor from the indent
        }))
        .sort((a, b) => {
          // First, sort by date (newest first)
          const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateComparison !== 0) return dateComparison;
          
          // If dates are equal, sort by ID (descending)
          return b.id.localeCompare(a.id);
        });
    }
  };



  // New function to create purchase order
  const handleCreatePurchaseOrder = async () => {
    if (!requestData || !requestData.apiData) {
      toast({
        title: 'Error',
        description: 'No indent data available for ordering.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const purchaseData = {
        purchaseOrderNumber: `PO-${requestData.apiData.uniqueId}`,
        orderDate: new Date().toISOString().split('T')[0],
        additionalNotes: requestData.apiData.additionalNotes || '',
        indentId: requestData.apiData.id,
      };

      const createdPurchase = await materialPurchasesApi.create(purchaseData);

      toast({
        title: 'Success',
        description: 'Purchase order created successfully.',
      });

      setIsOrderDialogOpen(false);
      setRequestData((prev) =>
        prev ? { ...prev, status: createdPurchase.status } : null
      );
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
    try {
      // Check if receipt history exists and has items
      if (!requestData?.receiptHistory || requestData.receiptHistory.length === 0) {
        toast({
          title: 'Error',
          description: 'No purchase orders found for this request.',
          variant: 'destructive',
        });
        return;
      }

      //  take from receipt history of the request
      const selectedPurchase = requestData.receiptHistory[0];
      const firstItem = selectedPurchase?.items?.[0];
      
      if (!firstItem) {
        toast({
          title: 'Error',
          description: 'No items found in this purchase order.',
          variant: 'destructive',
        });
        return;
      }

      await materialPurchasesApi.receiveItem(
        Number(selectedPurchase.id),
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

      // Refresh the request data
      if (requestData?.apiData) {
        const updatedIndent = await materialIndentsApi.getById(
          requestData.apiData.id
        );
        setRequestData((prev) =>
          prev
            ? { ...prev, apiData: updatedIndent, status: updatedIndent.status }
            : null
        );
      }
    } catch (error) {
      console.error('Error receiving material:', error);
      toast({
        title: 'Error',
        description: 'Failed to receive material. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Enhanced action buttons for different workflow stages
  const renderWorkflowActions = () => {
    if (!requestData || !requestData.apiData) return null;

    // Only show status dropdown for users who can update status
    const canUpdateStatus = 
      hasPermission('inventory:material-indents:approve') ||
      hasPermission('inventory:material-indents:update');

    if (!canUpdateStatus) return null;

    // Show dropdown for more statuses including 'ordered'
    const allowedStatuses = [
      'pending_approval',
      'approved',
      'ordered',
      'partially_received',
      'fully_received',
      'issued'
    ];

    if (!allowedStatuses.includes(requestData.status)) return null;

    return (
      <StatusDropdown
        currentStatus={requestData.status}
        userRole={
          isCompanyLevel()
            ? 'company_owner'
            : 'supervisor'
        }
        onStatusChange={handleStatusChange}
        requestId={requestData.id}
        hasVendorSelected={checkAllVendorsSelected()}
        hasNoVendorQuotations={checkNoVendorQuotations()}
        onResetPending={setResetStatusDropdown}
        partialReceiptHistory={requestData.apiData?.partialReceiptHistory || []}
        purposeType={requestData.apiData?.items?.[0]?.purposeType} // Get purposeType from first item
      />
    );
  };

  // Update the back button navigation
  const handleBackNavigation = () => {
    // Navigate back to the MaterialOrderBookTab (materials-inventory with material-order-book tab)
    navigate('/materials-inventory', {
      state: { activeTab: 'material-order-book' },
    });
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Loader2 className='animate-spin h-32 w-32 text-primary mx-auto' />
          <p className='mt-4 text-muted-foreground'>
            Loading request details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h2 className='text-2xl font-bold text-foreground mb-2'>
            Error Loading Request
          </h2>
          <p className='text-muted-foreground mb-4'>{error}</p>
          <Button onClick={() => navigate(-1)} className='mr-2'>
            Go Back
          </Button>
          <Button onClick={() => window.location.reload()} variant='outline'>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h2 className='text-2xl font-bold text-foreground mb-2'>
            Request Not Found
          </h2>
          <p className='text-muted-foreground mb-4'>
            The requested material indent could not be found.
          </p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-0 p-2 sm:p-6'>
      {/* Header - Desktop */}
      <div className='hidden lg:flex items-center justify-between'>
        <div className='flex items-center gap-6'>
          <Button
            variant='outline'
            size='sm'
            onClick={() =>
              navigate('/materials-inventory', {
                state: { activeTab: 'material-order-book' },
              })
            }
            className='gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Back
          </Button>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>
              Request Details
            </h1>
            <p className='text-muted-foreground'>
              {hasPermission('inventory:material-indents:approve')
                ? 'Review and approve request'
                : 'Manage request status'}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-6'>
          {/* Request Summary Info */}
          <div className='flex items-center gap-6 text-sm'>
            <div className='flex items-center gap-2'>
              {/* {shouldShowPrintIcon() && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setIsPrintDialogOpen(true)}
                  className='gap-1 px-2 py-1'
                  title='Print Request Details'
                >
                  <Printer className='w-4 h-4' />
                </Button>
              )} */}
              <div>
                <Label className='text-xs font-medium text-muted-foreground'>
                  Requested By
                </Label>
                <div className='font-semibold'>
                  {requestData.requestedBy}
                </div>
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Unit
              </Label>
              <div className='font-semibold'>
                {requestData.location}
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Requested Date
              </Label>
              <div className='font-semibold'>
                {formatDateToDDMMYYYY(requestData.date)}
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Status
              </Label>
              {(hasPermission('inventory:material-indents:update') || 
                hasPermission('inventory:material-indents:approve')) ? (
                <StatusDropdown
                  currentStatus={requestData.status}
                  userRole={
                    isCompanyLevel()
                      ? 'company_owner'
                      : 'supervisor'
                  }
                  onStatusChange={handleStatusChange}
                  requestId={requestData.id}
                  hasVendorSelected={checkAllVendorsSelected()}
                  hasNoVendorQuotations={checkNoVendorQuotations()}
                  onResetPending={setResetStatusDropdown}
                  partialReceiptHistory={requestData.apiData?.partialReceiptHistory || []}
                  requiredQuantity={requestData.apiData?.items?.[0]?.requestedQuantity || 0}
                  purposeType={requestData.apiData?.items?.[0]?.purposeType} // Get purposeType from first item
                />
              ) : (
                <Badge className='mt-1'>{requestData.status}</Badge>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className='flex items-center gap-3'>
            {canEdit() && !isEditing && (
              <Button onClick={() => setIsEditing(true)} className='gap-2'>
                <FileEdit className='w-4 h-4' />
                Edit Request
              </Button>
            )}

            {isEditing && (
              <Button onClick={handleSave} className='gap-2'>
                <Save className='w-4 h-4' />
                Save Changes
              </Button>
            )}

            
          </div>
        </div>
      </div>

      {/* Header - Mobile */}
      <div className='lg:hidden space-y-3'>
        {/* Row 1: Back Button + Title */}
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='sm'
            onClick={() =>
              navigate('/materials-inventory', {
                state: { activeTab: 'material-order-book' },
              })
            }
            className='gap-1 px-2 py-1 flex-shrink-0'
          >
            <ArrowLeft className='w-4 h-4' />
            <span className='text-xs'>Back</span>
          </Button>
          <div className='flex-1 min-w-0'>
            <h1 className='text-base sm:text-lg font-bold text-foreground truncate'>
              Request Details
            </h1>
            <p className='text-xs text-muted-foreground truncate'>
              {hasPermission('inventory:material-indents:approve')
                ? 'Review and approve'
                : 'Manage status'}
            </p>
          </div>
        </div>

        {/* Row 2: Request Info Grid */}
        <div className='grid grid-cols-2 gap-2 bg-secondary/10 p-3 rounded-lg'>
          <div className='flex items-center gap-2'>
            {/* {shouldShowPrintIcon() && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => setIsPrintDialogOpen(true)}
                className='gap-1 px-2 py-1 flex-shrink-0'
                title='Print Request Details'
              >
                <Printer className='w-3 h-3' />
              </Button>
            )} */}
            <div className='flex-1 min-w-0'>
              <Label className='text-[10px] font-medium text-muted-foreground'>
                Requested By
              </Label>
              <div className='font-semibold text-xs truncate'>
                {requestData.requestedBy}
              </div>
            </div>
          </div>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Unit
            </Label>
            <div className='font-semibold text-xs truncate'>
              {requestData.location}
            </div>
          </div>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Date
            </Label>
            <div className='font-semibold text-xs'>
              {formatDateToDDMMYYYY(requestData.date)}
            </div>
          </div>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Status
            </Label>
            <div className='mt-1'>
              {(hasPermission('inventory:material-indents:update') || 
                hasPermission('inventory:material-indents:approve')) ? (
                <StatusDropdown
                  currentStatus={requestData.status}
                  userRole={
                    isCompanyLevel()
                      ? 'company_owner'
                      : 'supervisor'
                  }
                  onStatusChange={handleStatusChange}
                  requestId={requestData.id}
                  hasVendorSelected={checkAllVendorsSelected()}
                  hasNoVendorQuotations={checkNoVendorQuotations()}
                  onResetPending={setResetStatusDropdown}
                  partialReceiptHistory={requestData.apiData?.partialReceiptHistory || []}
                  requiredQuantity={requestData.apiData?.items?.[0]?.requestedQuantity || 0}
                  purposeType={requestData.apiData?.items?.[0]?.purposeType}
                />
              ) : (
                <Badge className='text-[10px]'>{requestData.status}</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Action Buttons (if applicable) */}
        {(canEdit() || isEditing) && (
          <div className='flex items-center gap-2'>
            {canEdit() && !isEditing && (
              <Button onClick={() => setIsEditing(true)} className='flex-1 gap-2 text-xs h-9'>
                <FileEdit className='w-4 h-4' />
                Edit Request
              </Button>
            )}

            {isEditing && (
              <Button onClick={handleSave} className='flex-1 gap-2 text-xs h-9'>
                <Save className='w-4 h-4' />
                Save Changes
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className='w-full'>
        {/* Request Form - Full Width */}
        <div className='space-y-5'>
          {currentUser?.role === 'supervisor' &&
          requestData.status === IndentStatus.REVERTED ? (
            // For reverted requests, show full editable form like MaterialRequest.tsx
            <RequisitionIndentForm
              requestData={requestData}
              isReadOnly={false} // Allow editing for reverted requests
              onItemChange={handleItemChange}
              onVendorQuotationChange={handleVendorQuotationChange}
              availableMaterials={availableMaterials}
              machines={machines}
              onLoadItemImages={(itemId) => handleFetchItemImages(itemId)}
              onLoadQuotationImages={(itemId) =>
                handleFetchQuotationImages(itemId)
              }
              itemImageUrlsMap={itemImageUrls}
              quotationImageUrlsMap={quotationImageUrls}
              onStatusChange={handleStatusChange}
              userRole={
                isCompanyLevel()
                  ? 'company_owner'
                  : 'supervisor'
              }
              hasPermission={hasPermission}
              selectedVendors={selectedVendors}
              onVendorSelection={(newSelection) => setSelectedVendors(newSelection)}
            />
          ) : currentUser?.role === 'supervisor' &&
            ['approved', 'ordered', 'partially_received', 'issued'].includes(
              requestData.status
            ) ? (
            <SupervisorRequestForm
              requestData={requestData}
              selectedStatuses={selectedStatuses}
              onStatusSelect={handleStatusSelect}
              onSubmit={handleSupervisorSubmit}
            />
          ) : (
            // For all other cases (including material_received, completed, rejected), show read-only form
            <>
              <RequisitionIndentForm
                requestData={requestData}
                isReadOnly={true} // Always read-only for completed/final statuses
                onItemChange={handleItemChange}
                availableMaterials={availableMaterials}
                machines={machines}
                onLoadItemImages={(itemId) => handleFetchItemImages(itemId)}
                onLoadQuotationImages={(itemId) =>
                  handleFetchQuotationImages(itemId)
                }
                itemImageUrlsMap={itemImageUrls}
                quotationImageUrlsMap={quotationImageUrls}
                onStatusChange={handleStatusChange}
                userRole={
                  isCompanyLevel()
                    ? 'company_owner'
                    : 'supervisor'
                }
                hasPermission={hasPermission}
                selectedVendors={selectedVendors}
                onVendorSelection={(newSelection) => setSelectedVendors(newSelection)}
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom Section - Status and History */}
      <div className='mt-8 space-y-6'>
        {/* Request Status Card */}

        {/* History Section - Only for Company Owners */}
        {hasPermission('inventory:material-indents:read:all') && requestData?.apiData?.items?.[0]?.material && (
          <>
            {isLoadingHistory ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                  Last 5 Material Transactions - {requestData.apiData.items[0].material.name}
                  </CardTitle>
                  <p className='text-sm text-muted-foreground mt-1'>
                    Last 5 received transactions (Partially & Fully Received)
                  </p>
                </CardHeader>
                <CardContent className='flex justify-center items-center py-8'>
                  <Loader2 className='h-8 w-8 animate-spin text-primary' />
                  <p className='ml-2 text-muted-foreground'>
                    Loading history...
                  </p>
                </CardContent>
              </Card>
            ) : historyError ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                  Last 5 Material Transactions - {requestData.apiData.items[0].material.name}
                  </CardTitle>
                  
                </CardHeader>
                <CardContent className='py-6'>
                  <div className='text-center'>
                    <p className='text-muted-foreground mb-2'>{historyError}</p>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => {
                        const materialId = requestData?.apiData?.items?.[0]?.material?.id;
                        if (!materialId) return;
                        
                        setIsLoadingHistory(true);
                        setHistoryError(null);
                        materialIndentsApi
                          .getLastFive(materialId)
                          .then((indents) => {
                            // Sort by date descending (newest first), then by uniqueId descending
                            const sortedIndents = indents.sort((a, b) => {
                              // First, sort by date (newest first)
                              const dateComparison = new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime();
                              if (dateComparison !== 0) return dateComparison;
                              
                              // If dates are equal, sort by uniqueId (descending)
                              return b.uniqueId.localeCompare(a.uniqueId);
                            });
                            setLastFiveIndents(sortedIndents);
                          })
                          .catch((err) => {
                            console.error('Error fetching history:', err);
                            setHistoryError(
                              'Failed to load recent received history for this material.'
                            );
                          })
                          .finally(() => setIsLoadingHistory(false));
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <HistoryView
                userRole='company_owner'
                historyData={getHistoryData()}
                requestId={requestData.id}
                materialName={requestData.apiData.items[0].material.name}
                title={`Last 5 Material Transactions - ${requestData.apiData.items[0].material.name}`}
              />
            )}
          </>
        )}
      </div>

      {/* Approval Dialog */}
      {requestData?.apiData && (
        <ConfirmApproveDialog
          isOpen={isApprovalDialogOpen}
          onClose={() => {
            setIsApprovalDialogOpen(false);
            if (resetStatusDropdown) {
              resetStatusDropdown();
            }
          }}
          onSuccess={async () => {
            // Refresh the request data after successful approval
            const updatedIndent = await materialIndentsApi.getById(requestData.apiData.id);
            setRequestData((prev) =>
              prev
                ? { ...prev, apiData: updatedIndent, status: updatedIndent.status }
                : null
            );
            setSelectedVendors({});
            
            
            toast({
              title: 'Success',
              description: 'Material indent approved successfully.',
            });

            // Navigate back to MaterialOrderBookTab after successful approval for company owners
            if (isCompanyLevel()) {
              setTimeout(() => {
                navigate('/materials-inventory', {
                  state: { activeTab: 'material-order-book' },
                });
              }, 1500);
            }
          }}
          materialIndent={requestData.apiData}
          preSelectedVendors={selectedVendors}
        />
      )}


      {/* Order Creation Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            {requestData?.apiData && (
              <div className='space-y-4'>
                <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg'>
                  <h3 className='font-semibold text-blue-800 mb-2'>
                    Indent Details
                  </h3>
                  <p>
                    <strong>ID:</strong> {requestData.apiData.uniqueId}
                  </p>
                  <p>
                    <strong>Requested By:</strong>{' '}
                    {requestData.apiData.requestedBy?.name}
                  </p>
                  <p>
                    <strong>Date:</strong>{' '}
                    {new Date(
                      requestData.apiData.requestDate
                    ).toLocaleDateString()}
                  </p>
                </div>

                <div className='space-y-3'>
                  <h4 className='font-semibold'>Items to Order:</h4>
                  <div className='space-y-2'>
                    {requestData.apiData.items.map((item) => (
                      <div
                        key={item.id}
                        className='p-3 bg-gray-50 rounded border'
                      >
                        <p>
                          <strong>{item.material.name}</strong>
                          {item.material.makerBrand && (
                            <div className='text-sm text-muted-foreground mt-1'>
                              {item.material.makerBrand}
                            </div>
                          )}
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
            {requestData?.receiptHistory && requestData.receiptHistory.length > 0 && requestData.receiptHistory[0] ? (
              <div className='space-y-4'>
                <div className='p-4 bg-orange-50 border border-orange-200 rounded-lg'>
                  <h3 className='font-semibold text-orange-800 mb-2'>
                    Purchase Order Details
                  </h3>
                  <p>
                    <strong>PO Number:</strong>{' '}
                    {requestData.receiptHistory[0].purchaseOrderNumber}
                  </p>
                  <p>
                    <strong>Order Date:</strong>{' '}
                    {new Date(
                      requestData.receiptHistory[0].date
                    ).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Total Value:</strong> ₹
                    {requestData.receiptHistory[0].totalValue}
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
            ) : (
              <div className='text-center py-8'>
                <p className='text-muted-foreground mb-4'>
                  No purchase orders found for this request.
                </p>
                <p className='text-sm text-muted-foreground'>
                  Please create a purchase order first before receiving materials.
                </p>
                <div className='mt-4'>
                  <Button
                    variant='outline'
                    onClick={() => setIsReceiveDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Dialog */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Printer className='w-5 h-5' />
              Print Request Details
            </DialogTitle>
          </DialogHeader>
          <div className='space-y-6'>
            {requestData && (
              <div className='space-y-6'>
                {/* Header Information */}
                <div className='bg-gray-50 p-4 rounded-lg'>
                  <h3 className='text-lg font-semibold mb-4'>Request Information</h3>
                  <div className='grid grid-cols-2 gap-4 text-sm'>
                    <div>
                      <span className='font-medium'>Request ID:</span> {requestData.id}
                    </div>
                    <div>
                      <span className='font-medium'>Requested By:</span> {requestData.requestedBy}
                    </div>
                    <div>
                      <span className='font-medium'>Unit/Location:</span> {requestData.location}
                    </div>
                    <div>
                      <span className='font-medium'>Request Date:</span> {formatDateToDDMMYYYY(requestData.date)}
                    </div>
                    <div>
                      <span className='font-medium'>Status:</span> approved
                    </div>
                    <div>
                      <span className='font-medium'>Approved By:</span> {requestData.apiData?.approvedBy?.name || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className='space-y-4'>
                  <h3 className='text-lg font-semibold'>Requested Items</h3>
                  {requestData.items.map((item, index) => (
                    <div key={item.id} className='border border-gray-200 rounded-lg p-4'>
                      <div className='flex justify-between items-start mb-3'>
                        <h4 className='font-semibold text-lg'>Item {index + 1}</h4>
                        <Badge variant='outline'>{item.purposeType}</Badge>
                      </div>
                      
                      <div className='grid grid-cols-2 gap-4 text-sm mb-4'>
                        <div>
                          <span className='font-medium'>Material Name:</span> {item.productName}
                        </div>
                        <div>
                          <span className='font-medium'>Machine:</span> {item.machineName}
                        </div>
                        <div>
                          <span className='font-medium'>Specifications:</span> {item.specifications || 'N/A'}
                        </div>
                        <div>
                          <span className='font-medium'>Current Stock:</span> {item.oldStock}
                        </div>
                        <div>
                          <span className='font-medium'>Requested Quantity:</span> {item.reqQuantity} {item.measureUnit}
                        </div>
                        <div>
                          <span className='font-medium'>Notes:</span> {item.notes || 'N/A'}
                        </div>
                      </div>

                      {/* Vendor Quotations */}
                      {item.vendorQuotations && item.vendorQuotations.length > 0 && (
                        <div className='mt-4'>
                          <h5 className='font-semibold mb-3'>Vendor Quotations</h5>
                          <div className='space-y-3'>
                            {item.vendorQuotations.map((quotation, qIndex) => (
                              <div 
                                key={quotation.id} 
                                className={`p-3 rounded-lg border ${
                                  quotation.isSelected 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}
                              >
                                <div className='flex justify-between items-start mb-2'>
                                  <h6 className='font-medium'>{quotation.vendorName}</h6>
                                  {quotation.isSelected && (
                                    <Badge className='bg-green-600'>Selected</Badge>
                                  )}
                                </div>
                                <div className='grid grid-cols-2 gap-2 text-sm'>
                                  <div>
                                    <span className='font-medium'>Contact Person:</span> {quotation.contactPerson}
                                  </div>
                                  <div>
                                    <span className='font-medium'>Phone:</span> {quotation.phone}
                                  </div>
                                  <div>
                                    <span className='font-medium'>Price per Unit:</span> ₹{quotation.price}
                                  </div>
                                  <div>
                                    <span className='font-medium'>Total Amount:</span> {quotation.quotedPrice}
                                  </div>
                                  {quotation.notes && (
                                    <div className='col-span-2'>
                                      <span className='font-medium'>Notes:</span> {quotation.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Additional Notes */}
                {requestData.apiData?.additionalNotes && (
                  <div className='bg-blue-50 p-4 rounded-lg'>
                    <h3 className='font-semibold mb-2'>Additional Notes</h3>
                    <p className='text-sm'>{requestData.apiData.additionalNotes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dialog Actions */}
          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button
              variant='outline'
              onClick={() => setIsPrintDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.print();
                setIsPrintDialogOpen(false);
              }}
              className='gap-2'
            >
              <Printer className='w-4 h-4' />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestDetails;