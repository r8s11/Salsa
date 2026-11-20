/** True when the browser sends Do Not Track or Global Privacy Control. */
export function hasPrivacySignal(): boolean {
  const privacy = navigator as Navigator & { globalPrivacyControl?: boolean };
  return privacy.doNotTrack === "1" || privacy.globalPrivacyControl === true;
}
