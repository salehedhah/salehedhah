'use strict';
/**
 * الفوترة الإلكترونية - هيئة الزكاة والضريبة والجمارك (فاتورة)
 *
 * - المرحلة الأولى: رمز QR بصيغة TLV (اسم البائع، الرقم الضريبي، الوقت، الإجمالي، الضريبة).
 * - المرحلة الثانية: توليد فاتورة XML بصيغة UBL 2.1، وحساب بصمة الفاتورة (SHA-256)،
 *   وتسلسل البصمات (PIH) وعداد الفواتير (ICV)، وإرسالها لواجهات الإبلاغ/الاعتماد.
 *
 * التوقيع الرقمي (XAdES) وشهادة CSID تتطلب تسجيل المنشأة في بوابة فاتورة
 * والحصول على رمز OTP؛ عند توفرها تضاف في الإعدادات.
 */
const crypto = require('crypto');

const ZATCA_ENDPOINTS = {
  sandbox: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
  simulation: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
  production: 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
};

function tlv(tag, value) {
  const v = Buffer.from(String(value), 'utf8');
  if (v.length > 255) throw new Error(`TLV value too long for tag ${tag}`);
  return Buffer.concat([Buffer.from([tag, v.length]), v]);
}

/** رمز QR للمرحلة الأولى (الحقول 1-5). */
function buildQrTlv({ sellerName, vatNumber, timestamp, total, vatTotal }) {
  return Buffer.concat([
    tlv(1, sellerName),
    tlv(2, vatNumber),
    tlv(3, timestamp),
    tlv(4, Number(total).toFixed(2)),
    tlv(5, Number(vatTotal).toFixed(2)),
  ]).toString('base64');
}

function decodeQrTlv(b64) {
  const buf = Buffer.from(b64, 'base64');
  const out = {};
  let i = 0;
  while (i < buf.length) {
    const tag = buf[i];
    const len = buf[i + 1];
    out[tag] = buf.subarray(i + 2, i + 2 + len).toString('utf8');
    i += 2 + len;
  }
  return out;
}

/** الرقم الضريبي السعودي: 15 رقماً يبدأ وينتهي بالرقم 3 */
function isValidVatNumber(v) {
  return /^3\d{13}3$/.test(String(v || ''));
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const m = (n) => Number(n || 0).toFixed(2);

/**
 * يولّد فاتورة UBL 2.1 حسب مواصفات فاتورة.
 * InvoiceTypeCode: 388 فاتورة، 381 إشعار دائن، 383 إشعار مدين.
 * name: 0100000 فاتورة ضريبية (B2B)، 0200000 فاتورة مبسطة (B2C).
 */
function buildInvoiceXml({ invoice, lines, settings, originalNumber }) {
  const typeCode = invoice.type === 'sale_return' ? '381' : '388';
  const subtypeName = invoice.subtype === 'standard' ? '0100000' : '0200000';
  const [date, timeRaw] = String(invoice.created_at || new Date().toISOString()).replace('T', ' ').split(' ');
  const issueDate = invoice.date || date;
  const issueTime = (timeRaw || '00:00:00').slice(0, 8);

  const taxGroups = {};
  for (const l of lines) {
    const key = l.vat_rate > 0 ? 'S' : 'Z';
    taxGroups[key] = taxGroups[key] || { taxable: 0, tax: 0, rate: l.vat_rate };
    taxGroups[key].taxable += l.line_subtotal - (l.discount_share || 0);
    taxGroups[key].tax += l.vat_amount;
  }

  const billingRef = typeCode === '381'
    ? `<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${esc(originalNumber || '')}</cbc:ID></cac:InvoiceDocumentReference></cac:BillingReference>`
    : '';
  const returnReason = typeCode === '381'
    ? `<cac:PaymentMeans><cbc:PaymentMeansCode>${paymentCode(invoice.payment_method)}</cbc:PaymentMeansCode><cbc:InstructionNote>${esc(invoice.notes || 'مرتجع')}</cbc:InstructionNote></cac:PaymentMeans>`
    : `<cac:PaymentMeans><cbc:PaymentMeansCode>${paymentCode(invoice.payment_method)}</cbc:PaymentMeansCode></cac:PaymentMeans>`;

  const buyer = invoice.subtype === 'standard' || invoice.party_name
    ? `<cac:AccountingCustomerParty><cac:Party><cac:PostalAddress><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${invoice.party_vat ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(invoice.party_vat)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ''}<cac:PartyLegalEntity><cbc:RegistrationName>${esc(invoice.party_name || '')}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>`
    : '<cac:AccountingCustomerParty><cac:Party></cac:Party></cac:AccountingCustomerParty>';

  const taxSubtotals = Object.entries(taxGroups).map(([cat, g]) =>
    `<cac:TaxSubtotal><cbc:TaxableAmount currencyID="SAR">${m(g.taxable)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="SAR">${m(g.tax)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>${cat}</cbc:ID><cbc:Percent>${m(g.rate)}</cbc:Percent>${cat === 'Z' ? '<cbc:TaxExemptionReasonCode>VATEX-SA-34-4</cbc:TaxExemptionReasonCode><cbc:TaxExemptionReason>Supply of investment metals</cbc:TaxExemptionReason>' : ''}<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal>`
  ).join('');

  const invLines = lines.map((l, i) => {
    const net = l.line_subtotal - (l.discount_share || 0);
    const cat = l.vat_rate > 0 ? 'S' : 'Z';
    return `<cac:InvoiceLine><cbc:ID>${i + 1}</cbc:ID><cbc:InvoicedQuantity unitCode="GRM">${Number(l.weight).toFixed(3)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="SAR">${m(net)}</cbc:LineExtensionAmount><cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${m(l.vat_amount)}</cbc:TaxAmount><cbc:RoundingAmount currencyID="SAR">${m(net + l.vat_amount)}</cbc:RoundingAmount></cac:TaxTotal><cac:Item><cbc:Name>${esc(`${l.description} - عيار ${l.karat}`)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${cat}</cbc:ID><cbc:Percent>${m(l.vat_rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="SAR">${(net / (l.weight || 1)).toFixed(2)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`;
  }).join('');

  const taxable = invoice.taxable_amount;
  return `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">`
    + `<cbc:ProfileID>reporting:1.0</cbc:ProfileID>`
    + `<cbc:ID>${esc(invoice.number)}</cbc:ID>`
    + `<cbc:UUID>${esc(invoice.uuid)}</cbc:UUID>`
    + `<cbc:IssueDate>${esc(issueDate)}</cbc:IssueDate>`
    + `<cbc:IssueTime>${esc(issueTime)}</cbc:IssueTime>`
    + `<cbc:InvoiceTypeCode name="${subtypeName}">${typeCode}</cbc:InvoiceTypeCode>`
    + `<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>`
    + `<cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>`
    + billingRef
    + `<cac:AdditionalDocumentReference><cbc:ID>ICV</cbc:ID><cbc:UUID>${invoice.icv}</cbc:UUID></cac:AdditionalDocumentReference>`
    + `<cac:AdditionalDocumentReference><cbc:ID>PIH</cbc:ID><cac:Attachment><cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(invoice.previous_hash)}</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>`
    + `<cac:AccountingSupplierParty><cac:Party><cac:PartyIdentification><cbc:ID schemeID="CRN">${esc(settings.cr_number)}</cbc:ID></cac:PartyIdentification><cac:PostalAddress><cbc:StreetName>${esc(settings.address_street)}</cbc:StreetName><cbc:BuildingNumber>${esc(settings.address_building)}</cbc:BuildingNumber><cbc:CitySubdivisionName>${esc(settings.address_district)}</cbc:CitySubdivisionName><cbc:CityName>${esc(settings.address_city)}</cbc:CityName><cbc:PostalZone>${esc(settings.address_postal)}</cbc:PostalZone><cac:Country><cbc:IdentificationCode>SA</cbc:IdentificationCode></cac:Country></cac:PostalAddress><cac:PartyTaxScheme><cbc:CompanyID>${esc(settings.vat_number)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme><cac:PartyLegalEntity><cbc:RegistrationName>${esc(settings.company_name)}</cbc:RegistrationName></cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>`
    + buyer
    + `<cac:Delivery><cbc:ActualDeliveryDate>${esc(issueDate)}</cbc:ActualDeliveryDate></cac:Delivery>`
    + returnReason
    + (invoice.discount > 0 ? `<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason><cbc:Amount currencyID="SAR">${m(invoice.discount)}</cbc:Amount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${m(settings.vat_rate)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:AllowanceCharge>` : '')
    + `<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${m(invoice.vat_amount)}</cbc:TaxAmount></cac:TaxTotal>`
    + `<cac:TaxTotal><cbc:TaxAmount currencyID="SAR">${m(invoice.vat_amount)}</cbc:TaxAmount>${taxSubtotals}</cac:TaxTotal>`
    + `<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="SAR">${m(invoice.subtotal)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="SAR">${m(taxable)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="SAR">${m(invoice.total)}</cbc:TaxInclusiveAmount><cbc:AllowanceTotalAmount currencyID="SAR">${m(invoice.discount)}</cbc:AllowanceTotalAmount><cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount><cbc:PayableAmount currencyID="SAR">${m(invoice.total)}</cbc:PayableAmount></cac:LegalMonetaryTotal>`
    + invLines
    + `</Invoice>`;
}

function paymentCode(method) {
  return { cash: '10', bank: '42', card: '48', credit: '30' }[method] || '10';
}

/** بصمة الفاتورة: SHA-256 بترميز Base64 */
function hashXml(xml) {
  return crypto.createHash('sha256').update(xml, 'utf8').digest('base64');
}

/**
 * إرسال الفاتورة إلى واجهة فاتورة.
 * الفواتير المبسطة (B2C) => الإبلاغ خلال 24 ساعة. الفواتير الضريبية (B2B) => الاعتماد قبل التسليم.
 */
async function submitInvoice({ settings, invoice, xml }) {
  if (!settings.zatca_csid || !settings.zatca_secret) {
    return { ok: false, status: 'not_configured', message: 'لم يتم ربط المنشأة ببوابة فاتورة بعد (CSID غير متوفر). أكمل التسجيل من الإعدادات.' };
  }
  const base = ZATCA_ENDPOINTS[settings.zatca_env] || ZATCA_ENDPOINTS.sandbox;
  const clearance = invoice.subtype === 'standard';
  const url = `${base}/invoices/${clearance ? 'clearance' : 'reporting'}/single`;
  const auth = Buffer.from(`${settings.zatca_csid}:${settings.zatca_secret}`).toString('base64');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'ar',
        'Accept-Version': 'V2',
        'Clearance-Status': clearance ? '1' : '0',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        invoiceHash: invoice.invoice_hash,
        uuid: invoice.uuid,
        invoice: Buffer.from(xml, 'utf8').toString('base64'),
      }),
    });
    const body = await res.text();
    let data;
    try { data = JSON.parse(body); } catch { data = { raw: body }; }
    const ok = res.status === 200 || res.status === 202;
    return { ok, status: ok ? (clearance ? 'cleared' : 'reported') : 'rejected', httpStatus: res.status, data };
  } catch (e) {
    return { ok: false, status: 'error', message: e.message };
  }
}

module.exports = {
  ZATCA_ENDPOINTS,
  buildQrTlv,
  decodeQrTlv,
  isValidVatNumber,
  buildInvoiceXml,
  hashXml,
  submitInvoice,
};
