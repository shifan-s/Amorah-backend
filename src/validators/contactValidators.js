import { body } from 'express-validator';

const enquirySubjects = [
  'Order support',
  'Product availability',
  'Sizing and styling',
  'Returns and exchanges',
  'Collaboration',
  'Other enquiry',
];

function normalizePhone(value) {
  return value ? String(value).replace(/\D/g, '') : '';
}

export const createContactEnquiryValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Full name must be between 2 and 80 characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizePhone)
    .matches(/^(?:91)?[6-9]\d{9}$/)
    .withMessage('Enter a valid Indian mobile number'),
  body('subject')
    .trim()
    .isIn(enquirySubjects)
    .withMessage('Select a valid enquiry subject'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Message must be between 10 and 500 characters'),
];
