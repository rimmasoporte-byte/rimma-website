const LEGACY_SIGNED_TOKEN =
  '[A-Za-z0-9_-]{20,1400}\\.[A-Za-z0-9_-]{20,160}';
const COMPACT_DRAFT_TOKEN =
  '3\\.[a-f0-9]{32}\\.[a-z0-9]+\\.[A-Za-z0-9_-]{16,100}';

const TOKEN_SOURCE = '(?:' + COMPACT_DRAFT_TOKEN + '|' + LEGACY_SIGNED_TOKEN + ')';
const PAGE_PATTERN = new RegExp('^/capture/(' + TOKEN_SOURCE + ')$');
const API_PATTERN = new RegExp(
  '^/api/photo-capture/(' + TOKEN_SOURCE + ')(/upload)?$'
);

export function isPhotoCapturePage(pathname) {
  return PAGE_PATTERN.test(String(pathname || ''));
}

export function parsePhotoCaptureApiPath(pathname) {
  const match = String(pathname || '').match(API_PATTERN);
  if (!match) return null;
  return {
    token: match[1],
    upload: match[2] === '/upload'
  };
}
