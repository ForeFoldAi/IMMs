/**
 * UnifiedTabSearch Component
 * 
 * A reusable search and filter component for all inventory tabs with role-based filtering.
 * 
 * Features:
 * - Search input with customizable placeholder
 * - Role-based unit/branch filter (auto-hidden for supervisors)
 * - Optional view mode toggle (list/table)
 * - Optional status filter
 * - Optional items per page selector
 * - Optional refresh button
 * - Optional export button
 * - Optional add button
 * 
 * Usage Example:
 * 
 * <UnifiedTabSearch
 *   searchValue={searchQuery}
 *   onSearchChange={setSearchQuery}
 *   searchPlaceholder='Search materials...'
 *   viewMode={viewMode}
 *   onViewModeChange={setViewMode}
 *   showViewToggle={true}
 *   filterUnit={filterUnit}
 *   onFilterUnitChange={setFilterUnit}
 *   availableBranches={availableBranches}
 *   itemsPerPage={itemsPerPage}
 *   onItemsPerPageChange={setItemsPerPage}
 *   showItemsPerPage={true}
 *   onRefresh={handleRefresh}
 *   showRefresh={true}
 *   onExport={exportToCSV}
 *   showExport={true}
 *   onAdd={() => setIsAddOpen(true)}
 *   addLabel='Add New Material'
 *   showAddButton={true}
 *   isOnline={isOnline}
 * />
 * 
 * Role Behavior:
 * - Company Owner: Can see and use unit filter dropdown
 * - Supervisor: Unit filter is hidden, data auto-filtered to their branch
 */

import { Search, Building2, Loader2, Upload, Plus, List, Table, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useRole } from '../contexts/RoleContext';
import { Branch } from '../lib/api/types';

interface StatusOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface UnifiedTabSearchProps {
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // View Mode (optional)
  viewMode?: 'list' | 'table';
  onViewModeChange?: (mode: 'list' | 'table') => void;
  showViewToggle?: boolean;

  // Unit/Branch Filter
  filterUnit: string;
  onFilterUnitChange: (value: string) => void;
  availableBranches: Branch[];
  isLoadingBranches?: boolean;
  showUnitFilter?: boolean; // Override to force show/hide regardless of role

  // Status Filter (optional)
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  statusOptions?: StatusOption[];
  showStatusFilter?: boolean;

  // Pagination (optional)
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
  showItemsPerPage?: boolean;
  itemsPerPageOptions?: number[];

  // Export (optional)
  onExport?: () => void;
  isExporting?: boolean;
  showExport?: boolean;
  exportLabel?: string;

  // Refresh (optional)
  onRefresh?: () => void;
  isRefreshing?: boolean;
  showRefresh?: boolean;

  // Add/Create Button (optional)
  onAdd?: () => void;
  addLabel?: string;
  addIcon?: React.ReactNode;
  showAddButton?: boolean;

  // Network status
  isOnline?: boolean;
}

export const UnifiedTabSearch: React.FC<UnifiedTabSearchProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  viewMode,
  onViewModeChange,
  showViewToggle = false,
  filterUnit,
  onFilterUnitChange,
  availableBranches,
  isLoadingBranches = false,
  showUnitFilter = true,
  statusFilter,
  onStatusFilterChange,
  statusOptions = [],
  showStatusFilter = false,
  itemsPerPage,
  onItemsPerPageChange,
  showItemsPerPage = false,
  itemsPerPageOptions = [10, 20, 50, 100],
  onExport,
  isExporting = false,
  showExport = false,
  exportLabel = 'Export',
  onRefresh,
  isRefreshing = false,
  showRefresh = false,
  onAdd,
  addLabel = 'Add New',
  addIcon = <Plus className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />,
  showAddButton = false,
  isOnline = true,
}) => {
  const { currentUser } = useRole();

  // Determine if unit filter should be shown
  const shouldShowUnitFilter = showUnitFilter && currentUser?.role === 'company_owner';

  return (
    <div className='space-y-3'>
      {/* Mobile Layout */}
      <div className='flex flex-col gap-3 sm:hidden'>
        {/* Row 1: View Toggle + Status Filter */}
        {showViewToggle && onViewModeChange && viewMode && (
          <div className='flex items-center gap-2'>
            {/* View Toggle */}
            <div className='flex rounded-lg border border-secondary overflow-hidden bg-secondary/10 shadow-sm flex-1'>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => onViewModeChange('list')}
                className='rounded-none px-2 flex-1 h-8'
              >
                <List className='w-3 h-3' />
                <span className='ml-1 text-xs'>List</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size='sm'
                onClick={() => onViewModeChange('table')}
                className='rounded-none px-2 flex-1 h-8'
              >
                <Table className='w-3 h-3' />
                <span className='ml-1 text-xs'>Table</span>
              </Button>
            </div>

            {/* Status Filter */}
            {showStatusFilter && onStatusFilterChange && statusOptions.length > 0 && (
              <Select value={statusFilter} onValueChange={onStatusFilterChange}>
                <SelectTrigger className='w-28 rounded-lg border-secondary focus:border-secondary focus:ring-0 h-8'>
                  <SelectValue placeholder='Status' />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className='flex items-center gap-1'>
                        {option.icon}
                        <span className='text-xs'>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Row 2: Search Input */}
        <div className='relative w-full'>
          <Search className='absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3 h-3' />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className='pl-8 rounded-lg border-secondary focus:border-secondary focus:ring-0 outline-none h-8 text-sm'
          />
        </div>

        {/* Row 3: Unit Filter + Export Button (Side by Side) */}
        {shouldShowUnitFilter && (
          <div className='flex items-center gap-2'>
            <Select value={filterUnit} onValueChange={onFilterUnitChange}>
              <SelectTrigger className='flex-1 rounded-lg border-secondary focus:border-secondary focus:ring-0 h-8 text-sm'>
                <SelectValue
                  placeholder={isLoadingBranches ? 'Loading...' : 'Select Unit'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>All Units</SelectItem>
                {availableBranches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    <div className='flex items-center gap-1'>
                      <Building2 className='w-3 h-3' />
                      <div>
                        <div className='font-medium text-sm'>{branch.name}</div>
                        {branch.location && (
                          <div className='text-xs text-muted-foreground'>
                            {branch.location}
                          </div>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Export and Refresh Buttons beside Unit Filter */}
            <div className='flex gap-1'>
              {showRefresh && onRefresh && (
                <Button
                  variant='outline'
                  className='text-xs h-8 px-2 whitespace-nowrap'
                  onClick={onRefresh}
                  disabled={isRefreshing || !isOnline}
                >
                  {isRefreshing ? (
                    <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                  ) : (
                    <RefreshCcw className='w-3 h-3 mr-1' />
                  )}
                  Refresh
                </Button>
              )}
              {showExport && onExport && (
                <Button
                  variant='outline'
                  className='text-xs h-8 px-2 whitespace-nowrap'
                  onClick={onExport}
                  disabled={isExporting || !isOnline}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                      Export
                    </>
                  ) : (
                    <>
                      <Upload className='w-3 h-3 mr-1' />
                      Export
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Row 3.5: Export and Refresh Buttons (when no unit filter) */}
        {!shouldShowUnitFilter && (showExport || showRefresh) && (
          <div className='flex items-center gap-2'>
            <div className='flex gap-1'>
              {showRefresh && onRefresh && (
                <Button
                  variant='outline'
                  className='text-xs h-8 px-2 whitespace-nowrap'
                  onClick={onRefresh}
                  disabled={isRefreshing || !isOnline}
                >
                  {isRefreshing ? (
                    <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                  ) : (
                    <RefreshCcw className='w-3 h-3 mr-1' />
                  )}
                  Refresh
                </Button>
              )}
              {showExport && onExport && (
                <Button
                  variant='outline'
                  className='text-xs h-8 px-2 whitespace-nowrap'
                  onClick={onExport}
                  disabled={isExporting || !isOnline}
                >
                  {isExporting ? (
                    <>
                      <Loader2 className='w-3 h-3 mr-1 animate-spin' />
                      Export
                    </>
                  ) : (
                    <>
                      <Upload className='w-3 h-3 mr-1' />
                      Export
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Row 4: Add Button (Full Width) */}
        {showAddButton && onAdd && (
          <Button
            className='btn-primary w-full text-xs h-8'
            onClick={onAdd}
          >
            <Plus className='w-3 h-3 mr-1' />
            {addLabel}
          </Button>
        )}
      </div>

      {/* Desktop Layout */}
      <div className='hidden sm:flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4'>
      {/* Left side: View Toggle (if enabled) */}
      {showViewToggle && onViewModeChange && viewMode && (
 <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-shrink-0'>          <div className='flex rounded-lg border border-secondary overflow-hidden bg-secondary/10 w-fit shadow-sm'>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => onViewModeChange('list')}
              className='rounded-none px-3 sm:px-4'
            >
              <List className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>List</span>
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size='sm'
              onClick={() => onViewModeChange('table')}
              className='rounded-none px-3 sm:px-4'
            >
              <Table className='w-4 h-4' />
              <span className='ml-1 sm:ml-2 text-xs sm:text-sm'>Table</span>
            </Button>
          </div>
        </div>
      )}

      {/* Right side: Search, Filters, and Action Buttons */}
      <div className='flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap gap-2 sm:gap-3 items-start sm:items-center w-full lg:w-auto lg:flex-1 lg:justify-end'>        {/* Search Input */}
      <div className='relative w-full sm:w-64 min-w-[200px] flex-shrink-0'>
                  <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4' />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className='pl-10 rounded-lg border-secondary focus:border-secondary focus:ring-0 outline-none h-10'
          />
        </div>

        {/* Unit Filter - Only for Company Owner (Supervisors see their own branch only) */}
        {shouldShowUnitFilter && (
          <Select value={filterUnit} onValueChange={onFilterUnitChange}>
 <SelectTrigger className='w-full sm:w-48 min-w-[160px] rounded-lg border-secondary focus:border-secondary focus:ring-0 h-10 flex-shrink-0'>              <SelectValue
                placeholder={isLoadingBranches ? 'Loading...' : 'Select Unit'}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Units</SelectItem>
              {availableBranches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id.toString()}>
                  <div className='flex items-center gap-2'>
                    <Building2 className='w-4 h-4' />
                    <div>
                      <div className='font-medium'>{branch.name}</div>
                      {branch.location && (
                        <div className='text-xs text-muted-foreground'>
                          {branch.location}
                        </div>
                      )}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter (optional) */}
        {showStatusFilter && onStatusFilterChange && statusOptions.length > 0 && (
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
<SelectTrigger className='w-full sm:w-40 min-w-[140px] rounded-lg border-secondary focus:border-secondary focus:ring-0 h-10 flex-shrink-0'>              <SelectValue placeholder='Select Status' />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className='flex items-center gap-2'>
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Items Per Page Selector (optional) */}
        {showItemsPerPage && onItemsPerPageChange && itemsPerPage !== undefined && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground whitespace-nowrap'>Show:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
            >
              <SelectTrigger className='w-20 h-10 rounded-lg border-secondary focus:border-secondary focus:ring-0'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {itemsPerPageOptions.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Refresh Button (optional) */}
        {showRefresh && onRefresh && (
          <Button
            variant='outline'
            className='w-full sm:w-auto text-sm sm:text-base h-10 flex-shrink-0 whitespace-nowrap'

            onClick={onRefresh}
            disabled={isRefreshing || !isOnline}
          >
            {isRefreshing ? (
              <Loader2 className='w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin' />
            ) : (
              <RefreshCcw className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        )}

        {/* Export Button (optional) */}
        {showExport && onExport && (
          <Button
            variant='outline'
            className='w-full sm:w-auto text-sm sm:text-base h-10 flex-shrink-0 whitespace-nowrap'

            onClick={onExport}
            disabled={isExporting || !isOnline}
          >
            {isExporting ? (
              <Loader2 className='w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin' />
            ) : (
              <Upload className='w-4 h-4 sm:w-5 sm:h-5 mr-2' />
            )}
            {isExporting ? 'Exporting...' : exportLabel}
          </Button>
        )}

        {/* Add/Create Button (optional) */}
        {showAddButton && onAdd && (
          <Button
          className='btn-primary w-full sm:w-auto text-sm sm:text-base h-10 flex-shrink-0 whitespace-nowrap px-3 sm:px-4'

          onClick={onAdd}
          >
            <Plus className='w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 flex-shrink-0' />
            <span className='hidden lg:inline'>{addLabel}</span>
            <span className='lg:hidden'>Add</span>
          </Button>
        )}
        </div>
      </div>
    </div>
  );
};

