import api from './axios';
import {
  ApproveRejectMaterialIndentRequest,
  PaginatedResponse,
  QueryParams,
  ExportParams,
} from './types';
import { MaterialIndent } from './types';

export enum IndentStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVERTED = 'reverted',
  ORDERED = 'ordered',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
}

export const materialIndentsApi = {
  /**
   * Get all material indents with pagination
   */
  getAll: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<MaterialIndent>> => {
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

    // Always include complete item details
    queryParams.append(
      'include',
      'items,items.material,items.machine,items.quotations'
    );

    const queryString = queryParams.toString();
    const url = `/inventory/material-indents${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await api.get<PaginatedResponse<MaterialIndent>>(url);
    return response.data;
  },

  /**
   * Get a material indent by ID with complete item details
   */
  getById: async (id: number): Promise<MaterialIndent> => {
    const response = await api.get<MaterialIndent>(
      `/inventory/material-indents/${id}?include=items,items.material,items.machine,items.quotations`
    );
    return response.data;
  },

  /**
   * Create a new material indent
   */
  create: async (
    materialIndent: FormData | Partial<MaterialIndent>
  ): Promise<MaterialIndent> => {
    const headers =
      materialIndent instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

    const response = await api.post<MaterialIndent>(
      '/inventory/material-indents',
      materialIndent,
      { headers }
    );
    return response.data;
  },

  /**
   * Update a material indent
   */
  update: async (
    id: number,
    materialIndent: Partial<MaterialIndent>
  ): Promise<MaterialIndent> => {
    const response = await api.patch<MaterialIndent>(
      `/inventory/material-indents/${id}`,
      materialIndent
    );
    return response.data;
  },

  /**
   * Delete a material indent
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/inventory/material-indents/${id}`);
  },

  /**
   * Approve a material indent
   */
  approve: async (
    id: number,
    payload: ApproveRejectMaterialIndentRequest
  ): Promise<MaterialIndent> => {
    console.log('API: Approving material indent', { id, payload });
    const response = await api.post<MaterialIndent>(
      `/inventory/material-indents/${id}/approve`,
      payload
    );
    console.log('API: Approval response', response.data);
    return response.data;
  },

  /**
   * Revert a material indent using the approve API endpoint
   */
  revert: async (id: number, revertReason: string): Promise<MaterialIndent> => {
    const response = await api.post<MaterialIndent>(
      `/inventory/material-indents/${id}/approve`,
      {
        status: 'reverted',
        rejectionReason: revertReason,
        itemId: 0, // Default item ID for revert
        quotationId: 0, // Default quotation ID for revert
      }
    );
    return response.data;
  },

  reSubmit: async (id: number, newData: Partial<MaterialIndent> | FormData) => {
    const headers =
      newData instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' };

    const response = await api.post<MaterialIndent>(
      `/inventory/material-indents/${id}/submit`,
      newData,
      { headers }
    );
    return response.data;
  },

  /**
   * Get last five material indents
   */
  getLastFive: async (materialId?: number): Promise<MaterialIndent[]> => {
    const response = await api.get<MaterialIndent[]>(
      `/inventory/material-indents/last-five/${materialId}`
    );
    return response.data;
  },
  /**
   * Get presigned URLs for an indent item's images
   */
  getItemImageUrls: async (
    indentId: number,
    itemId: number
  ): Promise<string[]> => {
    const response = await api.get<{ urls: string[] }>(
      `/inventory/material-indents/${indentId}/items/${itemId}/image`
    );
    return response.data.urls || [];
  },

  /**
   * Get presigned URLs for an indent item's vendor quotation images
   */
  getItemQuotationImageUrls: async (
    indentId: number,
    itemId: number
  ): Promise<string[]> => {
    const response = await api.get<{ urls: string[] }>(
      `/inventory/material-indents/${indentId}/items/${itemId}/quotation`
    );
    return response.data.urls || [];
  },

  /**
   * Get detailed information for a specific material indent item
   */
  getItemDetails: async (
    indentId: number,
    itemId: number
  ): Promise<MaterialIndent['items'][0]> => {
    const response = await api.get<MaterialIndent['items'][0]>(
      `/inventory/material-indents/${indentId}/items/${itemId}`
    );
    return response.data;
  },

  /**
   * Get all items for a material indent with complete details
   */
  getIndentItems: async (
    indentId: number
  ): Promise<MaterialIndent['items']> => {
    const response = await api.get<MaterialIndent['items']>(
      `/inventory/material-indents/${indentId}/items?include=material,machine,quotations`
    );
    return response.data;
  },

  /**
   * Refresh material indent data to ensure all fields are populated
   */
  refreshIndentData: async (id: number): Promise<MaterialIndent> => {
    const response = await api.get<MaterialIndent>(
      `/inventory/material-indents/${id}?include=items,items.material,items.machine,items.quotations,items.material.measureUnit`
    );
    return response.data;
  },


  /**
   * Export material indents to Excel file
   * @param params Export parameters (optional) - if no params provided, exports all material indents
   * @returns Promise with blob data for Excel file download
   * 
   * Automatically includes proper headers:
   * - Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   * - Authorization: Bearer token (from localStorage via axios interceptor)
   * 
   * @example
   * ```typescript
   * // Export all material indents (no parameters needed)
   * const blob = await materialIndentsApi.exportToExcel();
   * 
   * // Export material indents from a specific date range
   * const blob = await materialIndentsApi.exportToExcel({
   *   from: '2024-01-01',
   *   to: '2025-10-10'
   * });
   * 
   * // Create download link
   * const url = window.URL.createObjectURL(blob);
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = 'material-indents-export.xlsx';
   * link.click();
   * window.URL.revokeObjectURL(url);
   * ```
   */
  exportToExcel: async (params: ExportParams = {}): Promise<Blob> => {
    const queryParams = new URLSearchParams();

    // Add export parameters (all optional)
    if (params.from) queryParams.append('from', params.from);
    if (params.to) queryParams.append('to', params.to);

    // Add any additional filter parameters
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['from', 'to'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    

    const queryString = queryParams.toString();
    // URL works with or without query parameters - exports all material indents if no params provided
    const url = `/inventory/material-indents/export/xlsx${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    return response.data;
  },
};

export default materialIndentsApi;
