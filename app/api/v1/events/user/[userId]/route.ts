import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const encoder = new TextEncoder();
  const userId = params.userId;

  // Verify user has payments
  const userPayments = await prisma.payment.findMany({
    where: { userId },
    select: {
      id: true,
      amount: true,
      destCurrency: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Fetch all events for all user's payments
      const allEvents = await prisma.event.findMany({
        where: {
          paymentId: {
            in: userPayments.map(p => p.id),
          },
        },
        include: {
          payment: {
            select: {
              id: true,
              amount: true,
              destCurrency: true,
              status: true,
              createdAt: true,
            },
          },
        },
        orderBy: { timestamp: 'desc' }, // Newest first for activity feed
      });

      // Send initial events with payment context
      for (const event of allEvents) {
        const data = {
          id: event.id,
          eventType: event.eventType,
          status: event.status,
          metadata: event.metadata,
          timestamp: event.timestamp.toISOString(),
          // Include payment context
          payment: {
            id: event.payment.id,
            amount: event.payment.amount.toString(),
            currency: event.payment.destCurrency,
            status: event.payment.status,
            createdAt: event.payment.createdAt.toISOString(),
          },
        };

        controller.enqueue(
          encoder.encode(`event: user.event\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Poll for new events across all user payments every 500ms
      let lastTimestamp = allEvents.length > 0 ? allEvents[0].timestamp : new Date(0);

      const pollInterval = setInterval(async () => {
        try {
          // Get updated list of user's payments (in case new payments created)
          const currentPayments = await prisma.payment.findMany({
            where: { userId },
            select: { id: true },
          });

          const newEvents = await prisma.event.findMany({
            where: {
              paymentId: {
                in: currentPayments.map(p => p.id),
              },
              timestamp: { gt: lastTimestamp },
            },
            include: {
              payment: {
                select: {
                  id: true,
                  amount: true,
                  destCurrency: true,
                  status: true,
                  createdAt: true,
                },
              },
            },
            orderBy: { timestamp: 'asc' }, // For polling, get chronological order
          });

          for (const event of newEvents) {
            const data = {
              id: event.id,
              eventType: event.eventType,
              status: event.status,
              metadata: event.metadata,
              timestamp: event.timestamp.toISOString(),
              payment: {
                id: event.payment.id,
                amount: event.payment.amount.toString(),
                currency: event.payment.destCurrency,
                status: event.payment.status,
                createdAt: event.payment.createdAt.toISOString(),
              },
            };

            controller.enqueue(
              encoder.encode(`event: user.event\ndata: ${JSON.stringify(data)}\n\n`)
            );

            lastTimestamp = event.timestamp;
          }
        } catch (error) {
          console.error('Error polling for user events:', error);
        }
      }, 500);

      // Handle client disconnect
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
