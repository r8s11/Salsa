import { EventSubmission } from "./submissions";
import { getEffectiveEventData } from "./submissionForm";

export type QualityTier = 'required' | 'recommended' | 'optional';

export interface QualityGap {
  issue: string;
  tier: QualityTier;
}

export function checkSubmissionQuality(submission: EventSubmission): QualityGap[] {
  const data = getEffectiveEventData(submission);
  const gaps: QualityGap[] = [];

  // Required: title, event_date, city, event_type
  if (!data.title) gaps.push({ issue: 'title', tier: 'required' });
  if (!data.event_date) gaps.push({ issue: 'event_date', tier: 'required' });
  if (!data.city) gaps.push({ issue: 'city', tier: 'required' });
  if (!data.event_type) gaps.push({ issue: 'event_type', tier: 'required' });

  // Recommended: location, event_time, description
  if (!data.location) gaps.push({ issue: 'location', tier: 'recommended' });
  if (!data.event_time) gaps.push({ issue: 'event_time', tier: 'recommended' });
  if (!data.description) gaps.push({ issue: 'description', tier: 'recommended' });
  
  // Optional: image_url, host, price_type, dance_styles
  if (!data.image_url) gaps.push({ issue: 'image_url', tier: 'optional' });
  if (!data.host) gaps.push({ issue: 'host', tier: 'optional' });
  if (!data.price_type) gaps.push({ issue: 'price_type', tier: 'optional' });
  
  const danceStyles = data.dance_styles;
  if (!Array.isArray(danceStyles) || danceStyles.length === 0) {
    gaps.push({ issue: 'dance_styles', tier: 'optional' });
  }

  return gaps;
}
