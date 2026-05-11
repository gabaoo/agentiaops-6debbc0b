export function formatPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 13) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  return p;
}

export function initials(name?: string | null, phone?: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return phone ? phone.replace(/\D/g, "").slice(-2) : "??";
}

export function statusLabel(s: string) {
  return {
    open: "Aberta",
    in_progress: "Em andamento",
    closed: "Encerrada",
    waiting_human: "Aguarda humano",
  }[s] ?? s;
}