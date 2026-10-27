// src/lib/sms.ts

const TEXTBEE_URL = 'https://api.textbee.dev/api/v1/gateway/send-sms';
const TEXTBEE_KEY = import.meta.env.VITE_TEXTBEE_API_KEY as string | undefined;

/* ------------------------------------------------------------------ */
/*  ✏️  EDIT YOUR MESSAGES HERE                                        */
/*  Placeholders: {name}  {time}                                       */
/*  Keep each line under ~160 chars (that's 1 SMS segment).            */
/* ------------------------------------------------------------------ */
const MESSAGES: Record<string, string> = {
  time_in_am:
    'Hello Dear Parents, Nakapasok napo ang anak niyo na si {name} ngayong {time}. - Sir Sandy',

  time_out_am:
    'Hello Dear Parents, Pauwi napo ang anak niyo na si {name} ngayong {time}. - Sir Sandy',

  time_in_pm:
    'Hello Dear Parents, Nakabalik napo ang anak niyo na si {name} ngayong {time}. - Sir Sandy',

  time_out_pm:
    'Hello Dear Parents, Pauwi napo ang anak niyo na si {name} ngayong {time}. - Sir Sandy',

  // fallback if a slot ever comes through unexpected
  default:
    'Hello Dear Parents, Naitala napo ang attendance ng anak niyo na si {name} ngayong {time}. - Sir Sandy',
};

export type SmsSlot = 'time_in_am' | 'time_out_am' | 'time_in_pm' | 'time_out_pm';

/* ------------------------------------------------------------------ */
/*  Normalize PH phone numbers to E.164 (+63XXXXXXXXXX)                */
/* ------------------------------------------------------------------ */
function toE164(phone: string): string | null {
  const raw = phone.trim();
  if (/^\+63\d{10}$/.test(raw)) return raw;

  const digits = raw.replace(/\D/g, '');
  if (/^09\d{9}$/.test(digits)) return '+63' + digits.slice(1);
  if (/^9\d{9}$/.test(digits)) return '+63' + digits;
  if (/^63\d{10}$/.test(digits)) return '+' + digits;
  return null;
}

function buildMessage(slot: SmsSlot, name: string, time: string): string {
  const template = MESSAGES[slot] ?? MESSAGES.default;
  return template
    .replace(/\{name\}/g, name)
    .replace(/\{time\}/g, time);
}

/* ------------------------------------------------------------------ */
/*  Main entry — called from MonitoringPage after attendance is saved  */
/* ------------------------------------------------------------------ */
export async function sendAttendanceSMS(
  phone: string | null,
  studentName: string,
  slot: SmsSlot
): Promise<boolean> {
  if (!phone || !phone.trim()) {
    console.warn('SMS skipped: no phone number on file');
    return false;
  }
  if (!TEXTBEE_KEY) {
    console.warn('SMS skipped: VITE_TEXTBEE_API_KEY missing in .env');
    return false;
  }

  const recipient = toE164(phone);
  if (!recipient) {
    console.warn(`SMS skipped: cannot normalize "${phone}"`);
    return false;
  }

  const time = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const message = buildMessage(slot, studentName, time);

  try {
    const res = await fetch(TEXTBEE_URL, {
      method: 'POST',
      headers: {
        'x-api-key': TEXTBEE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipients: [recipient], message }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('TextBee error:', data);
      return false;
    }
    console.log(`SMS queued to ${recipient}:\n  "${message}"`);
    return true;
  } catch (err) {
    console.error('SMS network error:', err);
    return false;
  }
}