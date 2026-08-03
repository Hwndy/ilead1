import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildScanUrl } from '@/lib/scan-url';

export interface IDCardStudent {
  user_id: string;
  full_name: string;
  admission_number?: string | null;
  photo_url?: string | null;
  class_name?: string | null;
  date_of_birth?: string | null;
  blood_group?: string | null;
  emergency_contact?: string | null;
  session?: string | null;
  qr_token?: string | null;
}

export interface IDCardSchool {
  name: string;
  address?: string;
  logo_url?: string | null;
  motto?: string;
  phone?: string;
}

interface Props {
  student: IDCardStudent;
  school: IDCardSchool;
  /** Deprecated — the card is now a single face. Kept for call-site compatibility. */
  showBack?: boolean;
}

const GREEN = '#0a6b39';
const GREEN_DEEP = '#054027';
const LEMON = '#f2ec1f';
const CHARCOAL = '#2f3130';
const INK = '#111111';
const CARD_W = 360;
const CARD_H = 605;

/** Single-face portrait student ID card (54 x 85.6mm print ratio). */
export const StudentIDCard: React.FC<Props> = ({ student, school }) => {
  const [qrSrc, setQrSrc] = useState<string>('');
  const logoSrc = school.logo_url || '/ivintage_logo.png';

  useEffect(() => {
    const payload = student.qr_token
      ? buildScanUrl(student.qr_token)
      : (student.admission_number || student.user_id || '');
    QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: INK, light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [student]);

  const initials = student.full_name
    .split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div
      id="student-id-card"
      className="relative mx-auto overflow-hidden bg-white shadow-2xl"
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 14,
        fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
        color: INK,
      }}
    >
      {/* ---------- Background geometry ---------- */}
      {/* soft diagonal wash */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(118deg, #ffffff 0%, #f4f6f4 42%, #eef2ee 62%, #ffffff 100%)',
        }}
      />
      {/* faint campus band, lower half */}
      <div
        aria-hidden
        className="absolute inset-x-0"
        style={{
          top: '52%',
          bottom: 0,
          background: `linear-gradient(180deg, rgba(10,107,57,0) 0%, rgba(10,107,57,0.10) 45%, rgba(10,107,57,0.05) 100%)`,
        }}
      />

      {/* top-left charcoal wedge */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 0, left: 0, width: 250, height: 52,
          background: CHARCOAL,
          clipPath: 'polygon(0 0, 100% 0, 78% 100%, 0 100%)',
        }}
      />
      {/* lemon corner */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 0, left: 118, width: 190, height: 34,
          background: LEMON,
          clipPath: 'polygon(28% 0, 100% 0, 72% 100%, 0 100%)',
        }}
      />
      {/* green bar under the wedge */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 26, left: 26, width: 150, height: 20,
          background: GREEN,
          clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)',
        }}
      />
      {/* thin lemon rule */}
      <div aria-hidden className="absolute" style={{ top: 46, left: 0, width: 96, height: 5, background: LEMON }} />

      {/* diagonal stripe block, top-right */}
      <div
        aria-hidden
        className="absolute"
        style={{
          top: 22, right: 0, width: 172, height: 26,
          background: `repeating-linear-gradient(115deg, ${GREEN} 0 9px, transparent 9px 18px)`,
        }}
      />

      {/* bottom shapes */}
      <div
        aria-hidden
        className="absolute"
        style={{
          bottom: 0, left: 0, width: 200, height: 62,
          background: GREEN,
          clipPath: 'polygon(0 40%, 62% 0, 100% 100%, 0 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          bottom: 0, left: 74, width: 200, height: 48,
          background: CHARCOAL,
          clipPath: 'polygon(24% 0, 100% 62%, 100% 100%, 0 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          bottom: 0, right: 0, width: 168, height: 56,
          background: LEMON,
          clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />
      <div
        aria-hidden
        className="absolute"
        style={{
          bottom: 0, right: 0, width: 84, height: 30,
          background: GREEN,
          clipPath: 'polygon(46% 0, 100% 0, 100% 100%, 0 100%)',
        }}
      />

      {/* ---------- Header ---------- */}
      <div className="relative flex items-start gap-3 px-5" style={{ paddingTop: 62 }}>
        <img
          src={logoSrc}
          alt=""
          crossOrigin="anonymous"
          className="shrink-0 object-contain"
          style={{ width: 54, height: 60 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
        />
        <div className="min-w-0" style={{ paddingTop: 2 }}>
          <p
            className="font-extrabold uppercase leading-tight"
            style={{ color: GREEN_DEEP, fontSize: 16, letterSpacing: -0.2 }}
          >
            {school.name}
          </p>
          {school.address && (
            <p
              className="font-semibold leading-snug"
              style={{ color: GREEN, fontSize: 9.5, marginTop: 3 }}
            >
              {school.address}
            </p>
          )}
        </div>
      </div>

      {/* ---------- Photo ---------- */}
      <div className="relative flex justify-center" style={{ marginTop: 22 }}>
        <div
          className="rounded-full overflow-hidden bg-white flex items-center justify-center"
          style={{ width: 224, height: 224, border: `4px solid ${GREEN_DEEP}` }}
        >
          {student.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.full_name}
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="font-black" style={{ color: GREEN, fontSize: 68 }}>{initials}</span>
          )}
        </div>
      </div>

      {/* ---------- Identity ---------- */}
      <div className="relative text-center px-4" style={{ marginTop: 18 }}>
        <p
          className="font-black uppercase leading-tight"
          style={{ fontSize: student.full_name.length > 20 ? 20 : 25, letterSpacing: -0.5 }}
        >
          {student.full_name}
        </p>
        <p style={{ fontSize: 15, marginTop: 2, letterSpacing: 0.3 }}>
          <span style={{ color: '#3f463f' }}>ID: </span>
          <span className="font-bold">{student.admission_number || '—'}</span>
        </p>
      </div>

      {/* ---------- QR ---------- */}
      <div className="relative flex flex-col items-center" style={{ marginTop: 20 }}>
        <div className="bg-white" style={{ padding: 4 }}>
          {qrSrc && (
            <img src={qrSrc} alt="Student QR code" style={{ width: 132, height: 132, display: 'block' }} />
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentIDCard;