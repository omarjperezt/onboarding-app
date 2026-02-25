import type { StepConditions, UserProfile } from "./types";
import { stepConditionsSchema } from "./schemas";

export function evaluateConditions(
  raw: unknown,
  profile: UserProfile
): boolean {
  if (raw === null || raw === undefined) return true;

  const parsed = stepConditionsSchema.safeParse(raw);
  if (!parsed.success) return false;

  const conditions: StepConditions = parsed.data;

  if (conditions.country && conditions.country.length > 0) {
    if (!conditions.country.includes(profile.country)) return false;
  }

  if (conditions.cluster && conditions.cluster.length > 0) {
    if (!conditions.cluster.includes(profile.clusterName)) return false;
  }

  if (conditions.position && conditions.position.length > 0) {
    if (!profile.position) return false;
    const lowerPosition = profile.position.toLowerCase();
    const matched = conditions.position.some((p) =>
      lowerPosition.includes(p.toLowerCase())
    );
    if (!matched) return false;
  }

  if (conditions.userStatus && conditions.userStatus.length > 0) {
    if (!conditions.userStatus.includes(profile.status)) return false;
  }

  if (conditions.requiresCorporateEmail !== undefined) {
    if (profile.hasCorporateEmail !== conditions.requiresCorporateEmail)
      return false;
  }

  if (conditions.requiresSsoAuth !== undefined) {
    if (profile.hasSsoAuth !== conditions.requiresSsoAuth) return false;
  }

  if (conditions.hiredAfter) {
    if (profile.createdAt < new Date(conditions.hiredAfter)) return false;
  }

  if (conditions.hiredBefore) {
    if (profile.createdAt > new Date(conditions.hiredBefore)) return false;
  }

  if (conditions.tags && conditions.tags.length > 0) {
    const matched = conditions.tags.some((t) => profile.tags.includes(t));
    if (!matched) return false;
  }

  return true;
}
