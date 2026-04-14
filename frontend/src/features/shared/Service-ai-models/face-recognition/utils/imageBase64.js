/**
 * Normalize a canvas data URL or raw base64 for API payloads.
 */
export function stripDataUrlPrefix(dataUrlOrBase64) {
  if (typeof dataUrlOrBase64 !== 'string') return '';
  const marker = 'base64,';
  const i = dataUrlOrBase64.indexOf(marker);
  return i >= 0 ? dataUrlOrBase64.slice(i + marker.length) : dataUrlOrBase64;
}
