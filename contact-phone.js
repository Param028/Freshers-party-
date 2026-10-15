(function attachCrewPhoneNormalizer(root, factory) {
  const normalizeCrewPhone = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = normalizeCrewPhone;
  } else {
    root.normalizeCrewPhone = normalizeCrewPhone;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function createCrewPhoneNormalizer() {
  const formats = [
    /^\+?[0-9]+$/,
    /^\+?[0-9]+(?: [0-9]+)+$/,
    /^\+?[0-9]+(?:-[0-9]+)+$/,
    /^\+?[0-9]+(?:\.[0-9]+)+$/,
    /^\+?[0-9]+ ?\([0-9]{1,6}\)(?: [0-9]+)+$/,
    /^\+?[0-9]+ ?\([0-9]{1,6}\)(?:-[0-9]+)+$/,
    /^\+?[0-9]+ ?\([0-9]{1,6}\)(?:\.[0-9]+)+$/
  ];

  return function normalizeCrewPhone(value) {
    const original = String(value ?? '');
    if (original.length > 25) return '';
    const raw = original.replace(/^ +| +$/g, '');
    if (!formats.some((format) => format.test(raw))) return '';

    const compact = raw.replace(/[ .()-]/g, '');
    let internationalDigits = '';
    if (compact.startsWith('+')) internationalDigits = compact.slice(1);
    else if (compact.startsWith('00')) internationalDigits = compact.slice(2);
    else if (/^[6-9]\d{9}$/.test(compact)) internationalDigits = `91${compact}`;
    else if (/^91[6-9]\d{9}$/.test(compact)) internationalDigits = compact;

    return /^[1-9]\d{7,14}$/.test(internationalDigits)
      ? `+${internationalDigits}`
      : '';
  };
});
