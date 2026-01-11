import api from './axios';
import {
  PaginatedResponse,
  QueryParams,
} from './types';

// Repair and Maintenance Status Enum
export enum RepairMaintenanceStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

// Repair and Maintenance Type Enum
export enum RepairMaintenanceType {
  REPAIR = 'repair',
  MAINTENANCE = 'maintenance',
  PREVENTIVE_MAINTENANCE = 'preventive_maintenance',
  EMERGENCY_REPAIR = 'emergency_repair',
}

// Repair and Maintenance Interface
export interface RepairMaintenance {
  id: number;
  orderId?: string; // May not be present in API response
  uniqueId?: string; // Unique identifier for the order
  nameOfWork?: string; // May not be present, use first item's nameOfWork
  typeOfWork?: RepairMaintenanceType; // May not be present, use first item's typeOfWork
  totalAmount?: number; // May not be present, calculate from items
  status: RepairMaintenanceStatus;
  date?: string; // API uses 'date' instead of 'requestedDate'
  requestedDate?: string; // Fallback for compatibility
  location?: string;
  approvedBy?: {
    id: number;
    name: string;
    email: string;
  };
  requestedBy?: {
    id: number;
    name: string;
    email: string;
  };
  orderedBy?: {
    id: number;
    name: string;
    email: string;
  };
  approvalDate?: string; // API uses 'approvalDate' instead of 'approvedDate'
  approvedDate?: string; // Fallback for compatibility
  completedDate?: string;
  branch?: {
    id: number;
    name: string;
    location: string;
    code?: string;
    contactPhone?: string;
    createdAt: string;
    updatedAt: string;
  };
  description?: string; // May not be present, use first item's description
  machineId?: number;
  machineName?: string; // May not be present, use first item's machine name
  createdAt: string;
  updatedAt: string;
  items?: RepairMaintenanceItem[];
}

export interface RepairMaintenanceItem {
  id: number;
  srNo?: string; // May not be present in API response
  nameOfWork: string;
  typeOfWork: RepairMaintenanceType;
  machineId?: number;
  machine?: {
    id: number;
    name: string;
    model?: string;
    serialNumber?: string;
  };
  machineName?: string; // Fallback, use machine.name if available
  totalAmount?: number; // May not be present, calculate from vendor quotations
  description?: string;
  imagePaths?: string[]; // API uses 'imagePaths'
  images?: string[]; // Fallback for compatibility
  vendorQuotations?: VendorQuotation[];
  selectedQuotation?: {
    id: number;
    vendorName: string;
  };
}

export interface VendorQuotation {
  id: number | string;
  vendorName: string;
  contactPerson?: string;
  phone?: string;
  price: string;
  quotedPrice: string;
  notes?: string;
  quotationFile?: File | null;
  filePaths?: string[];
  quotationFilePaths?: string[]; // API may return this instead of filePaths
  quotationFileUrls?: string[]; // API may return presigned URLs
  isSelected?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRepairMaintenanceItem {
  nameOfWork: string;
  typeOfWork: RepairMaintenanceType;
  machineId: number;
  description?: string;
  itemImageCount?: number; // Number of images for this item
  vendorQuotations?: Array<{
    vendorName: string;
    contactPerson?: string;
    phone?: string;
    price: number | string;
    quotedPrice: number | string;
    notes?: string;
  }>;
}

export interface CreateRepairMaintenanceRequest {
  items: CreateRepairMaintenanceItem[];
  location?: string;
  date?: string; // YYYY-MM-DD format
  status?: RepairMaintenanceStatus; // 'draft' or 'pending_approval'
}

export interface UpdateRepairMaintenanceStatusRequest {
  status: RepairMaintenanceStatus;
  rejectionReason?: string;
  selectedVendorQuotations?: Record<string, string>; // itemId -> quotationId mapping
}

export const repairMaintenanceApi = {
  /**
   * Get all repair and maintenance orders with pagination
   */
  getAll: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<RepairMaintenance>> => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.status) queryParams.append('status', params.status);

    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder', 'status'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    // Include items and related data
    queryParams.append(
      'include',
      'items,items.vendorQuotations,branch,requestedBy,approvedBy'
    );

    const queryString = queryParams.toString();
    const url = `/inventory/repair-maintenance${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await api.get<PaginatedResponse<RepairMaintenance>>(url);
    return response.data;
  },

  /**
   * Get a repair and maintenance order by ID
   */
  getById: async (id: number): Promise<RepairMaintenance> => {
    const response = await api.get<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}?include=items,items.vendorQuotations,branch,requestedBy,approvedBy`
    );
    return response.data;
  },

  /**
   * Create a new repair and maintenance order
   */
  create: async (
    repairMaintenance: FormData | CreateRepairMaintenanceRequest
  ): Promise<RepairMaintenance> => {
    const headers =
      repairMaintenance instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

    const response = await api.post<RepairMaintenance>(
      '/inventory/repair-maintenance',
      repairMaintenance,
      { headers }
    );
    return response.data;
  },

  /**
   * Update a repair and maintenance order
   */
  update: async (
    id: number,
    repairMaintenance: FormData | Partial<CreateRepairMaintenanceRequest>
  ): Promise<RepairMaintenance> => {
    const headers =
      repairMaintenance instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

    const response = await api.patch<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}`,
      repairMaintenance,
      { headers }
    );
    return response.data;
  },

  /**
   * Delete a repair and maintenance order
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/inventory/repair-maintenance/${id}`);
  },

  /**
   * Update repair and maintenance order status (generic)
   */
  updateStatus: async (
    id: number,
    payload: UpdateRepairMaintenanceStatusRequest
  ): Promise<RepairMaintenance> => {
    const response = await api.patch<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}/status`,
      payload
    );
    return response.data;
  },

  /**
   * Approve a repair and maintenance order
   */
  approve: async (
    id: number,
    selectedVendorQuotations?: Record<string, string>
  ): Promise<RepairMaintenance> => {
    const payload: any = { 
      status: 'approved'
    };
    
    // Always include selected vendor quotations in payload (even if empty)
    // Format: { itemId: quotationId, ... }
    payload.selectedVendorQuotations = selectedVendorQuotations || {};
    
    console.log('Approving repair maintenance order with payload:', payload);
    
    const response = await api.post<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}/approve`,
      payload
    );
    return response.data;
  },

  /**
   * Reject a repair and maintenance order
   */
  reject: async (
    id: number,
    rejectionReason: string
  ): Promise<RepairMaintenance> => {
    const response = await api.post<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}/reject`,
      { 
        status: 'rejected',
        rejectionReason 
      }
    );
    return response.data;
  },

  /**
   * Complete a repair and maintenance order
   */
  complete: async (id: number): Promise<RepairMaintenance> => {
    const response = await api.post<RepairMaintenance>(
      `/inventory/repair-maintenance/${id}/complete`,
      { status: 'completed' }
    );
    return response.data;
  },

  /**
   * Get item images
   */
  getItemImages: async (
    orderId: number,
    itemId: number
  ): Promise<string[]> => {
    try {
      const response = await api.get<{ images: string[] } | string[]>(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/images`
    );
      
      // Handle both response formats: { images: [...] } or [...]
      if (Array.isArray(response.data)) {
        return response.data;
      }
      
      const images = response.data.images || [];
      
      // Validate that URLs are actually image URLs (not HTML error pages)
      return images.filter(url => {
        if (!url || typeof url !== 'string') return false;
        // Check if URL looks like an image URL (has image extension or is a signed URL)
        const isImageUrl = url.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i) || 
                         url.includes('presigned') || 
                         url.includes('s3') ||
                         url.startsWith('http://') || 
                         url.startsWith('https://');
        return isImageUrl;
      });
    } catch (error) {
      console.error('Error fetching item images:', error);
      throw error;
    }
  },

  /**
   * Get vendor quotation file URLs for an item
   * GET /inventory/repair-maintenance/{orderId}/items/{itemId}/vendor-quotations/{quotationId}/files
   */
  getVendorQuotationFileUrls: async (
    orderId: number,
    itemId: number,
    quotationId: number | string
  ): Promise<string[]> => {
    try {
      const response = await api.get<{ files?: string[]; urls?: string[] } | string[]>(
        `/inventory/repair-maintenance/${orderId}/items/${itemId}/vendor-quotations/${quotationId}/files`
      );
      console.log('API Response for quotation files:', response.data);
      
      // Handle multiple response formats: { files: [...] }, { urls: [...] }, or [...]
      if (Array.isArray(response.data)) {
        console.log('Response is array, returning:', response.data);
        return response.data;
      }
      
      // Check for 'files' field first (new format), then 'urls' (legacy format)
      const files = (response.data as any).files || [];
      const urls = (response.data as any).urls || [];
      const result = files.length > 0 ? files : urls;
      console.log('Extracted files from response:', result);
      return result;
    } catch (error) {
      console.error('Error fetching vendor quotation file URLs:', error);
      throw error;
    }
  },

  /**
   * Upload item images
   */
  uploadItemImages: async (
    orderId: number,
    itemId: number,
    images: File[]
  ): Promise<string[]> => {
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await api.post<string[]>(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/images`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  /**
   * Get vendor quotations for an item
   */
  getVendorQuotations: async (
    orderId: number,
    itemId: number
  ): Promise<VendorQuotation[]> => {
    const response = await api.get<VendorQuotation[]>(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/vendor-quotations`
    );
    return response.data;
  },

  /**
   * Add vendor quotation to an item
   */
  addVendorQuotation: async (
    orderId: number,
    itemId: number,
    quotation: FormData | Omit<VendorQuotation, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VendorQuotation> => {
    const headers =
      quotation instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

    const response = await api.post<VendorQuotation>(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/vendor-quotations`,
      quotation,
      { headers }
    );
    return response.data;
  },

  /**
   * Select vendor quotation
   */
  selectVendorQuotation: async (
    orderId: number,
    itemId: number,
    quotationId: number | string
  ): Promise<VendorQuotation> => {
    const response = await api.patch<VendorQuotation>(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/vendor-quotations/${quotationId}/select`,
      { isSelected: true }
    );
    return response.data;
  },

  /**
   * Delete vendor quotation
   */
  deleteVendorQuotation: async (
    orderId: number,
    itemId: number,
    quotationId: number | string
  ): Promise<void> => {
    await api.delete(
      `/inventory/repair-maintenance/${orderId}/items/${itemId}/vendor-quotations/${quotationId}`
    );
  },

  /**
   * Export repair and maintenance orders
   */
  export: async (
    format: 'csv' | 'xlsx',
    params?: {
      from?: string;
      to?: string;
      status?: string;
      branchId?: string;
    }
  ): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    if (params?.from) queryParams.append('from', params.from);
    if (params?.to) queryParams.append('to', params.to);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.branchId) queryParams.append('branchId', params.branchId);

    const queryString = queryParams.toString();
    const url = `/inventory/repair-maintenance/export/${format}${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        Accept:
          format === 'csv'
            ? 'text/csv'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    return response.data;
  },

  /**
   * Get repair maintenance options (types and statuses)
   */
  getOptions: async (): Promise<{
    statuses: Array<{ value: string; label: string }>;
    workTypes: Array<{ value: string; label: string }>;
  }> => {
    try {
      const response = await api.get<{
        statuses: Array<{ value: string; label: string }>;
        workTypes: Array<{ value: string; label: string }>;
      }>('/inventory/repair-maintenance/options');
      return response.data;
    } catch (error) {
      // If endpoint doesn't exist, return default options
      console.warn('Options endpoint not available, using default options');
      return {
        statuses: [
          { value: RepairMaintenanceStatus.DRAFT, label: 'Draft' },
          { value: RepairMaintenanceStatus.PENDING_APPROVAL, label: 'Pending Approval' },
          { value: RepairMaintenanceStatus.APPROVED, label: 'Approved' },
          { value: RepairMaintenanceStatus.REJECTED, label: 'Rejected' },
          { value: RepairMaintenanceStatus.COMPLETED, label: 'Completed' },
        ],
        workTypes: [
          { value: RepairMaintenanceType.REPAIR, label: 'Repair' },
          { value: RepairMaintenanceType.MAINTENANCE, label: 'Maintenance' },
        ],
      };
    }
  },
};

