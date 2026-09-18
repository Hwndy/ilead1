import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Building2, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface BankAccount {
  bank_name: string;
  account_name: string;
  account_number: string;
}

export const DEFAULT_BANK_ACCOUNT: BankAccount = {
  bank_name: 'LOTUS BANK',
  account_name: 'IVINTAGE COLLEGE LTD',
  account_number: '1012157409',
};

/** Reads the school bank account from app_settings, falling back to the defaults. */
export const useBankAccount = () => {
  const [account, setAccount] = useState<BankAccount>(DEFAULT_BANK_ACCOUNT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['bank_name', 'bank_account_name', 'bank_account_number']);
      if (cancelled || !data?.length) return;
      const next = { ...DEFAULT_BANK_ACCOUNT };
      data.forEach((row: any) => {
        const value = String(row.setting_value ?? '').trim();
        if (!value) return;
        if (row.setting_key === 'bank_name') next.bank_name = value;
        if (row.setting_key === 'bank_account_name') next.account_name = value;
        if (row.setting_key === 'bank_account_number') next.account_number = value;
      });
      setAccount(next);
    })();
    return () => { cancelled = true; };
  }, []);

  return account;
};

interface Props {
  /** Amount to transfer, when known. */
  amount?: number;
  /** What the payer should quote as the transfer description. */
  reference?: string;
  className?: string;
  title?: string;
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(n || 0);

/** Bank transfer instructions shown wherever money is owed to the school. */
export const BankTransferDetails: React.FC<Props> = ({ amount, reference, className, title }) => {
  const account = useBankAccount();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyNumber = async () => {
    try {
      await navigator.clipboard.writeText(account.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Could not copy', description: account.account_number });
    }
  };

  return (
    <div className={`rounded-lg border bg-muted/50 p-4 space-y-3 ${className || ''}`}>
      <div className="flex items-center gap-2 font-semibold">
        <Building2 className="h-4 w-4 text-primary" />
        {title || 'Pay by bank transfer'}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-muted-foreground">Bank</p>
          <p className="font-medium">{account.bank_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Account name</p>
          <p className="font-medium">{account.account_name}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Account number</p>
          <div className="flex items-center gap-2">
            <p className="font-mono font-semibold tracking-wide">{account.account_number}</p>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={copyNumber} aria-label="Copy account number">
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {amount != null && amount > 0 && (
        <p className="text-sm">
          Amount to transfer: <span className="font-semibold">{NGN(amount)}</span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Please use {reference ? <span className="font-medium">{reference}</span> : "the pupil's name and admission number"} as the
        transfer description, then send your proof of payment to the school office. Your record is updated once the office confirms the transfer.
      </p>
    </div>
  );
};

export default BankTransferDetails;
