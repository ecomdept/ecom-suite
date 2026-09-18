export const PASSWORD_MIN_LENGTH = 8;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string) {
  const email = value.trim().toLowerCase();

  if (!email) return "Email is required.";
  if (!emailPattern.test(email)) return "Enter a valid email address.";
  if (email.length > 254) return "Email is too long.";

  return null;
}

export function validateFullName(value: string) {
  const fullName = value.trim();

  if (!fullName) return "Full name is required.";
  if (fullName.length < 2) return "Full name must be at least 2 characters.";
  if (fullName.length > 100) return "Full name must be 100 characters or less.";

  return null;
}

export function validatePassword(value: string) {
  if (!value) return "Password is required.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (value.length > 72) return "Password must be 72 characters or less.";

  return null;
}

export function getSafePath(value: FormDataEntryValue | null, fallback = "/dashboard") {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}
