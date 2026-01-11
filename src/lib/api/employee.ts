import api from './axios';
import {
  Employee,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  Department,
  CreateDepartmentRequest,
  Position,
  CreatePositionRequest,
  Attendance,
  CreateAttendanceRequest,
  UpdateAttendanceRequest,
  MarkAllPresentRequest,
  PaginatedResponse,
  QueryParams,
} from './types';

export const employeeApi = {
  /**
   * Get all employees with pagination and filters
   * @param params Query parameters for pagination, sorting, and filters
   * @returns Promise with paginated employees response
   */
  getAllEmployees: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<Employee>> => {
    const queryParams = new URLSearchParams();

    // Add pagination and sorting parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    // Add any additional filter parameters
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = `/employee-management/employees${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<Employee>>(url);
    return response.data;
  },

  /**
   * Get employee by ID
   * @param id Employee ID
   * @returns Promise with employee
   */
  getEmployeeById: async (id: number): Promise<Employee> => {
    const response = await api.get<Employee>(
      `/employee-management/employees/${id}`
    );
    return response.data;
  },

  /**
   * Create a new employee
   * @param employee Employee data
   * @returns Promise with created employee
   */
  createEmployee: async (
    employee: CreateEmployeeRequest
  ): Promise<Employee> => {
    const response = await api.post<Employee>(
      '/employee-management/employees',
      employee
    );
    return response.data;
  },

  /**
   * Update an employee
   * @param id Employee ID
   * @param employee Employee data to update
   * @returns Promise with updated employee
   */
  updateEmployee: async (
    id: number,
    employee: UpdateEmployeeRequest
  ): Promise<Employee> => {
    const response = await api.patch<Employee>(
      `/employee-management/employees/${id}`,
      employee
    );
    return response.data;
  },

  /**
   * Get all departments with pagination and filters
   * @param params Query parameters for pagination, sorting, and filters (companyId, search, etc.)
   * @returns Promise with paginated departments response
   */
  getAllDepartments: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<Department>> => {
    const queryParams = new URLSearchParams();

    // Add pagination and sorting parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    // Add any additional filter parameters (companyId, search, etc.)
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = `/employee-management/departments${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<Department>>(url);
    return response.data;
  },

  /**
   * Get department by ID
   * @param id Department ID
   * @returns Promise with department
   */
  getDepartmentById: async (id: number): Promise<Department> => {
    const response = await api.get<Department>(
      `/employee-management/departments/${id}`
    );
    return response.data;
  },

  /**
   * Create a new department
   * @param department Department data
   * @returns Promise with created department
   */
  createDepartment: async (
    department: CreateDepartmentRequest
  ): Promise<Department> => {
    const response = await api.post<Department>(
      '/employee-management/departments',
      department
    );
    return response.data;
  },

  /**
   * Get all positions with pagination and filters
   * @param params Query parameters for pagination, sorting, and filters (companyId, search, etc.)
   * @returns Promise with paginated positions response
   */
  getAllPositions: async (
    params: QueryParams = {}
  ): Promise<PaginatedResponse<Position>> => {
    const queryParams = new URLSearchParams();

    // Add pagination and sorting parameters
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    // Add any additional filter parameters (companyId, search, etc.)
    Object.entries(params).forEach(([key, value]) => {
      if (
        !['page', 'limit', 'sortBy', 'sortOrder'].includes(key) &&
        value !== undefined
      ) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    const url = `/employee-management/positions${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<PaginatedResponse<Position>>(url);
    return response.data;
  },

  /**
   * Get position by ID
   * @param id Position ID
   * @returns Promise with position
   */
  getPositionById: async (id: number): Promise<Position> => {
    const response = await api.get<Position>(
      `/employee-management/positions/${id}`
    );
    return response.data;
  },

  /**
   * Create a new position
   * @param position Position data
   * @returns Promise with created position
   */
  createPosition: async (
    position: CreatePositionRequest
  ): Promise<Position> => {
    const response = await api.post<Position>(
      '/employee-management/positions',
      position
    );
    return response.data;
  },

  /**
   * Get attendance for a single employee
   * @param params Query parameters (employeeId, year, month)
   * @returns Promise with attendance
   */
  getAttendance: async (
    params: { employeeId: number; year: number; month: number }
  ): Promise<Attendance> => {
    const queryParams = new URLSearchParams();
    queryParams.append('employeeId', params.employeeId.toString());
    queryParams.append('year', params.year.toString());
    queryParams.append('month', params.month.toString());

    const url = `/employee-management/attendance?${queryParams.toString()}`;
    const response = await api.get<Attendance>(url);
    return response.data;
  },

  /**
   * Get attendance by month for all employees
   * @param params Query parameters (companyId, year, month)
   * @returns Promise with paginated attendance response
   */
  getAttendanceByMonth: async (
    params: { companyId: number; year: number; month: number }
  ): Promise<PaginatedResponse<Attendance>> => {
    const queryParams = new URLSearchParams();
    queryParams.append('companyId', params.companyId.toString());
    queryParams.append('year', params.year.toString());
    queryParams.append('month', params.month.toString());

    const url = `/employee-management/attendance/month?${queryParams.toString()}`;
    const response = await api.get<PaginatedResponse<Attendance>>(url);
    return response.data;
  },

  /**
   * Create new attendance records
   * @param attendance Attendance data
   * @returns Promise with created attendance
   */
  createAttendance: async (
    attendance: CreateAttendanceRequest
  ): Promise<Attendance> => {
    const response = await api.post<Attendance>(
      '/employee-management/attendance',
      attendance
    );
    return response.data;
  },

  /**
   * Update attendance
   * @param id Attendance ID
   * @param attendance Attendance data to update
   * @returns Promise with updated attendance
   */
  updateAttendance: async (
    id: number,
    attendance: UpdateAttendanceRequest
  ): Promise<Attendance> => {
    const response = await api.patch<Attendance>(
      `/employee-management/attendance/${id}`,
      attendance
    );
    return response.data;
  },

  /**
   * Mark all employees as present for a specific day
   * @param markAllPresent Mark all present data
   * @returns Promise with response
   */
  markAllPresent: async (
    markAllPresent: MarkAllPresentRequest
  ): Promise<any> => {
    const response = await api.post(
      '/employee-management/attendance/mark-all-present',
      markAllPresent
    );
    return response.data;
  },

  /**
   * Export employees to Excel file
   * @param params Export parameters (optional) - if no params provided, exports all employees
   * @returns Promise with blob data for Excel file download
   * 
   * Automatically includes proper headers:
   * - Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   * - Authorization: Bearer token (from localStorage via axios interceptor)
   * 
   * @example
   * ```typescript
   * // Export all employees (no parameters needed)
   * const blob = await employeeApi.exportToExcel();
   * 
   * // Export employees with filters
   * const blob = await employeeApi.exportToExcel({
   *   companyId: 1,
   *   branchId: 2,
   *   employmentType: 'permanent'
   * });
   * 
   * // Create download link
   * const url = window.URL.createObjectURL(blob);
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = 'employees-export.xlsx';
   * link.click();
   * window.URL.revokeObjectURL(url);
   * ```
   */
  exportToExcel: async (params: QueryParams = {}): Promise<Blob> => {
    const queryParams = new URLSearchParams();

    // Add export parameters (all optional)
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const queryString = queryParams.toString();
    // URL works with or without query parameters - exports all employees if no params provided
    const url = `/employee-management/employees/export/xlsx${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    return response.data;
  },

  /**
   * Export attendance to Excel file
   * @param params Export parameters (companyId, year, month, branchId optional)
   * @returns Promise with blob data for Excel file download
   * 
   * Automatically includes proper headers:
   * - Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
   * - Authorization: Bearer token (from localStorage via axios interceptor)
   * 
   * @example
   * ```typescript
   * // Export attendance for a specific month
   * const blob = await employeeApi.exportAttendanceToExcel({
   *   companyId: 1,
   *   year: 2025,
   *   month: 12
   * });
   * 
   * // Export attendance with branch filter
   * const blob = await employeeApi.exportAttendanceToExcel({
   *   companyId: 1,
   *   year: 2025,
   *   month: 12,
   *   branchId: 2
   * });
   * 
   * // Create download link
   * const url = window.URL.createObjectURL(blob);
   * const link = document.createElement('a');
   * link.href = url;
   * link.download = 'attendance-export.xlsx';
   * link.click();
   * window.URL.revokeObjectURL(url);
   * ```
   */
  exportAttendanceToExcel: async (
    params: { companyId: number; year: number; month: number; branchId?: number }
  ): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    queryParams.append('companyId', params.companyId.toString());
    queryParams.append('year', params.year.toString());
    queryParams.append('month', params.month.toString());
    
    if (params.branchId) {
      queryParams.append('branchId', params.branchId.toString());
    }

    const queryString = queryParams.toString();
    const url = `/employee-management/attendance/export/xlsx?${queryString}`;

    const response = await api.get(url, {
      responseType: 'blob',
      headers: {
        'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

    return response.data;
  },
};

export default employeeApi;

