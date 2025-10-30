#!/usr/bin/env tsx

// Main worker process that starts all workers
import './payment-processor';
import './webhook-delivery';

console.log('🎯 All workers started successfully!');
console.log('Press Ctrl+C to stop workers');
