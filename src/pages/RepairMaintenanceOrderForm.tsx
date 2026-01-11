import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RepairMaintenanceForm } from '../components/repair & maintenance/RepairMaintenanceForm';
import {
  RepairMaintenanceType,
  RepairMaintenanceStatus,
} from '../lib/api/repair-maintenance.ts';
import { repairMaintenanceApi } from '../lib/api/repair-maintenance.ts';
import { useRole } from '../contexts/RoleContext';
import { machinesApi } from '../lib/api/machines';
import { Machine } from '../lib/api/types';
import { toast } from '../hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';

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

const RepairMaintenanceOrderForm = () => {
  const { currentUser, hasPermission } = useRole();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableMachines, setAvailableMachines] = useState<Machine[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(false);

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

  // Form data state
  const [orderFormData, setOrderFormData] = useState({
    id: '',
    items: [
      {
        id: '1',
        srNo: '1',
        nameOfWork: '',
        typeOfWork: '' as any,
        machineId: undefined as number | undefined,
        machineName: '',
        totalAmount: '',
        description: '',
        images: [],
        imagePreviews: [],
        vendorQuotations: [] as VendorQuotation[],
      },
    ],
    requestedBy: currentUser?.name || '',
    location: currentUser?.branch?.location || '',
    date: new Date().toISOString().split('T')[0],
    status: RepairMaintenanceStatus.DRAFT,
  });

  // Fetch machines on component mount
  useEffect(() => {
    const fetchMachines = async () => {
      setIsLoadingMachines(true);
      try {
        const response = await machinesApi.getAll({
          limit: 100,
          sortBy: 'name',
          sortOrder: 'ASC',
          // Filter by branch for branch-level users
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
    setOrderFormData((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === 'machineId' ? (value ? Number(value) : undefined) : value,
            }
          : item
      ),
    }));
  };

  // Handle item images change
  const handleItemImagesChange = (itemId: string, images: File[], imagePreviews: string[]) => {
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
    setCurrentItemId(itemId);
    setIsVendorFormOpen(true);
  };

  // View vendor quotations
  const viewVendorQuotations = (itemId: string) => {
    const item = orderFormData.items.find((item) => item.id === itemId);
    if (item) {
      setCurrentQuotations(item.vendorQuotations);
      setCurrentItemId(itemId);
      setIsViewQuotationsOpen(true);
    }
  };

  // Add new item
  const addNewItem = () => {
    const newItem = {
      id: String(Date.now()),
      srNo: String(orderFormData.items.length + 1),
      nameOfWork: '',
      typeOfWork: '' as any,
      machineId: undefined as number | undefined,
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
      
      // Append location and date
      formDataToSend.append('location', orderFormData.location);
      formDataToSend.append('date', orderFormData.date);
      formDataToSend.append('status', RepairMaintenanceStatus.PENDING_APPROVAL);
      
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

      await repairMaintenanceApi.create(formDataToSend);

      toast({
        title: '🎉 Work Order Submitted Successfully!',
        description: 'Your work order has been submitted for approval. You will be notified once the Management Team reviews your request.',
        variant: 'default',
      });

      // Reset form
      setOrderFormData({
        id: '',
        items: [
          {
            id: '1',
            srNo: '1',
            nameOfWork: '',
            typeOfWork: '' as any,
            machineId: undefined as number | undefined,
            machineName: '',
            totalAmount: '',
            description: '',
            images: [],
            imagePreviews: [],
            vendorQuotations: [] as VendorQuotation[],
          },
        ],
        requestedBy: currentUser?.name || '',
        location: currentUser?.branch?.location || '',
        date: new Date().toISOString().split('T')[0],
        status: RepairMaintenanceStatus.DRAFT,
      });
      setSelectedVendors({});

      // Navigate back to repair maintenance tab after a short delay
      setTimeout(() => {
        navigate('/materials-inventory', {
        state: { activeTab: 'repair-maintenance' },
      });
      }, 1500);
    } catch (error) {
      console.error('Error submitting order form:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit order form. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4 sm:space-y-6 p-4 sm:p-0'>
      {/* Header */}
      <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
        <div className='flex items-center gap-4'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => navigate('/materials-inventory?tab=repair-maintenance', {
              state: { activeTab: 'repair-maintenance' },
            })}
            className='gap-2'
          >
            <ArrowLeft className='w-4 h-4' />
            Back
          </Button>
          <div className='flex items-center gap-3'>
            <div>
              <h1 className='text-sm sm:text-1xl md:text-2xl lg:text-3xl font-bold text-foreground mb-1'>
              Work Order Form
              </h1>
            </div>
          </div>
        </div>

        {/* Add Item Button */}
        <div className='flex items-center gap-3'>
          <Button
            type='button'
            onClick={addNewItem}
            className='gap-2'
          >
            <Plus className='w-4 h-4' />
            Add New Item
          </Button>
        </div>
      </div>

      {/* Form Card */}
      <Card className='border-0 shadow-none'>
        <CardContent className='pt-6 pb-0 px-0 border-none'>
          <form onSubmit={handleSubmit} className='space-y-4 sm:space-y-6'>
            {/* Repair Maintenance Form Component */}
            <RepairMaintenanceForm
              formData={orderFormData}
              isReadOnly={false}
              onItemChange={handleOrderFormItemChange}
              onItemImagesChange={handleItemImagesChange}
              availableMachines={availableMachines}
              machines={availableMachines.map((m) => m.name)}
              userRole={currentUser?.role as 'company_owner' | 'supervisor' || 'supervisor'}
              hasPermission={hasPermission}
              onOpenVendorForm={openVendorForm}
              onViewVendorQuotations={viewVendorQuotations}
              onRemoveItem={removeItem}
              selectedVendors={selectedVendors}
              onVendorSelection={setSelectedVendors}
            />

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
                onClick={() => navigate('/materials-inventory?tab=repair-maintenance', {
                  state: { activeTab: 'repair-maintenance' },
                })}
                className='min-w-48 gap-2'
                disabled={isSubmitting}
              >
                <X className='w-5 h-5' />
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
                    {orderFormData.items
                      .find((item) => item.id === currentItemId)
                      ?.vendorQuotations.map((quotation, index) => (
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
                    {(!orderFormData.items.find((item) => item.id === currentItemId)
                      ?.vendorQuotations || orderFormData.items.find((item) => item.id === currentItemId)?.vendorQuotations.length === 0) && (
                        <TableRow>
                          <TableCell
                            colSpan={10}
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
                    onChange={(e) =>
                      handleVendorFormChange('phone', e.target.value)
                    }
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
                    onChange={(e) =>
                      handleVendorFormChange('price', e.target.value)
                    }
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
                    onChange={(e) =>
                      handleVendorFormChange('notes', e.target.value)
                    }
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
                          {quotation.contactPerson}
                        </TableCell>
                        <TableCell className='border-r'>
                          {quotation.phone}
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
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                No vendor quotations available
              </div>
            )}
          </div>

          <div className='flex justify-end gap-4 pt-6 border-t'>
            <Button
              variant='outline'
              onClick={() => setIsViewQuotationsOpen(false)}
              className='h-10 px-6'
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepairMaintenanceOrderForm;

