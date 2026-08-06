import { Router } from 'express';
import {
  createAddress,
  editAddress,
  listAddresses,
  makeDefaultAddress,
  removeAddress,
} from '../controllers/addressController.js';
import authenticate from '../middleware/authenticate.js';
import validateRequest from '../middleware/validateRequest.js';
import {
  addressIdOnlyValidator,
  createAddressValidator,
  updateAddressValidator,
} from '../validators/addressValidators.js';

const router = Router();

router.get('/', authenticate, listAddresses);
router.post('/', authenticate, createAddressValidator, validateRequest, createAddress);
router.put('/:addressId', authenticate, updateAddressValidator, validateRequest, editAddress);
router.patch('/:addressId', authenticate, updateAddressValidator, validateRequest, editAddress);
router.delete('/:addressId', authenticate, addressIdOnlyValidator, validateRequest, removeAddress);
router.patch(
  '/:addressId/default',
  authenticate,
  addressIdOnlyValidator,
  validateRequest,
  makeDefaultAddress,
);

export default router;
