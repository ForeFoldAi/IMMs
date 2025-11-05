import logo from '/logo.png';
import { useState, useEffect, useRef } from 'react';
import {
  Package,
  Save,
  X,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  FileText,
  Building2,
  Trash2,
  Plus,
  Edit,
  Loader2,
  Upload,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { toast } from '../hooks/use-toast';
import { useRole } from '../contexts/RoleContext';
import {
  Material,
  MaterialIssue,
  Machine,
  MaterialIssueItem,
} from '../lib/api/types';
import { materialsApi } from '../lib/api/materials';
import { materialIssuesApi } from '../lib/api/material-issues';
import { machinesApi } from '../lib/api/machines';

export enum PurposeType {
  MACHINE = 'machine',
  OTHER = 'other',
  SPARE = 'spare',
}

interface MaterialIssueFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (issueData: MaterialIssue) => void;
  editingIssue?: Record<string, unknown>;
}

interface MaterialItemFormData {
  id: string; // Add unique ID for React keys
  srNo: number;
  materialId: number;
  nameOfMaterial: string;
  makerBrand: string;
  specifications: string;
  existingStock: number;
  issuedQty: string;
  stockAfterIssue: number;
  measureUnit: string;
  receiverName: string;
  image: File | null;
  imagePreview?: string;
  purpose: string;
  machineId: number;
  machineName: string;
  purposeType: PurposeType;
  notes: string;
}

export const MaterialIssueForm = ({
  isOpen,
  onClose,
  onSubmit,
  editingIssue,
}: MaterialIssueFormProps) => {
  const { currentUser } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);

  // Helper function to format date as dd-mm-yyyy
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const [formData, setFormData] = useState({
    // Document Information
    date: new Date().toISOString().split('T')[0],
    // Material items (supporting multiple items)
    items: [
      {
        id: `item-${Date.now()}-${Math.random()}`, // Generate unique ID
        srNo: 1,
        materialId: 0,
        nameOfMaterial: '',
        makerBrand: '',
        specifications: '',
        existingStock: 0,
        issuedQty: '',
        stockAfterIssue: 0,
        measureUnit: '',
        receiverName: '',
        image: null as File | null,
        imagePreview: '',
        purpose: '',
        machineId: 0,
        machineName: '',
        purposeType: PurposeType.MACHINE,
        notes: '',
      } as MaterialItemFormData,
    ],
    // Additional fields
    additionalNotes: '',
  });

  // Effect to populate form when editing
  useEffect(() => {
    if (editingIssue && isOpen) {
      // Add a small delay to ensure dialog is fully rendered
      const timer = setTimeout(() => {
        LoadEditData();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!editingIssue && isOpen) {
      // Reset form for new issue
      setFormData({
        date: new Date().toISOString().split('T')[0],
        items: [
          {
            id: `new-item-${Date.now()}-${Math.random()}`, // Generate unique ID for new item
            srNo: 1,
            materialId: 0,
            nameOfMaterial: '',
            makerBrand: '',
            specifications: '',
            existingStock: 0,
            issuedQty: '',
            stockAfterIssue: 0,
            measureUnit: '',
            receiverName: '',
            image: null,
            imagePreview: '',
            purpose: '',
            machineId: 0,
            machineName: '',
            purposeType: PurposeType.MACHINE,
            notes: '',
          } as MaterialItemFormData,
        ],
        additionalNotes: '',
      });
    }
  }, [editingIssue, isOpen, currentUser]);

  const LoadEditData = async () => {
    if (!editingIssue) return;
    
    setIsLoadingEditData(true);
    
    try {
      const issuedDate = String(editingIssue.issuedDate || '');
      const items = editingIssue.allItems as MaterialIssueItem[];
      const formattedItems: MaterialItemFormData[] = [];

      // Process items sequentially to avoid race conditions
      for (const item of items) {
        let imagePreview = '';
        
        try {
          // Get image preview with error handling
          const imageResponse = await materialIssuesApi.getItemImage(
            Number(editingIssue.originalIssue['id']),
            Number(item.id)
          );
          imagePreview = imageResponse?.url || '';
        } catch (imageError) {
          console.warn('Failed to load image for item:', item.id, imageError);
          imagePreview = '';
        }

        formattedItems.push({
          id: `edit-item-${item.id}-${Date.now()}`, // Generate unique ID for editing
          srNo: item.id,
          materialId: Number(
            item.material
              ? (item.material as unknown as Record<string, unknown>).id
              : 0
          ),
          nameOfMaterial: String(
            item.material
              ? (item.material as unknown as Record<string, unknown>).name
              : ''
          ),
          makerBrand: String(
            item.material
              ? (item.material as unknown as Record<string, unknown>)
                  .makerBrand || ''
              : ''
          ),
          specifications: String(
            item.material
              ? (item.material as unknown as Record<string, unknown>)
                  .specifications || ''
              : ''
          ),
          existingStock: Number(item.stockBeforeIssue || 0),
          issuedQty: String(item.issuedQuantity || 0),
          stockAfterIssue: Number(item.stockAfterIssue || 0),
          measureUnit: String(
            item.material
              ? (
                  (item.material as unknown as Record<string, unknown>)
                    .measureUnit as Record<string, unknown>
                )?.name || 'units'
              : 'units'
          ),
          receiverName: String(item.receiverName || ''),
          image: null as File | null,
          imagePreview: imagePreview,
          purpose: String(item.purpose || ''),
          machineId: Number(item.machineId || 0),
          machineName: String(item.machineName || ''),
          purposeType: (item.purposeType as PurposeType) || PurposeType.MACHINE,
          notes: String(item.notes || ''),
        } as unknown as MaterialItemFormData);
      }
      
      setFormData({
        date: issuedDate,
        items: formattedItems,
        additionalNotes: String(editingIssue.additionalNotes || ''),
      });
    } catch (error) {
      console.error('Error loading edit data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load material issue details. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingEditData(false);
    }
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(
    null
  );
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(false);
  const [isLoadingMachines, setIsLoadingMachines] = useState<boolean>(false);
  const [materialsError, setMaterialsError] = useState<string | null>(null);
  const [machinesError, setMachinesError] = useState<string | null>(null);

  // Filter materials based on user type and branch
  // Note: Materials are filtered at API level using branchId parameter
  // This function returns materials sorted alphabetically by name
  const getFilteredMaterials = () => {
    console.log(
      'MaterialIssueForm: Returning materials (API filtering already applied):',
      {
        currentUserRole: currentUser?.role,
        currentUserBranch: currentUser?.branch,
        totalMaterials: availableMaterials.length,
        materialNames: availableMaterials.map((m) => m.name),
      }
    );

    // Sort materials alphabetically by name
    return [...availableMaterials].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  };

  // Filter machines based on user type and branch
  // This ensures branch-level users (supervisor/inventory_manager) only see machines from their branch
  const getFilteredMachines = () => {
    // If user is company owner or doesn't have branch restrictions, return all machines
    if (!currentUser?.userType?.isBranchLevel || !currentUser?.branch?.id) {
      console.log(
        'MaterialIssueForm: Returning all machines (company-level user or no branch)'
      );
      return availableMachines;
    }

    // For branch-level users, filter machines by their branch
    const filtered = availableMachines.filter((machine) => {
      // If machine doesn't have branch info, include it (for backward compatibility)
      if (!machine.branch) {
        return true;
      }
      return machine.branch.id === currentUser.branch!.id;
    });

    console.log('MaterialIssueForm: Filtered machines for branch-level user:', {
      userBranchId: currentUser.branch.id,
      userBranchName: currentUser.branch.name,
      totalMachines: availableMachines.length,
      filteredMachines: filtered.length,
      filteredMachineNames: filtered.map((m) => m.name),
    });

    return filtered;
  };

  // Fetch materials and machines from API
  useEffect(() => {
    const fetchData = async () => {
      // Fetch materials
      setIsLoadingMaterials(true);
      setMaterialsError(null);
      try {
        const params = {
          limit: 100,
          sortBy: 'name' as const,
          sortOrder: 'ASC' as const,
          // Filter by branch for branch-level users (supervisor/inventory_manager)
          ...((currentUser?.role === 'supervisor' ||
            currentUser?.role === 'inventory_manager' ||
            currentUser?.userType?.isBranchLevel) &&
            currentUser?.branch?.id && {
              branchId: currentUser.branch.id,
            }),
        };

        // Debug logging for material filtering
        console.log('MaterialIssueForm fetchMaterials - Debug Info:', {
          currentUserRole: currentUser?.role,
          currentUserBranch: currentUser?.branch,
          branchId: currentUser?.branch?.id,
          params: params,
          isBranchLevel: currentUser?.userType?.isBranchLevel,
          hasBranchId: currentUser?.branch?.id ? true : false,
          fullCurrentUser: currentUser,
          userType: currentUser?.userType,
        });

        const response = await materialsApi.getMaterials(params);
        setAvailableMaterials(response.data);
      } catch (error) {
        console.error('Error fetching materials:', error);
        setMaterialsError('Failed to load materials. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load materials. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMaterials(false);
      }

      // Fetch machines
      setIsLoadingMachines(true);
      setMachinesError(null);
      try {
        const params = {
          limit: 100,
          sortBy: 'name' as const,
          sortOrder: 'ASC' as const,
          // Filter by branch for branch-level users (supervisor/inventory_manager)
          ...((currentUser?.role === 'supervisor' ||
            currentUser?.role === 'inventory_manager' ||
            currentUser?.userType?.isBranchLevel) &&
            currentUser?.branch?.id && {
              unitId: currentUser.branch.id.toString(),
            }),
        };

        // Debug logging for machine filtering
        console.log('MaterialIssueForm fetchMachines - Debug Info:', {
          currentUserRole: currentUser?.role,
          currentUserBranch: currentUser?.branch,
          branchId: currentUser?.branch?.id,
          params: params,
          isBranchLevel: currentUser?.userType?.isBranchLevel,
          hasBranchId: currentUser?.branch?.id ? true : false,
          fullCurrentUser: currentUser,
          userType: currentUser?.userType,
        });

        const response = await machinesApi.getAll(params);
        setAvailableMachines(response.data);
      } catch (error) {
        console.error('Error fetching machines:', error);
        setMachinesError('Failed to load machines. Please try again.');
        toast({
          title: 'Error',
          description: 'Failed to load machines. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMachines(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, currentUser]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // Validate each item in the items array
    formData.items.forEach((item, index) => {
      const itemNumber = index + 1;

      // Material name validation
      if (!item.nameOfMaterial.trim()) {
        newErrors[
          `nameOfMaterial_${index}`
        ] = `⚠️ Please select a material for Item ${itemNumber}. This is required to issue materials.`;
        hasErrors = true;
      }

      // Material ID validation
      if (!item.materialId) {
        newErrors[
          `materialId_${index}`
        ] = `⚠️ Please select a valid material for Item ${itemNumber}. Choose from the dropdown list.`;
        hasErrors = true;
      }

      // Issued quantity validation
      if (!item.issuedQty.trim()) {
        newErrors[
          `issuedQty_${index}`
        ] = `⚠️ Please enter the quantity to issue for Item ${itemNumber}.`;
        hasErrors = true;
      } else {
        const issuedQty = Number(item.issuedQty);
        if (isNaN(issuedQty) || issuedQty <= 0) {
          newErrors[
            `issuedQty_${index}`
          ] = `⚠️ Please enter a valid quantity greater than 0 for Item ${itemNumber}.`;
          hasErrors = true;
        } else if (issuedQty > item.existingStock) {
          newErrors[
            `issuedQty_${index}`
          ] = `⚠️ Cannot issue ${issuedQty} units. Available stock is only ${item.existingStock} units for Item ${itemNumber}.`;
          hasErrors = true;
        }
      }

      // Receiver name validation
      if (!item.receiverName.trim()) {
        newErrors[
          `receiverName_${index}`
        ] = `⚠️ Please enter the receiver's name for Item ${itemNumber}. This helps track who received the materials.`;
        hasErrors = true;
      }

      // Purpose validation
      if (!item.purpose.trim()) {
        newErrors[
          `purpose_${index}`
        ] = `⚠️ Please specify the purpose for issuing Item ${itemNumber}. This helps track material usage.`;
        hasErrors = true;
      }

      // Machine selection validation
      if (!item.machineName) {
        newErrors[
          `machineId_${index}`
        ] = `⚠️ Please select a machine or specify 'Other' for Item ${itemNumber}. This helps track material allocation.`;
        hasErrors = true;
      }
    });

    setErrors(newErrors);

    // Show user-friendly error summary
    if (hasErrors) {
      const errorCount = Object.keys(newErrors).length;
      toast({
        title: '❌ Form Validation Failed',
        description: `Please fix ${errorCount} error${
          errorCount > 1 ? 's' : ''
        } before issuing materials. Check the highlighted fields below.`,
        variant: 'destructive',
      });
    }

    return !hasErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Form submission started');
    console.log('Form data:', formData);

    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }

    // Show confirmation dialog
    const totalItems = formData.items.length;
    const totalQuantity = formData.items.reduce(
      (sum, item) => sum + Number(item.issuedQty || 0),
      0
    );


    console.log('Form validation passed');
    setIsSubmitting(true);

    try {
      // Prepare valid items
      const validItems = formData.items.filter(
        (item) => item.nameOfMaterial && item.issuedQty
      );

      console.log('Valid items:', validItems);

      let successCount = 0;
      let failureCount = 0;
      let lastSuccessResponse: MaterialIssue | null = null;

      // Submit one API request per item (sequentially)
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];

        const singleItemForm = new FormData();
        singleItemForm.append('additionalNotes', formData.additionalNotes);
        singleItemForm.append('issueDate', formData.date);

        const itemPayload = {
          materialId: item.materialId,
          issuedQuantity: parseInt(item.issuedQty),
          receiverName: item.receiverName,
          purpose: item.purpose,
          purposeType:
            item.machineName === 'Other'
              ? PurposeType.OTHER
              : PurposeType.MACHINE,
          ...(item.machineName === 'Other'
            ? { machineName: 'Other' }
            : { machineId: item.machineId }),
          notes: item.notes,
        };

        console.log('Item payload:', itemPayload);
        singleItemForm.append('items', JSON.stringify([itemPayload]));

        if (item.image) {
          singleItemForm.append('files', item.image);
        }

        // Debug: Log FormData contents
        console.log('FormData contents:');
        for (const [key, value] of singleItemForm.entries()) {
          console.log(`${key}:`, value);
        }

        try {
          console.log('Sending API request for item:', i + 1);
          const resp = await materialIssuesApi.create(singleItemForm);
          console.log('API response:', resp);
          lastSuccessResponse = resp;
          successCount++;
        } catch (err) {
          console.error('Error issuing item:', err);
          console.error('Error details:', err);
          failureCount++;
        }
      }

      // Notify parent with last successful response (if any)
      if (lastSuccessResponse) {
        onSubmit(lastSuccessResponse);
      }

      // Toast summary with user-friendly messages
      const total = validItems.length;
      if (successCount === total) {
        toast({
          title: '🎉 Materials Issued Successfully!',
          description: `All ${successCount} item${
            successCount > 1 ? 's have' : ' has'
          } been issued successfully. Stock levels have been updated and records created.`,
          variant: 'default',
        });
      } else if (successCount > 0) {
        toast({
          title: '⚠️ Partial Success',
          description: `${successCount} item${
            successCount > 1 ? 's were' : ' was'
          } issued successfully, but ${failureCount} failed. Please check the failed items and try again.`,
          variant: 'destructive',
        });
      } else {
        throw new Error('All item submissions failed.');
      }

      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        items: [
          {
            id: `reset-item-${Date.now()}-${Math.random()}`, // Generate unique ID for reset
            srNo: 1,
            materialId: 0,
            nameOfMaterial: '',
            makerBrand: '',
            specifications: '',
            existingStock: 0,
            issuedQty: '',
            stockAfterIssue: 0,
            measureUnit: '',
            receiverName: '',
            image: null,
            imagePreview: '',
            purpose: '',
            machineId: 0,
            machineName: '',
            purposeType: PurposeType.MACHINE,
            notes: '',
          } as MaterialItemFormData,
        ],
        additionalNotes: '',
      });

      setSelectedMaterial(null);
      setErrors({});
      onClose();
    } catch (error: unknown) {
      const err = error as {
        response?: {
          data?: { message?: string };
          status?: number;
        };
        message?: string;
      };

      console.error('Error creating material issue:', error);

      let errorMessage = 'Failed to create material issue. Please try again.';

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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-[98vw] max-h-[98vh] overflow-y-auto p-6'>
        <DialogHeader className='pb-4'>
          <DialogTitle className='flex items-center gap-2'>
            <div className='w-8 h-8 bg-secondary/20 rounded-lg flex items-center justify-center'>
              <FileText className='w-4 h-4 text-foreground' />
            </div>
            <div>
              <div className='text-lg font-bold'>
                {editingIssue
                  ? 'ISSUED MATERIAL DETAILS'
                  : 'MATERIAL ISSUE FORM'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-3'>
          {/* Loading indicator for edit data */}
          {editingIssue && isLoadingEditData && (
            <div className='flex items-center justify-center py-8'>
              <div className='flex items-center gap-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm text-muted-foreground'>
                  Loading material issue details...
                </span>
              </div>
            </div>
          )}

          {/* Add Item Button - Only show when not editing */}
          {!editingIssue && (
            <div className='flex justify-end'>
              <Button
                type='button'
                onClick={() => {
                  const newItem = {
                    id: `item-${Date.now()}-${Math.random()}`, // Generate unique ID for new item
                    srNo: formData.items.length + 1,
                    nameOfMaterial: '',
                    makerBrand: '',
                    specifications: '',
                    existingStock: 0,
                    issuedQty: '',
                    stockAfterIssue: 0,
                    measureUnit: '',
                    receiverName: '',
                    image: null,
                    imagePreview: '',
                    materialId: 0,
                    purpose: '',
                    machineId: 0,
                    machineName: '',
                    purposeType: PurposeType.MACHINE,
                    notes: '',
                  };
                  setFormData((prev) => ({
                    ...prev,
                    items: [...prev.items, newItem],
                  }));

                  toast({
                    title: '➕ New Item Added',
                    description: `Item ${
                      formData.items.length + 1
                    } has been added. Please fill in the required details.`,
                    variant: 'default',
                  });
                }}
                className='gap-1 h-8 text-xs'
                size='sm'
              >
                <Plus className='w-3 h-3' />
                Add Item
              </Button>
            </div>
          )}

          {/* Material Items Table - Compact */}
          {!(editingIssue && isLoadingEditData) && (
          <Card>
            <CardContent className='p-0'>
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow className='bg-gray-50'>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-16'>
                        SR.NO.
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-48'>
                        ISSUING MATERIAL *
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-48'>
                        SPECIFICATIONS
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-24'>
                        CURRENT STOCK
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-28'>
                        ISSUING QTY *
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-24'>
                        STOCK AFTER ISSUE
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 min-w-40'>
                        ISSUING TO *
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-40'>
                        ISSUING FOR *
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-32'>
                        UPLOAD IMAGE
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-48'>
                        PURPOSE OF ISSUE *
                      </TableHead>
                      <TableHead className='border border-gray-300 font-semibold text-xs px-2 py-1 w-20'>
                        ACTIONS
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className='border border-gray-300 text-center font-semibold text-xs px-2 py-1'>
                          <span className={editingIssue ? 'text-black' : ''}>
                            {item.srNo}
                          </span>
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-xs'>
                              <div className='font-medium'>
                                {item.nameOfMaterial}
                              </div>
                              {(() => {
                                // Get makerBrand from item or fallback to filtered materials
                                const makerBrand =
                                  item.makerBrand ||
                                  getFilteredMaterials().find(
                                    (m) => m.name === item.nameOfMaterial
                                  )?.makerBrand ||
                                  '';
                                return (
                                  makerBrand && (
                                    <div className='text-black text-xs mt-1'>
                                      {makerBrand}
                                    </div>
                                  )
                                );
                              })()}
                            </div>
                          ) : (
                            <Select
                              value={item.materialId ? item.materialId.toString() : ''}
                              onValueChange={(value) => {
                                const material = getFilteredMaterials().find(
                                  (m) => m.id.toString() === value
                                );
                                if (material) {
                                  const newItems = [...formData.items];
                                  newItems[index] = {
                                    ...item,
                                    nameOfMaterial: material.name,
                                    makerBrand: material.makerBrand || '',
                                    specifications:
                                      material.specifications || '',
                                    existingStock: material.currentStock,
                                    measureUnit:
                                      material.measureUnit?.name || 'units',
                                    stockAfterIssue:
                                      material.currentStock -
                                      Number(item.issuedQty || 0),
                                    materialId: material.id,
                                  };
                                  setFormData((prev) => ({
                                    ...prev,
                                    items: newItems,
                                  }));
                                }
                              }}
                              disabled={isLoadingMaterials || !!editingIssue}
                            >
                              <SelectTrigger className='border-0 p-0 h-auto text-xs'>
                                {isLoadingMaterials ? (
                                  <div className='flex items-center gap-2'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder='Select Material'>
                                    {item.nameOfMaterial && (
                                      <div className='flex flex-col'>
                                        <span>{item.nameOfMaterial}</span>
                                        {item.makerBrand && (
                                          <span className='text-xs text-muted-foreground'>
                                            {item.makerBrand}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </SelectValue>
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {materialsError ? (
                                  <div className='p-2 text-xs text-destructive'>
                                    {materialsError}
                                  </div>
                                ) : (
                                  getFilteredMaterials().map((material) => (
                                    <SelectItem
                                      key={material.id}
                                      value={material.id.toString()}
                                    >
                                      <div className='flex flex-col'>
                                        <span>{material.name}</span>
                                        {material.makerBrand && (
                                          <span className='text-xs text-muted-foreground'>
                                            {material.makerBrand}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          {errors[`nameOfMaterial_${index}`] && (
                            <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                              <p className='text-red-700 text-xs font-medium'>
                                {errors[`nameOfMaterial_${index}`]}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-xs font-medium'>
                              {item.specifications || 'No specifications'}
                            </div>
                          ) : (
                            <div className='text-xs text-muted-foreground'>
                              {item.specifications || 'specifications'}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 text-center px-2 py-1'>
                          <div
                            className={`font-semibold text-xs ${
                              editingIssue ? 'text-black' : ''
                            }`}
                          >
                            {item.existingStock} {item.measureUnit || 'units'}
                          </div>
                        </TableCell>
                        <TableCell className='border border-gray-300 text-center px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-xs font-semibold'>
                              {item.issuedQty} {item.measureUnit || 'units'}
                            </div>
                          ) : (
                            <div className='flex items-center gap-1'>
                              <Input
                                type='number'
                                value={item.issuedQty}
                                onChange={(e) => {
                                  const issuedQty = Number(e.target.value) || 0;
                                  const newItems = [...formData.items];
                                  newItems[index] = {
                                    ...item,
                                    issuedQty: e.target.value,
                                    stockAfterIssue:
                                      item.existingStock - issuedQty,
                                  };
                                  setFormData((prev) => ({
                                    ...prev,
                                    items: newItems,
                                  }));
                                }}
                                placeholder='Qty'
                                min='0'
                                max={item.existingStock}
                                disabled={!!editingIssue}
                                className='border-0 p-2 h-10 w-16 text-center text-sm outline-none focus:outline-none hover:outline-none active:outline-none focus:ring-0 rounded-sm'
                              />
                              <span className='text-xs text-gray-600'>
                                {item.measureUnit || 'units'}
                              </span>
                            </div>
                          )}
                          {errors[`issuedQty_${index}`] && (
                            <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                              <p className='text-red-700 text-xs font-medium'>
                                {errors[`issuedQty_${index}`]}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 text-center px-2 py-1'>
                          <div
                            className={`font-semibold text-xs ${
                              editingIssue ? 'text-black' : ''
                            }`}
                          >
                            {item.stockAfterIssue} {item.measureUnit || 'units'}
                          </div>
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-sm font-medium break-words whitespace-normal'>
                              {item.receiverName}
                            </div>
                          ) : (
                            <Input
                              value={item.receiverName}
                              onChange={(e) => {
                                const newItems = [...formData.items];
                                newItems[index] = {
                                  ...item,
                                  receiverName: e.target.value,
                                };
                                setFormData((prev) => ({
                                  ...prev,
                                  items: newItems,
                                }));
                              }}
                              placeholder='Receiver Name'
                              disabled={!!editingIssue}
                              className='border-0 p-1 h-8 text-xs outline-none focus:outline-none focus:ring-0 rounded-sm'
                            />
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-sm font-medium break-words whitespace-normal'>
                              {item.machineName}
                            </div>
                          ) : (
                            <Select
                              value={item.machineName || ''}
                              onValueChange={(value) => {
                                const newItems = [...formData.items];
                                if (value === 'Other') {
                                  newItems[index] = {
                                    ...item,
                                    machineName: 'Other',
                                    machineId: 0,
                                  };
                                } else {
                                  const machine = availableMachines.find(
                                    (m) => m.name === value
                                  );
                                  if (machine) {
                                    newItems[index] = {
                                      ...item,
                                      machineName: machine.name,
                                      machineId: machine.id,
                                    };
                                  }
                                }
                                setFormData((prev) => ({
                                  ...prev,
                                  items: newItems,
                                }));
                              }}
                              disabled={isLoadingMachines || !!editingIssue}
                            >
                              <SelectTrigger className='border-0 p-0 h-auto text-xs'>
                                {isLoadingMachines ? (
                                  <div className='flex items-center gap-2'>
                                    <Loader2 className='h-3 w-3 animate-spin' />
                                    <span>Loading...</span>
                                  </div>
                                ) : (
                                  <SelectValue placeholder='Select Machine *' />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {machinesError ? (
                                  <div className='p-2 text-xs text-destructive'>
                                    {machinesError}
                                  </div>
                                ) : (
                                  <>
                                    <SelectItem value='Other'>
                                      others
                                    </SelectItem>
                                    {getFilteredMachines().map((machine) => (
                                      <SelectItem
                                        key={machine.id}
                                        value={machine.name}
                                      >
                                        {machine.name}
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          {errors[`machineId_${index}`] && (
                            <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                              <p className='text-red-700 text-xs font-medium'>
                                {errors[`machineId_${index}`]}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          <div className='flex flex-col gap-1'>
                            {item.imagePreview ? (
                              <div className='relative w-full h-16 mb-1'>
                                <img
                                  src={item.imagePreview}
                                  alt='Preview'
                                  className='h-full object-contain rounded-sm'
                                />
                                {!editingIssue && (
                                  <Button
                                    type='button'
                                    variant='destructive'
                                    size='sm'
                                    className='absolute top-0 right-0 h-5 w-5 p-0'
                                    onClick={() => {
                                      const newItems = [
                                        ...formData.items,
                                      ] as MaterialItemFormData[];
                                      newItems[index] = {
                                        ...item,
                                        image: null,
                                        imagePreview: '',
                                      } as MaterialItemFormData;
                                      setFormData((prev) => ({
                                        ...prev,
                                        items: newItems,
                                      }));
                                    }}
                                  >
                                    <X className='h-3 w-3' />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              !editingIssue && (
                                <div className='flex items-center gap-1'>
                                  <Input
                                    type='file'
                                    accept='image/*'
                                    id={`file-upload-${index}`}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        // Create a preview URL
                                        const previewUrl =
                                          URL.createObjectURL(file);

                                        const newItems = [
                                          ...formData.items,
                                        ] as MaterialItemFormData[];
                                        newItems[index] = {
                                          ...item,
                                          image: file,
                                          imagePreview: previewUrl,
                                        } as MaterialItemFormData;
                                        setFormData((prev) => ({
                                          ...prev,
                                          items: newItems,
                                        }));
                                      }
                                    }}
                                    className='hidden'
                                  />
                                  <Label
                                    htmlFor={`file-upload-${index}`}
                                    className='flex items-center justify-center gap-1 cursor-pointer text-xs bg-secondary/20 hover:bg-secondary/30 rounded-sm p-1 w-full'
                                  >
                                    <Upload className='h-3 w-3' />
                                    Upload Image
                                  </Label>
                                </div>
                              )
                            )}
                          </div>
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          {editingIssue ? (
                            <div className='text-black text-sm font-medium break-words whitespace-normal'>
                              {item.purpose}
                            </div>
                          ) : (
                            <Input
                              value={item.purpose}
                              onChange={(e) => {
                                const newItems = [...formData.items];
                                newItems[index] = {
                                  ...item,
                                  purpose: e.target.value,
                                };
                                setFormData((prev) => ({
                                  ...prev,
                                  items: newItems,
                                }));
                              }}
                              placeholder='Purpose'
                              disabled={!!editingIssue}
                              className='border-0 p-1 h-8 text-xs outline-none focus:outline-none focus:ring-0 rounded-sm'
                            />
                          )}
                          {errors[`purpose_${index}`] && (
                            <div className='mt-1 p-2 bg-red-50 border border-red-200 rounded-md'>
                              <p className='text-red-700 text-xs font-medium'>
                                {errors[`purpose_${index}`]}
                              </p>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='border border-gray-300 px-2 py-1'>
                          <Button
                            type='button'
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              if (formData.items.length > 1) {
                                const itemToRemove = formData.items[index];
                                const confirmed = window.confirm(
                                  `🗑️ Remove Item\n\n` +
                                    `Are you sure you want to remove this item?\n` +
                                    `Material: ${
                                      itemToRemove.nameOfMaterial ||
                                      'Not selected'
                                    }\n` +
                                    `Quantity: ${
                                      itemToRemove.issuedQty || '0'
                                    } units\n\n` +
                                    `This action cannot be undone.`
                                );

                                if (confirmed) {
                                  const newItems = formData.items.filter(
                                    (_, i) => i !== index
                                  );
                                  setFormData((prev) => ({
                                    ...prev,
                                    items: newItems,
                                  }));
                                  toast({
                                    title: '✅ Item Removed',
                                    description:
                                      'The item has been successfully removed from the issue form.',
                                    variant: 'default',
                                  });
                                }
                              } else {
                                toast({
                                  title: '⚠️ Cannot Remove Item',
                                  description:
                                    'You must have at least one item in the issue form.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                            disabled={
                              formData.items.length === 1 || !!editingIssue
                            }
                            className='gap-1 text-xs h-6 w-6 p-0'
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
          )}

          {/* Additional Information - Compact */}
          {!(editingIssue && isLoadingEditData) && (
          <Card>
            <CardContent className='space-y-3'>
              <div className='space-y-1'>
                <Label htmlFor='additionalNotes' className='text-xs'>
                  Additional Notes
                </Label>
                {editingIssue ? (
                  <div className='min-h-[60px] px-4 py-3 border border-input bg-background rounded-[5px] text-sm'>
                    <div
                      className={`text-sm ${
                        formData.additionalNotes
                          ? 'text-black'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {formData.additionalNotes || 'No additional notes'}
                    </div>
                  </div>
                ) : (
                  <Textarea
                    id='additionalNotes'
                    placeholder='Any additional notes or special instructions'
                    value={formData.additionalNotes}
                    onChange={(e) =>
                      handleInputChange('additionalNotes', e.target.value)
                    }
                    disabled={!!editingIssue}
                    className='min-h-[60px] px-4 py-3 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm resize-none transition-all duration-200'
                  />
                )}
              </div>

              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <div className='space-y-1'>
                  <Label className='text-xs'>Issued By</Label>
                  <div className='input-friendly bg-secondary text-center py-2 font-semibold text-xs text-black'>
                    {editingIssue 
                      ? (() => {
                          // When viewing issued material details, show the actual issuer
                          const originalIssue = editingIssue.originalIssue as MaterialIssue;
                          const issuedByUser = originalIssue?.issuedBy;
                          
                          if (issuedByUser) {
                            // Show only the name without role/designation
                            return issuedByUser.name;
                          }
                          
                          return 'Unknown User';
                        })()
                      : (currentUser?.name || 'Current User')
                    }
                  </div>
                </div>

                <div className='space-y-1'>
                  <Label className='text-xs'>Date</Label>
                  <div className='input-friendly bg-secondary text-center py-2 font-semibold text-xs text-black'>
                    {formatDate(formData.date)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Form Actions - Compact */}
          {!(editingIssue && isLoadingEditData) && (
          <div className='flex justify-center gap-3 pt-3'>
            {!editingIssue && (
              <Button
                type='submit'
                size='sm'
                className='gap-2'
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin mr-2' />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileText className='w-4 h-4' />
                    Issue
                  </>
                )}
              </Button>
            )}
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              className='gap-2'
              size='sm'
              disabled={isSubmitting}
            >
              <X className='w-4 h-4' />
              {editingIssue ? 'Close' : 'Cancel'}
            </Button>
          </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};