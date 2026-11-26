const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

export const normalizeCustomerPhone = (value) => String(value || '').replace(/\D/g, '');

const uniqueCustomers = (customers) => {
  const seen = new Set();
  return customers.filter((customer) => {
    if (!customer) return false;
    const key = customer.id == null ? customer : String(customer.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const phoneMatches = (left, right) => {
  if (!left || !right) return false;
  if (left === right) return true;
  return left.length >= 10 && right.length >= 10 && left.slice(-10) === right.slice(-10);
};

export function findWhatsappCustomerMatch(customers, { email, phone }) {
  const targetEmail = normalizeEmail(email);
  const targetPhone = normalizeCustomerPhone(phone);
  const candidates = uniqueCustomers(customers);
  const emailMatches = targetEmail
    ? candidates.filter((customer) => normalizeEmail(customer.email || customer.email_address) === targetEmail)
    : [];
  const exactPhoneMatches = targetPhone
    ? candidates.filter((customer) => {
        const values = [customer.mobile, customer.phone, customer.mobile_number, customer.phone_number];
        return values.some((value) => normalizeCustomerPhone(value) === targetPhone);
      })
    : [];
  const phoneCandidates = exactPhoneMatches.length || !targetPhone
    ? exactPhoneMatches
    : candidates.filter((customer) => {
        const values = [customer.mobile, customer.phone, customer.mobile_number, customer.phone_number];
        return values.some((value) => phoneMatches(targetPhone, normalizeCustomerPhone(value)));
      });

  if (emailMatches.length && phoneCandidates.length) {
    const phoneIds = new Set(phoneCandidates.map((customer) => String(customer.id)));
    const matchingCustomers = emailMatches.filter((customer) => phoneIds.has(String(customer.id)));
    if (matchingCustomers.length === 1) return { customer: matchingCustomers[0], ambiguous: false };
    return { customer: null, ambiguous: true };
  }

  if (emailMatches.length === 1) return { customer: emailMatches[0], ambiguous: false };
  if (phoneCandidates.length === 1) return { customer: phoneCandidates[0], ambiguous: false };
  if (emailMatches.length > 1 || phoneCandidates.length > 1) {
    return { customer: null, ambiguous: true };
  }

  return { customer: null, ambiguous: false };
}
