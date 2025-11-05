import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Package,
  FileText,
  AlertTriangle,
  Clock,
  Truck,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from '../hooks/use-toast';
import { useRole } from '../contexts/RoleContext';
import { materialIndentsApi } from '../lib/api/material-indents';

interface RequestStatusManagerProps {
  request: any;
  onStatusUpdate: (
    requestId: string,
    newStatus: string,
    updateData: any
  ) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

interface ReceivedFormData {
  purchasedPrice: string;
  purchasedQuantity: string;
  purchasedFrom: string;
  receivedDate: string;
  invoiceNumber: string;
  qualityCheck: string;
  notes: string;
}

export const RequestStatusManager = ({
  request,
  onStatusUpdate,
  isOpen,
  onClose,
}: RequestStatusManagerProps) => {
  const { currentUser, hasPermission } = useRole();
  const [action, setAction] = useState<
    'approve' | 'revert' | 'update_received' | null
  >(null);
  const [revertReason, setRevertReason] = useState('');
  const [isReverting, setIsReverting] = useState(false);
  const [receivedForm, setReceivedForm] = useState<ReceivedFormData>({
    purchasedPrice: '',
    purchasedQuantity: '',
    purchasedFrom: '',
    receivedDate: new Date().toISOString().split('T')[0],
    invoiceNumber: '',
    qualityCheck: 'passed',
    notes: '',
  });
  const [isPartialReceipt, setIsPartialReceipt] = useState(false);

  const canApprove = hasPermission('inventory:material-indents:approve');
  const canUpdateToOrdered =
    hasPermission('inventory:material-indents:update') && request.status === 'approved';
  const canUpdateReceived =
    hasPermission('inventory:material-indents:update') &&
    (request.status === 'ordered' || request.status === 'partially_received');

  const handleOwnerApproval = async () => {
    if (!canApprove) return;

    try {
      // Update local state through the parent component and wait for it to complete
      // This will handle the API call and data refresh
      await onStatusUpdate(request.id, 'approved', {
        approvedBy: currentUser.name,
        approvedDate: new Date().toISOString(),
        statusDescription: 'Approved by Owner - Ready for ordering',
        currentStage: 'Approved',
        progressStage: 2,
        additionalNotes: `Approved by Owner: ${currentUser.name} on ${new Date().toISOString()}`,
      });

      toast({
        title: 'Request Approved',
        description: `Request ${request.id} has been approved. Supervisor can now update to Ordered status.`,
      });

      // Close the dialog after the update is complete
      onClose();
    } catch (error) {
      console.error('Error approving request:', error);
      
      let errorMessage = 'Failed to approve request. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Approval Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleOwnerRevert = async () => {
    if (!canApprove || !revertReason.trim()) {
      toast({
        title: 'Revert Reason Required',
        description: 'Please provide a reason for reverting this request.',
        variant: 'destructive',
      });
      return;
    }

    setIsReverting(true);
    try {
      // Update local state through the parent component and wait for it to complete
      // This will handle the API call and data refresh
      await onStatusUpdate(request.id, 'reverted', {
        revertedBy: currentUser.name,
        revertedDate: new Date().toISOString(),
        revertReason: revertReason,
        statusDescription: `Reverted by Owner: ${revertReason}`,
        currentStage: 'Reverted - Resubmission Required',
        progressStage: 0,
      });

      toast({
        title: 'Request Reverted',
        description: `Request ${request.id} has been reverted. Indent form must be resubmitted.`,
        variant: 'destructive',
      });

      setRevertReason('');
      
      // Close the dialog after the update is complete
      onClose();
    } catch (error) {
      console.error('Error reverting request:', error);
      
      let errorMessage = 'Failed to revert request. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Revert Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsReverting(false);
    }
  };

  const handleUpdateToOrdered = async () => {
    if (!canUpdateToOrdered) return;

    try {
      // Extract numeric ID from the request - handle both string and number IDs
      const requestId = typeof request.id === 'string' ? parseInt(request.id) : request.id;
      
      if (!requestId || isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }

      // Call the update API endpoint to change status to ordered
      const updatedRequest = await materialIndentsApi.update(requestId, {
        status: 'ordered',
        additionalNotes: `Order placed by Supervisor: ${currentUser.name} on ${new Date().toISOString()}`,
      });

      // Update local state through the parent component
      onStatusUpdate(request.id, 'ordered', {
        orderedBy: currentUser.name,
        orderedDate: new Date().toISOString(),
        statusDescription: 'Order placed with supplier by Supervisor',
        currentStage: 'Ordered',
        progressStage: 3,
      });

      toast({
        title: 'Status Updated to Ordered',
        description: `Request ${request.id} has been updated to Ordered status.`,
      });

      onClose();
    } catch (error) {
      console.error('Error updating to ordered status:', error);
      
      let errorMessage = 'Failed to update status to ordered. Please try again.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Status Update Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleReceivedUpdate = () => {
    if (!canUpdateReceived) return;

    const requiredFields = [
      'purchasedPrice',
      'purchasedQuantity',
      'purchasedFrom',
    ];
    const missingFields = requiredFields.filter(
      (field) => !receivedForm[field as keyof ReceivedFormData].trim()
    );

    if (missingFields.length > 0) {
      toast({
        title: 'Missing Information',
        description:
          'Please fill in all required fields for the received form.',
        variant: 'destructive',
      });
      return;
    }

    const originalQuantity = parseFloat(request.quantity.split(' ')[0]);
    const receivedQuantity = parseFloat(receivedForm.purchasedQuantity);

    // Calculate total received quantity including previous partial receipts
    const previousReceipts = request.partialReceipts || [];
    const totalPreviouslyReceived = previousReceipts.reduce(
      (sum: number, receipt: any) =>
        sum + parseFloat(receipt.purchasedQuantity),
      0
    );
    const totalReceived = totalPreviouslyReceived + receivedQuantity;

    let newStatus = 'material_received';
    let statusDescription = 'Materials fully received and updated in inventory';
    let currentStage = 'Material Received';
    let progressStage = 5;

    if (isPartialReceipt || totalReceived < originalQuantity) {
      newStatus = 'partially_received';
      statusDescription = `Partially received: ${totalReceived} of ${originalQuantity} units`;
      currentStage = 'Partially Received';
      progressStage = 4;
    }

    // Create receipt record for history
    const receiptRecord = {
      id: `receipt-${Date.now()}`,
      date: new Date().toISOString(),
      receivedBy: currentUser.name,
      receivedDate: receivedForm.receivedDate,
      purchasedPrice: parseFloat(receivedForm.purchasedPrice),
      purchasedQuantity: receivedQuantity,
      purchasedFrom: receivedForm.purchasedFrom,
      invoiceNumber: receivedForm.invoiceNumber,
      qualityCheck: receivedForm.qualityCheck,
      notes: receivedForm.notes,
      isPartial: isPartialReceipt || totalReceived < originalQuantity,
      totalReceivedSoFar: totalReceived,
      originalQuantity: originalQuantity,
    };

    // Update partial receipts history
    const updatedPartialReceipts = [...previousReceipts, receiptRecord];

    onStatusUpdate(request.id, newStatus, {
      receivedBy: currentUser.name,
      receivedDate: receivedForm.receivedDate,
      receivedForm: receivedForm,
      statusDescription: statusDescription,
      currentStage: currentStage,
      progressStage: progressStage,
      purchasedPrice: parseFloat(receivedForm.purchasedPrice),
      purchasedQuantity: receivedQuantity,
      purchasedFrom: receivedForm.purchasedFrom,
      invoiceNumber: receivedForm.invoiceNumber,
      qualityCheck: receivedForm.qualityCheck,
      notes: receivedForm.notes,
      partialReceipts: updatedPartialReceipts,
      totalReceivedQuantity: totalReceived,
    });

    toast({
      title: isPartialReceipt
        ? 'Partial Receipt Recorded'
        : 'Materials Received',
      description: `Request ${request.id} has been updated with receipt details.`,
    });

    // Reset form
    setReceivedForm({
      purchasedPrice: '',
      purchasedQuantity: '',
      purchasedFrom: '',
      receivedDate: new Date().toISOString().split('T')[0],
      invoiceNumber: '',
      qualityCheck: 'passed',
      notes: '',
    });
    setIsPartialReceipt(false);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending_approval: {
        color: 'bg-warning/20 text-warning-foreground border-warning/30',
        icon: Clock,
      },
      approved: {
        color: 'bg-secondary/20 text-foreground border-secondary/30',
        icon: CheckCircle,
      },
      ordered: {
        color: 'bg-accent/20 text-accent-foreground border-accent/30',
        icon: Package,
      },
      partially_received: {
        color: 'bg-secondary/30 text-foreground border-secondary/40',
        icon: Truck,
      },
      material_received: {
        color: 'bg-primary/20 text-primary border-primary/30',
        icon: CheckCircle,
      },
      reverted: {
        color: 'bg-destructive/20 text-destructive border-destructive/30',
        icon: XCircle,
      },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] ||
      statusConfig['pending_approval'];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border flex items-center gap-1`}>
        <Icon className='w-3 h-3' />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Calculate receipt progress
  const getReceiptProgress = () => {
    const originalQuantity = parseFloat(request.quantity.split(' ')[0]);
    const totalReceived = request.totalReceivedQuantity || 0;
    const percentage = Math.round((totalReceived / originalQuantity) * 100);
    return { totalReceived, originalQuantity, percentage };
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <FileText className='w-5 h-5 text-primary' />
            Manage Request Status - {request.id}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Current Status */}
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-lg'>Current Status</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <div className='font-medium'>{request.materialName}</div>
                  <div className='text-sm text-muted-foreground'>
                    Quantity: {request.quantity}
                  </div>
                </div>
                {getStatusBadge(request.status)}
              </div>
              <div className='text-sm text-muted-foreground'>
                {request.statusDescription}
              </div>

              {/* Receipt Progress */}
              {(request.status === 'partially_received' ||
                request.status === 'material_received') && (
                <div className='mt-4 p-3 bg-muted/30 rounded-lg'>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm font-medium'>
                      Receipt Progress
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {getReceiptProgress().totalReceived} /{' '}
                      {getReceiptProgress().originalQuantity} units
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-primary h-2 rounded-full transition-all duration-300'
                      style={{ width: `${getReceiptProgress().percentage}%` }}
                    ></div>
                  </div>
                  <div className='text-xs text-muted-foreground mt-1'>
                    {getReceiptProgress().percentage}% Complete
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Owner Actions */}
          {canApprove && request.status === 'pending_approval' && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg text-foreground'>
                  Owner Actions
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  <Button
                    onClick={handleOwnerApproval}
                    className='bg-primary hover:bg-primary-hover text-primary-foreground'
                  >
                    <CheckCircle className='w-4 h-4 mr-2' />
                    Approve Request
                  </Button>
                  <Button
                    onClick={() => setAction('revert')}
                    variant='destructive'
                  >
                    <XCircle className='w-4 h-4 mr-2' />
                    Revert Request
                  </Button>
                </div>

                {action === 'revert' && (
                  <div className='space-y-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg'>
                    <Label htmlFor='revert-reason'>
                      Reason for Reverting *
                    </Label>
                    <Textarea
                      id='revert-reason'
                      placeholder='Explain why this request is being reverted...'
                      value={revertReason}
                      onChange={(e) => setRevertReason(e.target.value)}
                      rows={3}
                      className='min-h-[50px] px-4 py-3 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm resize-none transition-all duration-200'
                    />
                    <div className='flex gap-2'>
                      <Button
                        onClick={handleOwnerRevert}
                        variant='destructive'
                        size='sm'
                        disabled={isReverting}
                      >
                        {isReverting ? 'Reverting...' : 'Confirm Revert'}
                      </Button>
                      <Button
                        onClick={() => setAction(null)}
                        variant='outline'
                        size='sm'
                        disabled={isReverting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Supervisor Actions - Update to Ordered */}
          {canUpdateToOrdered && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg text-accent'>
                  Supervisor Actions
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='p-4 bg-accent/10 border border-accent/20 rounded-lg'>
                  <div className='text-sm text-accent-foreground mb-3'>
                    <strong>Request Approved by Owner</strong>
                  </div>
                  <div className='text-sm text-muted-foreground mb-4'>
                    The request has been approved by the Owner. You can now
                    update the status to "Ordered" once you have placed the
                    order with the supplier.
                  </div>
                  <Button
                    onClick={handleUpdateToOrdered}
                    className='bg-accent hover:bg-accent/90 text-accent-foreground'
                  >
                    <Package className='w-4 h-4 mr-2' />
                    Update to Ordered
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supervisor Actions - Material Receipt */}
          {canUpdateReceived && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg text-primary/80'>
                  Update Material Receipt
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div className='space-y-2'>
                    <Label htmlFor='purchased-price'>Purchased Price *</Label>
                    <Input
                      id='purchased-price'
                      type='number'
                      placeholder='Enter total price'
                      value={receivedForm.purchasedPrice}
                      onChange={(e) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          purchasedPrice: e.target.value,
                        }))
                      }
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='purchased-quantity'>
                      Purchased Quantity *
                    </Label>
                    <Input
                      id='purchased-quantity'
                      type='number'
                      placeholder='Enter received quantity'
                      value={receivedForm.purchasedQuantity}
                      onChange={(e) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          purchasedQuantity: e.target.value,
                        }))
                      }
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='purchased-from'>Purchased From *</Label>
                    <Input
                      id='purchased-from'
                      placeholder='Supplier/Vendor name'
                      value={receivedForm.purchasedFrom}
                      onChange={(e) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          purchasedFrom: e.target.value,
                        }))
                      }
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='received-date'>Received Date</Label>
                    <Input
                      id='received-date'
                      type='date'
                      value={receivedForm.receivedDate}
                      onChange={(e) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          receivedDate: e.target.value,
                        }))
                      }
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='invoice-number'>Invoice Number</Label>
                    <Input
                      id='invoice-number'
                      placeholder='Invoice/Bill number'
                      value={receivedForm.invoiceNumber}
                      onChange={(e) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          invoiceNumber: e.target.value,
                        }))
                      }
                      className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'
                    />
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='quality-check'>Quality Check</Label>
                    <Select
                      value={receivedForm.qualityCheck}
                      onValueChange={(value) =>
                        setReceivedForm((prev) => ({
                          ...prev,
                          qualityCheck: value,
                        }))
                      }
                    >
                      <SelectTrigger className='h-11 px-4 py-2 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm transition-all duration-200'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='passed'>Passed</SelectItem>
                        <SelectItem value='failed'>Failed</SelectItem>
                        <SelectItem value='partial'>Partial Pass</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='receipt-notes'>Additional Notes</Label>
                  <Textarea
                    id='receipt-notes'
                    placeholder='Any additional notes about the received materials...'
                    value={receivedForm.notes}
                    onChange={(e) =>
                      setReceivedForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                    rows={3}
                    className='min-h-[50px] px-4 py-3 border border-input bg-background hover:border-primary/50 focus:border-transparent focus:ring-0 outline-none rounded-[5px] text-sm resize-none transition-all duration-200'
                  />
                </div>

                <div className='flex items-center space-x-2'>
                  <input
                    type='checkbox'
                    id='partial-receipt'
                    checked={isPartialReceipt}
                    onChange={(e) => setIsPartialReceipt(e.target.checked)}
                    className='rounded'
                  />
                  <Label htmlFor='partial-receipt' className='text-sm'>
                    This is a partial receipt (more materials expected)
                  </Label>
                </div>

                <Button
                  onClick={handleReceivedUpdate}
                  className='w-full bg-primary hover:bg-primary-hover text-primary-foreground'
                >
                  <Package className='w-4 h-4 mr-2' />
                  Update Receipt Status
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Partial Receipts History */}
          {request.partialReceipts && request.partialReceipts.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg'>Receipt History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {request.partialReceipts.map(
                    (receipt: any, index: number) => (
                      <div
                        key={receipt.id}
                        className='flex items-start gap-3 p-3 bg-muted/50 rounded-lg'
                      >
                        <div className='w-2 h-2 bg-primary rounded-full mt-2'></div>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-1'>
                            <Badge
                              variant={
                                receipt.isPartial ? 'secondary' : 'default'
                              }
                            >
                              {receipt.isPartial
                                ? 'Partial Receipt'
                                : 'Full Receipt'}
                            </Badge>
                            <span className='text-sm text-muted-foreground'>
                              {new Date(receipt.date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className='text-sm space-y-1'>
                            <div>
                              <strong>Quantity:</strong>{' '}
                              {receipt.purchasedQuantity} units
                            </div>
                            <div>
                              <strong>From:</strong> {receipt.purchasedFrom}
                            </div>
                            <div>
                              <strong>Price:</strong> ₹{receipt.purchasedPrice}
                            </div>
                            {receipt.invoiceNumber && (
                              <div>
                                <strong>Invoice:</strong>{' '}
                                {receipt.invoiceNumber}
                              </div>
                            )}
                            {receipt.notes && (
                              <div>
                                <strong>Notes:</strong> {receipt.notes}
                              </div>
                            )}
                            <div className='text-xs text-muted-foreground'>
                              Total received so far:{' '}
                              {receipt.totalReceivedSoFar} /{' '}
                              {receipt.originalQuantity} units
                            </div>
                          </div>
                          <div className='text-xs text-muted-foreground mt-1'>
                            By: {receipt.receivedBy}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status History */}
          {request.statusHistory && request.statusHistory.length > 0 && (
            <Card>
              <CardHeader className='pb-3'>
                <CardTitle className='text-lg'>Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-3'>
                  {request.statusHistory.map((history: any, index: number) => (
                    <div
                      key={index}
                      className='flex items-start gap-3 p-3 bg-muted/50 rounded-lg'
                    >
                      <div className='w-2 h-2 bg-primary rounded-full mt-2'></div>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          {getStatusBadge(history.status)}
                          <span className='text-sm text-muted-foreground'>
                            {new Date(history.date).toLocaleDateString()}
                          </span>
                        </div>
                        <div className='text-sm'>{history.description}</div>
                        {history.user && (
                          <div className='text-xs text-muted-foreground mt-1'>
                            By: {history.user}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning for Reverted Status */}
          {request.status === 'reverted' && (
            <Card className='border-destructive/20 bg-destructive/10'>
              <CardContent className='p-4'>
                <div className='flex items-start gap-3'>
                  <AlertTriangle className='w-5 h-5 text-destructive mt-0.5' />
                  <div className='flex-1'>
                    <div className='font-medium text-destructive'>
                      Request Reverted
                    </div>
                    <div className='text-sm text-muted-foreground mt-1'>
                      This request has been reverted by the Owner. The indent
                      form must be resubmitted with corrections.
                    </div>
                    {request.revertReason && (
                      <div className='text-sm text-destructive mt-2 p-2 bg-destructive/20 rounded'>
                        <strong>Reason:</strong> {request.revertReason}
                      </div>
                    )}
                    {hasPermission('inventory:material-indents:update') && (
                      <div className='mt-3'>
                        <Button
                          onClick={onClose}
                          className='bg-primary hover:bg-primary-hover text-primary-foreground'
                          size='sm'
                        >
                          <FileText className='w-4 h-4 mr-2' />
                          Edit & Resubmit Form
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
