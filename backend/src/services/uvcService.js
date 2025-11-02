const fs = require('fs');
const { execSync, spawn } = require('child_process');

/**
 * Lists all V4L2 (Video4Linux2) devices available on the system.
 * Scans /dev/video* devices and retrieves device information.
 * @returns {Array<Object>} Array of UVC device objects
 */
function listV4L2Devices() {
  const devices = [];

  for (let i = 0; i < 10; i++) {
    const devicePath = `/dev/video${i}`;

    if (fs.existsSync(devicePath)) {
      const name = getDeviceInfo(devicePath);
      devices.push({
        device_path: devicePath,
        name: name,
        type: 'uvc'
      });
    }
  }

  return devices;
}

/**
 * Gets device information using v4l2-ctl command.
 * Falls back to simple device name if v4l2-ctl is not available.
 * @param {string} devicePath - Path to the V4L2 device (e.g., /dev/video0)
 * @returns {string} Human-readable device name
 */
function getDeviceInfo(devicePath) {
  try {
    // Try to use v4l2-ctl to get detailed device information
    const output = execSync(`v4l2-ctl --device=${devicePath} --info 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 2000
    });

    // Parse "Card type" from output
    const nameMatch = output.match(/Card type\s*:\s*(.+)/);
    if (nameMatch) {
      return nameMatch[1].trim();
    }
  } catch (err) {
    // v4l2-ctl not available or command failed
    console.log(`[UVC] v4l2-ctl not available or failed for ${devicePath}, using fallback name`);
  }

  // Fallback: return simple device name
  return `UVC Camera ${devicePath}`;
}

/**
 * Tests if a UVC device is accessible and can be opened by FFmpeg.
 * @param {string} devicePath - Path to the V4L2 device (e.g., /dev/video0)
 * @returns {Promise<boolean>} True if device is accessible
 */
function testUVCDevice(devicePath) {
  return new Promise((resolve, reject) => {
    // Check if device file exists
    if (!fs.existsSync(devicePath)) {
      return reject(new Error(`Device ${devicePath} not found`));
    }

    // Test device accessibility with FFmpeg
    // Try to read from the device for 1 second
    const testProcess = spawn('ffmpeg', [
      '-f', 'v4l2',
      '-i', devicePath,
      '-t', '1',         // Test for 1 second
      '-f', 'null',      // Null output (we just want to test reading)
      '-'
    ]);

    let errorOutput = '';
    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    testProcess.on('close', (code) => {
      // FFmpeg returns 0 on success, or we can check if frames were captured
      if (code === 0 || errorOutput.includes('frame=')) {
        resolve(true);
      } else {
        reject(new Error(`Failed to access ${devicePath}. Device may be in use or not compatible. FFmpeg output: ${errorOutput}`));
      }
    });

    testProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });

    // Add timeout to prevent hanging
    setTimeout(() => {
      if (!testProcess.killed) {
        testProcess.kill('SIGKILL');
        reject(new Error(`Timeout while testing ${devicePath}`));
      }
    }, 5000);
  });
}

module.exports = {
  listV4L2Devices,
  getDeviceInfo,
  testUVCDevice
};
