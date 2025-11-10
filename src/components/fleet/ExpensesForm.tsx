import { useState, useEffect } from 'react';
import {
  IndianRupee,
  Save,
  X,
  Loader2,
  Plus,
  Upload,
  FileText,
  Image,
  Trash2,
} from 'lucide-react';

// Date utility functions
const formatDateToString = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper function to convert DD-MM-YYYY to YYYY-MM-DD for API
const convertDateFormatToApi = (dateString: string): string => {
  if (!dateString) return '';
  
  // If already in YYYY-MM-DD format, return as is
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  
  // Handle DD-MM-YYYY format
  if (dateString.includes('-') && dateString.length === 10) {
    const parts = dateString.split('-');
    if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}`;
    }
  }
  
  return dateString;
};

// Helper function to convert payment method format
const formatPaymentMethod = (method: string): string => {
  // Convert 'cash', 'card', 'upi', 'cheque', 'bank_transfer' to proper format
  const methodMap: Record<string, string> = {
    'cash': 'Cash',
    'card': 'Card',
    'upi': 'UPI',
    'cheque': 'Cheque',
    'bank_transfer': 'Bank Transfer',
    'credit': 'Credit',
    'other': 'Other',
  };
  
  // Check if it's in the map
  if (methodMap[method.toLowerCase()]) {
    return methodMap[method.toLowerCase()];
  }
  
  // If it has underscore, replace with space and capitalize words
  if (method.includes('_')) {
    return method
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  // Otherwise, capitalize first letter
  return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
};

// Helper function to convert VehicleExpenseData to API CreateVehicleExpenseRequest
const mapExpenseDataToApiRequest = (data: VehicleExpenseData, files: File[], categoryId?: number): CreateVehicleExpenseRequest => {
  // Ensure all required fields are present
  const vehicleId = parseInt(data.vehicleId);
  if (!vehicleId || isNaN(vehicleId)) {
    throw new Error('Valid vehicle ID is required');
  }
  
  const amount = parseFloat(data.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    throw new Error('Valid amount is required');
  }
  
  const expenseDate = convertDateFormatToApi(data.expenseDate);
  if (!expenseDate) {
    throw new Error('Valid expense date is required');
  }
  
  if (!data.expenseCategory || !data.expenseCategory.trim()) {
    throw new Error('Expense category is required');
  }
  
  if (!data.expenseType || !data.expenseType.trim()) {
    throw new Error('Expense type is required');
  }
  
  if (!data.requestedBy || !data.requestedBy.trim()) {
    throw new Error('Requested by is required');
  }
  
  return {
    vehicleId: vehicleId,
    expenseDate: expenseDate,
    categoryId: categoryId, // Use categoryId (number) instead of category (string)
    expenseType: data.expenseType.trim(),
    amount: amount.toString(), // Convert to string as API expects "number string"
    location: data.location?.trim() || '',
    requestedBy: data.requestedBy.trim(),
    vendorName: data.vendorName?.trim() || '',
    vendorContact: data.vendorContact?.trim() || '',
    vendorAddress: data.vendorAddress?.trim() || '',
    paymentMethod: formatPaymentMethod(data.paymentMethod),
    paymentReference: data.paymentReference?.trim() || '',
    additionalNotes: (data.description || data.notes || '').trim() || undefined,
    files: files.length > 0 ? files : undefined,
  };
};

const stringToDateInputFormat = (dateString: string): string => {
  // Convert DD-MM-YYYY to YYYY-MM-DD for HTML date input
  if (dateString && dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      // Check if first part is day (2 digits) vs year (4 digits)
      if (parts[0].length === 2 && parts[2].length === 4) {
        // DD-MM-YYYY format
        const [day, month, year] = parts;
        return `${year}-${month}-${day}`;
      } else if (parts[0].length === 4 && parts[2].length === 2) {
        // Already YYYY-MM-DD format
        return dateString;
      }
    }
  }
  return dateString;
};

const dateInputFormatToString = (dateInputValue: string): string => {
  // Convert YYYY-MM-DD from HTML date input to DD-MM-YYYY
  if (dateInputValue && dateInputValue.includes('-')) {
    const parts = dateInputValue.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      // YYYY-MM-DD format
      const [year, month, day] = parts;
      return `${day}-${month}-${year}`;
    }
  }
  return dateInputValue;
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
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '../../hooks/use-toast';
import { useRole } from '../../contexts/RoleContext';
import { fleetApi } from '../../lib/api';
import type { CreateVehicleExpenseRequest } from '../../lib/api/types';

export enum PaymentMethod {
  CASH = 'Cash',
  UPI = 'UPI',
  CARD = 'Card',
  BANK_TRANSFER = 'Bank Transfer',
  CHEQUE = 'Cheque',
  CREDIT = 'Credit',
  OTHER = 'Other',
}

export interface VehicleExpenseData {
  id?: string;
  expenseNumber: string;
  vehicleId: string;
  vehicleRegistrationNumber: string;
  driverId: string;
  driverName: string;
  expenseDate: string;
  expenseCategory: string; // Slug value (lowercase, underscores)
  expenseCategoryId?: number; // Category id from API
  categoryName?: string; // Original category name from API for display
  expenseType: string;
  description: string;
  amount: string;
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  location: string;
  odometerReading: string;
  receipts: File[];
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvedBy: string;
  approvedDate: string;
  rejectionReason: string;
  notes: string;
  requestedBy: string;
  createdAt?: string;
  updatedAt?: string;
  submittedBy?: string; // Name of the user who submitted/created the expense
}

interface ExpensesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (expenseData: VehicleExpenseData) => void;
  editingExpense?: VehicleExpenseData | null;
  availableVehicles?: Array<{ id: string; registrationNumber: string; driverName: string; driverId: string }>;
}

export const ExpensesForm = ({
  isOpen,
  onClose,
  onSubmit,
  editingExpense,
  availableVehicles = [],
}: ExpensesFormProps) => {
  const { currentUser } = useRole();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // State for expense categories from API
  const [expenseCategories, setExpenseCategories] = useState<Array<{ id: number; name: string; slug: string }>>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // State for custom expense category input
  const [showCustomExpenseCategoryInput, setShowCustomExpenseCategoryInput] = useState(false);
  const [customExpenseCategoryName, setCustomExpenseCategoryName] = useState('');
  
  // State for file uploads
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const [formData, setFormData] = useState<VehicleExpenseData>({
    expenseNumber: '',
    vehicleId: '',
    vehicleRegistrationNumber: '',
    driverId: '',
    driverName: '',
    expenseDate: formatDateToString(new Date()),
    expenseCategory: '',
    expenseCategoryId: undefined,
    categoryName: '',
    expenseType: '',
    description: '',
    amount: '',
    vendorName: '',
    vendorContact: '',
    vendorAddress: '',
    paymentMethod: PaymentMethod.CASH,
    paymentReference: '',
    location: '',
    odometerReading: '',
    receipts: [],
    approvalStatus: 'pending',
    approvedBy: '',
    approvedDate: '',
    rejectionReason: '',
    notes: '',
    requestedBy: '', // Empty by default - user must fill it
  });

  // Fetch expense categories from API
  useEffect(() => {
    const fetchExpenseCategories = async () => {
      if (isOpen) {
        setIsLoadingCategories(true);
        try {
          const response = await fleetApi.getAllExpenseCategories({ page: 1, limit: 100 });
          const apiCategories = response.data.map(ec => ({
            id: ec.id,
            name: ec.name,
            slug: ec.name?.toLowerCase().replace(/\s+/g, '_') || ec.id.toString(),
          }));
          setExpenseCategories(apiCategories);

          // If not editing and no category selected, default to first category
          if (!editingExpense && apiCategories.length > 0 && !formData.expenseCategory) {
            const firstCategory = apiCategories[0];
            setFormData(prev => ({
              ...prev,
              expenseCategory: firstCategory.slug,
              expenseCategoryId: firstCategory.id,
              categoryName: firstCategory.name,
            }));
          }
        } catch (error) {
          console.error('Error fetching expense categories:', error);
        } finally {
          setIsLoadingCategories(false);
        }
      }
    };

    fetchExpenseCategories();
  }, [isOpen]);

  // Effect to populate form when editing
  useEffect(() => {
    if (editingExpense && isOpen) {
      // Ensure date format is DD-MM-YYYY when editing
      const expenseData = { ...editingExpense };
      if (expenseData.expenseDate && !expenseData.expenseDate.includes('-')) {
        // If date is in a different format, convert it
        const date = new Date(expenseData.expenseDate);
        if (!isNaN(date.getTime())) {
          expenseData.expenseDate = formatDateToString(date);
        }
      }
      setFormData(expenseData);
    } else if (!editingExpense && isOpen) {
      // Reset form for new expense
      setFormData({
        expenseNumber: '',
        vehicleId: '',
        vehicleRegistrationNumber: '',
        driverId: '',
        driverName: '',
        expenseDate: formatDateToString(new Date()),
        expenseCategory: '',
        expenseCategoryId: undefined,
        categoryName: '',
        expenseType: '',
        description: '',
        amount: '',
        vendorName: '',
        vendorContact: '',
        vendorAddress: '',
        paymentMethod: PaymentMethod.CASH,
        paymentReference: '',
        location: '',
        odometerReading: '',
        receipts: [],
        approvalStatus: 'pending',
        approvedBy: '',
        approvedDate: '',
        rejectionReason: '',
        notes: '',
        requestedBy: '', // Empty by default - user must fill it
      });
      setShowCustomExpenseCategoryInput(false);
      setCustomExpenseCategoryName('');
      setUploadedFiles([]);
    }
  }, [editingExpense, isOpen]);

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

  // Align selected expense category with API categories when they load
  useEffect(() => {
    if (
      expenseCategories.length > 0 &&
      formData.expenseCategory &&
      formData.expenseCategory !== 'other' &&
      !formData.expenseCategoryId
    ) {
      const matchedCategory = expenseCategories.find(
        (ec) => ec.slug === formData.expenseCategory || ec.name === formData.categoryName
      );

      if (matchedCategory) {
        setFormData((prev) => ({
          ...prev,
          expenseCategory: matchedCategory.slug,
          expenseCategoryId: matchedCategory.id,
          categoryName: matchedCategory.name,
        }));
      }
    }
  }, [expenseCategories, formData.expenseCategory, formData.expenseCategoryId, formData.categoryName]);

  const handleInputChange = (field: keyof VehicleExpenseData, value: string | File[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleExpenseCategoryChange = (value: string) => {
    if (value === 'other') {
      setFormData((prev) => ({
        ...prev,
        expenseCategory: 'other',
        expenseCategoryId: undefined,
        categoryName: '',
      }));
      setShowCustomExpenseCategoryInput(true);
    } else {
      const selected = expenseCategories.find(ec => ec.slug === value);
      setFormData((prev) => ({
        ...prev,
        expenseCategory: value,
        expenseCategoryId: selected?.id,
        categoryName: selected?.name || prev.categoryName,
      }));
      setShowCustomExpenseCategoryInput(false);
      setCustomExpenseCategoryName('');
    }

    if (errors.expenseCategory) {
      setErrors((prev) => ({ ...prev, expenseCategory: '' }));
    }
  };

  // Function to create new expense category
  const handleCreateExpenseCategory = async () => {
    if (!customExpenseCategoryName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an expense category name.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsLoadingCategories(true);
      // Create new expense category via API
      const newCategory = await fleetApi.createExpenseCategory({
        name: customExpenseCategoryName.trim(),
      });
      
      const newCategoryOption = {
        id: newCategory.id,
        name: newCategory.name,
        slug: newCategory.name?.toLowerCase().replace(/\s+/g, '_') || newCategory.id.toString(),
      };
      setExpenseCategories((prev) => [...prev, newCategoryOption]);
      
      // Set the newly created category as selected
      setFormData((prev) => ({
        ...prev,
        expenseCategory: newCategoryOption.slug,
        expenseCategoryId: newCategoryOption.id,
        categoryName: newCategoryOption.name,
      }));
      
      setShowCustomExpenseCategoryInput(false);
      setCustomExpenseCategoryName('');

      toast({
        title: 'Success',
        description: `Expense category "${newCategory.name}" has been created successfully.`,
      });
    } catch (error: any) {
      console.error('Error creating expense category:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create expense category. Please try again.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // File upload functions
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;

    const newFiles = Array.from(files);
    const totalFiles = uploadedFiles.length + newFiles.length;

    if (totalFiles > 4) {
      toast({
        title: 'Error',
        description: 'Maximum 4 files allowed. Please remove some files first.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file types and sizes
    const validFiles = newFiles.filter(file => {
      const isValidType = file.type.startsWith('image/') || 
                         file.type === 'application/pdf' || 
                         file.type === 'application/msword' ||
                         file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                         file.type === 'application/vnd.ms-excel' ||
                         file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit

      if (!isValidType) {
        toast({
          title: 'Error',
          description: `File "${file.name}" is not a supported format.`,
          variant: 'destructive',
        });
        return false;
      }

      if (!isValidSize) {
        toast({
          title: 'Error',
          description: `File "${file.name}" is too large. Maximum size is 10MB.`,
          variant: 'destructive',
        });
        return false;
      }

      return true;
    });

    setUploadedFiles(prev => [...prev, ...validFiles]);
    
    // Also update formData.receipts for consistency
    setFormData(prev => ({
      ...prev,
      receipts: [...prev.receipts, ...validFiles],
    }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setFormData(prev => ({
      ...prev,
      receipts: prev.receipts.filter((_, i) => i !== index),
    }));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className='w-4 h-4' />;
    }
    return <FileText className='w-4 h-4' />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    let hasErrors = false;

    // Only validate mandatory fields
    if (!formData.vehicleId.trim()) {
      newErrors.vehicleId = 'Please select a vehicle';
      hasErrors = true;
    }

    if (!formData.expenseDate.trim()) {
      newErrors.expenseDate = 'Expense date is required';
      hasErrors = true;
    }

    if (!formData.expenseCategory.trim()) {
      newErrors.expenseCategory = 'Expense category is required';
      hasErrors = true;
    } else if (formData.expenseCategory === 'other') {
      if (!customExpenseCategoryName.trim()) {
        newErrors.expenseCategory = 'Please enter an expense category name or select from the list';
        hasErrors = true;
      }
    } else if (!formData.expenseCategoryId) {
      newErrors.expenseCategory = 'Invalid expense category selected';
      hasErrors = true;
    }

    if (!formData.expenseType.trim()) {
      newErrors.expenseType = 'Expense type is required';
      hasErrors = true;
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'Amount is required';
      hasErrors = true;
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'Please enter a valid amount';
        hasErrors = true;
      }
    }

    if (!formData.requestedBy.trim()) {
      newErrors.requestedBy = 'Requested by is required';
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
      // If "Other" is selected, ensure custom category is created first
      let selectedCategory;
      if (formData.expenseCategory === 'other' && customExpenseCategoryName.trim()) {
        // Create the new expense category first
        setIsLoadingCategories(true);
        try {
          const newCategory = await fleetApi.createExpenseCategory({
            name: customExpenseCategoryName.trim(),
          });
          const newCategoryOption = {
            id: newCategory.id,
            name: newCategory.name,
            slug: newCategory.name?.toLowerCase().replace(/\s+/g, '_') || newCategory.id.toString(),
          };
          setExpenseCategories((prev) => [...prev, newCategoryOption]);
          selectedCategory = { id: newCategory.id, name: newCategory.name };
          setFormData((prev) => ({
            ...prev,
            expenseCategory: newCategoryOption.slug,
            expenseCategoryId: newCategoryOption.id,
            categoryName: newCategoryOption.name,
          }));
        } catch (error: any) {
          setIsLoadingCategories(false);
          const errorMessage = error.response?.data?.message || 'Failed to create expense category. Please try again.';
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive',
          });
          return;
        } finally {
          setIsLoadingCategories(false);
        }
      } else {
        // Find the selected expense category by slug
        selectedCategory = expenseCategories.find(ec => ec.slug === formData.expenseCategory);
      }
 
      const categoryId = selectedCategory?.id ?? formData.expenseCategoryId;
 
      // Convert form data to API request format
      const apiRequest = mapExpenseDataToApiRequest(formData, uploadedFiles, categoryId);
      
      // Debug: Log the API request payload
      console.log('API Request Payload:', {
        ...apiRequest,
        files: apiRequest.files ? `${apiRequest.files.length} file(s)` : 'No files',
      });
      
      // Create expense via API
      const createdExpense = await fleetApi.createVehicleExpense(apiRequest);
      
      // Prepare expense data for parent component callback
      const expenseData: VehicleExpenseData = {
        ...formData,
        id: createdExpense.id.toString(),
        expenseNumber: createdExpense.id.toString(),
        expenseCategoryId: categoryId,
        categoryName: selectedCategory?.name || formData.categoryName,
        receipts: uploadedFiles,
      };
      
      // Call parent callback with form data (for parent component to handle refresh)
      onSubmit(expenseData);
      
      toast({
        title: '✅ Vehicle Expense Recorded Successfully!',
        description: `Expense has been successfully recorded.`,
        variant: 'default',
      });

      // Reset form
      const defaultCategory = expenseCategories[0];
      setFormData({
        id: undefined,
        expenseNumber: '',
        vehicleId: '',
        vehicleRegistrationNumber: '',
        driverId: '',
        driverName: '',
        expenseDate: formatDateToString(new Date()),
        expenseCategory: defaultCategory ? defaultCategory.slug : '',
        expenseCategoryId: defaultCategory?.id,
        categoryName: defaultCategory?.name || '',
        expenseType: '',
        description: '',
        amount: '',
        vendorName: '',
        vendorContact: '',
        vendorAddress: '',
        paymentMethod: PaymentMethod.CASH,
        paymentReference: '',
        location: '',
        odometerReading: '',
        receipts: [],
        approvalStatus: 'pending',
        approvedBy: '',
        approvedDate: '',
        rejectionReason: '',
        notes: '',
        requestedBy: '',
        submittedBy: '',
        createdAt: undefined,
        updatedAt: undefined,
      });

      setErrors({});
      setShowCustomExpenseCategoryInput(false);
      setCustomExpenseCategoryName('');
      setUploadedFiles([]);
      // Refresh expense categories after creation to include the new one
      if (isOpen) {
        try {
          const response = await fleetApi.getAllExpenseCategories({ page: 1, limit: 100 });
          setExpenseCategories(
            response.data.map(ec => ({
              id: ec.id,
              name: ec.name,
              slug: ec.name?.toLowerCase().replace(/\s+/g, '_') || ec.id.toString(),
            }))
          );
        } catch (error) {
          console.error('Error refreshing expense categories:', error);
        }
      }
      onClose();
    } catch (error: any) {
      console.error('Error recording expense:', error);
      
      // Enhanced error handling
      let errorMessage = 'Failed to record expense. Please try again.';
      
      // Handle validation errors from mapping function
      if (error.message && (error.message.includes('required') || error.message.includes('Valid'))) {
        errorMessage = error.message;
        setErrors({
          vehicleId: error.message.includes('vehicle') ? error.message : '',
          expenseDate: error.message.includes('date') ? error.message : '',
          expenseCategory: error.message.includes('category') ? error.message : '',
          expenseType: error.message.includes('type') ? error.message : '',
          amount: error.message.includes('amount') ? error.message : '',
          requestedBy: error.message.includes('requested') ? error.message : '',
        });
      } else if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          // Try to get detailed validation errors
          if (data?.message) {
            errorMessage = data.message;
          } else if (data?.errors && Array.isArray(data.errors)) {
            errorMessage = data.errors.join(', ');
          } else if (typeof data === 'object') {
            // Extract validation errors from response
            const errors = Object.entries(data)
              .filter(([key, value]) => Array.isArray(value) && value.length > 0)
              .map(([key, value]) => `${key}: ${(value as string[]).join(', ')}`)
              .join('; ');
            errorMessage = errors || 'Invalid expense data. Please check all fields and try again.';
          } else {
            errorMessage = 'Invalid expense data. Please check all fields and try again.';
          }
        } else if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to create expenses.';
        } else if (status === 409) {
          errorMessage = data?.message || 'An expense with this information already exists.';
        } else if (status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data?.message) {
          errorMessage = data.message;
        } else {
          errorMessage = `Request failed with status ${status}`;
        }
      } else if (error.request) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else {
        errorMessage = error.message || 'An unexpected error occurred.';
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
      <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader className='pb-2'>
          <DialogTitle className='flex items-center gap-2 text-lg'>
            <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
              <IndianRupee className='w-4 h-4 text-primary' />
            </div>
            {editingExpense ? 'Edit Vehicle Expense' : 'Add New Vehicle Expense'}
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

                {/* First Row - 4 Columns: Vehicle *, Expense Date *, Expense Category *, Expense Type * */}
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                  <div className='space-y-1'>
                    <Label htmlFor='vehicleId' className='text-xs font-medium'>
                      Vehicle *
                    </Label>
                  <Select
                    value={formData.vehicleId}
                    onValueChange={(value) => handleInputChange('vehicleId', value)}
                  >
                      <SelectTrigger className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 [&>span]:text-muted-foreground ${errors.vehicleId ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder='Select vehicle' />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.registrationNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.vehicleId && (
                      <p className='text-destructive text-xs mt-1'>{errors.vehicleId}</p>
                  )}
                </div>

                  <div className='space-y-1'>
                    <Label htmlFor='expenseDate' className='text-xs font-medium'>
                      Expense Date *
                    </Label>
                  <Input
                    id='expenseDate'
                    type='date'
                    value={stringToDateInputFormat(formData.expenseDate)}
                    onChange={(e) => handleInputChange('expenseDate', dateInputFormatToString(e.target.value))}
                      className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 ${errors.expenseDate ? 'border-red-500' : ''}`}
                  />
                  {errors.expenseDate && (
                      <p className='text-destructive text-xs mt-1'>{errors.expenseDate}</p>
                  )}
                </div>

                  <div className='space-y-1'>
                    <Label htmlFor='expenseCategory' className='text-xs font-medium'>
                      Expense Category *
                    </Label>
                  <Select
                    value={formData.expenseCategory || ''}
                    onValueChange={handleExpenseCategoryChange}
                  >
                      <SelectTrigger className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 [&>span]:text-muted-foreground ${errors.expenseCategory ? 'border-red-500' : ''}`}>
                      <SelectValue placeholder='Select expense category' />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((ec) => (
                        <SelectItem key={ec.id || ec.name} value={ec.slug}>
                          {ec.name}
                        </SelectItem>
                      ))}
                      <SelectItem value='other'>Other</SelectItem>
                      {expenseCategories.length === 0 && (
                        <SelectItem value='other' disabled>
                          No categories available (use Other)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.expenseCategory && (
                      <p className='text-destructive text-xs mt-1'>{errors.expenseCategory}</p>
                  )}
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='expenseType' className='text-xs font-medium'>
                      Expense For *
                    </Label>
                  <Input
                    id='expenseType'
                    value={formData.expenseType}
                    onChange={(e) => handleInputChange('expenseType', e.target.value)}
                    placeholder='e.g., Diesel, Engine Oil'
                      className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground ${errors.expenseType ? 'border-red-500' : ''}`}
                  />
                  {errors.expenseType && (
                      <p className='text-destructive text-xs mt-1'>{errors.expenseType}</p>
                  )}
                  </div>
                </div>

                {/* Custom Expense Category Input */}
                {showCustomExpenseCategoryInput && (
                  <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2'>
                    <Label className='text-xs font-medium text-blue-800'>
                      Add New Expense Category
                    </Label>
                    <div className='flex gap-2'>
                      <Input
                        placeholder='Enter expense category name'
                        value={customExpenseCategoryName}
                        onChange={(e) => setCustomExpenseCategoryName(e.target.value)}
                        disabled={isLoadingCategories}
                        className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground'
                      />
                      <Button
                        type='button'
                        onClick={handleCreateExpenseCategory}
                        size='sm'
                        disabled={isLoadingCategories}
                        className='h-8 px-3 bg-blue-600 hover:bg-blue-700'
                      >
                        {isLoadingCategories ? (
                          <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                        ) : (
                          <Plus className='w-3 h-3 mr-1' />
                        )}
                        Add
                      </Button>
                      <Button
                        type='button'
                        onClick={() => {
                          setShowCustomExpenseCategoryInput(false);
                          setCustomExpenseCategoryName('');
                          if (expenseCategories.length > 0) {
                            const defaultCategory = expenseCategories[0];
                            setFormData(prev => ({
                              ...prev,
                              expenseCategory: defaultCategory.slug,
                              expenseCategoryId: defaultCategory.id,
                              categoryName: defaultCategory.name,
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              expenseCategory: '',
                              expenseCategoryId: undefined,
                              categoryName: '',
                            }));
                          }
                        }}
                        variant='outline'
                        size='sm'
                        disabled={isLoadingCategories}
                        className='h-8 px-3'
                      >
                        <X className='w-3 h-3' />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Second Row - 3 Columns: Amount (₹) *, Location, Requested By */}
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                  <div className='space-y-1'>
                    <Label htmlFor='amount' className='text-xs font-medium'>
                      Amount (₹) *
                    </Label>
                  <Input
                    id='amount'
                    type='number'
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder='e.g., 2500.00'
                    min='0'
                    step='0.01'
                      className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground ${errors.amount ? 'border-red-500' : ''}`}
                  />
                  {errors.amount && (
                      <p className='text-destructive text-xs mt-1'>{errors.amount}</p>
                  )}
                </div>

                  <div className='space-y-1'>
                    <Label htmlFor='location' className='text-xs font-medium'>
                      Location
                    </Label>
                  <Input
                    id='location'
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder='Where was the expense incurred?'
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground'
                  />
                </div>

                  <div className='space-y-1'>
                    <Label htmlFor='requestedBy' className='text-xs font-medium'>Reported By *</Label>
                  <Input
                      id='requestedBy'
                      value={formData.requestedBy}
                      onChange={(e) => handleInputChange('requestedBy', e.target.value)}
                      placeholder='Enter the requested by'
                      className={`h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground ${errors.requestedBy ? 'border-red-500' : ''}`}
                    />
                    {errors.requestedBy && (
                        <p className='text-destructive text-xs mt-1'>{errors.requestedBy}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Uploads Proofs */}
              <div className='space-y-2'>
                <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                  Upload Proofs
                </h4>

                {/* File Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <p className='w-5 h-5 mx-auto mb-1 text-muted-foreground' />
                  <p className='text-xs text-muted-foreground mb-1'>
                    Drag & drop files or click to select
                  </p>
                  <p className='text-xs text-muted-foreground mb-2'>
                    Max 4 files, 10MB each (Images, PDF, Word, Excel)
                  </p>
                  
                  <input
                    type='file'
                    multiple
                    accept='image/*,.pdf,.doc,.docx,.xls,.xlsx'
                    onChange={(e) => handleFileUpload(e.target.files)}
                    className='hidden'
                    id='file-upload'
                  />
                  
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className='h-7 px-3 text-xs'
                    disabled={uploadedFiles.length >= 4}
                  >
                    <Upload className='w-3 h-3 mr-1' />
                    Choose Files
                  </Button>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                  <div className='space-y-1'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      Files ({uploadedFiles.length}/4)
                    </p>
                    <div className='space-y-1'>
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className='flex items-center justify-between p-2 bg-secondary rounded border'
                        >
                          <div className='flex items-center gap-2'>
                            {getFileIcon(file)}
                            <div className='flex flex-col'>
                              <span className='text-xs font-medium truncate max-w-[180px]'>
                                {file.name}
                              </span>
                              <span className='text-xs text-muted-foreground'>
                                {formatFileSize(file.size)}
                              </span>
                            </div>
                          </div>
                          <Button
                            type='button'
                            variant='ghost'
                            size='sm'
                            onClick={() => removeFile(index)}
                            className='h-5 w-5 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
                          >
                            <Trash2 className='w-3 h-3' />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

          {/* Vendor Information */}
              <div className='space-y-3'>
                <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                Vendor Information
                </h4>

                {/* First Row - Vendor Name, Contact, Payment Method */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div className='space-y-1'>
                    <Label htmlFor='vendorName' className='text-xs font-medium'>
                      Vendor Name
                    </Label>
                    <Input
                      id='vendorName'
                      value={formData.vendorName}
                      onChange={(e) => handleInputChange('vendorName', e.target.value)}
                      placeholder='e.g., Bharat Petroleum, Local Mechanic'
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='vendorContact' className='text-xs font-medium'>
                      Vendor Contact
                    </Label>
                    <Input
                      id='vendorContact'
                      type='tel'
                      value={formData.vendorContact}
                      onChange={(e) => handleInputChange('vendorContact', e.target.value)}
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-1'>
                    <Label htmlFor='paymentMethod' className='text-xs font-medium'>
                      Payment Method
                    </Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value: PaymentMethod) => 
                        handleInputChange('paymentMethod', value)
                      }
                    >
                      <SelectTrigger className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 [&>span]:text-muted-foreground'>
                        <SelectValue placeholder='Select payment method' />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(PaymentMethod).map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Second Row - Payment Reference and Vendor Address */}
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  <div className='space-y-1'>
                    <Label htmlFor='paymentReference' className='text-xs font-medium'>
                      Payment Reference
                    </Label>
                    <Input
                      id='paymentReference'
                      value={formData.paymentReference}
                      onChange={(e) => handleInputChange('paymentReference', e.target.value)}
                      placeholder='Transaction ID, Cheque No., etc.'
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground'
                    />
                  </div>

                  <div className='space-y-1 md:col-span-2'>
                    <Label htmlFor='vendorAddress' className='text-xs font-medium'>
                      Vendor Address
                    </Label>
                    <Input
                      id='vendorAddress'
                      value={formData.vendorAddress}
                      onChange={(e) => handleInputChange('vendorAddress', e.target.value)}
                      placeholder='Complete vendor address'
                      className='h-8 px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs transition-all duration-200 placeholder:text-muted-foreground'
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className='space-y-3'>
                <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                  Additional Notes
                </h4>

                <div className='space-y-1'>
                    <Textarea
                    id='description'
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder='Any additional notes about the expense...'
                    className='min-h-[40px] px-2 py-1 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-xs resize-none transition-all duration-200 placeholder:text-muted-foreground'
                />
              </div>

               

                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <div className='space-y-1'>
                    <Label className='text-xs font-medium'>Submitted By</Label>
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
              onClick={onClose}
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