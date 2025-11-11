import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  X,
  Calendar,
  MapPin,
  Wrench,
  Loader2,
  Plus,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from '../hooks/use-toast';
import { machinesApi } from '../lib/api/machines';
import type { Machine, MachineType, Unit, User, Branch } from '../lib/api/types';
import { MachineStatus } from '../lib/api/types';
import { useRole } from '../contexts/RoleContext';
import { getMachineTypes, getUnits, createMachineType, createUnit } from '@/lib/api/common';
import { branchesApi } from '@/lib/api/branches';

interface AddMachineFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (machineData: Machine) => void;
  editingData?: {
    id: number;
    name: string;
    type: string;
    status: string;
    createdDate: string;
    lastMaintenance: string;
    nextMaintenanceDue: string;
    specifications: string;
    branch: string;
    branchName: string;
    // Manufacturing Details
    manufacturer: string;
    model: string;
    serialNumber: string;
    capacity: string;
    purchaseDate: string;
    warrantyExpiry: string;
    installationDate: string;
    additionalNotes: string;
  } | null;
}

export const AddMachineForm = ({
  isOpen,
  onClose,
  onSubmit,
  editingData,
}: AddMachineFormProps) => {
  const { currentUser } = useRole();
  const [formData, setFormData] = useState({
    name: '',
    typeId: 0,
    unitId: 0,
    status: MachineStatus.ACTIVE,
    specifications: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiry: '',
    capacity: '',
    installationDate: '',
    lastService: '',
    nextMaintenanceDue: '',
    additionalNotes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New state for custom inputs
  const [showCustomTypeInput, setShowCustomTypeInput] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');

  // Get the full user data from localStorage to access branch information
  const getFullUserData = (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  };

  // Utility function to convert date from API format to HTML date input format (yyyy-MM-dd)
  const convertDateForInput = (dateString: string | null | undefined): string => {
    if (!dateString || dateString === '' || dateString === 'Not serviced' || dateString === 'Not scheduled') {
      return '';
    }
    
    try {
      // Try to parse the date string - handle various formats
      let date: Date;
      
      // If it's already in ISO format (yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss)
      if (dateString.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
        date = new Date(dateString);
      } else if (/^\d{2}-\d{2}-\d{4}/.test(dateString)) {
        // Handle dd-MM-yyyy format
        const parts = dateString.split('-');
        date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        // Handle yyyy-MM-dd format or try to parse as-is
        date = new Date(dateString);
      }
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return '';
      }
      
      // Convert to yyyy-MM-dd format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error converting date:', dateString, error);
      return '';
    }
  };

  // Track if form has been initialized to prevent resetting when machineTypes/branches update
  const [formInitialized, setFormInitialized] = useState(false);

  // Prefill form data when editing or reset when dialog opens for new machine
  useEffect(() => {
    if (!isOpen) {
      // Reset initialization flag when dialog closes
      setFormInitialized(false);
      return;
    }

    // Only initialize form once when dialog opens
    if (formInitialized) {
      return;
    }

    if (editingData) {
      // Find the typeId and unitId from the fetched data
      const typeId = machineTypes.find(type => type.name === editingData.type)?.id || 0;
      const unitId = branches.find(branch => branch.name === editingData.branchName)?.id || 0;
      
      setFormData({
        name: editingData.name,
        typeId: typeId,
        unitId: unitId,
        status: editingData.status as MachineStatus,
        specifications: editingData.specifications,
        manufacturer: editingData.manufacturer,
        model: editingData.model,
        serialNumber: editingData.serialNumber,
        purchaseDate: convertDateForInput(editingData.purchaseDate),
        warrantyExpiry: convertDateForInput(editingData.warrantyExpiry),
        capacity: editingData.capacity,
        installationDate: convertDateForInput(editingData.installationDate),
        lastService: convertDateForInput(editingData.lastMaintenance),
        nextMaintenanceDue: convertDateForInput(editingData.nextMaintenanceDue),
        additionalNotes: editingData.additionalNotes,
      });
      setFormInitialized(true);
    } else {
      // Reset form when adding new machine (only on first open)
      const fullUserData = getFullUserData();
      const defaultUnitId = fullUserData?.branch?.id || 0;
      
      setFormData({
        name: '',
        typeId: 0,
        unitId: defaultUnitId,
        status: MachineStatus.ACTIVE,
        specifications: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        purchaseDate: '',
        warrantyExpiry: '',
        capacity: '',
        installationDate: '',
        lastService: '',
        nextMaintenanceDue: '',
        additionalNotes: '',
      });
      setFormInitialized(true);
    }
  }, [editingData, isOpen, formInitialized]);

  // Update typeId when machineTypes are loaded and editingData exists
  useEffect(() => {
    if (editingData && isOpen && formInitialized && machineTypes.length > 0) {
      const typeId = machineTypes.find(type => type.name === editingData.type)?.id;
      if (typeId) {
        setFormData(prev => {
          // Only update if different to avoid unnecessary re-renders
          if (prev.typeId !== typeId) {
            return { ...prev, typeId };
          }
          return prev;
        });
      }
    }
  }, [machineTypes, editingData, isOpen, formInitialized]);

  // Update unitId when branches are loaded and editingData exists
  useEffect(() => {
    if (editingData && isOpen && formInitialized && branches.length > 0) {
      const unitId = branches.find(branch => branch.name === editingData.branchName)?.id;
      if (unitId) {
        setFormData(prev => {
          // Only update if different to avoid unnecessary re-renders
          if (prev.unitId !== unitId) {
            return { ...prev, unitId };
          }
          return prev;
        });
      }
    }
  }, [branches, editingData, isOpen, formInitialized]);

  // Fetch machine types and branches on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const typesResponse = await getMachineTypes({
          limit: 100,
        });
        setMachineTypes(typesResponse.data || []);

        // Fetch branches based on user role
        const fullUserData = getFullUserData();
        if (fullUserData) {
          if (currentUser?.role === 'company_owner') {
            // Company owner can see all branches of their company
            const branchesResponse = await branchesApi.getByCompanyId(fullUserData.company.id, {
              limit: 100,
            });
            setBranches(branchesResponse.data || []);
          } else {
            // Supervisor can only see their own branch
            const userBranch = fullUserData.branch;
            if (userBranch) {
              setBranches([userBranch]);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load machine types and branches.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      fetchData();
    }
  }, [isOpen, currentUser?.role]);

  const statusOptions = [
    { value: MachineStatus.ACTIVE, label: 'Active', description: 'Machine is operational' },
    {
      value: MachineStatus.UNDER_MAINTENANCE,
      label: 'Under Maintenance',
      description: 'Currently being serviced',
    },
    { value: MachineStatus.INACTIVE, label: 'Inactive', description: 'Not in use' },
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSelectChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    // Handle "Other" selection for machine type
    if (field === 'typeId' && value === 0) {
      setShowCustomTypeInput(true);
    } else {
      setShowCustomTypeInput(false);
    }
  };

  // Function to create new machine type
  const handleCreateMachineType = async () => {
    if (!customTypeName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a machine type name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Creating machine type:', customTypeName.trim());
      
      const newType = await createMachineType({ name: customTypeName.trim() });
      
      console.log('Machine type created:', newType);
      
      setMachineTypes(prev => [...prev, newType]);
      setFormData(prev => ({ ...prev, typeId: newType.id }));
      setShowCustomTypeInput(false);
      setCustomTypeName('');
      
      toast({
        title: 'Success',
        description: `Machine type "${newType.name}" has been created.`,
      });
    } catch (error) {
      console.error('Error creating machine type:', error);
      
      // Log more detailed error information
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
        console.error('Error headers:', error.response.headers);
      }
      
      // Check if it's a 500 error (server error)
      if (error.response?.status === 500) {
        toast({
          title: 'Server Error',
          description: 'Unable to create machine type. The server is experiencing issues. Please try again later or contact support.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: `Failed to create machine type: ${error.response?.data?.message || error.message || 'Unknown error'}`,
          variant: 'destructive',
        });
      }
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Machine name is required';
    if (!formData.typeId && formData.typeId !== 0) newErrors.typeId = 'Machine type is required';
    if (!formData.unitId && formData.unitId !== 0) newErrors.unitId = 'Unit is required';
    if (!formData.specifications.trim())
      newErrors.specifications = 'Specifications are required';
    if (!formData.manufacturer.trim())
      newErrors.manufacturer = 'Manufacturer is required';

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setIsSubmitting(true);
      try {
        // Prepare the payload
        const machinePayload = {
          name: formData.name.trim(),
          typeId: Number(formData.typeId),
          unitId: Number(formData.unitId), // Use unitId to match filtering logic
          status: formData.status,
          specifications: formData.specifications.trim(),
          manufacturer: formData.manufacturer.trim(),
          model: formData.model.trim() || undefined,
          serialNumber: formData.serialNumber.trim() || undefined,
          capacity: formData.capacity.trim() || undefined,
          purchaseDate: formData.purchaseDate
            ? (() => {
                try {
                  const date = new Date(formData.purchaseDate);
                  return isNaN(date.getTime()) ? undefined : date.toISOString();
                } catch (error) {
                  console.error('Error converting purchase date:', error);
                  return undefined;
                }
              })()
            : undefined,
          warrantyExpiry: formData.warrantyExpiry
            ? (() => {
                try {
                  const date = new Date(formData.warrantyExpiry);
                  return isNaN(date.getTime()) ? undefined : date.toISOString();
                } catch (error) {
                  console.error('Error converting warranty expiry date:', error);
                  return undefined;
                }
              })()
            : undefined,
          installationDate: formData.installationDate
            ? (() => {
                try {
                  const date = new Date(formData.installationDate);
                  return isNaN(date.getTime()) ? undefined : date.toISOString();
                } catch (error) {
                  console.error('Error converting installation date:', error);
                  return undefined;
                }
              })()
            : undefined,
          lastService: formData.lastService
            ? (() => {
                try {
                  const date = new Date(formData.lastService);
                  return isNaN(date.getTime()) ? undefined : date.toISOString();
                } catch (error) {
                  console.error('Error converting last service date:', error);
                  return undefined;
                }
              })()
            : undefined,
          nextMaintenanceDue: formData.nextMaintenanceDue
            ? (() => {
                try {
                  const date = new Date(formData.nextMaintenanceDue);
                  return isNaN(date.getTime()) ? undefined : date.toISOString();
                } catch (error) {
                  console.error('Error converting next maintenance due date:', error);
                  return undefined;
                }
              })()
            : undefined,
          additionalNotes: formData.additionalNotes.trim() || undefined,
        };

        console.log('Machine payload:', machinePayload);

        let response;
        if (editingData) {
          // Try to update existing machine
          try {
            response = await machinesApi.update(editingData.id, machinePayload);
            toast({
              title: 'Machine Updated Successfully',
              description: `${formData.name} has been updated.`,
            });
          } catch (updateError) {
            console.error('Update failed, API may not support updates:', updateError);
            toast({
              title: 'Update Not Available',
              description: 'Machine updates are not currently supported. Please contact support.',
              variant: 'destructive',
            });
            return; // Exit early if update fails
          }
        } else {
          // Create new machine
          response = await machinesApi.create(machinePayload);
          toast({
            title: 'Machine Added Successfully',
            description: `${formData.name} has been added to the inventory.`,
          });
        }

        // Call the onSubmit callback with the created/updated machine
        onSubmit(response);

          // Reset form only for new machines, not when editing
          if (!editingData) {
            const fullUserData = getFullUserData();
            const defaultUnitId = fullUserData?.branch?.id || 0;
            
            setFormData({
              name: '',
              typeId: 0,
              unitId: defaultUnitId,
            status: MachineStatus.ACTIVE,
            specifications: '',
            manufacturer: '',
            model: '',
            serialNumber: '',
            purchaseDate: '',
            warrantyExpiry: '',
            capacity: '',
            installationDate: '',
            lastService: '',
            nextMaintenanceDue: '',
            additionalNotes: '',
          });
          setErrors({});
          setShowCustomTypeInput(false);
          setCustomTypeName('');
        }
        onClose();
      } catch (error) {
        console.error('Error creating machine:', error);
        
        // Log the detailed error for debugging
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
        }
        
        toast({
          title: 'Error',
          description: error.response?.data?.message || error.message || 'Failed to create machine. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='pb-2'>
          <DialogTitle className='flex items-center gap-2 text-lg'>
            <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
              {editingData ? <Settings className='w-4 h-4 text-primary' /> : <Plus className='w-4 h-4 text-primary' />}
            </div>
            {editingData ? 'Edit Machine Details' : 'Add New Machine'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Single Card for all form content */}
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
                    <Label htmlFor='name' className='text-xs font-medium'>
                      Machine Name *
                    </Label>
                    <Input
                      id='name'
                      placeholder='Enter machine name'
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange('name', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                    {errors.name && (
                      <p className='text-destructive text-xs mt-1'>
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='type' className='text-xs font-medium'>
                      Machine Type *
                    </Label>
                    <Select
                      value={formData.typeId > 0 ? formData.typeId.toString() : ''}
                      onValueChange={(value) =>
                        handleSelectChange('typeId', parseInt(value))
                      }
                    >
                      <SelectTrigger className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'>
                        <SelectValue placeholder='Select machine type' />
                      </SelectTrigger>
                      <SelectContent>
                        {machineTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.name}
                          </SelectItem>
                        ))}
                        <SelectItem key="other" value="0">
                          Others
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.typeId && (
                      <p className='text-destructive text-xs mt-1'>
                        {errors.typeId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Custom Machine Type Input */}
                {showCustomTypeInput && (
                  <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2'>
                    <Label className='text-xs font-medium text-blue-800'>
                      Add New Machine Type
                    </Label>
                    <div className='flex gap-2'>
                      <Input
                        placeholder='Enter machine type name'
                        value={customTypeName}
                        onChange={(e) => setCustomTypeName(e.target.value)}
                        className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                      />
                      <Button
                        type='button'
                        onClick={handleCreateMachineType}
                        size='sm'
                        className='h-8 px-3 bg-blue-600 hover:bg-blue-700'
                      >
                        <Plus className='w-3 h-3 mr-1' />
                        Add
                      </Button>
                      <Button
                        type='button'
                        onClick={() => {
                          setShowCustomTypeInput(false);
                          setCustomTypeName('');
                          setFormData(prev => ({ ...prev, typeId: 0 }));
                        }}
                        variant='outline'
                        size='sm'
                        className='h-8 px-3'
                      >
                        <X className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Second Row */}
                <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                  <div className='space-y-1'>
                    <Label htmlFor='branch' className='text-xs font-medium'>
                      Unit/Location *
                    </Label>
                    <Select
                      value={formData.unitId > 0 ? formData.unitId.toString() : ''}
                      onValueChange={(value) =>
                        handleSelectChange('unitId', parseInt(value))
                      }
                      disabled={currentUser?.role === 'supervisor'}
                    >
                      <SelectTrigger className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'>
                        <SelectValue placeholder='Select Branch' />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.unitId && (
                      <p className='text-destructive text-xs mt-1'>
                        {errors.unitId}
                      </p>
                    )}
                  </div>

                  <div className='space-y-1'>
                    <Label className='text-xs font-medium'>Status</Label>
                    <div className='flex gap-1'>
                      {statusOptions.map((status) => (
                        <button
                          key={status.value}
                          type='button'
                          onClick={() =>
                            handleInputChange('status', status.value)
                          }
                          className={`h-7 px-2 py-1 rounded-[5px] border text-left transition-all duration-200 text-xs font-medium ${
                            formData.status === status.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-input bg-background hover:border-primary/50 hover:bg-muted/30'
                          }`}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>


                {/* Specifications */}
                <div className='space-y-1'>
                  <Label
                    htmlFor='specifications'
                    className='text-xs font-medium'
                  >
                    Specifications *
                  </Label>
                  <Textarea
                    id='specifications'
                    placeholder='Enter detailed specifications (capacity, dimensions, technical details, etc.)'
                    value={formData.specifications}
                    onChange={(e) =>
                      handleInputChange('specifications', e.target.value)
                    }
                    className='min-h-[40px] px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs resize-none transition-all duration-200'
                  />
                  {errors.specifications && (
                    <p className='text-destructive text-xs mt-1'>
                      {errors.specifications}
                    </p>
                  )}
                </div>
              </div>

              {/* Manufacturing Details */}
              <div className='space-y-3'>
                <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                  Manufacturing Details
                </h4>

                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
                  <div className='space-y-1'>
                    <Label
                      htmlFor='manufacturer'
                      className='text-xs font-medium'
                    >
                      Manufacturer *
                    </Label>
                    <Input
                      id='manufacturer'
                      placeholder='e.g., Bosch, Siemens, etc.'
                      value={formData.manufacturer}
                      onChange={(e) =>
                        handleInputChange('manufacturer', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                    {errors.manufacturer && (
                      <p className='text-destructive text-xs mt-1'>
                        {errors.manufacturer}
                      </p>
                    )}
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='model' className='text-xs font-medium'>
                      Model
                    </Label>
                    <Input
                      id='model'
                      placeholder='Model number'
                      value={formData.model}
                      onChange={(e) =>
                        handleInputChange('model', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label
                      htmlFor='serialNumber'
                      className='text-xs font-medium'
                    >
                      Serial Number
                    </Label>
                    <Input
                      id='serialNumber'
                      placeholder='Serial number'
                      value={formData.serialNumber}
                      onChange={(e) =>
                        handleInputChange('serialNumber', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='capacity' className='text-xs font-medium'>
                      Capacity
                    </Label>
                    <Input
                      id='capacity'
                      placeholder='e.g., 500kg/hour'
                      value={formData.capacity}
                      onChange={(e) =>
                        handleInputChange('capacity', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div className='space-y-1'>
                    <Label
                      htmlFor='purchaseDate'
                      className='text-xs font-medium'
                    >
                      Purchase Date
                    </Label>
                    <Input
                      id='purchaseDate'
                      type='date'
                      value={formData.purchaseDate}
                      onChange={(e) =>
                        handleInputChange('purchaseDate', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label
                      htmlFor='warrantyExpiry'
                      className='text-xs font-medium'
                    >
                      Warranty Expiry
                    </Label>
                    <Input
                      id='warrantyExpiry'
                      type='date'
                      value={formData.warrantyExpiry}
                      onChange={(e) =>
                        handleInputChange('warrantyExpiry', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label
                      htmlFor='installationDate'
                      className='text-xs font-medium'
                    >
                      Installation Date
                    </Label>
                    <Input
                      id='installationDate'
                      type='date'
                      value={formData.installationDate}
                      onChange={(e) =>
                        handleInputChange('installationDate', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>
                </div>
              </div>

              {/* Maintenance Information */}
              <div className='space-y-3'>
                <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                  Maintenance Information
                </h4>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <div className='space-y-1'>
                    <Label
                      htmlFor='lastService'
                      className='text-xs font-medium'
                    >
                      Last Service
                    </Label>
                    <Input
                      id='lastService'
                      type='date'
                      value={formData.lastService}
                      onChange={(e) =>
                        handleInputChange('lastService', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label
                      htmlFor='nextMaintenanceDue'
                      className='text-xs font-medium'
                    >
                      Next Maintenance Due
                    </Label>
                    <Input
                      id='nextMaintenanceDue'
                      type='date'
                      value={formData.nextMaintenanceDue}
                      onChange={(e) =>
                        handleInputChange('nextMaintenanceDue', e.target.value)
                      }
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>
                </div>

                <div className='space-y-1'>
                  <Label
                    htmlFor='additionalNotes'
                    className='text-xs font-medium'
                  >
                    Additional Notes
                  </Label>
                  <Textarea
                    id='additionalNotes'
                    placeholder='Any additional information about the machine'
                    value={formData.additionalNotes}
                    onChange={(e) =>
                      handleInputChange('additionalNotes', e.target.value)
                    }
                    className='min-h-[40px] px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs resize-none transition-all duration-200'
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className='flex justify-end gap-3 pt-4 border-t'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              className='h-8 px-4'
            >
              <X className='w-3 h-3 mr-1' />
              Cancel
            </Button>
            <Button
              type='submit'
              className='h-8 px-4 bg-primary hover:bg-primary/90'
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                  Submitting...
                </>
              ) : (
                <>
                  <Save className='w-3 h-3 mr-1' />
                  Submit
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};