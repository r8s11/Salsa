export const EVENT_RESPONSIBILITY_VERSION = "2026-11-14" as const;
export type EventResponsibilityAck = {
  admission_payments: boolean;
  signup_counts: boolean;
  guest_notices: boolean;
  version: typeof EVENT_RESPONSIBILITY_VERSION;
};
export function emptyEventResponsibilityAck(): EventResponsibilityAck {
  return { admission_payments: false, signup_counts: false, guest_notices: false, version: EVENT_RESPONSIBILITY_VERSION };
}
export function hasEventResponsibilityAck(value: EventResponsibilityAck): boolean {
  return value.version === EVENT_RESPONSIBILITY_VERSION && value.admission_payments === true && value.signup_counts === true && value.guest_notices === true;
}
export const EVENT_RESPONSIBILITIES = [
  ["admission_payments", "I am responsible for admission decisions and any externally handled payments for this event."],
  ["signup_counts", "I understand that Salsa Segura signup counts do not verify payment or acceptance and do not include unknown external sales."],
  ["guest_notices", "For website-managed RSVPs, I understand that confirming or withdrawing acceptance and changing the date/time sends guest notices. I will keep records and event details current."],
] as const;
