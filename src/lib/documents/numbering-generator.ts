/**
 * Sequential Document Numbering Engine
 */

export function generateDocumentNumber(prefix: string = "DOC", sequenceNumber: number = 1): string {
  const currentYear = new Date().getFullYear();
  const paddedSequence = String(sequenceNumber).padStart(5, "0");
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
  return `${cleanPrefix}-${currentYear}-${paddedSequence}`;
}
