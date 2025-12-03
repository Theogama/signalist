/**
 * Automation Rule Management API
 * Delete and toggle automation rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { automationManager } from '@/lib/auto-trading/automation/AutomationManager';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ruleId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { ruleId } = await params;
    automationManager.removeRule(ruleId);

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete rule' },
      { status: 500 }
    );
  }
}

