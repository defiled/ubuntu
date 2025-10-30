'use client';

import { useState, useEffect } from 'react';
import { PaymentForm } from '@/components/wallet/PaymentForm';
import { EventLog } from '@/components/wallet/EventLog';
import { TerminalCard, TerminalCardContent, TerminalCardHeader, TerminalCardTitle } from '@/components/ui/terminal-card';
import { formatCurrency } from '@/lib/utils';

export default function WalletPage() {
  const balance = 10000; // Mock balance
  const userId = 'user_001'; // Mock user ID (in production, would come from auth)
  const [currentTime, setCurrentTime] = useState<string>('');

  // Set timestamp on client side only to avoid hydration mismatch
  useEffect(() => {
    setCurrentTime(new Date().toISOString());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Terminal Header */}
      <div className="border-b border-border/50 bg-muted/20 px-6 py-4">
        <div className="container mx-auto max-w-7xl">
          <div className="font-mono">
            <div className="text-xs text-muted-foreground mb-2">
              [SYSTEM ONLINE] {currentTime || '...'}{' '}
            </div>
            <h1 className="text-2xl font-bold text-primary terminal-text">
              ╔═══════════════════════════════════════╗
            </h1>
            <h1 className="text-2xl font-bold text-primary terminal-text pl-2">
              ║  CROSS-BORDER PAYMENT TERMINAL  ║
            </h1>
            <h1 className="text-2xl font-bold text-primary terminal-text">
              ╚═══════════════════════════════════════╝
            </h1>
            <p className="text-xs text-muted-foreground mt-2">
              {'> '}Secure • Instant • Global
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Balance Display */}
        <TerminalCard className="mb-6">
          <TerminalCardHeader>
            <TerminalCardTitle>Account Balance</TerminalCardTitle>
          </TerminalCardHeader>
          <TerminalCardContent className="pt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-primary/60 text-sm font-mono">$</span>
              <span className="text-4xl font-bold font-mono terminal-text">
                {balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-muted-foreground text-sm font-mono">USD</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground font-mono">
              [AVAILABLE] Ready for transfer
            </div>
          </TerminalCardContent>
        </TerminalCard>

        {/* Payment Form */}
        <PaymentForm
          balance={balance}
          onPaymentCreated={(id) => {
            // Payment created, activity feed will automatically pick it up via SSE
          }}
        />

        {/* Activity Feed - Always Visible */}
        <div className="mt-6">
          <EventLog userId={userId} />
        </div>
      </div>
    </div>
  );
}
