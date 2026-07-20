/* =========================================================================
   validation.js — Simple reusable field validators
   ========================================================================= */

const Validate = (() => {

  function required(val, label) {
    if (val === undefined || val === null || String(val).trim() === '') {
      return `${label} is required.`;
    }
    return null;
  }

  function positiveNumber(val, label) {
    const n = Number(val);
    if (isNaN(n) || n < 0) return `${label} must be a valid positive number.`;
    return null;
  }

  function percent(val, label) {
    const n = Number(val);
    if (isNaN(n) || n < 0 || n > 100) return `${label} must be between 0 and 100.`;
    return null;
  }

  function mobile(val, label) {
    if (!val) return null;
    const digits = String(val).replace(/\D/g, '');
    if (digits.length !== 10) return `${label} must be a 10-digit mobile number.`;
    return null;
  }

  function email(val, label) {
    if (!val) return null;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) return `${label} is not a valid email address.`;
    return null;
  }

  /**
   * Runs a list of [fn, value, label] checks, returns array of error strings.
   */
  function run(checks) {
    const errors = [];
    for (const [fn, val, label] of checks) {
      const err = fn(val, label);
      if (err) errors.push(err);
    }
    return errors;
  }

  return { required, positiveNumber, percent, mobile, email, run };
})();
