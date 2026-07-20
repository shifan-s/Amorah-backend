import { validationResult } from 'express-validator';

export default function validateRequest(req, res, next) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    next();
    return;
  }

  const errors = result.array({ onlyFirstError: true });
  const hasOnlyInvalidAddressId =
    errors.length === 1 && errors[0].path === 'addressId' && errors[0].msg === 'Invalid address ID';

  if (hasOnlyInvalidAddressId) {
    res.status(400).json({
      success: false,
      message: 'Invalid address ID',
      errors: [],
    });
    return;
  }

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.map((error) => ({
      field: error.path,
      message: error.msg,
    })),
  });
}
