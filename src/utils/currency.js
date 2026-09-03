// Currency detection and formatting utility for HelpHive

export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
];

const CURRENCY_STORAGE_KEY = 'helphive_user_currency';

/**
 * Auto-detect user's currency based on timezone & locale,
 * falling back to saved preference if present.
 */
export const detectUserCurrency = () => {
  try {
    // 1. Check if user explicitly chose a currency override
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (saved) {
      const match = SUPPORTED_CURRENCIES.find(c => c.code === saved);
      if (match) return match;
    }

    // 2. Zero-permission auto-detection via device timezone & locale
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();

    // Check India
    if (
      tz.includes('calcutta') ||
      tz.includes('kolkata') ||
      tz.includes('india') ||
      lang.includes('en-in') ||
      lang.includes('hi')
    ) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'INR') || SUPPORTED_CURRENCIES[0];
    }

    // Check UK / London
    if (tz.includes('london') || lang.includes('en-gb')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'GBP') || SUPPORTED_CURRENCIES[3];
    }

    // Check Europe
    if (tz.startsWith('europe/')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'EUR') || SUPPORTED_CURRENCIES[2];
    }

    // Check UAE / Middle East
    if (tz.includes('dubai') || lang.includes('ar-ae')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'AED') || SUPPORTED_CURRENCIES[4];
    }

    // Check Canada
    if (tz.includes('toronto') || tz.includes('vancouver') || lang.includes('en-ca')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'CAD') || SUPPORTED_CURRENCIES[5];
    }

    // Check Australia
    if (tz.includes('sydney') || tz.includes('melbourne') || lang.includes('en-au')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'AUD') || SUPPORTED_CURRENCIES[6];
    }

    // Check Singapore
    if (tz.includes('singapore') || lang.includes('en-sg')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'SGD') || SUPPORTED_CURRENCIES[7];
    }

    // Check Japan
    if (tz.includes('tokyo') || lang.includes('ja')) {
      return SUPPORTED_CURRENCIES.find(c => c.code === 'JPY') || SUPPORTED_CURRENCIES[8];
    }

    // Default global currency to USD
    return SUPPORTED_CURRENCIES.find(c => c.code === 'USD') || SUPPORTED_CURRENCIES[1];
  } catch {
    return SUPPORTED_CURRENCIES[0]; // fallback INR
  }
};

/**
 * Save user's selected currency override to localStorage
 */
export const setUserCurrency = (currencyCode) => {
  const match = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  if (match) {
    localStorage.setItem(CURRENCY_STORAGE_KEY, match.code);
    window.dispatchEvent(new CustomEvent('currencyChange', { detail: match }));
    return match;
  }
  return detectUserCurrency();
};

/**
 * Reset currency selection to auto-detect
 */
export const resetUserCurrency = () => {
  localStorage.removeItem(CURRENCY_STORAGE_KEY);
  const detected = detectUserCurrency();
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: detected }));
  return detected;
};

/**
 * Check if the user currently has an explicit manual override saved
 */
export const hasManualCurrencyOverride = () => {
  return !!localStorage.getItem(CURRENCY_STORAGE_KEY);
};

/**
 * Get currency symbol for a given currency code
 */
export const getCurrencySymbol = (currencyCode) => {
  if (!currencyCode) return detectUserCurrency().symbol;
  const match = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return match ? match.symbol : detectUserCurrency().symbol;
};

/**
 * Format an amount with currency symbol
 * e.g. formatCurrency(500) -> "₹500" or "$500"
 */
export const formatCurrency = (amount, currencyCode) => {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  const symbol = currencyCode ? getCurrencySymbol(currencyCode) : detectUserCurrency().symbol;
  return `${symbol}${num.toLocaleString()}`;
};
