// Mock user balance for demo
// In production, this would query a real database or API

export async function getUserBalance(userId: string): Promise<number> {
  // All users have $10,000 for demo purposes
  return 10000;
}

export async function deductBalance(userId: string, amount: number): Promise<void> {
  // In production, this would update the database
  console.log(`[MOCK] Deducting $${amount} from user ${userId}`);
}
