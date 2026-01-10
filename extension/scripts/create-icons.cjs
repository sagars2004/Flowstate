#!/usr/bin/env node

/**
 * Simple script to create placeholder PNG icons for Chrome extension
 * Creates solid blue square icons with proper dimensions
 */

const fs = require('fs');
const path = require('path');

// Minimal valid PNG with specified dimensions
// This is a base64-encoded PNG structure
function createPNG(size, color = [59, 130, 246]) {
  // Create a simple solid color PNG
  // Using PNG chunk structure: IHDR, IDAT, IEND
  const width = size;
  const height = size;
  const [r, g, b] = color;
  
  // PNG signature (8 bytes)
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // Create IHDR chunk
  const ihdrData = Buffer.allocUnsafe(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  const ihdrCRC = calculateCRC(ihdrData);
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]), // length
    Buffer.from('IHDR'),
    ihdrData,
    Buffer.from([
      (ihdrCRC >>> 24) & 0xFF,
      (ihdrCRC >>> 16) & 0xFF,
      (ihdrCRC >>> 8) & 0xFF,
      ihdrCRC & 0xFF
    ])
  ]);
  
  // Create IDAT chunk with solid color data
  const pixelData = Buffer.allocUnsafe(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    pixelData[i * 3] = r;
    pixelData[i * 3 + 1] = g;
    pixelData[i * 3 + 2] = b;
  }
  
  // Compress pixel data (simple approach - use zlib if available, otherwise minimal)
  let compressedData;
  try {
    const zlib = require('zlib');
    compressedData = zlib.deflateSync(pixelData);
  } catch (e) {
    // Fallback: use uncompressed (not standard but will work for testing)
    compressedData = pixelData;
  }
  
  const idatCRC = calculateCRC(Buffer.concat([Buffer.from('IDAT'), compressedData]));
  const idatChunk = Buffer.concat([
    Buffer.from([
      (compressedData.length >>> 24) & 0xFF,
      (compressedData.length >>> 16) & 0xFF,
      (compressedData.length >>> 8) & 0xFF,
      compressedData.length & 0xFF
    ]),
    Buffer.from('IDAT'),
    compressedData,
    Buffer.from([
      (idatCRC >>> 24) & 0xFF,
      (idatCRC >>> 16) & 0xFF,
      (idatCRC >>> 8) & 0xFF,
      idatCRC & 0xFF
    ])
  ]);
  
  // IEND chunk
  const iendChunk = Buffer.from([
    0, 0, 0, 0, // length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82 // CRC
  ]);
  
  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function calculateCRC(data) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create icons
const iconsDir = path.join(__dirname, '../icons');
const sizes = [16, 48, 128];

console.log('Creating placeholder icons...');

sizes.forEach(size => {
  try {
    const pngData = createPNG(size);
    const filePath = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(filePath, pngData);
    console.log(`✓ Created icon-${size}.png (${size}x${size})`);
  } catch (error) {
    console.error(`✗ Failed to create icon-${size}.png:`, error.message);
    // Fallback: use a known good minimal PNG
    const minimalPNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), minimalPNG);
    console.log(`  (Using minimal placeholder for icon-${size}.png)`);
  }
});

console.log('Done!');
