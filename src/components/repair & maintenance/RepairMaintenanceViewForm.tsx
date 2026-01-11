import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
  Wrench,
  X,
  Plus,
  ArrowLeft,
  Loader2,
  UserRoundPlus,
  Eye,
  Trash2,
  FileText,
  Edit,
  Save,
  File,
  FileImage,
  Download,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { RepairMaintenanceForm } from './RepairMaintenanceForm';
import {
  RepairMaintenanceType,
  RepairMaintenanceStatus,
  RepairMaintenance,
} from '../../lib/api/repair-maintenance.ts';
import { repairMaintenanceApi } from '../../lib/api/repair-maintenance.ts';
import { useRole } from '../../contexts/RoleContext';
import { machinesApi } from '../../lib/api/machines';
import { Machine } from '../../lib/api/types';
import { toast } from '../../hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { formatDateToDDMMYYYY } from '../../lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';

interface VendorQuotation {
  id: string;
  vendorName: string;
  contactPerson: string;
  phone: string;
  price: string;
  quotedPrice: string;
  notes: string;
  quotationFile?: File | null;
  filePaths?: string[]; // Add filePaths for API data
  quotationFilePaths?: string[]; // API returns quotationFilePaths
  quotationFileUrls?: string[]; // API may return presigned URLs
  isSelected?: boolean;
}

interface RepairMaintenanceItem {
  id: string;
  srNo: string;
  nameOfWork: string;
  typeOfWork: RepairMaintenanceType;
  machineId?: number;
  machineName: string;
  totalAmount: string;
  description: string;
  images?: File[];
  imagePreviews?: string[];
  vendorQuotations?: VendorQuotation[];
}

const RepairMaintenanceViewForm = () => {
  const { currentUser, hasPermission } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);

  // Status change state
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [displayedStatus, setDisplayedStatus] = useState<string>('');

  const [orderData, setOrderData] = useState<RepairMaintenance | undefined>(undefined);
  
  // Fetch order data from API or location state
  useEffect(() => {
    const fetchOrderData = async () => {
      setIsLoading(true);
      
      try {
        let data: RepairMaintenance | undefined;
        
        // First try location state (for navigation from list)
        if (location.state?.orderData) {
          data = location.state.orderData as RepairMaintenance;
        }
        // Then try sessionStorage (fallback)
        else if (sessionStorage.getItem('repairMaintenanceOrderData')) {
          const storedData = sessionStorage.getItem('repairMaintenanceOrderData');
          if (storedData) {
            try {
              data = JSON.parse(storedData) as RepairMaintenance;
            } catch (error) {
              console.error('Error parsing stored order data:', error);
            }
          }
        }
        // Finally try API if we have an ID in URL params
        else if (id) {
          const orderId = parseInt(id, 10);
          if (!isNaN(orderId)) {
            data = await repairMaintenanceApi.getById(orderId);
          }
        }
        
        if (data) {
          setOrderData(data);
          console.log('Order data loaded:', data.orderId);
        } else {
          toast({
            title: 'Error',
            description: 'No order data found. Please select an order from the list.',
            variant: 'destructive',
          });
          setTimeout(() => {
            navigate('/materials-inventory?tab=repair-maintenance', {
              state: { activeTab: 'repair-maintenance' },
            });
          }, 2000);
        }
      } catch (error: any) {
        console.error('Error fetching order data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load order details. Please try again.',
          variant: 'destructive',
        });
        setTimeout(() => {
          navigate('/materials-inventory?tab=repair-maintenance', {
            state: { activeTab: 'repair-maintenance' },
          });
        }, 2000);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOrderData();
  }, [location.state, id, navigate]);

  // Update displayed status when orderData changes
  useEffect(() => {
    if (orderData) {
      // Always use the actual status from orderData
      setDisplayedStatus(orderData.status);
    }
  }, [orderData]);

  // Vendor quotations state
  const [isVendorFormOpen, setIsVendorFormOpen] = useState(false);
  const [isViewQuotationsOpen, setIsViewQuotationsOpen] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string>('');
  const [currentQuotations, setCurrentQuotations] = useState<VendorQuotation[]>([]);
  const [vendorFormData, setVendorFormData] = useState<VendorQuotation>({
    id: '',
    vendorName: '',
    contactPerson: '',
    phone: '',
    price: '',
    quotedPrice: '',
    notes: '',
    quotationFile: null,
  });

  // Vendor selection state
  const [selectedVendors, setSelectedVendors] = useState<Record<string, string>>({});
  const [isSelectingVendor, setIsSelectingVendor] = useState(false);

  // Handle vendor selection - call API to select vendor quotation
  const handleVendorSelection = async (vendors: Record<string, string>) => {
    if (!orderData || orderData.status !== RepairMaintenanceStatus.PENDING_APPROVAL) {
      console.warn('Vendor selection only allowed when status is pending_approval');
      return;
    }

    // Find the newly selected vendor (compare with current selectedVendors)
    const newSelections = Object.entries(vendors).filter(([itemId, quotationId]) => {
      return selectedVendors[itemId] !== quotationId;
    });

    if (newSelections.length === 0) {
      // No new selection, just update state
      setSelectedVendors(vendors);
      return;
    }

    setIsSelectingVendor(true);
    try {
      // Call API for each newly selected vendor
      const selectPromises = newSelections.map(async ([itemId, quotationId]) => {
        const itemIdNum = parseInt(itemId, 10);
        const quotationIdNum = parseInt(quotationId, 10);
        
        if (isNaN(itemIdNum) || isNaN(quotationIdNum)) {
          console.error('Invalid itemId or quotationId:', itemId, quotationId);
          return;
        }

        await repairMaintenanceApi.selectVendorQuotation(
          orderData.id,
          itemIdNum,
          quotationIdNum
        );
      });

      await Promise.all(selectPromises);

      // Update local state after successful API call
      setSelectedVendors(vendors);

      // Refresh order data to get updated vendor selection status
      const refreshedData = await repairMaintenanceApi.getById(orderData.id);
      setOrderData(refreshedData);

      toast({
        title: 'Success',
        description: 'Vendor quotation selected successfully.',
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Error selecting vendor quotation:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to select vendor quotation. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSelectingVendor(false);
    }
  };

  // Image popup state
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');

  // Store loaded file URLs for quotations (quotationId -> fileUrls[])
  const [quotationFileUrls, setQuotationFileUrls] = useState<Record<string, string[]>>({});
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Form is always read-only - no editing allowed
  const canEdit = false;

  // Form data state - initialized from order data
  const [orderFormData, setOrderFormData] = useState({
    id: '',
    items: [] as RepairMaintenanceItem[],
    requestedBy: currentUser?.name || '',
    location: currentUser?.branch?.location || '',
    date: new Date().toISOString().split('T')[0],
    status: RepairMaintenanceStatus.DRAFT,
    apiData: {
      id: undefined as number | undefined,
    },
  });

  // State to store loaded image URLs for each item
  const [itemImageUrls, setItemImageUrls] = useState<Record<string, string[]>>({});

  // Load image URLs for an item
  const loadItemImageUrls = async (itemId: number) => {
    if (!orderData?.id) {
      console.warn('No orderData.id available for loading images');
      return [];
    }
    
    try {
      console.log(`Loading image URLs for item ${itemId} in order ${orderData.id}`);
      const imageUrls = await repairMaintenanceApi.getItemImages(orderData.id, itemId);
      console.log(`Loaded ${imageUrls?.length || 0} image URLs for item ${itemId}:`, imageUrls);
      
      // Validate and filter image URLs
      const validImageUrls = (imageUrls || []).filter(url => {
        if (!url || typeof url !== 'string') return false;
        // Ensure it's a valid URL and not HTML
        const isValidUrl = (url.startsWith('http://') || url.startsWith('https://')) &&
                          !url.includes('text/html') &&
                          !url.toLowerCase().includes('<!doctype') &&
                          !url.toLowerCase().includes('<html');
        return isValidUrl;
      });
      
      console.log(`Valid image URLs after filtering: ${validImageUrls.length}`, validImageUrls);
      
      if (validImageUrls.length > 0) {
        setItemImageUrls(prev => ({
          ...prev,
          [itemId.toString()]: validImageUrls
        }));
      }
      
      return validImageUrls;
    } catch (error) {
      console.error('Error loading item image URLs:', error);
      return [];
    }
  };

  // Initialize form data from order data
  useEffect(() => {
    if (orderData) {
      // Load image URLs for all items
      const loadAllItemImages = async () => {
        if (orderData.items && orderData.items.length > 0) {
          const loadPromises = orderData.items.map(async (item) => {
            // Check if imagePaths exist and if they're already URLs
            const imagePaths = item.imagePaths || [];
            if (imagePaths.length > 0) {
              // Check if paths are already valid URLs
              const areUrls = imagePaths.every(path => {
                if (!path || typeof path !== 'string') return false;
                const isHttpUrl = path.startsWith('http://') || path.startsWith('https://');
                // Also check it's not HTML content
                const isNotHtml = !path.includes('<!DOCTYPE') && !path.includes('<html');
                return isHttpUrl && isNotHtml;
              });
              
              if (!areUrls) {
                // Paths are not valid URLs, fetch signed URLs from API
                console.log(`Image paths for item ${item.id} are not valid URLs, fetching from API:`, imagePaths);
                await loadItemImageUrls(item.id);
              } else {
                // Already valid URLs, use them directly but validate them
                const validUrls = imagePaths.filter(url => {
                  return url && typeof url === 'string' && 
                         (url.startsWith('http://') || url.startsWith('https://')) &&
                         !url.includes('<!DOCTYPE') && 
                         !url.includes('<html');
                });
                
                if (validUrls.length > 0) {
                  console.log(`Using existing valid URLs for item ${item.id}:`, validUrls);
                  setItemImageUrls(prev => ({
                    ...prev,
                    [item.id.toString()]: validUrls
                  }));
                } else {
                  // URLs look invalid, try fetching from API
                  console.log(`Existing URLs for item ${item.id} appear invalid, fetching from API`);
                  await loadItemImageUrls(item.id);
                }
              }
            }
          });
          
          await Promise.all(loadPromises);
        }
      };
      
      loadAllItemImages();

      const items: RepairMaintenanceItem[] = (orderData.items || []).map((item, index) => {
        const initialSelectedVendors: Record<string, string> = {};
        
        // Check selectedQuotation from API response first (most reliable)
        if (item.selectedQuotation?.id) {
          initialSelectedVendors[item.id.toString()] = item.selectedQuotation.id.toString();
        } else {
          // Fallback to checking isSelected flag on quotations
          const selectedQuotation = item.vendorQuotations?.find(q => q.isSelected === true);
          if (selectedQuotation) {
            initialSelectedVendors[item.id.toString()] = selectedQuotation.id.toString();
          }
        }
        
        setSelectedVendors(prev => ({ ...prev, ...initialSelectedVendors }));

        // Check if we have loaded image URLs, otherwise use imagePaths (might be URLs already)
        const imagePaths = item.imagePaths || [];
        const areUrls = imagePaths.length > 0 && imagePaths.some(path => 
          path.startsWith('http://') || path.startsWith('https://')
        );
        const imagePreviews = areUrls ? imagePaths : []; // Will be updated when URLs are loaded

        return {
          id: item.id.toString(),
          srNo: item.srNo || String(index + 1),
          nameOfWork: item.nameOfWork || '',
          typeOfWork: item.typeOfWork || ('' as any),
          machineId: item.machineId,
          machineName: item.machine?.name || item.machineName || '',
          totalAmount: item.totalAmount?.toString() || '0',
          description: item.description || '',
          images: [],
          imagePreviews: imagePreviews,
          vendorQuotations: (item.vendorQuotations || []).map((q) => {
            // Prioritize files/quotationFileUrls from API response (new format)
            // Check multiple possible field names: files, quotationFileUrls, fileUrls
            const files = (q as any).files || [];
            const quotationFileUrls = (q as any).quotationFileUrls || [];
            const fileUrls = (q as any).fileUrls || [];
            const quotationFilePaths = (q as any).quotationFilePaths || [];
            const filePaths = q.filePaths || [];
            
            // Use files/quotationFileUrls if available, otherwise use filePaths
            const finalFilePaths = files.length > 0 ? files : 
                                 quotationFileUrls.length > 0 ? quotationFileUrls :
                                 fileUrls.length > 0 ? fileUrls : filePaths;
            
            console.log('Mapping vendor quotation:', {
              id: q.id,
              vendorName: q.vendorName,
              files: files,
              quotationFileUrls: quotationFileUrls,
              fileUrls: fileUrls,
              quotationFilePaths: quotationFilePaths,
              filePaths: filePaths,
              finalFilePaths: finalFilePaths
            });
            
            return {
              id: q.id.toString(),
              vendorName: q.vendorName || '',
              contactPerson: q.contactPerson || '',
              phone: q.phone || '',
              price: q.price?.toString() || '',
              quotedPrice: q.quotedPrice?.toString() || '',
              notes: q.notes || '',
              quotationFile: null,
              filePaths: finalFilePaths, // Store file paths/URLs
              quotationFilePaths: quotationFilePaths, // Keep original paths if needed
              quotationFileUrls: quotationFileUrls, // Keep quotationFileUrls from API
              files: files, // Keep files array from API
              isSelected: q.isSelected || (item.selectedQuotation?.id === q.id) || false,
            };
          }),
        };
      });

      setOrderFormData({
        id: orderData.id.toString(),
        items,
        requestedBy: orderData.requestedBy?.name || orderData.orderedBy?.name || '',
        location: orderData.location || orderData.branch?.location || '',
        date: orderData.date || orderData.requestedDate || new Date().toISOString().split('T')[0],
        status: orderData.status,
        apiData: {
          id: orderData.id,
        },
      });
    }
  }, [orderData]);

  // Update imagePreviews when image URLs are loaded
  useEffect(() => {
    if (Object.keys(itemImageUrls).length > 0 && orderFormData.items.length > 0) {
      console.log('Updating imagePreviews with loaded URLs:', itemImageUrls);
      setOrderFormData(prev => ({
        ...prev,
        items: prev.items.map(item => {
          const loadedUrls = itemImageUrls[item.id];
          if (loadedUrls && loadedUrls.length > 0) {
            console.log(`Updating item ${item.id} with ${loadedUrls.length} image URLs`);
            return {
              ...item,
              imagePreviews: loadedUrls
            };
          }
          return item;
        })
      }));
    }
  }, [itemImageUrls, orderFormData.items.length]);

  // Fetch machines on component mount
  useEffect(() => {
    const fetchMachines = async () => {
      setIsLoadingMachines(true);
      try {
        const response = await machinesApi.getAll({
          limit: 100,
          sortBy: 'name',
          sortOrder: 'ASC',
          ...((currentUser?.role === 'supervisor' ||
            currentUser?.role === 'inventory_manager' ||
            currentUser?.userType?.isBranchLevel) &&
            currentUser?.branch?.id && {
              branchId: currentUser.branch.id.toString(),
            }),
        });
        setAvailableMachines(response.data);
      } catch (error) {
        console.error('Error fetching machines:', error);
        toast({
          title: 'Error',
          description: 'Failed to load machines',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMachines(false);
      }
    };

    fetchMachines();
  }, [currentUser]);

  // Handle item changes in the form
  const handleOrderFormItemChange = (itemId: string, field: string, value: string) => {
    if (!canEdit) return;
    
    setOrderFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Handle item images change
  const handleItemImagesChange = (itemId: string, images: File[], imagePreviews: string[]) => {
    if (!canEdit) return;
    
    setOrderFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              images,
              imagePreviews,
            }
          : item
      ),
    }));
  };

  // Handle vendor form changes
  const handleVendorFormChange = (field: string, value: string) => {
    setVendorFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Handle vendor file change
  const handleVendorFileChange = (file: File) => {
    setVendorFormData((prev) => ({ ...prev, quotationFile: file }));
  };

  // Add vendor quotation
  const addVendorQuotation = () => {
    if (!canEdit) return;
    
    const currentItem = orderFormData.items.find((item) => item.id === currentItemId);
    if (currentItem && currentItem.vendorQuotations.length < 4) {
      const newQuotation: VendorQuotation = {
        ...vendorFormData,
        id: String(Date.now()),
        isSelected: false, // Don't auto-select, let company owner choose
      };

      setOrderFormData((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === currentItemId
            ? {
                ...item,
                vendorQuotations: [...item.vendorQuotations, newQuotation],
              }
            : item
        ),
      }));

      // Clear form for next entry
      setVendorFormData({
        id: '',
        vendorName: '',
        contactPerson: '',
        phone: '',
        price: '',
        quotedPrice: '',
        notes: '',
        quotationFile: null,
      });

      // Clear the file input
      const fileInput = document.getElementById('quotationFile') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }

      toast({
        title: 'Vendor Quotation Added',
        description: `Quotation from ${newQuotation.vendorName} added successfully`,
      });
    } else if (currentItem && currentItem.vendorQuotations.length >= 4) {
      toast({
        title: 'Maximum Quotations Reached',
        description: 'You can only add up to 4 vendor quotations per item',
        variant: 'destructive',
      });
    }
  };

  // Remove vendor quotation
  const removeVendorQuotation = (itemId: string, quotationId: string) => {
    if (!canEdit) return;
    
    setOrderFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              vendorQuotations: item.vendorQuotations.filter(
                (q) => q.id !== quotationId
              ),
            }
          : item
      ),
    }));
  };

  // Open vendor form dialog
  const openVendorForm = (itemId: string) => {
    if (!canEdit) return;
    setCurrentItemId(itemId);
    setIsVendorFormOpen(true);
  };

  // Load file URLs for a quotation
  // Note: Backend now returns files (signed URLs) directly, so we use them as-is
  const loadQuotationFileUrls = async (quotationId: string | number, itemId: string, skipLoadingState = false) => {
    // Get quotation from form data - it should already have files/quotationFileUrls (signed URLs)
    const quotation = orderFormData.items
      .find(item => item.id === itemId)
      ?.vendorQuotations.find(q => q.id.toString() === quotationId.toString());
    
    // Check for files array first (new format), then filePaths
    const files = (quotation as any)?.files || [];
    const filePaths = quotation?.filePaths || [];
    const existingUrls = files.length > 0 ? files : filePaths;
    
    // Use existing URLs if available
    if (existingUrls.length > 0) {
      const validUrls = existingUrls.filter((url: string) =>
        url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
      );
      if (validUrls.length > 0) {
      setQuotationFileUrls(prev => ({
        ...prev,
          [quotationId.toString()]: validUrls
      }));
        return validUrls;
      }
    }
    
    // If not available in form data, try fetching from API endpoint
    if (!orderData?.id) {
      // Mark as attempted with empty array
      setQuotationFileUrls(prev => ({
        ...prev,
        [quotationId.toString()]: []
      }));
      return [];
    }
    
    try {
      if (!skipLoadingState) {
      setIsLoadingFiles(true);
      }
      const fileUrls = await repairMaintenanceApi.getVendorQuotationFileUrls(
        orderData.id,
        parseInt(itemId, 10),
        quotationId
      );
      
      console.log('File URLs from API for quotation', quotationId, ':', fileUrls);
      
      if (fileUrls && fileUrls.length > 0) {
        // API returns signed URLs directly, use them as-is
        const validUrls = fileUrls.filter((url: string) =>
          url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
        );
        setQuotationFileUrls(prev => ({
          ...prev,
          [quotationId.toString()]: validUrls
        }));
        return validUrls;
      }
      
      // Mark as attempted with empty array if no files
      setQuotationFileUrls(prev => ({
        ...prev,
        [quotationId.toString()]: []
      }));
      return [];
    } catch (error) {
      console.error('Error loading quotation file URLs:', error);
      // Mark as attempted even on error
      setQuotationFileUrls(prev => ({
        ...prev,
        [quotationId.toString()]: []
      }));
      return [];
    } finally {
      if (!skipLoadingState) {
      setIsLoadingFiles(false);
      }
    }
  };

  // View vendor quotations
  const viewVendorQuotations = async (itemId: string) => {
    const item = orderFormData.items.find((item) => item.id === itemId);
    if (item) {
      console.log('View vendor quotations for item:', itemId, item);
      console.log('Vendor quotations from orderFormData:', item.vendorQuotations);
      
      // Also get original data from orderData to access quotationFileUrls directly
      const originalItem = orderData?.items?.find((item) => item.id.toString() === itemId);
      console.log('Original item from orderData:', originalItem);
      console.log('Original item vendor quotations:', originalItem?.vendorQuotations);
      
      // Use quotations from orderFormData if available, otherwise try to map from orderData
      let quotationsToShow = item.vendorQuotations || [];
      
      // If no quotations in orderFormData, try to map from orderData
      if (quotationsToShow.length === 0 && originalItem?.vendorQuotations && originalItem.vendorQuotations.length > 0) {
        console.log('No quotations in orderFormData, mapping from orderData');
        quotationsToShow = originalItem.vendorQuotations.map((q) => {
          const files = (q as any).files || [];
          const quotationFileUrls = (q as any).quotationFileUrls || [];
          const fileUrls = (q as any).fileUrls || [];
          const quotationFilePaths = (q as any).quotationFilePaths || [];
          const filePaths = q.filePaths || [];
          
          const finalFilePaths = files.length > 0 ? files : 
                               quotationFileUrls.length > 0 ? quotationFileUrls :
                               fileUrls.length > 0 ? fileUrls : filePaths;
          
          return {
            id: q.id.toString(),
            vendorName: q.vendorName || '',
            contactPerson: q.contactPerson || '',
            phone: q.phone || '',
            price: q.price?.toString() || '',
            quotedPrice: q.quotedPrice?.toString() || '',
            notes: q.notes || '',
            quotationFile: null,
            filePaths: finalFilePaths,
            quotationFilePaths: quotationFilePaths,
            quotationFileUrls: quotationFileUrls,
            files: files,
            isSelected: q.isSelected || (originalItem.selectedQuotation?.id === q.id) || false,
          };
        });
      }
      
      console.log('Setting currentQuotations to:', quotationsToShow);
      setCurrentQuotations(quotationsToShow);
      setCurrentItemId(itemId);
      setIsViewQuotationsOpen(true);
      
      // Load file URLs for all quotations when dialog opens
      // Backend returns quotationFileUrls in the initial response, so use them directly
      if (quotationsToShow.length > 0) {
        setIsLoadingFiles(true);
        try {
          // Load file URLs for each quotation
          const loadPromises = quotationsToShow.map(async (quotation) => {
            // Priority 1: Check 'files' array directly from quotation object (new API format)
            const files = ((quotation as any).files || []).filter((url: string) =>
              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
            );
            
            if (files.length > 0) {
              console.log('Using files array from quotation object for quotation:', quotation.id, files);
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: files
              }));
              return;
            }
            
            // Priority 2: Check quotationFileUrls directly from quotation object
            const quotationFileUrls = ((quotation as any).quotationFileUrls || []).filter((url: string) =>
              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
            );
            
            if (quotationFileUrls.length > 0) {
              console.log('Using quotationFileUrls from quotation object for quotation:', quotation.id, quotationFileUrls);
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: quotationFileUrls
              }));
              return;
            }
            
            // Priority 3: Check original API data for files/quotationFileUrls (signed URLs)
            const originalQuotation = originalItem?.vendorQuotations?.find(
              q => q.id.toString() === quotation.id.toString()
            );
            const originalFiles = ((originalQuotation as any)?.files || []).filter((url: string) =>
              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
            );
            const originalUrls = ((originalQuotation as any)?.quotationFileUrls || []).filter((url: string) =>
              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
            );
            const originalFileUrls = originalFiles.length > 0 ? originalFiles : originalUrls;
            
            if (originalFileUrls.length > 0) {
              console.log('Using files/quotationFileUrls from original API data for quotation:', quotation.id, originalFileUrls);
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: originalFileUrls
              }));
              return;
            }
            
            // If we don't have files/quotationFileUrls yet, try fetching from API
            // Always try to fetch from API if we have orderData.id
            if (orderData?.id) {
              console.log('Fetching files from API for quotation:', quotation.id, 'itemId:', itemId);
              try {
                // Use skipLoadingState=true since we're managing loading state at the parent level
                const signedUrls = await loadQuotationFileUrls(quotation.id, itemId, true);
                console.log('API response for quotation:', quotation.id, 'URLs:', signedUrls);
                if (signedUrls && signedUrls.length > 0) {
                  console.log('Successfully loaded files from API for quotation:', quotation.id, signedUrls);
                  // State is already updated in loadQuotationFileUrls
                  return;
                } else {
                  console.log('No files returned from API for quotation:', quotation.id);
                  // Mark as attempted even if no files
                  setQuotationFileUrls(prev => ({
                    ...prev,
                    [quotation.id.toString()]: []
                  }));
                }
              } catch (error) {
                console.error('Error fetching files from API for quotation:', quotation.id, error);
                // Mark as attempted even if it failed
                setQuotationFileUrls(prev => ({
                  ...prev,
                  [quotation.id.toString()]: []
                }));
              }
            } else {
              // No orderData.id, mark as attempted with empty array
              console.log('No orderData.id, marking as attempted for quotation:', quotation.id);
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: []
              }));
            }
            
            // Fallback: use filePaths if they're already URLs
            if (quotation.filePaths && quotation.filePaths.length > 0) {
              // Check if filePaths are already URLs (contain http:// or https://)
              const areUrls = quotation.filePaths.some(path => path.startsWith('http://') || path.startsWith('https://'));
              if (areUrls) {
                console.log('Using filePaths as URLs for quotation:', quotation.id, quotation.filePaths);
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: quotation.filePaths || []
              }));
              } else {
                // Mark as attempted even if filePaths are not URLs, so we don't keep showing loading
                setQuotationFileUrls(prev => ({
                  ...prev,
                  [quotation.id.toString()]: []
              }));
              }
            } else if (!quotationFileUrls.length && !originalUrls.length) {
              // No file paths at all and no URLs found, mark as attempted with empty array
              setQuotationFileUrls(prev => ({
                ...prev,
                [quotation.id.toString()]: []
              }));
            }
          });
          
          await Promise.all(loadPromises);
        } catch (error) {
          console.error('Error loading quotation files:', error);
          toast({
            title: 'Warning',
            description: 'Some files may not be available.',
            variant: 'default',
          });
        } finally {
          setIsLoadingFiles(false);
        }
      }
    }
  };

  // Utility function to determine file type from URL or filename
  const getFileType = (url: string) => {
    // Remove query parameters and get the file extension
    const urlWithoutQuery = url.split('?')[0];
    const extension = urlWithoutQuery.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
      case 'svg':
        return 'image';
      case 'pdf':
        return 'pdf';
      case 'doc':
      case 'docx':
        return 'document';
      case 'xls':
      case 'xlsx':
        return 'spreadsheet';
      case 'txt':
        return 'text';
      default:
        return 'file';
    }
  };

  // Utility function to get appropriate icon for file type
  const getFileIcon = (url: string) => {
    const fileType = getFileType(url);
    
    switch (fileType) {
      case 'image':
        return <FileImage className="w-4 h-4 text-blue-600" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'spreadsheet':
        return <FileText className="w-4 h-4 text-green-600" />;
      case 'text':
        return <FileText className="w-4 h-4 text-gray-600" />;
      default:
        return <File className="w-4 h-4 text-gray-600" />;
    }
  };

  // Utility function to handle file opening/display
  // Note: quotationFileUrls are already signed URLs, so we use them directly
  const handleFileOpen = async (url: string, fileName?: string) => {
    if (!url) return;
    
    // Check if it's a file path (not a URL) - if so, we need to fetch the signed URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // It's a file path, not a URL - we can't open it directly
      console.error('Cannot open file path directly, need signed URL:', url);
      toast({
        title: 'File Error',
        description: 'File URL is not available. Please try refreshing the page.',
        variant: 'destructive',
      });
      return;
    }
    
    const fileType = getFileType(url);
    
    if (fileType === 'image') {
      // For images, show in popup preview
      showImagesInPopup([url], fileName || `Quotation File`);
    } else {
      // For other formats, download directly
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName || `quotation-file-${Date.now()}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } catch (error) {
        console.error('Error downloading file:', error);
        // Fallback to opening in new tab if download fails
      window.open(url, '_blank');
      }
    }
  };

  // Function to show images in popup
  const showImagesInPopup = (images: string[], title: string) => {
    setSelectedImages(images);
    setPopupTitle(title);
    setIsImagePopupOpen(true);
  };

  // Add new item
  const addNewItem = () => {
    if (!canEdit) return;
    
    const newItem = {
      id: String(Date.now()),
      srNo: String(orderFormData.items.length + 1),
      nameOfWork: '',
      typeOfWork: RepairMaintenanceType.REPAIR,
      machineName: '',
      totalAmount: '',
      description: '',
      images: [],
      imagePreviews: [],
      vendorQuotations: [] as VendorQuotation[],
    };
    setOrderFormData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    toast({
      title: '➕ New Item Added',
      description: `Item ${orderFormData.items.length + 1} has been added. Please fill in the required details.`,
      variant: 'default',
    });
  };

  // Remove item
  const removeItem = (itemId: string) => {
    if (!canEdit) return;
    
    if (orderFormData.items.length <= 1) {
      toast({
        title: 'Cannot Remove Item',
        description: 'At least one item is required in the form.',
        variant: 'destructive',
      });
      return;
    }

    setOrderFormData((prev) => {
      const updatedItems = prev.items
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({
          ...item,
          srNo: String(index + 1),
        }));
      return {
        ...prev,
        items: updatedItems,
      };
    });

    toast({
      title: 'Item Removed',
      description: 'The item has been removed from the form.',
      variant: 'default',
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => { 
    e.preventDefault();

    if (!canEdit) {
      toast({
        title: 'Read Only',
        description: 'This order cannot be edited in its current status.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Validate all items
      for (let i = 0; i < orderFormData.items.length; i++) {
        const item = orderFormData.items[i];
        const itemNumber = i + 1;

        if (!item.nameOfWork || !item.nameOfWork.trim()) {
          toast({
            title: 'Error',
            description: `Please enter name of the work for item ${itemNumber}`,
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        if (!item.machineName || !item.machineName.trim()) {
          toast({
            title: 'Error',
            description: `Please select a machine for item ${itemNumber}`,
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }
      }

      const formDataToSend = new FormData();
      
      // Prepare items array according to API format
      const itemsArray = orderFormData.items.map((item) => {
        const itemData: any = {
          nameOfWork: item.nameOfWork,
          typeOfWork: item.typeOfWork,
          machineId: item.machineId || 0,
          description: item.description || '',
          itemImageCount: item.images?.length || 0,
        };

        // Add vendor quotations if any
        if (item.vendorQuotations && item.vendorQuotations.length > 0) {
          itemData.vendorQuotations = item.vendorQuotations.map((quotation) => ({
            vendorName: quotation.vendorName,
            contactPerson: quotation.contactPerson || '',
            phone: quotation.phone || '',
            price: parseFloat(quotation.price) || 0,
            quotedPrice: parseFloat(quotation.quotedPrice) || parseFloat(quotation.price) || 0,
            notes: quotation.notes || '',
          }));
        }

        return itemData;
      });

      // Append items as JSON string
      formDataToSend.append('items', JSON.stringify(itemsArray));
      
      // Append location and date if they exist
      if (orderFormData.location) {
        formDataToSend.append('location', orderFormData.location);
      }
      if (orderFormData.date) {
        formDataToSend.append('date', orderFormData.date);
      }
      
      // Append item images as itemFiles (all images in order)
      orderFormData.items.forEach((item) => {
        if (item.images && item.images.length > 0) {
          item.images.forEach((file) => {
            formDataToSend.append('itemFiles', file);
          });
        }
      });
      
      // Append quotation files as quotationFiles (all quotation files in order)
      orderFormData.items.forEach((item) => {
        if (item.vendorQuotations && item.vendorQuotations.length > 0) {
          item.vendorQuotations.forEach((quotation) => {
            if (quotation.quotationFile) {
              formDataToSend.append('quotationFiles', quotation.quotationFile);
            }
          });
        }
      });

      await repairMaintenanceApi.update(parseInt(orderFormData.id), formDataToSend);

      toast({
        title: 'Success',
        description: 'Repair and maintenance order updated successfully.',
      });

      // Navigate back to repair maintenance tab
      navigate('/materials-inventory?tab=repair-maintenance', {
        state: { activeTab: 'repair-maintenance' },
      });
    } catch (error) {
      console.error('Error updating order form:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order form. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case RepairMaintenanceStatus.DRAFT:
        return 'bg-gray-500 text-white';
      case RepairMaintenanceStatus.PENDING_APPROVAL:
        return 'bg-yellow-500 text-white';
      case RepairMaintenanceStatus.APPROVED:
        return 'bg-green-500 text-white';
      case RepairMaintenanceStatus.IN_PROGRESS:
        return 'bg-blue-500 text-white';
      case RepairMaintenanceStatus.COMPLETED:
        return 'bg-emerald-500 text-white';
      case RepairMaintenanceStatus.REJECTED:
        return 'bg-red-500 text-white';
      case RepairMaintenanceStatus.CANCELLED:
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
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

  // Check if any vendor is selected
  const hasSelectedVendor = () => {
    // Check if selectedVendors has any entries
    const hasVendors = Object.keys(selectedVendors).length > 0;
    
    if (hasVendors) return true;
    
    // Also check if any item has a selected vendor quotation from API
    if (orderData?.items) {
      return orderData.items.some(item => 
        item.selectedQuotation?.id || 
        item.vendorQuotations?.some(q => q.isSelected === true)
      );
    }
    
    // Check orderFormData as fallback
    if (orderFormData?.items) {
      return orderFormData.items.some(item => 
        item.vendorQuotations?.some(q => q.isSelected === true)
      );
    }
    
    return false;
  };

  // Check if vendor data exists for any item
  const hasVendorData = () => {
    if (!orderFormData?.items) return false;
    
    return orderFormData.items.some(item => 
      item.vendorQuotations && item.vendorQuotations.length > 0
    );
  };

  // Get status options based on user role and vendor selection
  const getStatusOptions = () => {
    if (!orderData) return [];

    if (currentUser?.role === 'company_owner') {
      // Company owner can approve or reject pending_approval orders
      if (orderData.status === RepairMaintenanceStatus.PENDING_APPROVAL) {
        const vendorSelected = hasSelectedVendor();
        const vendorDataExists = hasVendorData();
        
        // If vendor is selected, show both "Approve" and "Reject"
        if (vendorSelected) {
          return [
            { value: RepairMaintenanceStatus.APPROVED, label: 'Approve' },
            { value: RepairMaintenanceStatus.REJECTED, label: 'Reject' },
          ];
        }
        // If no vendor data is available, show both "Approve" and "Reject"
        else if (!vendorDataExists) {
          return [
            { value: RepairMaintenanceStatus.APPROVED, label: 'Approve' },
            { value: RepairMaintenanceStatus.REJECTED, label: 'Reject' },
          ];
        }
        // If vendor data exists but no vendor is selected, show only "Reject"
        else {
          return [
            { value: RepairMaintenanceStatus.REJECTED, label: 'Reject' },
          ];
        }
      }
      return [];
    } else {
      // Supervisor can mark approved orders as completed
      // Show "Completed" option when status is "approved"
      if (orderData.status === RepairMaintenanceStatus.APPROVED) {
        return [
          { value: RepairMaintenanceStatus.COMPLETED, label: 'Completed' },
        ];
      }
      return [];
    }
  };

  // Get display status for dropdown
  const getDisplayStatus = () => {
    if (!orderData) return '';
    
    // Use displayedStatus if it's been changed, otherwise use actual status
    const statusToDisplay = displayedStatus || orderData.status;
    return getStatusLabel(statusToDisplay);
  };

  // Get the value to use for the Select component
  const getSelectValue = () => {
    if (!orderData) return '';
    
    // Use displayedStatus if it's been changed (e.g., to COMPLETED), otherwise use actual status
    // This ensures APPROVED shows as APPROVED until user selects COMPLETED
    return displayedStatus || orderData.status;
  };

  // Check if status dropdown should be shown
  const shouldShowStatusDropdown = () => {
    if (!orderData) return false;

    if (currentUser?.role === 'company_owner') {
      return orderData.status === RepairMaintenanceStatus.PENDING_APPROVAL;
    }

    if (currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager') {
      return orderData.status === RepairMaintenanceStatus.APPROVED;
    }

    return false;
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!orderData) return;

    // If rejecting, open dialog for reason
    if (newStatus === RepairMaintenanceStatus.REJECTED) {
      setSelectedStatus(newStatus);
      setIsStatusDialogOpen(true);
      return;
    }

    // For approval or completion, update directly
    try {
      setIsUpdatingStatus(true);

      // Use specific endpoints based on status
      if (newStatus === RepairMaintenanceStatus.APPROVED) {
        // Send selected vendors in the approval payload
        // selectedVendors format: { itemId: quotationId, ... }
        console.log('Approving with selected vendors:', selectedVendors);
        await repairMaintenanceApi.approve(orderData.id, selectedVendors);
      } else if (newStatus === RepairMaintenanceStatus.REJECTED) {
        // Rejection requires a reason, so it should be handled separately
        // This should not be reached here, but handle it just in case
        if (!rejectionReason.trim()) {
          setSelectedStatus(newStatus);
          setIsStatusDialogOpen(true);
          return;
        }
        await repairMaintenanceApi.reject(orderData.id, rejectionReason);
      } else if (newStatus === RepairMaintenanceStatus.COMPLETED) {
        await repairMaintenanceApi.complete(orderData.id);
      } else {
        // Fallback to generic updateStatus for other statuses
        await repairMaintenanceApi.updateStatus(orderData.id, {
          status: newStatus as RepairMaintenanceStatus,
          selectedVendorQuotations: selectedVendors,
        });
      }

      // Update local state
      setOrderData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: newStatus as RepairMaintenanceStatus,
          approvedBy: newStatus === RepairMaintenanceStatus.APPROVED ? {
            id: currentUser?.id || 0,
            name: currentUser?.name || '',
            email: currentUser?.email || '',
          } : prev.approvedBy,
          approvedDate: newStatus === RepairMaintenanceStatus.APPROVED 
            ? new Date().toISOString() 
            : prev.approvedDate,
          completedDate: newStatus === RepairMaintenanceStatus.COMPLETED
            ? new Date().toISOString()
            : prev.completedDate,
        };
      });

      // Update form data status
      setOrderFormData((prev) => ({
        ...prev,
        status: newStatus as RepairMaintenanceStatus,
      }));

      // displayedStatus will be updated automatically by useEffect when orderData changes

      toast({
        title: '✅ Status Updated Successfully!',
        description: `Order status has been updated to ${getStatusLabel(newStatus)}.`,
        variant: 'default',
      });

      // Navigate back to repair maintenance tab after a short delay
      setTimeout(() => {
        navigate('/materials-inventory', {
          state: { activeTab: 'repair-maintenance' },
        });
      }, 1500);
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle status change with rejection reason
  const handleStatusChangeWithReason = async () => {
    if (!orderData || !rejectionReason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason for rejection.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsUpdatingStatus(true);

      await repairMaintenanceApi.reject(orderData.id, rejectionReason);

      // Update local state
      setOrderData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: RepairMaintenanceStatus.REJECTED,
        };
      });

      // Update form data status
      setOrderFormData((prev) => ({
        ...prev,
        status: RepairMaintenanceStatus.REJECTED,
      }));

      toast({
        title: '✅ Order Rejected Successfully!',
        description: 'The order has been rejected and the status has been updated.',
        variant: 'default',
      });

      setIsStatusDialogOpen(false);
      setRejectionReason('');
      setSelectedStatus('');

      // Navigate back to repair maintenance tab after a short delay
      setTimeout(() => {
        navigate('/materials-inventory', {
          state: { activeTab: 'repair-maintenance' },
        });
      }, 1500);
    } catch (error) {
      console.error('Error rejecting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Loader2 className='animate-spin h-32 w-32 text-primary mx-auto' />
          <p className='mt-4 text-muted-foreground'>
            Loading order details...
          </p>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <h2 className='text-2xl font-bold text-foreground mb-2'>
            Order Not Found
          </h2>
          <p className='text-muted-foreground mb-4'>
            The requested repair and maintenance order could not be found.
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
              navigate('/materials-inventory?tab=repair-maintenance', {
                state: { activeTab: 'repair-maintenance' },
              })
            }
            className='gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Back
          </Button>
          <div>
            <h1 className='text-2xl font-bold text-foreground'>
              Work Order Form
            </h1>
            <p className='text-muted-foreground'>
              {canEdit ? 'Edit order details' : 'View order details'}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-6'>
          {/* Order Summary Info */}
          <div className='flex items-center gap-6 text-sm'>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Requested By
              </Label>
              <div className='font-semibold'>
                {orderData.requestedBy?.name || 'N/A'}
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Factory Location
              </Label>
              <div className='font-semibold'>
                {orderData.branch?.name || 'N/A'}
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Requested Date
              </Label>
              <div className='font-semibold'>
                {orderData.requestedDate || orderData.date
                  ? formatDateToDDMMYYYY(orderData.requestedDate || orderData.date || '')
                  : 'N/A'}
              </div>
            </div>
            <div>
              <Label className='text-xs font-medium text-muted-foreground'>
                Status
              </Label>
              <div className='mt-1'>
                {shouldShowStatusDropdown() ? (
                  <Select
                    value={getSelectValue()}
                    onValueChange={handleStatusChange}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className='w-[180px] h-8 text-xs'>
                      <SelectValue placeholder={getDisplayStatus()}>
                        {getDisplayStatus()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={getStatusColor(orderData.status)}>
                    {getDisplayStatus()}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className='flex items-center gap-3'>
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
              navigate('/materials-inventory?tab=repair-maintenance', {
                state: { activeTab: 'repair-maintenance' },
              })
            }
            className='gap-1 px-2 py-1 flex-shrink-0'
          >
            <ArrowLeft className='w-4 h-4' />
            <span className='text-xs'>Back</span>
          </Button>
          <div className='flex-1 min-w-0'>
            <h1 className='text-base sm:text-lg font-bold text-foreground truncate'>
              Work Order Form
            </h1>
            <p className='text-xs text-muted-foreground truncate'>
              {canEdit ? 'Edit order' : 'View order'}
            </p>
          </div>
        </div>

        {/* Row 2: Order Info Grid */}
        <div className='grid grid-cols-2 gap-2 bg-secondary/10 p-3 rounded-lg'>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Requested By
            </Label>
            <div className='font-semibold text-xs truncate'>
              {orderData.requestedBy?.name || 'N/A'}
            </div>
          </div>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Factory Location
            </Label>
            <div className='font-semibold text-xs truncate'>
              {orderData.branch?.name || 'N/A'}
            </div>
          </div>
          <div>
            <Label className='text-[10px] font-medium text-muted-foreground'>
              Requested Date
            </Label>
            <div className='font-semibold text-xs'>
              {orderData.requestedDate || orderData.date
                ? formatDateToDDMMYYYY(orderData.requestedDate || orderData.date || '')
                : 'N/A'}
            </div>
          </div>
            <div>
              <Label className='text-[10px] font-medium text-muted-foreground'>
                Status
              </Label>
              <div className='mt-1'>
                {shouldShowStatusDropdown() ? (
                  <Select
                    value={getSelectValue()}
                    onValueChange={handleStatusChange}
                    disabled={isUpdatingStatus}
                  >
                    <SelectTrigger className='w-full h-8 text-xs'>
                      <SelectValue placeholder={getDisplayStatus()}>
                        {getDisplayStatus()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getStatusOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge className={`${getStatusColor(orderData.status)} text-[10px]`}>
                    {getDisplayStatus()}
                  </Badge>
                )}
              </div>
            </div>
        </div>

      </div>

      {/* Main Content */}
      <div className='w-full'>
        {/* Request Form - Full Width */}
        <div className='space-y-5'>
          <form onSubmit={handleSubmit} className='space-y-4 sm:space-y-6'>
            {/* Repair Maintenance Form Component */}
            <RepairMaintenanceForm
              formData={orderFormData}
              isReadOnly={!canEdit}
              onItemChange={handleOrderFormItemChange}
              onItemImagesChange={handleItemImagesChange}
              availableMachines={availableMachines}
              machines={availableMachines.map((m) => m.name)}
              onLoadItemImages={loadItemImageUrls}
              itemImageUrlsMap={itemImageUrls}
              userRole={currentUser?.role as 'company_owner' | 'supervisor' || 'supervisor'}
              hasPermission={hasPermission}
              onOpenVendorForm={undefined}
              onViewVendorQuotations={viewVendorQuotations}
              onRemoveItem={undefined}
              orderId={orderData.uniqueId}
              selectedVendors={selectedVendors}
              onVendorSelection={handleVendorSelection}
            />

          </form>
        </div>
      </div>


      {/* Vendor Quotation Table Dialog */}
      <Dialog open={isVendorFormOpen} onOpenChange={setIsVendorFormOpen}>
        <DialogContent className='max-w-6xl max-h-[95vh] overflow-y-auto'>
          <DialogHeader className='pb-4'>
            <DialogTitle className='flex items-center gap-3 text-xl'>
              <div className='w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center'>
                <UserRoundPlus className='w-6 h-6 text-primary' />
              </div>
              Manage Vendor Quotations
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-6'>
            {/* Current Quotations Table */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h3 className='text-lg font-semibold'>Current Quotations</h3>
                <Badge variant='secondary'>
                  {orderFormData.items.find((item) => item.id === currentItemId)
                    ?.vendorQuotations.length || 0}
                  /4 Quotations
                </Badge>
              </div>

              <div className='border rounded-lg overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-gray-50'>
                      <TableHead className='border-r font-semibold w-12'>SR.</TableHead>
                      <TableHead className='border-r font-semibold w-36'>
                        Vendor Name
                      </TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Contact Person
                      </TableHead>
                      <TableHead className='border-r font-semibold w-28'>Phone</TableHead>
                      <TableHead className='border-r font-semibold w-24'>Price</TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Total Quotation Amount
                      </TableHead>
                      <TableHead className='border-r font-semibold w-44'>Notes</TableHead>
                      <TableHead className='border-r font-semibold w-28'>File</TableHead>
                      <TableHead className='font-semibold w-16'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderFormData.items
                      .find((item) => item.id === currentItemId)
                      ?.vendorQuotations
                      .filter((quotation) => quotation.isSelected === true)
                      .map((quotation, index) => (
                        <TableRow key={quotation.id}>
                          <TableCell className='border-r text-center font-medium'>
                            {index + 1}
                          </TableCell>
                          <TableCell className='border-r font-medium'>
                            {quotation.vendorName}
                          </TableCell>
                          <TableCell className='border-r'>
                            {quotation.contactPerson}
                          </TableCell>
                          <TableCell className='border-r'>{quotation.phone}</TableCell>
                          <TableCell className='border-r font-medium text-blue-600'>
                            ₹{quotation.price}
                          </TableCell>
                          <TableCell className='border-r font-medium text-primary'>
                            ₹{quotation.quotedPrice}
                          </TableCell>
                          <TableCell className='border-r text-sm'>
                            {quotation.notes || '-'}
                          </TableCell>
                          <TableCell className='border-r'>
                            {quotation.quotationFile ? (
                              <div className='flex items-center gap-1 text-sm'>
                                <FileText className='w-3 h-3' />
                                <span className='truncate max-w-20'>
                                  {quotation.quotationFile.name}
                                </span>
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!orderFormData.items.find((item) => item.id === currentItemId)
                      ?.vendorQuotations.length && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className='text-center py-8 text-muted-foreground'
                        >
                          No vendor quotations added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Add New Quotation Form */}
            <div className='space-y-4 border-t pt-6'>
              <h3 className='text-lg font-semibold'>Add New Quotation</h3>

              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='vendorName' className='text-sm font-medium'>
                    Vendor Name *
                  </Label>
                  <Input
                    id='vendorName'
                    value={vendorFormData.vendorName}
                    onChange={(e) =>
                      handleVendorFormChange('vendorName', e.target.value)
                    }
                    placeholder='Enter vendor name'
                    className='h-10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='contactPerson' className='text-sm font-medium'>
                    Contact Person
                  </Label>
                  <Input
                    id='contactPerson'
                    value={vendorFormData.contactPerson}
                    onChange={(e) =>
                      handleVendorFormChange('contactPerson', e.target.value)
                    }
                    placeholder='Enter contact person'
                    className='h-10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone' className='text-sm font-medium'>
                    Phone
                  </Label>
                  <Input
                    id='phone'
                    value={vendorFormData.phone}
                    onChange={(e) => handleVendorFormChange('phone', e.target.value)}
                    placeholder='Enter phone number'
                    className='h-10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='price' className='text-sm font-medium'>
                    Price*
                  </Label>
                  <Input
                    id='price'
                    value={vendorFormData.price}
                    onChange={(e) => handleVendorFormChange('price', e.target.value)}
                    placeholder='Enter Price'
                    className='h-10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='quotedPrice' className='text-sm font-medium'>
                    Total Quotation Amount*
                  </Label>
                  <Input
                    id='quotedPrice'
                    value={vendorFormData.quotedPrice}
                    onChange={(e) =>
                      handleVendorFormChange('quotedPrice', e.target.value)
                    }
                    placeholder='Enter Total Quotation Amount'
                    className='h-10'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='quotationFile' className='text-sm font-medium'>
                    Quotation File
                  </Label>
                  <Input
                    id='quotationFile'
                    type='file'
                    accept='.pdf,.doc,.docx,.jpg,.jpeg,.png'
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleVendorFileChange(file);
                      }
                    }}
                    className='h-10'
                  />
                  <div className='text-xs text-muted-foreground'>
                    Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
                  </div>
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='notes' className='text-sm font-medium'>
                    Notes
                  </Label>
                  <Input
                    id='notes'
                    value={vendorFormData.notes}
                    onChange={(e) => handleVendorFormChange('notes', e.target.value)}
                    placeholder='Additional notes or comments'
                    className='h-10'
                  />
                </div>
              </div>

              <div className='flex justify-between items-center pt-4'>
                <div className='text-sm text-muted-foreground'>
                  {vendorFormData.quotationFile && (
                    <div className='flex items-center gap-2'>
                      <FileText className='w-4 h-4' />
                      <span>Selected: {vendorFormData.quotationFile.name}</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={addVendorQuotation}
                  disabled={
                    !vendorFormData.vendorName.trim() ||
                    !vendorFormData.quotedPrice.trim() ||
                    (orderFormData.items.find((item) => item.id === currentItemId)
                      ?.vendorQuotations.length || 0) >= 4
                  }
                  className='h-10 px-6 bg-primary hover:bg-primary/90'
                >
                  <Plus className='w-4 h-4 mr-2' />
                  Add Quotation
                </Button>
              </div>

              <div className='flex justify-end gap-4 pt-6 border-t'>
                <Button
                  variant='outline'
                  onClick={() => setIsVendorFormOpen(false)}
                  className='h-10 px-6'
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Vendor Quotations Dialog */}
      {isViewQuotationsOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg max-w-4xl max-h-[80vh] w-full overflow-hidden'>
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200'>
              <h3 className='text-lg font-semibold'>
              Vendor Quotations
              </h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsViewQuotationsOpen(false)}
                className='h-8 w-8 p-0'
              >
                <X className='w-4 h-4' />
              </Button>
            </div>

            {/* Content */}
            <div className='p-4 overflow-y-auto max-h-[60vh]'>
                          {(() => {
                // For COMPLETED status, show only selected vendor quotations
                // For other statuses, show all vendor quotations
                const allQuotations = currentQuotations || [];
                const filteredQuotations = orderData?.status === RepairMaintenanceStatus.COMPLETED
                  ? allQuotations.filter(q => q.isSelected === true)
                  : allQuotations;
                
                if (filteredQuotations.length === 0) {
                  return (
                    <div className='text-center py-8 text-muted-foreground'>
                      <FileText className='w-12 h-12 mx-auto mb-4 opacity-50' />
                      <p>No vendor quotation available</p>
                    </div>
                  );
                }
                
                return (
                  <div className='space-y-6'>
                    {filteredQuotations.map((quotation, index) => {
                    // Helper function to get file URLs for this quotation
                    const getQuotationFileUrls = () => {
                      // First, check 'files' array directly from the quotation object (new API format)
                      const files = ((quotation as any).files || []).filter((url: string) =>
                              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
                            );
                      
                      // Then check quotationFileUrls directly from the quotation object
                      const quotationFileUrlsFromObj = ((quotation as any).quotationFileUrls || []).filter((url: string) =>
                        url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
                      );
                      
                      // Get original quotation from orderData to check files/quotationFileUrls directly
                            const originalQuotation = orderData?.items
                              ?.find(item => item.id.toString() === currentItemId)
                              ?.vendorQuotations?.find(q => q.id.toString() === quotation.id.toString());
                            
                      const originalFiles = ((originalQuotation as any)?.files || []).filter((url: string) =>
                        url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
                      );
                            const originalUrls = ((originalQuotation as any)?.quotationFileUrls || []).filter((url: string) =>
                              url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
                            );
                      const originalFileUrls = originalFiles.length > 0 ? originalFiles : originalUrls;
                      
                      // Get state URLs (from loadQuotationFileUrls function)
                      const stateUrls = quotationFileUrls[quotation.id.toString()] || [];
                      const mappedUrls = (quotation.filePaths || []).filter((url: string) => 
                        url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))
                      );
                      
                      // Priority: files > quotationFileUrlsFromObj > originalFileUrls > stateUrls > mappedUrls
                      let fileUrls = files.length > 0 ? files :
                                   quotationFileUrlsFromObj.length > 0 ? quotationFileUrlsFromObj :
                                   originalFileUrls.length > 0 ? originalFileUrls :
                                   stateUrls.length > 0 ? stateUrls : 
                                   mappedUrls.length > 0 ? mappedUrls : [];
                            
                            // Final filter to ensure all URLs are valid HTTP/HTTPS URLs
                      return fileUrls.filter((url: string) => {
                              if (!url || typeof url !== 'string') return false;
                        return url.startsWith('http://') || url.startsWith('https://');
                            });
                    };
                            
                            // Helper function to extract filename from path
                            const extractFileName = (path: string): string => {
                              if (path.startsWith('http://') || path.startsWith('https://')) {
                                const urlParts = path.split('/');
                                const lastPart = urlParts[urlParts.length - 1];
                        const fileName = lastPart.split('?')[0];
                                const parts = fileName.split('_');
                                if (parts.length > 1) {
                                  return parts.slice(1).join('_');
                                }
                                return fileName;
                              }
                              const pathParts = path.split('/');
                              const lastPart = pathParts[pathParts.length - 1];
                              const parts = lastPart.split('_');
                              if (parts.length > 1) {
                                return parts.slice(1).join('_');
                              }
                              return lastPart;
                            };
                            
                    const fileUrls = getQuotationFileUrls();
                    
                    return (
                      <div key={quotation.id} className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        {/* Quotation Details */}
                        <div className='space-y-4'>
                          <div className='bg-gray-50 p-4 rounded-lg'>
                            <h4 className='font-semibold text-gray-800 mb-3'>Vendor Information - Quotation {index + 1}</h4>
                            <div className='space-y-2 text-sm'>
                              <div>
                                <span className='font-medium'>Vendor Name:</span>
                                <span className='ml-2'>{quotation.vendorName}</span>
                              </div>
                              <div>
                                <span className='font-medium'>Contact Person:</span>
                                <span className='ml-2'>{quotation.contactPerson || 'N/A'}</span>
                              </div>
                              <div>
                                <span className='font-medium'>Phone:</span>
                                <span className='ml-2'>{quotation.phone || 'N/A'}</span>
                              </div>
                              <div>
                                <span className='font-medium'>Price:</span>
                                <span className='ml-2 font-bold text-blue-600'>₹{quotation.price || '0'}</span>
                              </div>
                              <div>
                                <span className='font-medium'>Total Quotation Amount:</span>
                                <span className='ml-2 font-bold text-green-600'>
                                  ₹{quotation.quotedPrice.replace(/[₹,]/g, '') || '0'}
                                </span>
                              </div>
                              {quotation.notes && (
                                <div>
                                  <span className='font-medium'>Notes:</span>
                                  <div className='mt-1 p-2 bg-white rounded border text-gray-600'>
                                    {quotation.notes}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quotation Files */}
                        <div className='space-y-4'>
                          <h4 className='font-semibold text-gray-800'>Quotation Files</h4>
                          {(() => {
                            // Debug logging
                            console.log('Rendering files for quotation:', quotation.id, {
                              fileUrls,
                              quotationFileUrlsState: quotationFileUrls[quotation.id.toString()],
                              quotation: quotation
                            });
                            
                            if (isLoadingFiles && fileUrls.length === 0) {
                              return (
                                <div className='text-center py-8 text-muted-foreground'>
                                  <Loader2 className='w-8 h-8 mx-auto mb-4 animate-spin' />
                                  <p>Loading files...</p>
                                </div>
                              );
                            }
                            
                            if (fileUrls.length > 0) {
                              return (
                                <div className='grid grid-cols-1 gap-4'>
                                  {fileUrls.map((fileUrl, fileIndex) => {
                                const fileType = getFileType(fileUrl);
                                    const fileName = extractFileName(fileUrl);
                                const isImage = fileType === 'image';
                                    
                                    return (
                                  <div key={`quotation-file-${fileIndex}`} className='relative group'>
                                    {isImage ? (
                                      // For images, show the image with overlay
                                      <>
                                        <img
                                          src={fileUrl}
                                          alt={`Quotation File ${fileIndex + 1}`}
                                          className='w-full h-48 object-cover rounded-lg border border-gray-200 hover:border-primary transition-colors cursor-pointer'
                                          onClick={() => handleFileOpen(fileUrl, fileName)}
                                          onError={(e) => {
                                            // Image failed to load, will be handled by state
                                            console.error('Failed to load image:', fileUrl);
                                          }}
                                        />
                                        <div className='absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs'>
                                          Image {fileIndex + 1}
                                        </div>
                                        <div className='absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 rounded-lg flex items-center justify-center'>
                                          <div className='opacity-0 group-hover:opacity-100 transition-opacity'>
                                            <Button
                                              variant='secondary'
                                              size='sm'
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleFileOpen(fileUrl, fileName);
                                              }}
                                              className='gap-2'
                                            >
                                              <Eye className='w-4 h-4' />
                                              View Preview
                                            </Button>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      // For documents/PDFs, show file icon with details
                                      <div className='w-full h-32 bg-gray-50 border border-gray-200 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors group'
                                           onClick={() => handleFileOpen(fileUrl, fileName)}>
                                        <div className='flex flex-col items-center justify-center space-y-2'>
                                        {getFileIcon(fileUrl)}
                                          <div className='text-center px-4'>
                                            <div className='text-sm font-medium text-gray-700 truncate max-w-48'>
                                          {fileName}
                                </div>
                                            <div className='text-xs text-gray-500 uppercase'>
                                              {fileType}
                                            </div>
                                          </div>
                                          <Button
                                            variant='outline'
                                            size='sm'
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleFileOpen(fileUrl, fileName);
                                            }}
                                            className='gap-2 opacity-0 group-hover:opacity-100 transition-opacity'
                                          >
                                            <Download className='w-4 h-4' />
                                            Open File
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }
                            
                              return (
                              <div className='text-center py-8 text-muted-foreground'>
                                <FileText className='w-12 h-12 mx-auto mb-4 opacity-50' />
                                <p>No quotation files available</p>
                                </div>
                              );
                          })()}
              </div>
              </div>
                    );
                  })}
                  </div>
                );
              })()}
          </div>

            {/* Footer */}
            <div className='flex justify-end gap-4 p-4 border-t border-gray-200'>
            <Button
              variant='outline'
              onClick={() => setIsViewQuotationsOpen(false)}
              className='h-10 px-6'
            >
              Close
            </Button>
          </div>
          </div>
        </div>
      )}

      {/* Status Change Dialog - Rejection Reason */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className='max-w-md'>
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='rejectionReason'>Reason for Rejection *</Label>
              <Textarea
                id='rejectionReason'
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder='Please provide a reason for rejecting this order...'
                className='min-h-[100px]'
              />
            </div>
          </div>
          <div className='flex justify-end gap-2 pt-4'>
            <Button
              variant='outline'
              onClick={() => {
                setIsStatusDialogOpen(false);
                setRejectionReason('');
                setSelectedStatus('');
              }}
              disabled={isUpdatingStatus}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusChangeWithReason}
              disabled={!rejectionReason.trim() || isUpdatingStatus}
              className='bg-red-600 hover:bg-red-700'
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  Rejecting...
                </>
              ) : (
                'Reject Order'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Popup Modal */}
      {isImagePopupOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg max-w-4xl max-h-[80vh] w-full overflow-hidden'>
            {/* Header */}
            <div className='flex items-center justify-between p-4 border-b border-gray-200'>
              <h3 className='text-lg font-semibold'>{popupTitle}</h3>
              <Button
                variant='ghost'
                size='sm'
                onClick={() => setIsImagePopupOpen(false)}
                className='h-8 w-8 p-0'
              >
                <X className='w-4 h-4' />
              </Button>
            </div>

            {/* Content */}
            <div className='p-4 overflow-y-auto max-h-[60vh]'>
              {selectedImages.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                  {selectedImages.map((imageUrl, index) => (
                    <div key={index} className='relative group'>
                      <img
                        src={imageUrl}
                        alt={`Image ${index + 1}`}
                        className='w-full h-48 object-cover rounded-lg border border-gray-200 hover:border-primary transition-colors'
                        onError={(e) => {
                          console.error('Failed to load image:', imageUrl, e);
                          const img = e.target as HTMLImageElement;
                          // Check if the error is due to HTML response
                          fetch(imageUrl)
                            .then(res => res.text())
                            .then(text => {
                              if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                                console.error('Image URL returned HTML instead of image:', imageUrl);
                                toast({
                                  title: 'Image Load Error',
                                  description: 'Image URL is invalid or expired. Please refresh the page.',
                                  variant: 'destructive',
                                });
                              }
                            })
                            .catch(() => {
                          toast({
                            title: 'Image Load Error',
                            description: `Failed to load image: ${imageUrl}`,
                            variant: 'destructive',
                          });
                            });
                          // Hide broken image
                          img.style.display = 'none';
                        }}
                      />
                      <div className='absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs'>
                        Image {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>
                  <FileImage className='w-12 h-12 mx-auto mb-4 opacity-50' />
                  <p>No images to display</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className='flex justify-end p-4 border-t border-gray-200'>
              <Button
                variant='outline'
                onClick={() => setIsImagePopupOpen(false)}
                className='h-10 px-6'
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepairMaintenanceViewForm;

