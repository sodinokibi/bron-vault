import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import { validateRequest } from "@/lib/auth";

interface SoftwareData {
  software_name: string;
  version: string | null;
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

    // Get total count for pagination
    const [countResult] = await pool.query<RowDataPacket[]>(`
      SELECT COUNT(DISTINCT CONCAT(software_name, '|', COALESCE(version, ''))) as total
      FROM software
      WHERE software_name IS NOT NULL AND software_name != ''
    `)
    const total = countResult[0]?.total || 0

    // Query to get software grouped by name and version for attack surface management
    const [results] = await pool.query<RowDataPacket[]>(`
      SELECT software_name, version, COUNT(DISTINCT device_id) as count
      FROM software
      WHERE software_name IS NOT NULL AND software_name != ''
      GROUP BY software_name, version
      ORDER BY count DESC, software_name, version
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    if (!Array.isArray(results)) {
      return NextResponse.json({ success: false, error: "Invalid data format" }, { status: 500 });
    }

    // Convert to array format
    const softwareAnalysis: SoftwareData[] = results.map((row) => ({
      software_name: row.software_name,
      version: row.version,
      count: row.count
    }));

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      softwareAnalysis
    });

  } catch (error) {
    console.error("Software analysis error:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Internal server error" 
    }, { status: 500 });
  }
} 