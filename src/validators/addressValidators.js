import { body, param } from 'express-validator';
import mongoose from 'mongoose';

const allowedCreateFields = [
  'fullName',
  'mobile',
  'addressLine1',
  'addressLine2',
  'landmark',
  'city',
  'state',
  'postalCode',
  'country',
  'addressType',
  'isDefault',
];
const allowedUpdateFields = allowedCreateFields.filter((field) => field !== 'country');
const indianMobilePattern = /^[6-9]\d{9}$/;
const postalCodePattern = /^\d{6}$/;

function normalizeDigits(value) {
  if (value === undefined || value === null) {
    return value;
  }

  return String(value).replace(/\D/g, '');
}

function rejectUnknownFields(allowedFields) {
  return body().custom((value) => {
    const incomingFields = Object.keys(value || {});
    const unknownField = incomingFields.find((field) => !allowedFields.includes(field));

    if (unknownField) {
      throw new Error(`${unknownField} is not allowed`);
    }

    return true;
  });
}

function trimOptionalText(field, maxLength, message) {
  return body(field)
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: maxLength })
    .withMessage(message);
}

function trimRequiredText(field, maxLength, requiredMessage, maxMessage) {
  return body(field).trim().notEmpty().withMessage(requiredMessage).bail().isLength({ max: maxLength }).withMessage(maxMessage);
}

const fullNameRequired = body('fullName')
  .trim()
  .notEmpty()
  .withMessage('Full name is required')
  .bail()
  .isLength({ min: 2, max: 80 })
  .withMessage('Full name must be between 2 and 80 characters');

const fullNameOptional = body('fullName')
  .optional({ values: 'undefined' })
  .trim()
  .isLength({ min: 2, max: 80 })
  .withMessage('Full name must be between 2 and 80 characters');

const mobileRequired = body('mobile')
  .customSanitizer(normalizeDigits)
  .notEmpty()
  .withMessage('Mobile number is required')
  .bail()
  .matches(indianMobilePattern)
  .withMessage('Enter a valid Indian mobile number');

const mobileOptional = body('mobile')
  .optional({ values: 'undefined' })
  .customSanitizer(normalizeDigits)
  .matches(indianMobilePattern)
  .withMessage('Enter a valid Indian mobile number');

const postalCodeRequired = body('postalCode')
  .customSanitizer(normalizeDigits)
  .notEmpty()
  .withMessage('Postal code is required')
  .bail()
  .matches(postalCodePattern)
  .withMessage('Postal code must be exactly six digits');

const postalCodeOptional = body('postalCode')
  .optional({ values: 'undefined' })
  .customSanitizer(normalizeDigits)
  .matches(postalCodePattern)
  .withMessage('Postal code must be exactly six digits');

const addressTypeOptional = body('addressType')
  .optional({ values: 'undefined' })
  .trim()
  .isIn(['Home', 'Work', 'Other'])
  .withMessage('Address type must be Home, Work or Other');

const isDefaultOptional = body('isDefault')
  .optional({ values: 'undefined' })
  .isBoolean()
  .withMessage('isDefault must be true or false')
  .toBoolean();

const countryOptional = body('country')
  .optional({ values: 'undefined' })
  .trim()
  .equals('India')
  .withMessage('Country must be India');

const addressIdValidator = param('addressId').custom((value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid address ID');
  }

  return true;
});

export const createAddressValidator = [
  rejectUnknownFields(allowedCreateFields),
  fullNameRequired,
  mobileRequired,
  trimRequiredText(
    'addressLine1',
    150,
    'Address line 1 is required',
    'Address line 1 must be at most 150 characters',
  ),
  trimOptionalText('addressLine2', 150, 'Address line 2 must be at most 150 characters'),
  trimOptionalText('landmark', 100, 'Landmark must be at most 100 characters'),
  trimRequiredText('city', 80, 'City is required', 'City must be at most 80 characters'),
  trimRequiredText('state', 80, 'State is required', 'State must be at most 80 characters'),
  postalCodeRequired,
  countryOptional,
  addressTypeOptional,
  isDefaultOptional,
];

export const updateAddressValidator = [
  addressIdValidator,
  rejectUnknownFields(allowedUpdateFields),
  body('_id').not().exists().withMessage('Address ID cannot be changed'),
  fullNameOptional,
  mobileOptional,
  body('addressLine1')
    .optional({ values: 'undefined' })
    .trim()
    .notEmpty()
    .withMessage('Address line 1 cannot be empty')
    .bail()
    .isLength({ max: 150 })
    .withMessage('Address line 1 must be at most 150 characters'),
  trimOptionalText('addressLine2', 150, 'Address line 2 must be at most 150 characters'),
  trimOptionalText('landmark', 100, 'Landmark must be at most 100 characters'),
  body('city')
    .optional({ values: 'undefined' })
    .trim()
    .notEmpty()
    .withMessage('City cannot be empty')
    .bail()
    .isLength({ max: 80 })
    .withMessage('City must be at most 80 characters'),
  body('state')
    .optional({ values: 'undefined' })
    .trim()
    .notEmpty()
    .withMessage('State cannot be empty')
    .bail()
    .isLength({ max: 80 })
    .withMessage('State must be at most 80 characters'),
  postalCodeOptional,
  addressTypeOptional,
  isDefaultOptional,
];

export const addressIdOnlyValidator = [addressIdValidator];
