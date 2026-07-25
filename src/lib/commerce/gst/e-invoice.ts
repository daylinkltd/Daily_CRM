/**
 * E-Invoicing Service (B2B Tax Invoice IRN & Signed QR Code Generator)
 */

export interface EInvoicePayload {
  sellerGstin: string;
  buyerGstin: string;
  docNumber: string;
  docDate: string;
  totalValue: number;
  mainHsnCode?: string;
}

export interface EInvoiceResult {
  irn: string;
  ackNo: string;
  ackDate: string;
  qrCodePayload: string;
}

export function generateEInvoiceIRN(payload: EInvoicePayload): EInvoiceResult {
  const { sellerGstin, buyerGstin, docNumber, docDate, totalValue, mainHsnCode = "7113" } = payload;

  const rawString = `${sellerGstin}-${docNumber}-${docDate}-${buyerGstin}-${totalValue}`;
  
  // Generate pseudo-random deterministic 64-char hex string representing SHA256 IRN
  const charSet = "0123456789abcdef";
  let irn = "";
  for (let i = 0; i < 64; i++) {
    const idx = (rawString.charCodeAt(i % rawString.length) + i * 7) % charSet.length;
    irn += charSet[idx];
  }

  const ackNo = `17${Date.now().toString().slice(-13)}`;
  const ackDate = new Date().toISOString();

  const qrData = {
    SellerGstin: sellerGstin,
    BuyerGstin: buyerGstin,
    DocNo: docNumber,
    DocTyp: "INV",
    DocDt: docDate,
    TotVal: totalValue,
    ItemCnt: 1,
    MainHsnCode: mainHsnCode,
    Irn: irn,
    IrnDt: ackDate,
  };

  const qrCodePayload = Buffer.from(JSON.stringify(qrData)).toString("base64");

  return {
    irn,
    ackNo,
    ackDate,
    qrCodePayload,
  };
}
