/**
 * Toggle Automation Rule API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { automationManager } from '@/lib/auto-trading/automation/AutomationManager';

export async function POST(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { enabled } = body;

    automationManager.toggleRule(params.ruleId, enabled);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error toggling automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle rule' },
      { status: 500 }
    );
  }
}

