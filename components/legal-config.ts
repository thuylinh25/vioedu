/** Shared facts for the public legal pages. Edit here, not in the pages. */

export const APP_NAME = "VioEdu";

/**
 * Printed publicly on /privacy and /data-deletion, and submitted to Meta as the
 * contact for data-deletion requests. Leaving it empty makes both pages show a
 * warning rather than a fake mailto link.
 */
export const PRIVACY_CONTACT_EMAIL = "lethuylinh26@gmail.com";

/**
 * TODO (owner): optional. Set a turnaround you can actually honour, e.g.
 * "trong vòng 30 ngày". Left empty, the pages use neutral wording and promise
 * no specific deadline.
 */
export const DATA_DELETION_RESPONSE_TIME = "";

/** Bump whenever the wording of either page changes materially. */
export const LAST_UPDATED = "20/09/2026";

export const hasContactEmail = PRIVACY_CONTACT_EMAIL.trim().length > 0;
