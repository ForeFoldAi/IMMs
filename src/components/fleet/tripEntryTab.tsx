import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Truck,
  User,
  Navigation,
  IndianRupee,
  Calendar,
  Filter,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Package,
  Fuel,
  Route,
  FileText,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '../../hooks/use-toast';
import { useRole } from '../../contexts/RoleContext';
import { TripEntryForm, TripEntryData } from './TripEntryForm';
import { VehicleData } from './vehicleTab';

export interface TripData extends TripEntryData {
  id: string;
  createdAt: string;
  updatedAt: string;
  actualDuration?: string;
  fuelEfficiency?: number;
  costPerKm?: number;
}

export const TripEntryTab = () => {
  const { currentUser, hasPermission } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [trips, setTrips] = useState<TripData[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<TripData[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Array<{ id: string; registrationNumber: string; driverName: string; driverId: string }>>([]);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTripType, setFilterTripType] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Form states
  const [isTripFormOpen, setIsTripFormOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripData | null>(null);
  const [viewingTrip, setViewingTrip] = useState<TripData | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Mock data - Replace with actual API calls
  const mockTrips: TripData[] = [
    {
      id: '1',
      tripNumber: 'TRIP-1703123456789',
      vehicleId: '1',
      vehicleRegistrationNumber: 'MH-12-AB-1234',
      driverId: '1',
      driverName: 'Rajesh Kumar',
      tripType: 'delivery',
      tripPurpose: 'Material delivery to construction site',
      startLocation: 'Mumbai Warehouse',
      endLocation: 'Pune Construction Site',
      startTime: '2023-12-21T06:00:00',
      endTime: '2023-12-21T14:30:00',
      estimatedDuration: '8',
      actualDuration: '8.5',
      distance: '150',
      fuelConsumed: '25',
      fuelCost: '2000',
      tollCharges: '300',
      otherExpenses: '100',
      totalCost: '2400',
      loadWeight: '8000',
      loadDescription: 'Construction materials - Cement bags, Steel rods',
      customerName: 'ABC Construction Ltd',
      customerContact: '+91 9876543210',
      customerAddress: 'Pune Industrial Area, Maharashtra',
      tripStatus: 'completed',
      notes: 'Smooth delivery, customer satisfied',
      issues: '',
      createdAt: '2023-12-21T05:30:00Z',
      updatedAt: '2023-12-21T14:30:00Z',
      fuelEfficiency: 6.0,
      costPerKm: 16.0,
    },
    {
      id: '2',
      tripNumber: 'TRIP-1703123456790',
      vehicleId: '2',
      vehicleRegistrationNumber: 'MH-12-CD-5678',
      driverId: '2',
      driverName: 'Suresh Patel',
      tripType: 'pickup',
      tripPurpose: 'Equipment pickup from supplier',
      startLocation: 'Pune Industrial Area',
      endLocation: 'Mumbai Warehouse',
      startTime: '2023-12-21T09:00:00',
      endTime: '',
      estimatedDuration: '6',
      actualDuration: '',
      distance: '150',
      fuelConsumed: '',
      fuelCost: '',
      tollCharges: '',
      otherExpenses: '',
      totalCost: '',
      loadWeight: '5000',
      loadDescription: 'Machinery parts and equipment',
      customerName: 'XYZ Suppliers',
      customerContact: '+91 8765432109',
      customerAddress: 'Pune Industrial Area, Maharashtra',
      tripStatus: 'in_progress',
      notes: 'On route to pickup location',
      issues: '',
      createdAt: '2023-12-21T08:30:00Z',
      updatedAt: '2023-12-21T08:30:00Z',
    },
    {
      id: '3',
      tripNumber: 'TRIP-1703123456791',
      vehicleId: '1',
      vehicleRegistrationNumber: 'MH-12-AB-1234',
      driverId: '1',
      driverName: 'Rajesh Kumar',
      tripType: 'round_trip',
      tripPurpose: 'Scheduled maintenance run',
      startLocation: 'Mumbai Warehouse',
      endLocation: 'Mumbai Warehouse',
      startTime: '2023-12-22T10:00:00',
      endTime: '2023-12-22T16:00:00',
      estimatedDuration: '6',
      actualDuration: '6',
      distance: '80',
      fuelConsumed: '12',
      fuelCost: '960',
      tollCharges: '0',
      otherExpenses: '200',
      totalCost: '1160',
      loadWeight: '0',
      loadDescription: 'Maintenance equipment and tools',
      customerName: 'Internal Maintenance',
      customerContact: 'Internal',
      customerAddress: 'Mumbai Warehouse',
      tripStatus: 'completed',
      notes: 'Routine maintenance completed successfully',
      issues: 'Minor brake adjustment required',
      createdAt: '2023-12-22T09:30:00Z',
      updatedAt: '2023-12-22T16:00:00Z',
      fuelEfficiency: 6.7,
      costPerKm: 14.5,
    },
    {
      id: '4',
      tripNumber: 'TRIP-1703123456792',
      vehicleId: '1',
      vehicleRegistrationNumber: 'MH-12-AB-1234',
      driverId: '1',
      driverName: 'Rajesh Kumar',
      tripType: 'delivery',
      tripPurpose: 'Material delivery to site',
      startLocation: 'Mumbai Warehouse',
      endLocation: 'Delhi Construction Site',
      startTime: '2023-12-23T07:00:00',
      endTime: '2023-12-23T18:00:00',
      estimatedDuration: '11',
      actualDuration: '11',
      distance: '280',
      fuelConsumed: '35',
      fuelCost: '2800',
      tollCharges: '500',
      otherExpenses: '200',
      totalCost: '3500',
      loadWeight: '12000',
      loadDescription: 'Heavy construction materials',
      customerName: 'Delhi Builders Ltd',
      customerContact: '+91 9876543211',
      customerAddress: 'Delhi Industrial Area',
      tripStatus: 'completed',
      notes: 'Delivery completed on time',
      issues: '',
      createdAt: '2023-12-23T06:30:00Z',
      updatedAt: '2023-12-23T18:00:00Z',
      fuelEfficiency: 8.0,
      costPerKm: 12.5,
    },
    {
      id: '5',
      tripNumber: 'TRIP-1703123456793',
      vehicleId: '2',
      vehicleRegistrationNumber: 'MH-12-CD-5678',
      driverId: '2',
      driverName: 'Suresh Patel',
      tripType: 'pickup',
      tripPurpose: 'Equipment return',
      startLocation: 'Delhi Industrial Area',
      endLocation: 'Mumbai Warehouse',
      startTime: '2023-12-24T08:00:00',
      endTime: '',
      estimatedDuration: '12',
      actualDuration: '',
      distance: '280',
      fuelConsumed: '',
      fuelCost: '',
      tollCharges: '',
      otherExpenses: '',
      totalCost: '',
      loadWeight: '8000',
      loadDescription: 'Return equipment',
      customerName: 'Delhi Builders Ltd',
      customerContact: '+91 9876543211',
      customerAddress: 'Delhi Industrial Area',
      tripStatus: 'in_progress',
      notes: 'Return journey in progress',
      issues: '',
      createdAt: '2023-12-24T07:30:00Z',
      updatedAt: '2023-12-24T07:30:00Z',
    },
  ];

  const mockVehicles: Array<{ id: string; registrationNumber: string; driverName: string; driverId: string }> = [
    { id: '1', registrationNumber: 'MH-12-AB-1234', driverName: 'Rajesh Kumar', driverId: '1' },
    { id: '2', registrationNumber: 'MH-12-CD-5678', driverName: 'Suresh Patel', driverId: '2' },
  ];

  // Fetch trips and vehicles data
  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTrips(mockTrips);
      setAvailableVehicles(mockVehicles);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trips. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Filter and search trips
  useEffect(() => {
    let filtered = trips;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(trip =>
        trip.tripNumber.toLowerCase().includes(searchLower) ||
        trip.vehicleRegistrationNumber.toLowerCase().includes(searchLower) ||
        trip.driverName.toLowerCase().includes(searchLower) ||
        trip.customerName.toLowerCase().includes(searchLower) ||
        trip.startLocation.toLowerCase().includes(searchLower) ||
        trip.endLocation.toLowerCase().includes(searchLower) ||
        trip.tripPurpose.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(trip => trip.tripStatus === filterStatus);
    }

    // Apply trip type filter
    if (filterTripType !== 'all') {
      filtered = filtered.filter(trip => trip.tripType === filterTripType);
    }

    // Apply vehicle filter
    if (filterVehicle !== 'all') {
      filtered = filtered.filter(trip => trip.vehicleId === filterVehicle);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof TripData];
      let bValue: any = b[sortBy as keyof TripData];

      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'startTime' || sortBy === 'endTime') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      } else if (typeof aValue === 'number') {
        aValue = aValue;
        bValue = bValue;
      }

      if (sortOrder === 'ASC') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredTrips(filtered);
    
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [trips, searchTerm, filterStatus, filterTripType, filterVehicle, sortBy, sortOrder]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredTrips.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTrips = filteredTrips.slice(startIndex, endIndex);

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
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className='w-4 h-4' />;
      case 'in_progress':
        return <Navigation className='w-4 h-4' />;
      case 'completed':
        return <CheckCircle className='w-4 h-4' />;
      case 'cancelled':
        return <XCircle className='w-4 h-4' />;
      default:
        return <AlertTriangle className='w-4 h-4' />;
    }
  };

  const getTripTypeColor = (type: string) => {
    switch (type) {
      case 'pickup':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivery':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'round_trip':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'maintenance':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'other':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const toggleRowExpansion = (tripId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(tripId)) {
      newExpandedRows.delete(tripId);
    } else {
      newExpandedRows.add(tripId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleCreateTrip = (tripData: TripEntryData) => {
    const newTrip: TripData = {
      ...tripData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fuelEfficiency: tripData.fuelConsumed && tripData.distance ? 
        parseFloat(tripData.distance) / parseFloat(tripData.fuelConsumed) : 0,
      costPerKm: tripData.totalCost && tripData.distance ? 
        parseFloat(tripData.totalCost) / parseFloat(tripData.distance) : 0,
    };
    
    setTrips(prev => [newTrip, ...prev]);
    setIsTripFormOpen(false);
    
    toast({
      title: '✅ Trip Created Successfully!',
      description: `Trip ${tripData.tripNumber} has been created and added to the system.`,
      variant: 'default',
    });
  };

  const handleEditTrip = (trip: TripData) => {
    setEditingTrip(trip);
    setIsTripFormOpen(true);
  };

  const handleViewTrip = (trip: TripData) => {
    setViewingTrip(trip);
    setIsViewDialogOpen(true);
  };

  const handleDeleteTrip = async (tripId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this trip? This action cannot be undone.');
    if (confirmed) {
      try {
        setTrips(prev => prev.filter(t => t.id !== tripId));
        toast({
          title: '✅ Trip Deleted',
          description: 'Trip has been successfully removed from the system.',
          variant: 'default',
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to delete trip. Please try again.',
          variant: 'destructive',
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB');
  };

  const calculateDuration = (startTime: string, endTime?: string) => {
    if (!endTime) return 'Ongoing';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60) * 10) / 10;
    return `${diffHours}h`;
  };

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
                    placeholder='Search trips...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-10'
                  />
                </div>
              </div>
              <Button
                variant='outline'
                onClick={fetchTrips}
                disabled={isLoading}
                size='sm'
                className='gap-1 text-xs'
              >
                <RefreshCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                Ref
              </Button>
              <Button
                onClick={() => {
                  setEditingTrip(null);
                  setIsTripFormOpen(true);
                }}
                size='sm'
                className='gap-1 text-xs'
                disabled={!hasPermission('inventory:material-indents:create')}
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
                    <SelectItem value='scheduled'>Scheduled</SelectItem>
                    <SelectItem value='in_progress'>In Progress</SelectItem>
                    <SelectItem value='completed'>Completed</SelectItem>
                    <SelectItem value='cancelled'>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex-1'>
                <Select value={filterTripType} onValueChange={setFilterTripType}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Trip Type' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Types</SelectItem>
                    <SelectItem value='pickup'>Pickup</SelectItem>
                    <SelectItem value='delivery'>Delivery</SelectItem>
                    <SelectItem value='round_trip'>Round Trip</SelectItem>
                    <SelectItem value='maintenance'>Maintenance</SelectItem>
                    <SelectItem value='other'>Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className='flex-1'>
                <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                  <SelectTrigger className='text-sm'>
                    <SelectValue placeholder='Vehicle' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>All Vehicles</SelectItem>
                    {availableVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.registrationNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className='hidden sm:flex xl:flex-row gap-3 sm:gap-4'>
            {/* Search */}
            <div className='flex-1 min-w-0'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
                <Input
                  placeholder='Search trips...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className='w-full xl:w-40'>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className='text-sm'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Status</SelectItem>
                  <SelectItem value='scheduled'>Scheduled</SelectItem>
                  <SelectItem value='in_progress'>In Progress</SelectItem>
                  <SelectItem value='completed'>Completed</SelectItem>
                  <SelectItem value='cancelled'>Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Trip Type Filter */}
            <div className='w-full xl:w-40'>
              <Select value={filterTripType} onValueChange={setFilterTripType}>
                <SelectTrigger className='text-sm'>
                  <SelectValue placeholder='Trip Type' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Types</SelectItem>
                  <SelectItem value='pickup'>Pickup</SelectItem>
                  <SelectItem value='delivery'>Delivery</SelectItem>
                  <SelectItem value='round_trip'>Round Trip</SelectItem>
                  <SelectItem value='maintenance'>Maintenance</SelectItem>
                  <SelectItem value='other'>Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Vehicle Filter */}
            <div className='w-full xl:w-40'>
              <Select value={filterVehicle} onValueChange={setFilterVehicle}>
                <SelectTrigger className='text-sm'>
                  <SelectValue placeholder='Vehicle' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>All Vehicles</SelectItem>
                  {availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.registrationNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className='flex gap-2'>
              <Button
                variant='outline'
                onClick={fetchTrips}
                disabled={isLoading}
                size='sm'
                className='gap-2 text-sm'
              >
                <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              
              <Button
                onClick={() => {
                  setEditingTrip(null);
                  setIsTripFormOpen(true);
                }}
                size='sm'
                className='gap-2 text-sm'
                disabled={!hasPermission('inventory:material-indents:create')}
              >
                <Plus className='w-4 h-4' />
                Add Trip
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trips Table */}
      <Card>
        <CardContent className='p-0'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='text-center'>
                <RefreshCcw className='w-8 h-8 animate-spin text-primary mx-auto mb-4' />
                <p className='text-muted-foreground'>Loading trips...</p>
              </div>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className='text-center py-12'>
              <MapPin className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-semibold mb-2'>No Trips Found</h3>
              <p className='text-muted-foreground mb-4'>
                {searchTerm || filterStatus !== 'all' || filterTripType !== 'all' || filterVehicle !== 'all'
                  ? 'No trips match your current filters.'
                  : 'Get started by creating your first trip.'}
              </p>
              {(!searchTerm && filterStatus === 'all' && filterTripType === 'all' && filterVehicle === 'all') && (
                <Button
                  onClick={() => setIsTripFormOpen(true)}
                  className='gap-2'
                >
                  <Plus className='w-4 h-4' />
                  Create First Trip
                </Button>
              )}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-secondary/20'>
                    <TableHead className='w-12'></TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('tripNumber')}
                    >
                      <div className='flex items-center gap-2'>
                        Trip Number
                        {getSortIcon('tripNumber')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('vehicleRegistrationNumber')}
                    >
                      <div className='flex items-center gap-2'>
                        Vehicle & Driver
                        {getSortIcon('vehicleRegistrationNumber')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('tripType')}
                    >
                      <div className='flex items-center gap-2'>
                        Trip Type
                        {getSortIcon('tripType')}
                      </div>
                    </TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('startTime')}
                    >
                      <div className='flex items-center gap-2'>
                        Schedule
                        {getSortIcon('startTime')}
                      </div>
                    </TableHead>
                    <TableHead 
                      className='cursor-pointer hover:bg-secondary/30'
                      onClick={() => handleSort('tripStatus')}
                    >
                      <div className='flex items-center gap-2'>
                        Status
                        {getSortIcon('tripStatus')}
                      </div>
                    </TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead className='w-12'></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrips.map((trip) => (
                    <>
                      <TableRow key={trip.id} className='hover:bg-muted/30'>
                        <TableCell>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 w-6 p-0'
                            onClick={() => toggleRowExpansion(trip.id)}
                          >
                            {expandedRows.has(trip.id) ? (
                              <ChevronUp className='w-4 h-4' />
                            ) : (
                              <ChevronDown className='w-4 h-4' />
                            )}
                          </Button>
                        </TableCell>
                        
                        <TableCell className='font-medium'>
                          <div className='flex flex-col'>
                            <span className='font-semibold text-sm'>{trip.tripNumber}</span>
                            <span className='text-xs text-muted-foreground'>
                              {formatDate(trip.createdAt)}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col'>
                            <span className='font-medium text-sm'>{trip.vehicleRegistrationNumber}</span>
                            <span className='text-xs text-muted-foreground'>
                              {trip.driverName}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={`${getTripTypeColor(trip.tripType)} border text-xs`}>
                            {trip.tripType.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{trip.startLocation}</span>
                            <span className='text-xs text-muted-foreground'>→ {trip.endLocation}</span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            <span className='font-medium'>{formatDateTime(trip.startTime)}</span>
                            <span className='text-xs text-muted-foreground'>
                              Duration: {calculateDuration(trip.startTime, trip.endTime)}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <Badge className={`${getStatusColor(trip.tripStatus)} border flex items-center gap-1 w-fit`}>
                            {getStatusIcon(trip.tripStatus)}
                            <span className='text-xs'>{trip.tripStatus.replace('_', ' ').toUpperCase()}</span>
                          </Badge>
                        </TableCell>
                        
                        <TableCell>
                          <div className='flex flex-col text-sm'>
                            {trip.totalCost ? (
                              <>
                                <span className='font-medium'>₹{parseFloat(trip.totalCost).toLocaleString()}</span>
                                <span className='text-xs text-muted-foreground'>
                                  {trip.costPerKm ? `₹${trip.costPerKm.toFixed(1)}/km` : ''}
                                </span>
                              </>
                            ) : (
                              <span className='text-muted-foreground'>Pending</span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                                <MoreVertical className='w-4 h-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem onClick={() => handleViewTrip(trip)}>
                                <Eye className='w-4 h-4 mr-2' />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditTrip(trip)}>
                                <Edit className='w-4 h-4 mr-2' />
                                Edit Trip
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteTrip(trip.id)}
                                className='text-destructive'
                              >
                                <Trash2 className='w-4 h-4 mr-2' />
                                Delete Trip
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row Details */}
                      {expandedRows.has(trip.id) && (
                        <TableRow>
                          <TableCell colSpan={9} className='p-0'>
                            <div className='bg-muted/20 p-4'>
                              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                                <div>
                                  <h4 className='font-semibold mb-2'>Trip Details</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p><span className='font-medium'>Purpose:</span> {trip.tripPurpose}</p>
                                    <p><span className='font-medium'>Distance:</span> {trip.distance} km</p>
                                    <p><span className='font-medium'>Load Weight:</span> {trip.loadWeight} kg</p>
                                    {trip.fuelEfficiency && (
                                      <p><span className='font-medium'>Fuel Efficiency:</span> {trip.fuelEfficiency.toFixed(1)} km/l</p>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className='font-semibold mb-2'>Customer Details</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p><span className='font-medium'>Name:</span> {trip.customerName}</p>
                                    <p><span className='font-medium'>Contact:</span> {trip.customerContact}</p>
                                    <p><span className='font-medium'>Address:</span> {trip.customerAddress}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className='font-semibold mb-2'>Cost Breakdown</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p><span className='font-medium'>Fuel:</span> {trip.fuelCost ? `₹${trip.fuelCost}` : 'Pending'}</p>
                                    <p><span className='font-medium'>Toll:</span> {trip.tollCharges ? `₹${trip.tollCharges}` : 'N/A'}</p>
                                    <p><span className='font-medium'>Other:</span> {trip.otherExpenses ? `₹${trip.otherExpenses}` : 'N/A'}</p>
                                    <p><span className='font-medium'>Total:</span> {trip.totalCost ? `₹${trip.totalCost}` : 'Pending'}</p>
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className='font-semibold mb-2'>Additional Info</h4>
                                  <div className='space-y-1 text-sm'>
                                    <p><span className='font-medium'>Created:</span> {formatDateTime(trip.createdAt)}</p>
                                    {trip.notes && (
                                      <p><span className='font-medium'>Notes:</span> {trip.notes}</p>
                                    )}
                                    {trip.issues && (
                                      <p><span className='font-medium'>Issues:</span> <span className='text-red-600'>{trip.issues}</span></p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {filteredTrips.length > 0 && (
            <div className='flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4 border-t'>
              <div className='flex flex-col sm:flex-row items-center gap-2'>
                <span className='text-xs sm:text-sm text-muted-foreground'>
                  Showing {startIndex + 1} to {Math.min(endIndex, filteredTrips.length)} of {filteredTrips.length} trips
                </span>
                <div className='flex items-center gap-2'>
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}>
                    <SelectTrigger className='w-16 sm:w-20 text-xs'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='5'>5</SelectItem>
                      <SelectItem value='10'>10</SelectItem>
                      <SelectItem value='25'>25</SelectItem>
                      <SelectItem value='50'>50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className='text-xs text-muted-foreground'>per page</span>
                </div>
              </div>
              
              <div className='flex items-center gap-1 sm:gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className='text-xs px-2 sm:px-3'
                >
                  <span className='hidden sm:inline'>Previous</span>
                  <span className='sm:hidden'>Prev</span>
                </Button>
                
                <div className='flex items-center gap-1'>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size='sm'
                        onClick={() => setCurrentPage(pageNum)}
                        className='w-6 h-6 sm:w-8 sm:h-8 p-0 text-xs'
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className='text-xs px-2 sm:px-3'
                >
                  <span className='hidden sm:inline'>Next</span>
                  <span className='sm:hidden'>Next</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip Entry Form */}
      <TripEntryForm
        isOpen={isTripFormOpen}
        onClose={() => {
          setIsTripFormOpen(false);
          setEditingTrip(null);
        }}
        onSubmit={handleCreateTrip}
        editingTrip={editingTrip}
        availableVehicles={availableVehicles}
      />

      {/* View Trip Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MapPin className='w-5 h-5' />
              Trip Details - {viewingTrip?.tripNumber}
            </DialogTitle>
            <DialogDescription>
              Complete information about the trip and its progress
            </DialogDescription>
          </DialogHeader>
          
          {viewingTrip && (
            <div className='space-y-6'>
              {/* Trip Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Route className='w-4 h-4' />
                    Trip Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Trip Number</Label>
                      <p className='text-sm font-mono'>{viewingTrip.tripNumber}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Trip Type</Label>
                      <Badge className={`${getTripTypeColor(viewingTrip.tripType)} border`}>
                        {viewingTrip.tripType.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Purpose</Label>
                      <p className='text-sm'>{viewingTrip.tripPurpose}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Status</Label>
                      <Badge className={`${getStatusColor(viewingTrip.tripStatus)} border flex items-center gap-1 w-fit`}>
                        {getStatusIcon(viewingTrip.tripStatus)}
                        <span className='text-xs'>{viewingTrip.tripStatus.replace('_', ' ').toUpperCase()}</span>
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Route Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Navigation className='w-4 h-4' />
                    Route Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Start Location</Label>
                      <p className='text-sm'>{viewingTrip.startLocation}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>End Location</Label>
                      <p className='text-sm'>{viewingTrip.endLocation}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Distance</Label>
                      <p className='text-sm'>{viewingTrip.distance} km</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Estimated Duration</Label>
                      <p className='text-sm'>{viewingTrip.estimatedDuration} hours</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Start Time</Label>
                      <p className='text-sm'>{formatDateTime(viewingTrip.startTime)}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>End Time</Label>
                      <p className='text-sm'>{viewingTrip.endTime ? formatDateTime(viewingTrip.endTime) : 'Ongoing'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle & Driver Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Truck className='w-4 h-4' />
                    Vehicle & Driver Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Vehicle Registration</Label>
                      <p className='text-sm'>{viewingTrip.vehicleRegistrationNumber}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Driver Name</Label>
                      <p className='text-sm'>{viewingTrip.driverName}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <User className='w-4 h-4' />
                    Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Customer Name</Label>
                      <p className='text-sm'>{viewingTrip.customerName}</p>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Contact</Label>
                      <p className='text-sm'>{viewingTrip.customerContact}</p>
                    </div>
                    <div className='space-y-2 md:col-span-2'>
                      <Label className='text-sm font-medium'>Address</Label>
                      <p className='text-sm'>{viewingTrip.customerAddress}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Load Information */}
              <Card>
                <CardHeader>
                  <CardTitle className='flex items-center gap-2'>
                    <Package className='w-4 h-4' />
                    Load Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div className='space-y-2'>
                      <Label className='text-sm font-medium'>Load Weight</Label>
                      <p className='text-sm'>{viewingTrip.loadWeight} kg</p>
                    </div>
                    <div className='space-y-2 md:col-span-2'>
                      <Label className='text-sm font-medium'>Load Description</Label>
                      <p className='text-sm'>{viewingTrip.loadDescription}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Information */}
              {(viewingTrip.fuelCost || viewingTrip.tollCharges || viewingTrip.otherExpenses) && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <IndianRupee className='w-4 h-4' />
                      Cost Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Fuel Consumed</Label>
                        <p className='text-sm'>{viewingTrip.fuelConsumed ? `${viewingTrip.fuelConsumed} liters` : 'N/A'}</p>
                      </div>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Fuel Cost</Label>
                        <p className='text-sm'>{viewingTrip.fuelCost ? `₹${viewingTrip.fuelCost}` : 'N/A'}</p>
                      </div>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Toll Charges</Label>
                        <p className='text-sm'>{viewingTrip.tollCharges ? `₹${viewingTrip.tollCharges}` : 'N/A'}</p>
                      </div>
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Other Expenses</Label>
                        <p className='text-sm'>{viewingTrip.otherExpenses ? `₹${viewingTrip.otherExpenses}` : 'N/A'}</p>
                      </div>
                      <div className='space-y-2 md:col-span-2 lg:col-span-4'>
                        <Label className='text-sm font-medium'>Total Cost</Label>
                        <p className='text-lg font-semibold'>{viewingTrip.totalCost ? `₹${parseFloat(viewingTrip.totalCost).toLocaleString()}` : 'Pending'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Additional Information */}
              {(viewingTrip.notes || viewingTrip.issues) && (
                <Card>
                  <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                      <FileText className='w-4 h-4' />
                      Additional Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-4'>
                    {viewingTrip.notes && (
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Trip Notes</Label>
                        <p className='text-sm'>{viewingTrip.notes}</p>
                      </div>
                    )}
                    {viewingTrip.issues && (
                      <div className='space-y-2'>
                        <Label className='text-sm font-medium'>Issues/Problems</Label>
                        <p className='text-sm text-red-600'>{viewingTrip.issues}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
