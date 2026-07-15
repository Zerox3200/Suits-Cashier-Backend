import multer, { diskStorage } from 'multer';
import { nanoid } from 'nanoid';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';
import { MSG } from '../constants/messages.ar.js';

// ============================================================================
// Constants & Configuration
// ============================================================================

const VALID_IMAGE_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];

// Allowed MIME types for images (SVG/HTML rejected — XSS risk)
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

// Allowed file extensions (case-insensitive) — no SVG
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'
];

const DANGEROUS_FILENAME_CHARS = /[^a-zA-Z0-9._-]/g;

const DEFAULT_COMPRESS_OPTIONS = {
  quality: 80,
  maxWidth: 1920,
  maxHeight: 1920,
  format: 'jpeg'
};
const DEFAULT_LQIP_OPTIONS = {
  width: 250,
  quality: 45,
  blur: 1.5
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates if a file exists
 */
const validateFileExists = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found: ${filePath}`);
  }
};

/**
 * Validates and normalizes image format
 */
const normalizeFormat = (format) => {
  const normalized = format?.toLowerCase().trim();
  if (!normalized || !VALID_IMAGE_FORMATS.includes(normalized)) {
    throw new Error(`Invalid format. Use: ${VALID_IMAGE_FORMATS.join(', ')}`);
  }
  return normalized === 'jpg' ? 'jpeg' : normalized;
};

/**
 * Gets image metadata and validates it
 */
const getImageMetadata = async (imagePath) => {
  try {
    const metadata = await sharp(imagePath).metadata();
    if (!metadata?.width || !metadata?.height) {
      throw new Error('Unable to read image dimensions');
    }
    return metadata;
  } catch (error) {
    throw new Error(`Failed to read image metadata: ${error.message}`);
  }
};

/**
 * Calculates new dimensions while maintaining aspect ratio
 */
const calculateDimensions = (width, height, maxWidth, maxHeight) => {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }

  const aspectRatio = width / height;
  let newWidth = width;
  let newHeight = height;

  if (width > height) {
    newWidth = Math.min(width, maxWidth);
    newHeight = Math.round(newWidth / aspectRatio);
  } else {
    newHeight = Math.min(height, maxHeight);
    newWidth = Math.round(newHeight * aspectRatio);
  }

  return { width: newWidth, height: newHeight };
};

/**
 * Determines if format change is needed
 */
const needsFormatChange = (originalExt, targetFormat) => {
  const normalizedExt = originalExt.toLowerCase().replace('.', '');
  const normalizedTarget = targetFormat === 'jpg' ? 'jpeg' : targetFormat;

  // Handle jpg/jpeg equivalence
  if ((normalizedExt === 'jpg' || normalizedExt === 'jpeg') &&
    normalizedTarget === 'jpeg') {
    return false;
  }

  return normalizedExt !== normalizedTarget;
};

/**
 * Creates output path for processed image
 * Always creates a temporary path to avoid "same file" error with Sharp
 */
const createOutputPath = (imagePath, targetFormat) => {
  const fileInfo = path.parse(imagePath);
  const originalExt = fileInfo.ext;

  // Always create a temporary output path to avoid Sharp's "same file" error
  const extension = targetFormat === 'jpg' ? 'jpeg' : targetFormat;
  const tempSuffix = `_compressed_${Date.now()}`;
  return path.join(fileInfo.dir, `${fileInfo.name}${tempSuffix}.${extension}`);
};

/**
 * Applies format-specific optimizations to Sharp instance
 */
const applyFormatOptimization = (sharpInstance, format, quality) => {
  const normalizedFormat = normalizeFormat(format);

  switch (normalizedFormat) {
    case 'jpeg':
      return sharpInstance.jpeg({
        quality: Math.max(1, Math.min(100, quality)),
        mozjpeg: true,
        progressive: true
      });

    case 'png':
      return sharpInstance.png({
        quality: Math.max(1, Math.min(100, quality)),
        compressionLevel: 9,
        adaptiveFiltering: true
      });

    case 'webp':
      return sharpInstance.webp({
        quality: Math.max(1, Math.min(100, quality)),
        effort: 6
      });

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
};

/**
 * Safely deletes a file (sync — used by upload validation cleanup).
 */
const safeDeleteFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.warn(`تحذير: تعذر حذف الملف: ${filePath}`, error.message);
  }
};

const resolveUploadFullPath = (relativePath) => {
  if (!relativePath || typeof relativePath !== "string") return null;
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return path.isAbsolute(normalized)
    ? normalized
    : path.join(process.cwd(), normalized);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deletes uploaded file(s) with Windows-friendly retries for EPERM/EBUSY
 * (Sharp / antivirus often lock files briefly).
 */
export const deleteUploadedFiles = async (...relativePaths) => {
  // Drop Sharp's file cache so Windows can unlink recently processed images
  try {
    sharp.cache(false);
    sharp.cache({ files: 0, memory: 0, items: 0 });
  } catch {
    // ignore
  }

  const uniquePaths = [...new Set(relativePaths.filter(Boolean))];

  for (const relativePath of uniquePaths) {
    const fullPath = resolveUploadFullPath(relativePath);
    if (!fullPath) continue;

    let lastError = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        if (!fs.existsSync(fullPath)) {
          lastError = null;
          break;
        }
        try {
          await fs.promises.chmod(fullPath, 0o666);
        } catch {
          // ignore chmod failures on Windows
        }
        await fs.promises.unlink(fullPath);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (error.code === "EPERM" || error.code === "EBUSY" || error.code === "EACCES") {
          await sleep(75 * (attempt + 1));
          continue;
        }
        break;
      }
    }

    if (lastError) {
      console.warn(
        `تحذير: تعذر حذف الملف: ${fullPath}`,
        lastError.message
      );
    }
  }

  // Restore a light Sharp cache after deletes
  try {
    sharp.cache({ files: 20, memory: 50, items: 100 });
  } catch {
    // ignore
  }
};

/**
 * Extracts file path from various input types
 */
const extractFilePath = (input) => {
  if (typeof input === 'string') return input;
  if (input?.path) return input.path;
  if (input?.filepath) return input.filepath;
  throw new Error('Invalid input: cannot extract file path');
};

/**
 * Sanitize client filename for display only — never used on disk.
 */
export const sanitizeOriginalFilename = (originalname) => {
  const base = path.basename(String(originalname || "file"));
  const cleaned = base.replace(DANGEROUS_FILENAME_CHARS, "_").slice(0, 180);
  return cleaned || "file";
};

/**
 * Validates if file extension is allowed
 */
const isValidExtension = (filename) => {
  if (!filename || typeof filename !== "string") {
    return false;
  }
  const safeName = path.basename(filename);
  const ext = path.extname(safeName).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
};

/**
 * Validates if MIME type is allowed
 */
const isValidMimeType = (mimetype) => {
  if (!mimetype || typeof mimetype !== "string") {
    return false;
  }
  return ALLOWED_MIME_TYPES.includes(mimetype.toLowerCase());
};

/**
 * File filter — requires BOTH MIME type and extension (strict by default).
 */
const createFileFilter = (options = {}) => {
  const {
    allowedMimeTypes = ALLOWED_MIME_TYPES,
    allowedExtensions = ALLOWED_EXTENSIONS,
    strict = true,
  } = options;

  return (req, file, cb) => {
    try {
      const safeOriginal = sanitizeOriginalFilename(file.originalname);
      file.originalNameDisplay = safeOriginal;
      file.originalname = safeOriginal;

      const mime = (file.mimetype || "").toLowerCase();
      if (
        mime.includes("svg") ||
        mime.includes("html") ||
        mime.includes("javascript") ||
        mime.includes("x-msdownload") ||
        mime.includes("x-executable")
      ) {
        return cb(new Error("This file type is not allowed"), false);
      }

      const mimeTypeValid =
        file.mimetype && allowedMimeTypes.includes(file.mimetype.toLowerCase());

      const extensionValid =
        file.originalname &&
        allowedExtensions.includes(
          path.extname(file.originalname).toLowerCase()
        );

      if (strict) {
        if (mimeTypeValid && extensionValid) {
          cb(null, true);
        } else {
          cb(
            new Error(
              `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}. ` +
                `Allowed extensions: ${allowedExtensions.join(", ")}`
            ),
            false
          );
        }
      } else if (mimeTypeValid || extensionValid) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Invalid file type. Allowed types: ${allowedMimeTypes.join(", ")}. ` +
              `Allowed extensions: ${allowedExtensions.join(", ")}`
          ),
          false
        );
      }
    } catch (error) {
      cb(new Error(`File filter error: ${error.message}`), false);
    }
  };
};

/**
 * Processes a single file object
 */
const processFile = async (file, processor) => {
  if (!file?.path) {
    throw new Error('Invalid file object: missing path');
  }

  const result = await processor(file.path);

  if (typeof result === 'string') {
    file.path = result;
    file.filename = path.basename(result);
  } else if (result && typeof result === 'object') {
    file.path = result.compressedPath || result.path || file.path;
    file.filename = path.basename(file.path);
    if (result.lqip) file.lqip = result.lqip;
  }

  return file;
};

/**
 * Processes multiple files (array or object)
 */
const processFiles = async (files, processor) => {
  if (Array.isArray(files)) {
    return Promise.all(files.map(file => processFile(file, processor)));
  }

  if (typeof files === 'object' && files !== null) {
    const results = {};
    for (const fieldname in files) {
      const fieldFiles = Array.isArray(files[fieldname])
        ? files[fieldname]
        : [files[fieldname]];
      results[fieldname] = await Promise.all(
        fieldFiles.map(file => processFile(file, processor))
      );
    }
    return results;
  }

  throw new Error('Invalid files input: expected array or object');
};

// ============================================================================
// Main Upload Function
// ============================================================================

/**
 * Creates Multer upload middleware with file filtering
 * @param {Object} options - Upload configuration
 * @param {string} options.folder - Folder name for uploads (required)
 * @param {Object} options.fileFilter - File filter options
 * @param {string[]} options.fileFilter.allowedMimeTypes - Custom allowed MIME types
 * @param {string[]} options.fileFilter.allowedExtensions - Custom allowed extensions
 * @param {boolean} options.fileFilter.strict - Require both MIME type and extension match
 * @param {boolean} options.fileFilter.enabled - Enable/disable file filtering (default: true)
 * @returns {Object} - Multer middleware instance
 */
export const upload = ({ folder, fileFilter: fileFilterOptions = {}, limits } = {}) => {
  if (!folder || typeof folder !== 'string') {
    throw new Error('Folder name is required');
  }

  const {
    enabled = true,
    ...filterOptions
  } = fileFilterOptions;

  const storage = diskStorage({
    destination: (req, file, cb) => {
      try {
        const destination = `uploads/${folder}/${file.fieldname}`;
        fs.mkdirSync(destination, { recursive: true });
        cb(null, destination);
      } catch (error) {
        cb(error, null);
      }
    },
    filename: (req, file, cb) => {
      try {
        const safeOriginal = sanitizeOriginalFilename(file.originalname);
        file.originalNameDisplay = safeOriginal;
        const ext = path.extname(safeOriginal).toLowerCase() || "";
        // Random disk name only — never trust client path/name
        const filename = `${nanoid(24)}${ext}`;
        cb(null, filename);
      } catch (error) {
        cb(error, null);
      }
    }
  });

  const multerConfig = { storage };
  if (limits) multerConfig.limits = limits;

  // Add file filter if enabled
  if (enabled) {
    multerConfig.fileFilter = createFileFilter(filterOptions);
  }

  return multer(multerConfig);
};

// ============================================================================
// Image Compression Functions
// ============================================================================

/**
 * Compress and optimize image for web performance
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - Compression options
 * @param {number} options.quality - JPEG/WebP quality (1-100), default: 80
 * @param {number} options.maxWidth - Maximum width in pixels, default: 1920
 * @param {number} options.maxHeight - Maximum height in pixels, default: 1920
 * @param {string} options.format - Output format ('jpeg', 'png', 'webp'), default: 'jpeg'
 * @returns {Promise<string>} - Path to the compressed image
 */
export const compressImage = async (imagePath, options = {}) => {
  const {
    quality = DEFAULT_COMPRESS_OPTIONS.quality,
    maxWidth = DEFAULT_COMPRESS_OPTIONS.maxWidth,
    maxHeight = DEFAULT_COMPRESS_OPTIONS.maxHeight,
    format = DEFAULT_COMPRESS_OPTIONS.format
  } = options;

  try {
    validateFileExists(imagePath);
    const targetFormat = normalizeFormat(format);
    const outputPath = createOutputPath(imagePath, targetFormat);

    const metadata = await getImageMetadata(imagePath);
    const { width, height } = calculateDimensions(
      metadata.width,
      metadata.height,
      maxWidth,
      maxHeight
    );

    let sharpInstance = sharp(imagePath);

    // Resize if dimensions changed
    if (width !== metadata.width || height !== metadata.height) {
      sharpInstance = sharpInstance.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Apply format-specific optimizations
    sharpInstance = applyFormatOptimization(sharpInstance, targetFormat, quality);

    // Write compressed image to temporary path
    await sharpInstance.toFile(outputPath);

    // Determine final path (same as original if format didn't change, or new extension if it did)
    const fileInfo = path.parse(imagePath);
    const originalExt = fileInfo.ext.toLowerCase().replace('.', '');
    const normalizedTarget = targetFormat === 'jpg' ? 'jpeg' : targetFormat;
    const finalExtension = (originalExt === 'jpg' || originalExt === 'jpeg') && normalizedTarget === 'jpeg'
      ? fileInfo.ext
      : `.${normalizedTarget}`;

    const finalPath = path.join(fileInfo.dir, `${fileInfo.name}${finalExtension}`);

    // If final path is different from temp path, move/rename the file
    if (outputPath !== finalPath) {
      // Delete old file if it exists and is different
      if (finalPath !== imagePath && fs.existsSync(finalPath)) {
        safeDeleteFile(finalPath);
      }
      // Move temp file to final location
      fs.renameSync(outputPath, finalPath);
    }

    // Delete original file if it's different from final path
    if (finalPath !== imagePath && fs.existsSync(imagePath)) {
      safeDeleteFile(imagePath);
    }

    return finalPath;
  } catch (error) {
    throw new Error(`Image compression failed: ${error.message}`);
  }
};

/**
 * Compress multiple images
 * @param {string[]|Object[]} images - Array of image paths or file objects
 * @param {Object} options - Compression options
 * @returns {Promise<string[]>} - Array of paths to compressed images
 */
export const compressImages = async (images, options = {}) => {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('Images array is required and must not be empty');
  }

  try {
    const imagePaths = images.map(extractFilePath);
    return Promise.all(imagePaths.map(path => compressImage(path, options)));
  } catch (error) {
    throw new Error(`Batch image compression failed: ${error.message}`);
  }
};

// ============================================================================
// LQIP Functions
// ============================================================================

/**
 * Generate Low Quality Image Placeholder (LQIP) as base64 data URI
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - LQIP options
 * @param {number} options.width - Placeholder width in pixels, default: 20
 * @param {number} options.quality - JPEG quality (1-100), default: 20
 * @param {number} options.blur - Blur radius (0-100), default: 4
 * @returns {Promise<string>} - Base64 data URI
 */
export const generateLQIP = async (imagePath, options = {}) => {
  const {
    width = DEFAULT_LQIP_OPTIONS.width,
    quality = DEFAULT_LQIP_OPTIONS.quality,
    blur = DEFAULT_LQIP_OPTIONS.blur
  } = options;

  try {
    validateFileExists(imagePath);

    const metadata = await getImageMetadata(imagePath);
    const aspectRatio = metadata.height / metadata.width;
    const height = Math.max(1, Math.round(width * aspectRatio));

    const buffer = await sharp(imagePath)
      .resize(Math.max(1, width), height, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .blur(Math.max(0, Math.min(100, blur)))
      .jpeg({
        quality: Math.max(1, Math.min(100, quality)),
        mozjpeg: true,
        progressive: true
      })
      .toBuffer();

    return `data:image/jpeg;base64,${buffer.toString('base64')}`;
  } catch (error) {
    throw new Error(`LQIP generation failed: ${error.message}`);
  }
};

/**
 * Generate LQIP and save as a separate file
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - LQIP options
 * @param {number} options.width - Placeholder width in pixels, default: 20
 * @param {number} options.quality - JPEG quality (1-100), default: 20
 * @param {number} options.blur - Blur radius (0-100), default: 4
 * @param {string} options.suffix - Suffix for placeholder filename, default: '_lqip'
 * @returns {Promise<string>} - Path to the LQIP file
 */
export const generateLQIPFile = async (imagePath, options = {}) => {
  const {
    width = DEFAULT_LQIP_OPTIONS.width,
    quality = DEFAULT_LQIP_OPTIONS.quality,
    blur = DEFAULT_LQIP_OPTIONS.blur,
    suffix = '_lqip'
  } = options;

  try {
    validateFileExists(imagePath);

    const fileInfo = path.parse(imagePath);
    const lqipPath = path.join(fileInfo.dir, `${fileInfo.name}${suffix}.jpg`);

    const metadata = await getImageMetadata(imagePath);
    const aspectRatio = metadata.height / metadata.width;
    const height = Math.max(1, Math.round(width * aspectRatio));

    await sharp(imagePath)
      .resize(Math.max(1, width), height, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .blur(Math.max(0, Math.min(100, blur)))
      .jpeg({
        quality: Math.max(1, Math.min(100, quality)),
        mozjpeg: true,
        progressive: true
      })
      .toFile(lqipPath);

    return lqipPath;
  } catch (error) {
    throw new Error(`LQIP file generation failed: ${error.message}`);
  }
};


export const compressImageWithLQIP = async (imagePath, options = {}) => {
  const {
    generateLQIP: shouldGenerateLQIP = true,
    lqipAsFile = false,
    lqipOptions = {},
    ...compressOptions
  } = options;

  try {
    const compressedPath = await compressImage(imagePath, compressOptions);

    let lqip = null;
    if (shouldGenerateLQIP) {
      if (lqipAsFile) {
        const lqipPath = await generateLQIPFile(compressedPath, lqipOptions);
        lqip = getRelativePath(lqipPath);
      } else {
        lqip = await generateLQIP(compressedPath, lqipOptions);
      }
    }

    return { compressedPath, lqip };
  } catch (error) {
    throw new Error(`Image compression with LQIP failed: ${error.message}`);
  }
};


const getRelativePath = (filePath) => {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, '/');
  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex !== -1) {
    const path = normalized.substring(uploadsIndex);
    return path.startsWith('/') ? path : '/' + path;
  }
  return normalized.startsWith('/') ? normalized : '/' + normalized;
};


const getFileRelativePath = (file) => {
  if (!file?.path) return null;
  return getRelativePath(file.path);
};

export const compressUploadedImages = (options = {}) => {
  return async (req, res, next) => {
    try {
      if (req.file) {
        await processFile(req.file, (path) => compressImage(path, options));
        // Convert to relative path
        req.file.relativePath = getFileRelativePath(req.file);
      }

      if (req.files) {
        await processFiles(req.files, (path) => compressImage(path, options));

        // Convert all files to relative paths
        if (Array.isArray(req.files)) {
          req.files.forEach(file => {
            file.relativePath = getFileRelativePath(file);
          });
        } else {
          for (const fieldname in req.files) {
            const files = Array.isArray(req.files[fieldname])
              ? req.files[fieldname]
              : [req.files[fieldname]];
            files.forEach(file => {
              file.relativePath = getFileRelativePath(file);
            });
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


export const compressUploadedImagesWithLQIP = (options = {}) => {
  return async (req, res, next) => {
    try {
      if (req.file) {
        await processFile(req.file, (path) => compressImageWithLQIP(path, options));
        // Convert to relative path
        req.file.relativePath = getFileRelativePath(req.file);
      }

      if (req.files) {
        await processFiles(req.files, (path) => compressImageWithLQIP(path, options));

        // Convert all files to relative paths
        if (Array.isArray(req.files)) {
          req.files.forEach(file => {
            file.relativePath = getFileRelativePath(file);
          });
        } else {
          for (const fieldname in req.files) {
            const files = Array.isArray(req.files[fieldname])
              ? req.files[fieldname]
              : [req.files[fieldname]];
            files.forEach(file => {
              file.relativePath = getFileRelativePath(file);
            });
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};


const matchesMagic = (buf, signature) => {
  if (!buf || buf.length < signature.length) return false;
  return signature.every((byte, i) => buf[i] === byte);
};

const detectFileKind = (buf) => {
  if (!buf || buf.length < 4) return null;
  if (matchesMagic(buf, [0xff, 0xd8, 0xff])) return "jpeg";
  if (matchesMagic(buf, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (matchesMagic(buf, [0x47, 0x49, 0x46])) return "gif";
  if (matchesMagic(buf, [0x42, 0x4d])) return "bmp";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  if (buf.toString("ascii", 0, 4) === "%PDF") return "pdf";
  if (matchesMagic(buf, [0x50, 0x4b, 0x03, 0x04])) return "zip";
  if (buf[0] === 0xd0 && buf[1] === 0xcf) return "ole";
  const head = buf.toString("utf8", 0, Math.min(buf.length, 512)).toLowerCase();
  if (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<svg") ||
    head.includes("<script")
  ) {
    return "html";
  }
  if (/^[\s\w,"';.-]+$/.test(head.slice(0, 80))) return "csv";
  return null;
};

const EXT_TO_KIND = {
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".png": "png",
  ".gif": "gif",
  ".bmp": "bmp",
  ".webp": "webp",
  ".tif": "tiff",
  ".tiff": "tiff",
  ".pdf": "pdf",
  ".xlsx": "zip",
  ".xls": "ole",
  ".csv": "csv",
};

/**
 * Post-upload magic-byte validation. Deletes rejected files from disk.
 */
export const validateUploadedFileSignatures = async (req, res, next) => {
  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) files.push(...req.files);
    else {
      for (const list of Object.values(req.files)) {
        if (Array.isArray(list)) files.push(...list);
        else if (list) files.push(list);
      }
    }
  }

  try {
    for (const file of files) {
      if (!file?.path || !fs.existsSync(file.path)) continue;
      const fd = fs.openSync(file.path, "r");
      const buf = Buffer.alloc(512);
      const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
      fs.closeSync(fd);
      const sample = buf.subarray(0, bytesRead);
      const kind = detectFileKind(sample);
      const ext = path.extname(file.filename || file.originalname || "").toLowerCase();
      const expected = EXT_TO_KIND[ext];

      if (kind === "html") {
        safeDeleteFile(file.path);
        return next(Object.assign(new Error("تم رفض محتوى الملف"), { cause: 400 }));
      }

      // CSV is text — magic bytes are unreliable; allow null kind for .csv
      if (expected === "csv") {
        if (kind && kind !== "csv" && kind !== "html") {
          // still ok if kind is null
        }
        continue;
      }

      if (!kind) {
        safeDeleteFile(file.path);
        return next(Object.assign(new Error("تم رفض محتوى الملف"), { cause: 400 }));
      }

      if (expected && kind !== expected) {
        if (!(ext === ".xlsx" && kind === "zip") && !(ext === ".xls" && (kind === "ole" || kind === "zip"))) {
          safeDeleteFile(file.path);
          return next(
            Object.assign(new Error("توقيع الملف لا يطابق الامتداد"), {
              cause: 400,
            })
          );
        }
      }
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

/** Shop storefront logo — field name must match frontend `FormData.append("logo", file)`. */
export const SHOP_LOGO_FIELD = "logo";

export const SHOP_LOGO_UPLOAD = {
  folder: "shops",
  fields: SHOP_LOGO_FIELD,
  maxCount: 1,
  generateLQIP: true,
  lqipAsFile: false,
  compressOptions: {
    quality: 85,
    maxWidth: 800,
    maxHeight: 800,
    format: "jpeg",
  },
  lqipOptions: {
    width: 64,
    quality: 45,
    blur: 1.5,
  },
};

/** Product catalog: HQ file + separate low-res `_lqip` file */
export const PRODUCT_IMAGE_UPLOAD = {
  folder: "products",
  fields: "image",
  maxCount: 1,
  generateLQIP: true,
  lqipAsFile: true,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MiB
  },
  compressOptions: {
    quality: 85,
    maxWidth: 1600,
    maxHeight: 1600,
    format: "jpeg",
  },
  lqipOptions: {
    width: 64,
    quality: 1,
    blur: 1.5,
    suffix: "_lqip",
  },
};

const mapUploadError = (err) => {
  if (!err) return null;
  const mapped = new Error(
    err.code === "LIMIT_FILE_SIZE" ? MSG.IMAGE_TOO_LARGE : MSG.INVALID_IMAGE_TYPE
  );
  mapped.cause = 400;
  return mapped;
};

/** Wrap multer middleware so size/type failures return Arabic API messages. */
const withMappedUploadErrors = (middleware) => (req, res, next) => {
  middleware(req, res, (err) => {
    if (!err) return next();
    return next(mapUploadError(err));
  });
};

export const imageUpload = (config = {}) => {
  const {
    folder,
    fields = 'image',
    maxCount = 5,
    generateLQIP = true,
    lqipAsFile = false,
    compressOptions = {},
    lqipOptions = {},
    fileFilter = {},
    limits,
  } = config;

  if (!folder) {
    throw new Error('Folder name is required for imageUpload middleware');
  }

  const uploadMiddleware = upload({ folder, fileFilter, limits });

  let multerHandler;
  if (typeof fields === 'string') {
    multerHandler = maxCount === 1
      ? uploadMiddleware.single(fields)
      : uploadMiddleware.array(fields, maxCount);
  } else if (Array.isArray(fields)) {
    const fieldsConfig = fields.map(field => ({
      name: field,
      maxCount: maxCount
    }));
    multerHandler = uploadMiddleware.fields(fieldsConfig);
  } else {
    throw new Error('Fields must be a string or array of strings');
  }

  const processingMiddleware = generateLQIP
    ? compressUploadedImagesWithLQIP({
      ...compressOptions,
      lqipOptions,
      lqipAsFile,
    })
    : compressUploadedImages(compressOptions);

  return [
    withMappedUploadErrors(multerHandler),
    validateUploadedFileSignatures,
    processingMiddleware,
  ];
};

export const shopLogoUploadMiddleware = imageUpload(SHOP_LOGO_UPLOAD);

export const extractImagePaths = (req, fieldNames = 'image') => {
  const result = {};
  const fields = Array.isArray(fieldNames) ? fieldNames : [fieldNames];

  fields.forEach(fieldName => {
    // Check single file
    if (req.file && req.file.fieldname === fieldName) {
      result[fieldName] = req.file.relativePath || getFileRelativePath(req.file);
      result[`${fieldName}LQIP`] = req.file.lqip || null;
      return;
    }

    // Check files array
    if (req.files) {
      if (Array.isArray(req.files)) {
        // All files are in one array
        const fieldFiles = req.files.filter(f => f.fieldname === fieldName);
        if (fieldFiles.length > 0) {
          result[fieldName] = fieldFiles.map(f => f.relativePath || getFileRelativePath(f));
          result[`${fieldName}LQIP`] = fieldFiles.map(f => f.lqip || null);
        }
      } else if (req.files[fieldName]) {
        // Field-specific files
        const fieldFiles = Array.isArray(req.files[fieldName])
          ? req.files[fieldName]
          : [req.files[fieldName]];

        if (fieldFiles.length > 0) {
          result[fieldName] = fieldFiles.map(f => f.relativePath || getFileRelativePath(f));
          result[`${fieldName}LQIP`] = fieldFiles.map(f => f.lqip || null);
        }
      }
    }

    // Set defaults if not found
    if (!result[fieldName]) {
      result[fieldName] = null;
      result[`${fieldName}LQIP`] = null;
    }
  });

  return result;
};

export const getSingleImage = (req, fieldName = 'image') => {
  const extracted = extractImagePaths(req, fieldName);
  return {
    path: extracted[fieldName] || null,
    lqip: extracted[`${fieldName}LQIP`] || null
  };
};


export const getMultipleImages = (req, fieldName = 'images') => {
  const extracted = extractImagePaths(req, fieldName);
  const paths = Array.isArray(extracted[fieldName])
    ? extracted[fieldName]
    : (extracted[fieldName] ? [extracted[fieldName]] : []);
  const lqips = Array.isArray(extracted[`${fieldName}LQIP`])
    ? extracted[`${fieldName}LQIP`]
    : (extracted[`${fieldName}LQIP`] ? [extracted[`${fieldName}LQIP`]] : []);

  return {
    paths,
    lqips
  };
};

const PDF_MIME_TYPES = ["application/pdf"];
const PDF_EXTENSIONS = [".pdf"];

/** PDF-only upload middleware (no compression) */
export const pdfUpload = (config = {}) => {
  const { folder, fields = "attachment", maxCount = 1 } = config;

  if (!folder) {
    throw new Error("Folder name is required for pdfUpload middleware");
  }

  const uploadMiddleware = upload({
    folder,
    fileFilter: {
      allowedMimeTypes: PDF_MIME_TYPES,
      allowedExtensions: PDF_EXTENSIONS,
      strict: true,
    },
  });

  const multerHandler =
    typeof fields === "string"
      ? maxCount === 1
        ? uploadMiddleware.single(fields)
        : uploadMiddleware.array(fields, maxCount)
      : null;

  if (!multerHandler) {
    throw new Error("Fields must be a string for pdfUpload");
  }

  return [multerHandler, validateUploadedFileSignatures];
};

export const getSinglePdf = (req, fieldName = "attachment") => {
  if (req.file && req.file.fieldname === fieldName) {
    return req.file.relativePath || getFileRelativePath(req.file);
  }
  if (req.files?.[fieldName]?.[0]) {
    const file = req.files[fieldName][0];
    return file.relativePath || getFileRelativePath(file);
  }
  return null;
};

const SPREADSHEET_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"];

/** Excel/CSV upload for bulk imports (no compression) */
export const spreadsheetUpload = (config = {}) => {
  const { folder, fields = "file", maxCount = 1 } = config;

  if (!folder) {
    throw new Error("Folder name is required for spreadsheetUpload middleware");
  }

  const uploadMiddleware = upload({
    folder,
    fileFilter: {
      allowedMimeTypes: SPREADSHEET_MIME_TYPES,
      allowedExtensions: SPREADSHEET_EXTENSIONS,
      strict: true,
    },
  });

  const multerHandler =
    typeof fields === "string"
      ? maxCount === 1
        ? uploadMiddleware.single(fields)
        : uploadMiddleware.array(fields, maxCount)
      : null;

  if (!multerHandler) {
    throw new Error("Fields must be a string for spreadsheetUpload");
  }

  return [multerHandler, validateUploadedFileSignatures];
};
