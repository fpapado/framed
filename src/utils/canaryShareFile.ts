/**
 * Canary share file to pass to Navigator.canShare({files: [file]});
 * this allows detection up-front, to avoid showing share UI elements altogether.
 *
 * This was motivated by an edge case on Safari on iPhone SE, where SUPPORTS_SHARE was true, but the system could not share files.
 * It would be preferable to not show the button at all, in that case.
 *
 * This issue of needing to have a valid/canary share file up-front has been raised with implementers
 * @see https://github.com/w3c/web-share/issues/108
 */
export function getCanaryJpegShareFile() {
  const mimeType = "image/jpeg";
  // The screenshot of the app, resized to 15x32 with Squoosh, and passed through a JPEG->Base64 conversion
  // We could probably do this with webpack somehow
  // NOTE: This might fail user-agent detection, if it is flagged as malicious...
  const asBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wEEEAAyADIAMgAyADUAMgA4AD4APgA4AE4AVABLAFQATgBzAGoAYQBhAGoAcwCvAH0AhgB9AIYAfQCvAQkApQDBAKUApQDBAKUBCQDqARwA5wDXAOcBHADqAaUBSwElASUBSwGlAecBmQGDAZkB5wJOAg8CDwJOAucCwQLnA8oDygUYEQAyADIAMgAyADUAMgA4AD4APgA4AE4AVABLAFQATgBzAGoAYQBhAGoAcwCvAH0AhgB9AIYAfQCvAQkApQDBAKUApQDBAKUBCQDqARwA5wDXAOcBHADqAaUBSwElASUBSwGlAecBmQGDAZkB5wJOAg8CDwJOAucCwQLnA8oDygUY/8IAEQgAIAAPAwEiAAIRAQMRAf/EACsAAAMBAQAAAAAAAAAAAAAAAAACAwQFAQEBAAAAAAAAAAAAAAAAAAAAAf/aAAwDAQACEAMQAAAA6YoY6POv/8QAHhAAAgIABwAAAAAAAAAAAAAAAQIAAxATISIxQlH/2gAIAQEAAT8AGBZfRAyngiWg5hlI3GWA9V1lNdiuxYz/xAAWEQEBAQAAAAAAAAAAAAAAAAAAESH/2gAIAQIBAT8AXH//xAAWEQEBAQAAAAAAAAAAAAAAAAAAATH/2gAIAQMBAT8AbX//2Q==";
  const asUint8 = base64DecToArr(asBase64);
  const asBlob = new Blob([asUint8], { type: mimeType });

  return new File([asBlob], "framed-share-canary", { type: mimeType });
}

// Convert base64 to Uint8
// Array of bytes to Base64 string decoding
function b64ToUint6(nChr: number) {
  return nChr > 64 && nChr < 91
    ? nChr - 65
    : nChr > 96 && nChr < 123
    ? nChr - 71
    : nChr > 47 && nChr < 58
    ? nChr + 4
    : nChr === 43
    ? 62
    : nChr === 47
    ? 63
    : 0;
}

/** Convert base64 string to a UInt8Array
 * @see https://developer.mozilla.org/en-US/docs/Glossary/Base64#appendix_decode_a_base64_string_to_uint8array_or_arraybuffer
 */
function base64DecToArr(sBase64: string, nBlocksSize?: number) {
  const sB64Enc = sBase64.replace(/[^A-Za-z0-9+/]/g, "");
  const nInLen = sB64Enc.length;
  const nOutLen = nBlocksSize
    ? Math.ceil(((nInLen * 3 + 1) >> 2) / nBlocksSize) * nBlocksSize
    : (nInLen * 3 + 1) >> 2;
  const taBytes = new Uint8Array(nOutLen);

  let nMod3;
  let nMod4;
  let nUint24 = 0;
  let nOutIdx = 0;
  for (let nInIdx = 0; nInIdx < nInLen; nInIdx++) {
    nMod4 = nInIdx & 3;
    nUint24 |= b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << (6 * (3 - nMod4));
    if (nMod4 === 3 || nInLen - nInIdx === 1) {
      nMod3 = 0;
      while (nMod3 < 3 && nOutIdx < nOutLen) {
        taBytes[nOutIdx] = (nUint24 >>> ((16 >>> nMod3) & 24)) & 255;
        nMod3++;
        nOutIdx++;
      }
      nUint24 = 0;
    }
  }

  return taBytes;
}
