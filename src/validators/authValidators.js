import { body } from 'express-validator';

const indianMobilePattern = /^[6-9]\d{9}$/;

function hasLetterAndNumber(value) {
  return /[A-Za-z]/.test(value) && /\d/.test(value);
}

function normalizeMobile(value) {
  if (value === undefined || value === null || value === '') {
    return value;
  }

  return String(value).replace(/\D/g, '');
}

const fullNameValidator = body('fullName')
  .trim()
  .notEmpty()
  .withMessage('Full name is required')
  .isLength({ min: 2, max: 80 })
  .withMessage('Full name must be between 2 and 80 characters');

const optionalFullNameValidator = body('fullName')
  .optional({ values: 'undefined' })
  .trim()
  .isLength({ min: 2, max: 80 })
  .withMessage('Full name must be between 2 and 80 characters');

const emailValidator = body('email')
  .trim()
  .isEmail()
  .withMessage('Enter a valid email address')
  .normalizeEmail();

const passwordValidator = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters')
  .bail()
  .custom(hasLetterAndNumber)
  .withMessage('Password must contain at least one letter and one number');

const mobileValidator = body('mobile')
  .optional({ values: 'falsy' })
  .customSanitizer(normalizeMobile)
  .matches(indianMobilePattern)
  .withMessage('Enter a valid Indian mobile number');

function rejectField(field, message) {
  return body(field).not().exists().withMessage(message);
}

export const registerValidator = [
  fullNameValidator,
  emailValidator,
  mobileValidator,
  passwordValidator,
];

export const loginValidator = [
  emailValidator,
  body('password').notEmpty().withMessage('Password is required'),
];

export const updateProfileValidator = [
  optionalFullNameValidator,
  mobileValidator,
  rejectField('email', 'Email cannot be changed from this endpoint'),
  rejectField('role', 'Role cannot be changed from this endpoint'),
  rejectField('status', 'Status cannot be changed from this endpoint'),
  rejectField('password', 'Password cannot be changed from this endpoint'),
  rejectField('passwordHash', 'Password cannot be changed from this endpoint'),
];

export const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .bail()
    .custom(hasLetterAndNumber)
    .withMessage('New password must contain at least one letter and one number')
    .bail()
    .custom((newPassword, { req }) => newPassword !== req.body.currentPassword)
    .withMessage('New password must differ from current password'),
];
