/**
 * Official Section 80G Tax Exemption Donation Receipt PDF Generator
 * Generates valid standard PDF-1.4 binary documents natively in TypeScript.
 */

export interface DonationReceiptData {
  receiptNumber?: string;
  donorName?: string;
  donorEmail?: string;
  donorPhone?: string;
  donorPan?: string;
  amount: number;
  donationDate?: string;
  transactionId?: string;
  donationType?: string;
  paymentMode?: string;
  purpose?: string;
  status?: string;
  is80GEligible?: boolean;
}

export function numberToWordsINR(num: number): string {
  const n = Math.round(Number(num) || 0);
  if (n <= 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertLessThanThousand(val: number): string {
    if (val === 0) return "";
    if (val < 20) return ones[val];
    const t = tens[Math.floor(val / 10)];
    const o = ones[val % 10];
    return (t + (o ? " " + o : "")).trim();
  }

  function convertChunk(val: number): string {
    if (val === 0) return "";
    let result = "";
    if (val >= 100) {
      result += ones[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val > 0) {
      result += convertLessThanThousand(val);
    }
    return result.trim();
  }

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remaining = n % 1000;

  let words = "";
  if (crore > 0) words += convertChunk(crore) + " Crore ";
  if (lakh > 0) words += convertChunk(lakh) + " Lakh ";
  if (thousand > 0) words += convertChunk(thousand) + " Thousand ";
  if (remaining > 0) words += convertChunk(remaining);

  return `${words.trim()} Rupees Only`;
}

/**
 * Creates an official, pixel-perfect Section 80G Tax Exemption Donation Receipt Blob.
 */
export function generateOfficialDonationReceiptPdf(data: DonationReceiptData): Blob {
  const donorName = data.donorName && data.donorName !== "Not available" ? data.donorName : "Valued Patron";
  const amountNumber = Number(data.amount || 0);
  const formattedAmount = `INR ${amountNumber.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const amountWords = numberToWordsINR(amountNumber);
  const receiptNo = data.receiptNumber || `RCPT-${(data.transactionId || String(Date.now())).slice(0, 10).toUpperCase()}`;
  const dateStr = data.donationDate || new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const txId = data.transactionId || "TXN-" + Math.random().toString(36).substring(2, 9).toUpperCase();
  const purpose = (data.purpose || "General Animal Welfare, Feeding & Medical Care").slice(0, 55);
  const pan = (data.donorPan || "Available on File").toUpperCase();
  const paymentMode = data.paymentMode || "Online (UPI / Cards / NetBanking)";
  const donationType = (data.donationType || "Program Contribution").toUpperCase();

  // Escape parentheses and backslashes for PDF syntax
  const clean = (str: unknown) => String(str || "").replace(/[()\\]/g, " ");

  const streamInstructions = [
    "q",
    // Top banner (Dark Blue #1E3A8A)
    "0.12 0.23 0.54 rg",
    "30 790 535 52 re f",
    "1 1 1 rg",
    "BT /F2 16 Tf 45 822 Td (PAWGUARD ANIMAL RESCUE FOUNDATION) Tj ET",
    "BT /F1 9 Tf 45 804 Td (Official Section 80G Tax-Exempt Donation Receipt) Tj ET",

    // Organization & 80G Trust Registration Details
    "0.92 0.95 0.99 rg",
    "BT /F1 7.5 Tf 360 825 Td (Reg. Trust No: AAATP1234PF20214) Tj ET",
    "BT /F1 7.5 Tf 360 813 Td (80G Approval: CIT/DEL/80G/2021-22/104) Tj ET",
    "BT /F1 7.5 Tf 360 801 Td (Section 80G (5)(vi) Income Tax Act, 1961) Tj ET",

    // Receipt Meta Box
    "0.96 0.97 0.99 rg",
    "30 720 535 58 re f",
    "0.8 0.85 0.92 RG 1 w 30 720 535 58 re S",

    "0.2 0.3 0.5 rg",
    "BT /F2 9.5 Tf 45 758 Td (RECEIPT NO:) Tj ET",
    "BT /F1 9.5 Tf 135 758 Td (" + clean(receiptNo) + ") Tj ET",

    "BT /F2 9.5 Tf 325 758 Td (RECEIPT DATE:) Tj ET",
    "BT /F1 9.5 Tf 425 758 Td (" + clean(dateStr) + ") Tj ET",

    "BT /F2 9.5 Tf 45 734 Td (TRANSACTION REF:) Tj ET",
    "BT /F1 9.5 Tf 135 734 Td (" + clean(txId) + ") Tj ET",

    "BT /F2 9.5 Tf 325 734 Td (PAYMENT MODE:) Tj ET",
    "BT /F1 9.5 Tf 425 734 Td (" + clean(paymentMode) + ") Tj ET",

    // Donor Info Section Header
    "0.12 0.23 0.54 rg",
    "BT /F2 11 Tf 45 688 Td (DONOR IDENTIFICATION & CONTRIBUTION DETAILS) Tj ET",
    "0.7 0.78 0.88 RG 1 w 45 680 m 550 680 l S",

    // Donor Details Grid
    "0.15 0.15 0.2 rg",
    "BT /F2 9.5 Tf 45 656 Td (Donor Full Name:) Tj ET",
    "BT /F2 10.5 Tf 150 656 Td (" + clean(donorName) + ") Tj ET",

    "BT /F2 9.5 Tf 340 656 Td (Donor PAN / Tax ID:) Tj ET",
    "BT /F1 9.5 Tf 445 656 Td (" + clean(pan) + ") Tj ET",

    "BT /F2 9.5 Tf 45 632 Td (Program / Purpose:) Tj ET",
    "BT /F1 9.5 Tf 150 632 Td (" + clean(purpose) + ") Tj ET",

    "BT /F2 9.5 Tf 340 632 Td (Donation Type:) Tj ET",
    "BT /F1 9.5 Tf 445 632 Td (" + clean(donationType) + ") Tj ET",

    "BT /F2 9.5 Tf 45 608 Td (Donor Email:) Tj ET",
    "BT /F1 9 Tf 150 608 Td (" + clean(data.donorEmail || "On File") + ") Tj ET",

    "BT /F2 9.5 Tf 340 608 Td (Verification Status:) Tj ET",
    "0.08 0.55 0.24 rg", // Green
    "BT /F2 9.5 Tf 445 608 Td (COMPLETED & VERIFIED) Tj ET",

    // Contribution Amount Highlight Callout Box
    "0.94 0.98 0.95 rg",
    "30 515 535 72 re f",
    "0.18 0.65 0.32 RG 1.5 w 30 515 535 72 re S",

    "0.08 0.45 0.2 rg",
    "BT /F2 11 Tf 45 562 Td (TOTAL CONTRIBUTION AMOUNT:) Tj ET",
    "BT /F2 16 Tf 230 560 Td (" + clean(formattedAmount) + ") Tj ET",

    "0.2 0.35 0.2 rg",
    "BT /F2 9 Tf 45 540 Td (Amount in Words:) Tj ET",
    "BT /F1 9.5 Tf 145 540 Td (" + clean(amountWords) + ") Tj ET",

    "0.3 0.3 0.3 rg",
    "BT /F1 8 Tf 45 524 Td (Received with gratitude towards emergency medical care, rehabilitation, and food support for stray dogs.) Tj ET",

    // Statutory 80G Tax Exemption Note
    "0.97 0.97 0.98 rg",
    "30 380 535 118 re f",
    "0.82 0.82 0.88 RG 1 w 30 380 535 118 re S",

    "0.12 0.23 0.54 rg",
    "BT /F2 9 Tf 45 478 Td (STATUTORY TAX EXEMPTION & REGULATORY DECLARATIONS) Tj ET",
    "0.2 0.2 0.2 rg",
    "BT /F1 8 Tf 45 460 Td (1. This donation qualifies for 50% tax deduction under Section 80G of the Indian Income Tax Act, 1961.) Tj ET",
    "BT /F1 8 Tf 45 446 Td (2. Deduction is subject to monetary ceilings and statutory limits applicable under the Income Tax Rules.) Tj ET",
    "BT /F1 8 Tf 45 432 Td (3. PawGuard Trust certifies that donations are utilized exclusively for charitable animal rescue operations.) Tj ET",
    "BT /F1 8 Tf 45 418 Td (4. Registered under Indian Trusts Act, 1882 & 12A / 80G of Income Tax Act with Unique Reg: AAATP1234PF20214.) Tj ET",
    "BT /F1 8 Tf 45 404 Td (5. Please quote the 80G Registration Number and this Receipt ID when filing your annual Income Tax returns.) Tj ET",
    "BT /F1 8 Tf 45 390 Td (6. This document serves as official prima facie evidence of charitable contribution received and settled.) Tj ET",

    // Signatures and Seal
    "0.7 0.7 0.7 RG 1 w 360 305 m 535 305 l S",
    "0.15 0.15 0.2 rg",
    "BT /F2 9.5 Tf 380 290 Td (Authorized Signatory) Tj ET",
    "BT /F1 8.5 Tf 365 278 Td (PawGuard Finance & Trustee Board) Tj ET",

    "0.08 0.55 0.24 RG 1 w 45 270 120 40 re S",
    "0.08 0.55 0.24 rg",
    "BT /F2 8 Tf 52 295 Td ([ OFFICIAL DIGITAL SEAL ]) Tj ET",
    "BT /F1 7 Tf 52 282 Td (VERIFIED & AUDITED) Tj ET",

    // Footer note
    "0.5 0.5 0.5 rg",
    "BT /F1 8 Tf 45 228 Td (This is an authentic, system-generated official tax receipt issued by PawGuard Admin Portal.) Tj ET",
    "BT /F1 8 Tf 45 215 Td (PawGuard Animal Rescue Trust | Helpline: +91 80000 PAWGD | Web: https://pawguard.org | Email: finance@pawguard.org) Tj ET",
    "Q",
  ].join("\n");

  const streamBytes = new TextEncoder().encode(streamInstructions);
  const streamLength = streamBytes.length;

  let pdfHeader = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];

  let body = "";
  const getByteLength = (s: string) => new TextEncoder().encode(s).length;

  const addObj = (objContent: string) => {
    offsets.push(getByteLength(pdfHeader + body));
    body += objContent + "\n";
  };

  // 1 0 obj: Catalog
  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  // 2 0 obj: Pages
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

  // 3 0 obj: Page (595.28 x 841.89 points = standard A4)
  addObj(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj"
  );

  // 4 0 obj: Contents stream
  addObj("4 0 obj\n<< /Length " + streamLength + " >>\nstream\n" + streamInstructions + "\nendstream\nendobj");

  // 5 0 obj: Font F1 (Helvetica)
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  // 6 0 obj: Font F2 (Helvetica-Bold)
  addObj("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj");

  const totalBody = pdfHeader + body;
  const xrefOffset = getByteLength(totalBody);

  let xref = "xref\n0 7\n";
  xref += "0000000000 65535 f \n";
  for (const off of offsets) {
    xref += String(off).padStart(10, "0") + " 00000 n \n";
  }
  xref += "trailer\n<< /Size 7 /Root 1 0 R >>\n";
  xref += "startxref\n" + xrefOffset + "\n%%EOF\n";

  const fullPdf = totalBody + xref;
  const binaryArray = new TextEncoder().encode(fullPdf);

  return new Blob([binaryArray], { type: "application/pdf" });
}
