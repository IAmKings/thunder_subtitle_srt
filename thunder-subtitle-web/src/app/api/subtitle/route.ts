import { NextResponse } from 'next/server';

const API_BASE_URL = 'https://api-shoulei-ssl.xunlei.com/oracle';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name || name.trim().length === 0) {
    return NextResponse.json(
      { code: 400, msg: 'Search keyword cannot be empty' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${API_BASE_URL}/subtitle?name=${encodeURIComponent(name.trim())}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { code: response.status, msg: response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy API error:', error);
    return NextResponse.json(
      { code: 500, msg: 'Internal server error' },
      { status: 500 }
    );
  }
}
