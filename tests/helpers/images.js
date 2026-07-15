import { Buffer } from 'node:buffer'

/** Minimal valid 1×1 PNG for multipart image upload tests */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

/** Default product image size limit used by PRODUCT_IMAGE_UPLOAD (5 MiB). */
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export function attachProductImage(req) {
  return req.attach('image', TINY_PNG, 'test-product.png')
}

/** Attach a text file pretending to be an image (disallowed mimetype/extension). */
export function attachInvalidImage(req) {
  return req.attach('image', Buffer.from('not-an-image'), 'malware.txt')
}

/** Attach a buffer larger than PRODUCT_IMAGE_MAX_BYTES. */
export function attachOversizedImage(req) {
  const big = Buffer.alloc(PRODUCT_IMAGE_MAX_BYTES + 1024)
  // Valid PNG header so mime/extension paths don't reject before size check
  TINY_PNG.copy(big, 0)
  return req.attach('image', big, 'huge.png')
}
