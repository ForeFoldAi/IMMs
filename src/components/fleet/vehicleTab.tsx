import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Truck,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  Upload,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Shield,
  FileText,
  Save,
  X,
  Loader2,
} from 'lucide-react';

// Date utility functions for DD-MM-YYYY format
const formatDateToString = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const stringToDateInputFormat = (dateString: string): string => {
  if (!dateString) return '';
  
  // Handle DD-MM-YYYY format
  if (dateString.includes('-') && dateString.length === 10) {
    const parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
  }
  
  // If already in YYYY-MM-DD format, return as is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  return '';
};

const dateInputFormatToString = (inputDate: string): string => {
  if (!inputDate) return '';
  
  // Convert YYYY-MM-DD to DD-MM-YYYY
  if (inputDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = inputDate.split('-');
    return `${day}-${month}-${year}`;
  }
  
  return inputDate;
};
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '../../hooks/use-toast';
import { useRole } from '../../contexts/RoleContext';
import { VehicleOnboardingForm, VehicleOnboardingData, FuelType } from './VehicleOnboardingForm';
import { fleetApi } from '../../lib/api';
import type { Vehicle, PaginatedResponse, CreateVehicleRequest } from '../../lib/api/types';

// Helper function to convert YYYY-MM-DD to DD-MM-YYYY for display
const convertDateFormatFromApi = (dateString: string): string => {
  if (!dateString) return '';
  
  // If already in DD-MM-YYYY format, return as is
  if (dateString.includes('-') && dateString.length === 10 && dateString.split('-')[0].length === 2) {
    return dateString;
  }
  
  // Handle YYYY-MM-DD format
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }
  
  return dateString;
};

// Helper function to convert API Vehicle to VehicleData format
const mapVehicleToVehicleData = (vehicle: Vehicle, currentUserName?: string): VehicleData => {
  // Handle nested vehicleType object (new API) or string (legacy)
  // Check for null object before accessing .name
  const vehicleTypeName = typeof vehicle.vehicleType === 'object' && vehicle.vehicleType !== null
    ? vehicle.vehicleType.name 
    : (typeof vehicle.vehicleType === 'string' ? vehicle.vehicleType : '') || '';

  const normalizeFuelType = (fuel: string | undefined | null): FuelType => {
    if (!fuel) {
      return FuelType.OTHER;
    }
    const normalizedFuel = Object.values(FuelType).find(
      (type) => type.toLowerCase() === fuel.toLowerCase()
    );
    return normalizedFuel ?? FuelType.OTHER;
  };

  return {
    id: vehicle.id.toString(),
    vehicleRegistrationNumber: vehicle.registrationNumber,
    vehicleMake: vehicle.make,
    vehicleModel: vehicle.model,
    vehicleType: vehicleTypeName,
    vehicleYear: vehicle.year.toString(),
    engineNumber: vehicle.engineNumber,
    chassisNumber: vehicle.chassisNumber,
    fuelType: normalizeFuelType(vehicle.fuelType),
    loadCapacity: vehicle.loadCapacityMt,
    purchaseDate: convertDateFormatFromApi(vehicle.purchaseDate),
    insuranceProvider: vehicle.insuranceProvider,
    insurancePolicyNumber: vehicle.policyNumber,
    insuranceExpiryDate: convertDateFormatFromApi(vehicle.insuranceExpiryDate),
    additionalNotes: vehicle.additionalNotes || '',
    status: vehicle.status.toLowerCase() as 'active' | 'inactive' | 'maintenance',
    createdAt: vehicle.createdAt,
    updatedAt: vehicle.updatedAt,
    // Store createdBy name for display (use API data only, no fallbacks)
    submittedBy: vehicle.createdBy?.name || '',
  };
};

// Helper function to convert DD-MM-YYYY to YYYY-MM-DD
const convertDateFormatToApi = (dateString: string): string => {
  if (!dateString) return '';
  
  // If already in YYYY-MM-DD format, return as is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Handle DD-MM-YYYY format
  if (dateString.includes('-') && dateString.length === 10) {
    const parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateString;
};

// Helper function to convert VehicleOnboardingData to API CreateVehicleRequest
const mapVehicleDataToApiRequest = (data: VehicleOnboardingData, vehicleTypeId?: number): CreateVehicleRequest => {
  return {
    registrationNumber: data.vehicleRegistrationNumber,
    make: data.vehicleMake,
    model: data.vehicleModel,
    vehicleTypeId: vehicleTypeId, // Use vehicleTypeId (number) instead of vehicleType (string)
    fuelType: data.fuelType,
    status: data.status.charAt(0).toUpperCase() + data.status.slice(1), // Capitalize first letter (Active, Inactive, Maintenance)
    year: parseInt(data.vehicleYear) || new Date().getFullYear(),
    engineNumber: data.engineNumber,
    chassisNumber: data.chassisNumber,
    loadCapacityMt: data.loadCapacity,
    purchaseDate: convertDateFormatToApi(data.purchaseDate),
    insuranceProvider: data.insuranceProvider,
    policyNumber: data.insurancePolicyNumber,
    insuranceExpiryDate: convertDateFormatToApi(data.insuranceExpiryDate),
    additionalNotes: data.additionalNotes,
  };
};

export interface VehicleData extends VehicleOnboardingData {
  id: string;
  createdAt: string;
  updatedAt: string;
  submittedBy?: string; // Name of the user who submitted/created the vehicle
}

export const VehicleTab = () => {
  const { currentUser, hasPermission, isCompanyLevel } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<VehicleData[]>([]);
  const [allVehicles, setAllVehicles] = useState<VehicleData[]>([]); // Store all vehicles for client-side search
  const [vehiclesData, setVehiclesData] = useState<PaginatedResponse<Vehicle> | null>(null);
  const [vehicleTypes, setVehicleTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVehicleType, setFilterVehicleType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Form states
  const [isOnboardFormOpen, setIsOnboardFormOpen] = useState(false);
  const [viewingVehicle, setViewingVehicle] = useState<VehicleData | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Custom vehicle type states
  const [showCustomVehicleTypeInput, setShowCustomVehicleTypeInput] = useState(false);
  const [customVehicleTypeName, setCustomVehicleTypeName] = useState('');

  // Fetch vehicle types from API
  useEffect(() => {
    const fetchVehicleTypes = async () => {
      try {
        const response = await fleetApi.getAllVehicleTypes({ page: 1, limit: 100 });
        setVehicleTypes(response.data.map(vt => ({ id: vt.id, name: vt.name })));
      } catch (error) {
        console.error('Error fetching vehicle types:', error);
      }
    };

    fetchVehicleTypes();
  }, []);

  // Fetch vehicles data from API
  const fetchVehicles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Always fetch all vehicles for client-side sorting and filtering
      const params: any = {
        page: 1,
        limit: 1000, // Fetch large batch for client-side sorting
        // Removed sortBy and sortOrder - sorting is now handled client-side
      };

      // Don't send search parameter to API, we'll filter client-side
      // if (searchTerm.trim()) {
      //   params.search = searchTerm.trim();
      // }

      // Add status filter if not 'all'
      if (filterStatus !== 'all') {
        params.status = filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1); // Capitalize first letter
      }

      // Add vehicle type filter if not 'all' - use vehicleTypeId instead of vehicleType
      if (filterVehicleType !== 'all') {
        // Find vehicle type ID from the name
        const selectedVehicleType = vehicleTypes.find(vt => vt.name === filterVehicleType);
        if (selectedVehicleType) {
          params.vehicleTypeId = selectedVehicleType.id;
        }
      }

      // Fetch all pages for client-side sorting
      let allFetchedVehicles: Vehicle[] = [];
      let currentPageNum = 1;
      let hasMorePages = true;
      const limit = 100; // API limit per page
      
      while (hasMorePages) {
        const pageParams = { ...params, page: currentPageNum, limit: limit };
        const response = await fleetApi.getAllVehicles(pageParams);
        allFetchedVehicles = [...allFetchedVehicles, ...response.data];
        
        hasMorePages = response.meta.hasNextPage || false;
        currentPageNum++;
        
        // Safety check
        if (currentPageNum > 1000) break;
      }
      
      // Map all vehicles to VehicleData format
      const mappedAllVehicles = allFetchedVehicles.map(vehicle => 
        mapVehicleToVehicleData(vehicle, currentUser?.name)
      );
      
      // Store all vehicles for client-side operations
      setAllVehicles(mappedAllVehicles);
      setVehicles(mappedAllVehicles);
      
      // Store metadata for reference
      if (allFetchedVehicles.length > 0) {
        const lastResponse = await fleetApi.getAllVehicles({ ...params, page: 1, limit: 1 });
        if (lastResponse && lastResponse.meta) {
          setVehiclesData({
            ...lastResponse,
            data: [],
            meta: {
              ...lastResponse.meta,
              itemCount: mappedAllVehicles.length,
            }
          });
        }
      } else {
        setVehiclesData(null);
      }
      
      setError(null); // Clear any previous errors
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      
      // Treat errors as "no data available" scenario
      setError(null); // Don't set error, treat as no data
      setVehicles([]);
      setAllVehicles([]);
      setVehiclesData(null);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus, filterVehicleType, vehicleTypes, currentUser?.name]);

  // Fetch vehicles when dependencies change (with debounce for search)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVehicles();
    }, searchTerm ? 500 : 0); // Debounce search by 500ms

    return () => clearTimeout(timeoutId);
  }, [fetchVehicles, searchTerm]);

  // Reset to first page when filters change (except currentPage itself)
  useEffect(() => {
    if (currentPage !== 1) {
    setCurrentPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterVehicleType, sortBy, sortOrder, itemsPerPage, searchTerm]);

  // Client-side search filter function
  const filterVehiclesBySearch = useCallback((vehicleList: VehicleData[], search: string): VehicleData[] => {
    if (!search.trim()) {
      return vehicleList;
    }

    const searchLower = search.toLowerCase().trim();
    
    return vehicleList.filter((vehicle) => {
      // Search across all relevant fields
      const searchableFields = [
        vehicle.vehicleRegistrationNumber,
        vehicle.vehicleMake,
        vehicle.vehicleModel,
        vehicle.vehicleType,
        vehicle.vehicleYear,
        vehicle.fuelType,
        vehicle.status,
        vehicle.loadCapacity,
        vehicle.insuranceProvider,
        vehicle.insurancePolicyNumber,
        vehicle.submittedBy || '',
        vehicle.engineNumber || '',
        vehicle.chassisNumber || '',
        formatDate(vehicle.purchaseDate),
        formatDate(vehicle.insuranceExpiryDate),
        formatDate(vehicle.createdAt),
      ];

      return searchableFields.some(field => 
        field && field.toString().toLowerCase().includes(searchLower)
      );
    });
  }, []);

  // Client-side filtering function (status, vehicle type, and search)
  const filterVehicles = useCallback((vehicleList: VehicleData[]): VehicleData[] => {
    let filtered = vehicleList;

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(vehicle => 
        vehicle.status.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    // Apply vehicle type filter
    if (filterVehicleType !== 'all') {
      filtered = filtered.filter(vehicle => 
        vehicle.vehicleType === filterVehicleType
      );
    }

    // Apply search filter
    if (searchTerm.trim()) {
      filtered = filterVehiclesBySearch(filtered, searchTerm);
    }

    return filtered;
  }, [filterStatus, filterVehicleType, searchTerm, filterVehiclesBySearch]);

  // Apply client-side filtering
  const filteredVehicles = useMemo(() => {
    let result = searchTerm.trim() ? allVehicles : vehicles;
    return filterVehicles(result);
  }, [searchTerm, allVehicles, vehicles, filterVehicles]);

  // Client-side sorting function
  const sortVehicles = useCallback((vehicleList: VehicleData[]): VehicleData[] => {
    if (!sortBy) return vehicleList;

    const sorted = [...vehicleList].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'vehicleRegistrationNumber':
          aValue = (a.vehicleRegistrationNumber || '').toLowerCase();
          bValue = (b.vehicleRegistrationNumber || '').toLowerCase();
          break;
        
        case 'vehicleMake':
          aValue = (a.vehicleMake || '').toLowerCase();
          bValue = (b.vehicleMake || '').toLowerCase();
          break;
        
        case 'status':
          aValue = (a.status || '').toLowerCase();
          bValue = (b.status || '').toLowerCase();
          break;
        
        case 'loadCapacity':
          aValue = parseFloat(a.loadCapacity) || 0;
          bValue = parseFloat(b.loadCapacity) || 0;
          break;
        
        case 'createdAt':
          aValue = new Date(a.createdAt || 0).getTime();
          bValue = new Date(b.createdAt || 0).getTime();
          break;
        
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'ASC' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'ASC' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [sortBy, sortOrder]);

  // Apply sorting to filtered vehicles
  const sortedVehicles = useMemo(() => {
    return sortVehicles(filteredVehicles);
  }, [filteredVehicles, sortVehicles]);

  // Apply client-side pagination
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedVehicles.slice(startIndex, endIndex);
  }, [sortedVehicles, currentPage, itemsPerPage]);

  // Calculate pagination metadata
  const displayVehiclesData = useMemo(() => {
    if (vehiclesData) {
      return {
        ...vehiclesData,
        meta: {
          ...vehiclesData.meta,
          itemCount: sortedVehicles.length,
          pageCount: Math.ceil(sortedVehicles.length / itemsPerPage),
          page: currentPage,
          limit: itemsPerPage,
          hasPreviousPage: currentPage > 1,
          hasNextPage: currentPage < Math.ceil(sortedVehicles.length / itemsPerPage),
        },
      };
    }
    return null;
  }, [vehiclesData, sortedVehicles.length, currentPage, itemsPerPage]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('DESC');
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className='w-4 h-4' />;
      case 'inactive':
        return <AlertTriangle className='w-4 h-4' />;
      case 'maintenance':
        return <Wrench className='w-4 h-4' />;
      default:
        return <Clock className='w-4 h-4' />;
    }
  };


  const handleOnboardVehicle = async (vehicleData: VehicleOnboardingData) => {
    // Form component now handles the API call
    // This callback is called after successful creation to refresh the list
    try {
      setIsLoading(true);
      
      // Refresh the vehicles list after successful creation
      await fetchVehicles();
      
    setIsOnboardFormOpen(false);
    } catch (error: any) {
      console.error('Error refreshing vehicles list:', error);
      
      // Don't show error toast here as the form already handled the creation
      // Just log the error
    } finally {
      setIsLoading(false);
    }
  };


  const handleViewVehicle = (vehicle: VehicleData) => {
    setViewingVehicle(vehicle);
    setIsViewDialogOpen(true);
    setShowCustomVehicleTypeInput(false);
    setCustomVehicleTypeName('');
    setErrors({});
  };

  const handleInputChange = (field: keyof VehicleData, value: string) => {
    if (viewingVehicle) {
      setViewingVehicle((prev) => prev ? { ...prev, [field]: value } : null);
    }
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleVehicleTypeChange = (value: string) => {
    handleInputChange('vehicleType', value);
    
    // Handle "Other" selection for vehicle type
    if (value === 'Other') {
      setShowCustomVehicleTypeInput(true);
    } else {
      setShowCustomVehicleTypeInput(false);
    }
  };

  const handleCreateVehicleType = async () => {
    if (!customVehicleTypeName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a vehicle type name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      handleInputChange('vehicleType', customVehicleTypeName.trim());
      setShowCustomVehicleTypeInput(false);
      setCustomVehicleTypeName('');

        toast({
        title: 'Success',
        description: `Vehicle type "${customVehicleTypeName.trim()}" has been added.`,
        });
      } catch (error) {
      console.error('Error creating vehicle type:', error);
        toast({
          title: 'Error',
        description: 'Failed to add vehicle type. Please try again.',
          variant: 'destructive',
        });
      }
  };

  const validateForm = () => {
    if (!viewingVehicle) return false;
    
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // Only validate mandatory fields
    if (!viewingVehicle.vehicleRegistrationNumber.trim()) {
      newErrors.vehicleRegistrationNumber = 'Vehicle registration number is required';
      hasErrors = true;
    }

    if (!viewingVehicle.vehicleMake.trim()) {
      newErrors.vehicleMake = 'Vehicle make is required';
      hasErrors = true;
    }

    if (!viewingVehicle.vehicleModel.trim()) {
      newErrors.vehicleModel = 'Vehicle model is required';
      hasErrors = true;
    }

    if (!viewingVehicle.vehicleType.trim()) {
      newErrors.vehicleType = 'Vehicle type is required';
      hasErrors = true;
    }

    if (!viewingVehicle.fuelType.trim()) {
      newErrors.fuelType = 'Fuel type is required';
      hasErrors = true;
    }

    setErrors(newErrors);

    if (hasErrors) {
      toast({
        title: '❌ Form Validation Failed',
        description: 'Please fix the highlighted fields before submitting.',
        variant: 'destructive',
      });
    }

    return !hasErrors;
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!viewingVehicle || !validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Find the selected vehicle type ID from the vehicle types list
      const selectedVehicleType = vehicleTypes.find(vt => vt.name === viewingVehicle.vehicleType);
      const vehicleTypeId = selectedVehicleType?.id;

      // Convert VehicleData to API request format
      const apiRequest = mapVehicleDataToApiRequest(viewingVehicle, vehicleTypeId);
      
      // Update vehicle via API
      await fleetApi.updateVehicle(parseInt(viewingVehicle.id), apiRequest);
      
      // Refresh the vehicles list
      await fetchVehicles();
      
      toast({
        title: '✅ Vehicle Updated Successfully!',
        description: `Vehicle ${viewingVehicle.vehicleRegistrationNumber} has been successfully updated.`,
          variant: 'default',
        });

      setErrors({});
      setShowCustomVehicleTypeInput(false);
      setCustomVehicleTypeName('');
      setIsViewDialogOpen(false);
      setViewingVehicle(null);
    } catch (error: any) {
      console.error('Error updating vehicle:', error);
      
      let errorMessage = 'Failed to update vehicle. Please try again.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400 && data?.message) {
          errorMessage = data.message;
        } else if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to update vehicles.';
        } else if (status === 404) {
          errorMessage = 'Vehicle not found.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
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

  const handleExportVehicles = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all vehicles for export (with pagination)
      let allVehicles: Vehicle[] = [];
      let currentPage = 1;
      let hasMorePages = true;
      const limit = 100; // API limit

      while (hasMorePages) {
        const params: any = {
          page: currentPage,
          limit: limit,
          // Removed sortBy and sortOrder - sorting is handled client-side
        };

        // Add filters for export
        if (filterStatus !== 'all') {
          params.status = filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1);
        }
        if (filterVehicleType !== 'all') {
          // Find vehicle type ID from the name
          const selectedVehicleType = vehicleTypes.find(vt => vt.name === filterVehicleType);
          if (selectedVehicleType) {
            params.vehicleTypeId = selectedVehicleType.id;
          }
        }
        if (searchTerm.trim()) {
          params.search = searchTerm.trim();
        }

        const response = await fleetApi.getAllVehicles(params);
        allVehicles = [...allVehicles, ...response.data];

        hasMorePages = response.meta.hasNextPage || false;
        currentPage++;

        // Safety check to prevent infinite loops
        if (currentPage > 1000) {
          console.warn('Export stopped at page 1000 to prevent infinite loop');
          break;
        }
      }

      // Prepare CSV data
      const csvHeaders = [
        'Registration Number',
        'Make',
        'Model',
        'Vehicle Type',
        'Year',
        'Fuel Type',
        'Load Capacity (MT)',
        'Status',
        'Insurance Provider',
        'Insurance Expiry Date',
        'Purchase Date',
        'Created Date'
      ];

      const csvData = allVehicles.map(vehicle => [
        vehicle.registrationNumber,
        vehicle.make,
        vehicle.model,
        vehicle.vehicleType,
        vehicle.year.toString(),
        vehicle.fuelType,
        vehicle.loadCapacityMt,
        vehicle.status,
        vehicle.insuranceProvider,
        formatDate(vehicle.insuranceExpiryDate),
        formatDate(vehicle.purchaseDate),
        formatDate(vehicle.createdAt)
      ]);

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `vehicles_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '✅ Export Successful!',
        description: `Exported ${allVehicles.length} vehicles to CSV file.`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Error exporting vehicles:', error);
      toast({
        title: 'Error',
        description: 'Failed to export vehicles. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Handle DD-MM-YYYY format
    if (dateString.includes('-') && dateString.length === 10) {
      const parts = dateString.split('-');
      if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
        // Already in DD-MM-YYYY format
        return dateString;
      }
    }
    
    // Convert from other formats to DD-MM-YYYY
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return formatDateToString(date);
      }
    } catch (error) {
      // If parsing fails, return original string
    }
    
    return dateString;
  };

  const statusOptions = [
    { value: 'active', label: 'Active', description: 'Vehicle is operational' },
    { value: 'inactive', label: 'Inactive', description: 'Not in use' },
    { value: 'maintenance', label: 'Under Maintenance', description: 'Currently being serviced' },
  ];

  return (
    <div className='space-y-4 p-2 sm:space-y-6 sm:p-0'>
      {/* Header */}
    

      {/* Search, Filters and Actions - Single Line */}
      <Card>
        <CardContent className='p-3 sm:p-4'>
          {/* Mobile Layout */}
          <div className='flex flex-col gap-3 sm:hidden'>
            {/* Search and Action Buttons Row */}
            <div className='flex gap-2'>
              <div className='flex-1'>
                <div className='relative'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                  <Input
                    placeholder='Search vehicles...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>
              <Button
                variant='outline'
                onClick={handleExportVehicles}
                size='sm'
                className='gap-1 text-xs'
                disabled={sortedVehicles.length === 0 || isLoading}
              >
                <Upload className='w-3 h-3' />
                Export
              </Button>
              <Button
                onClick={() => {
                  setIsOnboardFormOpen(true);
                }}
                size='sm'
                className='gap-1 text-xs'
                disabled={!isCompanyLevel() && !hasPermission('inventory:material-indents:create')}
              >
                <Plus className='w-3 h-3' />
                Add
              </Button>
            </div>
            
            {/* Filters Row */}
            <div className='flex gap-2'>
              <div className='flex-1'>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Status' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Status</SelectItem>
                    <SelectItem value='active'>Active</SelectItem>
                    <SelectItem value='inactive'>Inactive</SelectItem>
                    <SelectItem value='maintenance'>Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex-1'>
                <Select value={filterVehicleType} onValueChange={setFilterVehicleType}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Vehicle Type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Types</SelectItem>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id || vt.name} value={vt.name}>
                        {vt.name}
                      </SelectItem>
                    ))}
                    {vehicleTypes.length === 0 && (
                      <>
                        <SelectItem value='Truck'>Truck</SelectItem>
                        <SelectItem value='Pickup'>Pickup</SelectItem>
                        <SelectItem value='Car'>Car</SelectItem>
                        <SelectItem value='Van'>Van</SelectItem>
                        <SelectItem value='Bus'>Bus</SelectItem>
                        <SelectItem value='Tractor'>Tractor</SelectItem>
                        <SelectItem value='Lorry'>Lorry</SelectItem>
                        <SelectItem value='Container'>Container</SelectItem>
                        <SelectItem value='Trailer'>Trailer</SelectItem>
                        <SelectItem value='Tanker'>Tanker</SelectItem>
                        <SelectItem value='Other'>Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className='hidden sm:flex flex-wrap items-center justify-end gap-3'>
            {/* Search */}
            <div className='min-w-[200px] max-w-[300px]'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                <Input
                  placeholder='Search vehicles...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className='w-auto min-w-[140px]'>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className='text-sm w-full'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='active'>Active</SelectItem>
                  <SelectItem value='inactive'>Inactive</SelectItem>
                  <SelectItem value='maintenance'>Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Type Filter */}
            <div className='w-auto min-w-[140px]'>
              <Select value={filterVehicleType} onValueChange={setFilterVehicleType}>
                <SelectTrigger className='text-sm w-full'>
                  <SelectValue placeholder='Vehicle Type' />
                </SelectTrigger>
                                  <SelectContent>
                    <SelectItem value='all'>All Types</SelectItem>
                    {vehicleTypes.map((vt) => (
                      <SelectItem key={vt.id || vt.name} value={vt.name}>
                        {vt.name}
                      </SelectItem>
                    ))}
                    {vehicleTypes.length === 0 && (
                      <>
                        <SelectItem value='Truck'>Truck</SelectItem>
                        <SelectItem value='Pickup'>Pickup</SelectItem>
                        <SelectItem value='Car'>Car</SelectItem>
                        <SelectItem value='Van'>Van</SelectItem>
                        <SelectItem value='Bus'>Bus</SelectItem>
                        <SelectItem value='Tractor'>Tractor</SelectItem>
                        <SelectItem value='Lorry'>Lorry</SelectItem>
                        <SelectItem value='Container'>Container</SelectItem>
                        <SelectItem value='Trailer'>Trailer</SelectItem>
                        <SelectItem value='Tanker'>Tanker</SelectItem>
                        <SelectItem value='Other'>Other</SelectItem>
                      </>
                    )}
                  </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2 flex-shrink-0'>
              <Button
                variant='outline'
                onClick={handleExportVehicles}
                size='sm'
                className='gap-2 text-sm whitespace-nowrap'
                disabled={sortedVehicles.length === 0 || isLoading}
              >
                <Upload className='w-4 h-4' />
                <span className='hidden md:inline'>Export</span>
                <span className='md:hidden'>Exp</span>
              </Button>
              
              <Button
                onClick={() => {
                  setIsOnboardFormOpen(true);
                }}
                size='sm'
                className='gap-2 text-sm whitespace-nowrap'
                disabled={!isCompanyLevel() && !hasPermission('inventory:material-indents:create')}
              >
                <Plus className='w-4 h-4' />
                <span className='hidden lg:inline'>Onboard Vehicle</span>
                <span className='lg:hidden hidden md:inline'>Onboard</span>
                <span className='md:hidden'>Add</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <div className='w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4'></div>
                <p className='text-muted-foreground'>Loading vehicles...</p>
              </div>
            </div>
          ) : paginatedVehicles.length === 0 ? (
            <div className='text-center py-12'>
              <Truck className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No data Available</h3>
              <p className='text-muted-foreground mb-4'>
                {searchTerm || filterStatus !== 'all' || filterVehicleType !== 'all'
                  ? 'No vehicles match your current filters.'
                  : 'Get started by onboarding your first vehicle.'}
              </p>
              
            </div>
          ) : (
            <div className='overflow-x-auto -mx-4 sm:mx-0'>
              <div className='inline-block min-w-full align-middle px-4 sm:px-0'>
                <Table className='min-w-full'>
                <TableHeader>
                  <TableRow className='bg-secondary/20'>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('vehicleRegistrationNumber')}
                    >
                      <div className='flex items-center gap-2'>
                        Registration Number
                        {getSortIcon('vehicleRegistrationNumber')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('vehicleMake')}
                    >
                      <div className='flex items-center gap-2'>
                        Vehicle
                        {getSortIcon('vehicleMake')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('status')}
                    >
                      <div className='flex items-center gap-2'>
                        Status
                        {getSortIcon('status')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('loadCapacity')}
                    >
                      <div className='flex items-center gap-2'>
                        Load Capacity (MT)
                        {getSortIcon('loadCapacity')}
                      </div>
                    </TableHead>
                    <TableHead>Insurance</TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className='flex items-center gap-2'>
                        Submitted By
                        {getSortIcon('createdAt')}
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVehicles.map((vehicle) => (
                      <TableRow key={vehicle.id} className='hover:bg-muted/30'>
                        <TableCell className='font-medium'>
                        <button
                          onClick={() => handleViewVehicle(vehicle)}
                          className='text-left hover:text-primary transition-colors'
                        >
                          <div className='flex flex-col'>
                            <span className='font-semibold text-black hover:text-primary/80 underline'>
                              {vehicle.vehicleRegistrationNumber}
                            </span>
                            <span className='text-xs text-muted-foreground'>
                              {vehicle.vehicleType.toUpperCase()} • {vehicle.vehicleYear}
                            </span>
                          </div>
                        </button>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='font-medium'>{vehicle.vehicleMake} {vehicle.vehicleModel}</span>
                            <span className='text-xs text-muted-foreground'>
                              {vehicle.fuelType}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={`${getStatusColor(vehicle.status)} border flex items-center gap-1 w-fit`}>
                            {getStatusIcon(vehicle.status)}
                            <span className='capitalize'>{vehicle.status.replace('_', ' ')}</span>
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className='text-sm font-medium'>
                            {vehicle.loadCapacity} MT
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='text-sm font-medium'>{vehicle.insuranceProvider || '-'}</span>
                            <span className='text-xs text-muted-foreground'>
                              {vehicle.insuranceExpiryDate ? `Expires: ${formatDate(vehicle.insuranceExpiryDate)}` : '-'}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='text-sm font-medium'>{vehicle.submittedBy || 'N/A'}</span>
                            <span className='text-xs text-muted-foreground'>
                              {formatDate(vehicle.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}
          
          {/* Pagination Controls */}
          {displayVehiclesData && displayVehiclesData.meta && paginatedVehicles.length > 0 && (
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
              {/* Page Info */}
              <div className='text-xs sm:text-sm text-muted-foreground'>
                Showing {(displayVehiclesData.meta.page - 1) * displayVehiclesData.meta.limit + 1} to{' '}
                {Math.min(
                  displayVehiclesData.meta.page * displayVehiclesData.meta.limit,
                  displayVehiclesData.meta.itemCount
                )}{' '}
                of {displayVehiclesData.meta.itemCount} entries
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
                      // fetchVehicles will be triggered by useEffect when itemsPerPage changes
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
                    onClick={() => setCurrentPage(1)}
                  disabled={
                    !displayVehiclesData.meta.hasPreviousPage ||
                    displayVehiclesData.meta.page === 1
                  }
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                >
                    <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                </Button>
                
                  {/* Previous page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => prev - 1)}
                    disabled={!displayVehiclesData.meta.hasPreviousPage}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Page numbers - Show up to 6 pages */}
                  <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                  {Array.from(
                    { length: Math.min(6, displayVehiclesData.meta.pageCount) },
                    (_, i) => {
                    let pageNum;
                      
                      if (displayVehiclesData.meta.pageCount <= 6) {
                      pageNum = i + 1;
                      } else if (displayVehiclesData.meta.page <= 3) {
                      pageNum = i + 1;
                      } else if (
                        displayVehiclesData.meta.page >=
                        displayVehiclesData.meta.pageCount - 2
                      ) {
                        pageNum = displayVehiclesData.meta.pageCount - 5 + i;
                    } else {
                        pageNum = displayVehiclesData.meta.page - 3 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                          variant={
                            displayVehiclesData.meta.page === pageNum
                              ? 'default'
                              : 'outline'
                          }
                        size='sm'
                        onClick={() => setCurrentPage(pageNum)}
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
                    onClick={() => setCurrentPage((prev) => prev + 1)}
                  disabled={!displayVehiclesData.meta.hasNextPage}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Last page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(displayVehiclesData.meta.pageCount)}
                    disabled={
                      !displayVehiclesData.meta.hasNextPage ||
                      displayVehiclesData.meta.page === displayVehiclesData.meta.pageCount
                    }
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronsRight className='w-3 h-3 sm:w-4 sm:h-4' />
                </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Onboarding Form */}
      <VehicleOnboardingForm
        isOpen={isOnboardFormOpen}
        onClose={() => {
          setIsOnboardFormOpen(false);
        }}
        onSubmit={handleOnboardVehicle}
        editingVehicle={null}
      />

      {/* Edit Vehicle Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) {
          setViewingVehicle(null);
          setShowCustomVehicleTypeInput(false);
          setCustomVehicleTypeName('');
          setErrors({});
        }
      }}>
        <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='pb-2'>
            <DialogTitle className='flex items-center gap-2 text-lg'>
              <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
                <Truck className='w-4 h-4 text-primary' />
              </div>
              Edit Vehicle - {viewingVehicle?.vehicleRegistrationNumber}
            </DialogTitle>
          </DialogHeader>
          
          {viewingVehicle && (
            <form onSubmit={handleUpdateVehicle} className='space-y-4'>
              {/* Single Card for all form content */}
              <Card className='border-0 shadow-sm'>
                <CardContent className='space-y-4'>
              {/* Vehicle Information */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                    Vehicle Information
                    </h4>

                    {/* First Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='vehicleRegistrationNumber' className='text-xs font-medium'>
                          Registration Number *
                        </Label>
                        <Input
                          id='vehicleRegistrationNumber'
                          placeholder='e.g., MH-12-AB-1234'
                          value={viewingVehicle.vehicleRegistrationNumber}
                          onChange={(e) => handleInputChange('vehicleRegistrationNumber', e.target.value.toUpperCase())}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                        {errors.vehicleRegistrationNumber && (
                          <p className='text-destructive text-xs mt-1'>
                            {errors.vehicleRegistrationNumber}
                          </p>
                        )}
                    </div>

                      <div className='space-y-1'>
                        <Label htmlFor='vehicleMake' className='text-xs font-medium'>
                          Make *
                        </Label>
                        <Input
                          id='vehicleMake'
                          placeholder='e.g., Tata, Ashok Leyland'
                          value={viewingVehicle.vehicleMake}
                          onChange={(e) => handleInputChange('vehicleMake', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                        {errors.vehicleMake && (
                          <p className='text-destructive text-xs mt-1'>
                            {errors.vehicleMake}
                          </p>
                        )}
                    </div>
                    </div>

                    {/* Second Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='vehicleModel' className='text-xs font-medium'>
                          Model *
                        </Label>
                        <Input
                          id='vehicleModel'
                          placeholder='e.g., Ace, 407'
                          value={viewingVehicle.vehicleModel}
                          onChange={(e) => handleInputChange('vehicleModel', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                        {errors.vehicleModel && (
                          <p className='text-destructive text-xs mt-1'>
                            {errors.vehicleModel}
                          </p>
                        )}
                    </div>

                      <div className='space-y-1'>
                        <Label htmlFor='vehicleType' className='text-xs font-medium'>
                          Vehicle Type *
                        </Label>
                        <Select
                          value={viewingVehicle.vehicleType}
                          onValueChange={handleVehicleTypeChange}
                        >
                          <SelectTrigger className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'>
                            <SelectValue placeholder='Select vehicle type' />
                          </SelectTrigger>
                          <SelectContent>
                            {vehicleTypes.map((vt) => (
                              <SelectItem key={vt.id || vt.name} value={vt.name}>
                                {vt.name}
                              </SelectItem>
                            ))}
                            {vehicleTypes.length === 0 && (
                              <>
                                <SelectItem value='Truck'>Truck</SelectItem>
                                <SelectItem value='Pickup'>Pickup</SelectItem>
                                <SelectItem value='Car'>Car</SelectItem>
                                <SelectItem value='Van'>Van</SelectItem>
                                <SelectItem value='Bus'>Bus</SelectItem>
                                <SelectItem value='Tractor'>Tractor</SelectItem>
                                <SelectItem value='Lorry'>Lorry</SelectItem>
                                <SelectItem value='Container'>Container</SelectItem>
                                <SelectItem value='Trailer'>Trailer</SelectItem>
                                <SelectItem value='Tanker'>Tanker</SelectItem>
                                <SelectItem value='Other'>Other</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {errors.vehicleType && (
                          <p className='text-destructive text-xs mt-1'>
                            {errors.vehicleType}
                          </p>
                        )}
                    </div>
                    </div>

                    {/* Custom Vehicle Type Input */}
                    {showCustomVehicleTypeInput && (
                      <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2'>
                        <Label className='text-xs font-medium text-blue-800'>
                          Add New Vehicle Type
                        </Label>
                        <div className='flex gap-2'>
                          <Input
                            placeholder='Enter vehicle type name'
                            value={customVehicleTypeName}
                            onChange={(e) => setCustomVehicleTypeName(e.target.value)}
                            className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                          />
                          <Button
                            type='button'
                            onClick={handleCreateVehicleType}
                            size='sm'
                            className='h-8 px-3 bg-blue-600 hover:bg-blue-700'
                          >
                            <Plus className='w-3 h-3 mr-1' />
                            Add
                          </Button>
                          <Button
                            type='button'
                            onClick={() => {
                              setShowCustomVehicleTypeInput(false);
                              setCustomVehicleTypeName('');
                              handleInputChange('vehicleType', 'Other');
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

                    {/* Third Row */}
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='fuelType' className='text-xs font-medium'>
                          Fuel Type *
                        </Label>
                        <Select
                          value={viewingVehicle.fuelType}
                          onValueChange={(value) => handleInputChange('fuelType', value)}
                        >
                          <SelectTrigger className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'>
                            <SelectValue placeholder='Select fuel type' />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='Petrol'>Petrol</SelectItem>
                            <SelectItem value='Diesel'>Diesel</SelectItem>
                            <SelectItem value='CNG'>CNG</SelectItem>
                            <SelectItem value='Electric'>Electric</SelectItem>
                            <SelectItem value='Hybrid'>Hybrid</SelectItem>
                            <SelectItem value='Other'>Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.fuelType && (
                          <p className='text-destructive text-xs mt-1'>
                            {errors.fuelType}
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
                              onClick={() => handleInputChange('status', status.value)}
                              className={`h-7 px-2 py-1 rounded-[5px] border text-left transition-all duration-200 text-xs font-medium ${
                                viewingVehicle.status === status.value
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
                  </div>

                  {/* Vehicle Specifications */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Vehicle Specifications
                    </h4>

                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='vehicleYear' className='text-xs font-medium'>
                          Year
                        </Label>
                        <Input
                          id='vehicleYear'
                          type='number'
                          placeholder='e.g., 2023'
                          value={viewingVehicle.vehicleYear}
                          onChange={(e) => handleInputChange('vehicleYear', e.target.value)}
                          min='1900'
                          max='2030'
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                      </div>

                      <div className='space-y-1'>
                        <Label htmlFor='engineNumber' className='text-xs font-medium'>
                          Engine Number
                        </Label>
                        <Input
                          id='engineNumber'
                          placeholder='Engine number'
                          value={viewingVehicle.engineNumber}
                          onChange={(e) => handleInputChange('engineNumber', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                      </div>

                      <div className='space-y-1'>
                        <Label htmlFor='chassisNumber' className='text-xs font-medium'>
                          Chassis Number
                        </Label>
                        <Input
                          id='chassisNumber'
                          placeholder='Chassis number'
                          value={viewingVehicle.chassisNumber}
                          onChange={(e) => handleInputChange('chassisNumber', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                      </div>

                      <div className='space-y-1'>
                        <Label htmlFor='loadCapacity' className='text-xs font-medium'>
                          Load Capacity (MT)
                        </Label>
                        <Input
                          id='loadCapacity'
                          type='number'
                          placeholder='e.g., 10'
                          value={viewingVehicle.loadCapacity}
                          onChange={(e) => handleInputChange('loadCapacity', e.target.value)}
                          min='0'
                          step='0.1'
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                      </div>
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='purchaseDate' className='text-xs font-medium'>
                          Purchase Date
                        </Label>
                        <Input
                          id='purchaseDate'
                          type='date'
                          value={stringToDateInputFormat(viewingVehicle.purchaseDate)}
                          onChange={(e) => handleInputChange('purchaseDate', dateInputFormatToString(e.target.value))}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                      </div>
                    </div>
                  </div>

              {/* Insurance Information */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                    Insurance Information
                    </h4>

                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      <div className='space-y-1'>
                        <Label htmlFor='insuranceProvider' className='text-xs font-medium'>
                          Insurance Provider
                        </Label>
                        <Input
                          id='insuranceProvider'
                          placeholder='e.g., ICICI Lombard, Bajaj Allianz'
                          value={viewingVehicle.insuranceProvider}
                          onChange={(e) => handleInputChange('insuranceProvider', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                    </div>

                      <div className='space-y-1'>
                        <Label htmlFor='insurancePolicyNumber' className='text-xs font-medium'>
                          Policy Number
                        </Label>
                        <Input
                          id='insurancePolicyNumber'
                          placeholder='Policy number'
                          value={viewingVehicle.insurancePolicyNumber}
                          onChange={(e) => handleInputChange('insurancePolicyNumber', e.target.value)}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                    </div>

                      <div className='space-y-1'>
                        <Label htmlFor='insuranceExpiryDate' className='text-xs font-medium'>
                          Expiry Date
                        </Label>
                        <Input
                          id='insuranceExpiryDate'
                          type='date'
                          value={stringToDateInputFormat(viewingVehicle.insuranceExpiryDate)}
                          onChange={(e) => handleInputChange('insuranceExpiryDate', dateInputFormatToString(e.target.value))}
                          className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                        />
                    </div>
                  </div>
                  </div>

                  {/* Additional Information */}
                  <div className='space-y-3'>
                   
                    <div className='space-y-1'>
                      <Label htmlFor='additionalNotes' className='text-xs font-medium'>
                      Additional Notes
                      </Label>
                      <Textarea
                        id='additionalNotes'
                        placeholder='Any additional information about the vehicle...'
                        value={viewingVehicle.additionalNotes}
                        onChange={(e) => handleInputChange('additionalNotes', e.target.value)}
                        className='min-h-[40px] px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs resize-none transition-all duration-200'
                      />
                    </div>

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Updated By</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-center font-semibold text-xs border border-input rounded-[5px] flex items-center justify-center'>
                          {currentUser?.name || 'Current User'}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Date</Label>
                        <div className='h-8 px-2 py-1 bg-secondary text-center font-semibold text-xs border border-input rounded-[5px] flex items-center justify-center'>
                          {formatDateToString(new Date())}
                        </div>
                      </div>
                    </div>
                  </div>
                  </CardContent>
                </Card>

              {/* Form Actions */}
              <div className='flex justify-end gap-3 pt-4 border-t'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setIsViewDialogOpen(false)}
                  className='h-8 px-4'
                  disabled={isSubmitting}
                >
                  <X className='w-3 h-3 mr-1' />
                  Cancel
                </Button>
                <Button
                  type='submit'
                  className='h-8 px-4 bg-primary hover:bg-primary/90'
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className='w-3 h-3 mr-1' />
                      Update Vehicle
                    </>
                  )}
                </Button>
            </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};