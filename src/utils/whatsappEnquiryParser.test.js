import { parseWhatsappEnquiry } from './whatsappEnquiryParser';

describe('parseWhatsappEnquiry', () => {
  test('extracts custom tour details for a selected package and variant', () => {
    const enquiry = parseWhatsappEnquiry(`Hello Gantabyaa team!
I would like to plan a custom tour:
Enquiry type: CUSTOM_TOUR
Name: Subham Modak
Mobile / WhatsApp: 919547444749
Email: modak@example.com
Destination: Vietnam
Package: HO CHI MINH (2N) - DANANG (2N)
Variant: HO CHI MINH (2N) - DANANG (2N)
Departure date: 2026-12-10
Duration: 12 days / 11 nights
Travellers: Adults 2, Children 2, Seniors 2
Rooms: 2
Vehicle type: 6-seater
Vehicles: 0
Hotel category: Deluxe
Room type: Double
Budget: 26,000 - 30,000
Meal plan: MAP
Special requirements: Test notes`);

    expect(enquiry).toMatchObject({
      enquiry_type: 'CUSTOM_TOUR',
      channel: 'WHATSAPP',
      name: 'Subham Modak',
      phone: '919547444749',
      destination: 'Vietnam',
      travel_date: '2026-12-10',
      travel_duration_day: 12,
      travel_duration_night: 11,
      adult_count: 2,
      child_count: 2,
      senior_count: 2,
      room_count: 2,
      hotel_category: 'DELUXE',
      room_type: 'DOUBLE',
      vehicle_type: '6-seater',
      budget_min: 26000,
      budget_max: 30000,
      meal_plan: 'MAP',
      special_requirements: 'Test notes',
    });
  });

  test('extracts destination-only and existing-package enquiries', () => {
    const customTour = parseWhatsappEnquiry(`I would like to plan a custom tour:
Name: Customer
Destination: Bali
Package: Custom itinerary
Departure date: 2026-11-28
Duration: 4 days / 3 nights
Travellers: Adults 2, Children 0, Seniors 0
Rooms: 1
Vehicle type: 4-seater
Vehicles: 0
Budget: 20000 - 30000
Meal plan: ANY
Special requirements: Test notes`);
    const packageEnquiry = parseWhatsappEnquiry(`I would like to customise this tour package:
Package: Vietnam package
Enquiry source: WEBSITE
Departure date: Not selected
Travel duration: 12 days / 11 nights
Travellers: Adults 1, Children 0, Seniors 0
Subject: Enquiry about Vietnam
Travel plans / preferences: Flexible trip
Package banner: https://example.com/package.png`);

    expect(customTour).toMatchObject({
      enquiry_type: 'CUSTOM_TOUR',
      destination: 'Bali',
      packageTitle: '',
    });
    expect(packageEnquiry).toMatchObject({
      enquiry_type: 'CUSTOM_TOUR',
      channel: 'WEBSITE',
      packageTitle: 'Vietnam package',
      travel_date: '',
      message: 'Subject: Enquiry about Vietnam\nTravel plans / preferences: Flexible trip\nPackage image: https://example.com/package.png',
    });
  });

  test('extracts fixed tour details from the enquiry form message', () => {
    const enquiry = parseWhatsappEnquiry(`Hello Gantabyaa team!
I would like to enquire about this fixed tour package:
Enquiry type: FIXED
Package: CAIRO (3N) - AUSWAN - NILE CRUISE (3N) - HURGADA (2N)
Destination: Egypt
Variant: Cairo (3N) - Aswan - Nile Cruise (3N) - Hurghada (2N)
Departure date: 2026-10-17
Full name: Subham Modak
Mobile / WhatsApp: 9547444749
Email: modak@example.com
Travellers: Adults 1, Children 0, Seniors 0
Travel duration: 9 days / 8 nights
Package banner: https://example.com/cairo.jpg
Please share availability, pricing and booking details.`);

    expect(enquiry).toMatchObject({
      enquiry_type: 'FIXED_TOUR',
      channel: 'WHATSAPP',
      packageTitle: 'CAIRO (3N) - AUSWAN - NILE CRUISE (3N) - HURGADA (2N)',
      destination: 'Egypt',
      variant: 'Cairo (3N) - Aswan - Nile Cruise (3N) - Hurghada (2N)',
      travel_date: '2026-10-17',
      name: 'Subham Modak',
      phone: '9547444749',
      email: 'modak@example.com',
      adult_count: 1,
      child_count: 0,
      senior_count: 0,
      travel_duration_day: 9,
      travel_duration_night: 8,
      message: 'Package image: https://example.com/cairo.jpg',
    });
  });

  test('rejects text that does not contain recognizable enquiry fields', () => {
    expect(() => parseWhatsappEnquiry('Hello, do you have a trip available?')).toThrow(
      'No enquiry details were recognized.'
    );
  });
});
