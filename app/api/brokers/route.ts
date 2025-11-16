import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';

// TODO: Create Broker model
// For now, using a simple in-memory store (replace with database)
const brokersStore = new Map<string, any>();

/**
 * GET /api/brokers
 * Get all brokers for the current user
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Fetch from database
    const userBrokers = Array.from(brokersStore.values()).filter(
      (b) => b.userId === session.user.id
    );

    return NextResponse.json(userBrokers);
  } catch (error: any) {
    console.error('Error fetching brokers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch brokers' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/brokers
 * Create a new broker connection
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, apiKey, apiSecret, apiPassphrase, sandbox, enabled } = body;

    if (!name || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const brokerId = randomUUID();
    const broker = {
      id: brokerId,
      userId: session.user.id,
      name,
      type: type || 'crypto',
      apiKey, // TODO: Encrypt this
      apiSecret, // TODO: Encrypt this
      apiPassphrase: apiPassphrase || undefined,
      sandbox: sandbox !== false,
      enabled: enabled === true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Save to database
    brokersStore.set(brokerId, broker);

    return NextResponse.json(broker, { status: 201 });
  } catch (error: any) {
    console.error('Error creating broker:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create broker' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

