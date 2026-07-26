import env from '../config/env.js';
import { getMailer } from '../config/mailer.js';
import contactEnquiryEmail from '../templates/email/contactEnquiryEmail.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const createContactEnquiry = asyncHandler(async (req, res) => {
  const mailer = getMailer();

  if (!mailer) {
    throw new ApiError(503, 'Enquiry email is temporarily unavailable. Please try again later.');
  }

  const enquiry = {
    name: req.body.name,
    email: req.body.email,
    phone: req.body.phone || '',
    subject: req.body.subject,
    message: req.body.message,
  };
  const content = contactEnquiryEmail(enquiry);

  try {
    await mailer.sendMail({
      from: {
        name: env.emailFromName,
        address: env.emailFromAddress,
      },
      to: env.contactEnquiryEmail,
      replyTo: enquiry.email,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  } catch {
    throw new ApiError(502, 'Unable to send your enquiry right now. Please try again later.');
  }

  res.status(201).json({
    success: true,
    message: 'Your enquiry has been sent to Amorah.',
  });
});
