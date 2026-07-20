import {
  getRefundEligibility,
  getRefundRecord,
  initiateFullRefund,
  listRefundRecords,
  reconcileRefundStatus,
  retryFailedRefund,
  buildAdminRefundResponse,
} from '../services/refundService.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getRefundEligibilityForOrder = asyncHandler(async (req, res) => {
  const eligibility = await getRefundEligibility(req.params.orderNumber);

  res.status(200).json({
    success: true,
    message: 'Refund eligibility retrieved successfully',
    data: eligibility,
  });
});

export const initiateOrderRefund = asyncHandler(async (req, res) => {
  const refund = await initiateFullRefund({
    orderNumber: req.params.orderNumber,
    reason: req.body.reason,
    adminId: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: 'Refund initiated successfully',
    data: {
      refund,
    },
  });
});

export const listRefunds = asyncHandler(async (req, res) => {
  const result = await listRefundRecords(req.query);

  res.status(200).json({
    success: true,
    message: 'Refunds retrieved successfully',
    data: result,
  });
});

export const getRefundDetails = asyncHandler(async (req, res) => {
  const refund = await getRefundRecord(req.params.refundId);

  if (!refund) {
    throw new ApiError(404, 'Refund not found', []);
  }

  res.status(200).json({
    success: true,
    message: 'Refund retrieved successfully',
    data: {
      refund,
    },
  });
});

export const reconcileAdminRefund = asyncHandler(async (req, res) => {
  const result = await reconcileRefundStatus(req.params.refundId);

  res.status(200).json({
    success: true,
    message: 'Refund status reconciled successfully',
    data: {
      refund: buildAdminRefundResponse(result.order, result.refund),
    },
  });
});

export const retryAdminRefund = asyncHandler(async (req, res) => {
  const refund = await retryFailedRefund(req.params.refundId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Refund retry processed successfully',
    data: {
      refund,
    },
  });
});
