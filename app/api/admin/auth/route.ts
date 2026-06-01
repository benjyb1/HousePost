import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { adminToken } from '@/lib/admin/token'

export async function POST(request: Request) {
  const { password } = await request.json()

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD ?? ''
  let match = false

  try {
    const provided = Buffer.from(password)
    const stored = Buffer.from(adminPassword)
    match = provided.length === stored.length && timingSafeEqual(provided, stored)
  } catch {
    match = false
  }

  if (!match) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('admin-auth', await adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  })

  return response
}
