import api from './axios';
import {
  Vehicle,
  VehicleExpense,
  CreateVehicleRequest,
  CreateVehicleExpenseRequest,
  PaginatedResponse,
  QueryParams,
  VehicleType,
  CreateVehicleTypeRequest,
  UpdateVehicleTypeRequest,
  ExpenseCategory,
  CreateExpenseCategoryRequest,
  UpdateExpenseCategoryRequest,
} from './types';

export const fleetApi = {
  /**
   * Get all vehicles with pagination
   * @param params Query parameters for pagination, sorting, and filtering
   * @returns Promise with paginated vehicles response
   */
  getAllVehicles: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<Vehicle>> => {
    const queryParams = new URLSearchParams();

    // Add pagination and sorting parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.search) queryParams.append('search', params.search);

    // Add new filter parameters (status, vehicleTypeId)
    if (params.status) queryParams.append('status', params.status.toString());
    if (params.vehicleTypeId) queryParams.append('vehicleTypeId', params.vehicleTypeId.toString());

    // Add any additional filter parameters
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder', 'search', 'status', 'vehicleTypeId'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    // Include createdBy in the response to get user information
    queryParams.append('include', 'createdBy');

    const queryString = queryParams.toString();
    const url = `/fleet/vehicles${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<Vehicle>>(url);
    return response.data;
  },

  /**
   * Get vehicle by ID
   * @param id Vehicle ID
   * @returns Promise with vehicle
   */
  getVehicleById: async (id: number): Promise<Vehicle> => {
    const response = await api.get<Vehicle>(`/fleet/vehicles/${id}?include=createdBy`);
    return response.data;
  },

  /**
   * Create new vehicle
   * @param vehicle Vehicle data
   * @returns Promise with created vehicle
   */
  createVehicle: async (
    vehicle: CreateVehicleRequest
  ): Promise<Vehicle> => {
    const response = await api.post<Vehicle>('/fleet/vehicles', vehicle);
    return response.data;
  },

  /**
   * Update vehicle
   * @param id Vehicle ID
   * @param vehicle Vehicle data to update
   * @returns Promise with updated vehicle
   */
  updateVehicle: async (
    id: number,
    vehicle: Partial<CreateVehicleRequest>
  ): Promise<Vehicle> => {
    const response = await api.patch<Vehicle>(
      `/fleet/vehicles/${id}`,
      vehicle
    );
    return response.data;
  },

  /**
   * Delete vehicle
   * @param id Vehicle ID
   */
  deleteVehicle: async (id: number): Promise<void> => {
    await api.delete(`/fleet/vehicles/${id}`);
  },

  /**
   * Export vehicles to XLSX
   * @param from Start date (YYYY-MM-DD)
   * @param to End date (YYYY-MM-DD)
   * @returns Promise with blob data
   */
  exportVehicles: async (from?: string, to?: string): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);
    
    const queryString = queryParams.toString();
    const url = `/fleet/vehicles/export/xlsx${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    return response.data;
  },

  /**
   * Get all vehicle expenses with pagination
   * @param params Query parameters for pagination, sorting, and filtering
   * @returns Promise with paginated vehicle expenses response
   */
  getAllVehicleExpenses: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<VehicleExpense>> => {
    const queryParams = new URLSearchParams();

    // Add pagination and sorting parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.search) queryParams.append('search', params.search);

    // Add new filter parameters (categoryId, vehicleId)
    if (params.categoryId) queryParams.append('categoryId', params.categoryId.toString());
    if (params.vehicleId) queryParams.append('vehicleId', params.vehicleId.toString());

    // Add any additional filter parameters
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder', 'search', 'categoryId', 'vehicleId'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = `/fleet/vehicle-expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<VehicleExpense>>(url);
    return response.data;
  },

  /**
   * Get vehicle expense by ID
   * @param id Vehicle Expense ID
   * @returns Promise with vehicle expense
   */
  getVehicleExpenseById: async (id: number): Promise<VehicleExpense> => {
    const response = await api.get<VehicleExpense>(
      `/fleet/vehicle-expenses/${id}`
    );
    return response.data;
  },

  /**
   * Create new vehicle expense
   * @param expense Vehicle expense data with optional files
   * @returns Promise with created vehicle expense
   */
  createVehicleExpense: async (
    expense: CreateVehicleExpenseRequest
  ): Promise<VehicleExpense> => {
    // Create FormData if files are present
    if (expense.files && expense.files.length > 0) {
      const formData = new FormData();

      // Add all expense fields to FormData
      Object.entries(expense).forEach(([key, value]) => {
        if (key !== 'files' && value !== undefined && value !== null) {
          if (value instanceof File || value instanceof FileList) {
            // Skip files here, handle separately
            return;
          } else if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // Append files
      expense.files.forEach((file) => {
        if (file instanceof File) {
          formData.append('files', file);
        }
      });

      const response = await api.post<VehicleExpense>(
        '/fleet/vehicle-expenses',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } else {
      // Regular JSON request if no files
      const response = await api.post<VehicleExpense>(
        '/fleet/vehicle-expenses',
        expense
      );
      return response.data;
    }
  },

  /**
   * Update vehicle expense
   * @param id Vehicle Expense ID
   * @param expense Vehicle expense data to update
   * @returns Promise with updated vehicle expense
   */
  updateVehicleExpense: async (
    id: number,
    expense: Partial<CreateVehicleExpenseRequest>
  ): Promise<VehicleExpense> => {
    // Create FormData if files are present
    if (expense.files && expense.files.length > 0) {
      const formData = new FormData();

      // Add all expense fields to FormData
      Object.entries(expense).forEach(([key, value]) => {
        if (key !== 'files' && value !== undefined && value !== null) {
          if (value instanceof File || value instanceof FileList) {
            return;
          } else if (typeof value === 'object') {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // Append files
      expense.files.forEach((file) => {
        if (file instanceof File) {
          formData.append('files', file);
        }
      });

      const response = await api.patch<VehicleExpense>(
        `/fleet/vehicle-expenses/${id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data;
    } else {
      // Regular JSON request if no files
      const response = await api.patch<VehicleExpense>(
        `/fleet/vehicle-expenses/${id}`,
        expense
      );
      return response.data;
    }
  },

  /**
   * Delete vehicle expense
   * @param id Vehicle Expense ID
   */
  deleteVehicleExpense: async (id: number): Promise<void> => {
    await api.delete(`/fleet/vehicle-expenses/${id}`);
  },

  /**
   * Export vehicle expenses to XLSX
   * @param from Start date (YYYY-MM-DD)
   * @param to End date (YYYY-MM-DD)
   * @returns Promise with blob data
   */
  exportVehicleExpenses: async (from?: string, to?: string): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);
    
    const queryString = queryParams.toString();
    const url = `/fleet/vehicle-expenses/export/xlsx${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
    return response.data;
  },

  /**
   * Vehicle Types Management
   */

  /**
   * Get all vehicle types with pagination
   * @param params Query parameters for pagination, sorting, and filtering
   * @returns Promise with paginated vehicle types response
   */
  getAllVehicleTypes: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<VehicleType>> => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `/fleet/vehicle-types${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<VehicleType>>(url);
    return response.data;
  },

  /**
   * Get vehicle type by ID
   * @param id Vehicle type ID
   * @returns Promise with vehicle type
   */
  getVehicleTypeById: async (id: number): Promise<VehicleType> => {
    const response = await api.get<VehicleType>(`/fleet/vehicle-types/${id}`);
    return response.data;
  },

  /**
   * Create new vehicle type
   * @param vehicleType Vehicle type data
   * @returns Promise with created vehicle type
   */
  createVehicleType: async (
    vehicleType: CreateVehicleTypeRequest
  ): Promise<VehicleType> => {
    const response = await api.post<VehicleType>('/fleet/vehicle-types', vehicleType);
    return response.data;
  },

  /**
   * Update vehicle type
   * @param id Vehicle type ID
   * @param vehicleType Vehicle type data to update
   * @returns Promise with updated vehicle type
   */
  updateVehicleType: async (
    id: number,
    vehicleType: UpdateVehicleTypeRequest
  ): Promise<VehicleType> => {
    const response = await api.patch<VehicleType>(
      `/fleet/vehicle-types/${id}`,
      vehicleType
    );
    return response.data;
  },

  /**
   * Delete vehicle type
   * @param id Vehicle type ID
   */
  deleteVehicleType: async (id: number): Promise<void> => {
    await api.delete(`/fleet/vehicle-types/${id}`);
  },

  /**
   * Expense Categories Management
   */

  /**
   * Get all expense categories with pagination
   * @param params Query parameters for pagination, sorting, and filtering
   * @returns Promise with paginated expense categories response
   */
  getAllExpenseCategories: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<ExpenseCategory>> => {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    if (params.search) queryParams.append('search', params.search);

    const queryString = queryParams.toString();
    const url = `/fleet/expense-categories${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<ExpenseCategory>>(url);
    return response.data;
  },

  /**
   * Get expense category by ID
   * @param id Expense category ID
   * @returns Promise with expense category
   */
  getExpenseCategoryById: async (id: number): Promise<ExpenseCategory> => {
    const response = await api.get<ExpenseCategory>(`/fleet/expense-categories/${id}`);
    return response.data;
  },

  /**
   * Create new expense category
   * @param category Expense category data
   * @returns Promise with created expense category
   */
  createExpenseCategory: async (
    category: CreateExpenseCategoryRequest
  ): Promise<ExpenseCategory> => {
    const response = await api.post<ExpenseCategory>('/fleet/expense-categories', category);
    return response.data;
  },

  /**
   * Update expense category
   * @param id Expense category ID
   * @param category Expense category data to update
   * @returns Promise with updated expense category
   */
  updateExpenseCategory: async (
    id: number,
    category: UpdateExpenseCategoryRequest
  ): Promise<ExpenseCategory> => {
    const response = await api.patch<ExpenseCategory>(
      `/fleet/expense-categories/${id}`,
      category
    );
    return response.data;
  },

  /**
   * Delete expense category
   * @param id Expense category ID
   */
  deleteExpenseCategory: async (id: number): Promise<void> => {
    await api.delete(`/fleet/expense-categories/${id}`);
  },
};

export default fleetApi;

