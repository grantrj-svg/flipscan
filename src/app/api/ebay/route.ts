// src/app/api/ebay/route.ts
import { NextRequest } from 'next/server';

const EBAY_APP_ID = 'GrantLan-FlipScan-PRD-e6e68b715-50d13841'; // ← REPLACE LATER

export async function GET(request: NextRequest) {
  const barcode = request.nextUrl.searchParams.get('barcode');
  if (!barcode) return Response.json({ error: 'No barcode' }, { status: 400 });

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateStr = sixMonthsAgo.toISOString().split('T')[0];

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?` +
    `OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.13.0` +
    `&SECURITY-APPNAME=${EBAY_APP_ID}` +
    `&RESPONSE-DATA-FORMAT=JSON` +
    `&keywords=${barcode}` +
    `&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true` +
    `&itemFilter(1).name=EndTimeFrom&itemFilter(1).value=${dateStr}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const prices = items
      .map((i: any) => parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0))
      .filter((p: number) => p > 0);

    const avgPrice = prices.length > 0 
      ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2)
      : '0.00';
    const soldCount = prices.length;

    return Response.json({ avgPrice, soldCount });
  } catch {
    return Response.json({ error: 'eBay failed' }, { status: 500 });
  }
}