import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { validateRequest } from "@/lib/auth";

interface BrowserData {
  browser: string;
  count: number;
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100", 10)
    const offset = Number.parseInt(searchParams.get("offset") || "0", 10)

    // Validate pagination parameters
    if (limit < 1 || limit > 1000) {
      return NextResponse.json({
        success: false,
        error: "Limit must be between 1 and 1000"
      }, { status: 400 })
    }

    if (offset < 0) {
      return NextResponse.json({
        success: false,
        error: "Offset must be non-negative"
      }, { status: 400 })
    }

    // Query to get unique browsers per device_id
    const [results] = await pool.query<RowDataPacket[]>(`
      SELECT DISTINCT device_id, browser
      FROM credentials
      WHERE browser IS NOT NULL AND browser != ''
      ORDER BY device_id, browser
    `);

    if (!Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 500 });
    }

    // Process and normalize browser names
    const browserCounts: { [key: string]: number } = {};
    
    results.forEach((row) => {
      const originalBrowser = row.browser;
      if (!originalBrowser) return;

      // Normalize browser name
      let normalizedBrowser = originalBrowser
        .toLowerCase()
        .replace(/\s*\([^)]*\)/g, '') // Remove version info in parentheses
        .replace(/\s*profile\s*\d*/gi, '') // Remove "Profile X"
        .replace(/\s*default/gi, '') // Remove "Default"
        .replace(/\s*\([^)]*\)/g, '') // Remove any remaining parentheses content
        .trim();

      // Map common browser names
      if (normalizedBrowser.includes('chrome') && !normalizedBrowser.includes('chromium')) {
        normalizedBrowser = 'Google Chrome';
      } else if (normalizedBrowser.includes('edge') || normalizedBrowser.includes('microsoft')) {
        normalizedBrowser = 'Microsoft Edge';
      } else if (normalizedBrowser.includes('firefox') || normalizedBrowser.includes('mozilla')) {
        normalizedBrowser = 'Mozilla Firefox';
      } else if (normalizedBrowser.includes('safari')) {
        normalizedBrowser = 'Safari';
      } else if (normalizedBrowser.includes('opera')) {
        normalizedBrowser = 'Opera';
      } else if (normalizedBrowser.includes('brave')) {
        normalizedBrowser = 'Brave';
      } else if (normalizedBrowser.includes('chromium')) {
        normalizedBrowser = 'Chromium';
      } else {
        // Capitalize first letter of each word for unknown browsers
        normalizedBrowser = normalizedBrowser
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      // Count unique browsers per device
      if (normalizedBrowser) {
        browserCounts[normalizedBrowser] = (browserCounts[normalizedBrowser] || 0) + 1;
      }
    });

    // Convert to array and sort by count
    const allBrowsers: BrowserData[] = Object.entries(browserCounts)
      .map(([browser, count]) => ({ browser, count }))
      .sort((a, b) => b.count - a.count)

    const total = allBrowsers.length

    // Apply pagination
    const browserAnalysis = allBrowsers.slice(offset, offset + limit)

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      browserAnalysis
    });

  } catch (error) {
    console.error("Browser analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
} 