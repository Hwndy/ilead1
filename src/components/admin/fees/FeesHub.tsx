import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeeOverview } from './FeeOverview';
import { FeeStructures } from './FeeStructures';
import { StudentBalances } from './StudentBalances';
import { InstallmentPlans } from './InstallmentPlans';
import { PaymentsList } from './PaymentsList';
import { RemindersPanel } from './RemindersPanel';
import { FeeReceiptGenerator } from '@/components/admin/FeeReceiptGenerator';
import { BillingRules } from './BillingRules';
import { InvoicesPanel } from './InvoicesPanel';

export const FeesHub: React.FC = () => {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <div className="overflow-x-auto">
        <TabsList className="flex w-max min-w-full h-auto gap-1 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="structures">Fee Structures</TabsTrigger>
          <TabsTrigger value="rules">Fee Rules</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="balances">Student Balances</TabsTrigger>
          <TabsTrigger value="plans">Installment Plans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="overview"><FeeOverview /></TabsContent>
      <TabsContent value="structures"><FeeStructures /></TabsContent>
      <TabsContent value="rules"><BillingRules /></TabsContent>
      <TabsContent value="invoices"><InvoicesPanel /></TabsContent>
      <TabsContent value="balances"><StudentBalances /></TabsContent>
      <TabsContent value="plans"><InstallmentPlans /></TabsContent>
      <TabsContent value="payments"><PaymentsList /></TabsContent>
      <TabsContent value="receipts"><FeeReceiptGenerator /></TabsContent>
      <TabsContent value="reminders"><RemindersPanel /></TabsContent>
    </Tabs>
  );
};