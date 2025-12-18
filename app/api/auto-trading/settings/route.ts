/**
 * Auto-Trade Settings API
 * GET: Retrieve user's auto-trade settings
 * POST: Save/update auto-trade settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

// In-memory storage for now - replace with database in production
const userSettings = new Map<string, any>();

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const settings = userSettings.get(userId) || null;

    return NextResponse.json({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Error fetching auto-trade settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await request.json();
    const settings = {
      ...body,
      userId,
      updatedAt: new Date().toISOString(),
    };

    // Save settings (in-memory for now - replace with database)
    userSettings.set(userId, settings);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      data: settings,
    });
  } catch (error: any) {
    console.error('Error saving auto-trade settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}




