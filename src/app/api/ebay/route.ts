// src/app/api/ebay/route.ts
import { NextRequest } from 'next/server';

const EBAY_APP_ID = 'GrantLan-FlipScan-PRD-ee6e68b715-50d13841'; // ← YOUR KEY HERE

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get('barcode');

  if (!barcode) {
    return Response.json({ error: 'No barcode' }, { status: 400 });
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split('T')[0];

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?` +
    `OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.13.0` +
    `&SECURITY-APPNAME=${EBAY_APP_ID}` +
    `&RESPONSE-DATA-FORMAT=JSON` +
    `&keywords=${encodeURIComponent(barcode)}` +
    `&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true` +
    `&itemFilter(1).name=EndTimeFrom&itemFilter(1).value=${dateStr}` +
    `&paginationInput.entriesPerPage=100`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('eBay raw response:', text.substring(0, 500)); // DEBUG: Log first 500 chars

    const data = JSON.parse(text);

    // FIXED JSON PATH
    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    console.log('Items found:', items.length); // DEBUG

    const prices = items
      .map((i: any) => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0))
      .filter((p: number) => p > 0);

    console.log('Valid prices:', prices); // DEBUG

    const avgPrice = prices.length > 0 
      ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2)
      : '0.00';
    const soldCount = prices.length;

    return Response.json({ avgPrice, soldCount });
  } catch (err) {
    console.error('eBay error:', err);
    return Response.json({ error: 'eBay API failed', debug: url }, { status: 500 });
  }
}