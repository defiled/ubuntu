import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EventLog } from '@/components/wallet/EventLog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CORRIDORS } from '@/mocks/config/corridors';

export default async function PaymentDetailPage({
  params,
}: {
  params: { paymentId: string };
}) {
  const payment = await prisma.payment.findUnique({
    where: { id: params.paymentId },
  });

  if (!payment) {
    notFound();
  }

  const getStatusBadge = (status: string) => {
    if (status === 'COMPLETED') return <Badge variant="success">Completed</Badge>;
    if (status === 'FAILED') return <Badge variant="destructive">Failed</Badge>;
    if (status.includes('PENDING')) return <Badge variant="pending">Processing</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  };

  const currencyInfo = CORRIDORS[payment.destCurrency as keyof typeof CORRIDORS];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/wallet">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Wallet
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Payment Details</h1>
            <p className="text-muted-foreground font-mono text-sm">{payment.id}</p>
          </div>
          {getStatusBadge(payment.status)}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Fee Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Fee Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Input Amount:</span>
              <span className="font-medium">{formatCurrency(parseFloat(payment.amount.toString()))}</span>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Onramp Fee:</span>
                <span>{formatCurrency(parseFloat(payment.onrampFee.toString()))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Corridor Fee:</span>
                <span>{formatCurrency(parseFloat(payment.corridorFee.toString()))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee:</span>
                <span>{formatCurrency(parseFloat(payment.platformFee.toString()))}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network Gas:</span>
                <span>{formatCurrency(parseFloat(payment.networkGas.toString()))}</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between text-sm font-medium">
              <span>Total Fees:</span>
              <span>{formatCurrency(parseFloat(payment.totalFees.toString()))}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">USDC Sent:</span>
              <span className="font-medium">{formatCurrency(parseFloat(payment.usdcSent.toString()))}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exchange Rate:</span>
              <span className="font-medium">
                1 USD = {parseFloat(payment.exchangeRate.toString()).toFixed(4)} {payment.destCurrency}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between items-center pt-2">
              <span className="font-medium">Recipient Gets:</span>
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {currencyInfo.symbol}
                  {parseFloat(payment.destAmount.toString()).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">{currencyInfo.name}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <div>{getStatusBadge(payment.status)}</div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground mb-1">Fee Handling</div>
              <Badge variant="outline">{payment.feeHandling}</Badge>
            </div>

            {payment.onrampTxId && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Onramp Transaction</div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{payment.onrampTxId}</code>
              </div>
            )}

            {payment.offrampTxId && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Offramp Transaction</div>
                <code className="text-xs bg-muted px-2 py-1 rounded">{payment.offrampTxId}</code>
              </div>
            )}

            <Separator />

            <div>
              <div className="text-sm text-muted-foreground mb-1">Created</div>
              <div className="text-sm">{formatDate(payment.createdAt)}</div>
            </div>

            {payment.completedAt && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Completed</div>
                <div className="text-sm">{formatDate(payment.completedAt)}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Log */}
        <div className="lg:col-span-2">
          <EventLog paymentId={payment.id} />
        </div>
      </div>
    </div>
  );
}
