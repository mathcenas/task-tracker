import { Client } from '../types';

// A client's hourlyRate is just their *current* rate - if it's ever changed,
// past months should still bill at whatever rate was in effect at the time
// (tracked per-year in client.yearlyRates), not today's rate. Any report
// that shows revenue for a specific month/year must go through this instead
// of reading client.hourlyRate directly.
export function getHourlyRateForYear(client: Client, year: number): number {
  if (client.yearlyRates && client.yearlyRates.length > 0) {
    const yearRate = client.yearlyRates.find((r) => r.year === year);
    if (yearRate) {
      return yearRate.hourlyRate;
    }
  }
  return client.hourlyRate;
}
