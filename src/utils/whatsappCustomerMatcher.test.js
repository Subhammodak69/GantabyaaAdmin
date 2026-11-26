import { findWhatsappCustomerMatch, normalizeCustomerPhone } from './whatsappCustomerMatcher';

describe('WhatsApp existing-customer matching', () => {
  const customers = [
    {id: 'customer-1', name: 'Asha', mobile: '+91 98765-43210', email: 'asha@example.com'},
    {id: 'customer-2', name: 'Ravi', phone: '9123456789', email: 'ravi@example.com'},
  ];

  test('matches email without case sensitivity and phone format differences', () => {
    expect(findWhatsappCustomerMatch(customers, {
      email: 'ASHA@example.com',
      phone: '9876543210',
    })).toEqual({customer: customers[0], ambiguous: false});
    expect(normalizeCustomerPhone('+91 98765-43210')).toBe('919876543210');
  });

  test('matches a phone number with a country prefix difference', () => {
    expect(findWhatsappCustomerMatch(customers, {
      phone: '+91 9123456789',
    })).toEqual({customer: customers[1], ambiguous: false});
  });

  test('does not auto-select when email and phone point to different customers', () => {
    expect(findWhatsappCustomerMatch(customers, {
      email: 'asha@example.com',
      phone: '9123456789',
    })).toEqual({customer: null, ambiguous: true});
  });

  test('returns no match for new contact details', () => {
    expect(findWhatsappCustomerMatch(customers, {
      email: 'new@example.com',
      phone: '9000012345',
    })).toEqual({customer: null, ambiguous: false});
  });
});
