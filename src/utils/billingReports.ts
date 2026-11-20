import { apiService } from '../services/api';

// Fire-and-forget: a client PDF export should still succeed (and download)
// even if saving this bookkeeping snapshot fails for some reason.
export async function saveBillingReportSnapshot(params: {
  clientId: string;
  reportNumber?: string;
  periodLabel: string;
  periodStart: string; // yyyy-MM-dd
  periodEnd: string; // yyyy-MM-dd
  taskIds: string[];
  totalAmount: number;
}) {
  try {
    await apiService.saveBillingReport(params);
  } catch (error) {
    console.error('Error saving billing report snapshot:', error);
  }
}
