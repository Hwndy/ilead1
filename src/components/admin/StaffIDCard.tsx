import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface StaffIDCardData {
  user_id: string;
  full_name: string;
  employee_id?: string | null;
  designation?: string | null;
  department?: string | null;
  photo_url?: string | null;
  phone?: string | null;
  blood_group?: string | null;
  date_of_joining?: string | null;
}

export interface StaffIDCardSchool {
  name: string;
  address?: string;
  phone?: string;
  logo_url?: string | null;
  motto?: string;
}

interface Props {
  staff: StaffIDCardData;
  school: StaffIDCardSchool;
  /** Deprecated  the card is now a single face. Kept for call-site compatibility. */
  showBack?: boolean;
}

const GREEN = '#141C2B';
const GREEN_DEEP = '#0b1220';
const LEMON = '#c6d92d';
const CHARCOAL = '#2f3130';
const INK = '#111111';
const CARD_W = 360;
const CARD_H = 605;

/** Single-face portrait staff ID card, matching the student card system. */
export const StaffIDCard: React.FC<Props> = ({ staff, school }) => {
  const [qrSrc, setQrSrc] = useState<string>('');
  const logoSrc = school.logo_url || '/ivintage_logo.png';

  useEffect(() => {
    const payload = staff.employee_id || staff.user_id;
    QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: INK, light: '#ffffff' },
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [staff]);

  const initials = staff.full_name
    .split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div
      id="staff-id-card"
      className="relative mx-auto overflow-hidden bg-white shadow-2xl"
      style={{
        width: CARD_W,
        height: CARD_H,
        borderRadius: 14,
        fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
        color: INK,
      }}
    >
      {/* background geometry */}
      <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(118deg, #ffffff 0%, #f4f6f4 42%, #eef2ee 62%, #ffffff 100%)' }} />
      <div aria-hidden className="absolute inset-x-0" style={{ top: '52%', bottom: 0, background: 'linear-gradient(180deg, rgba(10,107,57,0) 0%, rgba(10,107,57,0.10) 45%, rgba(10,107,57,0.05) 100%)' }} />
      <div aria-hidden className="absolute" style={{ top: 0, left: 0, width: 250, height: 52, background: CHARCOAL, clipPath: 'polygon(0 0, 100% 0, 78% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ top: 0, left: 118, width: 190, height: 34, background: LEMON, clipPath: 'polygon(28% 0, 100% 0, 72% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ top: 26, left: 26, width: 150, height: 20, background: GREEN, clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ top: 46, left: 0, width: 96, height: 5, background: LEMON }} />
      <div aria-hidden className="absolute" style={{ top: 22, right: 0, width: 172, height: 26, background: `repeating-linear-gradient(115deg, ${GREEN} 0 9px, transparent 9px 18px)` }} />
      <div aria-hidden className="absolute" style={{ bottom: 0, left: 0, width: 200, height: 62, background: GREEN, clipPath: 'polygon(0 40%, 62% 0, 100% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ bottom: 0, left: 74, width: 200, height: 48, background: CHARCOAL, clipPath: 'polygon(24% 0, 100% 62%, 100% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ bottom: 0, right: 0, width: 168, height: 56, background: LEMON, clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 0 100%)' }} />
      <div aria-hidden className="absolute" style={{ bottom: 0, right: 0, width: 84, height: 30, background: GREEN, clipPath: 'polygon(46% 0, 100% 0, 100% 100%, 0 100%)' }} />

      {/* header */}
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
          <p className="font-extrabold uppercase leading-tight" style={{ color: GREEN_DEEP, fontSize: 16, letterSpacing: -0.2 }}>
            {school.name}
          </p>
          <p className="font-bold uppercase" style={{ color: GREEN, fontSize: 9, marginTop: 3, letterSpacing: 1.4 }}>
            Staff Identity Card
          </p>
        </div>
      </div>

      {/* photo */}
      <div className="relative flex justify-center" style={{ marginTop: 20 }}>
        <div
          className="rounded-full overflow-hidden bg-white flex items-center justify-center"
          style={{ width: 210, height: 210, border: `4px solid ${GREEN_DEEP}` }}
        >
          {staff.photo_url ? (
            <img src={staff.photo_url} alt={staff.full_name} crossOrigin="anonymous" className="w-full h-full object-cover" />
          ) : (
            <span className="font-black" style={{ color: GREEN, fontSize: 64 }}>{initials}</span>
          )}
        </div>
      </div>

      {/* identity */}
      <div className="relative text-center px-4" style={{ marginTop: 16 }}>
        <p className="font-black uppercase leading-tight" style={{ fontSize: staff.full_name.length > 20 ? 19 : 24, letterSpacing: -0.5 }}>
          {staff.full_name}
        </p>
        <p style={{ fontSize: 14, marginTop: 2, letterSpacing: 0.3 }}>
          <span style={{ color: '#3f463f' }}>ID: </span>
          <span className="font-bold">{staff.employee_id || ''}</span>
        </p>
        {(staff.designation || staff.department) && (
          <p className="font-semibold uppercase" style={{ fontSize: 10, color: GREEN, marginTop: 3, letterSpacing: 1.2 }}>
            {[staff.designation, staff.department].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>

      {/* QR */}
      <div className="relative flex flex-col items-center" style={{ marginTop: 12 }}>
        <div className="bg-white" style={{ padding: 4 }}>
          {qrSrc && <img src={qrSrc} alt="Staff QR code" style={{ width: 116, height: 116, display: 'block' }} />}
        </div>
      </div>
    </div>
  );
};

export default StaffIDCard;