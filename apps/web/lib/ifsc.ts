// Bank/branch lookup by IFSC using Razorpay's free public IFSC API.
// Docs: https://razorpay.com/docs/ifsc/  —  GET https://ifsc.razorpay.com/<IFSC>
// No API key required; returns bank + branch details for a valid IFSC.

export interface IfscDetails {
  bank: string;
  branch: string;
  address?: string;
  city?: string;
  state?: string;
}

interface RazorpayIfsc {
  BANK?: string;
  BRANCH?: string;
  ADDRESS?: string;
  CITY?: string;
  STATE?: string;
}

/** Fetch bank/branch for an IFSC. Returns null if not found or the request fails. */
export async function lookupIfsc(ifsc: string): Promise<IfscDetails | null> {
  const code = ifsc.trim().toUpperCase();
  try {
    const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(code)}`);
    if (!res.ok) return null; // 404 = unknown IFSC
    const d = (await res.json()) as RazorpayIfsc;
    if (!d.BANK) return null;
    return {
      bank: d.BANK,
      branch: d.BRANCH ?? '',
      address: d.ADDRESS,
      city: d.CITY,
      state: d.STATE,
    };
  } catch {
    return null; // network/CORS failure — degrade gracefully, let the user type manually
  }
}
