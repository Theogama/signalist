/**
 * Automation Rules API
 * Manage automation rules for bots
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { automationManager } from '@/lib/auto-trading/automation/AutomationManager';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const botId = request.nextUrl.searchParams.get('botId');
    if (!botId) {
      return NextResponse.json(
        { success: false, error: 'botId is required' },
        { status: 400 }
      );
    }

    const rules = automationManager.getRules(session.user.id, botId);

    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    console.error('Error fetching automation rules:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch rules' },
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

    const body = await request.json();
    const { botId, rule } = body;

    if (!botId || !rule) {
      return NextResponse.json(
        { success: false, error: 'botId and rule are required' },
        { status: 400 }
      );
    }

    const automationRule = {
      ...rule,
      id: rule.id || `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: session.user.id,
      botId,
    };

    automationManager.registerRule(automationRule);

    return NextResponse.json({
      success: true,
      rule: automationRule,
    });
  } catch (error: any) {
    console.error('Error saving automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save rule' },
      { status: 500 }
    );
  }
}

