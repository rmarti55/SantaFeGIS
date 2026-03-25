const ACRONYMS = new Set([
  "LLC", "INC", "LP", "LTD", "LLP", "PC", "PA", "NA", "NM", "CO",
  "II", "III", "IV", "JR", "SR",
]);

const ENTITY_SUFFIXES_RE =
  /\b(REVOCABLE\s+TRUST|IRREVOCABLE\s+TRUST|LIVING\s+TRUST|FAMILY\s+TRUST|TRUST|LLC|INC|CORP|CORPORATION|LTD|LP|LLP|ESTATE|PROPERTIES|INVESTMENTS|HOLDINGS|GROUP|PARTNERS|PARTNERSHIP|VENTURES?|FOUNDATION|ASSOCIATION|COMPANY)\b.*$/i;

function titleWord(word: string): string {
  const upper = word.toUpperCase();
  if (ACRONYMS.has(upper)) return upper;

  if (/^[A-Z]$/i.test(word)) return word.toUpperCase() + ".";

  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => titleWord(part))
      .join("-");
  }

  if (word.startsWith("O'") || word.startsWith("o'") || word.startsWith("O\u2019")) {
    return "O'" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }

  if (word.startsWith("MC") && word.length > 2) {
    return "Mc" + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }

  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function titleCase(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map(titleWord)
    .join(" ");
}

/**
 * Convert a raw ALL-CAPS county owner name into a human-friendly display form.
 *
 * Handles patterns like:
 *   "SISNEROS, JOSEPH A & EMELDA T REVOCABLE TRUST"
 *    -> "Joseph A. & Emelda T. Sisneros Revocable Trust"
 *   "MARTINEZ, CARLOS E" -> "Carlos E. Martinez"
 *   "SANTA FE HOLDINGS LLC" -> "Santa Fe Holdings LLC"
 *   "SMITH, JOHN D & JANE M" -> "John D. & Jane M. Smith"
 */
export function formatOwnerName(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return "Unknown";

  const trimmed = raw.trim();

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) {
    return titleCase(trimmed);
  }

  const lastNamePart = trimmed.slice(0, commaIdx).trim();
  let rest = trimmed.slice(commaIdx + 1).trim();

  let suffix = "";
  const suffixMatch = rest.match(ENTITY_SUFFIXES_RE);
  if (suffixMatch) {
    suffix = rest.slice(suffixMatch.index!).trim();
    rest = rest.slice(0, suffixMatch.index!).trim();
  }

  const firstNames = rest
    .split(/\s*&\s*/)
    .map((name) => titleCase(name.trim()))
    .filter(Boolean);

  const lastName = titleCase(lastNamePart);
  const suffixFormatted = suffix ? " " + titleCase(suffix) : "";

  if (firstNames.length === 0) {
    return lastName + suffixFormatted;
  }

  return firstNames.join(" & ") + " " + lastName + suffixFormatted;
}
