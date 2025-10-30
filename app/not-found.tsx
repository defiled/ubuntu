import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <Card className="mt-20">
        <CardHeader>
          <CardTitle className="text-2xl">404 - Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Link href="/wallet">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Wallet
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
