import api from './axios';
import { Branch, Material, Machine } from './types';

// Dashboard Types
export interface ExpenseData {
  total: number;
  period: string;
  comparison: string;
}

export interface MaterialExpenseByUnit {
  materialType: string;
  unitOneAmount: number;
  unitTwoAmount: number;
}

export interface MachineExpenseByUnit {
  machineType: string;
  unitOneAmount: number;
  unitTwoAmount: number;
}

export interface DashboardExpensesResponse {
  totalExpenses: ExpenseData;
  unitOneExpenses: ExpenseData;
  unitTwoExpenses: ExpenseData;
  machineExpensesByUnit: MachineExpenseByUnit[];
  machineTotalExpenses: any[];
  materialExpensesByUnit: MaterialExpenseByUnit[];
}

export interface DashboardStats {
  totalExpenses: number;
  pendingApprovals: number;
  totalBranches: number;
  totalMaterials: number;
  totalMachines: number;
}

export interface BranchExpenseData {
  branchId: number;
  branchName: string;
  branchCode: string;
  totalExpenses: number;
  materialExpenses: number;
  machineExpenses: number;
  pendingApprovals: number;
}

export interface MaterialExpenseData {
  materialId: number;
  materialName: string;
  specifications: string;
  makerBrand: string;
  totalExpenses: number;
  branchExpenses: { [branchId: number]: number };
}

export interface MachineExpenseData {
  machineId: number;
  machineName: string;
  specifications: string;
  manufacturer: string;
  totalExpenses: number;
  branchExpenses: { [branchId: number]: number };
}

export interface DashboardData {
  stats: DashboardStats;
  branchExpenses: BranchExpenseData[];
  materialExpenses: MaterialExpenseData[];
  machineExpenses: MachineExpenseData[];
  timePeriod: string;
  periodStart: string;
  periodEnd: string;
}

export interface DashboardQueryParams {
  dateRangeType?: 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'custom';
  startDate?: string;
  endDate?: string;
  unitId?: number;
  machineId?: number;
}

export interface VehicleExpenseData {
  total: number;
  period?: string;
  comparison?: string;
}

export interface VehicleExpenseBreakdown {
  registrationNumber: string;
  make: string;
  amount: number;
  unitOneAmount?: number;
  unitTwoAmount?: number;
}

export interface VehicleExpenseTotalData {
  total: number;
  period: string;
  comparison: string;
  units: string;
}

export interface VehicleExpensesResponse {
  totalExpenses: VehicleExpenseTotalData;
  vehicleExpenses: VehicleExpenseBreakdown[];
}

export const dashboardApi = {
  /**
   * Get expenses data with various filters
   */
  getExpenses: async (params: DashboardQueryParams = {}): Promise<DashboardExpensesResponse> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<DashboardExpensesResponse>(url);
    return response.data;
  },

  /**
   * Get dashboard data for company owner
   */
  getDashboardData: async (params: DashboardQueryParams = {}): Promise<DashboardData> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/company-owner${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<DashboardData>(url);
    return response.data;
  },

  /**
   * Get pending approvals count
   */
  getPendingApprovals: async (): Promise<{ count: number; items: any[] }> => {
    const response = await api.get('/dashboard/pending-approvals');
    return response.data;
  },

  /**
   * Get expenses by branch
   */
  getBranchExpenses: async (params: DashboardQueryParams = {}): Promise<BranchExpenseData[]> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/branch-expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<BranchExpenseData[]>(url);
    return response.data;
  },

  /**
   * Get material expenses breakdown
   */
  getMaterialExpenses: async (params: DashboardQueryParams = {}): Promise<MaterialExpenseData[]> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/material-expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<MaterialExpenseData[]>(url);
    return response.data;
  },

  /**
   * Get machine expenses breakdown
   */
  getMachineExpenses: async (params: DashboardQueryParams = {}): Promise<MachineExpenseData[]> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/machine-expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<MachineExpenseData[]>(url);
    return response.data;
  },

  /**
   * Get weighted average price for materials
   * Formula: Weighted Avg price = (Qty1 * Price1 + Qty2 * Price2 + Qty3 * Price3) / Total Qty
   */
  getWeightedAveragePrices: async (params: DashboardQueryParams = {}): Promise<{
    materialId: number;
    materialName: string;
    weightedAveragePrice: number;
    totalQuantity: number;
    totalValue: number;
  }[]> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());
    if (params.machineId) queryParams.append('machineId', params.machineId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/weighted-average-prices${queryString ? `?${queryString}` : ''}`;

    const response = await api.get(url);
    return response.data;
  },

  /**
   * Get total vehicle expenses with breakdown
   * GET /dashboard/vehicle-expenses?dateRangeType=this_month&startDate=2024-01-01&endDate=2024-01-31
   * Returns: { totalExpenses: { total, period, comparison, units }, vehicleExpenses: [...] }
   */
  getVehicleExpenses: async (params: DashboardQueryParams = {}): Promise<VehicleExpensesResponse> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/vehicle-expenses${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<VehicleExpensesResponse>(url);
    return response.data;
  },

  /**
   * Get vehicle expenses breakdown by individual vehicles (legacy endpoint, kept for backward compatibility)
   * GET /dashboard/vehicle-expenses/breakdown?dateRangeType=this_month
   */
  getVehicleExpensesBreakdown: async (params: DashboardQueryParams = {}): Promise<VehicleExpenseBreakdown[]> => {
    const queryParams = new URLSearchParams();

    if (params.dateRangeType) queryParams.append('dateRangeType', params.dateRangeType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.unitId) queryParams.append('unitId', params.unitId.toString());

    const queryString = queryParams.toString();
    const url = `/dashboard/vehicle-expenses/breakdown${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<VehicleExpenseBreakdown[]>(url);
    return response.data;
  }
};

export default dashboardApi;