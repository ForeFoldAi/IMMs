/* eslint-disable @typescript-eslint/no-explicit-any */
// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface User {
  id: number;
  name: string;
  email: string;
  company: Company;
  branch: Branch;
  userType: UserType;
  roles: Role[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  address: string;
  contactEmail: string | null;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: number;
  name: string;
  code?: string;
  location: string;
  contactPhone: string | null;
  company?: Company;
  createdAt: string;
  updatedAt: string;
}

export interface UserType {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
  isCompanyLevel: boolean;
  isBranchLevel: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: number;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: number;
  name: string;
}

// Pagination Types
export interface PaginationMeta {
  page: number;
  limit: number;
  itemCount: number;
  pageCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// Query Parameters
export interface QueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  [key: string]: any;
}

// Export Parameters
export interface ExportParams {
  from?: string;
  to?: string;
  [key: string]: any;
}

// Machine Types
export enum MachineStatus {
  ACTIVE = 'Active',
  UNDER_MAINTENANCE = 'Under Maintenance',
  INACTIVE = 'Inactive',
}

export interface MachineType {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Machine {
  id: number;
  name: string;
  status: string;
  specifications: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity: string;
  purchaseDate: string;
  warrantyExpiry: string;
  installationDate: string;
  lastService: string | null;
  nextMaintenanceDue: string | null;
  additionalNotes: string;
  createdAt: string;
  updatedAt: string;
  type?: MachineType;
  unit?: Unit;
  branch: Branch;
  typeId?: number;
  unitId?: number;
  branchId?: number;
}

export interface MaterialCategory {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Material types used by MaterialsTab
export interface Material {
  id: number;
  name: string;
  specifications: string;
  unit?: string;
  unitId?: number;
  categoryId?: number;
  measureUnitId?: number;
  measureUnit?: {
    id: number;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
  };
  makerBrand: string;
  currentStock: number;
  totalValue?: number;
  averageValue?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialIssueItem {
  id: number;
  issuedQuantity: number;
  stockBeforeIssue: number;
  stockAfterIssue: number;
  receiverName: string;
  imagePath?: string;
  purpose: string;
  createdAt: string;
  updatedAt: string;
  material: Material;
  branch: Branch;
  // Updated to match the new API response structure
  issuedFor?: {
    id: number;
    name: string;
    status: string;
    specifications: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    capacity: string;
    purchaseDate: string;
    warrantyExpiry: string;
    installationDate: string;
    lastService: string;
    nextMaintenanceDue: string;
    additionalNotes: string;
    createdAt: string;
    updatedAt: string;
  };
  // Keep these for backward compatibility or if the API still returns them
  machineId?: number;
  machineName?: string;
  purposeType?: PurposeType;
  notes?: string;
}

export interface MaterialIssue {
  id: number;
  uniqueId: string;
  issuedBy: User;
  issueDate: string;
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
  items: MaterialIssueItem[];
  branch: Branch;
}

export interface VendorQuotation {
  id: number;
  vendorName: string;
  contactPerson: string;
  phone: string;
  price: string;
  quotationAmount: string;
  filePaths: string[];
  notes: string;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialPurchase {
  id: number;
  uniqueId: string;
  orderDate: string;
  totalValue: string;
  purchaseOrderNumber: string;
  additionalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialIndentItem {
  id: number;
  specifications: string;
  currentStock: number;
  requestedQuantity: number;
  notes: string;
  imagePaths: string[];
  purposeType?: string; // 'machine', 'spare', 'other', or 'return'
  machineName?: string; // For cases like "Spare" or "Other" where machineId doesn't exist
  createdAt: string;
  updatedAt: string;
  material: Material;
  machine?: Machine; // Made optional since it may not exist for spare/other/return
  quotations: VendorQuotation[];
  selectedQuotation?: VendorQuotation;
}

export interface MaterialIndent {
  partialReceiptHistory: any[];
  totalReceivedQuantity?: number; // Add this line
  id: number;
  uniqueId: string;
  requestDate: string;
  status: string;
  approvalDate?: string;
  rejectionReason?: string;
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
  requestedBy: User;
  approvedBy?: User;
  branch: Branch;
  items: MaterialIndentItem[];
  purchases: MaterialPurchase[];
}

// Create Material Indent payloads (for FormData JSON fields)
export interface CreateVendorQuotationInput {
  vendorName: string;
  contactPerson?: string;
  phone?: string;
  price: number | string;
  imageCount?: number; // number of files appended under quotationFiles for this quotation
  quotationAmount: number | string;
  notes?: string;
}

export enum PurposeType {
  MACHINE = 'machine',
  OTHER = 'other',
  SPARE = 'spare',
  RETURN = 'return',
}

export interface CreateMaterialIndentItemInput {
  materialId: number;
  specifications?: string;
  requestedQuantity: number;
  purposeType: PurposeType;
  machineId?: number;
  machineName?: string; // For cases like "Spare" or "Other" where machineId doesn't exist
  itemImageCount?: number; // number of files appended under itemFiles for this item
  vendorQuotations?: CreateVendorQuotationInput[];
  notes?: string;
}

export interface CreateMaterialIndentRequest {
  additionalNotes?: string;
  items: CreateMaterialIndentItemInput[];
  status?: string; // e.g., pending_approval
}

// Material Purchase Item Types
export interface MaterialPurchaseItem {
  id: number;
  materialId: number;
  materialName: string;
  specifications: string;
  orderedQuantity: number;
  receivedQuantity: number;
  pendingQuantity: number;
  unitPrice: string;
  totalPrice: string;
  status: 'pending' | 'partially_received' | 'fully_received';
  receivedDate?: string;
  receivedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  material: Material;
}

// Enhanced Material Purchase interface
export interface MaterialPurchase {
  id: number;
  uniqueId: string;
  orderDate: string;
  totalValue: string;
  purchaseOrderNumber: string;
  status: 'pending' | 'partially_received' | 'fully_received';
  additionalNotes: string;
  createdAt: string;
  updatedAt: string;
  items: MaterialPurchaseItem[];
  branch: Branch;
  createdBy: User;
}

// Create Material Purchase Request
export interface CreateMaterialPurchaseRequest {
  purchaseOrderNumber: string;
  orderDate: string;
  additionalNotes?: string;
  indentId: number;
}

export interface CreateMaterialPurchaseItemInput {
  materialId: number;
  orderedQuantity: number;
  unitPrice: string;
  notes?: string;
}

// Receive Material Purchase Item Request
export interface ReceiveMaterialPurchaseItemRequest {
  receivedQuantity: number;
  receivedDate: string;
  notes?: string;
}

// Receive Material Purchase Item Response
export interface ReceiveMaterialPurchaseItemResponse {
  id: number;
  receivedQuantity: number;
  pendingQuantity: number;
  status: 'pending' | 'partially_received' | 'fully_received';
  receivedDate: string;
  receivedBy: string;
  notes?: string;
  updatedAt: string;
  material: Material;
}

// Approve/Reject Material Indent Request
export interface ApproveRejectMaterialIndentRequest {
  status: 'approved' | 'reverted';
  rejectionReason?: string;
  itemId: number;
  quotationId: number;
}

// Approve/Reject Material Indent Response
export interface ApproveRejectMaterialIndentResponse {
  id: number;
  uniqueId: string;
  status: string;
  approvalDate?: string;
  rejectionReason?: string;
  updatedAt: string;
  approvedBy?: User;
  items: MaterialIndentItem[];
}

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

// Fleet Management Types
export enum VehicleStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  MAINTENANCE = 'Maintenance',
}

// Vehicle Type Management
export interface VehicleType {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleTypeRequest {
  name: string;
}

export interface UpdateVehicleTypeRequest {
  name: string;
}

// Expense Category Management
export interface ExpenseCategory {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseCategoryRequest {
  name: string;
}

export interface UpdateExpenseCategoryRequest {
  name: string;
}

export interface Vehicle {
  id: number;
  registrationNumber: string;
  make: string;
  model: string;
  vehicleType: string | { id: number; name: string }; // Can be string (legacy) or object (new API)
  vehicleTypeId?: number;
  fuelType: string;
  status: string;
  year: number;
  engineNumber: string;
  chassisNumber: string;
  loadCapacityMt: string;
  purchaseDate: string;
  insuranceProvider: string;
  policyNumber: string;
  insuranceExpiryDate: string;
  additionalNotes?: string;
  createdAt: string;
  updatedAt: string;
  branch?: Branch;
  createdBy?: User; // User who created/submitted the vehicle
}

export interface CreateVehicleRequest {
  registrationNumber: string;
  make: string;
  model: string;
  vehicleTypeId?: number; // Changed from vehicleType (string) to vehicleTypeId (number, optional)
  fuelType: string;
  status: string;
  year: number;
  engineNumber?: string;
  chassisNumber?: string;
  loadCapacityMt?: string;
  purchaseDate?: string; // Optional - must be valid ISO 8601 date string if provided
  insuranceProvider?: string;
  policyNumber?: string;
  insuranceExpiryDate?: string; // Optional - must be valid ISO 8601 date string if provided
  additionalNotes?: string;
}

export interface VehicleExpense {
  id: number;
  expenseCode?: string; // Expense code from API
  vehicleId: number;
  expenseDate: string;
  category: string | { id: number; name: string }; // Can be string (legacy) or object (new API)
  categoryId?: number;
  expenseType: string;
  amount: number;
  location: string;
  requestedBy: string;
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  paymentMethod: string;
  paymentReference: string;
  additionalNotes?: string;
  filePaths?: string[]; // Deprecated: Use attachments and attachmentUrls instead
  attachments?: string[]; // File paths from API
  attachmentUrls?: string[]; // Full presigned URLs for image preview
  createdAt: string;
  updatedAt: string;
  vehicle?: Vehicle;
  createdBy?: User; // User who created/submitted the expense
}

export interface CreateVehicleExpenseRequest {
  vehicleId: number;
  expenseDate: string;
  categoryId?: number; // Changed from category (string) to categoryId (number, optional)
  expenseType: string;
  amount: string; // API expects "number string" format
  location: string;
  requestedBy: string;
  vendorName: string;
  vendorContact: string;
  vendorAddress: string;
  paymentMethod: string;
  paymentReference: string;
  additionalNotes?: string;
  files?: File[];
}

// Employee Management Enums
export enum EmploymentType {
  PERMANENT = 'permanent',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  INTERN = 'intern',
  TERMINATED = 'terminated',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
 
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  
}

// Employee Management Types
export interface Employee {
  id: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  joiningDate: string;
  employmentType: EmploymentType;
  companyId: number;
  branchId: number;
  departmentId: number;
  positionId: number;
  createdAt: string;
  updatedAt: string;
  company?: Company;
  branch?: Branch;
  department?: Department;
  position?: Position;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  joiningDate: string;
  employmentType: EmploymentType;
  companyId: number;
  branchId: number;
  departmentId: number;
  positionId: number;
}

export interface Department {
  id: number;
  name: string;
  description: string;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export interface CreateDepartmentRequest {
  name: string;
  description: string;
  companyId: number;
}

export interface Position {
  id: number;
  name: string;
  description: string;
  companyId: number;
  createdAt: string;
  updatedAt: string;
  company?: Company;
}

export interface CreatePositionRequest {
  name: string;
  description: string;
  companyId: number;
}

export interface AttendanceRecord {
  day: number;
  status: AttendanceStatus;
  remark: string | null;
}

export interface Attendance {
  id: number;
  employeeId: number;
  year: number;
  month: number;
  records: AttendanceRecord[];
  remark?: string | null; // Month-level remark (one per month per employee)
  createdAt: string;
  updatedAt: string;
  employee?: Employee;
}

export interface CreateAttendanceRequest {
  employeeId: number;
  year: number;
  month: number;
  records: AttendanceRecord[];
  remark?: string | null; // Month-level remark (one per month per employee)
}

export interface MarkAllPresentRequest {
  companyId: number;
  year: number;
  month: number;
  day: number;
  branchId: number;
}

export interface UpdateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  joiningDate?: string;
  employmentType?: EmploymentType;
  companyId?: number;
  branchId?: number;
  departmentId?: number;
  positionId?: number;
}

export interface UpdateAttendanceRequest {
  employeeId?: number;
  year?: number;
  month?: number;
  records?: AttendanceRecord[];
  remark?: string | null; // Month-level remark (one per month per employee)
}
