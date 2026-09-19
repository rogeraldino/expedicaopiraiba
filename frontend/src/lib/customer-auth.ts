"use client";

const SESSION_KEY = "customer-session-token";

export function getCustomerToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(SESSION_KEY) ||
    sessionStorage.getItem(SESSION_KEY) ||
    ""
  );
}

export function setCustomerToken(token: string): void {
  if (typeof window === "undefined") return;
  if (!token) {
    clearCustomerToken();
    return;
  }
  try {
    localStorage.setItem(SESSION_KEY, token);
  } catch {}
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {}
}

export function clearCustomerToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
}

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
