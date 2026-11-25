const unavailableValues = /^(?:not selected|not specified|none|not provided|flexible|custom itinerary)$/i;

const getAvailableValue = (value) => {
  const trimmed = value?.trim() || '';
  return unavailableValues.test(trimmed) ? '' : trimmed;
};

const parseNumber = (value) => {
  if (!value) return null;
  const number = Number(value.replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
};

const parseNumberByPattern = (value, pattern) => {
  const match = value.match(new RegExp(pattern, 'i'));
  return match ? parseNumber(match[1]) : null;
};

const parseCountAfter = (value, labelPattern) =>
  parseNumberByPattern(value, `(?:${labelPattern})\\s*([\\d,]+)`);

export function parseWhatsappEnquiry(message) {
  const fields = new Map();
  message.split(/\r?\n/).forEach((line) => {
    const separator = line.indexOf(':');
    if (separator < 1) return;
    fields.set(line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim());
  });

  const get = (...labels) => {
    for (const label of labels) {
      const value = fields.get(label.toLowerCase());
      if (value) return value;
    }
    return '';
  };
  const packageTitle = getAvailableValue(get('package'));
  const intro = message.toLowerCase();
  const explicitType = get('enquiry type').toUpperCase().replace(/[\s-]+/g, '_');
  let enquiryType = 'FIXED_TOUR';
  if (explicitType !== 'FIXED' && explicitType !== 'FIXED_TOUR') {
    if (
      explicitType === 'CUSTOM_TOUR'
      || explicitType === 'CUSTOM'
      || intro.includes('plan a custom tour')
      || intro.includes('customise this tour package')
    ) {
      enquiryType = 'CUSTOM_TOUR';
    }
  }
  const source = get('enquiry source').toUpperCase().replace(/[\s-]+/g, '_');
  const channelAliases = {
    WEBSITE: 'WEBSITE',
    WHATSAPP: 'WHATSAPP',
    APP: 'APP',
    MOBILE_APP: 'APP',
    PHONE: 'PHONE',
    EMAIL: 'EMAIL',
    OFFLINE: 'OFFLINE',
    ADMIN: 'ADMIN',
  };
  const duration = get('duration', 'travel duration');
  const durationDays = parseNumberByPattern(duration, '(\\d+)\\s*days?') ?? 0;
  const durationNights = parseNumberByPattern(duration, '(\\d+)\\s*nights?') ?? 0;
  const travellers = get('travellers', 'travelers');
  const budgetValues = get('budget').match(/[\d,]+/g) || [];
  const budgetMin = parseNumber(budgetValues[0]) ?? 0;
  const budgetMax = parseNumber(budgetValues[1]) ?? 0;
  const travelPlans = get('travel plans / preferences');
  const subject = get('subject');
  const packageImage = get('package image', 'package banner');
  const messageParts = [
    subject ? `Subject: ${subject}` : '',
    travelPlans ? `Travel plans / preferences: ${travelPlans}` : '',
    packageImage ? `Package image: ${packageImage}` : '',
  ].filter(Boolean);

  const hasRecognizedFields = [
    'name', 'full name', 'mobile / whatsapp', 'email', 'destination', 'package',
    'departure date', 'travel date', 'travellers', 'travelers',
  ].some((key) => fields.has(key));
  if (!hasRecognizedFields) {
    throw new Error('No enquiry details were recognized. Paste the complete WhatsApp enquiry message.');
  }

  return {
    enquiry_type: enquiryType,
    channel: channelAliases[source] || 'WHATSAPP',
    name: get('name', 'full name'),
    phone: get('mobile / whatsapp', 'mobile', 'phone'),
    email: get('email'),
    destination: getAvailableValue(get('destination')),
    packageTitle,
    variant: getAvailableValue(get('variant')),
    travel_date: getAvailableValue(get('departure date', 'travel date')),
    travel_duration_day: durationDays,
    travel_duration_night: durationNights,
    adult_count: parseCountAfter(travellers, 'adults?') ?? 1,
    child_count: parseCountAfter(travellers, 'children|kids?') ?? 0,
    senior_count: parseCountAfter(travellers, 'seniors?') ?? 0,
    room_count: parseNumberByPattern(get('rooms', 'rooms required'), '([\\d,]+)') ?? 1,
    hotel_category: getAvailableValue(get('hotel category')).toUpperCase().replace(/[\s-]+/g, '_'),
    room_type: getAvailableValue(get('room type')).toUpperCase().replace(/[\s-]+/g, '_'),
    vehicle_type: getAvailableValue(get('vehicle type')),
    vehicle_count: parseNumberByPattern(get('vehicles'), '([\\d,]+)') ?? 0,
    budget_min: budgetMin,
    budget_max: budgetMax,
    meal_plan: getAvailableValue(get('meal plan')).toUpperCase() || 'ANY',
    special_requirements: getAvailableValue(get('special requirements')),
    message: messageParts.join('\n'),
  };
}
