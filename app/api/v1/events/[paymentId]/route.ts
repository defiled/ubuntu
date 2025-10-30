import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  const encoder = new TextEncoder();
  const paymentId = params.paymentId;

  // Verify payment exists
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return new Response(
      JSON.stringify({
        error: 'Payment not found',
        message: `No payment found with ID: ${paymentId}`,
      }),
      {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial events
      const events = await prisma.event.findMany({
        where: { paymentId },
        orderBy: { timestamp: 'asc' },
      });

      for (const event of events) {
        const data = {
          id: event.id,
          eventType: event.eventType,
          status: event.status,
          metadata: event.metadata,
          timestamp: event.timestamp.toISOString(),
        };

        controller.enqueue(
          encoder.encode(`event: payment.event\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      // Poll for new events every 500ms
      let lastTimestamp = events.length > 0 ? events[events.length - 1].timestamp : new Date(0);

      const pollInterval = setInterval(async () => {
        try {
          const newEvents = await prisma.event.findMany({
            where: {
              paymentId,
              timestamp: { gt: lastTimestamp },
            },
            orderBy: { timestamp: 'asc' },
          });

          for (const event of newEvents) {
            const data = {
              id: event.id,
              eventType: event.eventType,
              status: event.status,
              metadata: event.metadata,
              timestamp: event.timestamp.toISOString(),
            };

            controller.enqueue(
              encoder.encode(`event: payment.event\ndata: ${JSON.stringify(data)}\n\n`)
            );

            lastTimestamp = event.timestamp;
          }

          // Check if payment is in terminal state
          const currentPayment = await prisma.payment.findUnique({
            where: { id: paymentId },
            select: { status: true },
          });

          if (
            currentPayment &&
            (currentPayment.status === 'COMPLETED' || currentPayment.status === 'FAILED')
          ) {
            // Send close event
            controller.enqueue(
              encoder.encode(
                `event: payment.complete\ndata: ${JSON.stringify({ status: currentPayment.status })}\n\n`
              )
            );
            clearInterval(pollInterval);
            controller.close();
          }
        } catch (error) {
          console.error('Error polling for events:', error);
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
