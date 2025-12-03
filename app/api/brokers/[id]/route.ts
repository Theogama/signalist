import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

// TODO: Replace with database
const brokersStore = new Map<string, any>();

/**
 * PUT /api/brokers/[id]
 * Update a broker connection
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const broker = brokersStore.get(id);
    if (!broker || broker.userId !== session.user.id) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    const body = await request.json();
    const updated = {
      ...broker,
      ...body,
      updatedAt: new Date(),
    };

    brokersStore.set(id, updated);

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error updating broker:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update broker' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/brokers/[id]
 * Delete a broker connection
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const broker = brokersStore.get(id);
    if (!broker || broker.userId !== session.user.id) {
      return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
    }

    brokersStore.delete(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting broker:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete broker' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';

