import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Camera,
  X,
  Eye,
  Plus,
  Trash2,
  FileText,
  Wrench,
  File,
  FileImage,
  Download,
  CheckCircle2,
} from 'lucide-react';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from '../../hooks/use-toast';
import { formatDateToDDMMYYYY } from '../../lib/utils';
import { machinesApi } from '../../lib/api/machines';
import { Machine } from '../../lib/api/types';
import {
  RepairMaintenanceType,
  RepairMaintenanceStatus,
} from '../../lib/api/repair-maintenance.ts';
import { repairMaintenanceApi } from '../../lib/api/repair-maintenance.ts';

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

interface RepairMaintenanceItem {
  id: string;
  srNo: string;
  nameOfWork: string;
  typeOfWork: RepairMaintenanceType | '';
  machineId?: number;
  machineName: string;
  totalAmount: string;
  description: string;
  images?: File[];
  imagePreviews?: string[];
  vendorQuotations?: VendorQuotation[];
}

interface RepairMaintenanceFormProps {
  formData: {
    id?: string;
    items: RepairMaintenanceItem[];
    requestedBy: string;
    location: string;
    date: string;
    status: string;
    apiData?: {
      id?: number;
    };
  };
  isReadOnly?: boolean;
  onItemChange?: (itemId: string, field: string, value: string) => void;
  onItemImagesChange?: (itemId: string, images: File[], imagePreviews: string[]) => void;
  availableMachines?: Machine[];
  machines?: string[];
  onLoadItemImages?: (itemId: number) => void;
  itemImageUrlsMap?: Record<string, string[]>;
  onStatusChange?: (newStatus: string, additionalData?: any) => void;
  userRole?: 'company_owner' | 'supervisor';
  hasPermission?: (permission: string) => boolean;
  onOpenVendorForm?: (itemId: string) => void;
  onViewVendorQuotations?: (itemId: string) => void;
  onRemoveItem?: (itemId: string) => void;
  orderId?: string; // Optional order ID to display instead of SR. NO.
  selectedVendors?: Record<string, string>; // itemId -> quotationId mapping
  onVendorSelection?: (vendors: Record<string, string>) => void;
}

export const RepairMaintenanceForm: React.FC<RepairMaintenanceFormProps> = ({
  formData,
  isReadOnly = false,
  onItemChange,
  onItemImagesChange,
  availableMachines = [],
  machines = [],
  onLoadItemImages,
  itemImageUrlsMap = {},
  onStatusChange,
  userRole = 'supervisor',
  hasPermission = () => false,
  onOpenVendorForm,
  onViewVendorQuotations,
  onRemoveItem,
  orderId,
  selectedVendors = {},
  onVendorSelection,
}) => {
  const [machinesList, setMachinesList] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);
  
  // State for repair maintenance types
  const [repairMaintenanceTypes, setRepairMaintenanceTypes] = useState<Array<{ value: string; label: string }>>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Add state for image popup
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isImagePopupOpen, setIsImagePopupOpen] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');

  // Fetch machines and types when component mounts
  useEffect(() => {
    const fetchMachines = async () => {
      if (availableMachines.length > 0) {
        setMachinesList(availableMachines);
        return;
      }

      setIsLoadingMachines(true);
      try {
        const response = await machinesApi.getAll({
          limit: 100,
          sortBy: 'name',
          sortOrder: 'ASC',
        });
        setMachinesList(response.data);
      } catch (err) {
        console.error('Error fetching machines:', err);
        toast({
          title: 'Error',
          description: 'Failed to load machines',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingMachines(false);
      }
    };

    const fetchTypes = async () => {
      setIsLoadingTypes(true);
      try {
        const options = await repairMaintenanceApi.getOptions();
        setRepairMaintenanceTypes(options.workTypes || []);
      } catch (err) {
        console.error('Error fetching repair maintenance options:', err);
        toast({
          title: 'Error',
          description: 'Failed to load work types',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingTypes(false);
      }
    };

    fetchMachines();
    fetchTypes();
  }, [availableMachines]);

  // Function to show images in popup
  const showImagesInPopup = (images: string[], title: string) => {
    setSelectedImages(images);
    setPopupTitle(title);
    setIsImagePopupOpen(true);
  };

  // Function to load item images from API
  const loadItemImages = async (itemId: number): Promise<string[]> => {
    try {
      const repairMaintenanceId = formData.apiData?.id;
      
      if (!repairMaintenanceId) {
        console.warn('No repair maintenance ID available for loading item images');
        return [];
      }

      if (!itemId || isNaN(itemId)) {
        console.warn('Invalid item ID for loading images:', itemId);
        return [];
      }

      const imageUrls = await repairMaintenanceApi.getItemImages(repairMaintenanceId, itemId);
      return imageUrls || [];
    } catch (error) {
      console.error('Error loading item images:', error);
      // Don't show toast error - just return empty array and show "not available" in popup
      return [];
    }
  };

  const handleItemChange = (itemId: string, field: string, value: string) => {
    if (!isReadOnly && onItemChange) {
      onItemChange(itemId, field, value);
    }
  };

  // Handle multiple file uploads for item images
  const handleMultipleFileChange = (itemId: string, files: FileList | File[]) => {
    if (!isReadOnly && onItemImagesChange) {
      const newFiles = Array.isArray(files) ? files : Array.from(files);
      const currentItem = formData.items.find(item => item.id === itemId);
      
      if (!currentItem) return;
      
      const existingImages = currentItem.images || [];
      const existingPreviews = currentItem.imagePreviews || [];
      const newPreviews: string[] = [];
      let loadedCount = 0;

      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            newPreviews.push(e.target.result as string);
          }
          loadedCount++;
          
          if (loadedCount === newFiles.length) {
            // All files loaded, update parent state
            const updatedImages = [...existingImages, ...newFiles];
            const updatedPreviews = [...existingPreviews, ...newPreviews];
            onItemImagesChange(itemId, updatedImages, updatedPreviews);
          }
        };
        reader.onerror = () => {
          loadedCount++;
          if (loadedCount === newFiles.length) {
            // Even if some failed, update with what we have
            const updatedImages = [...existingImages, ...newFiles];
            const updatedPreviews = [...existingPreviews, ...newPreviews];
            onItemImagesChange(itemId, updatedImages, updatedPreviews);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Remove image from item
  const removeImage = (itemId: string, imageIndex: number) => {
    if (!isReadOnly && onItemImagesChange) {
      const currentItem = formData.items.find(item => item.id === itemId);
      if (currentItem) {
        const updatedImages = currentItem.images?.filter((_, index) => index !== imageIndex) || [];
        const updatedPreviews = currentItem.imagePreviews?.filter((_, index) => index !== imageIndex) || [];
        onItemImagesChange(itemId, updatedImages, updatedPreviews);
      }
    }
  };

  const handleMachineSelect = (itemId: string, machineName: string) => {
    if (!isReadOnly && onItemChange) {
      const machine = machinesList.find((m) => m.name === machineName);
      if (machine) {
        onItemChange(itemId, 'machineName', machine.name);
        onItemChange(itemId, 'machineId', machine.id.toString());
      }
    }
  };

  const getTypeLabel = (type: RepairMaintenanceType | ''): string => {
    if (!type) return '-';
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

  // Utility function to determine file type from URL or filename
  const getFileType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'webp':
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
        return <FileImage className="w-6 h-6 text-blue-600" />;
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-600" />;
      case 'document':
        return <FileText className="w-6 h-6 text-blue-600" />;
      case 'spreadsheet':
        return <FileText className="w-6 h-6 text-green-600" />;
      case 'text':
        return <FileText className="w-6 h-6 text-gray-600" />;
      default:
        return <File className="w-6 h-6 text-gray-600" />;
    }
  };

  // Utility function to handle file opening/display
  const handleFileOpen = (url: string) => {
    const fileType = getFileType(url);
    
    if (fileType === 'image') {
      showImagesInPopup([url], `Item Images`);
    } else {
      window.open(url, '_blank');
    }
  };

  // Handle vendor selection
  const handleVendorSelection = (itemId: string, quotationId: string) => {
    if (!onVendorSelection || !onItemChange) return;
    
    // Update isSelected flag for all quotations in this item
    const currentItem = formData.items.find(item => item.id === itemId);
    if (currentItem && currentItem.vendorQuotations) {
      currentItem.vendorQuotations.forEach((quotation) => {
        if (quotation.id === quotationId) {
          quotation.isSelected = true;
        } else {
          quotation.isSelected = false;
        }
      });
    }
    
    const newSelection = {
      ...selectedVendors,
      [itemId]: quotationId,
    };
    onVendorSelection(newSelection);
  };

  return (
    <div className='space-y-5'>
      {/* Items Table */}
      <Card className='border-0 shadow-none'>
        <CardContent className='pt-6 pb-0 px-0 border-none'>
          <div className='border-none'>
            <Table className='border-none w-full'>
              <TableHeader className='border-none'>
                <TableRow className='bg-gray-50'>
                  <TableHead className='border border-gray-300 font-semibold min-w-[60px] w-[60px]'>
                    {orderId ? 'ORDER ID' : 'SR. NO.'}
                  </TableHead>
                  <TableHead className='border border-gray-300 font-semibold min-w-[200px]'>
                    NAME OF THE WORK
                  </TableHead>
                  <TableHead className='border border-gray-300 font-semibold min-w-[150px]'>
                    TYPE OF THE WORK
                  </TableHead>
                  <TableHead className='border border-gray-300 font-semibold min-w-[150px]'>
                    MACHINE
                  </TableHead>
                  <TableHead className='border border-gray-300 font-semibold min-w-[80px]'>
                    IMAGES
                  </TableHead>
                  {(onOpenVendorForm || onViewVendorQuotations) && (
                    <TableHead className='border border-gray-300 font-semibold min-w-[120px]'>
                      VENDOR QUOTATIONS
                    </TableHead>
                  )}
                  <TableHead className='border border-gray-300 font-semibold min-w-[200px]'>
                    NOTES
                  </TableHead>
                  {!isReadOnly && onRemoveItem && (
                    <TableHead className='border border-gray-300 font-semibold min-w-[50px]'>
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {formData.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className='border border-gray-300 text-center font-semibold min-w-[60px] w-[60px]'>
                      {orderId ? (
                        <div className='text-sm font-medium'>{orderId}</div>
                      ) : isReadOnly ? (
                        item.srNo
                      ) : (
                        <Input
                          type='text'
                          value={item.srNo}
                          readOnly
                          className='border-0 focus:ring-0 focus:outline-none rounded-none bg-transparent w-full text-center'
                        />
                      )}
                    </TableCell>
                    <TableCell className='border border-gray-300'>
                      {isReadOnly ? (
                        <div className='text-sm font-medium truncate'>{item.nameOfWork}</div>
                      ) : (
                        <Input
                          value={item.nameOfWork}
                          onChange={(e) => {
                            const value = e.target.value.slice(0, 100);
                            handleItemChange(item.id, 'nameOfWork', value);
                          }}
                          placeholder='Enter name of the work'
                          maxLength={100}
                          className='border border-gray-300 p-2 h-auto focus:ring-1 focus:ring-gray-400 focus:outline-none rounded w-full'
                        />
                      )}
                    </TableCell>
                    <TableCell className='border border-gray-300'>
                      {isReadOnly ? (
                        <div className='text-sm truncate'>{item.typeOfWork ? getTypeLabel(item.typeOfWork) : '-'}</div>
                      ) : (
                        <Select
                          value={item.typeOfWork || undefined}
                          onValueChange={(value) =>
                            handleItemChange(item.id, 'typeOfWork', value)
                          }
                          disabled={isLoadingTypes || repairMaintenanceTypes.length === 0}
                        >
                          <SelectTrigger className='border-0 p-0 h-auto focus:ring-0 focus:outline-none rounded-none w-full'>
                            <SelectValue placeholder='Select Work Type' />
                          </SelectTrigger>
                          <SelectContent>
                            {repairMaintenanceTypes.length > 0 ? (
                              repairMaintenanceTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))
                            ) : (
                              <div className='px-2 py-1.5 text-sm text-muted-foreground'>
                                {isLoadingTypes ? 'Loading...' : 'No types available'}
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className='border border-gray-300'>
                      {isReadOnly ? (
                        <div className='text-sm truncate'>{item.machineName || 'N/A'}</div>
                      ) : (
                        <Select
                          value={item.machineName}
                          onValueChange={(value) =>
                            handleMachineSelect(item.id, value)
                          }
                        >
                          <SelectTrigger className='border-0 p-0 h-auto focus:ring-0 focus:outline-none rounded-none w-full'>
                            <SelectValue placeholder='Select Machine *' />
                          </SelectTrigger>
                          <SelectContent>
                            {machinesList.map((machine) => (
                              <SelectItem key={machine.id} value={machine.name}>
                                {machine.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className='border border-gray-300'>
                      <div className='space-y-2'>
                        {/* Image upload for editable forms */}
                        {!isReadOnly ? (
                          <>
                            {/* Hidden file input */}
                            <input
                              type='file'
                              accept='image/*'
                              multiple
                              id={`image-upload-${item.id}`}
                              className='hidden'
                              onChange={(e) => {
                                const files = e.target.files;
                                
                                if (files && files.length > 0) {
                                  // Validate file size (5MB limit)
                                  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
                                  const validFiles: File[] = [];
                                  const invalidFiles: string[] = [];

                                  Array.from(files).forEach((file) => {
                                    if (file.size > maxSize) {
                                      invalidFiles.push(file.name);
                                    } else {
                                      validFiles.push(file);
                                    }
                                  });

                                  // Show error for files that are too large
                                  if (invalidFiles.length > 0) {
                                    toast({
                                      title: 'File Size Error',
                                      description: `The following files exceed 5MB limit: ${invalidFiles.join(', ')}`,
                                      variant: 'destructive',
                                    });
                                  }

                                  // Process valid files
                                  if (validFiles.length > 0) {
                                    handleMultipleFileChange(item.id, validFiles as any);
                                  }
                                }
                              }}
                            />
                            
                            {/* Upload button with + icon */}
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() => {
                                const fileInput = document.getElementById(`image-upload-${item.id}`);
                                fileInput?.click();
                              }}
                              className='w-full h-8 gap-2'
                            >
                              <Plus className='w-4 h-4' />
                              Upload Image
                            </Button>
                            
                            {/* Supported formats info */}
                            <div className='text-xs text-muted-foreground mt-1'>
                              Supported: JPG, PNG, GIF
                            </div>
                            
                            {/* Show uploaded image previews */}
                            {item.imagePreviews && item.imagePreviews.length > 0 && (
                              <div className='grid grid-cols-3 gap-1 mt-2'>
                                {item.imagePreviews.map((preview, index) => (
                                  <div
                                    key={index}
                                    className='relative w-12 h-12 rounded border overflow-hidden'
                                  >
                                    <img
                                      src={preview}
                                      alt={`Preview ${index + 1}`}
                                      className='w-full h-full object-cover'
                                      onError={(e) => {
                                        console.error('Failed to load image:', preview, e);
                                        // Hide broken image
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
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
                              </div>
                            )}
                          </>
                        ) : (
                          /* Read-only: Show view button */
                          <div className='flex items-center gap-2'>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                try {
                                  // Load images from API
                                  const itemIdNum = parseInt(item.id, 10);
                                  if (isNaN(itemIdNum)) {
                                    console.warn('Invalid item ID:', item.id);
                                    showImagesInPopup(
                                      [],
                                      `Item Images - ${item.nameOfWork}`
                                    );
                                    return;
                                  }
                                  
                                  const loadedImages = await loadItemImages(itemIdNum);
                                  
                                  // Always open popup, even if no images
                                  showImagesInPopup(
                                    loadedImages || [],
                                    `Item Images - ${item.nameOfWork}`
                                  );
                                } catch (error) {
                                  console.error('Error in button click handler:', error);
                                  // Still open popup with empty array to show "not available"
                                  showImagesInPopup(
                                    [],
                                    `Item Images - ${item.nameOfWork}`
                                  );
                                }
                              }}
                              className='gap-2 w-full'
                              disabled={false}
                            >
                              <Eye className='w-4 h-4' />
                              <span className='hidden sm:inline'>View Images</span>
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {(onOpenVendorForm || onViewVendorQuotations) && (
                      <TableCell className='border border-gray-300'>
                        <div className='space-y-2'>
                          {/* Action Buttons */}
                          <div className='flex items-center gap-2'>
                            {onOpenVendorForm && !isReadOnly && (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => onOpenVendorForm(item.id)}
                                className='gap-1 text-xs'
                              >
                                <Plus className='w-3 h-3' />
                                Add ({item.vendorQuotations?.length || 0}/4)
                              </Button>
                            )}
                            {onViewVendorQuotations && (
                              <Button
                                type='button'
                                variant='outline'
                                size='sm'
                                onClick={() => onViewVendorQuotations(item.id)}
                                className='gap-1 text-xs'
                              >
                                <Eye className='w-3 h-3' />
                                View
                              </Button>
                            )}
                          </div>
                          
                          {/* Vendor Selection UI - Show all vendor quotations below buttons */}
                          {item.vendorQuotations && item.vendorQuotations.length > 0 && (
                            <div className='space-y-2 mt-2'>
                              {formData.status === RepairMaintenanceStatus.PENDING_APPROVAL && userRole === 'company_owner' && onVendorSelection ? (
                                // PENDING APPROVAL: Company owner gets radio buttons to select
                                <RadioGroup
                                  value={selectedVendors[item.id] || ''}
                                  onValueChange={(value) => handleVendorSelection(item.id, value)}
                                >
                                  {item.vendorQuotations.map((quotation) => (
                                    <div key={quotation.id} className="flex items-center space-x-2 p-2 border border-gray-200 rounded cursor-pointer hover:bg-gray-50">
                                      <RadioGroupItem
                                        value={quotation.id}
                                        id={`${item.id}-${quotation.id}`}
                                      />
                                      <Label
                                        htmlFor={`${item.id}-${quotation.id}`}
                                        className="text-xs cursor-pointer flex-1 min-w-0"
                                      >
                                        <div className="font-medium text-gray-900 truncate">
                                          {quotation.vendorName} - ₹{quotation.quotedPrice}
                                        </div>
                                      </Label>
                                    </div>
                                  ))}
                                </RadioGroup>
                              ) : (
                                // Show only selected vendor quotations
                                <div className='space-y-1'>
                                  {item.vendorQuotations
                                    .filter((quotation) => quotation.isSelected === true)
                                    .map((quotation) => {
                                    const isSelected = quotation.isSelected === true;
                                    return (
                                      <div
                                        key={quotation.id}
                                        className={`p-2 rounded border text-xs ${
                                          isSelected 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                      >
                                        <div className="flex justify-between items-center">
                                          <div className="min-w-0 flex-1">
                                            <div className="font-medium text-gray-900 truncate">
                                              {quotation.vendorName} - ₹{quotation.quotedPrice}
                                            </div>
                                          </div>
                                          {isSelected && (
                                            <div className="text-xs bg-green-600 text-white px-2 py-1 rounded flex-shrink-0 ml-2">
                                              <CheckCircle2 className='w-3 h-3' />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className='border border-gray-300'>
                      {isReadOnly ? (
                        <div className='truncate text-sm'>{item.description || '-'}</div>
                      ) : (
                        <Textarea
                          value={item.description || ''}
                          onChange={(e) =>
                            handleItemChange(item.id, 'description', e.target.value)
                          }
                          placeholder='Add notes...'
                          className='border border-gray-300 p-2 h-auto min-h-[60px] resize-none focus:ring-1 focus:ring-gray-400 focus:outline-none rounded w-full'
                          rows={2}
                        />
                      )}
                    </TableCell>
                    {!isReadOnly && onRemoveItem && (
                      <TableCell className='border border-gray-300 text-center'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => onRemoveItem(item.id)}
                          className='h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50'
                        >
                          <Trash2 className='w-4 h-4' />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                          toast({
                            title: 'Image Load Error',
                            description: `Failed to load image: ${imageUrl}`,
                            variant: 'destructive',
                          });
                        }}
                      />
                      <div className='absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs'>
                        Image {index + 1}
                      </div>
                      <div className='absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs max-w-[200px] truncate'>
                        {imageUrl}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-8 text-muted-foreground'>
                  <Eye className='w-12 h-12 mx-auto mb-4 opacity-50' />
                  <p>Not Available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

