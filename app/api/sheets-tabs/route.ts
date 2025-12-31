/**
 * API Route: Detect all tabs in a Google Sheet
 * This runs server-side to bypass CORS restrictions
 */

import { NextRequest, NextResponse } from 'next/server';

interface TabInfo {
    name: string;
    gid: string;
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId');

    if (!sheetId) {
        return NextResponse.json({ error: 'Missing sheetId parameter' }, { status: 400 });
    }

    console.log(`[API /sheets-tabs] Detecting tabs for sheet: ${sheetId}`);

    const tabs: TabInfo[] = [];
    const foundGids = new Set<string>();

    // Method 1: Use the htmlembed endpoint (BEST - works for "anyone with link" sheets!)
    // This endpoint returns JavaScript with items.push({name: "SheetName", ... gid=123})
    try {
        const htmlEmbedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/htmlembed`;
        console.log(`[API /sheets-tabs] Trying htmlembed: ${htmlEmbedUrl}`);

        const embedResponse = await fetch(htmlEmbedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });

        if (embedResponse.ok) {
            const html = await embedResponse.text();
            console.log(`[API /sheets-tabs] Got htmlembed: ${html.length} chars`);

            // Pattern: items.push({name: "SheetName", pageUrl: "...gid=123...
            // This regex captures the sheet name and gid from the JavaScript in htmlembed
            const pattern = /items\.push\(\{name:\s*"([^"]+)"[^}]*gid=(\d+)/g;
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const name = match[1].replace(/\\\//g, '/'); // Unescape forward slashes
                const gid = match[2];
                if (name && !foundGids.has(gid)) {
                    foundGids.add(gid);
                    tabs.push({ name, gid });
                    console.log(`[API /sheets-tabs] Htmlembed found: ${name} (gid: ${gid})`);
                }
            }

            // Also try alternative pattern: gid: "123" right after name
            if (tabs.length === 0) {
                const pattern2 = /name:\s*"([^"]+)"[^}]*gid:\s*"(\d+)"/g;
                while ((match = pattern2.exec(html)) !== null) {
                    const name = match[1].replace(/\\\//g, '/');
                    const gid = match[2];
                    if (name && !foundGids.has(gid)) {
                        foundGids.add(gid);
                        tabs.push({ name, gid });
                        console.log(`[API /sheets-tabs] Pattern2 found: ${name} (gid: ${gid})`);
                    }
                }
            }
        } else {
            console.log(`[API /sheets-tabs] Htmlembed failed: ${embedResponse.status}`);
        }
    } catch (error) {
        console.error('[API /sheets-tabs] Htmlembed error:', error);
    }

    // Method 2: Parse the pubhtml page for tab information
    if (tabs.length === 0) {
        try {
            const pubHtmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pubhtml`;
            console.log(`[API /sheets-tabs] Trying pubhtml: ${pubHtmlUrl}`);

            const pubResponse = await fetch(pubHtmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });

            if (pubResponse.ok) {
                const html = await pubResponse.text();
                console.log(`[API /sheets-tabs] Got pubhtml: ${html.length} chars`);

                // Pattern 1: <li id="sheet-button-123"><a>Name</a></li>
                const pattern1 = /id="sheet-button-(\d+)"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi;
                let match;
                while ((match = pattern1.exec(html)) !== null) {
                    const gid = match[1];
                    const name = match[2].trim();
                    if (name && !foundGids.has(gid)) {
                        foundGids.add(gid);
                        tabs.push({ name, gid });
                        console.log(`[API /sheets-tabs] Pattern1 found: ${name} (gid: ${gid})`);
                    }
                }

                // Pattern 2: switchToSheet('123')...>Name</a>
                if (tabs.length === 0) {
                    const pattern2 = /switchToSheet\(['"](\d+)['"]\)[^>]*>([^<]+)</gi;
                    while ((match = pattern2.exec(html)) !== null) {
                        const gid = match[1];
                        const name = match[2].trim();
                        if (name && !foundGids.has(gid)) {
                            foundGids.add(gid);
                            tabs.push({ name, gid });
                            console.log(`[API /sheets-tabs] Pattern2 found: ${name} (gid: ${gid})`);
                        }
                    }
                }

                // Pattern 3: Look for sheet names in the sheet-menu ul
                // <ul class="sheet-menu"...><li data-id="123"><a>Name</a></li>
                if (tabs.length === 0) {
                    const pattern3 = /data-id="(\d+)"[^>]*>[^<]*<a[^>]*>([^<]+)<\/a>/gi;
                    while ((match = pattern3.exec(html)) !== null) {
                        const gid = match[1];
                        const name = match[2].trim();
                        if (name && !foundGids.has(gid)) {
                            foundGids.add(gid);
                            tabs.push({ name, gid });
                            console.log(`[API /sheets-tabs] Pattern3 found: ${name} (gid: ${gid})`);
                        }
                    }
                }

                // Pattern 4: #gid=xxx>Name<
                if (tabs.length === 0) {
                    const pattern4 = /#gid=(\d+)[^>]*>([^<]{1,100})</gi;
                    while ((match = pattern4.exec(html)) !== null) {
                        const gid = match[1];
                        const name = match[2].trim();
                        if (name && name.length < 100 && !foundGids.has(gid)) {
                            foundGids.add(gid);
                            tabs.push({ name, gid });
                            console.log(`[API /sheets-tabs] Pattern4 found: ${name} (gid: ${gid})`);
                        }
                    }
                }

                // Pattern 5: Look for sheet tab buttons with onclick
                // onclick="switchToSheet('123')"...>Name
                if (tabs.length === 0) {
                    const pattern5 = /onclick="[^"]*switchToSheet\(['"]?(\d+)['"]?\)[^"]*"[^>]*>([^<]+)</gi;
                    while ((match = pattern5.exec(html)) !== null) {
                        const gid = match[1];
                        const name = match[2].trim();
                        if (name && !foundGids.has(gid)) {
                            foundGids.add(gid);
                            tabs.push({ name, gid });
                            console.log(`[API /sheets-tabs] Pattern5 found: ${name} (gid: ${gid})`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[API /sheets-tabs] Pubhtml error:', error);
        }
    }

    // Method 3: Try the regular edit page HTML (might work for "anyone with link" shares)
    if (tabs.length === 0) {
        try {
            const editUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
            console.log(`[API /sheets-tabs] Trying edit page: ${editUrl}`);

            const editResponse = await fetch(editUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                redirect: 'follow',
            });

            if (editResponse.ok) {
                const html = await editResponse.text();
                console.log(`[API /sheets-tabs] Got edit page: ${html.length} chars`);

                // Look for sheet tab data in the page's JavaScript
                // Pattern: ["SheetName",123,...]
                const jsPattern = /\["([^"]{1,100})",\s*(\d+),\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*\d+\]/g;
                let match;
                while ((match = jsPattern.exec(html)) !== null) {
                    const name = match[1];
                    const gid = match[2];
                    if (name && !name.includes('\\') && !foundGids.has(gid)) {
                        foundGids.add(gid);
                        tabs.push({ name, gid });
                        console.log(`[API /sheets-tabs] JS pattern found: ${name} (gid: ${gid})`);
                    }
                }

                // Also look for {"name":"SheetName","sheetId":123}
                const jsonPattern = /"name":\s*"([^"]+)"[^}]*"sheetId":\s*(\d+)/g;
                while ((match = jsonPattern.exec(html)) !== null) {
                    const name = match[1];
                    const gid = match[2];
                    if (name && !foundGids.has(gid)) {
                        foundGids.add(gid);
                        tabs.push({ name, gid });
                        console.log(`[API /sheets-tabs] JSON pattern found: ${name} (gid: ${gid})`);
                    }
                }
            }
        } catch (error) {
            console.error('[API /sheets-tabs] Edit page error:', error);
        }
    }

    // If still no tabs found, return a default
    if (tabs.length === 0) {
        console.log('[API /sheets-tabs] No tabs detected, returning default');
        tabs.push({ name: 'Sheet1', gid: '0' });
    }

    console.log(`[API /sheets-tabs] Final result: ${tabs.length} tabs found`);
    return NextResponse.json({ tabs });
}
