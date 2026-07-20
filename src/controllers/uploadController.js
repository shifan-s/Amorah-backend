import { deleteImage, uploadImages } from '../services/uploadService.js';
import asyncHandler from '../utils/asyncHandler.js';

export const uploadAdminImages = asyncHandler(async (req, res) => {
  const files = req.files || (req.file ? [req.file] : []);
  const images = await uploadImages(files, req.body.uploadType, req.body.filenamePrefix);

  res.status(201).json({
    success: true,
    message: images.length === 1 ? 'Image uploaded successfully' : 'Images uploaded successfully',
    data: {
      images,
    },
  });
});

export const deleteAdminImage = asyncHandler(async (req, res) => {
  const result = await deleteImage(req.body.publicId);

  res.status(200).json({
    success: true,
    message: 'Image deleted successfully',
    data: result,
  });
});
