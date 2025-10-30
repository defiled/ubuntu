'use client';

import { useState, useEffect } from 'react';
import { TerminalCard, TerminalCardContent, TerminalCardDescription, TerminalCardHeader, TerminalCardTitle } from '@/components/ui/terminal-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CORRIDORS, SupportedCurrency, formatDestinationAmount } from '@/mocks/config/corridors';
import { formatCurrency } from '@/lib/utils';

interface PaymentFormProps {
  balance: number;
  onPaymentCreated?: (paymentId: string) => void;
}

export function PaymentForm({ balance, onPaymentCreated }: PaymentFormProps) {
  const [amount, setAmount] = useState<string>('100');
  const [currency, setCurrency] = useState<SupportedCurrency>('MXN');
  const [method, setMethod] = useState<'ach' | 'card'>('ach');
  const [feeHandling, setFeeHandling] = useState<'inclusive' | 'additive'>('inclusive');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Auto-detect fee handling based on balance
  useEffect(() => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount > 0) {
      // If balance >= amount, use additive (user can afford to pay extra)
      // If balance < amount, use inclusive (deduct fees from amount)
      setFeeHandling(balance >= numAmount ? 'additive' : 'inclusive');
    }
  }, [amount, balance]);

  // Fetch quote when inputs change
  useEffect(() => {
    const fetchQuote = async () => {
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 10 || numAmount > 10000) {
        setQuote(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/v1/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: numAmount,
            destination_currency: currency,
            payment_method: method,
            fee_handling: feeHandling,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch quote');
        }

        const data = await response.json();
        setQuote(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch quote');
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, currency, method, feeHandling]);

  const handleSendPayment = async () => {
    if (!quote) return;

    setProcessing(true);
    setError(null);

    try {
      // Step 1: Initiate payment
      const initiateResponse = await fetch('/api/v1/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          quote_id: quote.quote_id,
          amount: parseFloat(amount),
          destination_currency: currency,
          payment_method: method,
          fee_handling: feeHandling,
        }),
      });

      if (!initiateResponse.ok) {
        const errorData = await initiateResponse.json();
        throw new Error(errorData.message || 'Failed to initiate payment');
      }

      const initiateData = await initiateResponse.json();

      // Step 2: Confirm payment
      const confirmResponse = await fetch('/api/v1/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          payment_id: initiateData.payment_id,
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(errorData.message || 'Failed to confirm payment');
      }

      // Notify parent to show event stream
      onPaymentCreated?.(initiateData.payment_id);
      setProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process payment');
      setProcessing(false);
    }
  };

  return (
    <TerminalCard>
      <TerminalCardHeader>
        <TerminalCardTitle>Initiate Transfer</TerminalCardTitle>
        <TerminalCardDescription>Configure cross-border payment parameters</TerminalCardDescription>
      </TerminalCardHeader>
      <TerminalCardContent className="pt-4">
        {/* Two Column Layout: Form Inputs + Quote Summary */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column: Form Inputs */}
          <div className="space-y-6">
        {/* Amount Input */}
        <div className="space-y-2">
          <Label htmlFor="amount" className="text-xs font-mono text-muted-foreground uppercase">
            [AMOUNT] USD
          </Label>
          <Input
            id="amount"
            type="number"
            min="10"
            max="10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            className="font-mono text-lg border-primary/30 focus:border-primary bg-background/50"
          />
          <p className="text-xs text-muted-foreground font-mono">
            {'> '}Limits: $10.00 - $10,000.00
          </p>
        </div>

        {/* Currency Selector */}
        <div className="space-y-2">
          <Label htmlFor="currency" className="text-xs font-mono text-muted-foreground uppercase">
            [DESTINATION] Currency
          </Label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as SupportedCurrency)}
            className="flex h-10 w-full rounded-md border border-primary/30 bg-background/50 px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            {Object.entries(CORRIDORS).map(([code, info]) => (
              <option key={code} value={code}>
                {info.flag} {info.name} ({code})
              </option>
            ))}
          </select>
        </div>

        {/* Payment Method */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-muted-foreground uppercase">
            [METHOD] Payment Source
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod('ach')}
              className={`p-3 rounded-sm border transition-colors font-mono text-sm ${
                method === 'ach'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/30 hover:border-primary/60 text-muted-foreground'
              }`}
            >
              <div className="font-bold">ACH BANK</div>
              <div className="text-xs mt-1">Free • {formatCurrency(balance)}</div>
            </button>
            <button
              onClick={() => setMethod('card')}
              className={`p-3 rounded-sm border transition-colors font-mono text-sm ${
                method === 'card'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/30 hover:border-primary/60 text-muted-foreground'
              }`}
            >
              <div className="font-bold">CARD</div>
              <div className="text-xs mt-1">+2.9% fee</div>
            </button>
          </div>
        </div>

        {/* Execute Button - Left Column */}
        <Button
          onClick={handleSendPayment}
          disabled={!quote || loading || processing}
          className="w-full font-mono text-base uppercase font-bold terminal-glow"
          size="lg"
        >
          {processing ? '⟳ PROCESSING...' : `⚡ EXECUTE TRANSFER`}
        </Button>

        {error && (
          <div className="rounded-sm border border-destructive/50 bg-destructive/10 text-destructive p-3 text-sm font-mono">
            {'[ERROR] '}{error}
          </div>
        )}
          </div>

          {/* Right Column: Quote Summary */}
          <div className="space-y-4">
        {/* Fee Handling - Auto-selected with manual override */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-muted-foreground uppercase">
            [FEE MODE] Calculation Type
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setFeeHandling('inclusive')}
              className={`p-3 rounded-sm border transition-colors font-mono text-sm ${
                feeHandling === 'inclusive'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/30 hover:border-primary/60 text-muted-foreground'
              }`}
            >
              <div className="font-bold">DEDUCT FEES</div>
              <div className="text-xs mt-1">From amount</div>
            </button>
            <button
              onClick={() => setFeeHandling('additive')}
              className={`p-3 rounded-sm border transition-colors font-mono text-sm ${
                feeHandling === 'additive'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-primary/30 hover:border-primary/60 text-muted-foreground'
              }`}
            >
              <div className="font-bold">ADD FEES</div>
              <div className="text-xs mt-1">On top</div>
            </button>
          </div>
        </div>

        {/* Quote Display - Always rendered to prevent FOUC */}
        <div className="rounded-sm border border-primary/30 bg-muted/30 p-4 space-y-2 font-mono text-sm">
          <div className="text-xs text-muted-foreground uppercase mb-3">
            {loading ? '[CALCULATING QUOTE...]' : '[QUOTE CALCULATED]'}
          </div>

          {loading ? (
            // Skeleton loader
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-primary/10 rounded w-3/4"></div>
              <div className="h-4 bg-primary/10 rounded w-1/2"></div>
              <div className="h-4 bg-primary/10 rounded w-2/3"></div>
              <div className="h-px bg-border/50 my-3"></div>
              <div className="h-6 bg-primary/10 rounded w-full"></div>
            </div>
          ) : quote ? (
            // Actual quote data
            <>

            {/* Fee Breakdown */}
            <div className="space-y-1 text-xs">
              <div className="text-muted-foreground mb-2">Fee Breakdown:</div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground">
                  ├─ Onramp ({method === 'ach' ? 'ACH' : 'Card'}):
                </span>
                <span>
                  {formatCurrency(quote.breakdown.fees.onramp)}
                  {method === 'ach' && <span className="text-primary/60"> (Free)</span>}
                  {method === 'card' && <span className="text-primary/60"> (2.9%)</span>}
                </span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground">
                  ├─ Corridor ({currency}):
                </span>
                <span>
                  {formatCurrency(quote.breakdown.fees.corridor)}
                  <span className="text-primary/60"> ({CORRIDORS[currency].fee_percent}%)</span>
                </span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground">├─ Platform:</span>
                <span>
                  {formatCurrency(quote.breakdown.fees.platform)}
                  <span className="text-primary/60"> ($2.99+0.5%)</span>
                </span>
              </div>
              <div className="flex justify-between pl-3">
                <span className="text-muted-foreground">└─ Network Gas:</span>
                <span>{formatCurrency(quote.breakdown.fees.network_gas)}</span>
              </div>
            </div>

            <div className="h-px bg-border/50 my-3" />

            <div className="flex justify-between font-bold">
              <span className="text-primary">Total Fees:</span>
              <span className="text-primary">{formatCurrency(quote.breakdown.fees.total)}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">You Send (USDC):</span>
              <span className="font-bold">{formatCurrency(quote.breakdown.usdc_sent)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Exchange Rate:</span>
              <span className="font-bold">{quote.exchange_rate.toFixed(4)} {currency}/USD</span>
            </div>

            <div className="h-px bg-border/50 my-3" />

            <div className="flex justify-between items-center pt-1">
              <span className="text-primary">Recipient Gets:</span>
              <span className="text-xl font-bold text-primary terminal-text">
                {formatDestinationAmount(quote.breakdown.destination_amount, currency)}
              </span>
            </div>
            </>
          ) : (
            // Empty state
            <div className="text-center py-6 text-muted-foreground text-xs">
              {'> '}Enter amount to calculate quote
            </div>
          )}
        </div>
          </div>
        </div>
      </TerminalCardContent>
    </TerminalCard>
  );
}
