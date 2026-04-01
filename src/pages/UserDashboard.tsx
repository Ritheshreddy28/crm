/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-useless-escape */
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, Upload, CreditCard, Check, Loader2, User, Calendar, DollarSign, Building, FileText, Image as ImageIcon, Sparkles, Hash, TrendingUp, FileSpreadsheet, GraduationCap, Plus, X, Mail, BookOpen, Lock, Search, Wallet } from 'lucide-react';
import Tesseract from 'tesseract.js';
import * as XLSX from 'xlsx';
import { getCurrencySymbol } from '../lib/currency';
import { extractPaymentDetailsFromVision, validateVisionResult, type VisionPaymentData } from '../lib/visionExtract';

const PAYMENT_METHODS = ['Bank Transfer', 'Credit Card', 'Debit Card', 'PayPal', 'Zelle', 'Cryptocurrency', 'Cash', 'UPI', 'Other'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR', 'Other'];
const PAYMENT_TYPES = ['Received', 'Paid'];
const FUTURE_PAYMENT_CATEGORIES = ['Salary', 'Investment Return', 'Loan Payment', 'Vendor Payment', 'Rent', 'Invoice', 'Other'];

/** Compute SHA-256 hash of a file for duplicate screenshot detection. Returns hex string. */
async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Check if this screenshot hash already exists. Returns true if duplicate. */
async function screenshotExistsInDb(hash: string): Promise<boolean> {
  if (!hash || hash.length < 10) return false;
  const { data, error } = await supabase.rpc('screenshot_hash_exists', { p_hash: hash });
  if (!error && data === true) return true;
  const [pr, sp, sh] = await Promise.all([
    supabase.from('payment_records').select('id').eq('screenshot_hash', hash).limit(1).maybeSingle(),
    supabase.from('student_payments').select('id').eq('screenshot_hash', hash).limit(1).maybeSingle(),
    supabase.from('screenshot_hashes').select('hash').eq('hash', hash).limit(1).maybeSingle(),
  ]);
  return !!(pr.data?.id || sp.data?.id || sh.data?.hash);
}

type TabType = 'payment' | 'students' | 'addPayments';

export function UserDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('payment');
  const [loading, setLoading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    recipientName: '',
    senderName: '',
    paymentMethod: '',
    customPaymentMethod: '',
    paymentCurrency: '',
    paymentAmount: '',
    paymentDate: '',
    receiverBankHolder: '',
    requirements: '',
    utrNumber: '',
    paymentType: 'Received',
  });

  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const [futurePaymentLoading, setFuturePaymentLoading] = useState(false);
  const [futurePaymentSuccess, setFuturePaymentSuccess] = useState(false);
  const [futurePaymentError, setFuturePaymentError] = useState('');
  const [futurePaymentData, setFuturePaymentData] = useState({
    senderName: '',
    email: '',
    amount: '',
    category: '',
    customCategory: '',
    currency: 'USD',
    paymentDate: '',
    notes: '',
  });

  const [studentExcelFile, setStudentExcelFile] = useState<File | null>(null);
  const [studentUploadLoading, setStudentUploadLoading] = useState(false);
  const [studentUploadSuccess, setStudentUploadSuccess] = useState(false);
  const [studentUploadError, setStudentUploadError] = useState('');
  const [uploadedRecordsCount, setUploadedRecordsCount] = useState(0);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentData, setNewStudentData] = useState({
    student_name: '',
    email: '',
    password: '',
    phone_number: '',
    university: '',
    subjects: '',
  });
  const [addStudentLoading, setAddStudentLoading] = useState(false);

  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentPaymentData, setStudentPaymentData] = useState({
    payment_mode: '',
    currency: 'USD',
    amount: '',
    payment_status: 'unpaid',
    balance_amount: '',
    credited_to: '',
    payment_date: '',
    subjects: '',
  });
  const [paymentSubjectInput, setPaymentSubjectInput] = useState('');
  const [paymentSubjectSuggestionsOpen, setPaymentSubjectSuggestionsOpen] = useState(false);
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string>('');
  const [paymentSubmitLoading, setPaymentSubmitLoading] = useState(false);
  const [paymentSubmitSuccess, setPaymentSubmitSuccess] = useState(false);
  const [paymentSubmitError, setPaymentSubmitError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }
      setScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const extractPaymentDetails = (text: string) => {
    const fullText = text.toLowerCase();

    const extracted: any = {};

    const amountPatterns = [
      /(?:amount|paid|total|payment)[:\-\s]*(?:rs\.?|₹|inr)?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /(?:rs\.?|₹|inr)\s*[:\-]?\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rs\.?|₹|inr)/i,
      /(?:usd|gbp|eur|\$|£|€)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
      /(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:usd|gbp|eur)/i,
      /\b(\d{1,6}(?:,\d{3})*(?:\.\d{2})?)\b/,
    ];

    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        const amount = match[1].replace(/,/g, '');
        const numAmount = parseFloat(amount);
        if (numAmount > 0 && numAmount < 10000000) {
          extracted.payment_amount = amount;
          break;
        }
      }
    }

    const currencyPatterns = [
      { pattern: /(?:inr|₹|rs\.?)/i, value: 'INR' },
      { pattern: /(?:usd|\$)/i, value: 'USD' },
      { pattern: /(?:eur|€)/i, value: 'EUR' },
      { pattern: /(?:gbp|£)/i, value: 'GBP' },
    ];

    for (const { pattern, value } of currencyPatterns) {
      if (pattern.test(text)) {
        extracted.payment_currency = value;
        break;
      }
    }

    const datePatterns = [
      // Label + numeric:  date: 15/01/2025, 15-01-2025, 2025-01-15, 15.01.2025
      /(?:date|on|dated|transaction\s+date|payment\s+date|date\s+of\s+payment|date\s+of\s+transaction)[:\-\s]*(\d{1,2}[-\/\.\s]+\d{1,2}[-\/\.\s]+\d{2,4})/i,
      /(?:date|on|dated|transaction\s+date|payment\s+date)[:\-\s]*(\d{4}[-\/\.\s]+\d{1,2}[-\/\.\s]+\d{1,2})/i,
      // Label + text month:  date: 15 Jan 2025, 15 January 2025, 15-Jan-2025
      /(?:date|on|dated|transaction\s+date|payment\s+date)[:\-\s]*(\d{1,2}\s+[-]?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*[-]?\s*\d{2,4})/i,
      /(?:date|on|dated|transaction\s+date|payment\s+date)[:\-\s]*(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{2,4})/i,
      // Month first:  Jan 15, 2025  or  Jan 15 2025  or  15 Jan, 2025
      /(?:date|on|dated|transaction\s+date|payment\s+date)[:\-\s]*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i,
      /(?:date|on|dated|transaction\s+date|payment\s+date)[:\-\s]*((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{2,4})/i,
      // Standalone numeric (with optional spaces around separators for OCR)
      /\b(\d{1,2}\s*[-\/\.]\s*\d{1,2}\s*[-\/\.]\s*\d{4})\b/,
      /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{4})\b/,
      /\b(\d{4}\s*[-\/\.]\s*\d{1,2}\s*[-\/\.]\s*\d{1,2})\b/,
      /\b(\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2})\b/,
      /\b(\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2})\b/,
      // Standalone text month (day month year)
      /\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b/i,
      /\b(\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4})\b/i,
      // Month first standalone: Jan 15, 2025  or  Jan 15 2025
      /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4})\b/i,
      /\b((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4})\b/i,
      // With hyphens: 15-Jan-2025, 2025-Jan-15
      /\b(\d{1,2}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-?\d{2,4})\b/i,
      /\b(\d{4}-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{1,2})\b/i,
      /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{1,2}-\d{4})\b/i,
    ];

    const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
    const isValidDateString = (s: string) => typeof s === 'string' && s.length === 10 && YYYY_MM_DD.test(s);

    const parseExtractedDate = (dateStr: string): string | null => {
      if (!dateStr || typeof dateStr !== 'string') return null;
      let raw = dateStr.trim().replace(/\s+/g, ' ');
      raw = raw.replace(/\s*([-\/\.])\s*/g, '$1');
      const now = new Date();
      const maxYear = now.getFullYear() + 1;
      const minYear = 2000;

      const tryParse = (d: Date): string | null => {
        if (!d || isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        if (y < minYear || y > maxYear) return null;
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return isValidDateString(iso) ? iso : null;
      };

      // 1) Try native Date parse (handles "Jan 15, 2025", "15 Jan 2025", "2025-01-15", etc.)
      let date = new Date(raw);
      let out = tryParse(date);
      if (out) return out;

      // 2) Numeric: DD-MM-YYYY, MM/DD/YYYY, etc. Prefer valid day (1–31) / month (1–12) to avoid swaps
      const numMatch = raw.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})$/);
      if (numMatch) {
        const [, aStr, bStr, yStr] = numMatch;
        const a = parseInt(aStr, 10);
        const b = parseInt(bStr, 10);
        let y = parseInt(yStr, 10);
        if (yStr.length === 2) y = Math.floor(now.getFullYear() / 100) * 100 + y;
        const tryOrder = (day: number, month: number) => {
          if (month < 1 || month > 12 || day < 1 || day > 31) return null;
          const d = new Date(y, month - 1, day);
          if (d.getMonth() !== month - 1 || d.getDate() !== day) return null;
          return tryParse(d);
        };
        out = tryOrder(a, b);
        if (out) return out;
        out = tryOrder(b, a);
        if (out) return out;
      }

      // 3) yyyy-mm-dd or yyyy/mm/dd
      const isoMatch = raw.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})$/);
      if (isoMatch) {
        const [, y, m, d] = isoMatch;
        const month = parseInt(m, 10);
        const day = parseInt(d, 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          out = tryParse(new Date(parseInt(y, 10), month - 1, day));
          if (out) return out;
        }
      }

      // 4) Hyphenated month name: 15-Jan-2025, 2025-Jan-15, Jan-15-2025 → "Jan 15, year"
      const h1 = raw.match(/^(\d{1,2})-?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-?(\d{2,4})$/i);
      const h2 = raw.match(/^(\d{4})-?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-?(\d{1,2})$/i);
      const h3 = raw.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-?(\d{1,2})-?(\d{4})$/i);
      const hyphenMonth = h1 || h2 || h3;
      if (hyphenMonth) {
        let year: number, month: string, day: number;
        if (h1) {
          day = parseInt(h1[1], 10);
          month = h1[2];
          year = parseInt(h1[3], 10);
          if (h1[3].length === 2) year = Math.floor(now.getFullYear() / 100) * 100 + year;
        } else if (h2) {
          year = parseInt(h2[1], 10);
          month = h2[2];
          day = parseInt(h2[3], 10);
        } else {
          month = h3![1];
          day = parseInt(h3![2], 10);
          year = parseInt(h3![3], 10);
        }
        if (day >= 1 && day <= 31) {
          out = tryParse(new Date(`${month} ${day}, ${year}`));
          if (out) return out;
        }
      }

      return null;
    };

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (!match || match[1] == null) continue;
      const dateStr = String(match[1]).trim().replace(/\s*[-]\s*/g, '-');
      if (!dateStr) continue;
      const parsed = parseExtractedDate(dateStr);
      if (parsed && isValidDateString(parsed)) {
        extracted.payment_date = parsed;
        break;
      }
    }

    const utrPatterns = [
      /(?:utr|utr\s*no|utr\s*number)[:\-\s]*([a-z0-9]{10,})/i,
    ];

    for (const pattern of utrPatterns) {
      const match = text.match(pattern);
      if (match) {
        extracted.utr_number = match[1];
        break;
      }
    }

    if (!extracted.utr_number) {
      const transactionPatterns = [
        /(?:transaction\s*(?:id|ref|no)|txn\s*(?:id|no)|ref(?:erence)?)[:\-\s]*([a-z0-9]{10,})/i,
        /\b([0-9]{12,16})\b/,
      ];

      for (const pattern of transactionPatterns) {
        const match = text.match(pattern);
        if (match) {
          extracted.utr_number = match[1];
          break;
        }
      }
    }

    const methodKeywords = [
      { keywords: ['upi', 'bhim', 'paytm', 'phonepe', 'gpay', 'google pay'], value: 'UPI' },
      { keywords: ['credit card', 'visa', 'mastercard'], value: 'Credit Card' },
      { keywords: ['debit card'], value: 'Debit Card' },
      { keywords: ['bank transfer', 'neft', 'rtgs', 'imps'], value: 'Bank Transfer' },
      { keywords: ['paypal'], value: 'PayPal' },
      { keywords: ['zelle'], value: 'Zelle' },
    ];

    for (const { keywords, value } of methodKeywords) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        extracted.payment_method = value;
        break;
      }
    }

    const senderPatterns = [
      /(?:from|sender|payer|paid\s+by|remitter|sender\s+name|name\s+of\s+sender)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:debited\s+from|sent\s+by|from\s+account|from\s+name)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:bank\s+name|banking\s+name|sender\s+bank|payer\s+bank|remitter\s+bank|account\s+name\s*\(?sender\)?)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:bank\s+name|banking\s+name|name\s+of\s+bank)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:credited\s+from|transfer\s+from|received\s+from)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
    ];

    for (const pattern of senderPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 2) {
        let name = match[1].trim().replace(/\s+/g, ' ');
        name = name.replace(/\s*(account|bank|name|sender|payer|remitter|holder)\s*$/i, '').trim();
        if (name.length < 2) continue;
        const words = name.split(' ');
        if (words.length >= 1 && words.length <= 10 && name.length <= 60) {
          extracted.sender_name = name;
          break;
        }
      }
    }

    const receiverPatterns = [
      /(?:to|receiver|beneficiary|recipient|paid\s+to|credited\s+to|account\s+name|beneficiary\s+name|receiver\s+name)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:account\s+holder|holder\s+name|name\s+of\s+beneficiary|credited\s+to\s+account)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:beneficiary|receiver|recipient)[:\-\s]*name[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:credited\s+to|transfer\s+to|pay(?:ment)?\s+to)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
      /(?:receiver\s+bank|beneficiary\s+bank|account\s+holder\s+name)[:\-\s]*([a-z0-9][a-z0-9\s\.\-]{2,50})(?:\n|$|[0-9]{5}|@|,)/i,
    ];

    for (const pattern of receiverPatterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 2) {
        let name = match[1].trim().replace(/\s+/g, ' ');
        name = name.replace(/\s*(account|bank|name|holder|beneficiary|receiver|recipient)\s*$/i, '').trim();
        if (name.length < 2) continue;
        const words = name.split(' ');
        if (words.length >= 1 && words.length <= 10 && name.length <= 60) {
          extracted.receiver_bank_holder = name;
          if (!extracted.recipient_name) extracted.recipient_name = name;
          break;
        }
      }
    }

    return extracted;
  };

  const mapVisionToForm = (v: VisionPaymentData) => {
    const amountStr = (v.amount || '').trim();
    let paymentAmount = '';
    let paymentCurrency = 'INR';
    if (amountStr) {
      if (/INR|₹|Rs\.?/i.test(amountStr)) paymentCurrency = 'INR';
      else if (/USD|\$/i.test(amountStr)) paymentCurrency = 'USD';
      else if (/EUR|€/i.test(amountStr)) paymentCurrency = 'EUR';
      else if (/GBP|£/i.test(amountStr)) paymentCurrency = 'GBP';
      paymentAmount = amountStr.replace(/[^\d.]/g, '').replace(/,/g, '') || amountStr.replace(/,/g, '').trim();
    }
    const paymentDate = (v.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(v.payment_date)) ? v.payment_date : '';
    return {
      recipientName: v.receiver_name ?? '',
      senderName: (v.payer_name && v.payer_name.trim()) ? v.payer_name.trim() : formData.senderName,
      paymentMethod: v.payment_method || formData.paymentMethod,
      customPaymentMethod: formData.customPaymentMethod,
      paymentCurrency: paymentCurrency || formData.paymentCurrency,
      paymentAmount: paymentAmount || formData.paymentAmount,
      paymentDate,
      receiverBankHolder: v.receiver_name ?? '',
      requirements: formData.requirements,
      utrNumber: (v.utr && v.utr.trim()) ? v.utr.trim() : formData.utrNumber,
      paymentType: formData.paymentType,
    };
  };

  const handleAutofill = async () => {
    if (!screenshot) {
      setError('Please upload a screenshot first');
      return;
    }

    setAutofilling(true);
    setError('');

    try {
      let usedVision = false;
      const visionResult = await extractPaymentDetailsFromVision(screenshot);
      const validated = visionResult ? validateVisionResult(visionResult) : null;

      if (validated && validated.payment_date) {
        usedVision = true;
        const next = mapVisionToForm(validated);
        setFormData(next);
      }

      if (!usedVision) {
        const result = await Tesseract.recognize(screenshot, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
          },
        });

        const extractedText = result.data.text;
        const extractedData = extractPaymentDetails(extractedText);

        const defaultCurrency = extractedData.payment_currency || 'INR';
        const paymentDate = (extractedData.payment_date && /^\d{4}-\d{2}-\d{2}$/.test(extractedData.payment_date))
          ? extractedData.payment_date
          : '';
        setFormData({
          recipientName: extractedData.recipient_name || '',
          senderName: extractedData.sender_name || formData.senderName,
          paymentMethod: extractedData.payment_method || formData.paymentMethod,
          customPaymentMethod: formData.customPaymentMethod,
          paymentCurrency: defaultCurrency,
          paymentAmount: extractedData.payment_amount || '',
          paymentDate,
          receiverBankHolder: extractedData.receiver_bank_holder || '',
          requirements: formData.requirements,
          utrNumber: extractedData.utr_number || formData.utrNumber,
          paymentType: formData.paymentType,
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to extract text from image');
    } finally {
      setAutofilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!screenshot) {
        throw new Error('Please upload a payment screenshot');
      }

      const receiverBankHolder = formData.receiverBankHolder?.trim() || '';
      const utrNumber = formData.utrNumber?.trim() || '';
      if (!receiverBankHolder) {
        setLoading(false);
        setError('Receiver Bank Holder Name is required.');
        return;
      }
      if (!utrNumber) {
        setLoading(false);
        setError('UTR / Transaction Reference is required.');
        return;
      }

      const { data: existingByUtr } = await supabase
        .from('payment_records')
        .select('id')
        .eq('utr_number', utrNumber)
        .limit(1);

      if (existingByUtr && existingByUtr.length > 0) {
        setLoading(false);
        setError('This screenshot has already been uploaded. This UTR/reference number exists in our records.');
        return;
      }

      const screenshotHash = await hashFile(screenshot);
      const duplicateScreenshot = await screenshotExistsInDb(screenshotHash);
      if (duplicateScreenshot) {
        setLoading(false);
        setError('This screenshot has already been uploaded. Please do not upload the same image again.');
        return;
      }

      const fileExt = screenshot.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-screenshots')
        .upload(fileName, screenshot);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-screenshots')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('payment_records')
        .insert({
          user_id: user!.id,
          recipient_name: formData.recipientName,
          sender_name: formData.senderName?.trim() || null,
          submitted_by_email: user?.email ?? null,
          payment_method: formData.paymentMethod === 'Other' ? formData.customPaymentMethod : formData.paymentMethod,
          payment_currency: formData.paymentCurrency,
          payment_amount: parseFloat(formData.paymentAmount),
          payment_date: formData.paymentDate,
          receiver_bank_holder: receiverBankHolder,
          requirements: formData.requirements || null,
          payment_screenshot_url: publicUrl,
          utr_number: utrNumber,
          payment_type: formData.paymentType,
          screenshot_hash: screenshotHash,
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setFormData({
        recipientName: '',
        senderName: '',
        paymentMethod: '',
        customPaymentMethod: '',
        paymentCurrency: '',
        paymentAmount: '',
        paymentDate: '',
        receiverBankHolder: '',
        requirements: '',
        utrNumber: '',
        paymentType: 'Received',
      });
      setScreenshot(null);
      setPreviewUrl('');

      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment record');
    } finally {
      setLoading(false);
    }
  };

  const handleFuturePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFuturePaymentError('');
    setFuturePaymentLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('future_payments')
        .insert({
          user_id: user!.id,
          sender_name: futurePaymentData.senderName,
          email: futurePaymentData.email?.trim() || null,
          amount: parseFloat(futurePaymentData.amount),
          category: futurePaymentData.category,
          custom_category: futurePaymentData.category === 'Other' ? futurePaymentData.customCategory : null,
          currency: futurePaymentData.currency,
          payment_date: futurePaymentData.paymentDate,
          notes: futurePaymentData.notes || null,
        });

      if (insertError) throw insertError;

      setFuturePaymentSuccess(true);
      setFuturePaymentData({
        senderName: '',
        email: '',
        amount: '',
        category: '',
        customCategory: '',
        currency: 'USD',
        paymentDate: '',
        notes: '',
      });

      setTimeout(() => setFuturePaymentSuccess(false), 5000);
    } catch (err: any) {
      setFuturePaymentError(err.message || 'Failed to submit future repayment');
    } finally {
      setFuturePaymentLoading(false);
    }
  };

  const handleStudentExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setStudentUploadError('File size must be less than 10MB');
        return;
      }
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
        setStudentUploadError('Please upload an Excel or CSV file');
        return;
      }
      setStudentExcelFile(file);
      setStudentUploadError('');
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStudentLoading(true);

    try {
      if (!newStudentData.student_name) {
        throw new Error('Student name is required');
      }

      const formattedSubjects = newStudentData.subjects
        .split(',')
        .map(s => s.trim())
        .filter(s => s)
        .join(', ');

      const { error } = await supabase
        .from('student_records')
        .insert({
          user_id: user!.id,
          student_name: newStudentData.student_name,
          email: newStudentData.email || null,
          password: newStudentData.password || null,
          phone_number: newStudentData.phone_number || null,
          university: newStudentData.university || null,
          subjects: formattedSubjects || null,
          additional_info: {},
        });

      if (error) throw error;

      setShowAddStudentModal(false);
      setNewStudentData({
        student_name: '',
        email: '',
        password: '',
        phone_number: '',
        university: '',
        subjects: '',
      });
      setStudentUploadSuccess(true);
      setUploadedRecordsCount(1);
      setTimeout(() => setStudentUploadSuccess(false), 5000);
    } catch (err: any) {
      setStudentUploadError(err.message || 'Failed to add student');
    } finally {
      setAddStudentLoading(false);
    }
  };

  const handleStudentSearch = async (query: string) => {
    setStudentSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('search_students', {
        search_query: query,
      });

      if (error) throw error;
      setSearchResults((data as any[]) || []);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    }
  };

  const handleSelectStudent = (student: any) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setStudentSearchQuery(student.student_name);
  };

  const handlePaymentScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setPaymentSubmitError('File size must be less than 5MB');
        return;
      }
      setPaymentScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStudentPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentSubmitError('');
    setPaymentSubmitLoading(true);

    try {
      if (!selectedStudent) {
        throw new Error('Please select a student');
      }

      const amount = parseFloat(studentPaymentData.amount);
      const balanceAmount = parseFloat(studentPaymentData.balance_amount);

      if (isNaN(amount) || amount < 0) {
        throw new Error('Please enter a valid amount');
      }

      if (isNaN(balanceAmount) || balanceAmount < 0) {
        throw new Error('Please enter a valid balance amount');
      }

      const hasSubjects = (studentPaymentData.subjects || '').trim().length > 0;
      if (!hasSubjects) {
        setPaymentSubmitError('Please enter Subject(s) for this payment so we can replace the matching pending or partial payment.');
        setPaymentSubmitLoading(false);
        return;
      }

      let screenshotUrl = '';
      let screenshotHash: string | null = null;

      if (paymentScreenshot) {
        const hash = await hashFile(paymentScreenshot);
        const duplicateScreenshot = await screenshotExistsInDb(hash);
        if (duplicateScreenshot) {
          setPaymentSubmitError('This screenshot has already been uploaded. Please do not upload the same image again.');
          setPaymentSubmitLoading(false);
          return;
        }
        screenshotHash = hash;

        const fileName = `${user!.id}/${Date.now()}_${paymentScreenshot.name}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-screenshots')
          .upload(fileName, paymentScreenshot);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('payment-screenshots')
          .getPublicUrl(fileName);

        screenshotUrl = publicUrl;
        try { await supabase.rpc('record_screenshot_hash', { p_hash: hash }); } catch { /* ignore */ }
      }

      const newSubjectsStr = studentPaymentData.subjects?.trim() || '';
      const newSubjectSet = newSubjectsStr ? newSubjectsStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : [];
      let skipInsert = false; // If we merge into existing row, skip the insert

      if (newSubjectSet.length > 0) {
        // Use RPC so we see all payments for this student (including admin-created) that we're allowed to update
        const { data: existingPayments, error: fetchErr } = await supabase.rpc('get_student_payments_for_partial_pay', {
          p_student_id: selectedStudent.id,
        });
        if (fetchErr) throw fetchErr;
        for (const row of existingPayments || []) {
          const rowSubjectStrs = (row.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean);
          const rowSubjectSetLower = rowSubjectStrs.map((s: string) => s.toLowerCase());
          const paidInThisRow = rowSubjectSetLower.filter((rs: string) => newSubjectSet.includes(rs));
          if (paidInThisRow.length === 0) continue; // no overlap, leave row as-is
          const remainingStrs = rowSubjectStrs.filter((_s: string, i: number) => !newSubjectSet.includes(rowSubjectSetLower[i]));
          if (amount > 0) {
            // Paying: check if we should MERGE (completing a partial) or DELETE + INSERT
            const totalForSubject = amount + balanceAmount;
            if (remainingStrs.length === 0) {
              const oldBalance = Number(row.balance_amount) || 0;
              if (oldBalance > 0) {
                // Old row was a partial payment. MERGE into it: add amounts, merge screenshots, show total.
                const arr = row.payment_screenshot_urls;
                const existingUrls = (arr && Array.isArray(arr) && arr.length > 0)
                  ? arr
                  : (row.payment_screenshot_url ? [row.payment_screenshot_url] : []);
                const { data: mergeRows, error: mergeError } = await supabase.rpc('merge_student_payment_complete', {
                  p_payment_id: row.id,
                  p_add_amount: amount,
                  p_new_balance_amount: balanceAmount,
                  p_new_payment_status: studentPaymentData.payment_status,
                  p_new_screenshot_url: screenshotUrl || null,
                  p_existing_screenshot_urls: existingUrls,
                });
                if (mergeError) throw mergeError;
                if (Number(Array.isArray(mergeRows) ? mergeRows[0] : mergeRows) !== 1) {
                  throw new Error('Could not complete partial payment. You may not have permission.');
                }
                skipInsert = true; // We merged into existing row, don't insert new
              } else {
                // Old row was fully paid or unpaid with balance 0. DELETE it and insert new.
                const { data: delRows, error: delError } = await supabase.rpc('delete_student_payment_for_partial_pay', { p_payment_id: row.id });
                if (delError) throw delError;
                if (Number(Array.isArray(delRows) ? delRows[0] : delRows) !== 1) {
                  throw new Error('Could not update existing unpaid bill. You may not have permission.');
                }
              }
            } else {
              const oldBalance = Number(row.balance_amount) || 0;
              const newBalance = Math.max(0, oldBalance - totalForSubject);
              const newStatus = newBalance === 0 ? 'paid_completely' : undefined;
              const { data: updRows, error: updateError } = await supabase.rpc('update_student_payment_for_partial_pay', {
                p_payment_id: row.id,
                p_new_subjects: remainingStrs.join(', '),
                p_new_balance_amount: newBalance,
                p_new_payment_status: newStatus ?? null,
              });
              if (updateError) throw updateError;
              if (Number(Array.isArray(updRows) ? updRows[0] : updRows) !== 1) {
                throw new Error('Could not update existing unpaid bill. You may not have permission.');
              }
            }
          } else {
            // Unpaid entry (amount 0): replace existing row for these subjects
            if (remainingStrs.length === 0) {
              const { data: delRows, error: delError } = await supabase.rpc('delete_student_payment_for_partial_pay', { p_payment_id: row.id });
              if (delError) throw delError;
              if (Number(Array.isArray(delRows) ? delRows[0] : delRows) !== 1) {
                throw new Error('Could not update existing payment. You may not have permission.');
              }
            } else {
              const { data: updRows, error: updateError } = await supabase.rpc('update_student_payment_for_partial_pay', {
                p_payment_id: row.id,
                p_new_subjects: remainingStrs.join(', '),
                p_new_balance_amount: Number(row.balance_amount) || 0,
                p_new_payment_status: null,
              });
              if (updateError) throw updateError;
              if (Number(Array.isArray(updRows) ? updRows[0] : updRows) !== 1) {
                throw new Error('Could not update existing payment. You may not have permission.');
              }
            }
          }
        }
      }

      // Insert new row only if we didn't merge into an existing one
      if (!skipInsert) {
        const { error } = await supabase
          .from('student_payments')
          .insert({
            user_id: user!.id,
            student_id: selectedStudent.id,
            payment_mode: studentPaymentData.payment_mode,
            currency: studentPaymentData.currency,
            amount: amount,
            payment_status: studentPaymentData.payment_status,
            balance_amount: balanceAmount,
            credited_to: studentPaymentData.credited_to || null,
            payment_date: studentPaymentData.payment_date || null,
            payment_screenshot_url: screenshotUrl || null,
            screenshot_hash: screenshotHash,
            subjects: studentPaymentData.subjects?.trim() || null,
            payment_screenshot_urls: screenshotUrl ? [screenshotUrl] : [],
          });

        if (error) throw error;
      }

      setPaymentSubmitSuccess(true);
      setSelectedStudent(null);
      setStudentSearchQuery('');
      setStudentPaymentData({
        payment_mode: '',
        currency: 'USD',
        amount: '',
        payment_status: 'unpaid',
        balance_amount: '',
        credited_to: '',
        payment_date: '',
        subjects: '',
      });
      setPaymentSubjectInput('');
      setPaymentSubjectSuggestionsOpen(false);
      setPaymentScreenshot(null);
      setPaymentScreenshotPreview('');

      setTimeout(() => setPaymentSubmitSuccess(false), 5000);
    } catch (err: any) {
      setPaymentSubmitError(err.message || 'Failed to submit payment');
    } finally {
      setPaymentSubmitLoading(false);
    }
  };

  const handleStudentExcelUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentUploadError('');
    setStudentUploadLoading(true);

    try {
      const normalizeEmail = (email: unknown): string | null => {
        if (email === null || email === undefined) return null;
        const v = String(email).trim();
        if (!v) return null;
        return v.toLowerCase();
      };

      const normalizeKeyPart = (value: unknown): string => String(value ?? '').trim().toLowerCase();

      if (!studentExcelFile) {
        throw new Error('Please select an Excel file');
      }

      const data = await studentExcelFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The Excel file is empty');
      }

      const rawStudentRecords = jsonData.map((row: any) => {
        const knownFields: any = {};
        const additionalFields: any = {};
        const subjectsMap: { [key: string]: string } = {};
        let termValue = '';

        Object.keys(row).forEach((key) => {
          const lowerKey = key.toLowerCase().trim();
          const value = row[key];

          if (lowerKey.includes('name') || lowerKey === 'student') {
            knownFields.student_name = String(value || '');
          } else if (lowerKey.includes('email') || lowerKey.includes('e-mail')) {
            knownFields.email = normalizeEmail(value);
          } else if (lowerKey.includes('password') || lowerKey.includes('pass')) {
            knownFields.password = String(value || '');
          } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
            knownFields.phone_number = String(value || '');
          } else if (lowerKey.includes('university') || lowerKey.includes('college') || lowerKey.includes('institution')) {
            knownFields.university = String(value || '');
          } else if (lowerKey.includes('term')) {
            termValue = String(value || '').trim();
          } else if (lowerKey.includes('sub') || lowerKey.includes('subject') || lowerKey.includes('course')) {
            const subjectValue = String(value || '').trim();
            if (subjectValue) {
              subjectsMap[key] = subjectValue;
            }
          } else {
            additionalFields[key] = value;
          }
        });

        const sortedSubjects = Object.keys(subjectsMap).sort();
        const formattedSubjects = sortedSubjects
          .map(key => {
            const subject = subjectsMap[key];
            return termValue ? `${termValue}_${subject}` : subject;
          })
          .join(', ');

        return {
          user_id: user!.id,
          student_name: knownFields.student_name || 'N/A',
          email: knownFields.email || null,
          password: knownFields.password || null,
          phone_number: knownFields.phone_number || null,
          university: knownFields.university || null,
          subjects: formattedSubjects || null,
          additional_info: additionalFields,
        };
      });

      // Dedupe rows within the uploaded file first
      const byKey = new Map<string, any>();
      let fileDuplicatesMerged = 0;

      for (const r of rawStudentRecords) {
        const key = r.email
          ? `email:${r.email}`
          : `noemail:${normalizeKeyPart(r.student_name)}|${normalizeKeyPart(r.phone_number)}|${normalizeKeyPart(r.university)}`;

        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, r);
          continue;
        }

        fileDuplicatesMerged++;

        const existingSubjects = String(existing.subjects || '');
        const newSubjects = String(r.subjects || '');
        const combinedSubjects = Array.from(
          new Set(
            [...existingSubjects.split(','), ...newSubjects.split(',')]
              .map((s: string) => s.trim())
              .filter((s: string) => s)
          )
        ).join(', ');
        existing.subjects = combinedSubjects || null;

        existing.student_name = existing.student_name || r.student_name;
        existing.password = existing.password || r.password;
        existing.phone_number = existing.phone_number || r.phone_number;
        existing.university = existing.university || r.university;
        existing.additional_info = { ...(existing.additional_info || {}), ...(r.additional_info || {}) };

        byKey.set(key, existing);
      }

      const studentRecords = Array.from(byKey.values());

      // Helper function to normalize subjects (sort and normalize for comparison)
      const normalizeSubjects = (subjects: string | null): string => {
        if (!subjects) return '';
        return subjects
          .split(',')
          .map((s: string) => s.trim().toLowerCase())
          .filter((s: string) => s)
          .sort()
          .join(', ');
      };

      // Helper function to normalize and compare student records
      const normalizeRecord = (record: any) => {
        return {
          student_name: String(record.student_name || '').trim().toLowerCase(),
          email: normalizeEmail(record.email),
          password: String(record.password || '').trim(),
          phone_number: String(record.phone_number || '').trim(),
          university: String(record.university || '').trim().toLowerCase(),
          subjects: normalizeSubjects(record.subjects), // Normalize subjects for comparison
        };
      };

      // Helper function to create a fingerprint of student records for comparison
      const createRecordsFingerprint = (records: any[]): string => {
        const normalized = records.map(r => {
          const normalized = normalizeRecord(r);
          return `${normalized.student_name}|${normalized.email || ''}|${normalized.phone_number}|${normalized.university}|${normalized.subjects}`;
        }).sort().join('||');
        return normalized;
      };

      // Condition 3: Check if this Excel data was uploaded before
      const currentFingerprint = createRecordsFingerprint(studentRecords);
      
      // Fetch all previous Excel uploads for this user
      const { data: previousUploads, error: uploadsError } = await supabase
        .from('excel_uploads')
        .select('file_path, upload_type')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (!uploadsError && previousUploads && previousUploads.length > 0) {
        // Check each previous upload to see if data matches
        for (const prevUpload of previousUploads) {
          try {
            // Download and parse the previous Excel file
            const urlPath = prevUpload.file_path.replace('excel-uploads/', '');
            const { data: signedUrlData } = await supabase.storage
              .from('excel-uploads')
              .createSignedUrl(urlPath, 60);

            if (signedUrlData?.signedUrl) {
              const response = await fetch(signedUrlData.signedUrl);
              const arrayBuffer = await response.arrayBuffer();
              const prevWorkbook = XLSX.read(arrayBuffer, { type: 'array' });
              const prevSheetName = prevWorkbook.SheetNames[0];
              const prevWorksheet = prevWorkbook.Sheets[prevSheetName];
              const prevJsonData = XLSX.utils.sheet_to_json(prevWorksheet) as any[];

              if (prevJsonData.length > 0) {
                // Process previous Excel the same way
                const prevRawRecords = prevJsonData.map((row: any) => {
                  const knownFields: any = {};
                  const additionalFields: any = {};
                  const subjectsMap: { [key: string]: string } = {};
                  let termValue = '';

                  Object.keys(row).forEach((key) => {
                    const lowerKey = key.toLowerCase().trim();
                    const value = row[key];

                    if (lowerKey.includes('name') || lowerKey === 'student') {
                      knownFields.student_name = String(value || '');
                    } else if (lowerKey.includes('email') || lowerKey.includes('e-mail')) {
                      knownFields.email = normalizeEmail(value);
                    } else if (lowerKey.includes('password') || lowerKey.includes('pass')) {
                      knownFields.password = String(value || '');
                    } else if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('contact')) {
                      knownFields.phone_number = String(value || '');
                    } else if (lowerKey.includes('university') || lowerKey.includes('college') || lowerKey.includes('institution')) {
                      knownFields.university = String(value || '');
                    } else if (lowerKey.includes('term')) {
                      termValue = String(value || '').trim();
                    } else if (lowerKey.includes('sub') || lowerKey.includes('subject') || lowerKey.includes('course')) {
                      const subjectValue = String(value || '').trim();
                      if (subjectValue) {
                        subjectsMap[key] = subjectValue;
                      }
                    } else {
                      additionalFields[key] = value;
                    }
                  });

                  const sortedSubjects = Object.keys(subjectsMap).sort();
                  const formattedSubjects = sortedSubjects
                    .map(key => {
                      const subject = subjectsMap[key];
                      return termValue ? `${termValue}_${subject}` : subject;
                    })
                    .join(', ');

                  return {
                    user_id: user!.id,
                    student_name: knownFields.student_name || 'N/A',
                    email: knownFields.email || null,
                    password: knownFields.password || null,
                    phone_number: knownFields.phone_number || null,
                    university: knownFields.university || null,
                    subjects: formattedSubjects || null,
                    additional_info: additionalFields,
                  };
                });

                // Dedupe previous Excel the same way
                const prevByKey = new Map<string, any>();
                for (const r of prevRawRecords) {
                  const key = r.email
                    ? `email:${r.email}`
                    : `noemail:${normalizeKeyPart(r.student_name)}|${normalizeKeyPart(r.phone_number)}|${normalizeKeyPart(r.university)}`;
                  const existing = prevByKey.get(key);
                  if (!existing) {
                    prevByKey.set(key, r);
                    continue;
                  }
                  const existingSubjects = String(existing.subjects || '');
                  const newSubjects = String(r.subjects || '');
                  const combinedSubjects = Array.from(
                    new Set(
                      [...existingSubjects.split(','), ...newSubjects.split(',')]
                        .map((s: string) => s.trim())
                        .filter((s: string) => s)
                    )
                  ).join(', ');
                  existing.subjects = combinedSubjects || null;
                  prevByKey.set(key, existing);
                }

                const prevStudentRecords = Array.from(prevByKey.values());
                const prevFingerprint = createRecordsFingerprint(prevStudentRecords);

                // Compare fingerprints
                if (currentFingerprint === prevFingerprint) {
                  throw new Error('This Excel file contains data that was already uploaded before. Please upload a file with new data.');
                }
              }
            }
          } catch (err) {
            // If we can't parse a previous file, continue checking others
            console.warn('Could not check previous upload:', err);
            continue;
          }
        }
      }

      // Cross-dashboard dedupe:
      // If the admin already uploaded this student into the database, user uploads should NOT create a new record.
      // We use the SECURITY DEFINER `search_students` RPC to check for existing students globally by email.
      // Note: we only skip (not update) when the existing student is not owned by this user, because `student_records`
      // updates are protected by RLS.
      const globalExistingEmails = new Set<string>();
      const uniqueEmailsInExcel = Array.from(
        new Set(
          studentRecords
            .map((r) => normalizeEmail(r.email))
            .filter((v): v is string => Boolean(v))
        )
      );

      // Limit RPC calls: only check reasonably-valid emails (length >= 3 is enough to satisfy RPC length >= 2)
      for (const email of uniqueEmailsInExcel) {
        try {
          const { data, error } = await supabase.rpc('search_students', { search_query: email });
          if (!error && Array.isArray(data) && data.length > 0) {
            // Confirm exact email match (RPC is fuzzy)
            const hasExactMatch = (data as any[]).some(
              (row) => normalizeEmail(row?.email) === email
            );
            if (hasExactMatch) {
              globalExistingEmails.add(email);
            }
          }
        } catch (err) {
          // If RPC fails for some reason, don't block upload; fall back to user-owned dedupe only.
          console.warn('Global student lookup failed for email:', email, err);
        }
      }

      // Query ALL existing records for the current user (to check for duplicates)
      const { data: allExistingRecords, error: fetchError } = await supabase
        .from('student_records')
        .select('*')
        .eq('user_id', user!.id);

      if (fetchError) throw fetchError;
      const existingRecords = allExistingRecords || [];

      // Build a map of existing records by normalized email
      const existingByEmail = new Map<string, any[]>();
      for (const record of existingRecords) {
        const em = normalizeEmail(record.email);
        if (em) {
          if (!existingByEmail.has(em)) {
            existingByEmail.set(em, []);
          }
          existingByEmail.get(em)!.push(record);
        }
      }

      // Build a map for records without email (by name+phone+university)
      const existingByKey = new Map<string, any[]>();
      for (const record of existingRecords) {
        if (!record.email || !normalizeEmail(record.email)) {
          const key = `noemail:${String(record.student_name || '').trim().toLowerCase()}|${String(record.phone_number || '').trim()}|${String(record.university || '').trim().toLowerCase()}`;
          if (!existingByKey.has(key)) {
            existingByKey.set(key, []);
          }
          existingByKey.get(key)!.push(record);
        }
      }

      const recordsToInsert: any[] = [];
      const recordsToUpdate: any[] = [];
      let skippedCount = 0;
      let skippedBecauseExistsGlobally = 0;

      // First pass: Check each student in Excel to see if they have new data
      for (const newRecord of studentRecords) {
        const normalizedNew = normalizeRecord(newRecord);
        let hasNewData = false;
        let matchingExisting: any = null;

        if (!newRecord.email || !normalizeEmail(newRecord.email)) {
          // For records without email, check by name+phone+university
          const key = `noemail:${normalizedNew.student_name}|${normalizedNew.phone_number}|${normalizedNew.university}`;
          const candidates = existingByKey.get(key) || [];

          // Check if this exact student with same subjects already exists
          for (const existing of candidates) {
            const normalizedExisting = normalizeRecord(existing);
            if (
              normalizedExisting.student_name === normalizedNew.student_name &&
              normalizedExisting.phone_number === normalizedNew.phone_number &&
              normalizedExisting.university === normalizedNew.university &&
              normalizedExisting.subjects === normalizedNew.subjects
            ) {
              // Exact duplicate - no new data
              hasNewData = false;
              matchingExisting = null;
              break;
            } else if (
              normalizedExisting.student_name === normalizedNew.student_name &&
              normalizedExisting.phone_number === normalizedNew.phone_number &&
              normalizedExisting.university === normalizedNew.university
            ) {
              // Same student exists - check if subjects are different
              matchingExisting = existing;
              const existingSubjectsNormalized = normalizeSubjects(existing.subjects);
              const newSubjectsNormalized = normalizedNew.subjects;

              if (existingSubjectsNormalized !== newSubjectsNormalized) {
                // Check if new subjects are already included
                const existingSubjectsArray = existingSubjectsNormalized
                  .split(', ')
                  .filter((s: string) => s);
                const newSubjectsArray = newSubjectsNormalized
                  .split(', ')
                  .filter((s: string) => s);

                const allNewSubjectsExist = newSubjectsArray.every((newSub: string) =>
                  existingSubjectsArray.includes(newSub)
                );

                if (!allNewSubjectsExist) {
                  // Has new subjects - has new data
                  hasNewData = true;
                }
              }
              break;
            }
          }

          // If no matching student found, it's a new student
          if (!matchingExisting) {
            hasNewData = true;
          }
        } else {
          // For records with email, check all records with same email
          const normalizedEmail = normalizeEmail(newRecord.email)!;
          const candidates = existingByEmail.get(normalizedEmail) || [];

          // Find matching student record (same email, name, phone, university)
          for (const existing of candidates) {
            const normalizedExisting = normalizeRecord(existing);
            if (
              normalizedExisting.student_name === normalizedNew.student_name &&
              normalizedExisting.phone_number === normalizedNew.phone_number &&
              normalizedExisting.university === normalizedNew.university
            ) {
              matchingExisting = existing;
              break;
            }
          }

          if (matchingExisting) {
            // Same student exists - check if subjects are different
            const existingSubjectsNormalized = normalizeSubjects(matchingExisting.subjects);
            const newSubjectsNormalized = normalizedNew.subjects;

            if (existingSubjectsNormalized === newSubjectsNormalized) {
              // All subjects are the same - no new data
              hasNewData = false;
            } else {
              // Check if new subjects are already included
              const existingSubjectsArray = existingSubjectsNormalized
                .split(', ')
                .filter((s: string) => s);
              const newSubjectsArray = newSubjectsNormalized
                .split(', ')
                .filter((s: string) => s);

              const allNewSubjectsExist = newSubjectsArray.every((newSub: string) =>
                existingSubjectsArray.includes(newSub)
              );

              if (!allNewSubjectsExist) {
                // Has new subjects - has new data
                hasNewData = true;
              }
            }
          } else {
            // Not in this user's records. If student exists globally (e.g. added by admin),
            // do NOT create a new record for it from user upload.
            if (globalExistingEmails.has(normalizedEmail)) {
              skippedBecauseExistsGlobally++;
              continue;
            }
            // New student for this app - has new data
            hasNewData = true;
          }
        }

        // Only process if this student has new data
        if (!hasNewData) {
          skippedCount++;
          continue;
        }

        // Process student with new data
        if (matchingExisting) {
          // Update existing student with new subjects (don't create new record)
          const existingSubjectsNormalized = normalizeSubjects(matchingExisting.subjects);
          const newSubjectsNormalized = normalizedNew.subjects;
          const existingSubjectsArray = existingSubjectsNormalized
            .split(', ')
            .filter((s: string) => s);
          const newSubjectsArray = newSubjectsNormalized
            .split(', ')
            .filter((s: string) => s);

          // Merge subjects (add new ones only)
          const combinedSubjects = Array.from(
            new Set([...existingSubjectsArray, ...newSubjectsArray])
          )
            .sort()
            .join(', ');

          // Check if this record is already scheduled for update (in case of multiple rows for same student)
          const existingUpdate = recordsToUpdate.find((r) => r.id === matchingExisting.id);
          if (existingUpdate) {
            // Update the existing update with merged subjects (merge again to include all new subjects)
            const existingUpdateSubjects = normalizeSubjects(existingUpdate.subjects)
              .split(', ')
              .filter((s: string) => s);
            const allCombined = Array.from(
              new Set([...existingUpdateSubjects, ...newSubjectsArray])
            )
              .sort()
              .join(', ');
            existingUpdate.subjects = allCombined;
          } else {
            // Schedule update for this existing student (only subjects will be updated)
            recordsToUpdate.push({
              id: matchingExisting.id,
              subjects: combinedSubjects,
            });
          }
        } else {
          // New student - add it
          recordsToInsert.push(newRecord);
        }
      }

      // If no new data at all, skip the entire upload
      if (recordsToInsert.length === 0 && recordsToUpdate.length === 0) {
        throw new Error('This Excel file contains no new data. All students and their data already exist in the database.');
      }

      // If no new data at all, skip the entire upload
      if (recordsToInsert.length === 0 && recordsToUpdate.length === 0) {
        throw new Error('This Excel file contains no new data. All students and their data already exist in the database.');
      }

      // Save Excel file to storage
      const fileName = `${user!.id}/${Date.now()}_${studentExcelFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('excel-uploads')
        .upload(fileName, studentExcelFile);

      if (uploadError) throw uploadError;

      // Record metadata in excel_uploads table
      // Store just the path within the bucket (without 'excel-uploads/' prefix)
      const { error: recordError } = await supabase
        .from('excel_uploads')
        .insert({
          user_id: user!.id,
          file_name: studentExcelFile.name,
          file_path: fileName, // Store just the path within bucket: user_id/timestamp_filename.xlsx
          file_size: studentExcelFile.size,
          upload_type: 'user',
          records_count: recordsToInsert.length + recordsToUpdate.length,
        });

      if (recordError) {
        console.error('Failed to record Excel upload metadata:', recordError);
        // Don't throw - file is already uploaded, just log the error
      }

      if (recordsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('student_records')
          .insert(recordsToInsert);

        if (insertError) throw insertError;
      }

      if (recordsToUpdate.length > 0) {
        for (const record of recordsToUpdate) {
          const { error: updateError } = await supabase
            .from('student_records')
            .update({ subjects: record.subjects })
            .eq('id', record.id);

          if (updateError) throw updateError;
        }
      }

      setStudentUploadSuccess(true);
      setUploadedRecordsCount(recordsToInsert.length);

      const statusMessages = [];
      if (recordsToInsert.length > 0) {
        statusMessages.push(`${recordsToInsert.length} new records added`);
      }
      if (recordsToUpdate.length > 0) {
        statusMessages.push(`${recordsToUpdate.length} records updated with new subjects`);
      }
      if (skippedCount > 0) {
        statusMessages.push(`${skippedCount} duplicates skipped`);
      }
      if (skippedBecauseExistsGlobally > 0) {
        statusMessages.push(`${skippedBecauseExistsGlobally} skipped (already exists in database)`);
      }
      if (fileDuplicatesMerged > 0) {
        statusMessages.push(`${fileDuplicatesMerged} duplicate row(s) merged from the uploaded file`);
      }

      if (statusMessages.length > 0) {
        setStudentUploadError(statusMessages.join(', '));
        setTimeout(() => setStudentUploadError(''), 5000);
      }
      setStudentExcelFile(null);

      setTimeout(() => setStudentUploadSuccess(false), 5000);
    } catch (err: any) {
      setStudentUploadError(err.message || 'Failed to upload student records');
    } finally {
      setStudentUploadLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzFmMmQ0ZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-20"></div>

      <nav className="relative backdrop-blur-xl bg-white/10 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg shadow-lg shadow-cyan-500/50">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Payment Portal</h1>
                <p className="text-sm text-slate-300">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 text-white rounded-lg transition-all border border-slate-700"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="backdrop-blur-xl bg-white/10 rounded-lg border border-white/20 p-1 inline-flex gap-1">
          <button
            onClick={() => setActiveTab('payment')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'payment'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4 inline mr-2" />
            Submit Payment
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'students'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <GraduationCap className="w-4 h-4 inline mr-2" />
            Upload Students
          </button>
          <button
            onClick={() => setActiveTab('addPayments')}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === 'addPayments'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Wallet className="w-4 h-4 inline mr-2" />
            Add Payments
          </button>
        </div>
      </div>

      <main className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'payment' && (
          <>
            {success && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <Check className="w-5 h-5 text-green-400" />
                <p className="text-green-200">Payment record submitted successfully!</p>
              </div>
            )}

            <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">Submit Payment Record</h2>
                <p className="text-slate-300">Fill in the details of your payment transaction</p>
              </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Recipient Name
                </label>
                <input
                  type="text"
                  value={formData.recipientName}
                  onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Enter recipient name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Sender / Payer Name
                </label>
                <input
                  type="text"
                  value={formData.senderName}
                  onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Who sent or paid (e.g. student name)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Payment Method
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value, customPaymentMethod: e.target.value === 'Other' ? formData.customPaymentMethod : '' })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select method</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
                {formData.paymentMethod === 'Other' && (
                  <input
                    type="text"
                    value={formData.customPaymentMethod}
                    onChange={(e) => setFormData({ ...formData, customPaymentMethod: e.target.value })}
                    placeholder="Enter custom payment method"
                    className="w-full mt-3 px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Payment Type
                </label>
                <select
                  value={formData.paymentType}
                  onChange={(e) => setFormData({ ...formData, paymentType: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                >
                  {PAYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Currency
                </label>
                <select
                  value={formData.paymentCurrency}
                  onChange={(e) => setFormData({ ...formData, paymentCurrency: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select currency</option>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Payment Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Payment Date
                </label>
                <input
                  type="date"
                  value={formData.paymentDate || ''}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all [color-scheme:dark]"
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  {formData.paymentDate ? 'Filled from screenshot' : 'Use YYYY-MM-DD or autofill from screenshot'}
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Building className="w-4 h-4 inline mr-2" />
                  Receiver Bank Holder Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.receiverBankHolder}
                  onChange={(e) => setFormData({ ...formData, receiverBankHolder: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Enter bank holder name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Hash className="w-4 h-4 inline mr-2" />
                  UTR / Transaction Reference <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.utrNumber}
                  onChange={(e) => setFormData({ ...formData, utrNumber: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Enter UTR or reference number"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Requirements / Notes (Optional)
              </label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                placeholder="Add any additional notes or requirements"
                rows={4}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                <ImageIcon className="w-4 h-4 inline mr-2" />
                Payment Screenshot (Required)
              </label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-6 text-center hover:border-cyan-500 transition-all">
                {previewUrl ? (
                  <div className="space-y-4">
                    <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow-lg" />
                    <div className="flex gap-3 justify-center">
                      <button
                        type="button"
                        onClick={handleAutofill}
                        disabled={autofilling}
                        className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-lg shadow-lg shadow-purple-500/50 hover:shadow-purple-500/70 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {autofilling ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Autofill from Screenshot
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshot(null);
                          setPreviewUrl('');
                        }}
                        className="px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
                      >
                        Change image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <label className="cursor-pointer">
                      <span className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        Click to upload
                      </span>
                      <span className="text-slate-400"> or drag and drop</span>
                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*"
                        className="hidden"
                        required
                      />
                    </label>
                    <p className="text-xs text-slate-400 mt-2">PNG, JPG, GIF up to 5MB</p>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Submit Payment Record
                </>
              )}
            </button>
          </form>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8 mt-8">
          {futurePaymentSuccess && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-200">Future repayment submitted successfully!</p>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white">Submit Future Repayment</h2>
            </div>
            <p className="text-slate-300">Enter details for expected repayments</p>
          </div>

          <form onSubmit={handleFuturePaymentSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Sender Name
                </label>
                <input
                  type="text"
                  value={futurePaymentData.senderName}
                  onChange={(e) => setFuturePaymentData({ ...futurePaymentData, senderName: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Enter sender name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={futurePaymentData.email}
                  onChange={(e) => setFuturePaymentData({ ...futurePaymentData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Enter email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Currency
                </label>
                <select
                  value={futurePaymentData.currency}
                  onChange={(e) => setFuturePaymentData({ ...futurePaymentData, currency: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>{currency}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <DollarSign className="w-4 h-4 inline mr-2" />
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                    {getCurrencySymbol(futurePaymentData.currency)}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={futurePaymentData.amount}
                    onChange={(e) => setFuturePaymentData({ ...futurePaymentData, amount: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Building className="w-4 h-4 inline mr-2" />
                  Category
                </label>
                <select
                  value={futurePaymentData.category}
                  onChange={(e) => setFuturePaymentData({ ...futurePaymentData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">Select category</option>
                  {FUTURE_PAYMENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {futurePaymentData.category === 'Other' && (
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Custom Category
                  </label>
                  <input
                    type="text"
                    value={futurePaymentData.customCategory}
                    onChange={(e) => setFuturePaymentData({ ...futurePaymentData, customCategory: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Enter custom category"
                    required
                  />
                </div>
              )}

              <div className={futurePaymentData.category === 'Other' ? '' : 'md:col-start-2'}>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Expected Repayment Date
                </label>
                <input
                  type="date"
                  value={futurePaymentData.paymentDate}
                  onChange={(e) => setFuturePaymentData({ ...futurePaymentData, paymentDate: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                <FileText className="w-4 h-4 inline mr-2" />
                Notes (Optional)
              </label>
              <textarea
                value={futurePaymentData.notes}
                onChange={(e) => setFuturePaymentData({ ...futurePaymentData, notes: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all resize-none"
                placeholder="Add any additional notes"
                rows={3}
              />
            </div>

            {futurePaymentError && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {futurePaymentError}
              </div>
            )}

            <button
              type="submit"
              disabled={futurePaymentLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-lg shadow-lg shadow-green-500/50 hover:shadow-green-500/70 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {futurePaymentLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <TrendingUp className="w-5 h-5" />
                  Submit Future Repayment
                </>
              )}
            </button>
          </form>
        </div>
          </>
        )}

        {activeTab === 'students' && (
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
          {studentUploadSuccess && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-green-200">
                Successfully uploaded {uploadedRecordsCount} student record{uploadedRecordsCount !== 1 ? 's' : ''}!
              </p>
            </div>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <GraduationCap className="w-6 h-6 text-cyan-400" />
                  <h2 className="text-2xl font-bold text-white">Student Records</h2>
                </div>
                <p className="text-slate-300">Upload an Excel file or add students manually</p>
                <p className="text-xs text-slate-400 mt-2">
                  Expected columns: Student Name, Email, Password, University, Term, Subject 1, Subject 2, etc. (other columns will be saved as additional info)
                </p>
              </div>
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all shadow-lg shadow-green-500/50"
              >
                <Plus className="w-4 h-4" />
                Add Manually
              </button>
            </div>
          </div>

          <form onSubmit={handleStudentExcelUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                Excel File (XLSX, XLS, or CSV)
              </label>
              <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-cyan-500 transition-all">
                {studentExcelFile ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-3 text-cyan-400">
                      <FileSpreadsheet className="w-12 h-12" />
                      <div className="text-left">
                        <p className="font-semibold text-white">{studentExcelFile.name}</p>
                        <p className="text-sm text-slate-400">
                          {(studentExcelFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentExcelFile(null)}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all"
                    >
                      Change file
                    </button>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <label className="cursor-pointer">
                      <span className="text-cyan-400 hover:text-cyan-300 transition-colors">
                        Click to upload
                      </span>
                      <span className="text-slate-400"> or drag and drop</span>
                      <input
                        type="file"
                        onChange={handleStudentExcelChange}
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        required
                      />
                    </label>
                    <p className="text-xs text-slate-400 mt-2">XLSX, XLS, or CSV up to 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {studentUploadError && (
              <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                {studentUploadError}
              </div>
            )}

            <button
              type="submit"
              disabled={studentUploadLoading}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {studentUploadLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Upload Student Records
                </>
              )}
            </button>
          </form>
        </div>
        )}

        {activeTab === 'addPayments' && (
          <div className="backdrop-blur-xl bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
            {paymentSubmitSuccess && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                <Check className="w-5 h-5 text-green-400" />
                <p className="text-green-200">Student payment recorded successfully!</p>
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="w-6 h-6 text-cyan-400" />
                <h2 className="text-2xl font-bold text-white">Add Student Payment</h2>
              </div>
              <p className="text-slate-300">Search for a student and record their payment details</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-200 mb-2">
                <Search className="w-4 h-4 inline mr-2" />
                Search Student
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => handleStudentSearch(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="Search by name or email..."
                />
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className="w-full px-4 py-3 text-left hover:bg-slate-800 transition-all border-b border-slate-700 last:border-b-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white font-medium">{student.student_name}</p>
                            {student.email && (
                              <p className="text-sm text-slate-400">{student.email}</p>
                            )}
                          </div>
                          {student.university && (
                            <p className="text-xs text-slate-500">{student.university}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedStudent && (
              <div className="mb-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold text-lg">{selectedStudent.student_name}</p>
                    {selectedStudent.email && (
                      <p className="text-sm text-slate-400 mt-1">
                        <Mail className="w-3 h-3 inline mr-1" />
                        {selectedStudent.email}
                      </p>
                    )}
                    {selectedStudent.phone_number && (
                      <p className="text-sm text-slate-400 mt-1">
                        <Hash className="w-3 h-3 inline mr-1" />
                        {selectedStudent.phone_number}
                      </p>
                    )}
                    {selectedStudent.university && (
                      <p className="text-sm text-slate-400 mt-1">
                        <Building className="w-3 h-3 inline mr-1" />
                        {selectedStudent.university}
                      </p>
                    )}
                    {selectedStudent.subjects && (
                      <p className="text-xs text-slate-500 mt-2">
                        <BookOpen className="w-3 h-3 inline mr-1" />
                        {selectedStudent.subjects}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentSearchQuery('');
                    }}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleStudentPaymentSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <CreditCard className="w-4 h-4 inline mr-2" />
                    Payment Mode
                  </label>
                  <select
                    value={studentPaymentData.payment_mode}
                    onChange={(e) => setStudentPaymentData({ ...studentPaymentData, payment_mode: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    required
                    disabled={!selectedStudent}
                  >
                    <option value="">Select payment mode</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Currency
                  </label>
                  <select
                    value={studentPaymentData.currency}
                    onChange={(e) => setStudentPaymentData({ ...studentPaymentData, currency: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    required
                    disabled={!selectedStudent}
                  >
                    {CURRENCIES.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Total Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                      {getCurrencySymbol(studentPaymentData.currency)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={studentPaymentData.amount}
                      onChange={(e) => setStudentPaymentData({ ...studentPaymentData, amount: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      placeholder="0.00"
                      required
                      disabled={!selectedStudent}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <Check className="w-4 h-4 inline mr-2" />
                    Payment Status
                  </label>
                  <select
                    value={studentPaymentData.payment_status}
                    onChange={(e) => setStudentPaymentData({ ...studentPaymentData, payment_status: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    required
                    disabled={!selectedStudent}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="paid_partially">Paid Partially</option>
                    <option value="paid_completely">Paid Completely</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Balance Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">
                      {getCurrencySymbol(studentPaymentData.currency)}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={studentPaymentData.balance_amount}
                      onChange={(e) => setStudentPaymentData({ ...studentPaymentData, balance_amount: e.target.value })}
                      className="w-full pl-12 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                      placeholder="0.00"
                      required
                      disabled={!selectedStudent}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Enter the remaining balance amount (0 if fully paid)
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <BookOpen className="w-4 h-4 inline mr-2" />
                    Subject(s) for this payment
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={paymentSubjectInput}
                      onChange={(e) => {
                        setPaymentSubjectInput(e.target.value);
                        setPaymentSubjectSuggestionsOpen(true);
                      }}
                      onFocus={() => paymentSubjectInput.length >= 1 && setPaymentSubjectSuggestionsOpen(true)}
                      onBlur={() => setTimeout(() => setPaymentSubjectSuggestionsOpen(false), 200)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && paymentSubjectInput.trim()) {
                          e.preventDefault();
                          const current = (studentPaymentData.subjects || '').split(',').map((s) => s.trim()).filter(Boolean);
                          const add = paymentSubjectInput.trim();
                          if (add && !current.some((s) => s.toLowerCase() === add.toLowerCase())) {
                            setStudentPaymentData({ ...studentPaymentData, subjects: current.concat(add).join(', ') });
                            setPaymentSubjectInput('');
                          }
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
placeholder="Type 1–2 letters for suggestions or type subject and press Enter. Required to replace pending or partial payment."
                    disabled={!selectedStudent}
                    />
                    <p className="text-xs text-slate-400 mt-1">Required — we replace any existing pending or partial payment for these subjects with this new payment.</p>
                    {selectedStudent && paymentSubjectSuggestionsOpen && paymentSubjectInput.trim().length >= 1 && (() => {
                      const studentSubjects = (selectedStudent.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean);
                      const selected = (studentPaymentData.subjects || '').split(',').map((s) => s.trim()).filter(Boolean);
                      const q = paymentSubjectInput.trim().toLowerCase();
                      const suggestions = studentSubjects.filter(
                        (s) => !selected.some((x) => x.toLowerCase() === s.toLowerCase()) && s.toLowerCase().includes(q)
                      );
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute z-20 w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {suggestions.map((sub) => (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => {
                                const current = (studentPaymentData.subjects || '').split(',').map((s) => s.trim()).filter(Boolean);
                                setStudentPaymentData({ ...studentPaymentData, subjects: current.concat(sub).join(', ') });
                                setPaymentSubjectInput('');
                                setPaymentSubjectSuggestionsOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-white hover:bg-slate-800 border-b border-slate-700 last:border-b-0"
                            >
                              {sub}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  {(studentPaymentData.subjects || '').split(',').map((s) => s.trim()).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(studentPaymentData.subjects || '').split(',').map((s) => s.trim()).filter(Boolean).map((sub) => (
                        <span
                          key={sub}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-sm"
                        >
                          {sub}
                          <button
                            type="button"
                            onClick={() => {
                              const current = (studentPaymentData.subjects || '').split(',').map((x) => x.trim()).filter(Boolean);
                              setStudentPaymentData({ ...studentPaymentData, subjects: current.filter((x) => x !== sub).join(', ') });
                            }}
                            className="hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <User className="w-4 h-4 inline mr-2" />
                    Credited To
                  </label>
                  <input
                    type="text"
                    value={studentPaymentData.credited_to}
                    onChange={(e) => setStudentPaymentData({ ...studentPaymentData, credited_to: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="Who received the payment"
                    disabled={!selectedStudent}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date
                  </label>
                  <input
                    type="date"
                    value={studentPaymentData.payment_date}
                    onChange={(e) => setStudentPaymentData({ ...studentPaymentData, payment_date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    disabled={!selectedStudent}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-2" />
                    Upload Screenshot
                  </label>
                  {paymentScreenshotPreview ? (
                    <div className="relative border-2 border-slate-700 rounded-lg p-4">
                      <img
                        src={paymentScreenshotPreview}
                        alt="Payment screenshot preview"
                        className="max-h-48 mx-auto rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentScreenshot(null);
                          setPaymentScreenshotPreview('');
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center hover:border-cyan-500 transition-all">
                      <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <label className="cursor-pointer">
                        <span className="text-cyan-400 hover:text-cyan-300 transition-colors">
                          Click to upload
                        </span>
                        <span className="text-slate-400"> or drag and drop</span>
                        <input
                          type="file"
                          onChange={handlePaymentScreenshotChange}
                          accept="image/*"
                          className="hidden"
                          disabled={!selectedStudent}
                        />
                      </label>
                      <p className="text-xs text-slate-400 mt-2">PNG, JPG, or GIF up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              {paymentSubmitError && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
                  {paymentSubmitError}
                </div>
              )}

              <button
                type="submit"
                disabled={paymentSubmitLoading || !selectedStudent}
                className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-cyan-500/50 hover:shadow-cyan-500/70 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {paymentSubmitLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    Record Payment
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>

      {showAddStudentModal && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowAddStudentModal(false)}
        >
          <div
            className="relative max-w-2xl w-full backdrop-blur-xl bg-slate-900/90 rounded-2xl shadow-2xl border border-white/20 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg shadow-green-500/50">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Add New Student</h2>
              </div>
              <button
                onClick={() => setShowAddStudentModal(false)}
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <User className="w-4 h-4 inline mr-2" />
                  Student Name *
                </label>
                <input
                  type="text"
                  value={newStudentData.student_name}
                  onChange={(e) => setNewStudentData({ ...newStudentData, student_name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter student name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  Email
                </label>
                <input
                  type="email"
                  value={newStudentData.email}
                  onChange={(e) => setNewStudentData({ ...newStudentData, email: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="student@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Lock className="w-4 h-4 inline mr-2" />
                  Password
                </label>
                <input
                  type="text"
                  value={newStudentData.password}
                  onChange={(e) => setNewStudentData({ ...newStudentData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Student password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Hash className="w-4 h-4 inline mr-2" />
                  Phone Number
                </label>
                <input
                  type="text"
                  value={newStudentData.phone_number}
                  onChange={(e) => setNewStudentData({ ...newStudentData, phone_number: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <Building className="w-4 h-4 inline mr-2" />
                  University
                </label>
                <input
                  type="text"
                  value={newStudentData.university}
                  onChange={(e) => setNewStudentData({ ...newStudentData, university: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="University name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <BookOpen className="w-4 h-4 inline mr-2" />
                  Subjects
                </label>
                <input
                  type="text"
                  value={newStudentData.subjects}
                  onChange={(e) => setNewStudentData({ ...newStudentData, subjects: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., fall_1_maths, fall_1_physics, spring_2_chemistry"
                />
                <p className="text-xs text-slate-400 mt-2">
                  Enter subjects with term prefixes, separated by commas (e.g., fall_1_maths, spring_2_physics).
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={addStudentLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg transition-all shadow-lg shadow-green-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addStudentLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Add Student
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-white rounded-lg transition-all border border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
