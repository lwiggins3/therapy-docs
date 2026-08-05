/** Extracted out of PatientsController for testability, same pattern as approved-recommendations.ts. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
