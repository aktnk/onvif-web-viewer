/**
 * Camera validation utilities
 *
 * Provides type-based validation for ONVIF and UVC cameras.
 */

/**
 * Validates camera data based on camera type
 * @param {Object} camera - Camera data to validate
 * @param {string} camera.type - Camera type ('onvif', 'uvc', or 'uvc_rtsp')
 * @param {string} camera.name - Camera name
 * @throws {Error} If validation fails
 */
function validateCameraData(camera) {
  if (!camera.type) {
    throw new Error('Camera type is required');
  }

  if (!['onvif', 'uvc', 'uvc_rtsp'].includes(camera.type)) {
    throw new Error(`Invalid camera type: ${camera.type}. Must be 'onvif', 'uvc', or 'uvc_rtsp'`);
  }

  if (!camera.name || typeof camera.name !== 'string' || camera.name.trim() === '') {
    throw new Error('Camera name is required and must be a non-empty string');
  }

  if (camera.type === 'onvif') {
    // ONVIF-specific validation
    if (!camera.host || typeof camera.host !== 'string' || camera.host.trim() === '') {
      throw new Error('ONVIF cameras require a valid host');
    }

    if (!camera.user || typeof camera.user !== 'string') {
      throw new Error('ONVIF cameras require a username');
    }

    if (!camera.pass || typeof camera.pass !== 'string') {
      throw new Error('ONVIF cameras require a password');
    }

    // Port validation (optional, will default to 80)
    if (camera.port !== undefined) {
      const port = Number(camera.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Port must be an integer between 1 and 65535');
      }
    }

    // xaddr is optional, but if provided, must be a string
    if (camera.xaddr !== undefined && camera.xaddr !== null && typeof camera.xaddr !== 'string') {
      throw new Error('xaddr must be a string');
    }

  } else if (camera.type === 'uvc_rtsp') {
    // UVC_RTSP-specific validation (similar to ONVIF but credentials are optional)
    if (!camera.host || typeof camera.host !== 'string' || camera.host.trim() === '') {
      throw new Error('UVC_RTSP cameras require a valid host (RTSP server address)');
    }

    // Port validation (required for RTSP server)
    if (!camera.port) {
      throw new Error('UVC_RTSP cameras require a port (RTSP server port, typically 8554)');
    }
    const port = Number(camera.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('Port must be an integer between 1 and 65535');
    }

    // Username and password are optional for UVC_RTSP
    if (camera.user !== undefined && camera.user !== null && typeof camera.user !== 'string') {
      throw new Error('Username must be a string if provided');
    }

    if (camera.pass !== undefined && camera.pass !== null && typeof camera.pass !== 'string') {
      throw new Error('Password must be a string if provided');
    }

  } else if (camera.type === 'uvc') {
    // UVC-specific validation (direct V4L2 access)
    if (!camera.device_path || typeof camera.device_path !== 'string' || camera.device_path.trim() === '') {
      throw new Error('UVC cameras require a valid device_path (e.g., /dev/video0)');
    }

    // Validate device_path format
    if (!camera.device_path.startsWith('/dev/video')) {
      throw new Error('device_path must start with /dev/video');
    }
  }
}

/**
 * Validates camera update data
 * @param {Object} updates - Update data
 * @param {Object} currentCamera - Current camera data from database
 * @returns {Object} Allowed and validated updates
 * @throws {Error} If validation fails
 */
function validateCameraUpdate(updates, currentCamera) {
  const ALLOWED_UPDATE_FIELDS = {
    onvif: ['name', 'host', 'port', 'user', 'pass', 'xaddr'],
    uvc: ['name', 'device_path'],
    uvc_rtsp: ['name', 'host', 'port', 'user', 'pass']
  };

  const allowedFields = ALLOWED_UPDATE_FIELDS[currentCamera.type] || [];
  const allowedUpdates = {};
  const invalidFields = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      // Type-specific validation
      switch (key) {
        case 'name':
        case 'host':
        case 'user':
        case 'pass':
        case 'xaddr':
        case 'device_path':
          if (typeof value !== 'string') {
            throw new Error(`Field '${key}' must be a string`);
          }
          if ((key === 'name' || key === 'host') && value.trim() === '') {
            throw new Error(`Field '${key}' cannot be empty`);
          }
          if (key === 'device_path' && !value.startsWith('/dev/video')) {
            throw new Error('device_path must start with /dev/video');
          }
          allowedUpdates[key] = value;
          break;

        case 'port':
          const port = Number(value);
          if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error('Port must be an integer between 1 and 65535');
          }
          allowedUpdates[key] = port;
          break;

        default:
          invalidFields.push(key);
      }
    } else {
      invalidFields.push(key);
    }
  }

  if (invalidFields.length > 0) {
    throw new Error(`Invalid or disallowed fields for ${currentCamera.type} camera: ${invalidFields.join(', ')}`);
  }

  if (Object.keys(allowedUpdates).length === 0) {
    throw new Error('No valid update fields provided');
  }

  return allowedUpdates;
}

module.exports = {
  validateCameraData,
  validateCameraUpdate
};
