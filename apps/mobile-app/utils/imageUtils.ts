import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

/**
 * Processes an image to optimize it for upload
 * - Resizes to a reasonable width while maintaining aspect ratio
 * - Compresses the image to reduce file size
 */
export const manipulateImage = async (imageUri: string) => {
  return await manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
};
