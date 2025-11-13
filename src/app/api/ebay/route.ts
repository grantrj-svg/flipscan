// src/app/api/ebay/route.ts
import { NextRequest } from 'next/server';

const EBAY_APP_ID = 'GrantLan-FlipScan-PRD-e6e68b715-50d13841'; // ← YOUR KEY

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
    `OPERATION-NAME=findCompletedItems` +
    `&SERVICE-VERSION=1.13.0` +
    `&SECURITY-APPNAME=${EBAY_APP_ID}` +
    `&RESPONSE-DATA-FORMAT=JSON` +
    `&keywords=${encodeURIComponent(barcode)}` +
    `&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true` +
    `&itemFilter(1).name=EndTimeFrom&itemFilter(1).value=${dateStr}` +
    `&paginationInput.entriesPerPage=50`;

  console.log('Calling eBay API:', url);

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const text = await res.text();

    console.log('eBay Raw Response:', text.substring(0, 1000));

    if (!res.ok) {
      return Response.json({ error: 'eBay API error', status: res.status, body: text }, { status: 500 });
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return Response.json({ error: 'Invalid JSON', raw: text }, { status: 500 });
    }

    const items = data.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    console.log('Found items:', items.length);

    const prices = items
      .map((i: any) => {
        const price = i.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
        return price ? parseFloat(price) : 0;
      })
      .filter((p: number) => p > 0);

    const avgPrice = prices.length > 0
      ? (prices.reduce((a: number, b: number) => a + b, 0) / prices.length).toFixed(2)
      : '0.00';
    const soldCount = prices.length;

    return Response.json({
      avgPrice,
      soldCount,
      debug: { itemsFound: items.length, prices }
    });
  } catch (err: any) {
    return Response.json({ error: 'Fetch failed', message: err.message }, { status: 500 });
  }
}