# VOP User Guide

For internal users who onboard and review vendors: **Proposers** and **Reviewers/Approvers**.

## Getting started

1. **Sign in** with your organisation account (SSO). First-time users land in
   **Pending approval** — your manager approves your access (they get an in-app + email notice;
   the approval link requires them to log in).
2. Once approved, your role decides what you see. You cannot see or act on cases outside your role
   or stage — that's by design.
3. **Sessions** time out after inactivity; sign in again if prompted. Sign out on shared machines.

## For Proposers — raise a vendor case

1. **New case** → pick the **vendor category**. This drives the workflow and risk questions.
2. **Fill vendor details** (you enter these on the vendor's behalf): legal name, PAN, GSTIN, bank
   account/IFSC, contacts, spend estimate, and the category-specific fields. Sensitive fields (PAN,
   bank) are encrypted and masked automatically.
3. The system computes a **risk tier** and flags possible **duplicates** — review any warnings.
4. Work the **due-diligence checklist** for the case.
5. **Upload evidence** (registration, bank proof, etc.). Each file is virus-scanned and type-checked;
   only clean, valid files are accepted. Bad or infected files are rejected with a clear message.
6. **Run verification** on the case — PAN/GST/bank checks, name matching, and cross-checks run and
   may re-tier the risk or mark the case for review. (If a check provider is temporarily down, it
   stays **pending** and doesn't block you.)
7. **Submit** into the workflow. Track progress on the case; you'll be notified of decisions or
   requests for more information.

Tips: enter names/PAN/GST accurately — name mismatches and check-digit failures trigger review and
slow approval. Provide clear evidence up front to avoid "request info" round-trips.

## For Reviewers/Approvers — review a case

1. Open your **queue** (or the **review queue** for flagged cases). Each item shows the stage you own.
2. Review the vendor details, risk tier, **red flags**, verification results, and evidence. Masked
   fields are shown per your permission.
3. The **evidence gate** must be satisfied before you can advance — required documents/checks must
   be present.
4. Choose **Approve**, **Reject**, or **Request info** (send it back with a note). You **cannot**
   approve your own request or one where you're in a conflicting reporting chain (Segregation of
   Duties).
5. Watch the **SLA** on each item; overdue items escalate automatically.

## Statuses you'll see

| Status                   | Meaning                                                  |
| ------------------------ | -------------------------------------------------------- |
| Draft / Pending approval | Not yet submitted / awaiting access or manager approval. |
| In review                | At a workflow stage awaiting a reviewer.                 |
| Info requested           | Sent back to the proposer for more detail.               |
| Verification pending     | A check provider is retrying; not a rejection.           |
| Review required          | A red flag or check result flagged it for manual review. |
| Approved / Rejected      | Final decision (audited).                                |
| Blocked / Reactivated    | Lifecycle action by an admin, with a reason.             |

## Good to know

- Everything you do is **audited** (who, what, when). This protects you and the process.
- Sensitive data is **masked by default** and never shown in URLs or logs.
- If something looks wrong (a case you shouldn't see, a suspicious file), tell an admin — don't work
  around it.

Need something you can't do? It's likely a role/permission boundary — ask a Platform Admin
(see the [Administrator Guide](admin-guide.md)).
