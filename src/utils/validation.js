/**
 * Universal Validation & Formatting Utilities
 * Single Source of Truth for input sanitization and verification.
 */

/**
 * Formats raw digits into a clean, hyphenated phone number: XXX-XXX-XXXX
 * @param {string} value 
 * @returns {string} Formatted phone string
 */
export const formatPhoneNumber = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '').slice(0, 10);
  if (digits.length > 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
};

/**
 * Strips all non-digit characters and limits to 10 digits.
 * @param {string} value 
 * @returns {string} Raw 10 digits
 */
export const cleanPhoneNumber = (value) => {
  if (!value) return '';
  return String(value).replace(/\D/g, '').slice(0, 10);
};

/**
 * Validates whether a phone number contains exactly 10 digits.
 * @param {string} value 
 * @returns {boolean}
 */
export const isValidPhoneNumber = (value) => {
  const digits = cleanPhoneNumber(value);
  return digits.length === 10;
};
