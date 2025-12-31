/**
 * Google Sheets Integration Utilities
 * Fetches data from public Google Sheets via CSV export
 */

export interface SheetRow {
  [key: string]: string | number;
}

export interface AdsData {
  id: string;
  platform: string;
  metrics_date: string;
  campaign_name: string;
  total_budget_burnt: number;
  total_impressions: number;
  total_clicks: number;
  total_gmv: number;
  total_ctr: number;
  total_roi: number;
  // Extended fields for Swiggy
  city?: string;
  area_name?: string;
  brand?: string;
  total_conversions?: number;
  total_a2c?: number;
  units_sold?: number;
  [key: string]: string | number | undefined;
}

export interface SheetTabInfo {
  name: string;
  gid: string;
  rowCount: number;
  headers: string[];
}

/**
 * Extract the Sheet ID from a Google Sheets URL
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Build CSV export URL for a specific tab
 */
export function buildCsvExportUrl(sheetId: string, tabName?: string, gid?: string): string {
  if (gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }
  if (tabName && tabName !== 'Sheet1') {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  }
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
}

/**
 * Fetch sheet metadata to get all tab names
 * Uses a server-side API to bypass CORS restrictions
 */
export async function fetchSheetTabs(sheetId: string): Promise<SheetTabInfo[]> {
  console.log(`[fetchSheetTabs] Fetching tabs for sheet: ${sheetId}`);

  try {
    // Call server-side API that can bypass CORS
    const apiUrl = `/api/sheets-tabs?sheetId=${encodeURIComponent(sheetId)}`;
    console.log(`[fetchSheetTabs] Calling API: ${apiUrl}`);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.tabs && data.tabs.length > 0) {
      console.log(`[fetchSheetTabs] API returned ${data.tabs.length} tabs:`, data.tabs.map((t: any) => t.name));

      // Now fetch row counts and headers for each tab
      const tabs: SheetTabInfo[] = [];
      for (const tab of data.tabs) {
        try {
          const csvData = await fetchSheetAsCsv(sheetId, tab.name, tab.gid);
          tabs.push({
            name: tab.name,
            gid: tab.gid,
            rowCount: csvData.length,
            headers: csvData.length > 0 ? Object.keys(csvData[0]) : []
          });
          console.log(`[fetchSheetTabs] Tab "${tab.name}": ${csvData.length} rows`);
        } catch (e) {
          // Tab might not be accessible, still add it with defaults
          console.log(`[fetchSheetTabs] Could not fetch data for tab "${tab.name}", adding with defaults`);
          tabs.push({
            name: tab.name,
            gid: tab.gid,
            rowCount: 0,
            headers: []
          });
        }
      }

      return tabs;
    }
  } catch (error) {
    console.error('[fetchSheetTabs] API call failed:', error);
  }

  // Fallback: Try default sheet if API failed
  console.log('[fetchSheetTabs] Falling back to default tab...');
  try {
    const csvData = await fetchSheetAsCsv(sheetId);
    if (csvData.length > 0) {
      return [{
        name: 'Sheet1',
        gid: '0',
        rowCount: csvData.length,
        headers: Object.keys(csvData[0] || {})
      }];
    }
  } catch (e) {
    console.error('[fetchSheetTabs] Fallback failed:', e);
  }

  return [];
}

/**
 * Detect if a sheet tab is ads or sales based on column headers
 */
export function detectDataType(headers: string[]): 'ads' | 'sales' {
  const lowerHeaders = headers.map(h => h.toLowerCase());

  // Ads-specific columns
  const adsIndicators = ['impressions', 'clicks', 'ctr', 'cpi', 'roi', 'roas', 'budget', 'spend', 'spends', 'ad_name', 'campaign', 'budget_burnt'];
  // Sales-specific columns
  const salesIndicators = ['order_id', 'order', 'quantity', 'units_sold', 'sku', 'product_name', 'mrp', 'discount', 'net_amount'];

  const adsScore = adsIndicators.filter(ind => lowerHeaders.some(h => h.includes(ind))).length;
  const salesScore = salesIndicators.filter(ind => lowerHeaders.some(h => h.includes(ind))).length;

  return adsScore >= salesScore ? 'ads' : 'sales';
}

/**
 * Validate and get info about a sheet URL
 */
export async function validateSheetUrl(url: string): Promise<{
  valid: boolean;
  sheetId: string | null;
  tabs: SheetTabInfo[];
  error?: string;
}> {
  const sheetId = extractSheetId(url);

  if (!sheetId) {
    return { valid: false, sheetId: null, tabs: [], error: 'Invalid Google Sheets URL' };
  }

  try {
    console.log(`[validateSheetUrl] Validating sheet: ${sheetId}`);

    // Get tab info (this also validates access)
    const tabs = await fetchSheetTabs(sheetId);

    if (tabs.length === 0) {
      return { valid: false, sheetId, tabs: [], error: 'Sheet is empty or not accessible. Make sure it\'s published to web.' };
    }

    console.log(`[validateSheetUrl] Found ${tabs.length} tabs with data`);
    return { valid: true, sheetId, tabs };
  } catch (error) {
    console.error('[validateSheetUrl] Error:', error);
    return {
      valid: false,
      sheetId,
      tabs: [],
      error: 'Could not access sheet. Make sure it\'s publicly accessible (Publish to web or share with anyone with link).'
    };
  }
}

/**
 * Fetch a Google Sheet tab as CSV and parse it
 * Uses API route to bypass CORS issues
 */
export async function fetchSheetAsCsv(sheetId: string, tabName?: string, gid?: string): Promise<SheetRow[]> {
  // Build API URL
  const params = new URLSearchParams({ sheetId });
  if (tabName) params.set('tabName', tabName);
  if (gid) params.set('gid', gid);

  const apiUrl = `/api/sheets?${params.toString()}`;
  console.log(`[fetchSheetAsCsv] Calling API: ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || `Failed to fetch sheet: ${response.status}`);
    }

    if (!data.csv) {
      throw new Error('No CSV data returned from API');
    }

    console.log(`[fetchSheetAsCsv] Got ${data.csv.length} bytes of CSV`);
    return parseCsv(data.csv);
  } catch (error) {
    console.error('[fetchSheetAsCsv] Error:', error);
    throw error;
  }
}

/**
 * ROBUST CSV PARSER - Handles embedded newlines, quoted fields, and messy data
 * Uses a state-machine approach to properly parse CSV according to RFC 4180
 */
function parseCsv(csvText: string): SheetRow[] {
  console.log(`[parseCsv] Starting parse of ${csvText.length} characters`);

  // Parse all records using state machine
  const records = parseCSVToRecords(csvText);
  console.log(`[parseCsv] Parsed ${records.length} raw records`);

  if (records.length < 2) return [];

  // Find the header row (first row with at least 3 non-empty values)
  let headerIndex = 0;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(10, records.length); i++) {
    const nonEmpty = records[i].filter(v => v.trim()).length;
    if (nonEmpty >= 3) {
      headers = records[i];
      headerIndex = i;
      break;
    }
  }

  if (headers.length === 0) {
    console.warn('[parseCsv] No valid header row found');
    return [];
  }

  console.log(`[parseCsv] Found ${headers.length} columns, header at row ${headerIndex}`);

  // Parse data rows
  const rows: SheetRow[] = [];
  let skippedEmptyRows = 0;

  for (let i = headerIndex + 1; i < records.length; i++) {
    const values = records[i];

    // Skip empty rows (less than 2 non-empty values)
    const nonEmpty = values.filter(v => v.trim()).length;
    if (nonEmpty < 2) {
      skippedEmptyRows++;
      continue;
    }

    const row: SheetRow = {};

    headers.forEach((header, index) => {
      if (!header.trim()) return;
      const value = values[index] || '';
      const trimmedValue = value.trim();

      // Check if this looks like a date column
      const headerLower = header.toLowerCase();
      const isDateColumn = headerLower.includes('date') ||
        headerLower === 'month' ||
        headerLower === 'day' ||
        headerLower.includes('_date');

      if (isDateColumn) {
        row[header] = trimmedValue;
      } else {
        // Try to parse as number
        const cleanValue = trimmedValue.replace(/[₹$,]/g, '');
        const isNumeric = /^-?\d+\.?\d*$/.test(cleanValue);
        if (isNumeric && cleanValue !== '') {
          row[header] = parseFloat(cleanValue);
        } else {
          row[header] = value;
        }
      }
    });

    rows.push(row);
  }

  if (skippedEmptyRows > 0) {
    console.log(`[parseCsv] Skipped ${skippedEmptyRows} empty rows`);
  }

  console.log(`[parseCsv] Returning ${rows.length} data rows`);
  return rows;
}

/**
 * Parse CSV text into 2D array of strings using proper state machine
 * Handles: quoted fields, embedded newlines, escaped quotes, commas in fields
 */
function parseCSVToRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      // Inside a quoted field
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote ("") - add single quote and skip next
          currentField += '"';
          i++;
        } else {
          // End of quoted field
          inQuotes = false;
        }
      } else {
        // Regular character inside quotes (including newlines)
        currentField += char;
      }
    } else {
      // Outside quoted field
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        currentRecord.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        // Carriage return - skip if followed by newline
        if (nextChar === '\n') {
          continue;
        }
        // End of record
        currentRecord.push(currentField);
        if (currentRecord.some(f => f.trim())) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentField = '';
      } else if (char === '\n') {
        // End of record
        currentRecord.push(currentField);
        if (currentRecord.some(f => f.trim())) {
          records.push(currentRecord);
        }
        currentRecord = [];
        currentField = '';
      } else {
        // Regular character
        currentField += char;
      }
    }
  }

  // Don't forget the last field and record
  currentRecord.push(currentField);
  if (currentRecord.some(f => f.trim())) {
    records.push(currentRecord);
  }

  return records;
}

/**
 * Parse a single CSV line (legacy function for compatibility)
 */
function parseCSVLine(line: string): string[] {
  const records = parseCSVToRecords(line);
  return records[0] || [];
}

/**
 * Standard column mappings from various sheet formats to our internal format
 * Keys are LOWERCASE for case-insensitive matching
 */
const COLUMN_MAPPINGS: Record<string, string> = {
  // Date columns
  'date': 'metrics_date',
  'metrics_date': 'metrics_date',
  'metrics date': 'metrics_date',
  'month': 'metrics_date',
  'ordered_date': 'metrics_date',
  'report_date': 'metrics_date',

  // Campaign columns
  'campaign': 'campaign_name',
  'campaign_name': 'campaign_name',
  'campaign name': 'campaign_name',
  'product_name': 'campaign_name',
  'ad_name': 'campaign_name',
  'ad name': 'campaign_name',
  'menu_name': 'campaign_name',
  'product': 'campaign_name',
  'item_name': 'campaign_name',
  'item': 'campaign_name',
  'name': 'campaign_name',

  // Spend columns
  'spends': 'total_budget_burnt',
  'spend': 'total_budget_burnt',
  'total_budget_burnt': 'total_budget_burnt',
  'budget burnt': 'total_budget_burnt',
  'budget spent': 'total_budget_burnt',
  'cost': 'total_budget_burnt',
  'daily budget': 'total_budget_burnt',
  'budget_burnt': 'total_budget_burnt',
  'total_spend': 'total_budget_burnt',
  'total_spends': 'total_budget_burnt',
  'amount_spent': 'total_budget_burnt',

  // Impressions
  'impressions': 'total_impressions',
  'total_impressions': 'total_impressions',
  'impr': 'total_impressions',
  'views': 'total_impressions',
  'total_views': 'total_impressions',

  // Clicks
  'clicks': 'total_clicks',
  'total_clicks': 'total_clicks',
  'click': 'total_clicks',

  // Sales/GMV
  'sales': 'total_gmv',
  'gmv': 'total_gmv',
  'total_gmv': 'total_gmv',
  'revenue': 'total_gmv',
  'total_direct_gmv_14_days': 'total_gmv',
  'total_direct_gmv_7_days': 'total_gmv',
  'total_sales': 'total_gmv',
  'order_value': 'total_gmv',
  'total_revenue': 'total_gmv',

  // CTR
  'ctr': 'total_ctr',
  'total_ctr': 'total_ctr',

  // ROI/ROAS
  'roi': 'total_roi',
  'roas': 'total_roi',
  'total_roi': 'total_roi',
  'total_direct_roi_14_days': 'total_roi',
  'total_direct_roi_7_days': 'total_roi',

  // City/Location
  'city': 'city',
  'location': 'city',
  'area_name': 'area_name',
  'region': 'city',

  // Brand
  'brand': 'brand',
  'brand_name': 'brand',

  // Conversions
  'total_conversions': 'total_conversions',
  'conversions': 'total_conversions',
  'total_a2c': 'total_a2c',
  'orders': 'total_conversions',
  'total_orders': 'total_conversions',

  // Units sold (for sales data)
  'units_sold': 'units_sold',
  'quantity': 'units_sold',
  'qty': 'units_sold',
};

/**
 * Normalize column names using the mapping
 */
function normalizeColumnName(name: string): string {
  const lower = name.toLowerCase().trim();
  return COLUMN_MAPPINGS[lower] || lower.replace(/\s+/g, '_');
}

/**
 * Transform raw sheet data to AdsData format
 */
export function transformToAdsData(rows: SheetRow[], platform: string): AdsData[] {
  return rows.map((row, index) => {
    const normalized: AdsData = {
      id: `${platform}-${index}-${Date.now()}`,
      platform: platform,
      metrics_date: '',
      campaign_name: '',
      total_budget_burnt: 0,
      total_impressions: 0,
      total_clicks: 0,
      total_gmv: 0,
      total_ctr: 0,
      total_roi: 0,
    };

    // Map each column
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = normalizeColumnName(key);
      if (normalizedKey in normalized) {
        (normalized as Record<string, string | number>)[normalizedKey] = value;
      }
    });

    // Format date if present
    if (normalized.metrics_date) {
      normalized.metrics_date = formatDate(String(normalized.metrics_date));
    }

    return normalized;
  }).filter(row => {
    // Filter out rows that appear to be completely empty
    // Be more lenient - include rows that have ANY numeric value or a campaign name
    const hasNumericValue =
      (row.total_budget_burnt > 0) ||
      (row.total_impressions > 0) ||
      (row.total_clicks > 0) ||
      (row.total_gmv > 0);
    const hasCampaign = Boolean(row.campaign_name);
    return hasNumericValue || hasCampaign;
  });
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';

  // Handle month names like "Nov-25"
  const monthMatch = dateStr.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (monthMatch) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());
    if (monthIndex !== -1) {
      const year = parseInt(monthMatch[2]) + 2000;
      return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
    }
  }

  // Try parsing various formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Handle DD/MM/YYYY format
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d.length === 4) {
      return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return dateStr;
}

/**
 * Fetch all data from a data source (all configured tabs)
 */
export async function fetchDataFromSource(
  sheetId: string,
  tabs: { name: string; platform: string; gid?: string }[]
): Promise<AdsData[]> {
  const allData: AdsData[] = [];

  for (const tab of tabs) {
    try {
      const rows = await fetchSheetAsCsv(sheetId, tab.name, tab.gid);
      const adsData = transformToAdsData(rows, tab.platform);
      allData.push(...adsData);
    } catch (error) {
      console.error(`Error fetching tab ${tab.name}:`, error);
    }
  }

  console.log(`[fetchDataFromSource] Fetched ${allData.length} total records from ${tabs.length} tabs`);
  return allData;
}

/**
 * Fetch a preview of a sheet (first 5 rows with headers)
 */
export async function fetchSheetPreview(
  sheetId: string,
  tabName?: string,
  gid?: string
): Promise<{ headers: string[]; rows: (string | number)[][] }> {
  try {
    const allRows = await fetchSheetAsCsv(sheetId, tabName, gid);

    if (allRows.length === 0) {
      return { headers: [], rows: [] };
    }

    const headers = Object.keys(allRows[0]);
    const previewRows = allRows.slice(0, 5).map(row =>
      headers.map(h => row[h] ?? '')
    );

    return { headers, rows: previewRows };
  } catch (error) {
    console.error('Error fetching sheet preview:', error);
    return { headers: [], rows: [] };
  }
}
