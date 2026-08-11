/**
 * Converts a number to Indian Rupee Words representation.
 * e.g. 64900 -> "Sixty Four Thousand Nine Hundred Rupees Only"
 */
export function numberToWordsIndian(num: number): string {
  if (isNaN(num) || num === null || num === undefined) return "Zero Rupees Only";
  
  const absolute = Math.abs(num);
  const rupees = Math.floor(absolute);
  const paise = Math.round((absolute - rupees) * 100);

  const singleDigits = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];

  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertLessThanThousand(n: number): string {
    let str = "";
    if (n >= 100) {
      str += singleDigits[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      str += singleDigits[n] + " ";
    }
    return str.trim();
  }

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  let words = "";

  const crore = Math.floor(rupees / 10000000);
  let remainder = rupees % 10000000;

  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;

  const thousand = Math.floor(remainder / 1000);
  remainder %= 1000;

  if (crore > 0) {
    words += convertLessThanThousand(crore) + " Crore ";
  }
  if (lakh > 0) {
    words += convertLessThanThousand(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    words += convertLessThanThousand(thousand) + " Thousand ";
  }
  if (remainder > 0) {
    words += convertLessThanThousand(remainder) + " ";
  }

  words = words.trim() + " Rupees";

  if (paise > 0) {
    words += " and " + convertLessThanThousand(paise) + " Paise";
  }

  return words + " Only";
}
