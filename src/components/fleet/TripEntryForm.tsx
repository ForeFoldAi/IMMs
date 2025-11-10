import { useState, useEffect } from 'react';
import {
  MapPin,
  Save,
  X,
  User,
  Calendar,
  Clock,
  Fuel,
  Package,
  Route,
  Loader2,
  Truck,
  Navigation,
  IndianRupee,
  FileText,
} from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { toast } from '../../hooks/use-toast';
import { useRole } from '../../contexts/RoleContext';

export interface TripEntryData {
  id?: string;
  tripNumber: string;
  vehicleId: string;
  vehicleRegistrationNumber: string;
  driverId: string;
  driverName: string;
  tripType: 'pickup' | 'delivery' | 'round_trip' | 'maintenance' | 'other';
  tripPurpose: string;
  startLocation: string;
  endLocation: string;
  startTime: string;
  endTime?: string;
  estimatedDuration: string;
  actualDuration?: string;
  distance: string;
  fuelConsumed: string;
  fuelCost: string;
  tollCharges: string;
  otherExpenses: string;
  totalCost: string;
  loadWeight: string;
  loadDescription: string;
  customerName: string;
  customerContact: string;
  customerAddress: string;
  tripStatus: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  notes: string;
  issues: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TripEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tripData: TripEntryData) => void;
  editingTrip?: TripEntryData | null;
  availableVehicles?: Array<{ id: string; registrationNumber: string; driverName: string; driverId: string }>;
}

export const TripEntryForm = ({
  isOpen,
  onClose,
  onSubmit,
  editingTrip,
  availableVehicles = [],
}: TripEntryFormProps) => {
  const { currentUser } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<TripEntryData>({
    tripNumber: '',
    vehicleId: '',
    vehicleRegistrationNumber: '',
    driverId: '',
    driverName: '',
    tripType: 'pickup',
    tripPurpose: '',
    startLocation: '',
    endLocation: '',
    startTime: '',
    endTime: '',
    estimatedDuration: '',
    actualDuration: '',
    distance: '',
    fuelConsumed: '',
    fuelCost: '',
    tollCharges: '',
    otherExpenses: '',
    totalCost: '',
    loadWeight: '',
    loadDescription: '',
    customerName: '',
    customerContact: '',
    customerAddress: '',
    tripStatus: 'scheduled',
    notes: '',
    issues: '',
  });

  // Effect to populate form when editing
  useEffect(() => {
    if (editingTrip && isOpen) {
      setFormData(editingTrip);
    } else if (!editingTrip && isOpen) {
      // Reset form for new trip
      setFormData({
        tripNumber: `TRIP-${Date.now()}`,
        vehicleId: '',
        vehicleRegistrationNumber: '',
        driverId: '',
        driverName: '',
        tripType: 'pickup',
        tripPurpose: '',
        startLocation: '',
        endLocation: '',
        startTime: '',
        endTime: '',
        estimatedDuration: '',
        actualDuration: '',
        distance: '',
        fuelConsumed: '',
        fuelCost: '',
        tollCharges: '',
        otherExpenses: '',
        totalCost: '',
        loadWeight: '',
        loadDescription: '',
        customerName: '',
        customerContact: '',
        customerAddress: '',
        tripStatus: 'scheduled',
        notes: '',
        issues: '',
      });
    }
  }, [editingTrip, isOpen]);

  // Auto-fill driver details when vehicle is selected
  useEffect(() => {
    if (formData.vehicleId && availableVehicles.length > 0) {
      const selectedVehicle = availableVehicles.find(v => v.id === formData.vehicleId);
      if (selectedVehicle) {
        setFormData(prev => ({
          ...prev,
          vehicleRegistrationNumber: selectedVehicle.registrationNumber,
          driverId: selectedVehicle.driverId,
          driverName: selectedVehicle.driverName,
        }));
      }
    }
  }, [formData.vehicleId, availableVehicles]);

  const handleInputChange = (field: keyof TripEntryData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Calculate total cost automatically
  useEffect(() => {
    const fuelCost = parseFloat(formData.fuelCost) || 0;
    const tollCharges = parseFloat(formData.tollCharges) || 0;
    const otherExpenses = parseFloat(formData.otherExpenses) || 0;
    const total = fuelCost + tollCharges + otherExpenses;
    
    if (total > 0) {
      setFormData(prev => ({ ...prev, totalCost: total.toString() }));
    }
  }, [formData.fuelCost, formData.tollCharges, formData.otherExpenses]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // Trip Information Validation
    if (!formData.vehicleId.trim()) {
      newErrors.vehicleId = 'Please select a vehicle';
      hasErrors = true;
    }

    if (!formData.tripType.trim()) {
      newErrors.tripType = 'Trip type is required';
      hasErrors = true;
    }

    if (!formData.tripPurpose.trim()) {
      newErrors.tripPurpose = 'Trip purpose is required';
      hasErrors = true;
    }

    if (!formData.startLocation.trim()) {
      newErrors.startLocation = 'Start location is required';
      hasErrors = true;
    }

    if (!formData.endLocation.trim()) {
      newErrors.endLocation = 'End location is required';
      hasErrors = true;
    }

    if (!formData.startTime.trim()) {
      newErrors.startTime = 'Start time is required';
      hasErrors = true;
    }

    if (!formData.estimatedDuration.trim()) {
      newErrors.estimatedDuration = 'Estimated duration is required';
      hasErrors = true;
    }

    if (!formData.distance.trim()) {
      newErrors.distance = 'Distance is required';
      hasErrors = true;
    }

    // Customer Information Validation
    if (!formData.customerName.trim()) {
      newErrors.customerName = 'Customer name is required';
      hasErrors = true;
    }

    if (!formData.customerContact.trim()) {
      newErrors.customerContact = 'Customer contact is required';
      hasErrors = true;
    }

    // Load Information Validation
    if (!formData.loadWeight.trim()) {
      newErrors.loadWeight = 'Load weight is required';
      hasErrors = true;
    }

    if (!formData.loadDescription.trim()) {
      newErrors.loadDescription = 'Load description is required';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onSubmit(formData);
      
      toast({
        title: '✅ Trip Entry Created Successfully!',
        description: `Trip ${formData.tripNumber} has been successfully created.`,
        variant: 'default',
      });

      // Reset form
      setFormData({
        tripNumber: `TRIP-${Date.now()}`,
        vehicleId: '',
        vehicleRegistrationNumber: '',
        driverId: '',
        driverName: '',
        tripType: 'pickup',
        tripPurpose: '',
        startLocation: '',
        endLocation: '',
        startTime: '',
        endTime: '',
        estimatedDuration: '',
        actualDuration: '',
        distance: '',
        fuelConsumed: '',
        fuelCost: '',
        tollCharges: '',
        otherExpenses: '',
        totalCost: '',
        loadWeight: '',
        loadDescription: '',
        customerName: '',
        customerContact: '',
        customerAddress: '',
        tripStatus: 'scheduled',
        notes: '',
        issues: '',
      });

      setErrors({});
      onClose();
    } catch (error) {
      console.error('Error creating trip entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to create trip entry. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTripStatusColor = (status: string) => {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-[95vw] max-h-[90vh] overflow-y-auto p-6'>
        <DialogHeader className='pb-4'>
          <DialogTitle className='flex items-center gap-2'>
            <div className='w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center'>
              <MapPin className='w-4 h-4 text-primary' />
            </div>
            <div>
              <div className='text-lg font-bold'>
                {editingTrip ? 'EDIT TRIP DETAILS' : 'TRIP ENTRY FORM'}
              </div>
              <div className='text-sm text-muted-foreground'>
                {editingTrip ? 'Update trip information' : 'Create new trip entry'}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* Trip Information */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Route className='w-5 h-5' />
                Trip Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='tripNumber'>Trip Number</Label>
                  <Input
                    id='tripNumber'
                    value={formData.tripNumber}
                    onChange={(e) => handleInputChange('tripNumber', e.target.value)}
                    placeholder='Auto-generated'
                    readOnly
                    className='bg-gray-50'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='vehicleId'>Vehicle *</Label>
                  <Select
                    value={formData.vehicleId}
                    onValueChange={(value) => handleInputChange('vehicleId', value)}
                  >
                    <SelectTrigger className={errors.vehicleId ? 'border-red-500' : ''}>
                      <SelectValue placeholder='Select vehicle' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.registrationNumber} - {vehicle.driverName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicleId && (
                    <p className='text-sm text-red-500'>{errors.vehicleId}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tripType'>Trip Type *</Label>
                  <Select
                    value={formData.tripType}
                    onValueChange={(value: 'pickup' | 'delivery' | 'round_trip' | 'maintenance' | 'other') => 
                      handleInputChange('tripType', value)
                    }
                  >
                    <SelectTrigger className={errors.tripType ? 'border-red-500' : ''}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='pickup'>Pickup</SelectItem>
                      <SelectItem value='delivery'>Delivery</SelectItem>
                      <SelectItem value='round_trip'>Round Trip</SelectItem>
                      <SelectItem value='maintenance'>Maintenance</SelectItem>
                      <SelectItem value='other'>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.tripType && (
                    <p className='text-sm text-red-500'>{errors.tripType}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tripPurpose'>Trip Purpose *</Label>
                  <Input
                    id='tripPurpose'
                    value={formData.tripPurpose}
                    onChange={(e) => handleInputChange('tripPurpose', e.target.value)}
                    placeholder='e.g., Material delivery, Equipment pickup'
                    className={errors.tripPurpose ? 'border-red-500' : ''}
                  />
                  {errors.tripPurpose && (
                    <p className='text-sm text-red-500'>{errors.tripPurpose}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='startLocation'>Start Location *</Label>
                  <Input
                    id='startLocation'
                    value={formData.startLocation}
                    onChange={(e) => handleInputChange('startLocation', e.target.value)}
                    placeholder='Starting point'
                    className={errors.startLocation ? 'border-red-500' : ''}
                  />
                  {errors.startLocation && (
                    <p className='text-sm text-red-500'>{errors.startLocation}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='endLocation'>End Location *</Label>
                  <Input
                    id='endLocation'
                    value={formData.endLocation}
                    onChange={(e) => handleInputChange('endLocation', e.target.value)}
                    placeholder='Destination'
                    className={errors.endLocation ? 'border-red-500' : ''}
                  />
                  {errors.endLocation && (
                    <p className='text-sm text-red-500'>{errors.endLocation}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='startTime'>Start Time *</Label>
                  <Input
                    id='startTime'
                    type='datetime-local'
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className={errors.startTime ? 'border-red-500' : ''}
                  />
                  {errors.startTime && (
                    <p className='text-sm text-red-500'>{errors.startTime}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='endTime'>End Time</Label>
                  <Input
                    id='endTime'
                    type='datetime-local'
                    value={formData.endTime || ''}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='estimatedDuration'>Estimated Duration (hours) *</Label>
                  <Input
                    id='estimatedDuration'
                    type='number'
                    value={formData.estimatedDuration}
                    onChange={(e) => handleInputChange('estimatedDuration', e.target.value)}
                    placeholder='e.g., 8.5'
                    min='0'
                    step='0.1'
                    className={errors.estimatedDuration ? 'border-red-500' : ''}
                  />
                  {errors.estimatedDuration && (
                    <p className='text-sm text-red-500'>{errors.estimatedDuration}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='distance'>Distance (km) *</Label>
                  <Input
                    id='distance'
                    type='number'
                    value={formData.distance}
                    onChange={(e) => handleInputChange('distance', e.target.value)}
                    placeholder='e.g., 250'
                    min='0'
                    step='0.1'
                    className={errors.distance ? 'border-red-500' : ''}
                  />
                  {errors.distance && (
                    <p className='text-sm text-red-500'>{errors.distance}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tripStatus'>Trip Status</Label>
                  <Select
                    value={formData.tripStatus}
                    onValueChange={(value: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') => 
                      handleInputChange('tripStatus', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='scheduled'>Scheduled</SelectItem>
                      <SelectItem value='in_progress'>In Progress</SelectItem>
                      <SelectItem value='completed'>Completed</SelectItem>
                      <SelectItem value='cancelled'>Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <User className='w-5 h-5' />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='customerName'>Customer Name *</Label>
                  <Input
                    id='customerName'
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                    placeholder='Customer name'
                    className={errors.customerName ? 'border-red-500' : ''}
                  />
                  {errors.customerName && (
                    <p className='text-sm text-red-500'>{errors.customerName}</p>
                  )}
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='customerContact'>Customer Contact *</Label>
                  <Input
                    id='customerContact'
                    type='tel'
                    value={formData.customerContact}
                    onChange={(e) => handleInputChange('customerContact', e.target.value)}
                    placeholder='+91 9876543210'
                    className={errors.customerContact ? 'border-red-500' : ''}
                  />
                  {errors.customerContact && (
                    <p className='text-sm text-red-500'>{errors.customerContact}</p>
                  )}
                </div>

                <div className='space-y-2 md:col-span-2 lg:col-span-3'>
                  <Label htmlFor='customerAddress'>Customer Address</Label>
                  <Textarea
                    id='customerAddress'
                    value={formData.customerAddress}
                    onChange={(e) => handleInputChange('customerAddress', e.target.value)}
                    placeholder='Complete customer address'
                    rows={3}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Load Information */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <Package className='w-5 h-5' />
                Load Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='loadWeight'>Load Weight (kg) *</Label>
                  <Input
                    id='loadWeight'
                    type='number'
                    value={formData.loadWeight}
                    onChange={(e) => handleInputChange('loadWeight', e.target.value)}
                    placeholder='e.g., 5000'
                    min='0'
                    step='0.1'
                    className={errors.loadWeight ? 'border-red-500' : ''}
                  />
                  {errors.loadWeight && (
                    <p className='text-sm text-red-500'>{errors.loadWeight}</p>
                  )}
                </div>

                <div className='space-y-2 md:col-span-2'>
                  <Label htmlFor='loadDescription'>Load Description *</Label>
                  <Textarea
                    id='loadDescription'
                    value={formData.loadDescription}
                    onChange={(e) => handleInputChange('loadDescription', e.target.value)}
                    placeholder='Describe the goods being transported...'
                    rows={3}
                    className={errors.loadDescription ? 'border-red-500' : ''}
                  />
                  {errors.loadDescription && (
                    <p className='text-sm text-red-500'>{errors.loadDescription}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Information */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <IndianRupee className='w-5 h-5' />
                Cost Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                <div className='space-y-2'>
                  <Label htmlFor='fuelConsumed'>Fuel Consumed (liters)</Label>
                  <Input
                    id='fuelConsumed'
                    type='number'
                    value={formData.fuelConsumed}
                    onChange={(e) => handleInputChange('fuelConsumed', e.target.value)}
                    placeholder='e.g., 50'
                    min='0'
                    step='0.1'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='fuelCost'>Fuel Cost (₹)</Label>
                  <Input
                    id='fuelCost'
                    type='number'
                    value={formData.fuelCost}
                    onChange={(e) => handleInputChange('fuelCost', e.target.value)}
                    placeholder='e.g., 4000'
                    min='0'
                    step='0.01'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='tollCharges'>Toll Charges (₹)</Label>
                  <Input
                    id='tollCharges'
                    type='number'
                    value={formData.tollCharges}
                    onChange={(e) => handleInputChange('tollCharges', e.target.value)}
                    placeholder='e.g., 500'
                    min='0'
                    step='0.01'
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='otherExpenses'>Other Expenses (₹)</Label>
                  <Input
                    id='otherExpenses'
                    type='number'
                    value={formData.otherExpenses}
                    onChange={(e) => handleInputChange('otherExpenses', e.target.value)}
                    placeholder='e.g., 200'
                    min='0'
                    step='0.01'
                  />
                </div>

                <div className='space-y-2 md:col-span-2 lg:col-span-4'>
                  <Label htmlFor='totalCost'>Total Cost (₹)</Label>
                  <Input
                    id='totalCost'
                    type='number'
                    value={formData.totalCost}
                    readOnly
                    className='bg-gray-50 font-semibold text-lg'
                    placeholder='Auto-calculated'
                  />
                  <p className='text-sm text-muted-foreground'>
                    Automatically calculated from fuel cost, toll charges, and other expenses
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2 text-lg'>
                <FileText className='w-5 h-5' />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-4'>
                <div className='space-y-2'>
                  <Label htmlFor='notes'>Trip Notes</Label>
                  <Textarea
                    id='notes'
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder='Any additional notes about the trip...'
                    rows={3}
                  />
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='issues'>Issues/Problems</Label>
                  <Textarea
                    id='issues'
                    value={formData.issues}
                    onChange={(e) => handleInputChange('issues', e.target.value)}
                    placeholder='Report any issues or problems encountered during the trip...'
                    rows={3}
                  />
                </div>

                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                  <div className='space-y-2'>
                    <Label>Created By</Label>
                    <div className='input-friendly bg-secondary text-center py-2 font-semibold text-sm'>
                      {currentUser?.name || 'Current User'}
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label>Date</Label>
                    <div className='input-friendly bg-secondary text-center py-2 font-semibold text-sm'>
                      {new Date().toLocaleDateString()}
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <Label>Current Status</Label>
                    <div className='flex justify-center'>
                      <Badge className={`${getTripStatusColor(formData.tripStatus)} border`}>
                        {formData.tripStatus.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className='flex justify-end gap-3 pt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={isSubmitting}
            >
              <X className='w-4 h-4 mr-2' />
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting}
              className='gap-2'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  {editingTrip ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className='w-4 h-4' />
                  {editingTrip ? 'Update Trip' : 'Create Trip'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
