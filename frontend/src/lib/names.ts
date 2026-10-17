// Long names would stretch tree cards and banners, so tree names and node
// names show at most this many characters, then an ellipsis. Show the full
// name in a title/aria-label alongside.
export const NAME_DISPLAY_LIMIT = 15;

export function truncateName(name: string, limit = NAME_DISPLAY_LIMIT): string {
  // Array.from splits by code point, so an emoji or accented letter isn't cut in half.
  const chars = Array.from(name);
  return chars.length > limit ? `${chars.slice(0, limit).join('')}…` : name;
}
