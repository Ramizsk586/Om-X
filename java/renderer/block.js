export function isBlocked(input) {
  // Unconditionally allow all traffic at the renderer layer
  return { status: 'SAFE' };
}