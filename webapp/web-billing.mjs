// Gated hosted web checkout URL builder. Pure: no card data or payment state here.
const WORKSPACE_USER = /^rimma_workspace_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * RevenueCat Web Purchase Links identify customers by appending the encoded
 * App User ID as a PATH segment, not a query parameter. Never accept a
 * browser-supplied identity, URL, or payment status.
 */
export function makeIdentifiedCheckoutUrl(template, appUserId) {
  if (typeof appUserId !== 'string' || !WORKSPACE_USER.test(appUserId)) {
    throw new Error('Invalid verified RevenueCat workspace identity');
  }
  if (typeof template !== 'string' || template.length > 400) {
    throw new Error('Web billing purchase link is not configured');
  }
  let url;
  try { url = new URL(template); } catch {
    throw new Error('Invalid web billing purchase link');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'pay.rev.cat' ||
    url.username || url.password || url.port ||
    url.search || url.hash ||
    !/^\/[A-Za-z0-9_-]{8,128}\/?$/.test(url.pathname)
  ) {
    throw new Error('Untrusted web billing purchase link');
  }
  return url.origin + url.pathname.replace(/\/$/, '') + '/' + encodeURIComponent(appUserId);
}

/**
 * Safety conditions are intentionally conjunctive. Both portal configuration
 * AND the backend's independently reviewed web-purchase capability are needed.
 * Current backend does not yet expose webPurchasesEnabled, so this returns
 * unavailable on all existing production deployments.
 */
export function prepareWebCheckout({ enabled, template, billing }) {
  if (enabled !== true || !template) return null;
  if (
    billing?.configured !== true ||
    billing?.webPurchasesEnabled !== true ||
    billing?.owner !== true ||
    billing?.active !== false ||
    billing?.status !== 'expired'
  ) return null;
  return makeIdentifiedCheckoutUrl(template, billing.appUserId);
}
