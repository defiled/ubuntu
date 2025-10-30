'use client';

import { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { TerminalCard, TerminalCardContent, TerminalCardHeader, TerminalCardTitle } from '@/components/ui/terminal-card';
import { formatTime, formatCurrency } from '@/lib/utils';
import { CheckCircle2, Clock, XCircle, Loader2 } from 'lucide-react';

interface PaymentContext {
  id: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
}

interface Event {
  id: string;
  eventType: string;
  status: string;
  metadata: any;
  timestamp: string;
  payment: PaymentContext;
}

interface EventLogProps {
  userId: string;
}

export function EventLog({ userId }: EventLogProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/events/user/${userId}`);

    eventSource.addEventListener('user.event', (e) => {
      const event = JSON.parse(e.data);
      setEvents((prev) => {
        // Avoid duplicates
        if (prev.some((p) => p.id === event.id)) {
          return prev;
        }
        // Add new event at the beginning (newest first)
        return [event, ...prev];
      });
    });

    eventSource.onerror = () => {
      setError('Connection lost. Attempting to reconnect...');
      eventSource.close();
      // Reconnect after 2 seconds
      setTimeout(() => {
        setError(null);
        window.location.reload();
      }, 2000);
    };

    return () => {
      eventSource.close();
    };
  }, [userId]);

  // Auto-scroll to top when new events arrive (since newest first)
  useEffect(() => {
    if (scrollRef.current && events.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  const getEventIcon = (status: string) => {
    if (status.includes('COMPLETED')) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    }
    if (status.includes('FAILED')) {
      return <XCircle className="w-5 h-5 text-destructive" />;
    }
    if (status.includes('PENDING')) {
      return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
    }
    return <Clock className="w-5 h-5 text-muted-foreground" />;
  };

  const getEventBadgeVariant = (status: string) => {
    if (status.includes('COMPLETED')) return 'success';
    if (status.includes('FAILED')) return 'destructive';
    if (status.includes('PENDING')) return 'pending';
    return 'secondary';
  };

  const formatEventType = (eventType: string) => {
    return eventType
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Group events by payment ID
  const groupedEvents = events.reduce((acc, event) => {
    const paymentId = event.payment.id;
    if (!acc[paymentId]) {
      acc[paymentId] = {
        payment: event.payment,
        events: [],
      };
    }
    acc[paymentId].events.push(event);
    return acc;
  }, {} as Record<string, { payment: PaymentContext; events: Event[] }>);

  // Get payment groups sorted by most recent activity
  const paymentGroups = Object.values(groupedEvents).sort((a, b) => {
    const aLatest = new Date(a.events[0].timestamp).getTime();
    const bLatest = new Date(b.events[0].timestamp).getTime();
    return bLatest - aLatest; // Newest first
  });

  return (
    <TerminalCard className="terminal-glow">
      <TerminalCardHeader className="border-b border-primary/30">
        <div className="flex items-center justify-between">
          <TerminalCardTitle>Activity Feed</TerminalCardTitle>
          {events.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono text-primary">
              <div className="w-2 h-2 rounded-full bg-primary pulse-green"></div>
              <span>LIVE</span>
            </div>
          )}
        </div>
      </TerminalCardHeader>
      <TerminalCardContent className="pt-4">
        {error && (
          <div className="mb-4 p-3 rounded-sm border border-yellow-500/50 bg-yellow-500/10 text-yellow-500 text-sm font-mono">
            {'[WARNING] '}{error}
          </div>
        )}

        <div
          ref={scrollRef}
          className="space-y-4 font-mono text-sm bg-black/30 p-4 rounded-sm min-h-[300px] max-h-[500px] overflow-y-auto"
        >
          {events.length === 0 ? (
            <div className="text-center py-12 text-primary/60">
              <p className="text-xs">{'> '}No transactions yet</p>
              <p className="text-xs mt-2 text-muted-foreground">Send money to see activity</p>
            </div>
          ) : (
            paymentGroups.map((group) => (
              <div key={group.payment.id} className="border border-primary/20 rounded-sm bg-black/20 p-3">
                {/* Payment Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-primary/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(group.payment.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="text-primary font-bold">
                      {formatCurrency(parseFloat(group.payment.amount))}
                    </span>
                    <span className="text-primary/60">→</span>
                    <span className="text-primary/80">{group.payment.currency}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-sm ${
                    group.payment.status === 'COMPLETED'
                      ? 'bg-primary/20 text-primary'
                      : group.payment.status === 'FAILED'
                      ? 'bg-destructive/20 text-destructive'
                      : 'bg-primary/10 text-primary/70'
                  }`}>
                    {group.payment.status}
                  </span>
                </div>

                {/* Events for this payment */}
                <div className="space-y-1">
                  {group.events.map((event, index) => (
                    <div key={event.id} className="flex items-start gap-2 py-1">
                      {event.status.includes('COMPLETED') && (
                        <span className="text-primary text-xs">✓</span>
                      )}
                      {event.status.includes('PENDING') && index === 0 && (
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                      )}
                      {event.status.includes('FAILED') && (
                        <span className="text-destructive text-xs">✗</span>
                      )}

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${
                            event.status.includes('COMPLETED') ? 'text-primary' :
                            event.status.includes('PENDING') ? 'text-primary/70' :
                            event.status.includes('FAILED') ? 'text-destructive' :
                            'text-muted-foreground'
                          }`}>
                            {formatEventType(event.eventType)}
                          </span>
                        </div>

                        {event.metadata && Object.keys(event.metadata).length > 0 && (
                          <div className="mt-1 pl-3 text-xs text-muted-foreground">
                            {Object.entries(event.metadata).map(([key, value]) => (
                              <div key={key}>
                                {'> '}{key}: <span className="text-primary/60">{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </TerminalCardContent>
    </TerminalCard>
  );
}
