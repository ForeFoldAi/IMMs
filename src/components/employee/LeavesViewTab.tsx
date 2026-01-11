import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  Search,
  Download,
  Upload,
  Eye,
  Edit,
  MoreHorizontal,
  User,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  FileText,
  Plus,
  Filter,
  TrendingUp,
  TrendingDown,
  Users,
  Building,
  Briefcase,
  Phone,
  MapPin,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRole } from '@/contexts/RoleContext';
import { format, differenceInDays, addDays, isSameDay, startOfWeek, endOfWeek, addMonths } from 'date-fns';
import { employeeApi, branchesApi } from '@/lib/api';
import type { Employee as ApiEmployee, Branch } from '@/lib/api';

interface LeavesViewTabProps {
  // Props can be added here if needed
}

interface LeaveRequest {
  id: string;
  leaveNumber: string;
  
  // Employee Information
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  position: string;
  unit: string;
  
  // Leave Details
  leaveType: 'annual' | 'sick' | 'personal' | 'maternity' | 'emergency' | 'study' | 'bereavement' | 'compensatory';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  emergencyContact: string;
  emergencyPhone: string;
  
  // Work Coverage
  workCoverage: string;
  handoverNotes: string;
  
  // Approval Information
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: string;
  submittedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  rejectionReason?: string;
  approvalNotes?: string;
  
  // Additional Information
  attachments: string[];
  notes: string;
  
  // System Information
  createdAt: string;
  updatedAt: string;
}

type SortField = 'leaveNumber' | 'employeeName' | 'leaveType' | 'startDate' | 'endDate' | 'totalDays' | 'status' | 'submittedDate' | 'department' | 'unit' | 'createdAt' | 'updatedAt';
type SortOrder = 'ASC' | 'DESC';

export const LeavesViewTab = ({}: LeavesViewTabProps) => {
  const { currentUser, hasPermission } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [filteredLeaves, setFilteredLeaves] = useState<LeaveRequest[]>([]);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  
  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLeaveType, setFilterLeaveType] = useState('all');
  const [filterDateRange, setFilterDateRange] = useState('all');
  
  // Sorting and pagination
  const [sortField, setSortField] = useState<SortField>('submittedDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [branches, setBranches] = useState<Branch[]>([]);

  // TODO: Replace with leave API when available
  // Mock leave request data - Replace with actual API call
  const mockLeaveRequests: LeaveRequest[] = [
    {
      id: '1',
      leaveNumber: 'LEV-2024-001',
      employeeId: 'EMP001',
      employeeName: 'John Doe',
      employeeEmail: 'john.doe@company.com',
      department: 'Engineering',
      position: 'Senior Software Engineer',
      unit: 'Main Office',
      leaveType: 'annual',
      startDate: '2024-02-15',
      endDate: '2024-02-20',
      totalDays: 6,
      reason: 'Family vacation to Europe',
      emergencyContact: 'Jane Doe',
      emergencyPhone: '+1234567891',
      workCoverage: 'Mike Johnson will handle my tasks',
      handoverNotes: 'All pending code reviews assigned to Mike. Client meetings rescheduled.',
      status: 'approved',
      submittedBy: 'John Doe',
      submittedDate: '2024-01-15T09:00:00Z',
      approvedBy: 'Sarah Wilson',
      approvedDate: '2024-01-16T14:30:00Z',
      approvalNotes: 'Approved for family time. Ensure proper handover.',
      attachments: ['vacation-plan.pdf'],
      notes: 'First vacation in 2 years',
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-16T14:30:00Z'
    },
    {
      id: '2',
      leaveNumber: 'LEV-2024-002',
      employeeId: 'EMP002',
      employeeName: 'Jane Smith',
      employeeEmail: 'jane.smith@company.com',
      department: 'Marketing',
      position: 'Marketing Manager',
      unit: 'Branch Office',
      leaveType: 'sick',
      startDate: '2024-01-20',
      endDate: '2024-01-22',
      totalDays: 3,
      reason: 'Flu and fever, doctor advised rest',
      emergencyContact: 'Mike Smith',
      emergencyPhone: '+1234567893',
      workCoverage: 'David Brown will cover marketing activities',
      handoverNotes: 'Campaign launch postponed to next week',
      status: 'approved',
      submittedBy: 'Jane Smith',
      submittedDate: '2024-01-19T16:45:00Z',
      approvedBy: 'Sarah Wilson',
      approvedDate: '2024-01-19T17:00:00Z',
      approvalNotes: 'Get well soon. Health comes first.',
      attachments: ['medical-certificate.pdf'],
      notes: 'Will provide medical certificate',
      createdAt: '2024-01-19T16:45:00Z',
      updatedAt: '2024-01-19T17:00:00Z'
    },
    {
      id: '3',
      leaveNumber: 'LEV-2024-003',
      employeeId: 'EMP003',
      employeeName: 'Mike Johnson',
      employeeEmail: 'mike.johnson@company.com',
      department: 'Sales',
      position: 'Sales Executive',
      unit: 'Remote Office',
      leaveType: 'personal',
      startDate: '2024-02-01',
      endDate: '2024-02-03',
      totalDays: 3,
      reason: 'Personal matters requiring immediate attention',
      emergencyContact: 'Lisa Johnson',
      emergencyPhone: '+1234567895',
      workCoverage: 'Tom Wilson will handle client calls',
      handoverNotes: 'All pending deals updated in CRM',
      status: 'pending',
      submittedBy: 'Mike Johnson',
      submittedDate: '2024-01-25T11:30:00Z',
      attachments: [],
      notes: 'Urgent personal matter',
      createdAt: '2024-01-25T11:30:00Z',
      updatedAt: '2024-01-25T11:30:00Z'
    },
    {
      id: '4',
      leaveNumber: 'LEV-2024-004',
      employeeId: 'EMP004',
      employeeName: 'Sarah Wilson',
      employeeEmail: 'sarah.wilson@company.com',
      department: 'HR',
      position: 'HR Manager',
      unit: 'Head Office',
      leaveType: 'maternity',
      startDate: '2024-03-01',
      endDate: '2024-08-31',
      totalDays: 184,
      reason: 'Maternity leave for childbirth and recovery',
      emergencyContact: 'Robert Wilson',
      emergencyPhone: '+1234567897',
      workCoverage: 'External HR consultant will be hired',
      handoverNotes: 'All HR processes documented. Recruitment pipeline updated.',
      status: 'approved',
      submittedBy: 'Sarah Wilson',
      submittedDate: '2024-01-10T10:00:00Z',
      approvedBy: 'CEO',
      approvedDate: '2024-01-10T15:00:00Z',
      approvalNotes: 'Congratulations! Approved for full maternity leave.',
      attachments: ['maternity-certificate.pdf', 'medical-reports.pdf'],
      notes: 'Due date: March 15, 2024',
      createdAt: '2024-01-10T10:00:00Z',
      updatedAt: '2024-01-10T15:00:00Z'
    },
    {
      id: '5',
      leaveNumber: 'LEV-2024-005',
      employeeId: 'EMP005',
      employeeName: 'David Brown',
      employeeEmail: 'david.brown@company.com',
      department: 'Finance',
      position: 'Senior Accountant',
      unit: 'Main Office',
      leaveType: 'study',
      startDate: '2024-02-10',
      endDate: '2024-02-12',
      totalDays: 3,
      reason: 'Professional certification exam preparation',
      emergencyContact: 'Emily Brown',
      emergencyPhone: '+1234567899',
      workCoverage: 'Lisa Davis will handle accounting tasks',
      handoverNotes: 'Month-end closing procedures documented',
      status: 'rejected',
      submittedBy: 'David Brown',
      submittedDate: '2024-01-28T09:15:00Z',
      approvedBy: 'CFO',
      approvedDate: '2024-01-28T16:00:00Z',
      rejectionReason: 'Month-end closing period. Please reschedule after March 1st.',
      attachments: ['exam-schedule.pdf'],
      notes: 'CPA exam on February 12th',
      createdAt: '2024-01-28T09:15:00Z',
      updatedAt: '2024-01-28T16:00:00Z'
    },
    {
      id: '6',
      leaveNumber: 'LEV-2024-006',
      employeeId: 'EMP006',
      employeeName: 'Lisa Davis',
      employeeEmail: 'lisa.davis@company.com',
      department: 'Engineering',
      position: 'Senior Developer',
      unit: 'Branch Office',
      leaveType: 'bereavement',
      startDate: '2024-01-30',
      endDate: '2024-02-02',
      totalDays: 4,
      reason: 'Death of grandmother, attending funeral',
      emergencyContact: 'Tom Davis',
      emergencyPhone: '+1234567901',
      workCoverage: 'John Doe will handle development tasks',
      handoverNotes: 'All code reviews completed. No urgent deadlines.',
      status: 'approved',
      submittedBy: 'Lisa Davis',
      submittedDate: '2024-01-29T08:00:00Z',
      approvedBy: 'Sarah Wilson',
      approvedDate: '2024-01-29T09:00:00Z',
      approvalNotes: 'Our condolences. Take all the time you need.',
      attachments: ['funeral-invitation.pdf'],
      notes: 'Funeral on February 1st',
      createdAt: '2024-01-29T08:00:00Z',
      updatedAt: '2024-01-29T09:00:00Z'
    }
  ];

  // Get units from branches (with 'all' option)
  const units = useMemo(() => ['all', ...branches.map(b => b.name)], [branches]);
  const leaveTypes = ['all', 'annual', 'sick', 'personal', 'maternity', 'emergency', 'study', 'bereavement', 'compensatory'];
  const statusOptions = ['all', 'pending', 'approved', 'rejected', 'cancelled'];
  const dateRanges = ['all', 'today', 'this_week', 'this_month', 'next_month'];

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
  };

  const leaveTypeConfig = {
    annual: { label: 'Annual Leave', color: 'bg-blue-100 text-blue-800', icon: Calendar },
    sick: { label: 'Sick Leave', color: 'bg-red-100 text-red-800', icon: AlertCircle },
    personal: { label: 'Personal Leave', color: 'bg-purple-100 text-purple-800', icon: User },
    maternity: { label: 'Maternity Leave', color: 'bg-pink-100 text-pink-800', icon: Star },
    emergency: { label: 'Emergency Leave', color: 'bg-orange-100 text-orange-800', icon: Zap },
    study: { label: 'Study Leave', color: 'bg-green-100 text-green-800', icon: FileText },
    bereavement: { label: 'Bereavement Leave', color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
    compensatory: { label: 'Compensatory Leave', color: 'bg-indigo-100 text-indigo-800', icon: Clock },
  };

  // Load leave requests
  // Fetch branches
  useEffect(() => {
    const fetchBranches = async () => {
      if (!currentUser?.branch?.id) return;
      
      try {
        const storedUser = localStorage.getItem('user');
        let companyId = 1;
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            companyId = parsed?.company?.id || parsed?.branch?.company?.id || 1;
          } catch {
            companyId = 1;
          }
        }
        
        const response = await branchesApi.getByCompanyId(companyId, {
          page: 1,
          limit: 100,
        });
        setBranches(response.data);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };

    fetchBranches();
  }, [currentUser]);

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  // Filter and search leave requests
  useEffect(() => {
    let filtered = leaveRequests;

    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(leave =>
        leave.employeeName.toLowerCase().includes(searchLower) ||
        leave.leaveNumber.toLowerCase().includes(searchLower) ||
        leave.employeeEmail.toLowerCase().includes(searchLower) ||
        leave.department.toLowerCase().includes(searchLower) ||
        leave.reason.toLowerCase().includes(searchLower)
      );
    }

    // Apply unit filter
    if (filterUnit !== 'all') {
      filtered = filtered.filter(leave => leave.unit === filterUnit);
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(leave => leave.status === filterStatus);
    }

    // Apply leave type filter
    if (filterLeaveType !== 'all') {
      filtered = filtered.filter(leave => leave.leaveType === filterLeaveType);
    }

    // Apply date range filter
    if (filterDateRange !== 'all') {
      const today = new Date();
      filtered = filtered.filter(leave => {
        const startDate = new Date(leave.startDate);
        switch (filterDateRange) {
          case 'today':
            return isSameDay(startDate, today);
          case 'this_week':
            const weekStart = startOfWeek(today);
            const weekEnd = endOfWeek(today);
            return startDate >= weekStart && startDate <= weekEnd;
          case 'this_month':
            return startDate.getMonth() === today.getMonth() && startDate.getFullYear() === today.getFullYear();
          case 'next_month':
            const nextMonth = addMonths(today, 1);
            return startDate.getMonth() === nextMonth.getMonth() && startDate.getFullYear() === nextMonth.getFullYear();
          default:
            return true;
        }
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField as keyof LeaveRequest];
      let bValue: any = b[sortField as keyof LeaveRequest];

      if (sortField === 'startDate' || sortField === 'endDate' || sortField === 'submittedDate' || sortField === 'createdAt' || sortField === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'ASC') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredLeaves(filtered);
    setCurrentPage(1);
  }, [leaveRequests, searchQuery, filterUnit, filterStatus, filterLeaveType, filterDateRange, sortField, sortOrder]);

  const loadLeaveRequests = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with leave API when available
      // const response = await leaveApi.getAllLeaveRequests({ ... });
      // setLeaveRequests(response.data);
      
      // Mock data for now - will be replaced when leave API is available
      setLeaveRequests(mockLeaveRequests);
    } catch (error) {
      console.error('Error loading leave requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leave requests. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (column: SortField) => {
    if (sortField === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortField(column);
      setSortOrder('DESC');
    }
  };

  const getSortIcon = (column: SortField) => {
    if (sortField !== column) {
      return <ArrowUpDown className='w-4 h-4 text-muted-foreground' />;
    }
    return sortOrder === 'ASC' ? (
      <ChevronUp className='w-4 h-4 text-primary' />
    ) : (
      <ChevronDown className='w-4 h-4 text-primary' />
    );
  };

  const handleViewLeave = (leave: LeaveRequest) => {
    setSelectedLeave(leave);
    setIsViewDialogOpen(true);
  };

  const handleCloseViewDialog = () => {
    setSelectedLeave(null);
    setIsViewDialogOpen(false);
  };


  // Calculate pagination
  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeaves = filteredLeaves.slice(startIndex, endIndex);

  const getLeaveStats = () => {
    const total = leaveRequests.length;
    const pending = leaveRequests.filter(leave => leave.status === 'pending').length;
    const approved = leaveRequests.filter(leave => leave.status === 'approved').length;
    const rejected = leaveRequests.filter(leave => leave.status === 'rejected').length;
    const cancelled = leaveRequests.filter(leave => leave.status === 'cancelled').length;

    return { total, pending, approved, rejected, cancelled };
  };

  const stats = getLeaveStats();

  return (
    <div className='space-y-6'>
      {/* Main Content */}
      <Card className='border-0 shadow-sm'>
        <CardHeader>
          <div className='flex justify-between items-center'>
            <CardTitle className='text-base flex items-center gap-2'>
              
            </CardTitle>
            
            <div className='flex items-center gap-2'>
              <div className='relative'>
                <Search className='w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground' />
                <Input
                  placeholder='Search leave requests...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='pl-10 w-64'
                />
              </div>
              
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className='w-40'>
                  <SelectValue placeholder='Unit' />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit === 'all' ? 'Factory Location' : unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className='w-32'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={filterLeaveType} onValueChange={setFilterLeaveType}>
                <SelectTrigger className='w-36'>
                  <SelectValue placeholder='Leave Type' />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === 'all' ? 'All Types' : leaveTypeConfig[type as keyof typeof leaveTypeConfig]?.label || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Action Buttons */}
              <div className='flex items-center gap-2 ml-2'>
                <Button variant='outline' size='sm'>
                  <Upload className='w-4 h-4 mr-2' />
                  Export
                </Button>
                <Button variant='outline' size='sm'>
                  <Download className='w-4 h-4 mr-2' />
                  Import
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex justify-center items-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin' />
              <span className='ml-2'>Loading leave requests...</span>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='bg-secondary/20 border-b-2 border-secondary/30'>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('leaveNumber')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Leave ID
                        {getSortIcon('leaveNumber')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[200px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('employeeName')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Employee Name
                        {getSortIcon('employeeName')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('unit')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                      Factory Location
                        {getSortIcon('unit')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[120px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('leaveType')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Leave Type
                        {getSortIcon('leaveType')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[100px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('startDate')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        FROM
                        {getSortIcon('startDate')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[100px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('endDate')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        TO
                        {getSortIcon('endDate')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[80px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('totalDays')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Days
                        {getSortIcon('totalDays')}
                      </Button>
                    </TableHead>
                    <TableHead className='min-w-[100px]'>
                      <Button
                        variant='ghost'
                        onClick={() => handleSort('status')}
                        className='h-auto p-0 font-semibold text-foreground hover:text-primary flex items-center gap-2'
                      >
                        Status
                        {getSortIcon('status')}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaves.map((leave) => {
                    const leaveStatusConfig = statusConfig[leave.status];
                    const leaveTypeConfigItem = leaveTypeConfig[leave.leaveType];
                    
                    return (
                      <TableRow key={leave.id} className='hover:bg-muted/30'>
                        <TableCell>
                          <button
                            onClick={() => handleViewLeave(leave)}
                            className='text-left hover:text-primary hover:underline cursor-pointer font-mono text-sm'
                          >
                            {leave.leaveNumber}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className='font-medium'>{leave.employeeName}</div>
                            <div className='text-sm text-muted-foreground'>{leave.employeeId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-muted-foreground' />
                            {leave.unit}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={leaveTypeConfigItem.color}>
                            {React.createElement(leaveTypeConfigItem.icon, { className: 'w-3 h-3 mr-1' })}
                            {leaveTypeConfigItem.label}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {format(new Date(leave.startDate), 'dd-MM-yyyy')}
                        </TableCell>
                        <TableCell className='text-muted-foreground'>
                          {format(new Date(leave.endDate), 'dd-MM-yyyy')}
                        </TableCell>
                        <TableCell className='font-medium'>
                          {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}
                        </TableCell>
                        <TableCell>
                          <Badge className={leaveStatusConfig.color}>
                            {React.createElement(leaveStatusConfig.icon, { className: 'w-3 h-3 mr-1' })}
                            {leaveStatusConfig.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination - Hide when searching */}
          {!searchQuery.trim() && (
            <div className='flex flex-col sm:flex-row items-center justify-between gap-4 mt-6'>
              {/* Page Info */}
              <div className='text-xs sm:text-sm text-muted-foreground'>
                Showing {startIndex + 1} to {Math.min(endIndex, filteredLeaves.length)} of {filteredLeaves.length} entries
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
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronsLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Previous page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronLeft className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Page numbers - Show up to 6 pages */}
                  <div className='flex items-center gap-1 mx-1 sm:mx-2'>
                    {Array.from(
                      { length: Math.min(6, totalPages) },
                      (_, i) => {
                        let pageNum;
                        
                        if (totalPages <= 6) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 5 + i;
                        } else {
                          pageNum = currentPage - 3 + i;
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
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
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className='h-7 w-7 sm:h-8 sm:w-8 p-0'
                  >
                    <ChevronRight className='w-3 h-3 sm:w-4 sm:h-4' />
                  </Button>

                  {/* Last page button */}
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
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

      {/* Leave Detail Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={handleCloseViewDialog}>
        <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader className='pb-2'>
            <DialogTitle className='flex items-center gap-2 text-lg'>
              <div className='w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center'>
                <Eye className='w-4 h-4 text-primary' />
              </div>
              Leave Request Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLeave && (
            <div className='space-y-4'>
              <Card className='border-0 shadow-sm'>
                <CardContent className='space-y-4'>
                  {/* Status Badge */}
                  <div className='flex justify-between items-center p-3 bg-muted/30 rounded-lg'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>Status:</span>
                      <Badge className={statusConfig[selectedLeave.status].color}>
                        {React.createElement(statusConfig[selectedLeave.status].icon, { className: 'w-3 h-3 mr-1' })}
                        {statusConfig[selectedLeave.status].label}
                      </Badge>
                    </div>
                    {selectedLeave.submittedDate && (
                      <span className='text-xs text-muted-foreground'>
                        Submitted: {format(new Date(selectedLeave.submittedDate), 'dd-MM-yyyy')}
                      </span>
                    )}
                  </div>

                  {/* Employee and Leave Type Selection */}
                  <div className='space-y-3'>
                    <div className='grid grid-cols-1 lg:grid-cols-2 gap-3'>
                      {/* Employee Information */}
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Employee</Label>
                        <div className='h-8 px-2 py-1 bg-muted/30 rounded-[5px] text-xs flex items-center'>
                          {selectedLeave.employeeName} ({selectedLeave.employeeId})
                        </div>
                      </div>

                      {/* Leave Type */}
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Leave Type</Label>
                        <div className='h-8 px-2 py-1 bg-muted/30 rounded-[5px] text-xs flex items-center'>
                          <Badge className={leaveTypeConfig[selectedLeave.leaveType].color}>
                            {React.createElement(leaveTypeConfig[selectedLeave.leaveType].icon, { className: 'w-3 h-3 mr-1' })}
                            {leaveTypeConfig[selectedLeave.leaveType].label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className='space-y-3'>
                    <div className='grid grid-cols-1 lg:grid-cols-3 gap-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>FROM</Label>
                        <div className='h-8 px-2 py-1 bg-muted/30 rounded-[5px] text-xs flex items-center'>
                          {format(new Date(selectedLeave.startDate), 'dd-MM-yyyy')}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>TO</Label>
                        <div className='h-8 px-2 py-1 bg-muted/30 rounded-[5px] text-xs flex items-center'>
                          {format(new Date(selectedLeave.endDate), 'dd-MM-yyyy')}
                        </div>
                      </div>

                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Total Days</Label>
                        <div className='h-8 px-2 py-1 bg-muted/30 rounded-[5px] text-xs flex items-center font-medium'>
                          {selectedLeave.totalDays} day{selectedLeave.totalDays !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Reason for Leave */}
                  <div className='space-y-3'>
                    <div className='space-y-1'>
                      <Label className='text-xs font-medium'>Reason for Leave</Label>
                      <div className='min-h-[60px] px-2 py-1 bg-muted/30 border border-input rounded-[5px] text-xs flex items-start pt-2'>
                        {selectedLeave.reason}
                      </div>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  {selectedLeave.notes && (
                    <div className='space-y-3'>
                      <div className='space-y-1'>
                        <Label className='text-xs font-medium'>Additional Notes</Label>
                        <div className='min-h-[40px] px-2 py-1 bg-muted/30 border border-input rounded-[5px] text-xs flex items-start pt-2'>
                          {selectedLeave.notes}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Approval History */}
                  <div className='space-y-3'>
                    <h4 className='text-xs font-medium text-muted-foreground border-b pb-1'>
                      Approval History
                    </h4>

                    <div className='space-y-2'>
                      <div className='flex justify-between items-center p-2 bg-muted/30 rounded-lg'>
                        <span className='text-xs font-medium'>Submitted by:</span>
                        <span className='text-xs'>{selectedLeave.submittedBy}</span>
                      </div>
                      {selectedLeave.submittedDate && (
                        <div className='flex justify-between items-center p-2 bg-muted/30 rounded-lg'>
                          <span className='text-xs font-medium'>Submitted on:</span>
                          <span className='text-xs'>{format(new Date(selectedLeave.submittedDate), 'dd-MM-yyyy HH:mm')}</span>
                        </div>
                      )}
                      {selectedLeave.approvedBy && (
                        <div className='flex justify-between items-center p-2 bg-muted/30 rounded-lg'>
                          <span className='text-xs font-medium'>Approved by:</span>
                          <span className='text-xs'>{selectedLeave.approvedBy}</span>
                        </div>
                      )}
                      {selectedLeave.approvedDate && (
                        <div className='flex justify-between items-center p-2 bg-muted/30 rounded-lg'>
                          <span className='text-xs font-medium'>Approved on:</span>
                          <span className='text-xs'>{format(new Date(selectedLeave.approvedDate), 'dd-MM-yyyy HH:mm')}</span>
                        </div>
                      )}
                      {selectedLeave.approvalNotes && (
                        <div className='p-2 bg-muted/30 rounded-lg'>
                          <span className='text-xs font-medium'>Approval Notes:</span>
                          <p className='text-xs mt-1'>{selectedLeave.approvalNotes}</p>
                        </div>
                      )}
                      {selectedLeave.rejectionReason && (
                        <div className='p-2 bg-red-50 border border-red-200 rounded-lg'>
                          <span className='text-xs font-medium text-red-800'>Rejection Reason:</span>
                          <p className='text-xs mt-1 text-red-600'>{selectedLeave.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search Results Info - Show when searching */}
      {searchQuery.trim() && filteredLeaves.length > 0 && (
        <div className='text-sm text-muted-foreground text-center py-2'>
          Showing {filteredLeaves.length} leave request
          {filteredLeaves.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </div>
      )}

    </div>
  );
};
