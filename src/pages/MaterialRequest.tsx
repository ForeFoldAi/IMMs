import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Camera,
  Upload,
  X,
  Eye,
  User,
  Settings,
  MapPin,
  Package,
  Plus,
  Trash2,
  Building2,
  List,
  Table as TableIcon,
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
  UserRoundPlus,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
} from '../components/ui/dialog';
import { toast } from '../hooks/use-toast';
import { useRole } from '../contexts/RoleContext';
import materialsApi from '../lib/api/materials';
import machinesApi from '../lib/api/machines';
import { getUnits } from '../lib/api/common';
import {
  Material,
  Machine,
  CreateMaterialIndentRequest,
  CreateMaterialIndentItemInput,
  MaterialIndent,
  Unit,
} from '../lib/api/types';
import materialIndentsApi from '../lib/api/material-indents';

interface VendorQuotation {
  id: string;
  vendorName: string;
  contactPerson: string;
  phone: string;
  price: string;
  quotedPrice: string;
  notes: string;
  quotationFile?: File | null;
  isSelected?: boolean;
}

export enum PurposeType {
  MACHINE = 'machine',
  OTHER = 'other',
  SPARE = 'spare',
  RETURN = 'return',
}

interface RequestItem {
  id: string;
  srNo: number;
  materialId?: number; // Store material ID to handle duplicate names
  productName: string;
  machineName: string;
  specifications: string;
  oldStock: number;
  reqQuantity: string;
  measureUnit: string;
  images?: File[];
  imagePreviews?: string[];
  notes?: string;
  vendorQuotations: VendorQuotation[];
  purposeType: PurposeType;
}

const MaterialRequest = () => {
  const { currentUser } = useRole();
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const activeFieldRef = useRef<{
    itemId: string;
    field: 'reqQuantity' | 'notes';
  } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [isVendorFormOpen, setIsVendorFormOpen] = useState(false);
  const [isViewQuotationsOpen, setIsViewQuotationsOpen] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string>('');
  const [currentQuotations, setCurrentQuotations] = useState<VendorQuotation[]>(
    []
  );
  const [vendorFormData, setVendorFormData] = useState<VendorQuotation>({
    id: '',
    vendorName: '',
    contactPerson: '',
    phone: '',
    price: '0',
    quotedPrice: '0',
    notes: '',
    quotationFile: null,
  });

  // Request items (multiple items support)
  const [requestItems, setRequestItems] = useState<RequestItem[]>([
    {
      id: '1',
      srNo: 1,
      materialId: undefined,
      productName: '',
      machineName: '',
      specifications: '',
      oldStock: 0,
      reqQuantity: '',
      measureUnit: '',
      images: [],
      imagePreviews: [],
      notes: '',
      vendorQuotations: [],
      purposeType: PurposeType.MACHINE,
    },
  ]);

  // Materials and Machines from API
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');

  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  const [machinesError, setMachinesError] = useState<string | null>(null);

  // Add units state
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  // Additional notes for the indent
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // Loading state for form submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Combined loading state for initial data fetch
  const isInitialLoading = isLoadingMaterials || isLoadingMachines || isLoadingUnits;

  // Enhanced getUnitName function with better debugging
  const getUnitName = (unitId?: number) => {
    if (!unitId) {
      console.log('No unitId provided');
      return '';
    }
    const unit = availableUnits.find(u => u.id === unitId);
    console.log(`Looking for unitId: ${unitId}, Found:`, unit, 'Available units:', availableUnits);
    return unit?.name || '';
  };

  // Return materials sorted alphabetically with search filtering
  const getFilteredMaterials = () => {
    console.log('MaterialRequest: Returning materials from API (branch filtering handled server-side)');
    
    let filteredMaterials = [...availableMaterials];
    
    // Apply search filter if search term exists
    if (materialSearchTerm.trim()) {
      const searchLower = materialSearchTerm.toLowerCase();
      filteredMaterials = filteredMaterials.filter(material => 
        material.name.toLowerCase().includes(searchLower) ||
        material.makerBrand?.toLowerCase().includes(searchLower) ||
        material.specifications?.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort materials alphabetically by name
    return filteredMaterials.sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  };

  // Return machines as they come from API (branch filtering is handled at API level)
  const getFilteredMachines = () => {
    console.log('MaterialRequest: Returning machines from API (branch filtering handled server-side)');
    return availableMachines;
  };

  useEffect(() => {
    const fetchMaterials = async () => {
      setIsLoadingMaterials(true);
      setMaterialsError(null);
      try {
        const params = {
          limit: 100,
          sortBy: 'id' as const,
          sortOrder: 'ASC' as const,
          // Filter by branch for branch-level users (supervisor/inventory_manager)
          ...((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id && {
            branchId: currentUser.branch.id,
          }),
        };

        // Debug logging for material filtering
        console.log('MaterialRequest fetchMaterials - Debug Info:', {
          currentUserRole: currentUser?.role,
          currentUserBranch: currentUser?.branch,
          branchId: currentUser?.branch?.id,
          params: params,
          isBranchLevel: currentUser?.userType?.isBranchLevel,
          hasBranchId: currentUser?.branch?.id ? true : false,
          fullCurrentUser: currentUser,
          userType: currentUser?.userType,
        });

        const res = await materialsApi.getMaterials(params);
        setAvailableMaterials(res.data);
      } catch (err) {
        console.error('Error fetching materials:', err);
        setMaterialsError('Failed to load materials');
        toast({
          title: 'Error',
          description: 'Failed to load materials',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMaterials(false);
      }
    };

    const fetchMachines = async () => {
      setIsLoadingMachines(true);
      setMachinesError(null);
      try {
        const params = {
          limit: 100,
          sortBy: 'id' as const,
          sortOrder: 'ASC' as const,
          // Filter by branch for branch-level users (supervisor/inventory_manager)
          ...((currentUser?.role === 'supervisor' || currentUser?.role === 'inventory_manager' || currentUser?.userType?.isBranchLevel) && currentUser?.branch?.id && {
            unitId: currentUser.branch.id.toString(),
          }),
        };

        // Debug logging for machine filtering
        console.log('MaterialRequest fetchMachines - Debug Info:', {
          currentUserRole: currentUser?.role,
          currentUserBranch: currentUser?.branch,
          branchId: currentUser?.branch?.id,
          params: params,
          isBranchLevel: currentUser?.userType?.isBranchLevel,
          hasBranchId: currentUser?.branch?.id ? true : false,
          fullCurrentUser: currentUser,
          userType: currentUser?.userType,
        });

        const res = await machinesApi.getAll(params);
        setAvailableMachines(res.data);
      } catch (err) {
        console.error('Error fetching machines:', err);
        setMachinesError('Failed to load machines');
        toast({
          title: 'Error',
          description: 'Failed to load machines',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMachines(false);
      }
    };

    // Add fetch units function
    const fetchUnits = async () => {
      setIsLoadingUnits(true);
      try {
        const res = await getUnits({ limit: 100 });
        setAvailableUnits(res.data || []);
      } catch (err) {
        console.error('Error fetching units:', err);
      } finally {
        setIsLoadingUnits(false);
      }
    };

    fetchMaterials();
    fetchMachines();
    fetchUnits();
  }, [currentUser]);

  const handleItemChange = (itemId: string, field: string, value: string) => {
    if (field === 'reqQuantity' || field === 'notes') {
      activeFieldRef.current = { itemId, field };
    }
    setRequestItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );

    // Clear error for this field
    if (errors[`${field}_${itemId}`]) {
      setErrors((prev) => ({ ...prev, [`${field}_${itemId}`]: '' }));
    }
  };

  // Restore focus to the active input after state updates to prevent blur on each keystroke
  useEffect(() => {
    if (!activeFieldRef.current) return;
    const { itemId, field } = activeFieldRef.current;
    const el = document.getElementById(`${field}-${itemId}`) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | null;
    if (el) {
      const end = el.value.length;
      el.focus();
      const isNumberInput =
        (el as HTMLInputElement).tagName === 'INPUT' &&
        (el as HTMLInputElement).type === 'number';
      if (
        !isNumberInput &&
        typeof (el as HTMLInputElement).setSelectionRange === 'function'
      ) {
        (el as HTMLInputElement).setSelectionRange(end, end);
      }
    }
  }, [requestItems]);

  const handleMultipleFileChange = (itemId: string, files: FileList) => {
    const newFiles = Array.from(files);
    const newPreviews: string[] = [];

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === newFiles.length) {
          setRequestItems((prev) =>
            prev.map((item) =>
              item.id === itemId
                ? {
                  ...item,
                  images: [...(item.images || []), ...newFiles],
                  imagePreviews: [
                    ...(item.imagePreviews || []),
                    ...newPreviews,
                  ],
                }
                : item
            )
          );
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (itemId: string, imageIndex: number) => {
    setRequestItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            images:
              item.images?.filter((_, index) => index !== imageIndex) || [],
            imagePreviews:
              item.imagePreviews?.filter(
                (_, index) => index !== imageIndex
              ) || [],
          }
          : item
      )
    );
  };

  const handleMaterialSelect = (itemId: string, materialId: string) => {
    console.log('Material selected:', materialId);
    const material = getFilteredMaterials().find((m) => m.id.toString() === materialId);
    console.log('Found material:', material);
    if (material) {
      // Use measureUnit.name directly instead of looking up by ID
      const unitName = material.measureUnit?.name || 'units';
      console.log('Unit name for material:', unitName);
      setRequestItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
              ...item,
              materialId: material.id, // Store material ID
              productName: material.name,
              specifications: material.specifications || '',
              measureUnit: unitName, // Use the unit name directly
              oldStock: material.currentStock,
            }
            : item
        )
      );
      
      // Clear search term after selection
      setMaterialSearchTerm('');
    }
  };

  const addNewItem = () => {
    const newItem: RequestItem = {
      id: String(Date.now()),
      srNo: requestItems.length + 1,
      materialId: undefined,
      productName: '',
      machineName: '',
      specifications: '',
      oldStock: 0,
      reqQuantity: '',
      measureUnit: '',
      images: [],
      imagePreviews: [],
      notes: '',
      vendorQuotations: [],
      purposeType: PurposeType.MACHINE,
    };
    setRequestItems((prev) => [...prev, newItem]);
    
    toast({
      title: '➕ New Item Added',
      description: `Item ${requestItems.length + 1} has been added to your request. Please fill in the required details.`,
      variant: 'default',
    });
  };

  const removeItem = (itemId: string) => {
    if (requestItems.length > 1) {
      const itemToRemove = requestItems.find(item => item.id === itemId);
      const confirmed = window.confirm(
        `🗑️ Remove Item\n\n` +
        `Are you sure you want to remove this item?\n` +
        `Material: ${itemToRemove?.productName || 'Not selected'}\n\n` +
        `This action cannot be undone.`
      );
      
      if (confirmed) {
        setRequestItems((prev) => prev.filter((item) => item.id !== itemId));
        toast({
          title: '✅ Item Removed',
          description: 'The item has been successfully removed from your request.',
          variant: 'default',
        });
      }
    } else {
      toast({
        title: '⚠️ Cannot Remove Item',
        description: 'You must have at least one item in your request. Add another item first if you want to remove this one.',
        variant: 'destructive',
      });
    }
  };

  const openVendorForm = (itemId: string) => {
    setCurrentItemId(itemId);
    setVendorFormData({
      id: '',
      vendorName: '',
      contactPerson: '',
      phone: '',
      price: '0',
      quotedPrice: '0',
      notes: '',
      quotationFile: null,
    });
    setIsVendorFormOpen(true);
  };

  const viewVendorQuotations = (itemId: string) => {
    const item = requestItems.find((item) => item.id === itemId);
    if (item) {
      setCurrentQuotations(item.vendorQuotations);
      setCurrentItemId(itemId);
      setIsViewQuotationsOpen(true);
    }
  };

  const handleVendorFormChange = (field: string, value: string) => {
    setVendorFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleVendorFileChange = (file: File) => {
    setVendorFormData((prev) => ({ ...prev, quotationFile: file }));
  };

  const addVendorQuotation = () => {
    const currentItem = requestItems.find((item) => item.id === currentItemId);
    if (currentItem && currentItem.vendorQuotations.length < 4) {
      const newQuotation: VendorQuotation = {
        ...vendorFormData,
        id: String(Date.now()),
        isSelected: true, // Set to true by default so it shows in Current Quotations
      };

      setRequestItems((prev) =>
        prev.map((item) =>
          item.id === currentItemId
            ? {
                ...item,
                vendorQuotations: [...item.vendorQuotations, newQuotation],
              }
            : item
        )
      );

      // Clear form for next entry
      setVendorFormData({
        id: '',
        vendorName: '',
        contactPerson: '',
        phone: '',
        price: '0',
        quotedPrice: '0',
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

  const removeVendorQuotation = (itemId: string, quotationId: string) => {
    setRequestItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
            ...item,
            vendorQuotations: item.vendorQuotations.filter(
              (q) => q.id !== quotationId
            ),
          }
          : item
      )
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    requestItems.forEach((item, index) => {
      const itemNumber = index + 1;
      
      // Material selection validation
      if (!item.productName.trim()) {
        newErrors[`productName_${item.id}`] = `⚠️ Please select a material for Item ${itemNumber}. This is required to proceed.`;
        hasErrors = true;
      }
      
      // Purpose type and machine selection validation
      if (item.purposeType === PurposeType.MACHINE) {
        if (!item.machineName || !item.machineName.trim() || item.machineName === 'Spare' || item.machineName === 'Other' || item.machineName === 'Return') {
          newErrors[`machineName_${item.id}`] = `⚠️ Please select a valid machine for Item ${itemNumber}. Machine selection is required for machine-related requests.`;
          hasErrors = true;
        }
      } else if (item.purposeType === PurposeType.SPARE || item.purposeType === PurposeType.OTHER || item.purposeType === PurposeType.RETURN) {
        if (!item.notes || !item.notes.trim()) {
          newErrors[`notes_${item.id}`] = `⚠️ Please provide detailed notes for Item ${itemNumber}. Notes are required when requesting for ${item.purposeType.toLowerCase()} purpose.`;
          hasErrors = true;
        }
      }
      
      // Quantity validation
      if (!item.reqQuantity.trim()) {
        newErrors[`reqQuantity_${item.id}`] = `⚠️ Please enter the required quantity for Item ${itemNumber}.`;
        hasErrors = true;
      } else {
        const qty = Number(item.reqQuantity);
        if (isNaN(qty) || qty <= 0) {
          newErrors[`reqQuantity_${item.id}`] = `⚠️ Please enter a valid quantity greater than 0 for Item ${itemNumber}.`;
          hasErrors = true;
        }
      }
    });

    setErrors(newErrors);
    
    // Show user-friendly error summary
    if (hasErrors) {
      const errorCount = Object.keys(newErrors).length;
      toast({
        title: '❌ Form Validation Failed',
        description: `Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} before submitting. Check the highlighted fields below.`,
        variant: 'destructive',
      });
    }
    
    return !hasErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }
    
    
    setIsSubmitting(true);
    try {
      // Build JSON structure for items as API expects
      const itemsPayload: CreateMaterialIndentItemInput[] = requestItems.map(
        (item) => {
          // Find machine by name
          const machine = getFilteredMachines().find(
            (m) => m.name === item.machineName
          );

          return {
            materialId: item.materialId || 0, // Use materialId directly from item
            specifications: item.specifications || '',
            requestedQuantity: Number(item.reqQuantity),
            purposeType: item.purposeType,
            machineId: item.purposeType === PurposeType.MACHINE ? machine?.id : undefined,
            machineName: item.purposeType === PurposeType.MACHINE ? undefined : item.machineName, // Send machineName for Spare/Other
            itemImageCount: item.images?.length || 0,
            vendorQuotations: (item.vendorQuotations || [])
              .filter((v) => v.isSelected === true)
              .map((v) => ({
                vendorName: v.vendorName,
                contactPerson: v.contactPerson,
                phone: v.phone,
                price: Number(v.price || 0),
                imageCount: v.quotationFile ? 1 : 0,
                quotationAmount: Number(v.quotedPrice || 0),
                notes: v.notes,
              })),
            notes: item.notes || '',
          };
        }
      );

      const successFullResponse: MaterialIndent[] = [];
      const failedItems: string[] = [];

      // Submit each item individually
      for (let i = 0; i < itemsPayload.length; i++) {
        const item = itemsPayload[i];
        const payload: CreateMaterialIndentRequest = {
          additionalNotes,
          items: [item],
          status: 'pending_approval',
        };

        const form = new FormData();
        if (payload.additionalNotes)
          form.append('additionalNotes', payload.additionalNotes);
        form.append('items', JSON.stringify(payload.items));
        form.append('status', payload.status || 'pending_approval');

        // Append item files for this specific item
        requestItems[i].images?.forEach((file) => {
          form.append('itemFiles', file as File);
        });

        // Append vendor quotation files for this specific item
        requestItems[i].vendorQuotations.forEach((v) => {
          if (v.quotationFile) {
            form.append('quotationFiles', v.quotationFile);
          }
        });

        // Submit via API
        try {
          const created = await materialIndentsApi.create(
            form as unknown as FormData
          );

          successFullResponse.push(created);

          // Show progress toast for each successful submission
          toast({
            title: '✅ Item Submitted Successfully',
            description: `${requestItems[i].productName} has been submitted and is pending approval.`,
            variant: 'default',
          });
        } catch (itemError) {
          const axiosError = itemError as {
            response?: { data?: { message?: string } };
          };
          const message =
            axiosError.response?.data?.message ||
            `Failed to submit ${requestItems[i].productName}`;

          failedItems.push(
            `${requestItems[i].productName} (Item ${i + 1}): ${message}`
          );

          toast({
            title: 'Item Submission Failed',
            description: `Failed to submit ${requestItems[i].productName}`,
            variant: 'destructive',
          });
        }
      }

      // Show final summary with user-friendly messages
      if (successFullResponse.length > 0 && failedItems.length === 0) {
        toast({
          title: '🎉 Request Submitted Successfully!',
          description: `All ${successFullResponse.length} item${successFullResponse.length > 1 ? 's have' : ' has'} been submitted for approval. You will be notified once the Management Team reviews your request.`,
          variant: 'default',
        });
      } else if (successFullResponse.length > 0 && failedItems.length > 0) {
        toast({
          title: '⚠️ Partial Success',
          description: `${successFullResponse.length} item${successFullResponse.length > 1 ? 's were' : ' was'} submitted successfully, but ${failedItems.length} failed. Please check the failed items and try again.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: '❌ Submission Failed',
          description: 'Unfortunately, none of your items could be submitted. Please check your entries and try again. Contact support if the issue persists.',
          variant: 'destructive',
        });
      }

      // Reset form and navigate back if all items were submitted successfully
      if (failedItems.length === 0) {
        setRequestItems([
          {
            id: '1',
            srNo: 1,
            materialId: undefined,
            productName: '',
            machineName: '',
            specifications: '',
            oldStock: 0,
            reqQuantity: '',
            measureUnit: '',
            images: [],
            imagePreviews: [],
            notes: '',
            vendorQuotations: [],
            purposeType: PurposeType.MACHINE,
          },
        ]);
        setAdditionalNotes('');
        setErrors({});
        
        // Navigate back to MaterialOrderBookTab after successful submission
        setTimeout(() => {
          navigate('/materials-inventory', {
            state: { activeTab: 'material-order-book' },
          });
        }, 1500);
      }
    } catch (err) {
      console.error('Error in submission process:', err);
      toast({
        title: 'Submission Error',
        description: 'An unexpected error occurred during submission',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const TableView = () => (
    <Card className='border-0 shadow-none'>
      <CardContent className='p-0 border-none'>
        <div className='overflow-x-auto border-none'>
          <Table className='border-none'>
            <TableHeader className='border-none'>
              <TableRow className='bg-gray-50'>
                <TableHead className='border border-gray-300 font-semibold w-12'>
                  SR.NO.
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-40'>
                  MATERIALS
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-56'>
                  SPECIFICATIONS
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-20'>
                  CURRENT STOCK
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-24'>
                  REQ. QUANTITY
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-20'>
                  IMAGES
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-40'>
                  VENDOR QUOTATIONS
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-52'>
                  MACHINE NAME
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-40'>
                  NOTES
                </TableHead>
                <TableHead className='border border-gray-300 font-semibold w-16'>
                  ACTIONS
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className='border border-gray-300 text-center font-semibold'>
                    {String(item.srNo).padStart(2, '0')}
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <Select
                      value={item.materialId ? item.materialId.toString() : ''}
                      onValueChange={(value) =>
                        handleMaterialSelect(item.id, value)
                      }
                    >
                      <SelectTrigger className='border-0 p-0 h-auto focus:ring-0 focus:outline-none rounded-none'>
                        <SelectValue placeholder='Select Material'>
                          {item.productName && item.materialId && (
                            <div className='flex flex-col'>
                              <div className='font-semibold'>{item.productName}</div>
                              {(() => {
                                const material = getFilteredMaterials().find(m => m.id === item.materialId);
                                return material?.makerBrand && (
                                  <div className='text-xs text-muted-foreground'>
                                    {material.makerBrand}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* <div className='p-2 border-b'>
                          <Input
                            placeholder='Search materials...'
                            value={materialSearchTerm}
                            onChange={(e) => setMaterialSearchTerm(e.target.value)}
                            className='h-8 text-sm'
                          />
                        </div> */}
                        {getFilteredMaterials().length > 0 ? (
                          getFilteredMaterials().map((material) => (
                            <SelectItem key={material.id} value={material.id.toString()}>
                              <div className='flex flex-col'>
                                <div className='font-semibold'>{material.name}</div>
                                {material.makerBrand && (
                                  <div className='text-xs text-muted-foreground'>
                                    {material.makerBrand}
                                  </div>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className='p-2 text-sm text-muted-foreground text-center'>
                            No materials found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    {errors[`productName_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-xs font-medium'>
                          {errors[`productName_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <Textarea
                      value={item.specifications}
                      onChange={(e) => {
                        const value = e.target.value.slice(0, 30);
                        handleItemChange(item.id, 'specifications', value);
                      }}
                      placeholder='Specifications (max 30 chars)'
                      maxLength={30}
                      readOnly
                      className='border-0 p-0 h-auto min-h-[60px] resize-none focus:ring-0 focus:outline-none rounded-none'
                      rows={2}
                    />
                    <div className='text-xs text-muted-foreground mt-1'>
                      {item.specifications.length}/30 characters
                    </div>
                  </TableCell>
                  <TableCell className='border border-gray-300 text-center'>
                    <div className='flex items-center gap-2'>
                    <Input
                      type='number'
                      value={item.oldStock}
                      readOnly
                      onChange={(e) =>
                        handleItemChange(item.id, 'oldStock', e.target.value)
                      }
                      placeholder='0'
                      min='0'
                      className='border-0 p-0 h-auto w-20 text-center focus:ring-0 focus:outline-none rounded-none'
                    />
                      <span className='text-sm text-gray-600'>
                        {item.measureUnit}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <div className='flex items-center gap-2'>
                      <Input
                        id={`reqQuantity-${item.id}`}
                        type='number'
                        value={item.reqQuantity}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            'reqQuantity',
                            e.target.value
                          )
                        }
                        placeholder='Qty'
                        min='0'
                        className='border-0 p-0 h-auto w-20 focus:ring-0 focus:outline-none rounded-none'
                      />
                      <span className='text-sm text-gray-600'>
                        {item.measureUnit}
                      </span>
                    </div>
                    {errors[`reqQuantity_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-xs font-medium'>
                          {errors[`reqQuantity_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <div className='space-y-2'>
                      <div className='flex items-center gap-2'>
                        <Input
                          type='file'
                          accept='image/*'
                          multiple
                          onChange={(e) => {
                            const files = e.target.files;
                            if (files && files.length > 0) {
                              handleMultipleFileChange(item.id, files);
                            }
                          }}
                          className='hidden'
                          id={`images-${item.id}`}
                        />
                        <Label
                          htmlFor={`images-${item.id}`}
                          className='cursor-pointer'
                        >
                          <Camera className='w-4 h-4' />
                        </Label>
                        <span className='text-xs text-muted-foreground'>
                          ({item.imagePreviews?.length || 0} images)
                        </span>
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        Supported: JPG, PNG, GIF
                      </div>
                      {item.imagePreviews && item.imagePreviews.length > 0 && (
                        <div className='flex flex-wrap gap-1'>
                          {item.imagePreviews
                            .slice(0, 3)
                            .map((preview, index) => (
                              <div
                                key={index}
                                className='relative w-8 h-8 rounded border overflow-hidden'
                              >
                                <img
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  className='w-full h-full object-cover'
                                />
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  onClick={() => removeImage(item.id, index)}
                                  className='absolute -top-1 -right-1 h-4 w-4 p-0 bg-red-500 text-white hover:bg-red-600 rounded-full'
                                >
                                  <X className='w-2 h-2' />
                                </Button>
                              </div>
                            ))}
                          {item.imagePreviews.length > 3 && (
                            <div className='w-8 h-8 rounded border flex items-center justify-center bg-gray-100 text-xs'>
                              +{item.imagePreviews.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <div className='space-y-1'>
                      <div className='flex gap-1'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-8 flex-1'
                          onClick={() => openVendorForm(item.id)}
                          disabled={item.vendorQuotations.length >= 4}
                        >
                          <Plus className='w-3 h-3 mr-1' />
                          Add ({item.vendorQuotations.length}/4)
                        </Button>
                        {item.vendorQuotations.length > 0 && (
                          <Button
                            variant='outline'
                            size='sm'
                            className='h-8 w-8 p-0'
                            onClick={() => viewVendorQuotations(item.id)}
                          >
                            <Eye className='w-3 h-3' />
                          </Button>
                        )}
                      </div>
                      {item.vendorQuotations.filter(q => q.isSelected === true).length > 0 && (
                        <div className='space-y-1'>
                          {item.vendorQuotations.filter(q => q.isSelected === true).map((quotation) => (
                            <div
                              key={quotation.id}
                              className='flex items-center justify-between gap-2 text-xs bg-gray-50 p-1 rounded border'
                            >
                              <span className='truncate flex-1 font-medium'>
                                {quotation.vendorName} - {quotation.quotedPrice}
                              </span>
                              <Button
                                variant='ghost'
                                size='sm'
                                onClick={() =>
                                  removeVendorQuotation(item.id, quotation.id)
                                }
                                className='h-4 w-4 p-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                              >
                                <X className='w-2 h-2' />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <Select
                      value={item.machineName}
                      onValueChange={(value) => {
                        handleItemChange(item.id, 'machineName', value);
                        // Update purposeType based on selection
                        if (value === 'Spare') {
                          handleItemChange(item.id, 'purposeType', PurposeType.SPARE);
                        } else if (value === 'Other') {
                          handleItemChange(item.id, 'purposeType', PurposeType.OTHER);
                        } else if (value === 'Return') {
                          handleItemChange(item.id, 'purposeType', PurposeType.RETURN);
                        } else {
                          handleItemChange(item.id, 'purposeType', PurposeType.MACHINE);
                        }
                      }}
                    >
                      <SelectTrigger className='border-0 p-0 h-auto focus:ring-0 focus:outline-none rounded-none'>
                        <SelectValue placeholder='Select Machine *' />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredMachines().map((machine) => (
                          <SelectItem key={machine.id} value={machine.name}>
                            {machine.name}
                          </SelectItem>
                        ))}
                        <SelectItem value='Other'>Other</SelectItem>
                        <SelectItem value='Spare'>Spare</SelectItem>
                        <SelectItem value='Return'>Return</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors[`machineName_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-xs font-medium'>
                          {errors[`machineName_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <Textarea
                      id={`notes-${item.id}`}
                      value={item.notes || ''}
                      onChange={(e) =>
                        handleItemChange(item.id, 'notes', e.target.value)
                      }
                      placeholder={item.purposeType === PurposeType.SPARE || item.purposeType === PurposeType.OTHER || item.purposeType === PurposeType.RETURN ? 'Required for Spare/Other/Return purpose...' : 'Add notes...'}
                      className='border-0 p-0 h-auto min-h-[60px] resize-none focus:ring-0 focus:outline-none rounded-none'
                      rows={2}
                    />
                    {errors[`notes_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-xs font-medium'>
                          {errors[`notes_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className='border border-gray-300'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => removeItem(item.id)}
                      disabled={requestItems.length === 1}
                      className='h-8 w-8 p-0'
                    >
                      <Trash2 className='w-3 h-3' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const ListView = () => (
    <div className='space-y-6'>
      {requestItems.map((item) => (
        <Card key={item.id} className='border-0 shadow-sm'>
          <CardContent className='p-6'>
            <div className='space-y-6'>
              {/* Header with SR.NO and Actions */}
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center'>
                    <span className='text-sm font-bold text-primary'>
                      {String(item.srNo).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <h3 className='text-lg font-semibold text-foreground'>
                      Item {item.srNo}
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      Material Request Item
                    </p>
                  </div>
                </div>
                {requestItems.length > 1 && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => removeItem(item.id)}
                    className='text-destructive hover:text-destructive h-10'
                  >
                    <Trash2 className='w-4 h-4 mr-2' />
                    Remove Item
                  </Button>
                )}
              </div>

              {/* Main Content Grid */}
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                {/* Left Column */}
              <div className='space-y-6'>
                  {/* Materials */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Materials *</Label>
                  <Select
                    value={item.materialId ? item.materialId.toString() : ''}
                    onValueChange={(value) =>
                      handleMaterialSelect(item.id, value)
                    }
                  >
                    <SelectTrigger className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'>
                      <SelectValue placeholder='Select Material'>
                        {item.productName && item.materialId && (
                          <div className='flex flex-col'>
                            <div className='font-semibold'>{item.productName}</div>
                            {(() => {
                              const material = getFilteredMaterials().find(m => m.id === item.materialId);
                              return material?.makerBrand && (
                                <div className='text-xs text-muted-foreground'>
                                  {material.makerBrand}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* <div className='p-2 border-b'>
                        <Input
                          placeholder='Search materials...'
                          value={materialSearchTerm}
                          onChange={(e) => setMaterialSearchTerm(e.target.value)}
                          className='h-8 text-sm'
                        />
                      </div> */}
                      {getFilteredMaterials().length > 0 ? (
                        getFilteredMaterials().map((material) => (
                          <SelectItem key={material.id} value={material.id.toString()}>
                            <div className='flex flex-col'>
                              <div className='font-semibold'>{material.name}</div>
                              {material.makerBrand && (
                                <div className='text-xs text-muted-foreground'>
                                  {material.makerBrand}
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className='p-2 text-sm text-muted-foreground text-center'>
                          No materials found
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  {errors[`productName_${item.id}`] && (
                    <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                      <p className='text-red-700 text-sm font-medium'>
                        {errors[`productName_${item.id}`]}
                      </p>
                    </div>
                  )}
                </div>

                  {/* Specifications */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Specifications</Label>
                  <Textarea
                    value={item.specifications}
                    onChange={(e) => {
                      const value = e.target.value.slice(0, 30);
                      handleItemChange(item.id, 'specifications', value);
                    }}
                    placeholder='Enter detailed specifications (max 30 chars)'
                    maxLength={30}
                      readOnly
                    className='min-h-[50px] px-4 py-3 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm resize-none transition-all duration-200'
                  />
                  <div className='text-xs text-muted-foreground'>
                    {item.specifications.length}/30 characters
                </div>
              </div>

                  {/* Current Stock */}
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>Current Stock</Label>
                    <div className='flex items-center gap-2'>
                    <Input
                      type='number'
                      value={item.oldStock}
                        readOnly
                      onChange={(e) =>
                        handleItemChange(item.id, 'oldStock', e.target.value)
                      }
                      placeholder='0'
                      min='0'
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                      <span className='text-sm text-muted-foreground'>
                        {item.measureUnit}
                      </span>
                  </div>
                  </div>

                  {/* Required Quantity */}
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>
                      Required Quantity *
                    </Label>
                    <div className='flex items-center gap-2'>
                      <Input
                        id={`reqQuantity-${item.id}`}
                        type='number'
                        value={item.reqQuantity}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            'reqQuantity',
                            e.target.value
                          )
                        }
                        placeholder='Enter quantity'
                        min='0'
                        className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                      />
                      <span className='text-sm text-muted-foreground'>
                        {item.measureUnit}
                      </span>
                    </div>
                    {errors[`reqQuantity_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-sm font-medium'>
                          {errors[`reqQuantity_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column */}
                <div className='space-y-6'>
                  {/* Purpose Type */}
                  {/* Machine Name */}
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>
                      Machine Name *
                    </Label>
                    <Select
                      value={item.machineName}
                      onValueChange={(value) => {
                        handleItemChange(item.id, 'machineName', value);
                        // Update purposeType based on selection
                        if (value === 'Spare') {
                          handleItemChange(item.id, 'purposeType', PurposeType.SPARE);
                        } else if (value === 'Other') {
                          handleItemChange(item.id, 'purposeType', PurposeType.OTHER);
                        } else if (value === 'Return') {
                          handleItemChange(item.id, 'purposeType', PurposeType.RETURN);
                        } else {
                          handleItemChange(item.id, 'purposeType', PurposeType.MACHINE);
                        }
                      }}
                    >
                      <SelectTrigger className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'>
                        <SelectValue placeholder='Select Machine *' />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilteredMachines().map((machine) => (
                          <SelectItem key={machine.id} value={machine.name}>
                            {machine.name}
                          </SelectItem>
                        ))}
                        <SelectItem value='Other'>Other</SelectItem>
                        <SelectItem value='Spare'>Spare</SelectItem>
                        <SelectItem value='Return'>Return</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors[`machineName_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-sm font-medium'>
                          {errors[`machineName_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Images */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>Images</Label>
                  <div className='text-xs text-muted-foreground mb-2'>
                    Supported formats: JPG, PNG, GIF
                  </div>
                  <div className='space-y-4'>
                    <Input
                      type='file'
                      accept='image/*'
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          handleMultipleFileChange(item.id, files);
                        }
                      }}
                      className='flex-1 h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                    {item.imagePreviews && item.imagePreviews.length > 0 && (
                      <div className='grid grid-cols-4 gap-2'>
                        {item.imagePreviews.map((preview, index) => (
                          <div
                            key={index}
                            className='relative w-16 h-16 rounded-[5px] border overflow-hidden'
                          >
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className='w-full h-full object-cover'
                            />
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => removeImage(item.id, index)}
                              className='absolute -top-1 -right-1 h-5 w-5 p-0 bg-red-500 text-white hover:bg-red-600 rounded-full'
                            >
                              <X className='w-3 h-3' />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className='text-xs text-muted-foreground'>
                      {item.imagePreviews?.length || 0} image(s) selected
                    </div>
                  </div>
                </div>

                  {/* Vendor Quotations */}
                <div className='space-y-2'>
                  <Label className='text-sm font-medium'>
                    Vendor Quotations ({item.vendorQuotations.length}/4)
                  </Label>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      className='flex-1 h-11'
                      onClick={() => openVendorForm(item.id)}
                      disabled={item.vendorQuotations.length >= 4}
                    >
                      <Plus className='w-4 h-4 mr-2' />
                      Add Vendor Quotation
                    </Button>
                    {item.vendorQuotations.length > 0 && (
                      <Button
                        variant='outline'
                        onClick={() => viewVendorQuotations(item.id)}
                        className='px-3 h-11'
                      >
                        <Eye className='w-4 h-4' />
                      </Button>
                    )}
                  </div>
                  {item.vendorQuotations.filter(q => q.isSelected === true).length > 0 && (
                    <div className='space-y-2'>
                      {item.vendorQuotations.filter(q => q.isSelected === true).map((quotation) => (
                        <div
                          key={quotation.id}
                          className='flex items-center justify-between p-3 bg-muted/30 rounded-[5px] border'
                        >
                          <div>
                            <div className='font-medium text-sm'>
                              {quotation.vendorName}
                            </div>
                            <div className='text-xs text-muted-foreground'>
                              {quotation.quotedPrice}
                            </div>
                          </div>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              removeVendorQuotation(item.id, quotation.id)
                            }
                            className='h-6 w-6 p-0'
                          >
                            <X className='w-3 h-3' />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                  {/* Notes */}
                  <div className='space-y-2'>
                    <Label className='text-sm font-medium'>
                      Notes {item.purposeType === PurposeType.SPARE || item.purposeType === PurposeType.OTHER || item.purposeType === PurposeType.RETURN ? '*' : ''}
                    </Label>
                    <p className='text-xs text-muted-foreground'> {item.purposeType === PurposeType.SPARE || item.purposeType === PurposeType.OTHER || item.purposeType === PurposeType.RETURN ? 'Notes are required for Spare/Other/Return purposes. Please provide detailed information.' : 'Optional: Add any additional notes or special requirements.'}</p>
                    <Textarea
                      id={`notes-${item.id}`}
                      value={item.notes || ''}
                      onChange={(e) =>
                        handleItemChange(item.id, 'notes', e.target.value)
                      }
                      placeholder={item.purposeType === PurposeType.SPARE || item.purposeType === PurposeType.OTHER || item.purposeType === PurposeType.RETURN ? 'Required for Spare/Other/Return purpose...' : 'Add notes...'}
                      className='min-h-[60px] px-4 py-3 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm resize-none transition-all duration-200'
                      rows={2}
                    />
                    {errors[`notes_${item.id}`] && (
                      <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                        <p className='text-red-700 text-sm font-medium'>
                          {errors[`notes_${item.id}`]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Show loading screen until all data is fetched
  if (isInitialLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] space-y-4'>
        <div className='relative'>
          <div className='w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin'></div>
        </div>
        <div className='text-center space-y-2'>
          <h3 className='text-lg font-semibold text-foreground'>Loading Material Request Form</h3>
          <p className='text-sm text-muted-foreground'>
            Fetching materials, machines, and units...
          </p>
          <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground'>
            <div className='flex items-center gap-1'>
              {isLoadingMaterials ? (
                <div className='w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin'></div>
              ) : (
                <svg className='w-3 h-3 text-green-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
              )}
              <span>Materials</span>
            </div>
            <span>•</span>
            <div className='flex items-center gap-1'>
              {isLoadingMachines ? (
                <div className='w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin'></div>
              ) : (
                <svg className='w-3 h-3 text-green-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
              )}
              <span>Machines</span>
            </div>
            <span>•</span>
            <div className='flex items-center gap-1'>
              {isLoadingUnits ? (
                <div className='w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin'></div>
              ) : (
                <svg className='w-3 h-3 text-green-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                </svg>
              )}
              <span>Units</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-4 sm:space-y-6 p-4 sm:p-0'>
      {/* Header */}
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => navigate('/materials-inventory')}
            className='gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Back
          </Button>
          <div className='flex items-center gap-3'>
            <div>
              <h1 className='text-sm sm:text-1xl md:text-2xl lg:text-3xl font-bold text-foreground mb-1'>
                Requisition & Indent form
              </h1>
            </div>
          </div>
        </div>

        {/* List/Table Toggle and Add Item Button */}
        <div className='flex items-center gap-3'>
          <div className='flex rounded-xl border border-secondary overflow-hidden bg-secondary/10/50 w-fit shadow-sm'>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('list')}
              className={`rounded-none px-3 sm:px-4 ${viewMode === 'list'
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'text-foreground hover:text-foreground hover:bg-secondary/20'
                }`}
            >
              <List className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>List</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => setViewMode('table')}
              className={`rounded-none px-3 sm:px-4 ${viewMode === 'table'
                  ? 'bg-primary text-white hover:bg-primary-hover'
                  : 'text-foreground hover:text-foreground hover:bg-secondary/20'
                }`}
            >
              <TableIcon className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>Table</span>
            </Button>
          </div>

          <Button type='button' onClick={addNewItem} className='gap-2'>
            <Plus className='w-4 h-4' />
            Add New Item
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4 sm:space-y-6'>
        {/* Items Section */}
        {viewMode === 'table' ? <TableView /> : <ListView />}

        {/* Form Actions */}
        <div className='flex justify-center gap-4 pt-6'>
          <Button 
            type='submit' 
            size='lg' 
            className='min-w-48 gap-2'
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </Button>
          <Button
            type='button'
            size='lg'
            variant='outline'
            onClick={() => navigate('/materials-inventory')}
            className='min-w-48 gap-2'
            disabled={isSubmitting}
          >
            <X className='w-5 h-5' />
            Cancel
          </Button>
        </div>
      </form>

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
                  {requestItems.find((item) => item.id === currentItemId)
                    ?.vendorQuotations.length || 0}
                  /4 Quotations
                </Badge>
              </div>

              <div className='border rounded-lg overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-gray-50'>
                      <TableHead className='border-r font-semibold w-12'>
                        SR.
                      </TableHead>
                      <TableHead className='border-r font-semibold w-36'>
                        Vendor Name
                      </TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Contact Person
                      </TableHead>
                      <TableHead className='border-r font-semibold w-28'>
                        Phone
                      </TableHead>
                      <TableHead className='border-r font-semibold w-24'>
                        Price
                      </TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Total Quotation Amount
                      </TableHead>
                      <TableHead className='border-r font-semibold w-44'>
                        Notes
                      </TableHead>
                      <TableHead className='border-r font-semibold w-28'>
                        File
                      </TableHead>
                      <TableHead className='font-semibold w-16'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestItems
                      .find((item) => item.id === currentItemId)
                      ?.vendorQuotations.filter(q => q.isSelected === true).map((quotation, index) => (
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
                          <TableCell className='border-r'>
                            {quotation.phone}
                          </TableCell>
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
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() =>
                                removeVendorQuotation(
                                  currentItemId,
                                  quotation.id
                                )
                              }
                              className='h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                            >
                              <Trash2 className='w-3 h-3' />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    {!requestItems.find((item) => item.id === currentItemId)
                      ?.vendorQuotations.length && (
                        <TableRow>
                          <TableCell
                            colSpan={8}
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
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='contactPerson'
                    className='text-sm font-medium'
                  >
                    Contact Person
                  </Label>
                  <Input
                    id='contactPerson'
                    value={vendorFormData.contactPerson}
                    onChange={(e) =>
                      handleVendorFormChange('contactPerson', e.target.value)
                    }
                    placeholder='Enter contact person'
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='phone' className='text-sm font-medium'>
                    Phone
                  </Label>
                  <Input
                    id='phone'
                    value={vendorFormData.phone}
                    onChange={(e) =>
                      handleVendorFormChange('phone', e.target.value)
                    }
                    placeholder='Enter phone number'
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='price' className='text-sm font-medium'>
                    Price*
                  </Label>
                  <Input
                    id='price'
                    value={vendorFormData.price}
                    onChange={(e) =>
                      handleVendorFormChange('price', e.target.value)
                    }
                    placeholder='Enter Price'
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
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
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
                  />
                </div>
                <div className='space-y-2'>
                  <Label
                    htmlFor='quotationFile'
                    className='text-sm font-medium'
                  >
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
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
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
                    onChange={(e) =>
                      handleVendorFormChange('notes', e.target.value)
                    }
                    placeholder='Additional notes or comments'
                    className='h-10 px-3 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-md text-sm transition-all duration-200'
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
                    (requestItems.find((item) => item.id === currentItemId)
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
      <Dialog
        open={isViewQuotationsOpen}
        onOpenChange={setIsViewQuotationsOpen}
      >
        <DialogContent className='max-w-6xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Eye className='w-5 h-5 text-foreground' />
              Vendor Quotations
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            {currentQuotations.length > 0 ? (
              <div className='border rounded-lg overflow-hidden'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-gray-50'>
                      <TableHead className='border-r font-semibold w-12'>
                        SR.
                      </TableHead>
                      <TableHead className='border-r font-semibold w-36'>
                        Vendor Name
                      </TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Contact Person
                      </TableHead>
                      <TableHead className='border-r font-semibold w-28'>
                        Phone
                      </TableHead>
                      <TableHead className='border-r font-semibold w-32'>
                        Total Quotation Amount
                      </TableHead>
                      <TableHead className='border-r font-semibold w-44'>
                        Notes
                      </TableHead>
                      <TableHead className='border-r font-semibold w-28'>
                        File
                      </TableHead>
                      <TableHead className='font-semibold w-16'>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentQuotations.map((quotation, index) => (
                      <TableRow key={quotation.id}>
                        <TableCell className='border-r text-center font-medium'>
                          {index + 1}
                        </TableCell>
                        <TableCell className='border-r font-medium'>
                          {quotation.vendorName}
                        </TableCell>
                        <TableCell className='border-r'>
                          {quotation.contactPerson || '-'}
                        </TableCell>
                        <TableCell className='border-r'>
                          {quotation.phone || '-'}
                        </TableCell>
                        <TableCell className='border-r font-medium text-primary'>
                          {quotation.quotedPrice}
                        </TableCell>
                        <TableCell className='border-r text-sm max-w-32'>
                          <div
                            className='truncate'
                            title={quotation.notes || ''}
                          >
                            {quotation.notes || '-'}
                          </div>
                        </TableCell>
                        <TableCell className='border-r'>
                          {quotation.quotationFile ? (
                            <div className='flex items-center gap-1 text-sm'>
                              <FileText className='w-3 h-3' />
                              <span
                                className='truncate max-w-20'
                                title={quotation.quotationFile.name}
                              >
                                {quotation.quotationFile.name}
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() =>
                              removeVendorQuotation(currentItemId, quotation.id)
                            }
                            className='h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                          >
                            <Trash2 className='w-3 h-3' />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className='text-center py-8'>
                <FileText className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                <h3 className='text-lg font-semibold text-foreground mb-2'>
                  No Quotations
                </h3>
                <p className='text-muted-foreground'>
                  No vendor quotations have been added for this item yet.
                </p>
              </div>
            )}
          </div>

          <div className='flex justify-end pt-4'>
            <Button
              variant='outline'
              onClick={() => setIsViewQuotationsOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialRequest;