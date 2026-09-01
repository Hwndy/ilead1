/** Base URL embedded in student ID card QR codes. Always the live domain
 * so printed cards work regardless of where they were generated. */
export const SCAN_BASE_URL = 'https://ivintage.vercel.app';

export const buildScanUrl = (token: string) => `${SCAN_BASE_URL}/scan/${token}`;