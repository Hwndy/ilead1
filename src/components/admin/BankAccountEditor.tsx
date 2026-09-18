import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import { DEFAULT_BANK_ACCOUNT } from '@/components/shared/BankTransferDetails';

/**
 * School bank account shown to parents and applicants. All fee payments are made
 * by transfer to this account and recorded by the office.
 */
export const BankAccountEditor: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankName, setBankName] = useState(DEFAULT_BANK_ACCOUNT.bank_name);
  const [accountName, setAccountName] = useState(DEFAULT_BANK_ACCOUNT.account_name);
  const [accountNumber, setAccountNumber] = useState(DEFAULT_BANK_ACCOUNT.account_number);
  const [financeCode, setFinanceCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['bank_name', 'bank_account_name', 'bank_account_number']);
      data?.forEach((row: any) => {
        const value = String(row.setting_value ?? '').trim();
        if (!value) return;
        if (row.setting_key === 'bank_name') setBankName(value);
        if (row.setting_key === 'bank_account_name') setAccountName(value);
        if (row.setting_key === 'bank_account_number') setAccountNumber(value);
      });
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!bankName.trim() || !accountName.trim() || !/^\d{10}$/.test(accountNumber.trim())) {
      toast({
        title: 'Check the details',
        description: 'Bank, account name and a 10-digit account number are required.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('app_settings').upsert(
        [
          { setting_key: 'bank_name', setting_value: bankName.trim() as any },
          { setting_key: 'bank_account_name', setting_value: accountName.trim() as any },
          { setting_key: 'bank_account_number', setting_value: accountNumber.trim() as any },
        ],
        { onConflict: 'setting_key' }
      );
      if (error) throw error;
      toast({ title: 'Saved', description: 'Bank account updated.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School Bank Account</CardTitle>
        <CardDescription>
          Shown to parents and applicants wherever a payment is due. All payments are made by transfer and recorded by the office.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="space-y-2">
          <Label htmlFor="bank-name">Bank</Label>
          <Input id="bank-name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-name">Account Name</Label>
          <Input id="account-name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-number">Account Number</Label>
          <Input
            id="account-number"
            inputMode="numeric"
            maxLength={10}
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Account
        </Button>
      </CardContent>
    </Card>
  );
};

export default BankAccountEditor;
