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
export function getCanaryEmptyShareFile() {
  return new File([], "framed-share-canary-file");
}
